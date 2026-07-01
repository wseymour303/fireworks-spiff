# Raise the Standard - Fireworks Spiff (live board)

A cross-browser, lock-in sales spiff for Emich Volkswagen of Boulder. Reps earn
fireworks on the floor, then light them for cash. Every draw happens on the
server and locks the moment it is lit, so nothing can be re-rolled and the whole
floor sees the same board in real time.

## What is in here

```
index.html                     the board (rep shelf, live standings, hit list, manager setup)
netlify/functions/spiff.mjs    V2 ESM function: shared state + server-side draws (Netlify Blobs)
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

1. Open the site, scroll to **Manager setup**, enter your `MANAGER_KEY`.
2. The table is pre-filled with last period's real counts. Adjust each rep's
   earned fireworks for the current period. Set a PIN per rep if you want to keep
   shelves private (leave blank for name-only access).
3. Watch the **projected team payout** (5,000-run estimate) and dial counts until
   the number sits where you want it.
4. Hit **Publish board**. Shelves seed and the floor goes live.

Reps open the site, pick their name (plus PIN if set), and their shelf loads.
Tapping a shell lights it and locks the cash. Trading up is one-way. The **Live
Standings** board updates across every device every 15 seconds.

## Notes

- Draws are server-authoritative. A rep can only choose which shell to light, not
  the value, so results are fair and final.
- `Reset board` wipes all shelves and winnings. `Publish board` reseeds and
  clears lit history, so publish once per period.
- State is a single Blob under the store `fireworks-spiff`, key `state`. Writes
  are read-modify-write; with six reps at human pace, contention is not a concern.
- Odds and the ladder live in both `spiff.mjs` (source of truth for draws) and
  `index.html` (display and budget projection). If you retune odds, change both.
