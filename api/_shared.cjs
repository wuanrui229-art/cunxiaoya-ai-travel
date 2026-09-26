const { createLocalAi } = require("../local-ai.cjs");
// Vercel's filesystem is ephemeral. Responses retain metadata; no local log writes.
const ai = createLocalAi({ log: false });
const visits = new Map();
let active = 0;
function send(res, status, data) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(status).json(data);
}
function config(_req, res) {
  send(res, 200, {
    success: true,
    data: {
      demo: true,
      ai_enabled: ai.enabled,
      ai_provider: ai.enabled ? "DeepSeek" : null,
    },
  });
}
async function handle(req, res) {
  const action = req.query?.action;
  if (!["chat", "generate"].includes(action))
    return send(res, 404, { success: false, message: "Not found" });
  if (req.method !== "POST")
    return send(res, 405, { success: false, message: "JSON POST required" });
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (
    (origin && origin !== `https://${host}`) ||
    req.headers["sec-fetch-site"] === "cross-site"
  )
    return send(res, 403, {
      success: false,
      message: "Cross-origin request denied",
    });
  if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || ""))
    return send(res, 415, { success: false, message: "JSON required" });
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return send(res, 400, { success: false, message: "Invalid JSON" });
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return send(res, 400, { success: false, message: "Invalid request" });
  if (Buffer.byteLength(JSON.stringify(body)) > 32768)
    return send(res, 413, { success: false, message: "Request too large" });
  // Best-effort protection per warm instance, not a distributed spending quota.
  const now = Date.now();
  for (const [key, times] of visits) {
    const current = times.filter((time) => now - time < 60000);
    if (current.length) visits.set(key, current);
    else visits.delete(key);
  }
  const ip = String(
    req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "unknown",
  ).split(",")[0];
  const times = visits.get(ip) || [];
  if (active >= 2 || times.length >= 8 || visits.size >= 2000) {
    res.setHeader("Retry-After", "60");
    return send(res, 429, {
      success: false,
      message: "Please wait a minute before requesting more AI advice.",
    });
  }
  visits.set(ip, [...times, now]);
  active++;
  try {
    const data = action === "chat" ? await ai.chat(body) : await ai.route(body);
    send(res, 200, { success: true, data });
  } catch (err) {
    send(res, err.status === 400 ? 400 : 500, {
      success: false,
      message:
        err.status === 400
          ? err.message
          : "AI is temporarily unavailable. Please try again.",
    });
  } finally {
    active--;
  }
}
module.exports = { config, handle };
