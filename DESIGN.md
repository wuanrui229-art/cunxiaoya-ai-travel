---
name: SylvaPlan / 村小丫
description: A bilingual dark countryside travel planning studio
colors:
  paper: "#111312"
  surface: "#1b1e1c"
  ink: "#efefeb"
  muted: "#a0a6a1"
  line: "#303531"
  sage: "#252e28"
  primary: "#bde1c9"
  primary-hover: "#d1efdb"
  action: "#c3dec9"
  action-hover: "#dcf0e0"
  nav-active: "#252a26"
  composer: "#141715"
  summary: "#1a211c"
  map: "#152324"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "clamp(27px, 2.4vw, 43px)"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.035em"
  headline:
    fontSize: "27px"
    lineHeight: 1.35
    fontWeight: 600
  title:
    fontSize: "17px"
    fontWeight: 600
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "15px"
    lineHeight: 1.85
  control:
    fontSize: "12px"
  label:
    fontSize: "11px"
rounded:
  navigation: "9px"
  panel: "10px"
  map: "16px"
  bubble: "18px 18px 3px 18px"
  marker: "19px"
  chip: "22px"
  composer: "23px"
  toolbar: "24px"
  new-trip: "28px"
spacing:
  compact: "8px"
  small: "12px"
  medium: "16px"
  panel: "20px"
  canvas: "26px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "#1b3423"
    rounded: "7px"
    padding: "10px 15px"
  button-secondary:
    backgroundColor: "#232a25"
    textColor: "#d5e4d9"
    rounded: "7px"
    padding: "10px 15px"
  navigation-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "#f1f3ef"
    rounded: "{rounded.navigation}"
    padding: "12px"
  prompt-chip:
    backgroundColor: "#1a1e1b"
    textColor: "#bdc9be"
    rounded: "{rounded.chip}"
    padding: "8px 11px"
  composer:
    backgroundColor: "{colors.composer}"
    rounded: "{rounded.composer}"
    padding: "14px 16px 10px"
  plan-summary:
    backgroundColor: "{colors.summary}"
    rounded: "{rounded.panel}"
    padding: "20px"
  city-marker:
    backgroundColor: "#e6f4e7"
    textColor: "#1e3726"
    rounded: "{rounded.marker}"
    padding: "7px 14px"
---

# Design System: SylvaPlan / 村小丫

## Overview

**Creative North Star: "A conversation beside the map"**

SylvaPlan / 村小丫 is a dark, conversation-led countryside travel planning studio. The user-supplied screenshot now governs the visual direction: a persistent left rail, a central conversation and planning surface, and a right-hand dark map. Quiet charcoal surfaces, pale green actions, compact sans-serif type, and a bottom composer connect the welcome state with the working planner.

This supersedes the previous light Mindtrip-inspired workspace and the earlier mixed editorial references. The stylesheet order is `styles.css`, `workspace.css`, then `studio.css`; the last file is the final visual authority. This is a source-grounded description, not a claim of screenshot fidelity or verified browser rendering.

**Key Characteristics:**
- Persistent navigation, central planning, and map context share one desktop workspace.
- Dark tonal layers replace the former paper-and-photography homepage.
- Pale green controls carry selection and forward actions.
- Chinese and English UI share state and the same visual system.

## Colors

Charcoal forms the canvas; warm off-white text and pale green actions establish hierarchy without introducing a second theme.

### Primary

- **Pale Green** and **Pale Green Hover** are the root accent tokens.
- **Action Green** and **Action Hover** are the actual filled primary-button and selection variants. Keep these distinct from the root accent because the final stylesheet defines them separately.

### Neutral

- **Paper** is the inherited token name for the dark canvas; it no longer means a light surface.
- **Surface**, **Sage**, **Navigation Active**, **Composer**, and **Summary** distinguish working regions through subtle tone changes.
- **Ink** is now light text; **Muted** supplies supporting copy; **Line** separates controls and panels.
- **Map** is the pane background while MapLibre loads the OpenFreeMap dark style.

## Typography

The platform sans-serif stack is shared by Chinese and English, with PingFang SC and Microsoft YaHei fallbacks. The former serif display asset is not the active heading face. The welcome title uses fluid display sizing; page titles are compact and left aligned. Supporting welcome copy uses 15px with a 1.9 line height, increasing to 18px on wide screens and reducing to 13px in compact layouts. Navigation uses 14px, card titles 17px, primary buttons 12px, and metadata 9–11px. On mobile the welcome title is 30px and form inputs reach 16px. Allow bilingual labels to wrap instead of forcing desktop-length English into Chinese-sized slots.

## Layout

Desktop is a fixed-height studio. The body fills 100dvh and does not scroll; the central content pane scrolls independently. A 216px left rail carries the brand, four destinations, new-trip action, account entry, and footer. The fixed top toolbar is 66px high. The remaining workspace divides equally between central content and the right map. The central pane reserves 31px at the bottom for mode status; the map continues to the bottom edge.

The welcome screen centers an 83px circular mark, title, short introduction, prompt chips, and discovery link above a bottom composer. It has a minimum height of 530px. Subsequent planning, discovery, itinerary, and saved pages use the central pane with 26px horizontal padding. Planner summaries now flow below content; there is no extra summary sidebar. The four-step progress row remains visible. Destination, selection, and saved grids default to two columns.

At 1600px and above, the rail becomes 240px and central padding expands. Between 761px and 1100px, the rail becomes 182px; toolbar trip-context links hide, grids and forms become one column, and progress labels stack. At 760px and below, the rail becomes a fixed 62px bottom navigation bar, the toolbar becomes 57px, and central content spans the width. The map hides until the toolbar toggle opens it between the top and bottom navigation bars. Mode status occupies 25px above bottom navigation. Mobile saved cards use one column; form rules specify two columns. These are source media rules and require browser verification for final rendered behavior across inherited CSS.

## Elevation & Depth

The studio uses tonal layering and thin borders. The composer has no shadow and gains a one-pixel focus-within outline. Map search uses a small shadow (`0 3px 15px #0002`); city markers use a slightly larger shadow (`0 3px 16px #0005`). Dark translucent map controls preserve geographic context beneath them. Dialogs use a dark surface and black translucent backdrop; the inherited dialog shadow remains.

## Shapes

Navigation rows and content panels have compact rounded corners. The composer is broadly rounded, with a circular 40px send action. Prompt chips, toolbar links, and new-trip controls use pill silhouettes. The desktop map has only its upper-left corner rounded; the mobile map is square to the viewport. User requests use a speech-bubble shape with a tight lower-right corner. Destination photos retain modest rounded clipping.

## Components

### Navigation and Toolbar

The rail retains the bilingual SylvaPlan / 村小丫 brand and four destinations: new conversation, discovery, planning, and saved trips. Active rows use charcoal-green fill with bright text. The new-trip control sits below the navigation group. The top toolbar contains conversation context, trip links where space allows, locale selection, and a light create-trip action. The mobile map toggle exposes its expanded state.

### Conversation Composer

A dark bordered textarea panel sits below the welcome content. City and duration selectors share its lower row with a pale circular send button. A short note explains that a request is first organized and confirmed. The textarea is 58px high, does not resize, and uses group-level focus. Prompt chips are dark and outlined, with a greener hover border.

### Buttons and Fields

Primary task actions use Action Green with dark text; secondary actions use a dark green surface and visible border. Standard task buttons have a 42px minimum height, rising to 44px on mobile. Existing keyboard focus and disabled opacity remain part of the base controls. Dark input styling is declared in the final stylesheet; inherited selector specificity must be checked when adding fields.

### Planning, Cards, and State

Four stages cover requirements, villages, experiences, and itinerary. Current-step circles are pale green with dark numerals. The original request remains visible as a bubble before editable requirements. Selection states use filled pale-green controls or bordered green panels. Destination photos remain within compact cards rather than forming a hero. Food, stays, and activities retain selection controls and readable descriptions. Trip summaries are static dark panels beneath the working content. Sticky action rows stay inside the central scrolling pane.

Loading, empty, unavailable, form-error, save/sync failure, and non-AI fallback states must remain visible. Template schedules retain excess choices in a pending-items panel instead of silently dropping them. Budget numbers represent user limits; displayed resource prices are references, not verified quotes.

### Map Context

The map uses local MapLibre assets and the remote OpenFreeMap dark style. City buttons and a city selector focus the map; reset returns to the wider region. Markers use reference coordinates for five city centers. They do not represent verified village coordinates, selected itinerary stops, directions, or optimized routes. Map attribution stays visible. WebGL, script, tile, and initial-load failures expose a fallback message while the central planner remains usable. On mobile a toolbar toggle shows or hides the map pane.

### Bilingual Behavior and Motion

Locale changes update interface text and accessible labels in place, store the preference, and update document language. User input, canonical API values, and content marked `translate="no"` retain their original values. Map city labels also update. Generated live prose can retain its generation language. Existing reduced-motion rules disable CSS animation and transition; map focus motion is marked nonessential in its API call.

## Do's and Don'ts

### Do:
- **Do** treat public/studio.css as the final visual authority after styles.css and workspace.css.
- **Do** distinguish the interactive basemap from city-scope reference markers.
- **Do** preserve typed requests, selections, and canonical API values during locale changes.
- **Do** keep processing, empty, failure, pending-item, and fallback states legible.
- **Do** label fixture/rules output honestly and retain photo-context labels.

### Don't:
- **Don’t** restore the former light hero-and-overlapping-composer homepage.
- **Don’t** describe map markers as verified village locations, route geometry, or navigation directions.
- **Don’t** present portfolio fixture generation as a live DeepSeek result.
- **Don’t** claim pixel fidelity, responsive browser verification, production deployment, or individual contribution from this documentation.

## Daylight theme — 2026-09-26

The same three-pane workspace now defaults to daylight for new visitors: warm white surfaces (#fafaf7), forest green actions, pale botanical selection states. `public/daylight.css` applies after studio styles under `data-theme="light"`; dark remains available through the toolbar sun button. The selection persists under `village-muse-theme` and does not rerender forms or itinerary state. MapLibre switches between OpenFreeMap Positron and Dark styles. Browser visual acceptance is still outstanding.


## Public directory — 2026-09-26

Public destination cards are text-led, with source batch, administrative region and missing-amenity status, without illustrative photos. Discovery defaults to public records with province/region/search filters and 24-record incremental loading. Sample experiences retain their own filter and explicit labels. City pickers are searchable, including Chinese and pinyin. Directory-only selections can proceed to a visit draft; details and exports retain provenance.


## Composer controls — 2026-09-27

Recognized destination names display in the active language; canonical region names remain the planning identifiers. Partial input stays untouched. Both composer fields use 44 px minimum containers and 42 px inner controls, zero inherited top margins, a shared baseline and a custom select chevron. Field styles in catalogue.css override the former standalone form styles; mobile input text is 16 px.
