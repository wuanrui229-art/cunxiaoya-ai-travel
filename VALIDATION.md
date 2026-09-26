# Packaging validation

Checked on 2026-09-25 with Node.js 24.15.0:

- `npm ci` completed successfully.
- Node syntax checks passed for `server.js`, `db.js` and `scraper_zhuhai.js`.
- Express started on localhost and served the HTML entry page with HTTP 200.
- Requests for `/server.js`, `/db.js`, `/villagetour.sql` and `/.env` returned HTTP 404.
- The published SQL retains destination sample data and omits sample user, feedback, trip-session and trip-history inserts.

No test MySQL database was available. Database-backed workflows, user flows and AI route generation were therefore not verified end to end. No provider request or scraping job was run. Chrome could not start in the verification environment, so this pass does not claim visual browser verification.

## Redesign checks — 2026-09-26

Passed:

- Dependency installation (`npm ci` with a task-local cache).
- Node syntax checks for server/demo scripts; ES module syntax checks for `public/app.js` and `public/data.js`.
- `npm run test:demo`: 9 source villages, destination city filtering, no-results case, two-day multi-village itinerary, every chosen activity retained exactly once, chosen meals/stays, requested rest time, and explicit non-AI demo state.
- Local demo server on 127.0.0.1:4173 serves the interface and config `{demo:true}`; server source and `.env` paths return 404.
- Original Express server starts on 127.0.0.1:4174, serves the redesigned HTML, reports config `{demo:false}`, and does not expose `server.js`.
- Frontend contract review corrected login/register to `login_account` and cancellation of favorites to the existing query-string DELETE contract.
- Four image assets were opened and visually inspected individually; local font format checked and OFL license included.

Limits:

- No MySQL development database or DeepSeek credential was supplied. Live account/database/model flows have not been tested end to end, and no provider calls were made.
- GUI browser execution fails in this host sandbox. Attempts with installed Chrome, Chromium 130 and Chrome Headless Shell 130 exited before a debugging connection (SIGABRT / power-notification registration errors). Therefore desktop/mobile screenshots, browser E2E and accessibility/layout checks are **not claimed as passed**. `scripts/browser-check.cjs` contains the prepared browser workflow for a host that can launch Chromium.
- An independent asset-assistant task failed due to its service usage limit; assets were sourced and checked in the main thread. No independent visual-review pass was completed.
- No remote push or deployment was performed. Changes are on local branch `redesign/rural-travel-demo`.

Additional nonvisual integration checks passed:

- A happy-dom session executed the actual frontend scripts against the local demo service through homepage prefill → preferences → village selection → activity/dining selection → two-day itinerary → save/reopen → feedback. City filtering, favorites, no-results search and helper responses also passed.
- A separate happy-dom session with explicitly mocked live responses checked registration, `login_account` login, account state, add-favorite and query-string DELETE cancellation. This is an API-contract simulation, not a database-backed E2E test.
- These DOM checks do not replace screenshot, responsive-layout or actual-browser validation.

## SylvaPlan bilingual workspace — 2026-09-26

Passed on the current revision:

- Node syntax checks for frontend ES modules and backend; `git diff --check`.
- Data integrity / selected-item retention checks (`npm run test:demo`).
- Chinese DOM workflow and mocked live registration/login/favorite API contract checks.
- `scripts/bilingual-check.mjs`: locale toggle preserves user-entered text, city values, party type and budget; English prompt suggestions; complete four-step planning with dining/stays; two-day itinerary and rest request; English text export; save/reopen; feedback; all nine village detail pages; English search in both UI languages; favorites; no-result state; demo assistant; mobile account trigger; about dialog. No untranslated Chinese UI strings found on sampled English surfaces, excluding protected brand/user/original live content.
- Real Express endpoint on localhost returned an English assistant fallback with the API key explicitly empty. No provider request was made.
- Independent code reviewer identified four issues (mobile account access, legacy summary grid placement, live export preservation, locale-independent search). All four fixes were confirmed by the reviewer within code-review scope.

Not verified: actual Chromium rendering/screenshots, 320–1440 px layout, visual Mindtrip fidelity, keyboard/focus appearance, database E2E and real English AI output. Prior Chrome, Chromium and headless-shell launches failed in this host; no new browser pass is claimed. Existing AI/saved output intentionally remains in its original language. Language hints were added to new AI requests; model compliance has not been tested against a real provider.

No GitHub push, production deployment or remote data changes were performed.

## Dark planning studio + CV alignment — current revision

Passed: `scripts/demo-check.mjs` (Chinese/English input parsing, activity capacity, meal order, explicit pending selections, city boundaries); `scripts/bilingual-check.mjs` (full nonvisual bilingual journey against the refreshed local server); `scripts/backend-contract-check.cjs` (original server handler with DB/provider doubles, including timeouts and fallback); Node syntax checks.

The code-only finish review identified inherited breakpoint geometry, grid specificity, low-contrast tags, and missing mobile account access. All four were patched. The right map now has offline/WebGL fallback; city selector and mobile toggle are separate from planning state. These facts do not establish visual acceptance.

Not verified: actual MapLibre tile rendering, Chromium screenshots, exact visual fidelity, real MySQL or DeepSeek integration, deployment, CV data provenance, individual team contributions, and the existing demo video. The CV comparison document makes these distinctions explicit.

## Daylight theme — 2026-09-26

Bilingual DOM flow passed with additional checks for default daylight, dark/light switching, persisted preference, and preserving city and user text during switches. Syntax and diff checks passed. Map style switching is wired to the selected theme; actual remote tile rendering and visual acceptance remain unverified. No public datasets were imported in this pass.

## Trip shortcuts and collapsible sidebar — 2026-09-26

The four toolbar controls now edit separate preference groups in a nonmodal panel, validate dates/party size/budget, support cancel/Escape, and update visible values. Changed requirements invalidate the recommendation token and return downstream planning screens to confirmation. Composer submission now retains toolbar-set dates, party and budget unless explicitly overridden in the request. Desktop sidebar collapse is remembered independently of theme/locale; the expand control remains in the top bar. The map observes its changed container size.

The bilingual DOM flow passed with checks for all four panels, invalid-date handling, cancel, Escape/focus return, preserving typed composer content, applying budget and party to the planner, collapse/expand, and the sidebar preference storage key. Actual browser layout remains unverified.


## Public directory import — 2026-09-26

Imported MCT batches 1–4: 1,399 unique source IDs and province/name pairs, 31 province-level regions plus the Xinjiang Production and Construction Corps. Source cutoff 2022-12-07. Raw HTML and SHA-256 retained; no source scripts executed. CSV/JSON preserve source IDs, batch, dates and null coordinates. No live database was modified.

Passed `npm run test:public`: source checksum, batch totals, uniqueness, 1,408 combined public/sample records, region recommendations, empty public amenity collections, visit drafts with provenance and no invented prices. Passed `npm run test:demo` and expanded `scripts/bilingual-check.mjs`: Chinese/English flows, public pagination, province and pinyin filtering, official-source detail, selecting a public village, bypassing empty amenities, generating/saving/exporting a visit draft.

These are data and nonvisual DOM checks. Chromium rendering, real map tiles, source name updates after the cutoff, exact village coordinates, business operations, production MySQL and live DeepSeek remain unverified.


## Local DeepSeek connection — 2026-09-27 (Asia/Shanghai)

Real requests through the local HTTP server passed: Chinese assistant reply and English itinerary advice for a public Suzhou village. Configured model: `deepseek-chat`; provider-returned model: `deepseek-flash`. The chat consumed 566 tokens and returned in 2,278 ms; itinerary advice consumed 1,147 tokens and returned in 3,496 ms. These are two smoke-test observations, not a performance benchmark. A preceding 10-token connection probe also passed. API key contents were not printed or stored in test reports.

`npm run test:ai` passed with explicit provider doubles: successful grounded context, actual model/usage metadata, English instructions and history; no key in outputs; 401/402/429/503, empty/truncated/timeout/no-key fallback; destination/resource/date validation and unchanged rule schedule. HTTP checks confirmed cross-origin denial and `.env` inaccessibility. Dataset and rule planner regressions passed.

Bilingual nonvisual flows passed against an AI-disabled local server and with provider responses substituted at the test boundary for AI display, save/reopen and export. Happy DOM's download navigation is stubbed because it otherwise replaces the test page with a blob URL. No Chromium visual or real-map acceptance is claimed.

Scope: DeepSeek chat and contextual travel advice are live; preference parsing and daily schedule organization still use local rules. The original MySQL + full generated-route workflow remains unverified. Local invocation metadata contains timestamps, status, actual model, usage and error category; it does not contain prompts, responses or credentials and is not a full paper experiment dataset.


## Composer locale and alignment — 2026-09-27

Fixed the city field's visible value and datalist suggestions to follow the active locale while resolving the original Chinese region on submission. Partial city searches and free-form travel requests survive language changes. Duration labels now use singular “1 night”. The expanded bilingual DOM flow passed with English/Chinese place switching, English suggestions, partial-search preservation and canonical region submission.

Removed legacy important padding overrides and reset the composer controls' inherited margins, heights and native select appearance. Happy DOM computed-style checks at 1440 and 390 px, in light and dark themes, report both controls at 42 px inner height, zero top margin/padding and appearance:none; mobile font size is 16 px. These checks verify the CSS cascade, not browser pixel geometry. The user's screenshot is the defect evidence; no new Chromium screenshot acceptance is claimed.


## Production Vercel release — 2026-09-27

Project `sylvaplan`, public alias https://sylvaplan.vercel.app. First production build reached READY. Anonymous HTTP requests returned 200 for home, `/api/config`, catalogue (1,399 records), English locale and app module; `.env`, `server.js` and `local-ai.cjs` returned 404. Real cloud English chat succeeded (552 tokens, 2,131 ms) and Chinese itinerary advice succeeded (1,215 tokens, 4,895 ms), preserving the two-day rule schedule and public-only status. Cross-origin requests returned 403. Returned model: `deepseek-flash` for configured `deepseek-chat`. These are smoke checks, not performance benchmarks or browser visual acceptance.

Adapter tests cover JSON/method/body validation, same-origin handling, disabled-model fallback and per-instance rate limiting. Production credentials are stored as sensitive Vercel environment variables. Source release is from the local working tree; no commit/push or automatic Git deployment is implied.
