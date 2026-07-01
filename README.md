# Raise the Standard - Fireworks Spiff (live board)

A cross-browser, lock-in sales spiff for Emich Volkswagen of Boulder. Reps earn
fireworks on the floor, then light them for cash. Every draw happens on the
server and locks the moment it is lit, so nothing can be re-rolled and the whole
floor sees the same board in real time. Update it daily to keep eyes on the prize.

## What is in here

```
index.html                     the board (rep shelf, live standings, hit list, manager setup with report upload)
netlify/functions/spiff.mjs    V2 ESM function: shared state, server-side draws, incremental daily grants (Netlify Blobs)
netlify.toml                   build + functions config
package.json                   ESM + @netlify/blobs
```

## Deploy

This one needs a function, so it is a GitHub-connected Netlify site, not a
drag-and-drop single file.

1. Push this folder to a new GitHub repo (for example `wseymour303/fireworks-spiff`).
2. In Netlify: Add new site, Import from GitHub, pick the repo. No build command,
   publish directory `.`. Netlify auto-detects the function.
3. Set an environment variable:
   - `MANAGER_KEY` = your manager passphrase (defaults to `Standard2026` if unset).
4. Blobs turns on automatically. The function answers at `/api/spiff`.

## Run the spiff

Day one:
1. Open the site, scroll to **Manager setup**, enter your `MANAGER_KEY`.
2. Upload the three reports (Lead Conversion CSV, Finance Summary, Wade's View
   inventory) and hit **Read reports**. The table fills with each rep's earned
   fireworks and the hit list updates. Everything is parsed in your browser; the
   raw files never leave your machine.
3. Adjust the hit-list column to the aged units that actually sold, since that is
   an estimate. Watch the projected payout, then hit **Update board**.

Every day after:
- Export the same three reports for the period to date, upload, **Read reports**,
  **Update board**. Because report counts are cumulative, the board grants only the
  newly earned fireworks on top of what each rep already holds. Lit winnings and
  trades are never touched. The status line shows exactly what was added, for
  example "Added: Aaron +2 firecracker +1 bottle rocket".
- **Start new period** wipes everything to zero when the spiff resets.

Reps open the site, pick their name (plus PIN if set), and their shelf loads.
Tapping a shell lights it and locks the cash. The board updates across every
device every 15 seconds.

## Report parsing

Column mapping is by header name, so minor reordering in the exports is fine.

- Lead Conversion (CSV): sums Appts Shown (firecrackers) and Visits Sold (bottle
  rockets) per User.
- Finance Summary, Counts tab (XLSX): Product count per rep (sparklers), deals with
  Product & Reserve count of 4 or more (Big Bangs), and used-unit count (hit-list
  estimate).
- Finance Summary, Gross tab (XLSX, optional): back-end gross per deal. Any deal at
  or above $4,000 back-end gross also earns a Big Bang. Deals that clear both the
  4-product and $4K bars are counted once, matched by deal number.
- Wade's View (XLS): retail used units aged 60 days or more become the hit list.

Either finance slot accepts either tab; the reader detects Counts vs Gross by the
Front column and routes automatically. The $4K back-end threshold lives in
`GROSS_BIG` near the top of the parser in `index.html`.

## Notes

- Draws are server-authoritative. A rep only chooses which shell to light, not the
  value, so results are fair and final.
- The daily update is incremental. A per-rep grant ledger tracks cumulative earned
  counts, so re-uploading the same or an older report never double-grants or claws
  back.
- State is a single Blob under the store `fireworks-spiff`, key `state`. Writes are
  read-modify-write; with six reps at human pace, contention is not a concern.
- Odds and the ladder live in both `spiff.mjs` (source of truth for draws) and
  `index.html` (display and budget projection). If you retune odds, change both.
