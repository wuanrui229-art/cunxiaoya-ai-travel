// Pure-data checks for demo itinerary integrity. Does not need MySQL or an API key.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const source = await fs.readFile(
  new URL("../public/data.js", import.meta.url),
  "utf8",
);
const { service, defaults } = await import(
  "data:text/javascript;base64," +
    Buffer.from(
      source.replace(
        '"./planner.mjs"',
        JSON.stringify(new URL("../public/planner.mjs", import.meta.url).href),
      ),
    ).toString("base64")
);
service.demo = true;
service.db = JSON.parse(
  await fs.readFile(
    new URL("../public/demo-data.json", import.meta.url),
    "utf8",
  ),
);
assert.equal((await service.villages()).length, 9);
const p = {
  ...defaults(),
  selected_cities: ["珠海"],
  activity_preferences: ["亲子时光"],
  custom_requirements: "每天午休",
};
const rec = await service.recommend(p, null);
assert.equal(rec.villages.length, 3);
assert(rec.villages.every((v) => v.city === "珠海"));
const details = await Promise.all([7, 8].map((id) => service.detail(id)));
const activities = details.flatMap((v) => v.activities.map((a) => a.id));
const dining = [details[0].dining[0].id];
const accommodation = [details[0].accommodation[0].id];
const result = await service.generate(
  p,
  [7, 8],
  { activities, dining, accommodation },
  details,
  rec.token,
);
assert.equal(result.days.length, 2);
const selectedNames = details.flatMap((v) => v.activities.map((a) => a.name));
const actualNames = result.days.flatMap((d) =>
  d.items.filter((i) => i.kind === "activity").map((i) => i.name),
);
assert.deepEqual(
  [
    ...actualNames,
    ...result.pending.filter((i) => i.kind === "activity").map((i) => i.name),
  ].sort(),
  selectedNames.sort(),
  "Every selected activity must be scheduled or explicitly pending",
);
assert(
  result.days.every((d) => d.items.some((i) => i.kind === "rest")),
  "Requested midday rest retained",
);
assert(result.days[0].items.some((i) => i.name === details[0].dining[0].name));
assert(
  result.days[0].items.some((i) => i.name === details[0].accommodation[0].name),
);
assert.equal(result.ai_generated, false);
assert.equal(result.demo, true);
const empty = await service.recommend(
  { ...p, selected_cities: ["未覆盖城市"] },
  null,
);
assert.equal(empty.villages.length, 0);
console.log(
  "PASS: 9 villages; city filter; empty results; two-day multi-village route; all selections retained; meal/stay/rest; explicit demo status.",
);
const { parseTripInput, buildSchedule } = await import("../public/planner.mjs");
assert.deepEqual(
  parseTripInput("杭州三天，一个人，预算500，想喝茶", ["杭州", "珠海"]),
  {
    selected_cities: ["杭州"],
    duration: 3,
    travelers_count: 1,
    travel_relation: "一个人走走",
    budget_per_person: 500,
    activity_preferences: ["茶田寻香"],
  },
);
assert.equal(
  parseTripInput("Hangzhou for 3 days, solo, budget CNY 500", ["杭州"])
    .duration,
  3,
);
const overloaded = {
  id: 99,
  name: "测试村",
  city: "杭州",
  activities: Array.from({ length: 6 }, (_, i) => ({
    id: i + 100,
    name: i === 0 ? "夜间晚会" : "采摘" + i,
  })),
  dining: [
    { id: 201, name: "午餐" },
    { id: 202, name: "晚餐" },
    { id: 203, name: "第三家餐厅" },
  ],
  accommodation: [{ id: 301, name: "民宿" }],
};
const one = buildSchedule(
  { ...p, return_date: p.departure_date },
  [99],
  {
    activities: overloaded.activities.map((a) => a.id),
    dining: [201, 202, 203],
    accommodation: [301],
  },
  [overloaded],
);
assert.equal(one.days[0].items.filter((i) => i.kind === "activity").length, 3);
assert.equal(
  one.pending.length,
  5,
  "All excess activities, meals and stays remain visible",
);
assert(
  one.days[0].items.findIndex((i) => i.id === 201) <
    one.days[0].items.findIndex((i) => i.id === 100),
  "Lunch precedes the evening event",
);
assert.throws(
  () =>
    buildSchedule(
      p,
      [99, 98],
      { activities: [], dining: [], accommodation: [] },
      [overloaded, { ...overloaded, id: 98, city: "珠海" }],
    ),
  /同一城市/,
);
console.log(
  "PASS input parsing: Chinese/English duration, city, solo, budget; capacity, evening order and pending items; intercity boundary.",
);
