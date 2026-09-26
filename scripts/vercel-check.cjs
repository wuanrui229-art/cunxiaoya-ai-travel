const assert = require("node:assert/strict");
process.env.DEEPSEEK_ENABLED = "false";
const { config, handle } = require("../api/_shared.cjs");
function response() {
  return {
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
}
(async () => {
  const cfg = response();
  config({}, cfg);
  assert.equal(cfg.code, 200);
  assert.equal(cfg.body.data.ai_enabled, false);
  assert.equal(cfg.headers["Cache-Control"], "no-store");
  const req = {
    query: { action: "chat" },
    method: "POST",
    headers: {
      host: "sylvaplan.vercel.app",
      origin: "https://sylvaplan.vercel.app",
      "content-type": "application/json",
      "x-real-ip": "test",
    },
    body: { message: "Plan a relaxed weekend", language: "en" },
  };
  const ok = response();
  await handle(req, ok);
  assert.equal(ok.code, 200);
  assert.equal(ok.body.data.ai.status, "fallback");
  for (const [change, expected] of [
    [{ headers: { ...req.headers, origin: "https://another.example" } }, 403],
    [{ headers: { ...req.headers, "sec-fetch-site": "cross-site" } }, 403],
    [{ body: [] }, 400],
    [{ body: "{" }, 400],
    [{ method: "GET" }, 405],
    [{ query: { action: "missing" } }, 404],
    [{ body: { message: "x".repeat(33000) } }, 413],
  ]) {
    const r = response();
    await handle({ ...req, ...change }, r);
    assert.equal(r.code, expected);
  }
  for (let n = 0; n < 7; n++) {
    const r = response();
    await handle(req, r);
    assert.equal(r.code, 200);
  }
  const limited = response();
  await handle(req, limited);
  assert.equal(limited.code, 429);
  assert.equal(limited.headers["Retry-After"], "60");
  console.log(
    "PASS Vercel adapter: runtime config, JSON validation, same-origin checks, fallback, method/body bounds and per-instance rate limit.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
