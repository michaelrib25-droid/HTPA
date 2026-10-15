# HTPA – Training/Workout Tracker App (Design)

## Purpose

A local, offline-capable PWA for a single Android phone that logs workouts
(exercises/sets/reps/weight/RPE) and bodyweight over time, and surfaces
progress (per-exercise trend charts, personal records) back to the user.

Explicitly **not** in scope: fixed weekly training schedules/routines (the
user trains freeform, not on a repeating template), social features,
multi-user support, cloud sync, nutrition tracking.

Technical cornerstones are reused directly from the HNSA project
(`docs/superpowers/specs/2026-10-14-hnsa-stundenplan-design.md` there):
vanilla JS, no framework, no build step, `localStorage` persistence, one
responsibility per JS module, PWA manifest + service worker for offline/
installability, GitHub Pages hosting, a local `server.js` for dev/phone
testing on the same network.

## Data model

Stored in `localStorage` under one key (`htpa_training_v1`) as a single
JSON object:

```js
{
  sessions: [
    {
      id: "uuid",
      date: "2026-10-15",            // ISO date
      entries: [
        {
          exercise: "Bench Press",    // free text, exactly as typed
          sets: [
            { weight: 80, reps: 5, rpe: 8 }   // rpe is optional (may be omitted/null)
          ]
        }
      ]
    }
  ],
  bodyweight: [
    { id: "uuid", date: "2026-10-15", weight: 78.5 }
  ]
}
```

Exercises are **flat/string-keyed, not a normalized library** — no separate
exercise entity with its own id. Anywhere the app needs "the list of known
exercises" (autocomplete, the Progress picker, Records), it derives that
list at read time by scanning `sessions` for distinct exercise names,
grouped case/whitespace-insensitively (trim + lowercase for matching) but
displayed using the most-recently-typed casing for that name. There is
nothing to keep in sync and nothing to clean up when an exercise falls out
of use — it simply stops appearing once no session references it.

`sessions` and `bodyweight` are independent arrays. Bodyweight is logged
regardless of whether a workout happened that day, so it isn't nested
under sessions. Multiple entries on the same date are allowed in both
arrays — no dedup/merge logic, the user controls their own entry habits.

## Components / file structure

```
HTPA/
  index.html          Entry page; loads manifest.json, service-worker.js, js/app.js
  manifest.json        PWA manifest (already in place from the hello-world test)
  service-worker.js    Offline cache (asset list extended for css/js files below)
  css/styles.css        Styling (tab nav, forms, chart, lists)
  js/
    app.js              Entry point: initializes store, renders the active tab,
                         wires the 5-tab nav
    store.js             Reads/writes localStorage; CRUD for sessions & bodyweight;
                         derives distinct exercise names; computes PRs
    chart.js             Hand-rolled minimal inline-SVG line chart, reused by both
                         the Progress (per-exercise) and Bodyweight trend views
    logView.js           "Log" tab: new workout session entry (date, exercises,
                         sets) — workout-only, no bodyweight here
    historyView.js       "History" tab: session list, expand/edit/delete
    progressView.js      "Progress" tab: exercise picker + chart.js
    recordsView.js       "Records" tab: PR per exercise
    bodyweightView.js    "Bodyweight" tab: entry form + trend chart (via chart.js)
  icons/                (reused from the hello-world placeholder)
  server.js             Local dev server (same pattern as the hello-world test)
  .githooks/
    pre-commit           Auto-bumps CACHE_NAME in service-worker.js (see Deployment)
```

Each JS module has exactly one responsibility; `store.js` has no knowledge
of the DOM/UI, and view modules never touch `localStorage` directly — only
through the `store.js` API. `app.js` is the only module that switches
between tabs; it re-renders into a single `#app` container, the same
single-page pattern HNSA used.

## Navigation

Five tabs: **Log / History / Progress / Records / Bodyweight**, each its
own screen, switched via `app.js`. Bodyweight has its own tab (rather than
being folded into Log/Progress) so that entering a weigh-in never requires
engaging with the workout-logging form, matching the fact that bodyweight
is modeled independently of training sessions.

## Interaction flow per tab

- **Log:** Pick date (defaults to today) → "+ Add exercise" → type exercise
  name (`<datalist>` autocomplete sourced from `store.distinctExerciseNames()`)
  → "+ Add set" rows (weight / reps / optional RPE) per exercise → repeat for
  more exercises → Save writes one `sessions` entry.
- **History:** Reverse-chronological session list, each row collapsed to a
  one-line summary (date, exercise count, total sets). Tap to expand and see
  the full breakdown; expanded view offers Edit (reopens in the Log form,
  pre-filled, keeps the same `id`) and Delete.
- **Progress:** Dropdown of distinct exercise names → `chart.js` line chart,
  one point per session that exercise appears in, y = best (max) weight that
  session (ties broken by higher reps, same rule as Records below); each
  point's title/tooltip shows that set's `weight × reps` so that context
  isn't lost even though only weight is plotted.
- **Records:** List of every distinct exercise with its all-time PR (max
  weight, ties broken by higher reps), alphabetical.
- **Bodyweight:** Form (date, defaults today; weight) → Save appends to the
  `bodyweight` array. Below it, a `chart.js` trend chart of all bodyweight
  entries over time.

## Edge cases

- **First start (no sessions/bodyweight yet):** each view shows an
  empty-state hint ("No sessions logged yet — add one in Log.") instead of a
  blank screen.
- **Exercise name variants** ("Bench" vs "Bench Press", differing
  whitespace/case): grouped via trim+lowercase match for autocomplete/
  Progress/Records; displayed using the most-recently-typed casing for that
  group. No rename/merge tooling is built — acceptable for a single-user app.
- **Multiple sessions or bodyweight entries on the same date:** allowed,
  no special handling.
- **Deleting a session:** exercise names/PRs/progress are all derived at
  read time from `sessions`, so deletion needs no separate cleanup step —
  an exercise with no remaining sets simply stops appearing anywhere.
- **RPE is optional** per set.
- **`localStorage` unavailable** (e.g. private browsing): no special-cased
  handling, same as HNSA — the app just loses persistence for that session.
  Not worth engineering around since an installed PWA always runs in normal
  (non-private) mode.

## Testing

No automated test suite, same reasoning as HNSA: disproportionate for an
offline single-user app. Manual testing via `node server.js` locally, plus
live testing on the phone over the same network/installed PWA.

## Deployment automation

A git hook tracked in the repo (`core.hooksPath=.githooks`, since the
default `.git/hooks` directory isn't version-controlled) — `.githooks/
pre-commit` — runs on every commit. If the commit touches any app file, the
hook rewrites `CACHE_NAME` in `service-worker.js` to a fresh value and
stages that change into the same commit automatically.

Effect: when the user asks for a commit+push of an update, the cache
version bumps as part of that commit without either party having to
remember to edit it by hand. After pushing, GitHub Pages redeploys, and the
next time the installed app is opened, Chrome's background service-worker
check detects the changed script and refreshes the cached app — no
reinstall needed.
