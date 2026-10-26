# Next car

A public, static tracker for Jason's next-car decision. Front-runners and their live listings, the earlier contenders, and an off-market log.

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

1. **Priorities** — a compact strip under the title. Current order, a one-line mileage rule, and the latest `previously` snapshot so a rank change is visible when the order shifts.
2. **Front-runners** — the models whose `status` is `front-runner` (BMW i4, Toyota Crown Signia, Tesla Model 3 Long Range AWD right now). Desktop shows them in columns. A phone shows one at a time, with tabs that include the lowest asking price. Each column has the key specs and that model’s live listings, lowest price first.
3. **Other contenders** — models whose `status` is `considering`. One row each: trend (`gaining`, `steady`, or `fading`) and how many listings sit inside the mileage window. Open a row for the specs and the listings. `dropped` models are a single ruled-out line.
4. **Off the market** — collapsed. `data/gone.json`, plus any current listing over the mileage hide line that is not a value exception.

The “Last updated” date is `lastUpdated` in `data/meta.json`.

A listing row shows asking price, miles, dealer and city, the listing link, and, when the log has them, a motivation score (Low / Medium / High) and a timing call (BUY NOW / WATCH / WAIT). A price cut or increase since the first check is shown next to the price. Filter chips on the off-market log use the model’s `chip` (or `label`) and a count, for example `Model 3 · 45`, so a chip never falls back to a raw id like `v60cc` when the catalog has a name.

Cost per mile uses one public baseline: **17¢ per mile at 28 MPG** (about $4.76 a gallon). Cars with an MPG figure are scaled from it (`17¢ × 28 ÷ mpg`). The Model 3’s ~12¢ per mile is a winter road-trip estimate, kept separate from that scaling. The i4, Ioniq 5, and Q6 e-tron do not get an invented cents-per-mile number. The figures live on the model specs. The long chart is gone.

### Mileage window

The ceiling is about **25,000 miles** for every model. The page still shows a car up through **27,000 miles**, with a short “Over the 25k line” note, so a slightly over example stays visible. Miles **greater than 27,000** stay out of the front-runner and contender lists unless that listing sets `mileageException`. Those cars are listed inside the collapsed off-market section. They stay in the listing JSON, because the daily listing job owns those files and the car may still be for sale.

Both numbers live in `data/models.json` under `criteria`. `milesCeiling` defaults to `25000` and `hideAbove` defaults to `27000` when the keys are missing. `hideAbove` should be at least `milesCeiling`. If it is lower, the page uses `milesCeiling` as the hide line.

## Privacy

This site is public. Do not add:

- loan balances, monthly payments, APR, payoff, or negative equity
- a home address or any ZIP code
- negotiation targets or other personal financial figures

Asking prices, public doc fees, dealer names, and dealer cities are fine. A few original listing URLs contain a dealer ZIP in the path. Those URLs are copied unchanged so the link still opens. Displayed dealer, city, note, and status fields do not include ZIP codes.

## Update the data

Edit the JSON files, set `data/meta.json` `lastUpdated` to the check date (`YYYY-MM-DD`), and commit to `main`. Reload the site. Nothing has to be compiled.

Who is on top, the priority order, and the mileage ceiling live in `data/models.json`. The daily job that rewrites `model3.json`, `q6.json`, `others.json`, `gone.json`, and `meta.json` should leave `models.json` alone. Listing objects can gain the optional `mileageException` fields above. Existing listing fields are unchanged.

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
| `mileageException` | boolean, optional | `true` keeps a car over `hideAbove` on the front-runner or contender list. Missing or any value other than `true` means the car follows the mileage rule. |
| `mileageExceptionReason` | string, optional | Short public reason shown with the Mileage exception badge. Omit it and the badge still shows. |

`mileageException` is optional. A writer that rebuilds a listing object should copy unknown keys through. If the next run drops the flag, the page treats the car as an ordinary listing again.

```json
"miles": 31747,
"mileageException": true,
"mileageExceptionReason": "One-owner, priced with the lower-mile cars"
```

The badge appears when the flag is true and miles are over `milesCeiling`. A flagged car under the ceiling stays on the list without the badge.

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

## Decision file

`data/models.json` is the board: who is on top, the priority order, and the mileage numbers. The daily job that rewrites listing files through the GitHub contents API should leave this file in place. It is not a listing log. If the file fails to load, the page falls back to the current front-runners and the same priority order, without the spec lines.

`schemaVersion` here is `1`. Every field below is optional except `models[].id` when a model entry is present. A `modelId` that shows up on a listing and is missing from this file is treated as `considering` with trend `steady`.

### Criteria, priorities, reference

```json
{
  "schemaVersion": 1,
  "criteria": { "milesCeiling": 25000, "hideAbove": 27000 },
  "costNote": "One sentence under the front-runners.",
  "reference": ["Audi A4 Avant"],
  "priorities": {
    "asOf": "2026-10-26",
    "items": [
      { "id": "fun", "label": "Driving fun", "rank": 1, "detail": "Sport-wagon feel." }
    ],
    "previously": [
      {
        "asOf": "2026-10-23",
        "note": "Opening order",
        "items": [
          { "id": "fun", "label": "Driving fun", "rank": 1 }
        ]
      }
    ]
  },
  "models": []
}
```

`priorities.items` is the current order. Equal `rank` values are a tie. Array order breaks the tie for display. An item with `"id": "miles"` is the mileage ceiling: the page builds its label from `criteria.milesCeiling` (`About 25,000 miles`) so the number and the chip stay aligned. If that item is missing, the page adds it.

`previously` is optional. It may be one object or an array of dated snapshots. `history` is accepted as an alias. The page compares the current items with the latest snapshot and writes a one-line delta: `Same order today`, `About 25,000 miles added`, or `Driver assist up from 3`. A chip shows `New` or `was 4` when that item changed. Older snapshots, when there is more than one, sit under “Earlier priority orders.” Omit `previously` and the history line stays off the page.

The opening snapshot is 2026-10-23, the order this page shipped with. The 2026-10-26 list adds the mileage ceiling beside AWD. The other ranks are unchanged.

### Model

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Matches a listing `modelId` (`i4`, `signia`, `model3`, `ioniq5`, `v60cc`, `q6`). |
| `label` | string | Heading. |
| `chip` | string, optional | Short name for tabs and off-market filter chips. Defaults to `label`. |
| `trim` | string, optional | Subtitle under the heading. |
| `status` | string, optional | `front-runner`, `considering`, or `dropped`. Missing or unknown becomes `considering`. |
| `rank` | number, optional | Lower comes first. Default `90`. |
| `trend` | string, optional | `gaining`, `steady`, or `fading`. Missing or unknown becomes `steady`. This is an editorial read, not a price calculation. |
| `fit` | string, optional | One line on the card. |
| `specs` | array, optional | `{ "k": "EPA range", "v": "307", "u": "mi" }`. `u` is the small unit and may be omitted. |
| `reason` | string, optional | Short cause on a dropped model, such as `Price` or `Range`. |

Change who is on top by editing `status` and `rank`. Front-runners are the columns at the top. Considering models are the other contenders. Dropped models are the ruled-out line.

## Where the seed came from

`model3.json` and `q6.json` are adapted from the Model 3 and Q6 watch logs. `gone.json` is adapted from the off-market log. `others.json` holds verified listings for the other shortlist cars (i4, Ioniq 5, Crown Signia, V60 Cross Country). `models.json` is the decision board and is edited by hand.

The page is HTML, CSS, and one script. Filters, the day/night theme, and price deltas run in the browser. Display type is self-hosted Barlow and Barlow Condensed (SIL Open Font License, `css/fonts/OFL.txt`). The page does not load third-party scripts, fonts, or analytics.
