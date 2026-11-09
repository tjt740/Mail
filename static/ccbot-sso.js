(() => {
  const origins = JSON.parse(document.body.dataset.origins)
  let started = false
  let parentOrigin, requestId, identity, frame, checkTimer
  const allowed = origin => {
    try {
      const url = new URL(origin)
      return origins.includes(origin) || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
    } catch { return false }
  }
  const notify = (type, extra = {}) => parent.postMessage({ type, requestId, ...extra }, parentOrigin)
  const fail = () => {
    if (frame) frame.remove()
    clearInterval(checkTimer)
    notify('ccbot-mail-error')
  }
  const verify = async () => {
    try {
      const response = await fetch('ccbot/status', { cache: 'no-store' })
      const current = await response.json()
      if (!response.ok || current.username !== identity.username || current.session_id !== identity.session_id) throw Error()
      return true
    } catch { fail(); return false }
  }
  const waitForContent = async () => {
    const deadline = Date.now() + 25000
    while (Date.now() < deadline && frame?.isConnected) {
      const doc = frame.contentDocument
      if (doc?.querySelector('.admin-app') && doc.querySelector('.legacy-frame-wrap[aria-busy="false"]')) return true
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    fail()
    return false
  }
  window.addEventListener('message', async event => {
    if (started || event.source !== parent || !allowed(event.origin) || event.data?.type !== 'ccbot-mail-login') return
    started = true
    parentOrigin = event.origin
    requestId = event.data.requestId
    try {
      const response = await fetch('ccbot/consume', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: event.data.ticket, parent_origin: event.origin }) })
      identity = await response.json()
      if (!response.ok) throw Error()
      frame = document.createElement('iframe')
      frame.title = '邮局后台'
      frame.addEventListener('load', async () => {
        if (await waitForContent() && await verify()) notify('ccbot-mail-loaded', { username: identity.username })
      })
      // Relative to /auth/ccbot, preserving /email or any other mount prefix.
      frame.src = '../admin/mailbox'
      document.body.append(frame)
      checkTimer = setInterval(verify, 15000)
    } catch { fail() }
  })
  // This message carries no credentials. The parent validates source and origin.
  if (parent !== window) parent.postMessage({ type: 'ccbot-mail-ready' }, '*')
})()
