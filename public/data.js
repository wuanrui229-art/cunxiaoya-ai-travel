import { buildSchedule } from "./planner.mjs";
export const readStore = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem("cxya-v2-" + key)) ?? fallback;
  } catch {
    return fallback;
  }
};
export const writeStore = (key, value) => {
  try {
    localStorage.setItem("cxya-v2-" + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
export async function request(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(90000),
  });
  const json = await res.json();
  if (!res.ok || !json.success)
    throw new Error(json.message || "服务暂时不可用，请稍后重试");
  return json.data;
}
const metadata = {
  1: {
    name: "青杠树村",
    tags: ["田园漫步", "亲子时光"],
    photo: "hero",
    note: "把周末交给田野和林盘",
  },
  2: {
    name: "道明竹艺村",
    tags: ["非遗手作", "慢享生活"],
    photo: "village",
    note: "在一编一织里，找回专注",
  },
  3: {
    name: "明月村",
    tags: ["非遗手作", "茶田寻香"],
    photo: "tea",
    note: "捏一件陶器，喝一盏新茶",
  },
  4: {
    name: "径山村",
    tags: ["茶田寻香", "田园漫步"],
    photo: "tea",
    note: "沿着古道，走进一山茶香",
  },
  5: {
    name: "遇龙河村",
    tags: ["田园漫步", "亲子时光"],
    photo: "hero",
    note: "在山水之间，留一段空白",
  },
  6: {
    name: "篁岭村",
    tags: ["古村寻味", "自然摄影"],
    photo: "village",
    note: "顺着青石巷，遇见徽州日常",
  },
  7: {
    name: "石龙村",
    tags: ["亲子时光", "田园漫步"],
    photo: "hero",
    note: "骑过花田，尝一口岭南",
  },
  8: {
    name: "三板村",
    tags: ["亲子时光", "慢享生活"],
    photo: "tea",
    note: "水乡里的一个悠长午后",
  },
  9: {
    name: "桂山村",
    tags: ["海岛放空", "自然摄影"],
    photo: "coast",
    note: "等一场海风，看渔舟归航",
  },
};
export const themes = [
  ["全部乡村", "compass"],
  ["田园漫步", "leaf"],
  ["亲子时光", "sun"],
  ["非遗手作", "hand"],
  ["茶田寻香", "cup"],
  ["古村寻味", "home"],
  ["海岛放空", "waves"],
];
export function enrich(v) {
  const m = metadata[v.id];
  // Curated labels are scoped to the bundled dataset only (id AND name).
  const known = m && v.village_name.includes(m.name);
  return {
    ...v,
    name: known ? m.name : v.village_name,
    tags: known ? m.tags : [],
    source_kind: v.source_kind || "sample",
    photo: known ? m.photo : "hero",
    note: known ? m.note : v.description || "发现乡村里的日常",
  };
}
export const localDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const numDays = (p) =>
  Math.round(
    (new Date(p.return_date + "T12:00:00") -
      new Date(p.departure_date + "T12:00:00")) /
      86400000,
  ) + 1;
export const defaults = () => ({
  selected_cities: ["珠海"],
  departure_city: "",
  departure_date: localDate(1),
  return_date: localDate(2),
  travel_mode: "自驾",
  travelers_count: 2,
  travel_relation: "朋友结伴",
  budget_per_person: 800,
  activity_preferences: [],
  dining_requirements: "",
  accommodation_type: "特色民宿",
  custom_requirements: "",
});
export const service = {
  demo: false,
  db: null,
  aiEnabled: false,
  async init() {
    const embedded =
      typeof document !== "undefined" &&
      document.getElementById("runtime-config");
    const config = embedded
      ? JSON.parse(embedded.textContent)
      : await request("/api/config");
    this.demo = config.demo === true;
    this.aiEnabled = config.ai_enabled === true;
    if (this.demo) {
      const r = await fetch("/demo-data.json");
      if (!r.ok) throw new Error("演示资料加载失败");
      this.db = await r.json();
      const catalogue = await fetch("/public-villages.json");
      if (!catalogue.ok) throw new Error("公开名录加载失败，请刷新重试。");
      const imported = await catalogue.json();
      this.catalogue = imported.manifest;
      this.db.villages = [...this.db.villages, ...imported.villages];
    }
  },
  async villages() {
    return (this.demo ? this.db.villages : await request("/api/villages")).map(
      enrich,
    );
  },
  async detail(id) {
    if (!this.demo) return enrich(await request("/api/villages/" + id));
    const v = this.db.villages.find((v) => v.id === Number(id));
    if (!v) throw new Error("没有找到这个乡村");
    return enrich({
      ...v,
      ...Object.fromEntries(
        ["activities", "dining", "accommodation"].map((k) => [
          k,
          this.db[k].filter((a) => a.village_id === v.id),
        ]),
      ),
    });
  },
  async recommend(p, user) {
    if (!this.demo) {
      const s = await request("/api/sessions", "POST", {
        ...p,
        accommodation_type:
          p.accommodation_type === "不限" ? null : p.accommodation_type,
        user_id: user?.id || null,
      });
      const result = await request(
        `/api/sessions/${s.session_token}/recommend-villages`,
        "POST",
        { cities: p.selected_cities },
      );
      return {
        ...result,
        token: s.session_token,
        villages: result.villages.map(enrich),
      };
    }
    const villages = (await this.villages())
      .filter((v) => p.selected_cities.includes(v.city))
      .map((v) => ({
        ...v,
        matched_tags: v.tags.filter((t) => p.activity_preferences.includes(t)),
      }))
      .sort((a, b) => b.matched_tags.length - a.matched_tags.length);
    return { villages, token: "demo-" + Date.now(), ai_generated: false };
  },
  async generate(p, ids, selected, details, token, language = "zh") {
    if (!this.demo) {
      await request(`/api/sessions/${token}`, "PUT", {
        selected_villages: ids,
        selected_activities: selected.activities,
        restaurant_selection: selected.dining,
        accommodation_selection: selected.accommodation,
        status: "activities_selected",
      });
      return request(`/api/sessions/${token}/generate-route`, "POST", {
        language,
      });
    }
    const fallback = {
      ...buildSchedule(p, ids, selected, details),
      demo: true,
      catalogue_only: details.every((v) => v.source_kind === "public"),
      sources: details
        .filter((v) => v.source_kind === "public")
        .map((v) => ({
          name: v.village_name,
          url: v.source_url,
          as_of: v.source_as_of,
        })),
    };
    if (!this.aiEnabled) return fallback;
    try {
      return await request("/api/local-ai/generate", "POST", {
        prefs: p,
        ids,
        selected,
        language,
      });
    } catch {
      return { ...fallback, ai: { status: "fallback", reason: "connection" } };
    }
  },
};
