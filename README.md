# Gamescom 2026 Side Events — page for garna.io

A single page listing every Gamescom 2026 side event (Cologne, 23–30 August), grouped by day.
Built to replace the PDF link in the LinkedIn outreach — people land on garna.io instead of a file.

## Files

| File | What it is |
|---|---|
| `index.html` | Standalone preview. Open it in a browser — full page including a rebuilt garna.io header and footer. Use this for review and sign-off. |
| `section.html` | **The part that ships.** Page body only, no header/footer. Drop into the Astro layout between the real `<Header />` and `<Footer />`. |
| `styles.css` | All styles. Sections marked `SITE CHROME` are preview-only and can be deleted in production. |
| `script.js` | Loads the schedule, builds the day navigator, renders the cards. |
| `events-data.js` | Fallback snapshot of all 105 events. Only used if the live sheet cannot be reached. |

## How the content updates

The page reads a Google Sheet at runtime — **no deploy needed to change events**.

Sheet: [Garna_Gamescom_2026_Events_SITE](https://docs.google.com/spreadsheets/d/1W6bDYdlw_PkTakAaE8MEJHmF57ucJwYo5xmKfZSJ3NE/edit)

Add, edit or delete a row → refresh the page → it is there. Sharing must stay
**Anyone with the link · Viewer**, otherwise the page silently falls back to the bundled snapshot.

### Column contract

Columns are matched **by header name**, so you can reorder them, but do not rename them.

| Column | Required | Notes |
|---|---|---|
| `date` | yes* | `YYYY-MM-DD`. Leave empty for events with no announced date — they land in a **TBA** tab. |
| `end_date` | no | For multi-day events. The event then appears on every day of the range. |
| `name` | yes | Rows without a name are skipped. |
| `time` | no | Free text, e.g. `17:00–21:00`, `From 13:00`, `All day`. Used to sort within a day. |
| `description` | no | One or two sentences. |
| `location` | no | Shown with a pin icon. |
| `access` | no | Controls the badge and the button label. See table below. |
| `access_note` | no | Small print next to the badge, e.g. `Organiser approval required`. |
| `link` | no | Must start with `http://` or `https://`, otherwise the button is disabled. |
| `featured` | no | `1` adds a lime border and a **Worth your time** tag. |
| `priority_score` | no | Internal ranking. Not shown on the page — used as a tiebreaker when two events start at the same time. |

### `access` values

| Value | Badge | Button |
|---|---|---|
| `free` | Free (lime) | Register |
| `paid` | Paid | Get tickets |
| `application` | Apply | Apply |
| `invite` | Invite only | Details |
| `badge` | With gamescom badge | Details |
| `open` | Open entry (lime) | Details |
| `tba` | TBA | Details |
| `closed` | Closed (card dimmed) | Details |

Anything else falls back to a neutral badge with a **Details** button — nothing breaks.

## Integration into garna.io

1. Copy `section.html` into the page component.
2. Include `styles.css` (drop the two `SITE CHROME` blocks — the site already has a header and footer),
   `events-data.js`, then `script.js`.
3. Suggested route: `/en/gamescom-2026-side-events` — update `<link rel="canonical">` and the Open Graph
   URL in `index.html` if it lands somewhere else.

Styling uses the live garna.io tokens: Manrope, `#101010` background, `#a1a1aa` body text,
`#CBF300` accent. No Tailwind dependency — plain CSS, so it will not collide with the existing build.

## Before publishing

- [ ] Drop the PDF at `assets/Garna-Gamescom-2026-Side-Events.pdf` — the hero button links there.
- [ ] Confirm where **Book a demo** should point. Currently `mailto:hello@garna.io`; swap for the real
      demo form or the calculator once decided.
- [ ] Refresh the event data in mid-August — several rows still say
      *"Registration not yet published as of 30 Jul 2026"*.
- [ ] Set a proper OG image if we want a branded LinkedIn preview instead of the generic garna.io one.

## Behaviour notes

- The day tabs auto-select **today** if someone opens the page during the show, otherwise 23 August.
- Deep links work: `…/gamescom-2026-side-events#day-2026-08-26` opens straight on that day.
- Multi-day events are clamped to the 23–30 August window and tagged *Runs across several days*.
- If the sheet is unreachable the page still renders from the snapshot and says so in a note under the list.
