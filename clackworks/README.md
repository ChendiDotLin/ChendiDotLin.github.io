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

## Animal companions and late-game guardians (current)

Equipment now uses four original animal families, sixteen companions and five
individually drawn forms per companion (80 forms total). Saved item IDs are
unchanged. `companions.js` owns bilingual names and current descriptions;
`expedition.js` owns targeting, levels, family bonuses and Boss rules.
The ordinary match tiles remain workshop parts; the title and URL stay Clackworks.

| Family | Existing IDs | Roles | Family bonuses (distinct equipped species) |
| --- | --- | --- | --- |
| Felines | prism, behemoth, clover, blackhole | Critical / covered smash / luck / active pair pull | 2: +5 pp critical chance; 4: critical clears two groups |
| Dragons | ukulele, gasoline, capacitor, resin | Exposed chain / same-type burn / piercing / marked countdown | 2: lightning charges in 3 matches; 4: capacitor reaches one cover deeper |
| Birds | feather, seeker, radar, echo | Reach / auto pair / active scout / repeat targets | 2: +0.25 active energy per manual match; 4: Reach recharges one match sooner and Scout lasts two more picks |
| Shells | shield, cell, turbine, recycler | Overflow guard / energy storage / recharge / finishing sweep | 2: one more active storage slot; 4: Turbine triggers every 2 gear groups |

All family bonuses depend on currently active species, not sealed ownership.
Each family can actually reach four members within the six-passive/one-active
limit. Mixing families preserves the original targeting interactions.

White / green / blue / purple / red correspond to levels 1 / 2 / 3 / 4 / 5.
The caps unlock at stages 1 / 3 / 6 / 11 / 21. The existing two level-3+ slots
before stage 10 and six afterwards remain; upgrading a seventh companion past
level 2 warns before downgrading the lowest evolved companion. Level-five
upgrades use a separate legendary offer roll (25% from stage 21); newly
obtained species always start at level 1. Unwanted offers can be skipped.
Level 4/5 cooldown floors prevent zero/negative intervals. Level 4/5 fuse marks
six/nine tiles of one type; only those marks detonate. Marks remain triple-balanced.

- **Stage 10 — Seal Guardian:** existing gradual equipment-return rules retained.
- **Stage 20 — Three Wards:** three marked tile types resist all automatic clears.
  A manual triple of a marked type permanently unlocks that type for the team.
  Other types remain available to all gear. Clear the whole board to win.
- **Stage 30 — Armored Dragon:** keep the full build. Bonus clears per action are
  capped at 3 groups, then 6 after 3 manual triples. At 6 manual triples, armor
  breaks and the normal chain allowance returns. Clear the whole board to win.
- All three Boss stages have no mid-stage supply. Stage-clear supply and endless
  continuation remain available; there is no forced ending at stage 30.
- New Boss effects use the inert overlay and guarded cleanup lifecycle; the live
  board is never transformed. Wards/armor have distinct entrance and break effects.

Old v3 checkpoints receive `trial: null` in live and Undo snapshots. A run already
inside old stage 20/30 is not given new restrictions retroactively. New guardians
activate when entering their stages. Board counts and score banking are unchanged.
Stage-10 speed records, failed submission payloads and old leaderboard rows retain
original IDs/levels. This is an additive rules update on the existing casual board;
historical results are not directly comparable across balance versions.

**Before publishing**, run `scripts/clackworks-companions.sql` in Supabase SQL
Editor. It extends the existing submission whitelist to levels 4/5 and preserves
rows, admins, permissions, deletion tombstones and idempotent retries.
No reset or secret key is needed.

Artwork: `assets/companions/{cats,dragons,birds,shells}.webp`, original PNGs,
`prompts.json`, and alpha-derived `atlas.js` view windows. Built-in image_gen made
the art; WebP encoding preserves composition and transparency. The browser clips
sprite windows without altering the source pixels. `scripts/build-companion-atlas.cjs`
rebuilds those windows using Sharp (optional `RAIN_SHARP` module path).

Checks: `test-clackworks-companions.cjs`, `test-clackworks-companions-browser.cjs`,
`test-rain-boss-sql.cjs` (PGlite), existing save/Boss/arsenal tests, stable layout
and raw mouse hit testing. Browser networking is mocked to avoid real score writes.

## Workshop presentation (earlier machine edition)

The workshop edition replaces the former third-party item pictures and soundtrack
with 12 original part icons, sixteen original machine icons and a
licensed jazz soundtrack. See `assets/README.md` for the asset map.
Names, descriptions, effects labels, home-page promotion and credits are bilingual.
The artwork uses the original faceless flat workshop objects. The former glove
and bulb are replaced by a pocket tape measure and a mini battery in the same style.
Production images retain transparent backgrounds and are compressed as WebP;
full prompts are recorded in the assets.

The initial workshop reskin was a presentation-only update: the layered matching rules, seven-slot tray,
gear interactions, drop weights, growth gates, Boss energy and all score timing
remain unchanged. Legacy internal IDs are deliberately retained in saves and
leaderboard payloads; existing runs/records display the new names automatically.
That reskin required no database migration or reset. The Arsenal expansion below
requires a small additive API migration before publishing.
This asset replacement is not a trademark clearance or a legal opinion.

## Rule verification

Expedition supplies can be skipped from either the offer or replacement screen.
Skipping keeps gear and charges unchanged, consumes that offer, clears Undo and
saves the result through the normal reward checkpoint. The initial starter choice
is still required. Existing v3 saves and leaderboard data require no migration.

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
- Recovery is armed before the locked HUD renders. A failed startup, completion
  render or effect cleanup cannot strand the animation input gate. HUD and
  reward/result presentation get one guarded retry without replaying game actions.
  `scripts/test-clackworks-effect-lifecycle-browser.cjs` covers these failures,
  including a real lightning chain that reaches a supply reward.
- Blast shakes and incoming stage boards animate inert visual copies. The live
  board keeps fixed hit regions; copies follow scrolling/resizing and reveal the
  original on completion, cancellation or reduced-motion changes. The entire FX
  layer ignores pointer input. `scripts/test-clackworks-surface-input-browser.cjs`
  checks first-click mouse response after repeated explosions and stage entries.
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
  25/35/45% chance to burn another board triple of the same type through covers.
  Boiler accumulates all recovered triples and blasts another every
  4/3/2 triples, through 1/2/3 blockers. Calibrator adds 5/10/15 percentage points to
  Welding Torch and Focus Prism chances. Evolved Calibrator raises the automatic-clear budget
  to 52 triples per action (otherwise `16 + 2 * equipped item types`).
- Chains use a bounded queue and only clear real complete triples. Mature builds
  can nearly clear a board; accessible triples and chance still matter. Fractional
  Flywheel recharge remains bounded, equipment never auto-casts itself, and animation
  delay is capped so a large burst does not lock input for tens of seconds.

### Stage-ten Boss: Emergency Lockdown

Stage 10 is the sealing Boss. Entering it seals **all passives and the active
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

## Historical machine identities (16 items)

Each item has a short role on its loadout chip, reward card and catalog entry.
The fixed-height feedback strip above the board names the actual effects, with
full contributions below the tools. Timed charges use local countdown pops;
Capacitor uses a straight violet beam; only Boiler uses wide blasts and shakes.
The animation layer remains inert and independent of the real board hit regions.

| Item | One main role | Trigger / targeting |
| --- | --- | --- |
| Telescopic Grabber | Reach below | Manually take one covered tile into the tray; recharge with manual triples. |
| Safety Cushion | Save a life | Reject one overflow pickup per stage. |
| Arc Coil | Clear exposed faces | Every four manual triples, clear 1/2/3 exposed board triples. No tray tiles or piercing; bank charge if no target. |
| Power Flywheel | Store active uses | Raise active-item storage and reduce its energy cost. |
| Welding Torch | Burn the same type | Each cleared triple can ignite another board triple of that exact type, ignoring covers (25/35/45% plus Calibrator). Fire can continue on the same type. |
| Overload Boiler | Open covered layers | Every 4/3/2 recovered triples, blast a board triple through 1/2/3 covers, prioritizing covered targets. All recoveries count. Holds pressure without a valid target. |
| Precision Calibrator | Improve chance | Add 5/10/15 percentage points to Prism and Torch chances; never changes fixed counters. |
| Vortex Vacuum | Manually finish a pair | Select the missing third tile through covers. |
| Sorting Scanner | Scout and mark | Preview supply piles and mark a type to match for a bounty. |
| Focus Prism | Critical match | Manual triples have 20/30/40% critical chance (plus Calibrator) to clear one extra triple through 1/2/3 covers. |
| Seeking Paper Rocket | Automatically finish pairs | Every 4/3/2 manual triples, finish up to 1/2/3 tray pairs through any cover. Hold the shot without a pair. |
| Clockwork Blast Can | Timed target | Mark three matching tiles; after 3/2/1 further manual triples, detonate only those three through any cover. |
| Reflux Turbine | Recharge | Every three gear-cleared triples grant 1/2/3 energy to active gear and uncharged Grabber progress. Feedback reports actual restored energy. |
| Afterglow Capacitor | Chain-powered piercing | Every 4/3/2 gear-cleared triples, clear one extra triple through one cover, at most once per action. It no longer charges Coil. |
| Echo Record | Follow the source | Follow the first successful clearing item for up to 1/2/3 triples using its targeting rule: Coil stays on exposed faces, Torch stays on the same type, Rocket needs another tray pair. No fallback to arbitrary triples. |
| Cleanup Press | Finish the board | After a manual match or Vacuum chain, sweep the remaining tiles at ≤9/12/15 tiles. |

Hidden Coil charging from Grabber/Scanner/Vacuum is removed. Its charge counter is
deterministic at every level; upgrading increases discharge size. Blast Can no
longer adds an unmarked second explosion at level 3. Synergies remain: Boiler
opens layers for Coil, recoveries feed Turbine/Capacitor, and Echo inherits source
targeting. Per-action guards and burst limits remain; mature builds can still
clear a whole page when targets and triggers line up.

Equipment IDs, v3 save shape, six passive slots, one active slot, Boss rules and
leaderboard RPCs remain compatible. Existing saved runs use the current rules
while retaining their inventory, board, counters and Undo. No new SQL is needed
for this balance update. New installations still require the arsenal allowlist
migration (`../scripts/clackworks-arsenal.sql`) or the current Boss migration.
Red-slot odds remain 18% before stage 11 and 25% thereafter.

Design references: the distinct targeting roles of RoR2's
[Ukulele](https://riskofrain2.wiki.gg/wiki/Ukulele),
[AtG Missile](https://riskofrain2.wiki.gg/wiki/AtG_Missile_Mk._1), and
[Sticky Bomb](https://riskofrain2.wiki.gg/wiki/Sticky_Bomb).
Names, illustrations and matching rules are original adaptations.

`test-clackworks-item-identities.cjs` checks concrete targets and trigger counts,
source-specific echoes and removal of hidden cross-triggers.
`test-clackworks-arsenal.cjs` covers conservation, bounded synergies, saves, Undo,
Shuffle and random boards. Browser checks cover bilingual roles, live contribution
feedback, fixed layout, animation cleanup and input recovery. Scores and Presence
are mocked during browser tests.

### Stable in-run layout

Equipment cards use fixed grid cells with reserved name/rarity/progress lines.
Owned-but-sealed controls and Coil/Scanner readouts keep their space during Boss
restoration. Dynamic hints have fixed-height, scrollable regions; full equipment
state is also available in the detail dialog. The fixed-height chain log lives
below the playfield and tools. Updates no longer move the board or tray when a
label wraps, a fuse arms, scanning ends, or a burst adds more item summaries.
`test-clackworks-layout-browser.cjs` measures document and viewport positions
through 96 status changes in both languages at four widths, plus Boss restores.
