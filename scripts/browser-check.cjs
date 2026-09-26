// Run against `npm run demo`. Supply PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE if needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const out = path.join(__dirname, "../.impeccable/review");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE,
    headless: true,
    args: ["--no-sandbox"],
  });
  const p = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    locale: "zh-CN",
  });
  const errors = [];
  p.on("pageerror", (err) => errors.push(err.message));
  const checks = [];
  async function capture(name, width = 1440) {
    await p.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await p.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((img) => {
          img.loading = "eager";
          if (img.complete) return Promise.resolve();
          return new Promise((r) => {
            img.onload = r;
            img.onerror = r;
            setTimeout(r, 4000);
          });
        }),
      );
      window.scrollTo(0, 0);
    });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Horizontal overflow: " + name,
    );
    assert.equal(
      await p
        .locator("img")
        .evaluateAll(
          (imgs) =>
            imgs.filter((i) => !i.complete || i.naturalWidth === 0).length,
        ),
      0,
      "Broken images: " + name,
    );
    await p.screenshot({ path: path.join(out, name + ".png"), fullPage: true });
  }
  await p.goto("http://127.0.0.1:4173");
  await p.getByRole("heading", { level: 1 }).waitFor();
  await capture("desktop");
  await capture("mobile", 390);
  await p.locator("#language-toggle").click();
  await p
    .getByRole("heading", { level: 1 })
    .filter({ hasText: "Where to today" })
    .waitFor();
  await capture("mobile-en", 390);
  await capture("desktop-en");
  await p.locator("#language-toggle").click();
  await p.setViewportSize({ width: 390, height: 844 });
  checks.push("Desktop/mobile homepage; assets and overflow");
  await p.setViewportSize({width:1440,height:1000});
  await p.getByRole("button", { name: "登录或查看账户" }).click();
  await p.getByRole("heading", { name: "先出发，再说。" }).waitFor();
  await p.getByRole("button", { name: "关闭窗口" }).click();
  await p.getByRole("link", { name: "发现乡村", exact: true }).click();
  await p.locator(".village-card").first().waitFor();
  await p.selectOption("#filter-city", "珠海");
  assert.equal(await p.locator(".village-card").count(), 3);
  await p.locator('[data-action="favorite"]').first().click();
  assert.equal(await p.locator(".favorite.is-favorite").count(), 1);
  await p.locator(".card-title").first().click();
  await p.getByRole("heading", { name: "在这里，遇见另一种日常" }).waitFor();
  await capture("detail-mobile", 390);
  await p.getByRole("link", { name: "发现乡村", exact: true }).click();
  await p.locator('[name="query"]').fill("不存在的乡村");
  await p.getByRole("button", { name: "搜索", exact: true }).click();
  await p.getByRole("heading", { name: "暂时没有符合条件的乡村" }).waitFor();
  checks.push("Search, city filter, empty state, favorites and detail");
  await p.goto("http://127.0.0.1:4173/#home");
  await p.locator("#quick-city").selectOption("珠海");
  await p.locator("#quick-wish").fill("带孩子采摘，每天午休，行程慢一点");
  await p.getByRole("button", { name: "发送旅行想法" }).click();
  await p.locator("#plan-form").waitFor();
  assert.match(
    await p.locator('[name="custom_requirements"]').inputValue(),
    /每天午休/,
  );
  await capture("plan-desktop");
  await capture("plan-mobile", 390);
  // Out-of-range dates must be rejected without losing the form.
  await p.locator('[name="return_date"]').fill("2030-01-01");
  await p.getByRole("button", { name: "看看适合我的乡村" }).click();
  assert.match(await p.locator("#form-error").textContent(), /1—7/);
  const start = await p.locator('[name="departure_date"]').inputValue();
  const end = new Date(start + "T12:00:00");
  end.setDate(end.getDate() + 1);
  const endValue =
    end.getFullYear() +
    "-" +
    String(end.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(end.getDate()).padStart(2, "0");
  await p.locator('[name="return_date"]').fill(endValue);
  await p.locator('[name="travel_relation"]').selectOption("亲子家庭");
  await p.getByRole("button", { name: "看看适合我的乡村" }).click();
  await p.getByRole("heading", { name: "挑一个心动的地方。" }).waitFor();
  await p.locator('[data-action="select-village"][data-id="7"]').click();
  await p.locator('[data-action="select-village"][data-id="8"]').click();
  await p.reload();
  await p.locator(".village-card.is-selected").first().waitFor();
  assert.equal(await p.locator(".village-card.is-selected").count(), 2);
  await capture("selection-mobile", 390);
  await p.getByRole("button", { name: /已选 2 个/ }).click();
  await p.getByRole("heading", { name: "把喜欢的，放进这趟旅行。" }).waitFor();
  await p.locator('[data-action="select-experience"]').nth(0).click();
  await p.locator('[data-action="select-experience"]').nth(1).click();
  await capture("experiences-desktop");
  await p.locator('[data-tab="dining"]').click();
  await p.locator('[data-action="select-experience"]').first().click();
  await p.locator('[data-tab="accommodation"]').click();
  await p.locator('[data-action="select-experience"]').first().click();
  await p.getByRole("button", { name: "生成我的行程" }).click();
  await p.locator(".day-section").first().waitFor();
  assert.equal(await p.locator(".day-section").count(), 2);
  assert.equal(
    await p.getByRole("heading", { name: "留一点午休时间" }).count(),
    2,
  );
  await capture("itinerary-desktop");
  await capture("itinerary-mobile", 390);
  await p.getByRole("button", { name: "保存行程", exact: true }).click();
  await p.getByRole("link", { name: "我的行程", exact: true }).click();
  await p.locator(".saved-card").waitFor();
  assert.equal(await p.locator(".saved-card").count(), 1);
  await p.getByRole("button", { name: "查看行程" }).click();
  await p.locator(".day-section").first().waitFor();
  const dl = p.waitForEvent("download");
  await p.getByRole("button", { name: "导出", exact: true }).click();
  const download = await dl;
  assert(download.suggestedFilename().endsWith(".txt"));
  await p.getByRole("button", { name: "分享体验反馈" }).click();
  await p
    .locator("label")
    .filter({ has: p.locator('input[name="rating"][value="4"]') })
    .click();
  await p
    .locator("#feedback-form textarea")
    .fill("慢节奏安排合适，示例资料的核实提示清晰。");
  await p.getByRole("button", { name: "提交体验反馈" }).click();
  await p.waitForFunction(() => !document.querySelector("#dialog").open);
  await p.getByRole("button", { name: "打开问问小丫" }).click();
  await p.locator("#chat-form input").fill("带孩子出游怎么安排？");
  await p.locator("#chat-form button").click();
  await p.waitForFunction(
    () => document.querySelectorAll(".chat-bubble").length === 3,
  );
  await p.keyboard.press("Escape");
  checks.push(
    "Full planning; invalid dates; refresh draft; all selections; route save/reopen/export; feedback; helper",
  );
  await p.reload();
  await p.locator(".day-section").first().waitFor();
  assert.equal(await p.locator(".day-section").count(), 2);
  checks.push("Saved route survives refresh");
  assert.deepEqual(errors, [], "Browser JavaScript errors");
  fs.writeFileSync(
    path.join(out, "browser-check.json"),
    JSON.stringify(
      { passed: true, checks, pageErrors: errors, viewports: [1440, 390] },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ passed: true, checks, pageErrors: errors }, null, 2),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
