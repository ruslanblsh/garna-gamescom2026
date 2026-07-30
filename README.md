# Gamescom 2026 Side Events — page for garna.io

A one-page guide to every Gamescom 2026 side event in Cologne (23–30 August), grouped by day.

It replaces the PDF we were attaching in LinkedIn outreach: people land on garna.io instead of
downloading a file, and the content stays current without anyone touching the code.

**Live preview:** open `index.html` in a browser, or use the GitHub Pages link on this repo.

---

## Table of contents

1. [How it works](#how-it-works)
2. [Files in this repo](#files-in-this-repo)
3. [Running it locally](#running-it-locally)
4. [Updating the events (no code needed)](#updating-the-events-no-code-needed)
5. [Publishing on garna.io](#publishing-on-garnaio)
6. [Design tokens and styling](#design-tokens-and-styling)
7. [Before it goes live](#before-it-goes-live)
8. [Troubleshooting](#troubleshooting)
9. [Who to ask](#who-to-ask)

---

## How it works

There is no backend and no build step. It is plain HTML, CSS and one JavaScript file.

```
Google Sheet  ──gviz/tq (fetch on page load)──►  script.js  ──►  rendered day-by-day list
     │
     └── if unreachable ──► events-data.js (bundled snapshot) ──► same rendered list
```

1. On load, `script.js` fetches the Google Sheet through the public `gviz/tq` endpoint.
2. It groups events by day, expands multi-day ones across their date range, sorts them by start
   time, and renders the day tabs plus the card list.
3. If the fetch fails for any reason — sheet moved, sharing revoked, someone offline — it falls
   back to `events-data.js`, a snapshot of all 105 events bundled with the page. The page never
   comes up empty; a note under the list says which source is in use.

Because the sheet is read on every load, **editing a row in the sheet changes the live page.**
No deploy, no PR, no developer needed.

---

## Files in this repo

| File | What it is | Ships to garna.io? |
|---|---|---|
| `section.html` | **The part that ships.** Page body only — hero, day navigator, event list, payroll block. No header or footer. | Yes |
| `styles.css` | All styles. Two blocks are marked `SITE CHROME` — those are preview-only. | Yes (minus the `SITE CHROME` blocks) |
| `script.js` | Data loading, day grouping, rendering, mobile menu. | Yes |
| `events-data.js` | Fallback snapshot of all 105 events. | Yes |
| `index.html` | Standalone preview. Same body as `section.html`, wrapped in a rebuilt garna.io header and footer so the file opens on its own. | No |
| `PLAN.md` | Design and architecture notes from the build. Background reading, not instructions. | No |

`index.html` and `section.html` contain the same `<main>` block. **If you change one, change the
other** — or delete `index.html` once the page is integrated and keep `section.html` as the single
source of truth.

---

## Running it locally

Double-clicking `index.html` works, but the browser will block the request to Google Sheets from a
`file://` origin, so you will see the snapshot with a note saying the live sheet could not be
reached. That is expected.

To see the live data path, serve the folder over HTTP:

```bash
cd garna-gamescom2026
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## Updating the events (no code needed)

**Sheet:** [Garna_Gamescom_2026_Events_SITE](https://docs.google.com/spreadsheets/d/1W6bDYdlw_PkTakAaE8MEJHmF57ucJwYo5xmKfZSJ3NE/edit)

Add a row, edit a row, delete a row, then reload the page. That's the whole workflow.

Two rules:

- **Sharing must stay "Anyone with the link · Viewer".** If it gets restricted, the page silently
  falls back to the snapshot and stops reflecting edits.
- **Do not rename the header row.** Columns are matched by header name, so you can reorder or
  insert columns freely, but a renamed header means that field stops being read.

### Columns

| Column | Required | What it does |
|---|---|---|
| `date` | yes* | `YYYY-MM-DD`. Leave empty for an event with no announced date — it goes into a separate **TBA** tab. |
| `end_date` | no | For multi-day events. The event then shows on every day of the range and gets a "Runs across several days" note. |
| `name` | yes | Rows with an empty name are skipped entirely. |
| `time` | no | Free text: `17:00–21:00`, `From 13:00`, `All day`, `Continuous`. The first `HH:MM` found is used for sorting; rows without one sort to the top of the day. |
| `description` | no | One or two sentences. Shown under the title. |
| `location` | no | Shown with a pin icon. |
| `access` | no | Sets the badge colour and the button label. Values below. |
| `access_note` | no | Small print next to the badge, e.g. `Organiser approval required`. |
| `link` | no | Must start with `http://` or `https://`. Anything else is rejected and the button renders disabled as "No link yet". |
| `featured` | no | `1` gives the card a lime border and a **Worth your time** tag. |
| `priority_score` | no | Internal ranking, never shown. Used only to break ties when two events start at the same time. |

### `access` values

| Value | Badge shown | Button label |
|---|---|---|
| `free` | Free *(lime)* | Register |
| `paid` | Paid | Get tickets |
| `application` | Apply | Apply |
| `invite` | Invite only | Details |
| `badge` | With gamescom badge | Details |
| `open` | Open entry *(lime)* | Details |
| `tba` | TBA | Details |
| `closed` | Closed *(card dimmed to 55%)* | Details |

Any other value falls back to a neutral badge and a **Details** button. Nothing breaks, so a typo
is cosmetic rather than fatal.

### Refreshing the bundled snapshot

The snapshot in `events-data.js` only matters when the sheet is unreachable, so it does not need to
track every edit. Worth regenerating before a big send. Export the sheet as CSV and convert:

```bash
node -e '
const fs=require("fs");
const rows=fs.readFileSync("events.csv","utf8").trim().split(/\r?\n/);
// parse with your CSV lib of choice, then:
// fs.writeFileSync("events-data.js","window.GC_EVENTS_SNAPSHOT="+JSON.stringify(data)+";");
'
```

Field names in the snapshot match the sheet columns, except `featured` is a boolean and
`priority_score` is called `score`.

---

## Publishing on garna.io

garna.io is Astro + Tailwind. This page deliberately uses **plain CSS with no Tailwind classes**,
so it cannot collide with existing utility styles.

1. Copy the `<main>` block from `section.html` into a new page component.
2. Wrap it in the standard layout, between the real `<Header />` and `<Footer />`.
3. Include, in this order:
   ```html
   <link rel="stylesheet" href="/styles/gamescom.css">
   <script src="/scripts/gamescom-events-data.js"></script>
   <script src="/scripts/gamescom.js" defer></script>
   ```
4. Delete the two `SITE CHROME` blocks from `styles.css` — the site already has a header and footer.
   They are clearly marked with comment banners; everything between them can go.
5. Suggested route: `/en/gamescom-2026-side-events`. If it lands elsewhere, update
   `<link rel="canonical">` and `og:url` in the `<head>`.

The page needs Manrope loaded. The main site already loads it, so nothing extra is required — the
`<link>` in `index.html` is only there for the standalone preview.

### Behaviour worth knowing about

- **Day tabs auto-select today** if someone opens the page during the show; otherwise 23 August.
- **Deep links work:** `…/gamescom-2026-side-events#day-2026-08-26` opens straight on that day, and
  the hash updates as you switch tabs. Handy for sending someone a specific day.
- **Multi-day events are clamped** to the 23–30 August window. `gamescom camp` runs 24–31 August in
  the sheet but stops at the 30th on the page. To change the window, edit `CONFIG.windowStart` and
  `CONFIG.windowEnd` at the top of `script.js`.
- **Sheet ID lives in one place:** `CONFIG.sheetId` at the top of `script.js`.
- Everything from the sheet is HTML-escaped before rendering, and only `http`/`https` links make it
  into an `href`. A malformed row cannot inject markup.

---

## Design tokens and styling

Pulled from the live garna.io build so the page sits flush against the real header and footer.

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#101010` | page background |
| `--surface` | `#0c0c0c` | dropdowns, raised panels |
| `--card` | `rgba(255,255,255,.04)` | event cards |
| `--line` | `rgba(255,255,255,.08)` | borders and dividers |
| `--text` | `#ffffff` | headings |
| `--muted` | `#a1a1aa` | body copy |
| `--faint` | `#71717a` | metadata, small print |
| `--accent` | `#CBF300` | buttons, active day, featured cards |
| `--accent-soft` | `rgba(203,243,0,.08)` | tinted backgrounds |
| Font | Manrope 400–800 | everything |

All of these are CSS custom properties in `:root` at the top of `styles.css`. Changing the accent
across the whole page is a one-line edit.

**Breakpoints:** 1000px (header collapses to a burger menu) and 760px (event rows go single-column,
time moves above the card in lime, buttons go full width).

**Motion:** cards fade in on scroll via `IntersectionObserver`. All animation is disabled under
`prefers-reduced-motion`.

---

## Before it goes live

- [ ] **PDF.** The hero's second button links to `assets/Garna-Gamescom-2026-Side-Events.pdf`.
      Drop the file there or repoint the link — right now it 404s.
- [ ] **Book a demo destination.** Currently `mailto:hello@garna.io`. Ruslan is confirming whether
      it should go to a demo form or the EOR calculator instead. One `href` in the payroll block.
- [ ] **Refresh the data in mid-August.** Six rows still read "Registration not yet published as of
      30 Jul 2026", and two events have no date at all.
- [ ] **OG image.** Currently borrows the generic garna.io preview image. A branded one would look
      better in LinkedIn, since that is where all the traffic comes from.
- [ ] **Analytics.** No tracking on the page at all. Add whatever the rest of garna.io uses if we
      want to measure the outreach.

---

## Troubleshooting

**The page shows old events after I edited the sheet.**
Hard-refresh (Cmd/Ctrl+Shift+R). If it persists, check the note under the event list — if it says
the live sheet could not be reached, the sharing setting has probably been changed. It must be
"Anyone with the link · Viewer".

**Everything shows but the buttons say "No link yet".**
The `link` column is empty or does not start with `http://` or `https://`.

**An event shows on the wrong day, or not at all.**
Check the `date` format — it must be `YYYY-MM-DD`. Also check it falls inside the window in
`CONFIG` (23–30 August 2026); anything outside is dropped.

**A whole day tab is missing.**
Day tabs are generated from the data, so a day with zero events simply does not appear.

**Console shows a CORS error against docs.google.com.**
You are opening the file over `file://`. Serve it over HTTP — see [Running it locally](#running-it-locally).

---

## Who to ask

- **Content, events, copy** — Ruslan (rbl@mediacube.io)
- **Sheet access** — Ruslan
- **Where the page lives on garna.io** — Evgeniy Solonovich (CDO)
