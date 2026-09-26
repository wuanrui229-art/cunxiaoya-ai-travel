// Shared by the browser preview and the authenticated server. No network calls.
const cnNumbers = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};
const count = (value) => Number(value) || cnNumbers[value];
export function parseTripInput(text, cities, cityAliases = {}) {
  const value = String(text || "");
  const out = {};
  const aliases = {
    珠海: "zhuhai",
    杭州: "hangzhou",
    成都: "chengdu",
    桂林: "guilin",
    婺源: "wuyuan",
  };
  const found = cities.filter(
    (city) =>
      value.includes(city) ||
      (cityAliases[city] &&
        value
          .toLowerCase()
          .replace(/\s/g, "")
          .includes(cityAliases[city].toLowerCase().replace(/\s/g, ""))) ||
      new RegExp(`\\b${aliases[city] || city}\\b`, "i").test(value),
  );
  if (found.length) out.selected_cities = found;
  const days =
    value.match(/([1-7一二两三四五六七])\s*(?:天|日游)/) ||
    value.match(/\b([1-7])[- ]days?\b/i);
  if (days) out.duration = count(days[1]);
  const party =
    value.match(/([1-9一二两三四五六七八九十])\s*(?:个?人|位)/) ||
    value.match(/\b([1-9])\s*(?:people|travelers|guests)\b/i);
  if (party) out.travelers_count = count(party[1]);
  if (/一个人|独自|solo|alone/i.test(value)) {
    out.travelers_count = 1;
    out.travel_relation = "一个人走走";
  } else if (/孩子|亲子|family|child|kids/i.test(value))
    out.travel_relation = "亲子家庭";
  else if (/情侣|couple/i.test(value)) out.travel_relation = "情侣出游";
  const budget = value.match(
    /(?:人均|预算|budget)[^\d]{0,12}(\d{1,6})(?:\s*(?:元|人民币|cny|rmb))?/i,
  );
  if (budget && Number(budget[1]) > 0)
    out.budget_per_person = Number(budget[1]);
  out.activity_preferences = [
    [/采摘|田野|\bfarm\b|fields?|picking/i, "田园漫步"],
    [/茶|\btea\b/i, "茶田寻香"],
    [/海岛|海风|island|\bsea\b|coast/i, "海岛放空"],
    [/手作|陶|craft|pottery/i, "非遗手作"],
  ]
    .filter(([re]) => re.test(value))
    .map(([, tag]) => tag);
  return out;
}
export function buildSchedule(p, ids, selected, details) {
  const total =
    Math.round(
      (new Date(p.return_date + "T12:00:00Z") -
        new Date(p.departure_date + "T12:00:00Z")) /
        86400000,
    ) + 1;
  if (!Number.isInteger(total) || total < 1 || total > 7)
    throw Error("请设置1—7天的有效旅行日期。");
  const villages = details.filter((v) => ids.includes(v.id));
  if (new Set(villages.map((v) => v.city)).size > 1)
    throw Error("短途行程请先选择同一城市的乡村，跨城交通需另行规划。");
  const days = Array.from({ length: total }, (_, i) => ({
      day: i + 1,
      items: [],
    })),
    pending = [];
  const categories = {
    activities: "activity",
    dining: "meal",
    accommodation: "stay",
  };
  for (const [vi, v] of villages.entries()) {
    const available = days.filter((_, i) => i % villages.length === vi);
    const groups = {};
    for (const key of Object.keys(categories))
      groups[key] = (v[key] || [])
        .filter((a) => selected[key].includes(a.id))
        .map((a) => ({
          id: a.id,
          kind: categories[key],
          name: a.name,
          villageId: v.id,
          village: v.name || v.village_name,
          note: a.description || "",
          price: a.avg_price || a.price_per_night || null,
          evening: /晚会|夜|日落|bonfire|night|sunset/i.test(a.name),
        }));
    for (const item of groups.activities) {
      const day = available.find(
        (d) => d.items.filter((a) => a.kind === "activity").length < 3,
      );
      if (day) day.items.push(item);
      else pending.push({ ...item, reason: "当天安排已满，保留为候选。" });
    }
    for (const item of groups.dining) {
      const day = available.find(
        (d) => d.items.filter((a) => a.kind === "meal").length < 2,
      );
      if (day)
        day.items.push({
          ...item,
          slot: day.items.some((a) => a.kind === "meal") ? "晚餐" : "午餐",
        });
      else pending.push({ ...item, reason: "餐次已满，保留为候选。" });
    }
    for (const item of groups.accommodation) {
      const day = available.find(
        (d) => d.day < total && !d.items.some((a) => a.kind === "stay"),
      );
      if (day) day.items.push(item);
      else
        pending.push({ ...item, reason: "没有可安排的住宿夜晚，保留为候选。" });
    }
  }
  for (const [i, v] of villages.entries())
    if (v.source_kind === "public" && i >= total)
      pending.push({
        kind: "rest",
        name: v.name || v.village_name,
        village: v.name || v.village_name,
        reason: "天数不足，该目的地保留为待安排。",
      });
  for (const day of days) {
    const daytime = day.items.filter(
        (a) => a.kind === "activity" && !a.evening,
      ),
      evening = day.items.filter((a) => a.kind === "activity" && a.evening);
    const meals = day.items.filter((a) => a.kind === "meal"),
      stay = day.items.find((a) => a.kind === "stay");
    day.items = [];
    if (daytime.length) day.items.push({ ...daytime[0], period: "上午" });
    else if (
      villages[(day.day - 1) % villages.length]?.source_kind === "public"
    )
      day.items.push({
        kind: "rest",
        name:
          villages[(day.day - 1) % villages.length].name ||
          villages[(day.day - 1) % villages.length].village_name,
        note: "计划到访；开放情况、具体活动与交通尚待确认。",
        period: "上午",
      });
    else
      day.items.push({
        kind: "rest",
        name: "自由探索，给旅行留白",
        note: "按自己的节奏走走，具体安排出发前确认。",
        period: "上午",
      });
    day.items.push(
      meals[0]
        ? { ...meals[0], period: "午间" }
        : {
            kind: "meal",
            name: "午餐时间",
            note: "按口味选择当地餐厅，商家与价格待确认",
            period: "午间",
          },
    );
    if (/午休|休息|慢|\brest\b|slow|nap|relax/i.test(p.custom_requirements))
      day.items.push({
        kind: "rest",
        name: "留一点午休时间",
        note: "根据你的补充需求预留，不安排紧凑项目。",
        period: "午间",
      });
    day.items.push(...daytime.slice(1).map((a) => ({ ...a, period: "下午" })));
    if (meals[1]) day.items.push({ ...meals[1], period: "晚间" });
    day.items.push(...evening.map((a) => ({ ...a, period: "晚间" })));
    if (day.day < total)
      day.items.push(
        stay
          ? { ...stay, period: "夜间" }
          : {
              kind: "stay",
              name: "住宿待安排",
              note: "尚未选择住宿，请在出发前补充。",
              period: "夜间",
            },
      );
    else
      day.items.push({
        kind: "travel",
        name: "带着好心情返程",
        note: "交通方式与实际路程请提前核实。",
        period: "返程",
      });
  }
  return {
    days,
    pending,
    warnings: [
      "每日按一个乡村、最多三项活动整理；时段是建议，交通与营业情况需另行确认。",
    ],
    ai_generated: false,
    route: "",
  };
}
