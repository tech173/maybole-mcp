const allowedCodes = new Set(['permission_denied', 'account_mismatch', 'attachment_failed', 'provider_error', 'draft_not_persisted', 'user_cancelled', 'unsupported_client'])

export function diagnosticEvent(event, fields = {}) {
  const safe = { event, at: new Date().toISOString() }
  if (typeof fields.adapter === 'string') safe.adapter = fields.adapter.slice(0, 32)
  if (Number.isInteger(fields.count)) safe.count = Math.max(0, Math.min(25, fields.count))
  if (Number.isFinite(fields.duration_ms)) safe.duration_ms = Math.max(0, Math.round(fields.duration_ms))
  if (allowedCodes.has(fields.error_code)) safe.error_code = fields.error_code
  return safe
}

export function logDiagnostic(event, fields, output = process.stderr) {
  output.write(`${JSON.stringify(diagnosticEvent(event, fields))}\n`)
}
