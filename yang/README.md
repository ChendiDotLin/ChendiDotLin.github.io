# 羊了个雨

Standalone, mobile-friendly match-three tile game with Risk of Rain 2 item art.
Open `index.html` directly, or serve this directory from any static web host.
In this GitHub Pages repository the game lives at `/yang/`.
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
Local storage is used only for language preference, the last player ID, and the
local win counter. Scores are not silently saved to a local-only leaderboard.

1. Create a project in the [Supabase dashboard](https://supabase.com/dashboard).
2. In SQL Editor → New query, run `../scripts/rain-leaderboard.sql` in full.
   The migration can be run again without deleting existing scores.
3. Find the Project URL in the project's Connect dialog and the Publishable key
   under Settings → API Keys. Keep the Data API enabled with `public` exposed.
4. Fill `supabaseUrl` and `supabasePublishableKey` in `config.js`.
   Use a key beginning with `sb_publishable_`. Never use a Secret key,
   `service_role` key, database password, or connection string in browser code.
5. Reload `/yang/`, finish a round, and submit a test ID. Open the leaderboard
   in another browser to verify that the score is shared.

Without configuration, the game and language switching work normally. The
leaderboard shows a setup message and does not claim to have saved any scores.
The configured client requires HTTPS Supabase project URLs ending in
`.supabase.co`. The site itself can still be hosted on GitHub Pages.

### Ranking and submission rules

- Separate boards for Drizzle, Rainstorm, and Monsoon; top 100 displayed.
- Recovered tiles descending, then active play time ascending, to the millisecond.
  Exact ties use record time and then player ID for a stable display order.
- Each case-sensitive ID keeps its best result per mode. IDs support 1–20
  Unicode letters/numbers, underscores and hyphens, with NFKC normalization.
- Wins and losses can both be submitted. Submitting finalizes the round. Rescue
  is offered before submission; retries retain the same frozen score and run ID.
- The clock pauses while a dialog is open or the tab is in the background.
- Requests time out after 12 seconds and can be retried without duplicate scores.
  Scores awaiting a retry remain in the page; they are not an offline queue.
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

Open `/yang/admin/` (also linked from the game footer). Sign in with your Supabase
Auth email and password. The static page uses only the project's publishable key;
all management RPCs verify `auth.uid()` against a private administrator whitelist.
Creating another Auth account does not grant management access.

1. Create your account in Supabase → Authentication → Users → Add user, with an
   email and password. Confirm the email there if required.
2. Run `../scripts/rain-admin.sql` in SQL Editor in full. It includes the updated
   base migration and the supplied developer UUID
   `cf51ed16-ab31-41a7-8134-154688dfca14`. For a different installation, replace
   that UUID with the intended administrator's Auth user ID before running.
3. Sign in at `/yang/admin/`. Inspect mode counts and scores; remove one ID from a
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
