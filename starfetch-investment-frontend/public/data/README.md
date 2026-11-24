# Market Pulse — how to update the figures

`market-pulse.json` in this folder is the **only** place the homepage's Market
Pulse numbers come from. They are **not** live, **not** real-time and **not**
supplied by any API. A developer edits the file, commits it, and the next deploy
publishes the change.

Starfetch is a regulated firm, so an unverified number is a compliance problem,
not just a typo. Follow the process below exactly.

---

## The three indicators

| Order | `id` | Label | Source |
|---|---|---|---|
| 1 | `headline-inflation` | Headline Inflation | National Bureau of Statistics (NBS) |
| 2 | `monetary-policy-rate` | Monetary Policy Rate | Central Bank of Nigeria (CBN) |
| 3 | `cash-reserve-ratio` | Cash Reserve Ratio | Central Bank of Nigeria (CBN) |

Do not swap these for the NGX All-Share Index, market capitalisation or market
breadth. Do not add a fourth. Do not reorder.

---

## Where the official data comes from

| Indicator | Publish schedule | Where to check |
|---|---|---|
| Headline inflation | NBS publishes the CPI report mid-month for the **previous** month | <https://nigerianstat.gov.ng/elibrary> (CPI report) |
| Monetary Policy Rate | CBN MPC meets roughly every two months; the communiqué is the authority | <https://www.cbn.gov.ng/> → Monetary Policy → MPC communiqués |
| Cash Reserve Ratio | Same MPC communiqué as the MPR | as above |

Both CBN figures usually move together because they are announced in the same
communiqué. Always update them from the communiqué itself, not from a news
summary.

---

## Update procedure

1. **Confirm the figure on the official publication.** Open the NBS CPI report or
   the CBN MPC communiqué and read the number there. A news article is a prompt
   to check, never the source.
2. **Edit `market-pulse.json`.** For the indicator you are changing, update:
   - `value` — a plain number. No `%`, no comma, no naira sign. The unit is added
     by the frontend.
   - `reportingPeriod` — the period the figure describes, e.g. `"October 2026"`
     or `"September 2026 MPC"`.
   - `previousValue` and `previousPeriod` — the figure this one replaced.
   - `publicationReference` — which publication and its date, e.g.
     `"NBS Consumer Price Index report, October 2026, published 16 November 2026"`.
   - `sourceUrl` — a link to the publication itself.
   - `lastVerified` — today's date, `YYYY-MM-DD`.
   - `note` — one short sentence a non-economist understands.
3. **Update the top-level `lastVerified`** to the same date.
4. **Run the checks** (they fail if a required field is missing or a value is not
   a number):
   ```bash
   npm run test:market
   npm run typecheck
   ```
5. **Commit** with a message naming the release, e.g.
   `chore(market-pulse): update inflation to October 2026 NBS release`.
6. **Deploy** through the normal release process. The change is not visible until
   the site is deployed.

> Even if a figure has **not** moved, update `lastVerified`. An unchanged number
> that was re-checked is a *confirmed* number; one that was never re-checked is a
> stale one. The date is how the next person tells the difference.

---

## What happens if the file is wrong

The homepage never breaks. `lib/market/market-pulse.ts` validates the file at
render time and, if any of these is missing or invalid —

- an indicator `id` from the three above,
- a numeric `value`,
- a `reportingPeriod`,
- a `source`,
- a `lastVerified` date,

— the card shows **"Indicators temporarily unavailable"** instead of a partially
correct panel. A missing or malformed file behaves the same way. Nothing is
guessed.

---

## Field reference

| Field | Required | Notes |
|---|---|---|
| `id` | yes | One of the three ids in the table above |
| `label` | yes | Heading shown on the card |
| `value` | yes | Plain number |
| `unit` | yes | `"%"` for all three current indicators |
| `reportingPeriod` | yes | Displayed to the visitor |
| `previousValue` | no | Omit or `null` if there is no meaningful comparison |
| `previousPeriod` | no | Pair with `previousValue` |
| `appliesTo` | no | Used for the CRR: `"Deposit Money Banks"` |
| `note` | yes | One plain-English sentence |
| `source` | yes | `"National Bureau of Statistics (NBS)"` / `"Central Bank of Nigeria (CBN)"` |
| `sourceUrl` | yes | Direct link to the publication |
| `publicationReference` | yes | Publication name and date |
| `lastVerified` | yes | `YYYY-MM-DD` |
