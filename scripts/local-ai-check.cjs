const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createLocalAi } = require("../local-ai.cjs");
const publicVillage = JSON.parse(
  fs.readFileSync(
    require("node:path").join(__dirname, "../public/public-villages.json"),
  ),
).villages.find((v) => v.city === "苏州");
const prefs = {
  departure_date: "2026-10-01",
  return_date: "2026-10-02",
  travelers_count: 2,
  budget_per_person: 800,
  custom_requirements: "轻松一点",
  travel_mode: "自驾",
};
const body = {
  prefs,
  ids: [publicVillage.id],
  selected: { activities: [], dining: [], accommodation: [] },
  language: "en",
};
(async () => {
  let sent;
  const make = (fetchImpl) =>
    createLocalAi({
      env: { DEEPSEEK_API_KEY: "test-private-key" },
      fetchImpl,
      log: false,
    });
  const good = make(async (url, opts) => {
    sent = JSON.parse(opts.body);
    assert.equal(new URL(url).host, "api.deepseek.com");
    return {
      ok: true,
      json: async () => ({
        model: "returned-model",
        choices: [
          {
            message: {
              content:
                "Keep time for rest; confirm facilities before departure.",
            },
            finish_reason: "stop",
          },
        ],
        usage: { total_tokens: 80 },
      }),
    };
  });
  const route = await good.route(body);
  assert(route.ai_generated);
  assert(route.catalogue_only);
  assert.equal(route.ai.model, "returned-model");
  assert.equal(route.ai.usage.total_tokens, 80);
  assert.equal(route.sources[0].url, publicVillage.source_url);
  assert(
    route.days[0].items.some((i) => i.name === publicVillage.village_name),
  );
  assert(!JSON.stringify(route).includes("test-private-key"));
  assert(sent.messages[0].content.includes("Respond in English"));
  assert(sent.messages[1].content.includes(publicVillage.village_name));
  assert(!route.days.flatMap((d) => d.items).some((i) => i.price));
  const chat = await good.chat({
    message: "What should I confirm?",
    history: [{ user: true, text: "Two days" }],
    ids: [publicVillage.id],
    language: "en",
  });
  assert(chat.ai_generated);
  assert(sent.messages[1].content.includes("Two days"));
  for (const [response, reason] of [
    [{ ok: false, status: 401 }, "authentication"],
    [{ ok: false, status: 402 }, "balance"],
    [{ ok: false, status: 429 }, "rate_limit"],
    [{ ok: false, status: 503 }, "provider_unavailable"],
    [
      {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "" }, finish_reason: "stop" }],
        }),
      },
      "invalid_response",
    ],
    [
      {
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: "partial" }, finish_reason: "length" },
          ],
        }),
      },
      "invalid_response",
    ],
  ]) {
    const fallback = await make(async () => response).route(body);
    assert.equal(fallback.ai.status, "fallback");
    assert.equal(fallback.ai.reason, reason);
    assert(!fallback.ai_generated);
    assert.deepEqual(fallback.days, route.days);
  }
  const timeout = await make(async () => {
    throw new DOMException("timeout", "TimeoutError");
  }).chat({ message: "hello", language: "en" });
  assert.equal(timeout.ai.reason, "timeout");
  assert(timeout.reply.includes("rule-based"));
  const disabled = createLocalAi({
    env: {},
    log: false,
    fetchImpl: () => {
      throw Error("must not call");
    },
  });
  assert(!disabled.enabled);
  assert.equal((await disabled.route(body)).ai.reason, "not_configured");
  await assert.rejects(
    good.route({ ...body, ids: [99999999] }),
    (e) => e.status === 400,
  );
  await assert.rejects(
    good.route({ ...body, selected: { ...body.selected, activities: [1] } }),
    (e) => e.status === 400,
  );
  await assert.rejects(
    good.route({ ...body, prefs: { ...prefs, return_date: "2026-10-20" } }),
    (e) => e.status === 400,
  );
  console.log(
    "PASS local AI: grounded server-selected context, language/history, actual model and usage, no key in results; 401/402/429/503, empty/truncated/timeout/no-key fallbacks; selection/date validation; retained rule itinerary.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
