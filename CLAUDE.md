# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DTTA (displayed name) / HTPA (repo name): a local, offline-capable PWA for a single
Android phone that logs workouts (exercises/sets/reps/weight/RPE) and bodyweight over
time, and surfaces progress (per-exercise trend charts, personal records) back to the
user. Single-user, no backend, no cloud sync. Vanilla JS, no framework, no build step.

Full design spec: `docs/superpowers/specs/2026-10-15-htpa-training-tracker-design.md`.

## Commands

- Run locally: `node server.js` — serves the app at `http://localhost:8000` (also
  reachable from a phone on the same network via the machine's LAN IP, for installed-PWA
  testing).
- No build step, no test suite, no linter. Testing is manual: load in a browser and/or
  on the phone as an installed PWA.

## Deployment (important — do not hand-edit around this)

Hosted on GitHub Pages. Deploy = commit + push to `main`; Pages rebuilds automatically
and the installed PWA picks up changes on next open.

A tracked git hook (`core.hooksPath=.githooks`, set at repo level since `.git/hooks`
isn't version-controlled) runs on every commit:

- `.githooks/pre-commit` checks whether the commit touches any app file (anything other
  than `service-worker.js`, `.githooks/*`, `docs/*`). If so, it rewrites `CACHE_NAME` in
  `service-worker.js` to a fresh timestamp value and stages that change into the same
  commit automatically.

This is what makes the installed PWA's service worker actually pick up new files after a
deploy — without a changed `CACHE_NAME`, the old cache would keep being served. Never
hand-edit `CACHE_NAME` or disable/bypass this hook; let it run. After every committed
change, push to `origin` so Pages rebuilds and the phone PWA updates.

## Architecture

Single-page app, one `#app` container re-rendered on tab switch. `app.js` is the only
module that knows about tab state — it owns `activeTab`/`editingSession` and calls the
matching `render*View()` function into a fresh `viewContainer` on every switch. No
router, no virtual DOM: each view's `render*View()` tears down and rebuilds its own DOM
each call.

Strict layering:
- `store.js` — the only module that touches `localStorage`. All data (`sessions`,
  `bodyweight`) lives in one JSON blob under key `htpa_training_v1`. Exposes CRUD,
  export/import (full-data JSON backup, used by History's Export/Import buttons), and
  derived-data getters (`distinctExercises()`, `getProgressPoints()`, `getAllPRs()`,
  `getBodyweightPoints()`, `getDurationPoints()`, `getCaffeinePoints()`,
  `getWeeklyVolumePoints()`, `daysSinceLastSession()`,
  `mostRecentlyTrainedExerciseKey()`, `getLastSetForExercise()`, `getMostRecentSession()`
  — the latter three share a private `sessionsNewestFirst()` helper that reverses
  insertion order *before* sorting by date, since `date` is day-only and a plain sort
  falls back to oldest-first insertion order when two sessions share a date). Has zero
  DOM knowledge.
- `js/*View.js` — one per tab (Log/History/Progress/Records/Bodyweight), each owns its
  own DOM rendering and never reads/writes `localStorage` directly, only through `Store`.
- `chart.js` — hand-rolled inline-SVG line chart, shared by Progress and Bodyweight
  views. No charting library. A point may carry an optional `pointColor` to override the
  line's color for just that dot (used by Progress to color points by RPE); the
  line/area always stay the series `color`.
- `icons.js` — hand-rolled inline-SVG tab icons (same primitives style as `chart.js`,
  not an icon font/library or emoji), used by `app.js`'s tab nav.

The Log form (`logView.js`) tracks its own "dirty" state (any real user edit — typing,
adding a set/exercise) via a delegated `input` listener plus explicit flags on the
add-set/add-exercise buttons, and reports it up to `app.js` through an `onDirtyChange`
callback; `app.js` confirms before a tab switch discards unsaved Log changes. Every fresh
`renderLogView()` call resets this to clean — don't remove that reset, or a stale dirty
flag from a previous visit can wrongly block an unrelated later switch.

When adding a new exercise name to a session, `logView.js` auto-prefills still-empty
weight/reps fields from `Store.getLastSetForExercise()` (never RPE — that's treated as
subjective to today's session, not something to carry over). "Repeat last session" reuses
the same lookup per exercise when rebuilding the exercise list from
`Store.getMostRecentSession()`. Keep that no-RPE-carryover behavior if you touch either.

Data model nuance that affects a lot of the logic: **exercises are not a normalized
entity** — just free-text strings on each set entry. Anywhere the app needs "the list of
known exercises" (autocomplete, Progress picker, Records), it's derived at read time by
scanning `sessions`, grouping names case/whitespace-insensitively (trim+lowercase as the
key) but displaying the most-recently-typed casing for that group (see
`normalizeKey()`/`distinctExercises()` in `store.js`). There is no exercise table to keep
in sync, no rename/merge tooling, and no cleanup needed on delete — derived views simply
stop showing an exercise once no session references it. Keep new features consistent
with this derive-at-read-time pattern rather than introducing a separate exercise
registry.

Similarly, PRs and progress points are computed on the fly from `sessions` (best set =
highest weight, ties broken by higher reps — see `bestSetInSets()`), not cached/stored.

`sessions` and `bodyweight` are independent top-level arrays (bodyweight isn't nested
under sessions), and both allow multiple entries on the same date with no dedup.

Dates are stored/compared as `YYYY-MM-DD` strings (lexicographic sort = chronological
sort). `todayIso()` in `store.js` deliberately builds this from local
`Date#getFullYear/Month/Date`, not `toISOString()`, to avoid landing on the wrong day for
users not at UTC+0 — don't swap that for a UTC-based date helper.
