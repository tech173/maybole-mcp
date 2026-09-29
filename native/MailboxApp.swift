import AppKit
import Darwin

func brandImage(size: CGFloat) -> NSImage {
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()
    NSColor.white.setFill()
    NSBezierPath(roundedRect: NSRect(x: 0, y: 0, width: size, height: size), xRadius: size * 0.2, yRadius: size * 0.2).fill()
    let transform = NSAffineTransform()
    transform.scale(by: size / 64)
    transform.concat()
    NSColor(white: 0.09, alpha: 1).setFill()
    for points: [(CGFloat, CGFloat)] in [[(8,56),(28,56),(28,46),(18,46),(18,18),(8,18)], [(56,8),(36,8),(36,18),(46,18),(46,46),(56,46)]] {
        let path = NSBezierPath()
        path.move(to: NSPoint(x: points[0].0, y: points[0].1))
        for point in points.dropFirst() { path.line(to: NSPoint(x: point.0, y: point.1)) }
        path.close(); path.fill()
    }
    image.unlockFocus()
    return image
}
if CommandLine.arguments.count == 3 && CommandLine.arguments[1] == "--render-icon" {
    let image = brandImage(size: 1024)
    let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
    try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
    exit(0)
}

final class MailboxDelegate: NSObject, NSApplicationDelegate {
    var child: Process?
    var control: Pipe?
    var output: Pipe?
    var statusItem: NSStatusItem!
    var statusLine = NSMenuItem(title: "Starting…", action: nil, keyEquivalent: "")
    var accountLine = NSMenuItem(title: "Choose an account in the mailbox window", action: nil, keyEquivalent: "")
    var localURL: URL?
    var buffer = Data()
    var quitting = false
    var restarting = false
    var lockFD: Int32 = -1

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Kernel-held lock survives neither crash nor force quit. Never trust a stale PID file.
        let directory = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Maybole")
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        lockFD = Darwin.open(directory.appendingPathComponent("mailbox.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
        guard lockFD >= 0, flock(lockFD, LOCK_EX | LOCK_NB) == 0 else {
            NSRunningApplication.runningApplications(withBundleIdentifier: "ai.maybole.mailbox").first(where: { $0.processIdentifier != getpid() })?.activate(options: [.activateIgnoringOtherApps])
            NSApp.terminate(nil); return
        }
        _ = fcntl(lockFD, F_SETFD, FD_CLOEXEC)
        NSApp.setActivationPolicy(.regular)
        NSApp.applicationIconImage = brandImage(size: 512)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Open Maybole Mailbox", action: #selector(openMailbox), keyEquivalent: "o").target = self
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Maybole Mailbox", action: #selector(quit), keyEquivalent: "q").target = self
        let main = NSMenu(); let item = NSMenuItem(); item.submenu = appMenu; main.addItem(item); NSApp.mainMenu = main
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.image = NSImage(systemSymbolName: "envelope", accessibilityDescription: "Maybole Mailbox")
        statusItem.button?.toolTip = "Maybole Mailbox"
        let menu = NSMenu()
        menu.addItem(statusLine); menu.addItem(accountLine); menu.addItem(.separator())
        menu.addItem(withTitle: "Open Maybole Mailbox", action: #selector(openMailbox), keyEquivalent: "").target = self
        menu.addItem(withTitle: "Restart local connection", action: #selector(restart), keyEquivalent: "").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Maybole Mailbox", action: #selector(quit), keyEquivalent: "q").target = self
        statusItem.menu = menu
        launchHelper()
    }
    func launchHelper() {
        guard child?.isRunning != true, !quitting else { return }
        localURL = nil; statusLine.title = "Starting local connection…"; buffer = Data()
        let process = Process(); let input = Pipe(); let pipe = Pipe()
        let resources = Bundle.main.resourceURL!
        process.executableURL = resources.appendingPathComponent("runtime/node")
        process.arguments = [resources.appendingPathComponent("app/bin/native-supervisor.mjs").path, resources.appendingPathComponent("app/prototypes/local-helper/server.mjs").path]
        var environment = ProcessInfo.processInfo.environment
        environment["MAYBOLE_NATIVE_APP"] = "1"
        process.environment = environment
        process.standardInput = input; process.standardOutput = pipe
        let logDir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/Maybole")
        try? FileManager.default.createDirectory(at: logDir, withIntermediateDirectories: true)
        let log = logDir.appendingPathComponent("mailbox.log")
        if !FileManager.default.fileExists(atPath: log.path) { FileManager.default.createFile(atPath: log.path, contents: nil) }
        if let handle = try? FileHandle(forWritingTo: log) { handle.seekToEndOfFile(); process.standardError = handle }
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            DispatchQueue.main.async { self?.receive(data) }
        }
        process.terminationHandler = { [weak self] _ in DispatchQueue.main.async {
            guard let self = self else { return }
            self.output?.fileHandleForReading.readabilityHandler = nil
            self.localURL = nil
            self.statusLine.title = "Stopped — choose Restart local connection"
            if self.quitting { NSApp.reply(toApplicationShouldTerminate: true) }
            else if self.restarting { self.restarting = false; self.launchHelper() }
        } }
        child = process; control = input; output = pipe
        do { try process.run() }
        catch { statusLine.title = "Could not start — reinstall Maybole Mailbox" }
    }
    func receive(_ data: Data) {
        buffer.append(data)
        while let range = buffer.range(of: Data([10])) {
            let line = buffer.subdata(in: 0..<range.lowerBound); buffer.removeSubrange(0..<range.upperBound)
            guard let value = try? JSONSerialization.jsonObject(with: line) as? [String: Any] else { continue }
            if let text = value["url"] as? String, let url = URL(string: text), url.host == "127.0.0.1", url.scheme == "http" {
                localURL = url; NSWorkspace.shared.open(url)
            }
            if let paired = value["paired"] as? Bool { statusLine.title = paired ? "Running · Maybole connected" : "Running · connect Maybole in the window" }
            if let account = value["account"] as? String { accountLine.title = "Tested account: \(account)" }
        }
    }
    @objc func openMailbox() {
        if let url = localURL { NSWorkspace.shared.open(url) }
        else if child?.isRunning != true { launchHelper() }
    }
    @objc func restart() {
        if let process = child, process.isRunning {
            restarting = true
            statusLine.title = "Restarting local connection…"
            process.terminate()
        } else { launchHelper() }
    }
    @objc func quit() { NSApp.terminate(nil) }
    func applicationDidBecomeActive(_ notification: Notification) { if localURL != nil { openMailbox() } }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { openMailbox(); return true }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard let process = child, process.isRunning else { return .terminateNow }
        quitting = true
        try? control?.fileHandleForWriting.close()
        process.terminate()
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            if process.isRunning { kill(process.processIdentifier, SIGKILL) }
        }
        return .terminateLater
    }
    func applicationWillTerminate(_ notification: Notification) {
        try? control?.fileHandleForWriting.close()
        if lockFD >= 0 { Darwin.close(lockFD) }
    }
}
let app = NSApplication.shared
let delegate = MailboxDelegate()
app.delegate = delegate
app.run()
