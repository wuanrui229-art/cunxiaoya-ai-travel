import { initMap, focusMap } from "./map.js";
import { parseTripInput } from "./planner.mjs";
import { initLocale, applyLocale, translateText, getLocale } from "./i18n.js";
import {
  service,
  request,
  readStore,
  writeStore,
  defaults,
  themes,
  numDays,
  localDate,
} from "./data.js";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const e = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function readableRoute(text) {
  return e(text)
    .split(/\n/)
    .map((line) => {
      const formatted = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (/^(#{1,4}\s|▌)/.test(line))
        return "<h3>" + formatted.replace(/^(#{1,4}\s*|▌)/, "") + "</h3>";
      if (/^[-*]\s/.test(line))
        return '<p class="route-list-item">' + formatted.slice(2) + "</p>";
      return line.trim() ? "<p>" + formatted + "</p>" : "";
    })
    .join("");
}
const paths = {
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6-6-6 6 6 6",
  chevron: "m9 5 7 7-7 7",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1116 0ZM15 10a3 3 0 11-6 0 3 3 0 016 0",
  heart:
    "M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8Z",
  leaf: "M20 3C7 2 2 7 4 14s13 10 16-11ZM5 20l9-10",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5",
  hand: "M8 13V6a2 2 0 014 0v6-8a2 2 0 014 0v9-5a2 2 0 014 0v8c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a2 2 0 013-2l2 2",
  cup: "M3 4h13v9a6.5 6.5 0 01-13 0V4Zm13 1h2a4 4 0 010 8h-2M2 22h18",
  home: "m3 10 9-7 9 7v11h-7v-7h-4v7H3V10",
  waves: "M2 6q3-4 6 0t6 0 8 0M2 12q3-4 6 0t6 0 8 0M2 18q3-4 6 0t6 0 8 0",
  compass: "M22 12a10 10 0 11-20 0 10 10 0 0120 0Zm-6-4-3 5-5 3 3-5 5-3Z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0ZM4 22v-3a8 8 0 0116 0v3",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  calendar: "M5 5h14a2 2 0 012 2v13H3V7a2 2 0 012-2ZM7 2v6m10-6v6M3 11h18",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  search: "M17 10a7 7 0 11-14 0 7 7 0 0114 0Zm-2 5 6 6",
  book: "M12 5v16M12 5C9 2 4 2 2 3v16c3-1 7-1 10 2 3-3 7-3 10-2V3c-2-1-7-1-10 2Z",
  clock: "M22 12a10 10 0 11-20 0 10 10 0 0120 0ZM12 6v6l4 2",
  shield: "m12 2 9 4v6c0 5-5 9-9 11-4-2-9-6-9-11V6l9-4Zm-4 10 3 3 5-6",
  chat: "M21 11a9 9 0 01-9 9H3l1.5-5A9 9 0 1121 11Z",
  star: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z",
  plus: "M12 5v14M5 12h14",
  bed: "M3 18V4m0 8h18v10M3 18h18M7 12V7h10v5",
  food: "M4 2v7a3 3 0 006 0V2M7 2v20M20 2c-5 3-5 10 0 10V2Zm0 10v10",
  download: "M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5",
};
const icon = (n, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[n] || paths.leaf}"/></svg>`;
const img = (v) => `/assets/${v.photo || "hero"}.jpg`;
const state = {
  villages: [],
  prefs: defaults(),
  selected: [],
  choices: { activities: [], dining: [], accommodation: [] },
  details: [],
  recommendations: [],
  token: null,
  result: null,
  user: null,
  theme: "全部乡村",
  city: "全部城市",
  search: "",
  province: "全部地区",
  dataSource: "public",
  visibleCount: 24,
  tab: "activities",
  savedTab: "trips",
  busy: false,
  chatMessages: [],
};
let renderId = 0,
  toastTimer,
  lastFocus;
const storageKey = (k) =>
  (service.demo ? "demo-" : "live-") + (state.user?.id || "guest") + "-" + k;
const saved = () => readStore(storageKey("saved"), []);
const favorites = () => readStore(storageKey("favorites"), []);
function persistDraft() {
  try {
    sessionStorage.setItem(
      "cxya-draft-" + service.demo,
      JSON.stringify({
        prefs: state.prefs,
        selected: state.selected,
        choices: state.choices,
        details: state.details,
        recommendations: state.recommendations,
        token: state.token,
        result: state.result,
      }),
    );
  } catch {
    toast("浏览器暂时无法保存草稿，请勿刷新页面");
  }
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3600);
}
function go(route) {
  if (location.hash === "#" + route) render();
  else location.hash = route;
}
function button(label, action, extra = "", style = "primary") {
  return `<button class="button ${style}" data-action="${action}" ${extra}>${label}</button>`;
}
const tags = (v) =>
  v.tags.map((t) => `<span class="tag">${e(t)}</span>`).join("");
const blank = (title, note, action = "plan", label = "规划一次旅行") =>
  `<div class="empty-state">${icon("compass")}<h2>${title}</h2><p>${note}</p>${button(label, action)}</div>`;
function cityList() {
  return [...new Set(state.villages.map((v) => v.city))];
}
function cityChoices(current) {
  return `<label class="city-search-label">搜索目的地<input type="search" data-city-search placeholder="输入城市、省份或拼音"></label><div class="city-options">${checks("cities", cityList(), current)}</div><p class="muted">部分条目按省级地区归类；具体行政区以名录原文为准。</p>`;
}
function provenance(v) {
  return v.source_kind === "public"
    ? `<div class="provenance"><strong>公开名录 · 第 ${v.batch} 批</strong><p>文旅部全国乡村旅游重点村</p><p>名录截至 ${e(v.source_as_of)} · 导入 ${e(v.retrieved_at)}</p><a href="${e(v.source_url)}" target="_blank" rel="noopener noreferrer">查看官方来源 ${icon("arrow")}</a><p>名称按来源保留，英文地名为拼音辅助。配套与坐标待补充。</p></div>`
    : `<p class="source-badge">样例资料 · 配套未经核实</p>`;
}
function card(v, select = false) {
  const checked = state.selected.includes(v.id);
  const fav = favorites().includes(v.id);
  if (v.source_kind === "public")
    return `<article class="village-card registry-card ${checked && select ? "is-selected" : ""}"><div class="registry-heading"><span class="source-badge">公开名录 · 第 ${v.batch} 批</span><button class="favorite icon-button ${fav ? "is-favorite" : ""}" data-action="favorite" data-id="${v.id}" aria-label="${fav ? "取消收藏" : "收藏"}${e(v.name)}" aria-pressed="${fav}">${icon("heart")}</button></div><div class="card-meta">${icon("pin")}${e(v.province)} · ${e(v.city)}</div><a class="card-title" href="#village/${v.id}">${e(v.name)}${icon("arrow")}</a><p>名录已收录 · 吃住玩与坐标待补充</p>${select ? `<p class="match-reason">按所选地区匹配，兴趣适配尚待核实。</p><button class="select-village ${checked ? "selected" : ""}" data-action="select-village" data-id="${v.id}" aria-pressed="${checked}">${icon(checked ? "check" : "plus")}${checked ? "已加入行程" : "加入这次旅行"}</button>` : ""}</article>`;

  return `<article class="village-card ${checked && select ? "is-selected" : ""}"><div class="village-image"><a href="#village/${v.id}" aria-label="查看${e(v.name)}"><img src="${img(v)}" alt="${e(v.tags[0] || "乡村")}氛围示意" loading="lazy" width="600" height="450"></a><span class="image-caption">氛围示意</span><button class="favorite icon-button ${fav ? "is-favorite" : ""}" data-action="favorite" data-id="${v.id}" aria-label="${fav ? "取消收藏" : "收藏"}${e(v.name)}" aria-pressed="${fav}">${icon("heart")}</button></div><p class="source-badge">样例资料 · 配套未经核实</p><div class="card-meta">${icon("pin")}${e(v.city)}<span>乡村慢旅行</span></div><a class="card-title" href="#village/${v.id}">${e(v.name)}${icon("arrow")}</a><p>${e(v.note)}</p><div class="tags">${tags(v)}</div>${select ? `<p class="match-reason">${icon("check")}${(v.matched_tags || []).length ? "匹配偏好：" + e(v.matched_tags.map((t) => (typeof t === "string" ? t : t.tag)).join("、")) : "位于你选择的城市，更多条件待确认"}</p><button class="select-village ${checked ? "selected" : ""}" data-action="select-village" data-id="${v.id}" aria-pressed="${checked}">${icon(checked ? "check" : "plus")}${checked ? "已加入行程" : "加入这次旅行"}</button>` : ""}</article>`;
}
let tripEditorTrigger;
function syncTripToolbar() {
  const p = state.prefs;
  const values = {
    where: p.selected_cities.join(" · ") || "未选择",
    when: `${p.departure_date.slice(5)} — ${p.return_date.slice(5)}`,
    who: `${p.travelers_count} 人`,
    budget: `¥${p.budget_per_person}`,
  };
  for (const [key, value] of Object.entries(values))
    $(`[data-trip-value="${key}"]`).textContent = value;
}
function syncSidebar() {
  const collapsed =
    document.documentElement.classList.contains("sidebar-collapsed");
  const b = $("#sidebar-toggle");
  b.setAttribute("aria-expanded", String(!collapsed));
  b.setAttribute("aria-label", collapsed ? "展开侧栏" : "收起侧栏");
  b.title = collapsed ? "展开侧栏" : "收起侧栏";
}
function closeTripEditor(restore = true) {
  $("#trip-editor").hidden = true;
  $$("[data-action=edit-trip]").forEach((b) =>
    b.setAttribute("aria-expanded", "false"),
  );
  if (restore) tripEditorTrigger?.focus();
}
function openTripEditor(b) {
  if (!$("#trip-editor").hidden && tripEditorTrigger === b) {
    closeTripEditor();
    return;
  }
  tripEditorTrigger = b;
  const key = b.dataset.field,
    p = state.prefs;
  const titles = {
    where: "选择目的地",
    when: "设置旅行日期",
    who: "设置同行人",
    budget: "设置旅行预算",
  };
  let fields;
  if (key === "where")
    fields = `<fieldset><legend>想去的城市</legend>${cityChoices(p.selected_cities)}</fieldset>`;
  if (key === "when")
    fields = `<label>出发日期<input type="date" name="departure_date" required min="${localDate()}" value="${e(p.departure_date)}"></label><label>返程日期<input type="date" name="return_date" required min="${e(p.departure_date)}" value="${e(p.return_date)}"></label>`;
  if (key === "who")
    fields = `<label>同行人数<input type="number" name="travelers_count" min="1" max="50" required value="${e(p.travelers_count)}"></label><label>和谁一起<select name="travel_relation">${options(["朋友结伴", "亲子家庭", "情侣出游", "一个人走走", "企业团建"], p.travel_relation)}</select></label>`;
  if (key === "budget")
    fields = `<label>人均全程预算（元）<input type="number" name="budget_per_person" min="1" max="100000" required value="${e(p.budget_per_person)}"></label><p class="muted">这是你设置的预算，不是报价或已核算费用。</p>`;
  $("#trip-editor").innerHTML =
    `<h2 id="trip-editor-title">${titles[key]}</h2><form id="trip-quick-edit" data-field="${key}">${fields}<p id="trip-editor-error" class="form-error" role="alert"></p><div class="trip-editor-actions"><button type="button" class="button secondary" data-action="close-trip-editor">取消</button><button type="submit" class="button primary">保存设置</button></div></form>`;
  $("#trip-editor").hidden = false;
  $$("[data-action=edit-trip]").forEach((node) =>
    node.setAttribute("aria-expanded", String(node === b)),
  );
  $("input,select", $("#trip-editor"))?.focus();
}
function home() {
  const ideas = [
    [
      "亲子田园周末",
      "带孩子去珠海玩两天，想体验采摘，每天留出午休时间。",
      "珠海",
      "亲子时光",
      "sun",
    ],
    [
      "茶山里的慢时光",
      "去杭州玩两天，想喝茶、散步，行程慢一点。",
      "杭州",
      "茶田寻香",
      "cup",
    ],
    [
      "海风和渔村日落",
      "想去珠海的海岛，看看渔村，尝尝海鲜。",
      "珠海",
      "海岛放空",
      "waves",
    ],
  ];
  return `<section class="conversation-home"><div class="welcome"><div class="welcome-mark">${icon("leaf")}</div><h1>今天，想去哪里？</h1><p>我是小丫，你的乡村旅行伙伴。<br>聊聊想去的地方，一起安排下一次出发。</p><div class="prompt-ideas">${ideas.map(([title, wish, city, theme, i]) => `<button data-action="prompt-idea" data-wish="${wish}" data-city="${city}" data-theme="${theme}">${icon(i)}${title}</button>`).join("")}</div><a class="welcome-explore" href="#discover">还没想好？先发现一些乡村 ${icon("arrow")}</a></div>
 <div class="composer-dock"><form id="quick-plan" class="quick-plan"><label class="sr-only" for="quick-wish">告诉小丫你的旅行想法</label><textarea id="quick-wish" name="wish" rows="2" required maxlength="500" placeholder="告诉小丫，想去哪里、和谁出发…"></textarea><div class="composer-bottom"><div class="composer-fields"><label>${icon("pin")}<input id="quick-city" name="city" data-localized-place list="destination-options" value="${e(translateText(state.prefs.selected_cities[0] || "珠海"))}" aria-label="目的地城市" autocomplete="off"><datalist id="destination-options">${cityList()
   .map(
     (c) =>
       `<option data-place-name="${e(c)}" value="${e(translateText(c))}"></option>`,
   )
   .join(
     "",
   )}</datalist></label><label class="duration-field">${icon("calendar")}<select id="quick-duration" name="duration" aria-label="旅行天数">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${numDays(state.prefs) === n ? "selected" : ""}>${n === 1 ? "当天往返" : n + " 天 " + (n - 1) + " 夜"}</option>`).join("")}</select><span class="select-chevron" aria-hidden="true">${icon("chevron")}</span></label></div><button class="send-trip" type="submit" aria-label="发送旅行想法">${icon("arrow")}</button></div></form><p class="composer-note">先整理你的想法，再确认需求与推荐。</p></div></section>`;
}
function discover() {
  let list = state.villages.filter(
    (v) =>
      (state.dataSource === "all" || v.source_kind === state.dataSource) &&
      (state.province === "全部地区" || v.province === state.province) &&
      (state.city === "全部城市" || v.city === state.city) &&
      (state.theme === "全部乡村" || v.tags.includes(state.theme)) &&
      (!state.search ||
        [
          v.name,
          v.city,
          v.description,
          v.province || "",
          v.name_en || "",
          (v.name_en || "").replace(/ /g, ""),
          ...v.tags,
          translateText(
            [v.name, v.city, v.description, ...v.tags].join(" "),
            "en",
          ),
        ]
          .join(" ")
          .toLowerCase()
          .includes(state.search.toLowerCase())),
  );
  return `<section class="page-shell"><div class="page-heading"><h1>下一站，想去哪里？</h1><p>山野、茶田、古村与海风，找到合你心意的乡村。</p></div><form class="discover-search" id="discover-search">${icon("search")}<input name="query" aria-label="搜索乡村或城市" placeholder="搜索乡村、城市或体验" value="${e(state.search)}"><button class="button primary">搜索</button></form><div class="catalogue-filters"><label>资料类型<select id="filter-source">${[
    ["public", "公开名录"],
    ["sample", "样例体验"],
    ["all", "全部资料"],
  ]
    .map(
      ([value, label]) =>
        `<option value="${value}" ${value === state.dataSource ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></label><label>所属地区<select id="filter-province">${["全部地区", ...new Set(state.villages.filter((v) => v.province).map((v) => v.province))].map((p) => `<option value="${e(p)}" ${p === state.province ? "selected" : ""}>${e(p)}</option>`).join("")}</select></label></div><p class="catalogue-note">公开名录仅确认名称与地区，不代表营业、交通或体验已核实。</p><div class="filter-row"><div class="theme-row" ${state.dataSource === "public" ? "hidden" : ""}>${themes.map(([t, i]) => `<button class="${state.theme === t ? "active" : ""}" data-action="filter-theme" data-theme="${t}" aria-pressed="${state.theme === t}">${icon(i)}${t}</button>`).join("")}</div><select aria-label="筛选城市" id="filter-city">${["全部城市", ...[...new Set(state.villages.map((v) => v.city))]].map((c) => `<option ${state.city === c ? "selected" : ""}>${e(c)}</option>`).join("")}</select></div><div class="results-meta"><span>找到 ${list.length} 个乡村</span><span>按体验探索 · 配套信息出发前确认</span></div><div class="village-grid">${list
    .slice(0, state.visibleCount)
    .map((v) => card(v))
    .join(
      "",
    )}</div>${list.length > state.visibleCount ? button("加载更多乡村", "load-more", "", "secondary") : ""}${!list.length ? blank("暂时没有符合条件的乡村", "试试其他城市，或放宽筛选条件。", "clear-filters", "清除筛选") : ""}</section>`;
}
function steps(n) {
  return `<ol class="steps" aria-label="旅行规划进度">${["出游需求", "挑选乡村", "选择体验", "生成行程"].map((t, i) => `<li class="${i === n ? "current" : i < n ? "complete" : ""}" ${i === n ? 'aria-current="step"' : ""}><span>${i < n ? icon("check") : i + 1}</span>${t}</li>`).join("")}</ol>`;
}
function summary() {
  const p = state.prefs;
  return `<aside class="plan-summary"><div class="summary-heading">${icon("book")} 这次旅行</div><h3>${e(p.selected_cities.join(" · "))}，慢慢玩</h3><dl><div><dt>旅行日期</dt><dd>${e(p.departure_date.slice(5))} — ${e(p.return_date.slice(5))}</dd></div><div><dt>同行伙伴</dt><dd>${e(p.travelers_count)} 人 · ${e(p.travel_relation)}</dd></div><div><dt>出行方式</dt><dd>${e(p.travel_mode)}</dd></div><div><dt>预算上限</dt><dd>¥${e(p.budget_per_person)} / 人</dd></div></dl><div class="tags">${p.activity_preferences.map((t) => `<span class="tag">${e(t)}</span>`).join("")}</div>${state.selected.length ? `<div class="summary-villages"><h4>想去的乡村</h4>${state.selected.map((id) => `<p>${icon("pin")}${e(state.villages.find((v) => v.id === id)?.name || "乡村")}</p>`).join("")}</div>` : ""}<p class="summary-note">${icon("leaf")} 不必填满每一分钟，<br>让好风景有机会发生。</p></aside>`;
}
function checks(name, values, current) {
  return `<div class="choice-row">${values.map((v) => `<label class="choice"><input type="checkbox" name="${name}" value="${e(v)}" ${current.includes(v) ? "checked" : ""}><span>${e(v)}</span></label>`).join("")}</div>`;
}
function options(values, current) {
  return values
    .map((v) => `<option ${v === current ? "selected" : ""}>${e(v)}</option>`)
    .join("");
}
function plan() {
  const p = state.prefs;
  return `<section class="page-shell planner-shell">${p.custom_requirements ? `<div class="request-bubble" translate="no">${e(p.custom_requirements)}</div>` : ""}${steps(0)}<div class="page-heading"><h1>想怎么过，说给小丫听。</h1><p>先确认城市、天数与预算，识别到的需求都可以修改。</p></div><div class="planner-layout"><form id="plan-form" class="plan-form"><section class="form-section"><h2>${icon("compass")} 先定一个大方向</h2><fieldset><legend>想去的城市 <span class="required">必选</span></legend>${cityChoices(p.selected_cities)}</fieldset><div class="form-grid"><label>出发城市<input name="departure_city" placeholder="例如：广州" value="${e(p.departure_city)}" maxlength="60"></label><label>怎么去<select name="travel_mode">${options(["自驾", "公共交通", "包车"], p.travel_mode)}</select></label><label>出发日期<input type="date" required name="departure_date" min="${localDate()}" value="${e(p.departure_date)}"></label><label>返程日期<input type="date" required name="return_date" min="${e(p.departure_date)}" value="${e(p.return_date)}"></label><label>同行人数<input type="number" name="travelers_count" min="1" max="50" required value="${e(p.travelers_count)}"></label><label>和谁一起<select name="travel_relation">${options(["朋友结伴", "亲子家庭", "情侣出游", "一个人走走", "企业团建"], p.travel_relation)}</select></label></div></section><section class="form-section"><h2>${icon("leaf")} 给旅行一点你的偏好</h2><fieldset><legend>这次，想体验什么？ <span class="optional">可多选</span></legend>${checks(
    "activity_preferences",
    themes.slice(1).map((t) => t[0]),
    p.activity_preferences,
  )}</fieldset><div class="form-grid"><label>人均全程预算（元）<input type="number" name="budget_per_person" min="1" max="100000" required value="${e(p.budget_per_person)}"></label><label>住宿偏好<select name="accommodation_type">${options(["特色民宿", "农家乐", "星级酒店", "不限"], p.accommodation_type)}</select></label></div></section><section class="form-section"><h2>${icon("spark")} 还有什么小愿望？</h2><label for="custom-requirements" class="sr-only">补充旅行需求</label><textarea id="custom-requirements" name="custom_requirements" rows="4" maxlength="1000" placeholder="比如：带着 6 岁的小朋友，想体验采摘；中午留出休息时间，行程不要太赶。">${e(p.custom_requirements)}</textarea><div class="suggestions">${["每天留出午休时间", "想带宠物一起", "尽量少走路"].map((t) => `<button type="button" data-action="add-wish" data-wish="${t}">${icon("plus")}${t}</button>`).join("")}</div><details class="advanced"><summary>餐饮与其他需求</summary><label>餐饮偏好<input name="dining_requirements" value="${e(p.dining_requirements)}" maxlength="300" placeholder="如：素食、不吃辣、食物过敏"></label><p>宠物、无障碍与饮食配套需要向商家另行确认。</p></details></section><div id="form-error" role="alert" class="form-error"></div><div class="form-actions"><a href="#home" class="text-link">${icon("back")} 返回首页</a><button type="submit" class="button primary">看看适合我的乡村 ${icon("arrow")}</button></div></form><div id="summary-wrap">${summary()}</div></div></section>`;
}
function choose() {
  return `<section class="page-shell planner-shell">${steps(1)}<div class="page-heading"><h1>挑一个心动的地方。</h1><p>${service.demo ? "根据城市与兴趣匹配这些乡村。" : "根据你的出游需求，为你整理这些乡村。"}可以选择多个村庄。</p></div><div class="planner-layout"><div><div class="recommendation-intro"><span class="muse-avatar">${icon("spark")}</span><div><strong>小丫为你整理好了</strong><p>先看看这些乡村，喜欢的可以一起加入行程。</p><p class="muted">${e(state.prefs.selected_cities.join(" · "))} · ${numDays(state.prefs)} 天 · ${e(state.prefs.activity_preferences.join(" / ") || "随心探索")}</p></div></div><div class="village-grid selection-grid">${state.recommendations.map((v) => card(v, true)).join("")}</div>${state.recommendations.length ? "" : blank("这个城市还没有可选乡村", "返回调整城市，试试其他目的地。", "plan", "调整出游需求")}<p class="subtle-note">${icon("shield")} 推荐理由来自已知资料；宠物、无障碍等特殊条件仍需核实。</p><div class="form-actions sticky-actions"><a href="#plan" class="text-link">${icon("back")} 修改需求</a>${button(`已选 ${state.selected.length} 个 · 选吃住玩 ${icon("arrow")}`, "next-experiences", state.selected.length ? "" : "disabled")}</div></div>${summary()}</div></section>`;
}
function experiences() {
  const k = state.tab;
  const catalogueOnly =
    state.details.length > 0 &&
    state.details.every((v) => v.source_kind === "public");
  const data = state.details.flatMap((v) =>
    (v[k] || []).map((x) => ({ ...x, village: v.name, photo: v.photo })),
  );
  return `<section class="page-shell planner-shell">${steps(2)}<div class="page-heading"><h1>把喜欢的，放进这趟旅行。</h1><p>挑几样想体验的事，也给临时起意留点空间。</p></div><div class="planner-layout"><div><div class="tabs" role="group" aria-label="体验类型">${[
    ["activities", "hand", "体验活动"],
    ["dining", "food", "在地美食"],
    ["accommodation", "bed", "特色住宿"],
  ]
    .map(
      ([key, i, t]) =>
        `<button aria-pressed="${k === key}" class="${k === key ? "active" : ""}" data-action="experience-tab" data-tab="${key}">${icon(i)}${t}<span>${state.choices[key].length}</span></button>`,
    )
    .join(
      "",
    )}</div>${catalogueOnly ? `<div class="notice">公开名录尚无吃住玩资料，可先生成到访草稿。具体项目与交通需要补充确认。</div>` : ""}<div class="experience-list">${
    data
      .map((a) => {
        const on = state.choices[k].includes(a.id);
        return `<article class="experience-item ${on ? "selected" : ""}"><span class="experience-icon">${icon(k === "activities" ? "hand" : k === "dining" ? "food" : "bed")}</span><div><div class="card-meta">${e(a.village)} · ${e(a.category || a.taste_style || a.type)}</div><h3>${e(a.name)}</h3><p>${e(a.description)}</p>${a.avg_price || a.price_per_night ? `<span class="price">¥${e(a.avg_price || a.price_per_night)} <small>/ ${k === "dining" ? "人" : "间夜"} · 参考价格</small></span>` : ""}</div><button class="icon-button selection-toggle" data-action="select-experience" data-id="${a.id}" aria-label="${on ? "移除" : "选择"}${e(a.name)}" aria-pressed="${on}">${icon(on ? "check" : "plus")}</button></article>`;
      })
      .join("") ||
    '<div class="empty-state"><p>这里暂时没有相关资料，你可以继续选择其他体验。</p></div>'
  }</div><p class="subtle-note">${service.demo ? "价格为示例参考，营业状态请向目的地确认。" : "餐饮与住宿可不选，由原有规划服务补充推荐。"} ${catalogueOnly ? "可跳过体验选择，生成待完善的草稿。" : "请至少选择一项活动。"}</p><div class="form-actions sticky-actions"><a href="#choose" class="text-link">${icon("back")} 重新选村</a>${button("生成我的行程 " + icon("spark"), "generate", state.choices.activities.length || catalogueOnly ? "" : "disabled")}</div></div><div>${summary()}<div class="selection-summary"><h4>已经选好</h4><p>${state.choices.activities.length} 个体验 · ${state.choices.dining.length} 家餐厅 · ${state.choices.accommodation.length} 处住宿</p><p class="muted">本原型暂不扣积分或收取费用。</p></div></div></div></section>`;
}
function itinerary() {
  const r = state.result,
    p = r.prefs || state.prefs;
  return `<section class="page-shell planner-shell">${steps(3)}<div class="itinerary-heading"><div class="page-heading"><h1>${e(r.title)}</h1><p>${e(p.departure_date)} — ${e(p.return_date)} · ${p.metadataUnknown ? "人数未记录" : e(p.travelers_count) + " 人"} · ${e(p.travel_mode)}</p></div><div class="inline-actions">${button(icon("download") + " 导出", "export", "", "secondary")}${button(icon("book") + " 保存行程", "save-route")}</div></div><div class="notice">${icon("leaf")}<span>${r.catalogue_only ? "公开名录到访草稿：吃住玩、交通与坐标尚待补充，不是已核实路线。" : r.ai?.status === "success" ? "每日安排保留所选资料，AI 建议单独展示；营业与交通仍需确认。" : r.demo ? "已按你的选择整理每日计划。当前使用规则编排，时段与交通需出发前确认。" : r.ai_generated ? "AI 已根据所选资料生成行程。具体营业时间、价格与交通请出发前确认。" : "当前为基础模板行程，AI 服务未启用或暂不可用。"}</span></div>${aiEvidence(r)}<div class="planner-layout"><div class="day-list">${r.days ? `<nav class="day-nav" aria-label="每日行程">${r.days.map((d) => button(`第 ${d.day} 天`, "jump-day", `data-target="day-${d.day}"`, "secondary")).join("")}</nav>` : ""}${r.days ? r.days.map((d) => `<section class="day-section" id="day-${d.day}" tabindex="-1"><div class="day-heading"><span>DAY ${String(d.day).padStart(2, "0")}</span><h2>第 ${d.day} 天 · ${d.day === 1 ? "走进乡村" : "继续慢慢逛"}</h2></div><div class="timeline">${d.items.map((item, i) => `<article class="timeline-item"><span class="timeline-icon">${icon({ activity: "leaf", meal: "food", stay: "bed", rest: "cup", travel: "compass" }[item.kind])}</span><div><span class="timeline-label">${item.period ? e(item.period) + " · " : ""}${{ activity: "体验时光", meal: "好好吃饭", stay: "安顿下来", rest: "留白时间", travel: "一路平安" }[item.kind]}</span><h3>${e(item.name)}</h3><p>${e(item.note)}</p>${item.price ? `<p class="muted">参考 ¥${e(item.price)} / ${item.kind === "stay" ? "间夜" : "人"}</p>` : ""}</div></article>`).join("")}</div></section>`).join("") : `<section class="generated-text"><h2>你的每日安排</h2><p class="muted">以下内容保留生成时的语言。</p><div class="route-prose" translate="no">${readableRoute(r.route || r.raw || "暂无行程内容")}</div></section>`}${r.pending?.length ? `<section class="pending-items"><h2>待安排的心愿</h2><p>这些选择已保留，可增加天数或调整项目后重新生成。</p>${r.pending.map((item) => `<article><h3>${e(item.name)}</h3><p>${e(item.village || "")} · ${e(item.reason)}</p></article>`).join("")}</section>` : ""}${r.warnings?.length ? `<p class="subtle-note">${r.warnings.map(e).join(" ")}</p>` : ""}<div class="form-actions"><a href="#${r.draft ? "experiences" : "plan"}" class="text-link">${icon("back")} ${r.draft ? "调整选择" : "重新规划"}</a>${button("分享体验反馈 " + icon("arrow"), "feedback", "", "secondary")}</div></div><aside><div class="plan-summary"><h3>带走这份小计划</h3><dl><div><dt>旅行天数</dt><dd>${numDays(p)} 天</dd></div><div><dt>人均预算上限</dt><dd>${p.metadataUnknown ? "未记录" : "¥" + e(p.budget_per_person)}</dd></div><div><dt>全员预算上限</dt><dd>${p.metadataUnknown ? "未记录" : "¥" + Number(p.budget_per_person) * Number(p.travelers_count)}</dd></div></dl><p class="muted">这是你设置的预算，不是报价或已核算费用。</p>${p.custom_requirements ? `<div class="summary-villages"><h4>记下你的小愿望</h4><p translate="no">${e(p.custom_requirements)}</p></div>` : ""}<div class="summary-villages"><h4>出发前确认</h4><p>活动是否开放与需要预约</p><p>交通、停车与渡轮安排</p><p>餐厅和民宿的实际价格</p><p>天气，以及同行人的特殊需求</p></div></div></aside></div></section>`;
}
async function detail(id) {
  const v = await service.detail(id);
  let h = readStore(storageKey("history"), []).filter((x) => x.id !== v.id);
  h.unshift({ id: v.id, date: localDate() });
  writeStore(storageKey("history"), h.slice(0, 50));
  if (state.user && !service.demo)
    request(`/api/users/${state.user.id}/browse-history`, "POST", {
      item_type: "village",
      item_id: v.id,
      item_name: v.name,
      item_image: img(v),
    }).catch(() => {});
  return `<section class="page-shell detail-page"><a href="#discover" class="text-link">${icon("back")} 返回发现乡村</a>${v.source_kind === "public" ? provenance(v) : `<div class="detail-hero"><img src="${img(v)}" alt="${e(v.tags[0] || "乡村")}旅行氛围示意"><span class="image-caption">氛围示意，非目的地实拍</span></div>`}<div class="detail-heading"><div><div class="card-meta">${icon("pin")}${e(v.city)}</div><h1>${e(v.name)}</h1><div class="tags">${tags(v)}</div></div><div class="inline-actions">${button(icon("heart") + (favorites().includes(v.id) ? " 已收藏" : " 收藏"), "favorite", `data-id="${v.id}"`, "secondary")}${button("以这里为目的地 " + icon("arrow"), "plan-village", `data-id="${v.id}"`)}</div></div><div class="detail-body"><div><h2>在这里，遇见另一种日常</h2><p class="detail-description">${e(v.description)}</p>${[
    ["activities", "可以体验什么"],
    ["dining", "尝一口在地乡味"],
    ["accommodation", "找个地方，好好休息"],
  ]
    .map(
      ([k, title]) =>
        `<section class="detail-section"><h2>${title}</h2>${(v[k] || []).map((x) => `<div class="detail-resource"><h3>${e(x.name)}<span>${x.avg_price ? "参考 ¥" + e(x.avg_price) + "/人" : x.price_per_night ? "参考 ¥" + e(x.price_per_night) + "/间夜" : ""}</span></h3><p>${e(x.description)}</p></div>`).join("") || '<p class="muted">资料待补充</p>'}</section>`,
    )
    .join(
      "",
    )}</div><aside class="plan-summary"><h3>${icon("shield")} 了解推荐依据</h3><p>${v.source_kind === "public" ? "来源：文旅部公开名录，配套资料尚未核实。" : service.demo ? "来源：项目仓库目的地示例资料。" : "来源：平台目的地资料。"}</p><p>核实状态：${v.source_kind === "public" ? "名录名称已核对，吃住玩待补充" : service.demo ? "演示数据，未独立核实" : v.is_verified ? "平台标记已核实" : "待核实"}</p><p>更新时间：${v.source_kind === "public" ? e(v.source_as_of) : !service.demo && v.verified_at ? e(String(v.verified_at).slice(0, 10)) : "暂无可确认时间"}</p><hr><p>宠物、无障碍设施与营业时间暂无完整资料，出发前请向目的地确认。</p></aside></div></section>`;
}
function aiEvidence(r) {
  if (!r.ai) return "";
  const success = r.ai.status === "success";
  return `<div class="notice"><span>${success ? "DeepSeek 已生成旅行建议；每日安排由规则整理。" : "AI 调用未成功，已使用规则结果。"}${success ? `<br><span translate="no">${e(r.ai.model || "DeepSeek")} · ${e(r.ai.generated_at || "")}</span>` : ""}</span></div>${r.ai_advice ? `<section class="generated-text"><h2>小丫的 AI 旅行建议</h2><p class="muted">建议未经实地核实，请结合下方资料确认。</p><div class="route-prose" translate="no">${readableRoute(r.ai_advice)}</div></section>` : ""}`;
}
async function savedPage() {
  let routes = saved();
  let syncError = "";
  if (state.user && !service.demo) {
    try {
      const remote = await request(`/api/users/${state.user.id}/saved-routes`);
      routes = [
        ...remote.map((r) => ({
          ...r,
          prefs: {
            ...defaults(),
            departure_date: String(r.departure_date).slice(0, 10),
            return_date: String(r.return_date).slice(0, 10),
            travel_mode: r.travel_mode,
            metadataUnknown: true,
          },
          route: r.raw,
        })),
        ...routes.filter(
          (local) =>
            !remote.some(
              (remote) =>
                (remote.raw || "") === (local.route || "") &&
                (remote.title === local.title || !!remote.raw),
            ),
        ),
      ];
    } catch {
      syncError = "云端行程暂时加载失败，下方显示本机保存内容。";
    }
  }
  const list =
    state.savedTab === "favorites"
      ? state.villages.filter((v) => favorites().includes(v.id))
      : state.villages.filter((v) =>
          readStore(storageKey("history"), []).some((h) => h.id === v.id),
        );
  window.__visibleRoutes = routes;
  return `<section class="page-shell"><div class="page-heading"><h1>给下一次出发，留个位置。</h1><p>${state.user ? e(state.user.username) + "，" : "每一个想去的地方，"}都值得好好收藏。</p></div><div class="tabs">${[
    ["trips", "我的行程"],
    ["favorites", "收藏乡村"],
    ["history", "最近浏览"],
  ]
    .map(
      ([key, title]) =>
        `<button data-action="saved-tab" data-tab="${key}" class="${state.savedTab === key ? "active" : ""}">${title}</button>`,
    )
    .join(
      "",
    )}</div>${syncError ? `<p class="notice">${syncError}</p>` : ""}${state.savedTab === "trips" ? (routes.length ? `<div class="saved-grid">${routes.map((r, i) => `<article class="saved-card">${r.catalogue_only ? "" : `<img src="/assets/${e(r.photo || "hero")}.jpg" alt="乡村旅行氛围示意">`}<div><span class="card-meta">${r.demo ? "本机保存的行程" : "已保存行程"}</span><h2>${e(r.title)}</h2><p>${e(r.prefs?.departure_date || "")} · ${e(r.prefs?.travel_mode || "")}</p>${button("查看行程 " + icon("arrow"), "open-saved", `data-index="${i}"`, "secondary")}</div></article>`).join("")}</div>` : blank("旅行还没开始，期待已经在路上", "创建第一份行程，把喜欢的乡村装进周末。")) : list.length ? `<div class="village-grid">${list.map((v) => card(v)).join("")}</div>` : blank(state.savedTab === "favorites" ? "还没有收藏的乡村" : "还没有浏览记录", "去发现页逛一逛，下一站也许就在那里。", "discover", "发现乡村")}<p class="subtle-note">${service.demo || !state.user ? "行程与收藏保存在当前浏览器，清理浏览器数据后将移除。" : "登录后可读取云端行程，未同步内容仍保存在本机。"}</p></section>`;
}
function openDialog(html) {
  lastFocus = document.activeElement;
  $("#dialog-content").innerHTML = html;
  $(".dialog-close").innerHTML = icon("close");
  $("#dialog").showModal();
}
function closeDialog() {
  $("#dialog").close();
  lastFocus?.focus();
}
function feedback() {
  openDialog(
    `<h2 id="dialog-title">这次旅行，感觉怎么样？</h2><p class="muted">真实的体验，能让下一次推荐更贴心。</p><form id="feedback-form"><fieldset class="rating"><legend>整体体验</legend>${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" required name="rating" value="${n}"><span>${icon("star")}${n}</span></label>`).join("")}</fieldset><label>想分享的体验<textarea name="content" required rows="4" maxlength="2000" placeholder="推荐是否合适？哪些信息需要更新？"></textarea></label><p class="muted">${service.demo ? "反馈仅保存到当前浏览器。" : "反馈将提交到当前关联行程的乡村。"}</p><p class="form-error" id="dialog-error" role="alert"></p><button class="button primary">提交体验反馈</button></form>`,
  );
}
function auth(register = false) {
  if (service.demo) {
    openDialog(
      `<h2 id="dialog-title">先出发，再说。</h2><p>当前体验无需注册，行程和收藏保存在此浏览器。</p><p class="muted">可以保存或导出行程；跨设备同步暂未开放。</p>${button("查看我的行程 " + icon("arrow"), "account-trips")}`,
    );
    return;
  }
  if (state.user) {
    openDialog(
      `<h2 id="dialog-title">你好，${e(state.user.username)}</h2><p>账户积分：${e(state.user.points || 0)}</p>${button("退出登录", "logout", "", "secondary")}`,
    );
    return;
  }
  openDialog(
    `<h2 id="dialog-title">${register ? "加入村小丫" : "欢迎回到村小丫"}</h2><p class="muted">登录后，把喜欢的乡村和行程留在这里。</p><form id="auth-form" data-register="${register}">${register ? '<label>昵称<input name="username" required maxlength="40" autocomplete="nickname"></label>' : ""}<label>账号<input name="login_account" required minlength="8" maxlength="60" autocomplete="username"></label><label>密码<input type="password" name="password" required minlength="6" autocomplete="${register ? "new-password" : "current-password"}"></label><p class="form-error" id="dialog-error" role="alert"></p><button class="button primary">${register ? "注册账号" : "登录"}</button></form><button class="text-button auth-switch" data-action="auth-switch" data-register="${!register}">${register ? "已有账号？去登录" : "还没有账号？去注册"}</button>`,
  );
}
function chat() {
  openDialog(
    `<h2 id="dialog-title">${icon("chat")} 问问小丫</h2><p class="muted">${service.aiEnabled ? "DeepSeek 旅行助手 · 将消息发送给模型，可将想法加入需求" : service.demo ? "出行向导 · 提供规则建议，可将想法加入需求" : "告诉我你的乡村旅行想法"}</p><div id="chat-messages" class="chat-messages" role="log" aria-live="polite"><p class="chat-bubble">你好，我是小丫。想带谁一起出发？也可以问我怎么安排一个轻松的周末。</p>${state.chatMessages.map((m) => `<p class="chat-bubble ${m.user ? "user" : ""}" ${m.user || m.generated || !service.demo ? 'translate="no"' : ""}>${e(m.text)}</p>`).join("")}</div>${button("把最新想法加入需求", "chat-to-plan", state.chatMessages.some((m) => m.user) ? "" : "hidden", "secondary")}<form id="chat-form" class="chat-input"><input name="message" aria-label="给小丫的消息" placeholder="想带孩子去乡村玩两天…" maxlength="200" required><button class="button primary" aria-label="发送消息">${icon("arrow")}</button></form>`,
  );
}
async function render(options = {}) {
  closeTripEditor(false);
  syncTripToolbar();
  const version = ++renderId;
  const route = (location.hash.slice(1) || "home").split("/");
  const name = route[0];
  document.body.dataset.view = name;
  const mapCity =
    name === "village"
      ? state.villages.find((v) => v.id === Number(route[1]))?.city
      : state.prefs.selected_cities[0];
  if (name !== "home" && name !== "discover") focusMap(mapCity);
  $$("[data-nav]").forEach((a) => {
    const active =
      a.dataset.nav ===
      (["plan", "choose", "experiences", "itinerary"].includes(name)
        ? "plan"
        : name === "village"
          ? "discover"
          : name);
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  $("#account-button").innerHTML =
    icon("user") +
    `<span>${state.user ? e(state.user.username) : service.demo ? "旅行体验官" : "登录 / 注册"}</span>`;
  $("#assistant-icon").innerHTML = icon("chat");
  if (!options.preserveFocus) $("#content").scrollTop = 0;
  if (["choose", "experiences"].includes(name) && !state.token) {
    go("plan");
    return;
  }
  if (name === "itinerary" && !state.result) {
    go("saved");
    return;
  }
  $("#content").innerHTML =
    '<div class="loading"><span class="spinner"></span><p>正在整理旅行灵感…</p></div>';
  try {
    let html;
    if (name === "home") html = home();
    else if (name === "discover") html = discover();
    else if (name === "plan") html = plan();
    else if (name === "choose") html = choose();
    else if (name === "experiences") html = experiences();
    else if (name === "itinerary") html = itinerary();
    else if (name === "village") html = await detail(route[1]);
    else if (name === "saved") html = await savedPage();
    else
      html = blank(
        "这条小路，还没有通向页面",
        "返回首页，继续寻找旅行灵感。",
        "home",
        "返回首页",
      );
    if (version !== renderId) return;
    $("#content").innerHTML = html;
    applyLocale();
    if (!options.preserveFocus) $("#content").focus({ preventScroll: true });
    document.title =
      ({
        home: "去村里，慢下来",
        discover: "发现乡村",
        plan: "说说出游需求",
        choose: "挑选乡村",
        experiences: "选择体验",
        itinerary: "我的旅行计划",
        saved: "我的行程",
        village: "走进乡村",
      }[name] || "村小丫") + " · 村小丫";
  } catch (err) {
    if (version === renderId)
      $("#content").innerHTML = blank(
        "这段旅程暂时没有加载好",
        e(err.message),
        "retry",
        "重新加载",
      );
  }
}
function collectPrefs(form) {
  const f = new FormData(form);
  return {
    ...state.prefs,
    ...Object.fromEntries(f),
    selected_cities: f.getAll("cities"),
    activity_preferences: f.getAll("activity_preferences"),
    travelers_count: Number(f.get("travelers_count")),
    budget_per_person: Number(f.get("budget_per_person")),
  };
}
async function withBusy(btn, fn) {
  if (state.busy) return;
  state.busy = true;
  const old = btn ? [...btn.childNodes] : [];
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 正在整理…';
  }
  try {
    await fn();
  } finally {
    state.busy = false;
    if (btn?.isConnected) {
      btn.disabled = false;
      if (btn.querySelector(".spinner")) btn.replaceChildren(...old);
    }
  }
}
async function rerenderControl(button) {
  const data = { ...button.dataset },
    y = $("#content").scrollTop;
  await render({ preserveFocus: true });
  const replacement = $$("[data-action]").find((node) =>
    Object.entries(data).every(([key, value]) => node.dataset[key] === value),
  );
  replacement?.focus({ preventScroll: true });
  $("#content").scrollTop = y;
}
document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-action]");
  if (!b || b.disabled) return;
  const a = b.dataset.action;
  try {
    if (a === "load-more") {
      state.visibleCount += 24;
      const y = $("#content").scrollTop;
      await render({ preserveFocus: true });
      $("#content").scrollTop = y;
      return;
    }
    if (a === "sidebar-toggle") {
      document.documentElement.classList.toggle("sidebar-collapsed");
      syncSidebar();
      try {
        localStorage.setItem(
          "sylvaplan-sidebar",
          document.documentElement.classList.contains("sidebar-collapsed")
            ? "collapsed"
            : "expanded",
        );
      } catch {}
      return;
    }
    if (a === "edit-trip") {
      openTripEditor(b);
      return;
    }
    if (a === "close-trip-editor") {
      closeTripEditor();
      return;
    }
    if (["home", "discover", "plan"].includes(a)) {
      go(a);
      return;
    }
    if (a === "close-dialog") {
      closeDialog();
      return;
    }
    if (a === "retry") {
      await boot();
      return;
    }
    if (a === "account") {
      auth();
      return;
    }
    if (a === "account-trips") {
      closeDialog();
      go("saved");
      return;
    }
    if (a === "auth-switch") {
      auth(b.dataset.register === "true");
      return;
    }
    if (a === "logout") {
      state.user = null;
      sessionStorage.removeItem("cxya-user");
      closeDialog();
      render();
      return;
    }
    if (a === "chat-to-plan") {
      const last = state.chatMessages.filter((m) => m.user).at(-1)?.text;
      if (last)
        state.prefs.custom_requirements = [
          state.prefs.custom_requirements,
          last,
        ]
          .filter(Boolean)
          .join("；")
          .slice(0, 1000);
      persistDraft();
      closeDialog();
      go("plan");
      return;
    }
    if (a === "chat") {
      chat();
      return;
    }
    if (a === "about") {
      openDialog(
        '<h2 id="dialog-title">关于这次旅行</h2><p>村小丫是一个乡村旅游规划团队项目。当前预览接入 1,399 条文旅部公开村名录，并单独标注原有样例配套，支持从偏好输入到行程保存。</p><p>图片仅作旅行氛围示意；营业时间、价格、设施和交通没有实时核实。此版本不提供预订、支付、实时预警，也不会收取积分。</p><p>演示模式的行程、收藏与反馈仅保存在当前浏览器，可通过浏览器设置清除。</p>',
      );
      return;
    }
    if (a === "prompt-idea") {
      $("#quick-wish").value = translateText(b.dataset.wish);
      $("#quick-city").value = translateText(b.dataset.city);
      state.prefs.activity_preferences = [b.dataset.theme];
      $("#quick-wish").focus();
      return;
    }
    if (a === "jump-day") {
      const target = document.getElementById(b.dataset.target);
      target?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      target?.focus({ preventScroll: true });
      return;
    }
    if (a === "theme" || a === "filter-theme") {
      state.theme = b.dataset.theme;
      if (a === "theme") go("discover");
      else render();
      return;
    }
    if (a === "clear-filters") {
      state.city = "全部城市";
      state.theme = "全部乡村";
      state.province = "全部地区";
      state.visibleCount = 24;
      state.search = "";
      render();
      return;
    }
    if (a === "slow-plan") {
      state.prefs.custom_requirements = translateText(
        "想在茶田散步，品尝农家菜，每天留出午休时间，行程慢一点。",
      );
      state.prefs.selected_cities = ["杭州"];
      state.prefs.activity_preferences = ["茶田寻香"];
      persistDraft();
      go("plan");
      return;
    }
    if (a === "add-wish") {
      const input = $("#custom-requirements");
      input.value = [input.value, translateText(b.dataset.wish)]
        .filter(Boolean)
        .join("；");
      state.prefs.custom_requirements = input.value;
      persistDraft();
      return;
    }
    if (a === "favorite") {
      await withBusy(b, async () => {
        const id = Number(b.dataset.id),
          all = favorites(),
          on = all.includes(id),
          v = state.villages.find((v) => v.id === id);
        if (state.user && !service.demo)
          await request(
            `/api/users/${state.user.id}/favorites${on ? "?item_type=village&item_id=" + id : ""}`,
            on ? "DELETE" : "POST",
            {
              item_type: "village",
              item_id: id,
              item_name: v.name,
              item_image: img(v),
            },
          );
        if (
          !writeStore(
            storageKey("favorites"),
            on ? all.filter((x) => x !== id) : [...all, id],
          )
        )
          throw new Error("本机存储已满，收藏未保存");
        b.classList.toggle("is-favorite", !on);
        b.setAttribute("aria-pressed", String(!on));
        b.setAttribute("aria-label", (!on ? "取消收藏" : "收藏") + v.name);
        if (!b.classList.contains("favorite"))
          b.innerHTML = icon("heart") + (!on ? " 已收藏" : " 收藏");
        toast(on ? "已取消收藏" : "已放进你的乡村收藏");
      });
      return;
    }
    if (a === "plan-village") {
      const v = state.villages.find((v) => v.id === Number(b.dataset.id));
      state.prefs.selected_cities = [v.city];
      state.selected = [v.id];
      persistDraft();
      go("plan");
      return;
    }
    if (a === "select-village") {
      const id = Number(b.dataset.id);
      state.selected = state.selected.includes(id)
        ? state.selected.filter((x) => x !== id)
        : [...state.selected, id];
      persistDraft();
      await rerenderControl(b);
      return;
    }
    if (a === "next-experiences") {
      await withBusy(b, async () => {
        state.details = await Promise.all(
          state.selected.map((id) => service.detail(id)),
        );
        for (const k of Object.keys(state.choices)) {
          const valid = state.details.flatMap((v) =>
            (v[k] || []).map((a) => a.id),
          );
          state.choices[k] = state.choices[k].filter((id) =>
            valid.includes(id),
          );
        }
        persistDraft();
        go("experiences");
      });
      return;
    }
    if (a === "experience-tab") {
      state.tab = b.dataset.tab;
      await rerenderControl(b);
      return;
    }
    if (a === "select-experience") {
      const id = Number(b.dataset.id),
        list = state.choices[state.tab];
      state.choices[state.tab] = list.includes(id)
        ? list.filter((x) => x !== id)
        : [...list, id];
      persistDraft();
      await rerenderControl(b);
      return;
    }
    if (a === "generate") {
      await withBusy(b, async () => {
        if (
          !state.choices.activities.length &&
          !state.details.every((v) => v.source_kind === "public")
        )
          throw new Error("请至少选择一项体验");
        const result = await service.generate(
          state.prefs,
          state.selected,
          state.choices,
          state.details,
          state.token,
          getLocale(),
        );
        const names = state.details.map((v) => v.name);
        state.result = {
          ...result,
          id: crypto.randomUUID(),
          title:
            names.slice(0, 2).join(" · ") +
            " " +
            numDays(state.prefs) +
            " 日慢旅行",
          prefs: structuredClone(state.prefs),
          villageIds: [...state.selected],
          villages: names,
          photo: state.details[0]?.photo || "hero",
          sessionToken: state.token,
          cloudSaved: !service.demo && !!state.user,
          draft: {
            token: state.token,
            selected: [...state.selected],
            choices: structuredClone(state.choices),
            details: structuredClone(state.details),
            recommendations: structuredClone(state.recommendations),
          },
        };
        persistDraft();
        go("itinerary");
      });
      return;
    }
    if (a === "save-route") {
      await withBusy(b, async () => {
        const r = state.result,
          list = saved();
        if (list.some((x) => x.id === r.id)) {
          toast("这份行程已经保存了");
          return;
        }
        if (state.user && !service.demo && !r.cloudSaved)
          await request(`/api/users/${state.user.id}/saved-routes`, "POST", {
            title: r.title,
            cities: r.prefs.selected_cities,
            villages: r.villages,
            departure_date: r.prefs.departure_date,
            return_date: r.prefs.return_date,
            travel_mode: r.prefs.travel_mode,
            raw: r.route || "",
          });
        if (!writeStore(storageKey("saved"), [r, ...list]))
          throw new Error("本机存储已满，请导出行程留存");
        toast(
          state.user && !service.demo
            ? "行程已保存到账号"
            : "已保存到本机，在「我的行程」中查看",
        );
      });
      return;
    }
    if (a === "export") {
      const r = state.result,
        p = r.prefs;
      const text = [
        r.title,
        `${p.departure_date} 至 ${p.return_date} | ${p.metadataUnknown ? "人数未记录" : p.travelers_count + " 人"} | ${p.travel_mode}`,
        `人均预算上限：${p.metadataUnknown ? "未记录" : p.budget_per_person + " 元"}`,
        r.demo
          ? "规则编排行程；时间、交通、价格与配套需另行核实。"
          : "请出发前确认实际营业时间、价格和交通。",
        r.days
          ? r.days
              .map(
                (d) =>
                  "\n第 " +
                  d.day +
                  " 天\n" +
                  d.items
                    .map((i) => "- " + i.name + "\n  " + i.note)
                    .join("\n"),
              )
              .join("\n")
          : r.route || r.raw,
      ]
        .map((part, index) =>
          index === 4 && !r.days ? part : translateText(part),
        )
        .join("\n\n");
      const extras = [
        r.ai
          ? translateText(
              r.ai.status === "success"
                ? "DeepSeek 已生成旅行建议；每日安排由规则整理。"
                : "AI 调用未成功，已使用规则结果。",
            ) +
            "\n" +
            [r.ai.model, r.ai.generated_at, r.ai.request_id]
              .filter(Boolean)
              .join(" | ")
          : "",
        r.ai_advice
          ? translateText("小丫的 AI 旅行建议") + "\n" + r.ai_advice
          : "",
        r.sources?.length
          ? translateText("公开名录来源") +
            "\n" +
            r.sources
              .map(
                (s) => translateText(s.name) + " | " + s.as_of + " | " + s.url,
              )
              .join("\n")
          : "",
        p.custom_requirements
          ? translateText("补充旅行需求") + "\n" + p.custom_requirements
          : "",
        p.dining_requirements
          ? translateText("餐饮偏好") + "\n" + p.dining_requirements
          : "",
        r.pending?.length
          ? translateText("待安排的心愿") +
            "\n" +
            r.pending
              .map((item) => translateText(item.name + " · " + item.reason))
              .join("\n")
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const url = URL.createObjectURL(
        new Blob([text, extras ? "\n\n" + extras : ""], {
          type: "text/plain;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = translateText(r.title) + ".txt";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    if (a === "saved-tab") {
      state.savedTab = b.dataset.tab;
      render();
      return;
    }
    if (a === "open-saved") {
      state.result = window.__visibleRoutes[Number(b.dataset.index)];
      state.prefs = { ...defaults(), ...state.result.prefs };
      if (state.result.draft)
        Object.assign(state, structuredClone(state.result.draft));
      else {
        state.token = null;
        state.selected = [];
        state.details = [];
        state.choices = { activities: [], dining: [], accommodation: [] };
      }
      persistDraft();
      go("itinerary");
      return;
    }
    if (a === "feedback") {
      if (!state.result?.villageIds?.length) {
        toast("请先通过本次规划生成行程，再关联体验反馈");
        return;
      }
      feedback();
      return;
    }
  } catch (err) {
    toast(err.message || "操作没有完成，请稍后重试");
  }
});
document.addEventListener("click", (ev) => {
  if (
    !$("#trip-editor").hidden &&
    !ev.target.closest("#trip-editor,[data-action=edit-trip]")
  )
    closeTripEditor(false);
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !$("#trip-editor").hidden) {
    ev.preventDefault();
    closeTripEditor();
  }
});
document.addEventListener("change", (ev) => {
  if (["filter-source", "filter-province"].includes(ev.target.id)) {
    if (ev.target.id === "filter-source") {
      state.dataSource = ev.target.value;
      state.province = "全部地区";
      state.theme = "全部乡村";
    } else {
      state.province = ev.target.value;
      state.city = "全部城市";
    }
    state.visibleCount = 24;
    render();
    return;
  }

  if (
    ev.target.closest("#trip-quick-edit") &&
    ev.target.name === "departure_date"
  )
    $("#trip-quick-edit [name=return_date]").min = ev.target.value;
  if (ev.target.id === "filter-city") {
    state.city = ev.target.value;
    focusMap(state.city);
    render();
  }
  if (ev.target.closest("#plan-form")) {
    state.prefs = collectPrefs($("#plan-form"));
    if (ev.target.name === "departure_date")
      $('input[name="return_date"]').min = state.prefs.departure_date;
    $("#summary-wrap").innerHTML = summary();
    syncTripToolbar();
    persistDraft();
  }
});
document.addEventListener("input", (ev) => {
  if (ev.target.matches("[data-city-search]")) {
    const query = ev.target.value.trim().toLowerCase().replace(/\s/g, "");
    const box = ev.target.closest("fieldset");
    $$(".city-options .choice", box).forEach((label) => {
      const input = $("input", label),
        city = input.value;
      const regions = state.villages
        .filter((v) => v.city === city)
        .map((v) => v.province || "")
        .join(" ");
      const text = [
        city,
        translateText(city, "en"),
        regions,
        translateText(regions, "en"),
      ]
        .join(" ")
        .toLowerCase()
        .replace(/\s/g, "");
      label.hidden = !!query && !text.includes(query) && !input.checked;
    });
    return;
  }

  if (ev.target.closest("#plan-form")) {
    state.prefs = collectPrefs($("#plan-form"));
    persistDraft();
  }
});
document.addEventListener("submit", async (ev) => {
  const f = ev.target;
  if (
    ![
      "trip-quick-edit",
      "quick-plan",
      "discover-search",
      "plan-form",
      "feedback-form",
      "auth-form",
      "chat-form",
    ].includes(f.id)
  )
    return;
  ev.preventDefault();
  const b = $('button[type="submit"],button:not([type])', f);
  try {
    if (f.id === "trip-quick-edit") {
      const d = new FormData(f),
        key = f.dataset.field,
        next = { ...state.prefs };
      const error = $("#trip-editor-error");
      error.textContent = "";
      if (key === "where") {
        next.selected_cities = d.getAll("cities");
        if (!next.selected_cities.length) {
          error.textContent = "请选择至少一个目的地城市。";
          return;
        }
      }
      if (key === "when") {
        next.departure_date = d.get("departure_date");
        next.return_date = d.get("return_date");
        if (
          !next.departure_date ||
          !next.return_date ||
          next.departure_date < localDate() ||
          !Number.isFinite(numDays(next)) ||
          numDays(next) < 1 ||
          numDays(next) > 7
        ) {
          error.textContent = "请设置 1—7 天的旅行日期，返程不能早于出发。";
          return;
        }
      }
      if (key === "who") {
        next.travelers_count = Number(d.get("travelers_count"));
        next.travel_relation = d.get("travel_relation");
        if (
          !Number.isInteger(next.travelers_count) ||
          next.travelers_count < 1 ||
          next.travelers_count > 50
        ) {
          error.textContent = "同行人数须为 1—50 人。";
          return;
        }
      }
      if (key === "budget") {
        next.budget_per_person = Number(d.get("budget_per_person"));
        if (
          !Number.isFinite(next.budget_per_person) ||
          next.budget_per_person < 1 ||
          next.budget_per_person > 100000
        ) {
          error.textContent = "预算须为 1—100000 元。";
          return;
        }
      }
      const changed = JSON.stringify(next) !== JSON.stringify(state.prefs);
      state.prefs = next;
      if (changed) state.token = null;
      persistDraft();
      syncTripToolbar();
      closeTripEditor();
      if (key === "where") {
        focusMap(next.selected_cities[0]);
        if ($("#quick-city"))
          $("#quick-city").value = translateText(next.selected_cities[0]);
      }
      if (key === "when" && $("#quick-duration"))
        $("#quick-duration").value = String(numDays(next));
      const route = location.hash.slice(1);
      if (changed && ["choose", "experiences", "itinerary"].includes(route)) {
        go("plan");
        toast("需求已更新，请重新确认推荐。");
      } else if (route === "plan") await render({ preserveFocus: true });
      return;
    }
    if (f.id === "quick-plan") {
      const d = new FormData(f);
      const wish = String(d.get("wish"));
      const requested = String(d.get("city") || "").trim();
      const resolvedCity = cityList().find(
        (c) =>
          c === requested ||
          translateText(c, "en").toLowerCase().replace(/\s/g, "") ===
            requested.toLowerCase().replace(/\s/g, ""),
      );
      if (!resolvedCity)
        throw new Error("请从已收录地区中选择目的地，可输入城市或拼音搜索。");
      d.set("city", resolvedCity);
      const parsed = parseTripInput(
        wish,
        cityList(),
        Object.fromEntries(cityList().map((c) => [c, translateText(c, "en")])),
      );
      const { duration, ...fields } = parsed;
      const start =
        state.prefs.departure_date >= localDate()
          ? state.prefs.departure_date
          : localDate(1);
      const end = new Date(start + "T12:00:00");
      end.setDate(end.getDate() + (duration || Number(d.get("duration"))) - 1);
      const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
      state.prefs = {
        ...state.prefs,
        ...fields,
        selected_cities:
          parsed.selected_cities ||
          (state.prefs.selected_cities.includes(d.get("city"))
            ? state.prefs.selected_cities
            : [d.get("city")]),
        departure_date: start,
        return_date: endDate,
        custom_requirements: wish,
      };
      persistDraft();
      focusMap(state.prefs.selected_cities[0]);
      go("plan");
    }
    if (f.id === "discover-search") {
      state.search = new FormData(f).get("query").trim();
      state.visibleCount = 24;
      render();
    }
    if (f.id === "plan-form") {
      const p = collectPrefs(f);
      $("#form-error").textContent = "";
      if (!p.selected_cities.length)
        throw new Error("请选择至少一个目的地城市。");
      if (p.departure_date < localDate())
        throw new Error("出发日期不能早于今天。");
      if (numDays(p) < 1 || numDays(p) > 7)
        throw new Error("请设置 1—7 天的旅行日期，返程不能早于出发。");
      await withBusy(b, async () => {
        state.prefs = p;
        const result = await service.recommend(p, state.user);
        state.token = result.token;
        state.recommendations = result.villages;
        state.selected = state.selected.filter((id) =>
          result.villages.some((v) => v.id === id),
        );
        state.details = state.details.filter((v) =>
          state.selected.includes(v.id),
        );
        for (const key of Object.keys(state.choices)) {
          const valid = new Set(
            state.details.flatMap((v) => (v[key] || []).map((x) => x.id)),
          );
          state.choices[key] = state.choices[key].filter((id) => valid.has(id));
        }
        state.result = null;
        persistDraft();
        go("choose");
      });
    }
    if (f.id === "feedback-form") {
      await withBusy(b, async () => {
        const d = new FormData(f),
          data = {
            rating: Number(d.get("rating")),
            content: d.get("content"),
            session_token: state.result.sessionToken || state.token,
          };
        if (service.demo) {
          if (
            !writeStore(storageKey("feedback"), [
              ...readStore(storageKey("feedback"), []),
              { ...data, routeId: state.result.id },
            ])
          )
            throw new Error("浏览器无法保存反馈，请稍后重试");
        } else {
          for (const id of state.result.villageIds)
            await request("/api/feedback", "POST", {
              ...data,
              user_id: state.user?.id || null,
              village_id: id,
            });
        }
        closeDialog();
        toast(
          service.demo
            ? "谢谢你的分享，反馈已保存在本机"
            : "谢谢你的分享，反馈已提交",
        );
      });
    }
    if (f.id === "auth-form") {
      await withBusy(b, async () => {
        const d = Object.fromEntries(new FormData(f));
        if (f.dataset.register === "true") {
          await request("/api/users/register", "POST", d);
          auth(false);
          toast("注册成功，请登录");
          return;
        }
        state.user = await request("/api/users/login", "POST", d);
        sessionStorage.setItem("cxya-user", JSON.stringify(state.user));
        const cloud = (state.user.favorites || [])
          .filter((x) => x.type === "village")
          .map((x) => Number(x.id));
        writeStore(storageKey("favorites"), [
          ...new Set([...favorites(), ...cloud]),
        ]);
        closeDialog();
        toast("欢迎回来，" + state.user.username);
        render();
      });
    }
    if (f.id === "chat-form") {
      await withBusy(b, async () => {
        const input = $("input", f),
          message = input.value.trim();
        if (!message) return;
        $("#chat-messages").insertAdjacentHTML(
          "beforeend",
          `<p class="chat-bubble user" translate="no">${e(message)}</p>`,
        );
        input.value = "";
        state.chatMessages.push({ user: true, text: message });
        let reply,
          generated = false,
          aiStatus = null;
        if (service.demo && service.aiEnabled) {
          try {
            const result = await request("/api/local-ai/chat", "POST", {
              message,
              language: getLocale(),
              ids: state.selected.slice(0, 10),
              history: state.chatMessages.slice(0, -1).slice(-8),
            });
            reply = result.reply;
            generated = result.ai_generated;
            aiStatus = result.ai;
          } catch {
            reply = translateText(
              "AI 暂时不可用。你仍可选择目的地、日期和体验，使用规则生成行程。",
            );
            aiStatus = { status: "fallback" };
          }
        } else if (service.demo) {
          reply = /宠物|无障碍|pet|accessib|wheelchair/i.test(message)
            ? "这些条件需要向具体民宿和活动方确认。可以先把需求填进规划页，出发前逐项核实。"
            : /孩子|亲子|child|kid|family/i.test(message)
              ? "带孩子出游，可以少选几个活动，中午留出休息时间。到「我的规划」选择亲子家庭，再写下孩子年龄和偏好。"
              : /预算|费用|budget|cost|price/i.test(message)
                ? "规划页可以设置人均全程预算。示例餐饮与住宿价格仅供参考，实际报价和交通费用需要另行确认。"
                : "可以从「我的规划」开始：选城市和日期，再挑喜欢的乡村与体验。我建议每天留一点自由活动时间，不必把行程排满。";
        } else
          reply = (
            await request("/api/pet/chat", "POST", {
              message,
              language: getLocale(),
            })
          ).reply;
        state.chatMessages.push({
          user: false,
          text: reply,
          generated,
          ai: aiStatus,
        });
        state.chatMessages = state.chatMessages.slice(-20);
        $('[data-action="chat-to-plan"]').hidden = false;
        $("#chat-messages").insertAdjacentHTML(
          "beforeend",
          `<p class="chat-bubble" ${generated || !service.demo ? 'translate="no"' : ""}>${e(reply)}</p>`,
        );
        if (aiStatus)
          $("#chat-messages").insertAdjacentHTML(
            "beforeend",
            `<p class="muted">${translateText(aiStatus.status === "success" ? "DeepSeek 实时回复 · 信息仍需核实" : "AI 调用未成功，已使用规则结果。")}</p>`,
          );
        $("#chat-messages").scrollTop = $("#chat-messages").scrollHeight;
      });
    }
  } catch (err) {
    const error = f.id === "plan-form" ? $("#form-error") : $("#dialog-error");
    if (error) error.textContent = err.message;
    else toast(err.message);
  }
});
$("#dialog").addEventListener("click", (ev) => {
  if (ev.target === $("#dialog")) {
    const r = ev.target.getBoundingClientRect();
    if (
      ev.clientX < r.left ||
      ev.clientX > r.right ||
      ev.clientY < r.top ||
      ev.clientY > r.bottom
    )
      closeDialog();
  }
});
$(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  $("#content").focus();
  $("#content").scrollIntoView();
});
window.addEventListener("hashchange", render);
async function boot() {
  try {
    await initLocale();
    syncSidebar();
    $$("[data-icon]").forEach(
      (node) => (node.innerHTML = icon(node.dataset.icon)),
    );
    await service.init();
    state.villages = await service.villages();
    try {
      state.user = service.demo
        ? null
        : JSON.parse(sessionStorage.getItem("cxya-user"));
      const draft = JSON.parse(
        sessionStorage.getItem("cxya-draft-" + service.demo),
      );
      if (draft) Object.assign(state, draft);
    } catch {}
    $("#mode-notice").hidden = !service.demo;
    $("#mode-notice").textContent = service.aiEnabled
      ? "DeepSeek 已配置 · 生成建议时调用模型 · 行程保存在本机"
      : "公开名录与样例分开展示 · 行程保存在当前浏览器";
    $("#map-city").innerHTML =
      `<option value="all">全部目的地</option>${cityList()
        .map((c) => `<option value="${e(c)}">${e(c)}</option>`)
        .join("")}`;
    await render();
    initMap((city) => {
      state.city = city;
      state.province = "全部地区";
      state.theme = "全部乡村";
      state.visibleCount = 24;
      state.search = "";
      go("discover");
    });
  } catch (err) {
    $("#content").innerHTML = blank(
      "暂时无法连接旅行服务",
      e(err.message) +
        "。请确认服务与数据库已启动，或使用 npm run demo 体验本地演示。",
      "retry",
      "重新连接",
    );
  }
}
boot();
