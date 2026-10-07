# Clackworks

Standalone, mobile-friendly layered match-three roguelite with an original invention-workshop theme.
Open `index.html` directly, or serve this directory from any static web host.
In this GitHub Pages repository the game lives at `/clackworks/`.
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

## Workshop presentation

The workshop edition replaces the former third-party item pictures and soundtrack
with 12 original part icons, nine original machine icons and an
licensed jazz soundtrack. See `assets/README.md` for the asset map.
Names, descriptions, effects labels, home-page promotion and credits are bilingual.
The artwork uses the original faceless flat workshop objects. The former glove
and bulb are replaced by a pocket tape measure and a mini battery in the same style.
Production images retain transparent backgrounds and are compressed as WebP;
full prompts are recorded in the assets.

This is a presentation-only update: the layered matching rules, seven-slot tray,
gear interactions, drop weights, growth gates, Boss energy and all score timing
remain unchanged. Legacy internal IDs are deliberately retained in saves and
leaderboard payloads; existing runs/records display the new names automatically.
No database migration, save reset or leaderboard reset is required.
This asset replacement is not a trademark clearance or a legal opinion.

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
5. Reload `/clackworks/`, finish a round, and submit a test ID. Open the leaderboard
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
  Only narrowly scoped database functions can read or submit scores.

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

## Music and sound effects

The ♪ player uses **George Street Shuffle** by **Kevin MacLeod (incompetech.com)**,
licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
[Original track](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300035),
ISRC USUAN1300035. The author's original MP3 is hosted locally, unedited;
`assets/audio/george-street-shuffle-NOTICE.txt` records attribution, provenance
and its SHA-256. Both language versions of the credits provide artist/source,
license and notice links.

Playback is opt-in. The recording streams only after Play, loops, and resumes
from its paused position. Music and synthesized effects retain independent
volume/mute controls. Backgrounding pauses the recording and audio context;
closing the player stops music. Failed loads show a retryable player error,
and cancelled play promises cannot restart music. The retired generated score
and piano sample bank are not requested or played.

Clicks, matches, blasts, arcs, suction and results keep their existing sounds.
Chain cues follow the visual timeline and are capped to avoid stacking hundreds
of voices. A compressor provides mix headroom; pending effects are cancelled
on mute, restart, backgrounding or interrupted animation. No third-party audio
host is contacted during gameplay.

## Developer administration

Open `/clackworks/admin/` (also linked from the game footer). Sign in with your Supabase
Auth email and password. The static page uses only the project's publishable key;
all management RPCs verify `auth.uid()` against a private administrator whitelist.
Creating another Auth account does not grant management access.

1. Create your account in Supabase → Authentication → Users → Add user, with an
   email and password. Confirm the email there if required.
2. Run `../scripts/rain-admin.sql` in SQL Editor in full. It includes the updated
   base migration and the supplied developer UUID
   `cf51ed16-ab31-41a7-8134-154688dfca14`. For a different installation, replace
   that UUID with the intended administrator's Auth user ID before running.
3. Sign in at `/clackworks/admin/`. Inspect mode counts and scores; remove one ID from a
   selected mode, reset one mode, or reset all boards. Each deletion requires typing
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
- Shuffle flips exposed cards around a workshop sorting ring. Stash and undo
  animate cards between their previous and new positions.
- Victory delivers a completed parts crate through a sorting ring; defeat
  drops the crate beside the workbench. All effects use original CSS geometry.
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

The former `/rain_match/`, `/yang/` and their `/admin/` URLs redirect to `/clackworks/` and
`/clackworks/admin/`, preserving query parameters and fragments when JavaScript
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

## Expedition (endless roguelike mode, Boss update)

Open `/clackworks/?mode=expedition`. Classic difficulties keep their own rules.

- Carry **six passive types plus one active equipment**. The pool now includes
  Welding Torch, Overload Boiler and Precision Calibrator. A seventh passive requires a
  replacement; two active items cannot coexist.
- Level 2 unlocks at stage 3. Stage 6 allows two simultaneous level-3 evolutions;
  stage 10 onward allows six. At the evolution cap, a new evolution downgrades
  the oldest equipped evolution to level 2, with a warning before choosing.
- Each normal stage offers at most one mid-stage and one clear supply. The first
  stage uses a 36-tile mixed-set deal; later boards grow to 144, or 156 in fog.
  Initial deals have a legal witness. Automatic clears and player choices can
  change which continuation works; the original witness is not an autoplayer.
- Grabber, Cushion, Arc Coil, Flywheel, Vacuum and Scanner keep their adapted mechanics.
  Cushion blocks one overflow per stage. Upgrading, swapping and supplies cannot
  reset it. Each emergency power starts with one use; at most two extra refills
  are available across the entire run.
- Welding Torch procs on each recovered triple, including automatic clears, with a
  25/35/45% chance to recover another reachable triple. Evolution pierces one
  blocker. Boiler accumulates all recovered triples and blasts another every
  4/3/2 triples, through 1/2/3 blockers. Calibrator adds 5/10/15 percentage points to
  Welding Torch and Arc Coil chances. Evolved Calibrator raises the automatic-clear budget
  to 52 triples per action (otherwise `16 + 2 * equipped item types`).
- Chains use a bounded queue and only clear real complete triples. Mature builds
  can nearly clear a board; accessible triples and chance still matter. Fractional
  Flywheel recharge remains bounded, equipment never auto-casts itself, and animation
  delay is capped so a large burst does not lock input for tens of seconds.

### Stage-ten Boss: Emergency Lockdown

Only stage 10 is a Boss stage. Entering it seals **all passives and the active
item**, preserving their original levels. The first manual triple immediately
returns one passive level (or the whole active item). Later manual triples earn
2 seal energy; all proc triples in a single action together earn at most 1 extra.
Every 3 energy returns one random passive level. Items still at zero have priority
until every owned item is active; remaining upgrades are uniformly selected from
items below their original level. Active equipment returns at its original level
with one charge. Grabber gets one ready use only on first return, not on upgrades;
Cushion retains its once-per-stage limit.

The HUD shows remaining unlocks, a three-point energy meter, and current/original
levels on partially recovered items. A copper-violet seal closes on entry, energy
travels toward the meter, each returned level shatters a small seal by its item,
and the full seal breaks when the board is cleared. These effects do not change
card contrast or accept pointer input, and reduced motion skips their waits.

There is no mid-stage supply, and emergency powers keep their remaining uses.
Recovering all items alone does not win: the full board must be cleared. A final
clear restores every remaining level. The stage reward and travel then continue
into stage 11 and the normal endless sequence. Later stages do not repeat this Boss.

Undo includes partial levels, seal energy, the first-return flag, proc counters
and RNG state. Repeating the same pickup after Undo produces the same return.
Existing v3 saves keep already-returned items and initialize the new energy field
to zero, including their Undo state. This update needs no database migration and
preserves existing leaderboard records. Gear is never permanently deleted by the
Boss; a failure records the full owned loadout.

### Two new leaderboards

Run **`scripts/rain-expedition-boss.sql` in full** in the existing Supabase SQL
Editor after the previous Expedition setup. It adds the new boards and updates
existing admin functions without deleting scores or changing the admin whitelist.
Do not rerun the older migration over this one: its older mode constraints do not
include the new boards. Fresh installations run the base/admin/Expedition setup
first, then this Boss migration last.

- **Farthest:** completed stages descending, cumulative recovered tiles descending,
  then total active time ascending. Exact ties use submission time and player ID.
- **Fastest 10:** only runs that cleared the stage-ten Boss qualify. The cumulative
  active time at that exact clear is frozen; further stages cannot increase it.
  Equal times use submission time and player ID. Each board keeps each ID's best
  result independently and shows the top 10.
- After defeating the Boss, the player can enter an ID to register the ten-stage
  checkpoint and keep playing. This does not finalize the expedition. Its request
  has a separate stable UUID and frozen payload. Later extraction submits another
  UUID and can improve distance without overwriting a faster ten-stage result.
- Neither loading a checkpoint nor clearing the Boss automatically posts a score.
  Failed requests survive reload for an explicit retry with the same UUID/payload.
- The previous Expedition board remains accessible under **Legacy**. Existing
  records are never mixed into the new rankings. Admins can view or clear either
  new board separately; deletion archives the rows and revokes prior run UUIDs.

The new RPCs are `rain_expedition_v3_leaderboard(p_board)` and
`rain_submit_expedition_v3(...)`. Tables remain private and RLS protected. Server
validation checks stage/tile boundaries, ten-stage qualification and loadout
limits, but scores remain client-reported; no server-side replay is performed.

### Autosave and migration

One checkpoint and its previous valid backup stay in this browser. The stable
storage key is retained, with schema/rule version 3 inside the record. Saved
state includes the board, tray/reserve, powers, gear, sealed gear, choices, Undo,
RNG, active time, ten-stage time and both pending submission receipts. Offline,
background, dialog and animation time are excluded. Starting a new run explicitly
replaces the old save; storage failures are shown. Web Locks and conflicting-write
guards prevent active tabs from overwriting one another.

Version-2 saves are upgraded without discarding the board or Undo. They remain
playable as legacy runs and do not qualify for the new boards. Already frozen
legacy submissions still retry the original endpoint. New runs use the new rules
and qualify normally. Browser saves do not sync across devices or to Supabase.

All equipment uses original 2D workshop character illustrations. Flame, blast and restart
feedback uses original CSS animation.
Reduced-motion settings skip animation waits.

Checks:

- `node scripts/test-rain-workshop-browser.cjs`: original artwork, bilingual names,
  stable saved gear, responsive layouts and actual synthesized audio lifecycle.
- `node scripts/test-rain-expedition.cjs`: stage witnesses and item rules.
- `node scripts/test-rain-boss.cjs`: sealing, random recovery, Undo/reload,
  six-slot builds, near-board bursts and legacy-save migration.
- `node scripts/test-rain-sealer.cjs`: 60 full Boss runs, gradual recovery, chain
  energy cap, active casts, Undo/reload, old saves and invalid states.
- `node scripts/test-rain-save.cjs`: checkpoint replay and storage failure cases.
- `node scripts/test-rain-boss-sql.cjs /path/to/pglite/dist/index.cjs`: migration,
  independent bests, time qualification, retries, private tables and admin deletion.
- Serve this repository at `http://127.0.0.1:8765`, then run
  `node scripts/test-rain-expedition-browser.cjs` and
  `node scripts/test-rain-boss-browser.cjs` with Playwright installed. Optional
  `RAIN_PLAYWRIGHT`, `RAIN_BROWSER_PATH` and `RAIN_GAME_URL` select local tools.
  All leaderboard writes in these tests are mocked. Set `RAIN_TEST_MOTION=1`
  for the Boss browser test to exercise entry, reclaim and victory effects.
- `node scripts/test-rain-effects-browser.cjs` uses the same browser setup to
  check explosion/fire/lightning feedback, chain totals, bounded animation
  duration and particle count, cancellation, reduced motion, and responsive UI.

Expedition feedback uses separate Boiler shockwaves and flying cards, Welding Torch
flames, and Arc Coil arcs. Large chains stagger over a 1.6-second launch window
and finish within about three seconds, with sampled particles to limit rendering
cost. A recovery count appears beside the tray; effects never receive pointer
input. Reduced motion skips the overlays and all effects are cancelled on reset.

Supply rarity: each ordinary supply rolls a separate legendary slot (18% through
stage 10, 25% from stage 11), capped at one red item. When both are eligible,
Boiler takes 60% of that slot and Calibrator 40%. The same roll applies to upgrades;
max-level items are excluded. Lower-tier gear uses weighted draws without
replacement (Welding Torch 100, green passives 60, Safety Cushion 35, active equipment 45,
emergency refills 50). Capped lower tiers cannot force a legendary roll to succeed;
a short offer falls back to recharge. Starter choices and Boss recovery are
unchanged. Existing equipment and already saved offers are retained.

`node scripts/test-rain-reward-rarity.cjs` checks rates, capped pools and save
replay. `node scripts/test-rain-rarity-browser.cjs` checks covered-card contrast,
rarity labels, bilingual supply odds and resume behavior with mocked networking.

The main game URL defaults to Expedition and the farthest-stage leaderboard.
Existing saves are previewed while paused and require Continue before play or
writes resume. Explicit `?mode=drizzle`, `?mode=rain`, and `?mode=monsoon` links
still open their classic modes. `node scripts/test-rain-default-browser.cjs`
checks fresh entry, saved runs, tab locks, unavailable storage and classic links.

## Online players

The header displays approximate active browser counts through
[Supabase Realtime Presence](https://supabase.com/docs/guides/realtime/presence).
It uses the existing publishable key and public `rain-match-online-v1` channel;
no SQL migration, database table or administrator login is required.

Visible pages count for three minutes after opening, clicking, typing or
scrolling. Hidden, idle, closed and offline pages disconnect. Multiple tabs in
the same browser share a random local identifier and count once. Expedition
counts browsers with at least one active tab viewing that mode, including supply
and resume screens. Devices or browsers cannot be merged into one human without
login, so the label is an estimate, not an authenticated audience metric.

Only the random browser identifier and mode are sent as ephemeral Presence
metadata; no player IDs, scores or historical visits are uploaded. Blocked local
storage falls back to a per-tab identifier. Network failures show unavailable
instead of zero or an old count; the game and leaderboard remain independent.
Unexpected connection loss can take about a minute to propagate to other clients
(65 seconds in the abrupt-offline browser check); normal leaves sync promptly.

The pinned MIT-licensed SDK is hosted in `vendor/` with its provenance and
license. This separate client disables auth storage and session detection.
`node scripts/test-rain-presence.cjs` verifies lifecycle and aggregation;
`node scripts/test-rain-presence-browser.cjs` uses a unique temporary channel to
test real joins/leaves, browser deduplication, visibility, mode changes and
offline recovery. Other browser tests block the Presence socket to avoid
changing public counts. All leaderboard requests in these tests are mocked.
