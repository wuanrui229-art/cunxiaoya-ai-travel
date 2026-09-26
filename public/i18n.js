// UI localization is separate from canonical data/form values. Changing language
// never rebuilds a form or rewrites free text, selected IDs, or API payloads.
// Recognized place labels change language; the planner resolves canonical names on submit.
let locale = "zh";
try {
  locale = localStorage.getItem("village-muse-locale") === "en" ? "en" : "zh";
} catch {}
let dictionary = {},
  fragments = [];
const originals = new WeakMap();
let observer;
export const getLocale = () => locale;
export function translateText(input, targetLocale = locale) {
  if (targetLocale !== "en") return String(input ?? "");
  const value = String(input ?? "");
  if (!/[\u3400-\u9fff]/.test(value)) return value;
  const leading = value.match(/^\s*/)[0],
    trailing = value.match(/\s*$/)[0],
    key = value.trim();
  if (dictionary[key]) return leading + dictionary[key] + trailing;
  let result = value;
  // Longest phrase first, in one pass. Translated output is never re-translated.
  result = result
    .replace(/第\s*(\d+)\s*天/g, "Day $1")
    .replace(/第\s*(\d+)\s*批/g, "Batch $1")
    .replace(/(\d+)\s*日慢旅行/g, "$1-day slow escape")
    .replace(
      /(\d+)\s*天\s*(\d+)\s*夜/g,
      (_, days, nights) =>
        `${days} ${Number(days) === 1 ? "day" : "days"} · ${nights} ${Number(nights) === 1 ? "night" : "nights"}`,
    )
    .replace(/(\d+)\s*天/g, "$1 days")
    .replace(/(\d+)\s*人/g, "$1 travelers")
    .replace(/找到\s*(\d+)\s*个乡村/g, "$1 villages found")
    .replace(/已选\s*(\d+)\s*个/g, "$1 selected")
    .replace(/(\d+)\s*个体验/g, "$1 experiences")
    .replace(/(\d+)\s*家餐厅/g, "$1 restaurants")
    .replace(/(\d+)\s*处住宿/g, "$1 stays")
    .replace(/(\d+)\s*元/g, "CNY $1")
    .replace(/\/\s*人/g, "/ person")
    .replace(/\s至\s/g, " to ");
  return fragments.length
    ? result.replace(fragmentPattern, (match) => dictionary[match])
    : result;
}
let fragmentPattern;
function preserveValue(el) {
  if (el.tagName === "OPTION" && !el.hasAttribute("value"))
    el.setAttribute("value", el.textContent);
}
function translateNode(node) {
  if (node.nodeType === 1) {
    if (node.matches('script,style,textarea,input,[translate="no"]')) {
      if (node.matches("input,textarea")) translateAttributes(node);
      return;
    }
    preserveValue(node);
    translateAttributes(node);
    for (const child of node.childNodes) translateNode(child);
  } else if (
    node.nodeType === 3 &&
    node.parentElement &&
    !node.parentElement.closest('script,style,textarea,input,[translate="no"]')
  ) {
    const old = originals.get(node);
    const source = old && node.data === old.output ? old.source : node.data;
    const output = locale === "en" ? translateText(source) : source;
    originals.set(node, { source, output });
    if (node.data !== output) node.data = output;
  }
}
const attributeOriginals = new WeakMap();
function translateAttributes(el) {
  if (el.closest('[translate="no"]')) return;
  const values = attributeOriginals.get(el) || {};
  for (const name of ["placeholder", "aria-label", "title", "alt"]) {
    if (!el.hasAttribute(name)) continue;
    const current = el.getAttribute(name),
      old = values[name];
    const source = old && current === old.output ? old.source : current;
    const output = locale === "en" ? translateText(source) : source;
    values[name] = { source, output };
    if (current !== output) el.setAttribute(name, output);
  }
  attributeOriginals.set(el, values);
}
function localizePlaceFields() {
  for (const input of document.querySelectorAll(
    "input[data-localized-place]",
  )) {
    const list = document.getElementById(input.getAttribute("list"));
    if (!list) continue;
    const options = [...list.querySelectorAll("option[data-place-name]")];
    const normalize = (value) => value.trim().toLowerCase().replace(/\s/g, "");
    const current = normalize(input.value);
    const match = options.find((option) =>
      [
        option.dataset.placeName,
        translateText(option.dataset.placeName, "en"),
      ].some((name) => normalize(name) === current),
    );
    // Preserve incomplete searches and user-authored place text verbatim.
    if (match && input.value !== translateText(match.dataset.placeName))
      input.value = translateText(match.dataset.placeName);
    for (const option of options)
      option.value = translateText(option.dataset.placeName);
  }
}
export function applyLocale() {
  observer?.disconnect();
  document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  translateNode(document.body);
  translateNode(document.querySelector("title"));
  localizePlaceFields();
  const toggle = document.getElementById("language-toggle");
  toggle.textContent = locale === "en" ? "EN / 中文" : "中 / EN";
  toggle.setAttribute(
    "aria-label",
    locale === "en" ? "切换为中文" : "Switch to English",
  );
  observer?.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["placeholder", "aria-label", "title", "alt"],
  });
}
export async function initLocale() {
  if (observer) {
    applyLocale();
    return;
  }
  const response = await fetch("/locales/en.json");
  if (!response.ok)
    throw new Error("Language resources could not be loaded. Please reload.");
  const places = await fetch("/locales/places-en.json");
  if (!places.ok)
    throw new Error("Place names could not be loaded. Please reload.");
  dictionary = { ...(await places.json()), ...(await response.json()) };
  fragments = Object.keys(dictionary)
    .filter((k) => /[\u3400-\u9fff]/.test(k))
    .sort((a, b) => b.length - a.length);
  fragmentPattern = new RegExp(
    fragments.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "g",
  );
  observer = new MutationObserver(applyLocale);
  document.getElementById("language-toggle").addEventListener("click", () => {
    locale = locale === "en" ? "zh" : "en";
    try {
      localStorage.setItem("village-muse-locale", locale);
    } catch {}
    applyLocale();
  });
  applyLocale();
}
