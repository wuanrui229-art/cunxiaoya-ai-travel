# SylvaPlan · 村小丫

SylvaPlan / 村小丫 presents a team countryside-travel MVP as a Chinese/English planning experience. The user-supplied CV requirements describe the team project: convert natural-language needs into tags, match database-backed activities, dining and stays, generate a route with DeepSeek, preserve a template fallback, and maintain sessions, saved state, and useful error handling. These are team-project capabilities; this document does not assign individual contributions.

The current visual authority is the user-supplied dark planning screenshot: persistent left navigation, a central conversation and progressive planner, and a right-hand map. This replaces the former light editorial homepage. The traveler starts with a request, confirms editable preferences, chooses villages, selects food/stays/activities, then generates, saves, exports, or gives feedback on an itinerary. Short countryside trips for families, friends, couples, and solo travelers remain the product focus.

## Original backend capabilities

Preserve the existing Express/MySQL service, accounts, favorites, browsing history, saved routes, feedback, and trip sessions. The backend can call configured DeepSeek services to parse free-text needs into structured tags, score villages against related activities/dining/accommodation records, and generate a route from database records and traveler selections. Without a valid AI configuration or when generation fails, it provides a template fallback. AI-generated status must follow the returned result, not the visual styling. Session APIs persist requirements, selections, and planning state.

## Portfolio presentation

The portfolio/demo path uses 1,399 publicly sourced MCT directory records plus 9 separately labeled destination fixtures, a local rule-based request parser, city/tag matching, and a deterministic schedule builder. When a server-side key is configured, it calls DeepSeek for assistant replies and contextual itinerary advice. Daily scheduling and preference parsing remain rule-based. This local mode does not prove live database behavior. Parsed city, duration, party, budget, and interests are suggestions that the traveler can edit before continuing. Public records provide source names, regions and batches, with Chinese/pinyin search; they do not provide verified amenities or coordinates. Directory-only plans are visit drafts with missing information explicitly retained. Schedules retain selected items that cannot fit as pending choices, and label transport and time periods as requiring confirmation. Local trips, favorites, and feedback stay in the current browser; storage failures and unsynced live state must remain visible.

The UI must distinguish fixture/rules output, backend template fallback, and successful AI generation. Loading, empty search results, unavailable services, invalid input, failed saves, and unfinished/pending selections are product states rather than hidden implementation details. The preserved backend and its source code support the project narrative; the original production database path remains unverified. The new local AI path was tested with real Chinese chat and English travel advice on 2026-09-27, separately from database/model doubles.

## Map and language boundaries

The UI now includes an interactive MapLibre map with OpenFreeMap light/dark basemaps. Markers are city-scope reference points for Zhuhai, Hangzhou, Chengdu, Guilin, and Wuyuan, not verified village coordinates or route navigation. Map loading requires WebGL and remote tiles; failure leaves a readable fallback and keeps planning usable. Mobile users open the map with a toolbar toggle.

Chinese and English interfaces share selections and state. Switching locale preserves typed text and canonical values sent to the original APIs. Bundled records have translated presentation labels; live/user/AI prose may retain its original language, while route requests may specify the desired generation language.

## Evidence and scope

Photography is illustrative. Resource records, prices, availability, travel times, city markers, and special requirements are not independently verified by this presentation. Do not imply bookings, payments, real-time weather, optimized map routes or collaborative editing. The Vercel public site and real DeepSeek chat/advice smoke tests are documented in VALIDATION.md; they do not establish production database or browser visual acceptance. Do not assign personal ownership or contribution metrics without explicit user evidence.

The visual reference is the user-supplied screenshot of the Mindtrip-style planning workspace. There is no claim of affiliation or pixel-exact reconstruction. Source inspection alone does not establish rendered browser fidelity.

## Theme and data update

Daylight is the initial default; a toolbar toggle persists explicit light/dark preference and switches map styling without resetting planning state. The preview now imports 1,399 official MCT directory records. DATA_SOURCES.md records provenance, the source cutoff and missing amenities/coordinates. The original 9 destinations retain their sample labels; no live business-data integration is claimed.
