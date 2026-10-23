# Next car

A public, static tracker for Jason's next-car decision. Priorities, a ranked shortlist, live asking prices, and an off-market log.

GitHub Pages can serve it from the `main` branch root. There is no build step and no GitHub Actions workflow.

## Publish

1. On GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Branch: `main`. Folder: `/ (root)`.
4. Save.

The site is `index.html` plus `css/`, `js/`, and `data/`. `.nojekyll` is present so Pages serves those files as-is and does not run Jekyll.

Open the site over HTTP. `fetch` of the JSON files does not work from a `file://` URL. Locally:

```bash
python3 -m http.server 8765
```

Then visit `http://127.0.0.1:8765/`.

## What the page shows

1. **Where I'm headed** — driving fun and driver assist first, then the price of a roughly two-year-old car, with AWD required. An EV has to road-trip, and 800V charging is preferred.
2. **Shortlist** — six cars, ranked, with fit notes, pros and cons, range or MPG, and cost per mile where a figure is real.
3. **Available vehicles** — cards rendered from `data/model3.json`, `data/q6.json`, and `data/others.json`. Each card has a link, asking price, price-history sparkline, miles, dealer and city, and, when the log has them, a motivation score (Low / Medium / High) and a timing call (BUY NOW / WATCH / WAIT). Filter by model.
4. **Off the market** — `data/gone.json`.

The “Last updated” date is `lastUpdated` in `data/meta.json`.

Cost per mile uses one public baseline: **17¢ per mile at 28 MPG** (about $4.76 a gallon). Cars with an MPG figure are scaled from it (`17¢ × 28 ÷ mpg`). The Model 3’s ~12¢ per mile is a winter road-trip estimate, kept separate from that scaling. The i4, Ioniq 5, and Q6 e-tron do not get an invented cents-per-mile number.

## Privacy

This site is public. Do not add:

- loan balances, monthly payments, APR, payoff, or negative equity
- a home address or any ZIP code
- negotiation targets or other personal financial figures

Asking prices, public doc fees, dealer names, and dealer cities are fine. A few original listing URLs contain a dealer ZIP in the path. Those URLs are copied unchanged so the link still opens. Displayed dealer, city, note, and status fields do not include ZIP codes.

## Update the data

Edit the JSON files, set `data/meta.json` `lastUpdated` to the check date (`YYYY-MM-DD`), and commit to `main`. Reload the site. Nothing has to be compiled.

`schemaVersion` is `1`.

### File envelope

`model3.json`, `q6.json`, and `others.json` share this shape:

```json
{
  "modelId": "model3",
  "label": "Tesla Model 3",
  "search": "Human-readable search window.",
  "checked": "2026-10-22",
  "listings": []
}
```

`checked` is the date of the latest pass for that file. The page marks a car “Last seen” when `lastSeen` is earlier than `checked`.

### Listing

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | VIN, or a slug when the source had no VIN. |
| `vin` | string or null | Vehicle identification number. |
| `year` | number | Model year. |
| `make`, `model` | string | Display names. |
| `modelId` | string | Filter key: `model3`, `q6`, `i4`, `ioniq5`. |
| `trim` | string or null | Trim. |
| `miles` | number or null | Odometer. |
| `price` | number or null | Tracked asking price in USD, whole dollars. |
| `priceBasis` | string | `vehicle` (doc fee, when present, is separate), `with-fees` (the price already includes listed fees), or `with-shipping`. |
| `docFee` | number or null | Doc fee published beside the price. Omit it from the total when `priceBasis` is `with-fees`. |
| `url` | string | Public listing link. |
| `dealer` | string | Dealer or seller name, without a street or ZIP. |
| `city` | string or null | City only. |
| `color`, `wheels` | string or null | Optional description. |
| `drivetrain` | string | `AWD` or `RWD`. |
| `title` | string | `clean`, `branded`, `buyback`, or `unknown`. |
| `cpo` | boolean | Certified pre-owned. |
| `fit` | string | `match`, `near-miss`, `over-cap`, `unverified`, `stale`, or `excluded`. |
| `statusNote` | string or null | Why the car sits in that fit bucket. |
| `priceHistory` | array | `{ "date": "YYYY-MM-DD", "price": number }`, oldest first. One point still draws a sparkline. If this array is empty and `price` is set, the page plots that single price. |
| `firstSeen`, `lastSeen` | string | Observation window, `YYYY-MM-DD`. |
| `note` | string or null | Extra public listing note. |
| `motivation` | object or null | `{ "score": "Low" \| "Medium" \| "High", "reason": string, "asOf": "YYYY-MM-DD" }`. |
| `timing` | object or null | `{ "call": "BUY NOW" \| "WATCH" \| "WAIT", "reason": string, "asOf": "YYYY-MM-DD" }`. |

`fit` values:

- `match` — meets the search.
- `near-miss` — right car, above the price target, or just over a cap.
- `over-cap` — over the watch price.
- `unverified` — a lead that is still short a VIN, title, or direct page.
- `stale` — old aggregator post.
- `excluded` — wrong drivetrain, title, miles, or model.

### Off-market log

`gone.json`:

```json
{
  "note": "How a car qualifies as gone.",
  "updated": "2026-10-22",
  "entries": []
}
```

Each entry uses `id`, `vin`, `year`, `make`, `model`, `modelId`, `trim`, `miles`, `color`, `dealer`, `city`, `url`, `firstSeen`, `lastSeen`, `title`, plus:

| Field | Type | Meaning |
| --- | --- | --- |
| `daysListed` | number | Days from first seen to last seen in this tracker. `0` means the same day. |
| `firstPrice`, `lastPrice` | number or null | Asking price at the ends of that window. |
| `priceCuts` | number | Count of recorded cuts. |
| `cutAmounts` | number[] | Size of each cut, in dollars. |
| `comparable` | boolean | Met the search (year, AWD, clean title, about 25,000 miles or fewer). |
| `outcome` | string | What happened: sold, page missing, over the price line, and so on. |
| `detected` | string or null | How the removal was noticed. |

### meta.json

```json
{
  "schemaVersion": 1,
  "lastUpdated": "2026-10-23",
  "summary": "One sentence the page shows under Available vehicles.",
  "files": {
    "model3": "2026-10-22",
    "q6": "2026-10-22",
    "others": "2026-10-23",
    "gone": "2026-10-22"
  }
}
```

## Where the seed came from

`model3.json` and `q6.json` are adapted from the Model 3 and Q6 watch logs. `gone.json` is adapted from the off-market log. `others.json` holds two verified listings:

- 2024 BMW i4 xDrive40, 25,630 mi, $40,277, Tim Dahle Nissan Southtowne, South Jordan
- 2024 Hyundai Ioniq 5 Limited AWD, 42,137 mi, $29,992, Ken Garff Hyundai Downtown, Salt Lake City, certified pre-owned

The page is HTML, CSS, and one script. Filters, the day/night theme, and sparklines run in the browser. Display type is self-hosted Barlow and Barlow Condensed (SIL Open Font License, `css/fonts/OFL.txt`). The page does not load third-party scripts, fonts, or analytics.
