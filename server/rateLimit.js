// Simple in-memory rate limiter (per IP, sliding window). Good enough for one server;
// use a shared store (e.g. Redis or the database) if you run several servers.

export function rateLimit({ windowMs, max, message }) {
  const hits = new Map() // ip -> timestamps
  setInterval(() => {
    const cutoff = Date.now() - windowMs
    for (const [ip, times] of hits) {
      const recent = times.filter((t) => t > cutoff)
      if (recent.length) hits.set(ip, recent)
      else hits.delete(ip)
    }
  }, windowMs).unref()

  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    const now = Date.now()
    const recent = (hits.get(ip) || []).filter((t) => t > now - windowMs)
    if (recent.length >= max) {
      res.set('Retry-After', String(Math.ceil((recent[0] + windowMs - now) / 1000)))
      return res.status(429).json({ error: message })
    }
    recent.push(now)
    hits.set(ip, recent)
    next()
  }
}
