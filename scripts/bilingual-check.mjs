// Nonvisual integration check. Supply HAPPY_DOM_MODULE for a local happy-dom installation.
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const { Window } = await import(process.env.HAPPY_DOM_MODULE || "happy-dom");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.DEMO_URL || "http://127.0.0.1:4173";
const w = new Window({
  url: base,
  settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true },
});
let mockedAiCalls = 0;
w.fetch = async (url, opts) => {
  const response = await fetch(new URL(url, w.location.href), opts);
  if (!process.env.MOCK_LOCAL_AI) return response;
  if (String(url) === "/api/config") {
    const config = await response.json();
    config.data.ai_enabled = true;
    return new Response(JSON.stringify(config));
  }
  if (String(url).startsWith("/api/local-ai/")) {
    const data = await response.json();
    if (!data.success) {
      console.error("Mock endpoint:", String(url), data.message);
      throw Error("Mock AI endpoint rejected");
    }
    mockedAiCalls++;
    if (process.env.MOCK_LOCAL_AI === "fallback")
      return new Response(JSON.stringify(data));
    Object.assign(data.data, {
      ai_generated: true,
      ai: {
        status: "success",
        model: "test-provider-model",
        generated_at: "2026-09-27T00:00:00Z",
        request_id: "test-request",
      },
    });
    if (String(url).endsWith("chat"))
      data.data.reply =
        "Keep the weekend relaxed; confirm local facilities first.";
    else
      data.data.ai_advice =
        "Allow time to rest each day. Confirm dining and accommodation before departure.";
    return new Response(JSON.stringify(data));
  }
  return response;
};
w.AbortSignal = globalThis.AbortSignal;
w.structuredClone = globalThis.structuredClone;
w.document.write(
  fs
    .readFileSync(root + "/public/index.html", "utf8")
    .replace(/<script[^>]*>.*?<\/script>/gs, ""),
);
w.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
w.HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
const source = ["planner.mjs", "i18n.js", "map.js", "data.js", "app.js"]
  .map((f) =>
    fs
      .readFileSync(root + "/public/" + f, "utf8")
      .replace(/^import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];\s*/gm, "")
      .replace(/^export /gm, ""),
  )
  .join("\n");
w.eval(fs.readFileSync(root + "/public/theme.js", "utf8"));
w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
w.eval(source);
const $ = (s) => w.document.querySelector(s),
  $$ = (s) => [...w.document.querySelectorAll(s)];
async function wait(fn, label) {
  for (let i = 0; i < 150; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error(
    "Timeout: " +
      label +
      " | " +
      $("#toast").textContent +
      " | " +
      ($("#chat-messages")?.innerHTML ||
        $("#content").textContent.slice(0, 200)),
  );
}
const tick = () => new Promise((r) => setTimeout(r, 35));
const click = (s) => {
  assert($(s), "Missing " + s);
  $(s).click();
};
const submit = (s) =>
  $(s).dispatchEvent(
    new w.Event("submit", { bubbles: true, cancelable: true }),
  );
function val(s, v) {
  assert($(s), s);
  $(s).value = v;
  $(s).dispatchEvent(new w.Event("change", { bubbles: true }));
}
const missing = new Set();
async function scan() {
  await tick();
  const walker = w.document.createTreeWalker(
    w.document.body,
    w.NodeFilter.SHOW_TEXT,
  );
  let n;
  while ((n = walker.nextNode())) {
    if (
      n.parentElement?.closest(
        'script,style,textarea,input,noscript,[translate="no"]',
      )
    )
      continue;
    if (/[\u3400-\u9fff]/.test(n.textContent))
      missing.add(n.textContent.trim());
  }
  for (const el of $$("[placeholder],[aria-label],[alt]")) {
    if (el.closest('[translate="no"]')) continue;
    for (const attr of ["placeholder", "aria-label", "alt"]) {
      const text = el.getAttribute(attr) || "";
      if (/[\u3400-\u9fff]/.test(text)) missing.add(text);
    }
  }
}
await wait(() => $(".conversation-home"), "home");
// Header shortcuts must edit distinct fields without discarding the composer.
val("#quick-wish", "keep this draft");
click("#sidebar-toggle");
assert(w.document.documentElement.classList.contains("sidebar-collapsed"));
assert.equal($("#sidebar-toggle").getAttribute("aria-expanded"), "false");
assert.equal(w.localStorage.getItem("sylvaplan-sidebar"), "collapsed");
assert.equal($("#quick-wish").value, "keep this draft");
click("#sidebar-toggle");
assert(!w.document.documentElement.classList.contains("sidebar-collapsed"));
click('[data-field="where"][data-action="edit-trip"]');
assert($("#trip-quick-edit [name=cities]"));
assert(!$("#trip-quick-edit [name=budget_per_person]"));
$$("#trip-quick-edit [name=cities]").forEach(
  (n) => (n.checked = n.value === "杭州"),
);
submit("#trip-quick-edit");
assert.equal($("#quick-city").value, "杭州");
assert.equal($("#quick-wish").value, "keep this draft");
click('[data-field="when"][data-action="edit-trip"]');
const start = $("#trip-quick-edit [name=departure_date]").value;
val("#trip-quick-edit [name=return_date]", "2000-01-01");
submit("#trip-quick-edit");
assert($("#trip-editor-error").textContent.length);
assert(!$("#trip-editor").hidden);
const end = new Date(start + "T12:00:00");
end.setDate(end.getDate() + 1);
val(
  "#trip-quick-edit [name=return_date]",
  `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
);
submit("#trip-quick-edit");
assert($("#trip-editor").hidden);
click('[data-field="who"][data-action="edit-trip"]');
val("#trip-quick-edit [name=travelers_count]", "5");
submit("#trip-quick-edit");
click('[data-field="budget"][data-action="edit-trip"]');
val("#trip-quick-edit [name=budget_per_person]", "900");
submit("#trip-quick-edit");
click('[data-field="budget"][data-action="edit-trip"]');
val("#trip-quick-edit [name=budget_per_person]", "2");
click('[data-action="close-trip-editor"]');
assert.equal($("[data-trip-value=budget]").textContent, "¥900");
click('[data-field="budget"][data-action="edit-trip"]');
w.document.dispatchEvent(
  new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
);
assert($("#trip-editor").hidden);
assert.equal(w.document.activeElement.dataset.field, "budget");

val("#quick-wish", "这是我的原话，不要修改。");
val("#quick-city", "杭州");
assert.equal(w.document.documentElement.dataset.theme, "light");
click("#theme-toggle");
assert.equal(w.document.documentElement.dataset.theme, "dark");
assert.equal(w.localStorage.getItem("village-muse-theme"), "dark");
assert.equal($("#quick-city").value, "杭州");
assert.equal($("#quick-wish").value, "这是我的原话，不要修改。");
click("#theme-toggle");
assert.equal(w.document.documentElement.dataset.theme, "light");

click("#language-toggle");
await wait(() => w.document.documentElement.lang === "en", "English");
assert.equal($("#quick-wish").value, "这是我的原话，不要修改。");
assert.equal($("#quick-city").value, "Hangzhou");
assert.equal(
  $("#quick-duration option[value='2']").textContent,
  "2 days · 1 night",
);
assert(
  $$("#destination-options option").every(
    (option) => !/[\u3400-\u9fff]/.test(option.value),
  ),
  "English suggestions have localized values",
);
val("#quick-city", "hang");
click("#language-toggle");
await tick();
assert.equal($("#quick-city").value, "hang", "Partial searches are preserved");
click("#language-toggle");
await tick();
assert.equal($("#quick-city").value, "hang");
val("#quick-city", "Hangzhou");
click("#language-toggle");
await tick();
assert.equal(
  $("#quick-city").value,
  "杭州",
  "Known place switches back to Chinese",
);
click("#language-toggle");
await tick();
assert.equal($("#quick-city").value, "Hangzhou");
assert.match($("h1").textContent, /Where to today/);
await scan();
for (const key of ["where", "when", "who", "budget"]) {
  click(`[data-field="${key}"][data-action="edit-trip"]`);
  await scan();
  click('[data-action="close-trip-editor"]');
}
click('[data-action=prompt-idea][data-city="珠海"]');
assert.match($("#quick-wish").value, /kids/);
assert.equal($("#quick-city").value, "Zhuhai");
submit("#quick-plan");
await wait(() => $("#plan-form"), "preferences");
assert.equal(
  $("[name=budget_per_person]").value,
  "900",
  "Header budget reaches the planner",
);
assert.equal(
  $("[name=travelers_count]").value,
  "5",
  "Header party size reaches the planner",
);
await scan();
assert(
  $('[name="cities"][value="珠海"]').checked,
  "English composer submits canonical city",
);
assert.equal($("[name=travel_relation]").value, "亲子家庭");
assert.match($("[name=custom_requirements]").value, /midday rest/);
val("[name=budget_per_person]", "1250");
click("#language-toggle");
await tick();
assert.equal($("[name=budget_per_person]").value, "1250");
assert.equal($("[name=travel_relation]").value, "亲子家庭");
click("#language-toggle");
await tick();
assert.equal($("[name=budget_per_person]").value, "1250");
submit("#plan-form");
await wait(() => $(".selection-grid"), "choose");
await scan();
assert.equal($$(".village-card:not(.registry-card)").length, 3);
click('[data-action=select-village][data-id="7"]');
await wait(() => $(".village-card.is-selected"), "selected village");
click("[data-action=next-experiences]");
await wait(() => $(".experience-list"), "experiences");
await scan();
click("[data-action=select-experience]");
await wait(() => $(".experience-item.selected"), "activity");
for (const tab of ["dining", "accommodation"]) {
  click(`[data-action=experience-tab][data-tab=${tab}]`);
  await tick();
  await scan();
  click("[data-action=select-experience]");
  await tick();
}
click("[data-action=generate]");
await wait(() => $(".day-section"), "itinerary");
await scan();
assert.equal($$(".day-section").length, 2);
assert.match($("#content").textContent, /midday rest/);
assert.equal($$(".day-nav button").length, 2);
let exported;
// Happy DOM navigates to download URLs; browsers download them without replacing the page.
w.HTMLAnchorElement.prototype.click = function () {
  if (this.hasAttribute("download")) return;
  this.dispatchEvent(
    new w.MouseEvent("click", { bubbles: true, cancelable: true }),
  );
};
w.URL.createObjectURL = (blob) => {
  exported = blob;
  return "blob:demo-export";
};
w.URL.revokeObjectURL = () => {};
click("[data-action=export]");
await tick();
assert(exported, "Export creates a file");
const exportedText = await exported.text();
assert.match(exportedText, /Day 1/);
if (process.env.MOCK_LOCAL_AI === "1") {
  assert(exportedText.includes("test-provider-model"));
  assert(exportedText.includes("Allow time to rest"));
}
assert.match(exportedText, /midday rest/);
assert(
  !/[\u3400-\u9fff]/.test(exportedText),
  "English export has no untranslated demo copy",
);
click("[data-action=save-route]");
await wait(() => w.localStorage.getItem("cxya-v2-demo-guest-saved"), "save");
await scan();
w.location.hash = "saved";
await wait(() => $(".saved-card"), "saved");
await scan();
click("[data-action=open-saved]");
await wait(() => $(".day-section"), "reopen");
await scan();
click("[data-action=feedback]");
await wait(() => $("#feedback-form"), "feedback");
await scan();
$('[name=rating][value="4"]').checked = true;
val("#feedback-form textarea", "Lovely countryside");
submit("#feedback-form");
await wait(() => !$("#dialog").open, "feedback submitted");
for (let id = 1; id <= 9; id++) {
  w.location.hash = "village/" + id;
  await wait(
    () =>
      $(".detail-description") &&
      $("[data-action=plan-village]")?.dataset.id === String(id),
    "detail " + id,
  );
  await tick();
  await scan();
}
w.location.hash = "discover";
await wait(() => $("#discover-search"), "discover");
val("#filter-source", "sample");
await tick();
val("#filter-city", "杭州");
await wait(() => $$(".village-card").length === 1, "city filter");
val("[name=query]", "Jingshan");
submit("#discover-search");
await tick();
assert.equal($$(".village-card").length, 1, "English destination search");
await scan();
click("#language-toggle");
await tick();
submit("#discover-search");
await tick();
assert.equal(
  $$(".village-card").length,
  1,
  "English search survives Chinese locale",
);
click("#language-toggle");
await tick();
click("[data-action=favorite]");
await wait(() => $(".is-favorite"), "favorite");
val("[name=query]", "no such village");
submit("#discover-search");
await wait(() => $(".empty-state"), "empty");
await scan();
click("[data-action=chat]");
await wait(() => $("#chat-form"), "chat");
await scan();
val("#chat-form input", "family with kids");
submit("#chat-form");
await wait(() => $$(".chat-bubble").length === 3, "chat response");
await scan();
click("[data-action=close-dialog]");
click("#account-button");
await tick();
await scan();
click("[data-action=close-dialog]");
click("[data-action=about]");
await tick();
await scan();

// Imported records can be found, sourced, saved and planned without inventing facilities.
click("[data-action=close-dialog]");
w.location.hash = "discover";
await wait(() => $("#discover-search"), "public discovery");
val("#filter-source", "public");
await tick();
click("[data-action=clear-filters]");
await tick();
assert.equal($$(".registry-card").length, 24, "Directory is paginated");
click("[data-action=load-more]");
await tick();
assert.equal($$(".registry-card").length, 48);
val("#filter-province", "江苏");
await tick();
val("[name=query]", "yonglian");
submit("#discover-search");
await tick();
assert.equal(
  $$(".registry-card").length,
  1,
  "Pinyin query finds official record",
);
await scan();
w.location.hash = $(".registry-card .card-title").getAttribute("href");
await wait(() => $(".provenance"), "public provenance");
assert($(".provenance a").href.includes("sjfw.mct.gov.cn"));
assert(!$(".detail-hero"), "No illustrative photo assigned to official record");
await scan();
click("[data-action=plan-village]");
await wait(() => $("#plan-form"), "public planning");
submit("#plan-form");
await wait(() => $(".selection-grid"), "public recommendations");
click("[data-action=next-experiences]");
await wait(() => $(".experience-list"), "public facilities");
assert.equal($$(".experience-item").length, 0);
assert(
  !$("[data-action=generate]").disabled,
  "Public record can produce a clearly labeled draft",
);
await scan();
click("[data-action=generate]");
await wait(() => $(".day-list"), "public draft");
assert.match($(".notice").textContent, /Directory-based visit draft/);
assert.match($(".day-list").textContent, /Yong Lian/i);
await scan();
click("[data-action=save-route]");
await tick();
click("[data-action=export]");
await tick();
assert.equal(w.localStorage.getItem("village-muse-locale"), "en");
fs.mkdirSync(root + "/.impeccable", { recursive: true });
fs.writeFileSync(
  root + "/.impeccable/bilingual-untranslated.json",
  JSON.stringify([...missing], null, 2),
);
assert.equal(missing.size, 0, "Untranslated UI: " + [...missing].join(" | "));
if (process.env.MOCK_LOCAL_AI) {
  assert(
    mockedAiCalls >= 3,
    "AI chat and both sample/public itinerary paths exercised: " +
      mockedAiCalls,
  );
  if (process.env.MOCK_LOCAL_AI === "fallback") {
    assert(
      w.document.body.textContent.includes(
        "The AI request failed. A rule-based result is shown.",
      ),
    );
    assert(!w.document.body.textContent.includes("Xiaoya’s AI travel advice"));
  } else {
    assert(
      w.document.body.textContent.includes("test-provider-model"),
      "Actual returned model shown",
    );
    assert(
      w.document.body.textContent.includes("Allow time to rest"),
      "AI advice shown separately from days",
    );
  }
}
console.log(
  "PASS bilingual DOM flow: form values survive switching; English suggestions and search; preferences → villages → all experience tabs → 2-day itinerary → save/reopen → feedback; all 9 village details; favorites, empty states, assistant, account and about. No visual assertions.",
);
await w.happyDOM.abort();
process.exit(0);
