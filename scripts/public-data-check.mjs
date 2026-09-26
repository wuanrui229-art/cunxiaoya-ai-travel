import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
const root = new URL("../", import.meta.url);
const { manifest, villages } = JSON.parse(
  await fs.readFile(new URL("public/public-villages.json", root), "utf8"),
);
assert.equal(villages.length, 1399);
assert.equal(new Set(villages.map((v) => v.id)).size, 1399);
assert.equal(
  new Set(villages.map((v) => v.province + "|" + v.village_name)).size,
  1399,
);
assert.deepEqual(manifest.batch_counts, { 1: 320, 2: 680, 3: 199, 4: 200 });
assert.equal(
  manifest.source_sha256,
  crypto
    .createHash("sha256")
    .update(await fs.readFile(new URL("data/sources/mct-rural.html", root)))
    .digest("hex"),
);
assert(
  villages.every(
    (v) =>
      v.id > 1000000 &&
      v.source_kind === "public" &&
      v.latitude === null &&
      v.longitude === null &&
      v.source_as_of === "2022-12-07" &&
      v.source_url === manifest.source_url,
  ),
);
const source = (
  await fs.readFile(new URL("public/data.js", root), "utf8")
).replace(
  '"./planner.mjs"',
  JSON.stringify(new URL("public/planner.mjs", root).href),
);
const { service, defaults } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
service.demo = true;
service.db = JSON.parse(
  await fs.readFile(new URL("public/demo-data.json", root), "utf8"),
);
service.db.villages.push(...villages);
assert.equal((await service.villages()).length, 1408);
const publicVillage = villages.find((v) => v.city === "苏州");
assert(publicVillage);
const detail = await service.detail(publicVillage.id);
assert.deepEqual(detail.activities, []);
assert.deepEqual(detail.dining, []);
assert.deepEqual(detail.accommodation, []);
const rec = await service.recommend({
  ...defaults(),
  selected_cities: ["苏州"],
});
assert(rec.villages.length > 0);
assert(rec.villages.every((v) => v.city === "苏州"));
const route = await service.generate(
  defaults(),
  [detail.id],
  { activities: [], dining: [], accommodation: [] },
  [detail],
  rec.token,
);
assert(route.catalogue_only);
assert(!route.ai_generated);
assert(route.days[0].items.some((i) => i.name === detail.name));
assert.equal(route.sources[0].url, manifest.source_url);
assert(
  route.days.flatMap((d) => d.items).every((i) => !i.price),
  "Do not invent prices",
);
assert.equal(
  (await service.detail(7)).source_kind,
  "sample",
  "Sample resources are not promoted to public records",
);
console.log(
  "PASS public import: source checksum; 1,399 unique records; batch totals; missing coordinates preserved; 1,408 combined records; regional recommendations; no invented amenities/prices; provenance-bearing visit draft.",
);
