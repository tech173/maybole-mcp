/** The native parent owns this process via a pipe. Force quit closes the pipe;
 * no stale PID file or unrelated process needs to be killed on the next launch. */
export function ownHelperLifetime(getServer, { parentInput = null, exit = (code) => process.exit(code) } = {}) {
  let stopping = false
  const stop = () => {
    if (stopping) return
    stopping = true
    const server = getServer()
    const deadline = setTimeout(() => exit(0), 1500)
    deadline.unref()
    if (!server) return exit(0)
    server.close(() => exit(0))
    server.closeIdleConnections?.()
  }
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
  if (parentInput) {
    parentInput.once('end', stop)
    parentInput.once('error', stop)
    parentInput.resume()
  }
  return stop
}
