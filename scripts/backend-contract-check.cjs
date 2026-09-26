// Executes the original route handler with explicit DB/provider doubles.
// Does not prove a real MySQL connection or an actual DeepSeek response.
const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const source = fs.readFileSync(
  require("node:path").join(__dirname, "../server.js"),
  "utf8",
);
const session = {
  id: 1,
  user_id: null,
  selected_villages: [1],
  selected_activities: [11],
  restaurant_selection: [21],
  accommodation_selection: [31],
  selected_cities: ["杭州"],
  activity_preferences: ["茶田寻香"],
  departure_date: "2026-10-01",
  return_date: "2026-10-02",
  departure_city: "上海",
  travel_mode: "自驾",
  travelers_count: 2,
  travel_relation: "朋友结伴",
  budget_per_person: 800,
  accommodation_type: "特色民宿",
  dining_requirements: "素食",
  custom_requirements: "喝茶，每天午休",
  parsed_requirement_tags: [{ tag: "茶", importance: 1 }],
};
async function scenario(key, mode) {
  const handlers = {},
    writes = [],
    prompts = [];
  let calls = 0;
  const app = {
    use() {},
    get() {},
    post(p, fn) {
      handlers[p] = fn;
    },
    put() {},
    delete() {},
    listen() {},
  };
  const express = () => app;
  express.json = () => {};
  express.static = () => {};
  const pool = {
    query: async (sql, args) => {
      if (sql.startsWith("UPDATE")) {
        writes.push(args);
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("FROM user_trip_session")) return [[session]];
      if (sql.includes("FROM village_activity"))
        return [
          [
            {
              id: 11,
              name: "已选采茶体验",
              category: "茶",
              description: "本地茶园",
            },
          ],
        ];
      if (sql.includes("FROM village_dining"))
        return [
          [
            {
              id: 21,
              name: "已选素食餐厅",
              avg_price: 50,
              description: "素食",
            },
          ],
        ];
      if (sql.includes("FROM village_accommodation"))
        return [
          [
            {
              id: 31,
              name: "已选山间民宿",
              price_per_night: 280,
              type: "特色民宿",
            },
          ],
        ];
      if (sql.includes("FROM village"))
        return [
          [
            {
              id: 1,
              village_name: "径山村",
              city: "杭州",
              description: "茶乡",
            },
          ],
        ];
      throw Error("Unexpected SQL: " + sql);
    },
  };
  const ctx = {
    require: (n) =>
      n === "express"
        ? express
        : n === "cors"
          ? () => {}
          : n === "uuid"
            ? { v4: () => "test-token" }
            : n === "dotenv"
              ? { config() {} }
              : n === "./db"
                ? pool
                : require(n),
    process: { env: { DEEPSEEK_API_KEY: key } },
    __dirname: require("node:path").join(__dirname, ".."),
    console: { log() {}, error() {} },
    AbortSignal,
    fetch: async (url, opts) => {
      calls++;
      assert(opts.signal, "Provider calls must be time-bounded");
      prompts.push(JSON.parse(opts.body));
      if (mode === "timeout")
        throw new DOMException("Timed out", "TimeoutError");
      if (mode === "http-error")
        return { ok: false, status: 503, text: async () => "unavailable" };
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  mode === "empty"
                    ? ""
                    : mode === "tags"
                      ? '[{"tag":"茶田寻香","importance":1}]'
                      : "Day 1: 已选采茶体验; 已选素食餐厅; 已选山间民宿",
              },
            },
          ],
        }),
      };
    },
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  if (mode === "tags") {
    const out = await ctx.parseRequirementsWithAI("想喝茶", "朋友结伴", []);
    assert(out.aiGenerated);
    assert.equal(out.tags[0].tag, "茶田寻香");
    return;
  }
  let result;
  const res = {
    json(x) {
      result = x;
    },
    status() {
      return this;
    },
  };
  await handlers["/api/sessions/:token/generate-route"](
    { params: { token: "test" }, body: { language: "en" } },
    res,
  );
  assert(result.success);
  assert(result.data.route.length > 20);
  assert.equal(result.data.ai_generated, mode === "success");
  assert.equal(writes.length, 1, "Generated route persisted");
  for (const name of ["已选采茶体验", "已选素食餐厅", "已选山间民宿"])
    assert(result.data.route.includes(name), name + " retained in output");
  if (key) {
    assert.equal(calls, 1);
    const prompt = prompts[0].messages.map((m) => m.content).join("\n");
    for (const word of [
      "已选采茶体验",
      "已选素食餐厅",
      "已选山间民宿",
      "每天午休",
      "English",
    ])
      assert(prompt.includes(word), word + " passed to provider");
  } else assert.equal(calls, 0);
}
(async () => {
  await scenario("", "no-key");
  await scenario("test-only", "success");
  await scenario("test-only", "http-error");
  await scenario("test-only", "timeout");
  await scenario("test-only", "empty");
  await scenario("test-only", "tags");
  console.log(
    "PASS backend contract (DB/provider doubles): tag parsing, database selection context, English instruction, route persistence, no-key/503/timeout/empty-response template fallback. No real provider or MySQL exercised.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
