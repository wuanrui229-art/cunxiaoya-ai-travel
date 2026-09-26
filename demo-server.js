// Local catalogue preview with optional server-side DeepSeek. No MySQL required.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "public");
const { createLocalAi } = require("./local-ai.cjs");
if (fs.existsSync(path.join(__dirname, ".env")))
  process.loadEnvFile(path.join(__dirname, ".env"));
const ai = createLocalAi();
let active = 0;
let calls = [];
function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
async function aiRequest(req, res, pathname) {
  // Only same-origin browser requests can spend the local owner's API credits.
  const host = req.headers.host;
  if (
    !/^127\.0\.0\.1:\d+$/.test(host || "") &&
    !/^localhost:\d+$/.test(host || "")
  )
    return json(res, 403, { success: false, message: "Invalid host" });
  if (req.headers.origin && req.headers.origin !== `http://${host}`)
    return json(res, 403, {
      success: false,
      message: "Cross-origin request denied",
    });
  if (
    req.method !== "POST" ||
    !/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")
  )
    return json(res, 405, { success: false, message: "JSON POST required" });
  calls = calls.filter((t) => Date.now() - t < 60000);
  if (active >= 2 || calls.length >= 20)
    return json(res, 429, {
      success: false,
      message: "AI 请求较多，请稍后再试。",
    });
  active++;
  calls.push(Date.now());
  try {
    let raw = "",
      size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 32768)
        return json(res, 413, { success: false, message: "请求内容过长。" });
      raw += chunk;
    }
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(res, 400, { success: false, message: "Invalid JSON" });
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return json(res, 400, { success: false, message: "Invalid request" });
    const data = await (pathname === "/api/local-ai/chat"
      ? ai.chat(body)
      : ai.route(body));
    json(res, 200, { success: true, data });
  } catch (err) {
    json(res, err.status || 500, {
      success: false,
      message:
        err.status === 400 ? err.message : "AI 服务暂时不可用，请稍后重试。",
    });
  } finally {
    active--;
  }
}
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};
const server = http.createServer((req, res) => {
  const endpoint = req.url.split("?")[0];
  if (["/api/local-ai/chat", "/api/local-ai/generate"].includes(endpoint)) {
    void aiRequest(req, res, endpoint);
    return;
  }
  if (endpoint === "/api/config") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    return res.end(
      JSON.stringify({
        success: true,
        data: {
          demo: true,
          ai_enabled: ai.enabled,
          ai_provider: ai.enabled ? "DeepSeek" : null,
        },
      }),
    );
  }
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
  } catch {
    res.writeHead(400);
    return res.end();
  }
  const file = path.resolve(
    root,
    "." + (pathname === "/" ? "/index.html" : pathname),
  );
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(data);
  });
});
server.listen(process.env.PORT || 4173, "127.0.0.1", () =>
  console.log("村小丫演示：http://127.0.0.1:" + (process.env.PORT || 4173)),
);
