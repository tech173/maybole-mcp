import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const dist = join(root, 'dist')
const appName = 'Maybole Mailbox.app'
const app = join(dist, appName)
const contents = join(app, 'Contents')
const resources = join(contents, 'Resources')
const runtime = join(resources, 'runtime')
const source = join(resources, 'app')
const executable = join(contents, 'MacOS', 'Maybole Mailbox')
const zip = join(dist, `maybole-mailbox-macos-unsigned-${pkg.version}.zip`)
const publicDir = basename(dirname(root)) === 'packages' ? resolve(root, '..', '..', 'public', 'downloads') : null

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false })
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}`)
}

await rm(app, { recursive: true, force: true })
await rm(zip, { force: true })
await Promise.all([
  mkdir(join(contents, 'MacOS'), { recursive: true }),
  mkdir(runtime, { recursive: true }),
  mkdir(source, { recursive: true }),
])

await Promise.all([
  cp(process.execPath, join(runtime, 'node')),
  cp(join(root, 'bin'), join(source, 'bin'), { recursive: true }),
  cp(join(root, 'prototypes', 'local-helper'), join(source, 'prototypes', 'local-helper'), { recursive: true }),
])

await writeFile(join(source, 'package.json'), `${JSON.stringify({
  name: 'maybole-mailbox-local-app',
  version: pkg.version,
  private: true,
  type: 'module',
  dependencies: pkg.dependencies,
}, null, 2)}\n`)
run('npm', ['install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], source)

await writeFile(join(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>Maybole Mailbox</string>
<key>CFBundleExecutable</key><string>Maybole Mailbox</string>
<key>CFBundleIdentifier</key><string>ai.maybole.mailbox</string>
<key>CFBundleName</key><string>Maybole Mailbox</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>${pkg.version}</string>
<key>CFBundleVersion</key><string>${pkg.version}</string>
<key>LSMinimumSystemVersion</key><string>12.0</string>
<key>LSUIElement</key><false/>
<key>CFBundleIconFile</key><string>Mailbox.icns</string>
<key>NSAppleEventsUsageDescription</key><string>Maybole reads your chosen mail account and creates unsent drafts only after you request them.</string>
</dict></plist>\n`)

run('xcrun', ['swiftc', join(root, 'native', 'MailboxApp.swift'), '-o', executable, '-framework', 'AppKit'])
await chmod(join(runtime, 'node'), 0o755)
const iconset = join(dist, 'Mailbox.iconset')
await mkdir(iconset, { recursive: true })
const master = join(dist, 'mailbox-icon.png')
run(executable, ['--render-icon', master])
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    run('sips', ['-z', String(size * scale), String(size * scale), master, '--out', join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`)])
  }
}
run('iconutil', ['-c', 'icns', iconset, '-o', join(resources, 'Mailbox.icns')])
await rm(iconset, { recursive: true, force: true })

run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip])
const digest = createHash('sha256').update(await readFile(zip)).digest('hex')
await writeFile(`${zip}.sha256`, `${digest}  ${basename(zip)}\n`)
if (publicDir) {
await mkdir(publicDir, { recursive: true })
await Promise.all([
  cp(zip, join(publicDir, basename(zip))),
  cp(`${zip}.sha256`, join(publicDir, `${basename(zip)}.sha256`)),
])
}
process.stdout.write(`Built ${zip}\nSHA-256 ${digest}\nUnsigned Technical Preview: users must approve it in macOS Privacy & Security.\n`)
