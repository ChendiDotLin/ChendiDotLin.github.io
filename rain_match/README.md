# Rain Match

Standalone, mobile-friendly match-three tile game with Risk of Rain 2 item art.
Open `index.html` directly, or serve this directory from any static web host.
In this GitHub Pages repository the game lives at `/rain_match/`.
No build step, external JavaScript, ads, or paid actions are required to play.
The optional shared leaderboard requires the public Supabase configuration below.

- Three difficulties: 36, 108, and 144 tiles.
- Centered portrait playfield: layered main board, two lower supply stacks,
  seven-slot tray, and three square power buttons. Each supply stack exposes
  only its top card and shares the main board's matching and power rules.
- Seven inventory slots; matching triples clear before the full-rack check.
- Only uncovered tiles are selectable.
- Each round provides one free removal, undo, and shuffle.
- Removal moves up to three tiles into a clickable reserve, not out of the game.
- Undo restores the last pickup, including any resulting match. Other powers
  invalidate that snapshot; spent powers are never refunded by undo.
- A full inventory can be rescued with an unused removal or undo.
- Every initial deal has a legal solution. Shuffling preserves remaining item
  counts but does not promise a solution for every player-created position.
- A new round or difficulty change resets all powers. Win totals are stored
  locally when browser storage is available. Sound is optional and off by default.

## Artwork attribution

Item images: Risk of Rain 2, via
[Glagan/RoR2-Items](https://github.com/Glagan/RoR2-Items/tree/master/public/img).
Original artwork belongs to its respective game rights holders. This is an
unofficial fan project. Icons are bundled locally to avoid external hotlinking.
The game implementation is original; no source code from that repository is used.

## Rule verification

Run `node ../scripts/test-rain-match.cjs` from this directory.

## Shared leaderboard setup (Supabase)

The game now supports Chinese and English, and a shared database leaderboard.
Local storage keeps language preference, the last player ID, the local win
counter, and an Expedition checkpoint with one previous valid backup. Scores are not silently saved to a local-only leaderboard.

1. Create a project in the [Supabase dashboard](https://supabase.com/dashboard).
2. In SQL Editor → New query, run `../scripts/rain-leaderboard.sql` in full.
   The migration can be run again without deleting existing scores.
3. Find the Project URL in the project's Connect dialog and the Publishable key
   under Settings → API Keys. Keep the Data API enabled with `public` exposed.
4. Fill `supabaseUrl` and `supabasePublishableKey` in `config.js`.
   Use a key beginning with `sb_publishable_`. Never use a Secret key,
   `service_role` key, database password, or connection string in browser code.
5. Reload `/rain_match/`, finish a round, and submit a test ID. Open the leaderboard
   in another browser to verify that the score is shared.

Without configuration, the game and language switching work normally. The
leaderboard shows a setup message and does not claim to have saved any scores.
The configured client requires HTTPS Supabase project URLs ending in
`.supabase.co`. The site itself can still be hosted on GitHub Pages.

### Ranking and submission rules

- Separate boards for Drizzle, Rainstorm, and Monsoon; top 10 displayed.
- Recovered tiles descending, then active play time ascending, to the millisecond.
  Exact ties use record time and then player ID for a stable display order.
- Each case-sensitive ID keeps its best result per mode. IDs support 1–20
  Unicode letters/numbers, underscores and hyphens, with NFKC normalization.
- Wins and losses can both be submitted. Submitting finalizes the round. Rescue
  is offered before submission; retries retain the same frozen score and run ID.
- The clock pauses while a dialog is open or the tab is in the background.
- Requests time out after 12 seconds and can be retried without duplicate scores.
  Classic scores awaiting a retry remain in the page. Expedition checkpoints
  also retain the frozen submission for a manual retry after reloading; nothing
  is submitted automatically in the background.
- IDs are public display names, not authenticated accounts. Scores come from the
  browser and have range/type checks, but there is no server-side replay or
  anti-cheat verification. This is a casual, unauthenticated fan-game leaderboard.
- Tables are in a private schema, with RLS enabled and no direct browser grants.
  Only two narrowly scoped database functions can read or submit scores.

### Additional checks

Run `node ../scripts/test-rain-leaderboard.cjs` for translations and API validation.
The optional SQL integration check uses PGlite (PostgreSQL in WASM):
`node ../scripts/test-rain-sql.cjs /path/to/pglite/dist/index.cjs`.
It covers migration reruns, real sorting, Chinese IDs, best-only updates, safe
submission retries, mode separation and denied direct table access.

Supabase references: [API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[database functions](https://supabase.com/docs/guides/database/functions).

## Difficulty design (v2)

Drizzle remains a warm-up. Rainstorm has a nine-layer irregular core plus shallow
side shelves; Monsoon has twelve core layers. Two lower blind supply stacks expose
only the top image. Core layers use offset, incomplete patterns rather than a
regular rectangular grid. Card counts remain 36 / 108 / 144.

The old deal grouped every six cards on a legal removal path into two triples.
The new Rainstorm/Monsoon generator distributes balanced item counts along a
legal path while carrying several unfinished sets across many pickups. This keeps
an initial solution without turning successive clicks into ready-made triples.
The witness never reaches seven unmatched cards. No hidden retry or paid power is
needed to make a starting deal solvable.

Run `node ../scripts/benchmark-rain-difficulty.cjs` for a reproducible visible-card
greedy player (300 seeds, no powers, no hidden-card knowledge). This is a regression
indicator, not a predicted human win rate. With the same policy, the previous
Rainstorm/Monsoon won 114/300 and 38/300; v2 wins 53/300 and 14/300.

Layout reference: [public Sheep a Sheep strategy describing deep core, shallow
reserves and blind stacks](https://www.18183.com/zqnews/202209/4162031.html).
This is an original implementation informed by visible gameplay, not a claim to
reproduce the original game's private generation algorithm.

## Official soundtrack

The ♪ button opens the official Bandcamp player for Chris Christodoulou's
[Risk of Rain 2 soundtrack](https://chrischristodoulou.bandcamp.com/album/risk-of-rain-2-4).
Press play inside the player to begin streaming. It remains mounted during play,
new rounds and language switches; closing the music panel removes the iframe and
stops playback. Click/match effects have a separate switch. Nothing autoplays.
The player needs network access to Bandcamp; a direct album link is also provided.
Music files are not copied, downloaded or bundled in this repository.

## Developer administration

Open `/rain_match/admin/` (also linked from the game footer). Sign in with your Supabase
Auth email and password. The static page uses only the project's publishable key;
all management RPCs verify `auth.uid()` against a private administrator whitelist.
Creating another Auth account does not grant management access.

1. Create your account in Supabase → Authentication → Users → Add user, with an
   email and password. Confirm the email there if required.
2. Run `../scripts/rain-admin.sql` in SQL Editor in full. It includes the updated
   base migration and the supplied developer UUID
   `cf51ed16-ab31-41a7-8134-154688dfca14`. For a different installation, replace
   that UUID with the intended administrator's Auth user ID before running.
3. Sign in at `/rain_match/admin/`. Inspect mode counts and scores; remove one ID from a
   selected mode, reset one mode, or reset all three. Each deletion requires typing
   the displayed confirmation. Running the setup script does not delete scores.

The access token remains in page memory only and expires with the Auth session;
reloading requires signing in again. Passwords and tokens are not saved to browser
storage. Signing out also requests revocation of that login's refresh session.
There is no registration or service-role key in the management page.

Deleted score rows are archived in `rain_private.admin_audit` along with the actor,
time, operation and count. The UI shows the latest 20 operation summaries; full
archives remain accessible to the project owner through SQL Editor for manual
recovery. Old submitted run UUIDs are marked revoked so retries cannot repopulate
a cleared board; a genuinely new round can still be submitted. Deletes and score
submissions use a shared/exclusive transaction lock to avoid reset races. Clearing
scores is not a player ban and does not prevent client-reported score cheating.

To revoke administrator access, remove that UUID from `rain_private.admins` in
SQL Editor. Re-running the setup script will re-add its configured UUID.
For an existing board whose difficulty has changed, the developer can choose to
clear old scores in the management page; this update never resets them silently.

Run `node ../scripts/test-rain-admin.cjs /path/to/pglite/dist/index.cjs` to check
actual PostgreSQL permission denial, scoped deletions, typed confirmations, audit
archives, migration reruns and revoked-run retry protection. All tests use an
isolated temporary database, never the live leaderboard.

## Motion and feedback

- Pickups fly into the tray; triples converge into rarity-colored recovery sparks.
- Shuffle flips exposed cards around a violet teleporter ring. Stash and undo
  animate cards between their previous and new positions.
- Victory charges an original CSS teleporter and lifts an escape pod; defeat
  collapses its signal into rain and a fallen pod. These are original geometric
  effects inspired by the game's mood, not extracted RoR2 animations.
- Power transitions briefly guard input and pause the active-play clock; ordinary
  pickups stay responsive. A restart cancels effects and ignores old completion
  callbacks. Result scenes do not replay during translation or score submission.
- System `prefers-reduced-motion` disables movement, including JavaScript effects,
  and removes the transition wait. Temporary visual overlays ignore pointer input
  and are removed after finishing. No extra animation or graphics library is used.

Animation pacing: pickups take 440 ms, matches 650 ms, shuffle about 1.2 s,
and victory extraction 2.8 s. Restarting, replaying, or changing difficulty uses
an approximately 1.6 s transition: the old board contracts into a portal and the
new tiles descend into place. Input and the play clock resume after landing;
repeated restarts cancel the earlier transition. Reduced-motion mode skips it.

The former `/yang/` and `/yang/admin/` URLs redirect to `/rain_match/` and
`/rain_match/admin/`, preserving query parameters and fragments when JavaScript
is enabled. Origin-based preferences and the Supabase leaderboard stay intact.

The leaderboard is displayed directly on the game page: left of the centered
playfield at widths of 1024 px and above, and below the game on smaller screens.
Its mode tabs are independent of the current round; selecting a game difficulty
also selects that leaderboard. Boards load on entry, can be refreshed manually,
and refresh after a successful submission. A 30-second in-memory cache avoids
extra reads on rapid restarts. Outdated responses cannot replace a newer tab.
The Rankings button and result link focus/scroll to this panel without opening a
dialog. Browsing the panel does not pause the active play clock. Long boards scroll
inside the panel; empty/error states and the panel controls support both languages.

## Expedition (endless roguelike mode)

Choose **Expedition** in the mode bar, or link directly to
`/rain_match/?mode=expedition`. Classic difficulties retain their original rules.

- Choose Feather, Ukulele or Cube to begin. Each stage offers at most one
  mid-stage supply and one clear reward. Stage 1 requires three manual matches
  for its supply; later stages require `min(12, 4 + stage)`. Automatic chains
  never advance supply progress.
- Carry three passive types and one active equipment. Level 2 unlocks at stage 3;
  level 3 evolution unlocks at stage 6. Only one item can stay evolved. Evolving
  another returns the previous evolution to level 2, as shown before choosing.
- **Feather:** pick through one blocker, or two when evolved. Recharge takes
  8/7/6 manual matches. A leap match releases equipped lightning; evolved leap
  matches also grant two equipment energy.
- **Safer Spaces:** block one overflow per stage, returning the offending tile.
  Upgrades, swapping and supplies cannot restore the shield. Level 2 also grants
  two equipment energy; evolution additionally recovers up to two triples.
- **Ukulele:** 25/30/35% chance to bank lightning per manual match, guaranteed
  within 4/3/3 matches. Discharge clears a reachable triple, including tray and
  reserve cards. No target means the charge is retained. Evolution clears up to
  three triples and can pierce one blocker.
- **Cube:** complete a tray pair through up to 1/2/3 blockers. Evolution completes
  up to three tray pairs in one cast. Casting can trigger equipped lightning.
- **Radar:** preview blind supply cards and mark a bounty for 4/5/6 pickups.
  Manually matching the mark grants two energy, an extra recovery triple (two
  for a leap match), and equipped lightning. Evolution recovers up to two triples
  and retargets for the remainder of the scan.
- **Fuel Cell:** store 2/3/4 charges; recharge costs 7/6/5 energy, versus eight
  without it. Manual matches grant one energy. Automatic chain triples return
  only 0.25 with Cell, so a cast cannot replenish itself. Evolution stores up to
  two extra energy at full charge. Upgrades and equipment swaps do not refill.
- Each emergency power starts with one free use per run. Supplies can restore
  spent powers at most twice across the entire run. A recharge reward restores
  one equipment charge (or Feather if no equipment), never Shield.
- The first 36-tile stage now uses the mixed-set deal generator. Later stages
  increase depth and variety; stage 3 onward carries more unfinished sets along
  its initial solution. Fog stages begin at 5 and repeat every three stages.
  Ion storms begin at 6 and repeat every three stages, adding two energy to the
  active recharge cost. Boards cap at 144 tiles, or 156 in fog.
- Every automatic effect removes complete triples. Chains are bounded, with
  staggered card recovery and triggering equipment highlights. Undo restores the
  entire pickup, chain, charges and random cursor. Supplies and equipment casts
  invalidate Undo to prevent reward duplication.
- Extract or submit after failure. Ranking remains actual cumulative recovered
  tiles, then active play time; stage and final loadout are included. This balance
  update preserves existing scores and requires no additional SQL migration.

### Autosave and continue

Expedition saves after actions, reward choices, transitions and submission
changes, plus a five-second clock checkpoint and page visibility/exit events.
Choose **Continue expedition** from the main-page banner or Expedition tab.
The save restores the board, tray/reserve, spent powers, gear, pending choices,
Undo snapshot, random cursor, active time and frozen submission/receipt. Paused,
hidden, animation and offline time are excluded. A failed score request can be
retried with the identical run ID and payload; loading never posts a score.

One versioned save and its previous valid backup live in this browser's local
storage. They do not sync to Supabase or other devices; clearing browser data
removes them. Invalid data is retained until an explicit new run replaces it.
The UI offers a valid backup when possible and displays storage failures rather
than claiming a save succeeded. Restart asks before replacing the checkpoint.
Web Locks allow only one active Expedition tab where supported; storage-change
and compare-before-write guards also pause conflicting pages. Classic modes can
be played while an Expedition is saved. This is a recovery feature, not an
anti-cheat or authenticated save system.

Run `scripts/rain-expedition.sql` in the existing project's Supabase SQL Editor.
It extends the private tables and RPCs, preserves all scores and administrator
membership, and adds Expedition to the existing audited admin controls. New
installations can use the updated base and admin setup scripts. Without this
upgrade the game works, while the Expedition board reports setup pending and
submission can be retried after setup, including from a saved Expedition.

The two new item images (`radar.webp`, `ukulele.webp`) use the same credited
Glagan/RoR2-Items source. Safer Spaces is represented by an original shield glyph.
Effects are original animations: a protective shell, a radar sweep, chain
lightning, a feather burst and a black-hole pull. Reduced motion skips these.
These puzzle effects are adaptations, not the original game's exact mechanics.

Verification: `node scripts/test-rain-expedition.cjs` checks 640 stage witnesses,
charge and loadout carryover, triple conservation, rescue, proc replay, rewards,
replacement and extraction. `node scripts/test-rain-expedition-sql.cjs
/path/to/pglite/dist/index.cjs` tests upgrading the previous schema with preserved
scores, repeat migrations, metadata, ordering, retry protection and scoped admin
removal in an isolated database. Browser checks use mocked score writes.

Run `node scripts/test-rain-save.cjs` for checkpoint round trips, deterministic
replay, malformed saves, backup recovery, conflicting writes, storage failures
and frozen score retries. Browser checks cover live tab locks, reload/resume,
reward checkpoints, restart confirmation, offline time and mobile layouts.

For browser regressions, serve the repository at `http://127.0.0.1:8765`, then
run `node scripts/test-rain-expedition-browser.cjs` with Playwright installed.
`RAIN_PLAYWRIGHT` can point to its module; `RAIN_BROWSER_PATH` selects an existing
Chrome executable. All leaderboard requests in this test are mocked.
