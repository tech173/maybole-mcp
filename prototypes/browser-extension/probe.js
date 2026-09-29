// Intentionally capability detection only. DOM-driven draft creation stays
// disabled until selectors, attachments, account choice, persistence and
// provider UI changes pass stress tests.
const provider = location.hostname === 'mail.google.com' ? 'gmail_web' : 'outlook_web'
chrome.storage.local.set({ mayboleCapabilityProbe: { provider, detectedAt: new Date().toISOString(), draftCreationEnabled: false } })
