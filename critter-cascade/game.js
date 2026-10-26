(function () {
  'use strict';
  const { ITEMS, MODES } = RainMatch;
  const $ = id => document.getElementById(id);
  const modal = $('modal');
  const fx = RainEffects;
  const music = new RainMusic();
  music.onError = () => { $('music-error').hidden = false; localizePage(); };
  let animating = false, targeting = null, stageRewardClaimed = false, replacementItem = null, selectedRelic = null, selectedReward = null, selectedReplacement = null;
  let activeEffect = null, atmosphereKey = '', atmosphereTime = 0;
  let lastProc = null, lightningMarks = new Set();
  const isExpedition = () => game?.mode === 'expedition';
  const recovered = () => isExpedition() ? game.recovered : game.cleared;
  let storage;
  try { storage = window.localStorage; } catch (_) { storage = null; }
  const readPreference = key => { try { return storage?.getItem(key); } catch (_) { return null; } };
  const savePreference = (key, value) => { try { storage?.setItem(key, value); } catch (_) { /* Preferences are optional. */ } };
  let eclipseIntroHidden = readPreference('critter-eclipse-hide-intro') === 'yes', eclipseDialogScroll = null;
  const saveStore = new RainSave.Store(storage, navigator.locks);
  let saveState = saveStore.read(), saveNote = saveState.error, savePaused = false, lastCheckpoint = 0, navigationToken = 0, acquiringSave = false;
  const leaderboard = new RainLeaderboard.Leaderboard(window.RAIN_CONFIG);
  let language = readPreference('rain-match-language') === 'en' ? 'en' : 'zh';
  const t = (key, values) => RainI18n.translate(language, key, values);
  const itemName = type => language === 'en' ? ITEMS[type].en : ITEMS[type].name;
  const modeName = mode => t(`${mode}Title`);
  let welcomeOpen = true;
  let game, timerStarted = false, elapsed = 0, tick = performance.now(), clockActive = false, sound = readPreference('rain-match-effects') === 'on', comboTimeout;
  music.setEffects(sound);
  let savedWin = false, finalized = false, receipt = null, runId, dialogView = null, rankingMode = 'expedition_distance', rankingPeriod = 'formal';
  let tenTime = null, tenRecord = null, tenSubmitting = false, expeditionBoard = 'expedition_distance';
  let submitting = false, submissionPayload = null, rankingRequest = 0;
  let rankingData = null, rankingError = '', rankingLoading = false;
  const rankingCache = new Map();
  let presence, presenceView = { status: 'connecting' };
  let playerDraft = readPreference('rain-match-player') || '', formError = '', lastStatus = null;
  let wins = Math.max(0, Number(readPreference('rain-match-wins')) || 0);
  const formatTime = (ms, precise = false) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${precise ? '.' + String(ms % 1000).padStart(3, '0') : ''}`;
  function updateClock() {
    const now = performance.now();
    if (clockActive && timerStarted) elapsed += now - tick;
    if (clockActive && (isExpedition() || game.mode === 'eclipse')) {
      const delta = now - tick;
      game.advanceEnvironment(delta);
      const hit = game.advancePressure(delta);
      if (hit) {
        const currentGame = game, currentRun = runId;
        queueMicrotask(() => {
          if (game !== currentGame || runId !== currentRun) return;
          render(); syncClock();
          if (hit.ended) { cancelEffects(); showResult(true); }
          else if (!modal.open && !document.hidden) fx.atmosphere('warning').catch(() => {});
        });
      }
      const key = `${runId}:${game.stage}`;
      if (key !== atmosphereKey) { atmosphereKey = key; atmosphereTime = 0; }
      if (game.bossActive && [30,60,70,100].includes(game.stage) && (atmosphereTime += delta) >= 12000) {
        atmosphereTime %= 12000;
        queueMicrotask(() => { if (!document.hidden && !modal.open && !animating && key === `${runId}:${game.stage}`) fx.atmosphere().catch(() => {}); });
      }
    }
    tick = now;
  }
  function syncClock() {
    clockActive = !welcomeOpen && !!game && game.status === 'playing' && !finalized && !animating && !document.hidden && !modal.open && !game.pendingReward && !savePaused;
  }
  function closeDialog() {
    updateClock();
    const eclipseScroll = dialogView === 'eclipse' ? eclipseDialogScroll : null;
    const startingPressure = dialogView === 'boss' && game?.pressure && !game.pressure.started;
    if (startingPressure) { game.startPressure(); checkpoint(); }
    if (dialogView === 'environment' && game?.environment && !game.environment.started) { game.startEnvironment(); checkpoint(); }
    if (modal.open) modal.close(); dialogView = null; syncClock();
    // Native dialog closing can focus an old header button and scroll away
    // from the board, especially after a touch restart. Keep the reading spot.
    if (eclipseScroll) { eclipseDialogScroll = null; window.scrollTo({ ...eclipseScroll, behavior: 'instant' }); }
    if (startingPressure) $('pressure-status').scrollIntoView({block: 'start'});
  }
  function dismissDialog() {
    // Cancelling Continue before any run starts must not expose the disabled
    // Drizzle preview that was prepared behind the welcome screen.
    const returnToWelcome = !runId && ['resume', 'saveLocked'].includes(dialogView);
    closeDialog();
    if (returnToWelcome) {
      navigationToken++; saveStore.release(); welcomeOpen = true; savePaused = true; clockActive = false;
      const space = document.querySelector('.play-space'); space.hidden = true; space.inert = true;
      saveState = saveStore.read(); renderWelcome(); $('welcome-screen').hidden = false;
      window.scrollTo(0, 0);
      (saveState.record ? $('welcome-continue') : document.querySelector('[data-welcome-mode=drizzle]')).focus({ preventScroll: true });
    }
  }
  function cancelEffects() {
    clearTimeout(activeEffect?.timer); activeEffect = null;
    animating = false;
    resetEffects();
  }
  function resetEffects() {
    // Cleanup is optional presentation work too: neither renderer may keep input locked.
    for (const reset of [() => fx.reset(), () => music.cancelEffects()]) {
      try { reset(); } catch (error) { console.warn('Critter Cascade effect cleanup skipped:', error); }
    }
  }
  function playEffect(play, after = () => {}) {
    const effect = { run: runId };
    activeEffect = effect; animating = true;
    const finish = () => {
      if (activeEffect !== effect || effect.run !== runId) return;
      clearTimeout(effect.timer); activeEffect = null;
      updateClock(); animating = false;
      // A HUD failure must not suppress the reward/result transition. Retry the
      // presentation once in the next microtask, without replaying the action.
      for (const complete of [() => render(), after]) {
        try { complete(); }
        catch (error) {
          console.warn('Critter Cascade effect completion retry:', error);
          queueMicrotask(() => {
            if (effect.run !== runId || activeEffect) return;
            try { complete(); } catch (retryError) { console.warn('Critter Cascade effect completion skipped:', retryError); }
            syncClock();
          });
        }
      }
      syncClock();
    };
    effect.skip = () => { if (activeEffect === effect) { resetEffects(); finish(); } };
    // Arm recovery BEFORE rendering the locked HUD; startup and completion
    // errors need the same protection as a rejected native animation promise.
    effect.timer = setTimeout(effect.skip, 4500);
    try { render(); syncClock(); }
    catch (error) { console.warn('Critter Cascade effect startup skipped:', error); effect.skip(); return; }
    Promise.resolve().then(() => activeEffect === effect ? play() : undefined)
      .catch(error => { console.warn('Critter Cascade effect skipped:', error); if (activeEffect === effect) resetEffects(); })
      .then(finish);
    if (document.hidden) effect.skip();
  }
  // State has already settled before effects start. A fresh press may finish
  // presentation immediately; enable the original button before its native click.
  const gameplayControls = '#board button, #reserve button, #remove, #undo, #shuffle, #expedition-feather, #expedition-active';
  let suppressEffectClick = false;
  document.addEventListener('pointerdown', event => {
    suppressEffectClick = false;
    if (event.button !== 0 || !activeEffect || modal.open || !event.target.closest(gameplayControls)) return;
    activeEffect.skip();
    // Touch browsers can retarget the generated click to the new dialog.
    suppressEffectClick = modal.open;
  }, true);
  document.addEventListener('click', event => {
    if (suppressEffectClick || (modal.open && event.target.closest(gameplayControls))) {
      suppressEffectClick = false; event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  function beep(matched = false) { music.sound(matched ? 'match' : 'pick'); }

  function tileElement(tile, interactive = true) {
    const item = ITEMS[tile.type], el = document.createElement(interactive ? 'button' : 'div');
    el.className = 'tile'; el.dataset.id = tile.id; el.dataset.type = tile.type;
    el.style.setProperty('--rarity', item.color); el.title = itemName(tile.type);
    el.setAttribute('aria-label', itemName(tile.type));
    const img = document.createElement('img');
    img.src = `assets/tiles/${item.icon}.webp`; img.alt = ''; img.draggable = false;
    img.addEventListener('error', () => { el.textContent = itemName(tile.type); el.style.fontSize = '9px'; });
    el.append(img);
    decorateTarget(el, tile);
    return el;
  }
  function decorateTarget(el, tile) {
    const lightning = lightningMarks.has(tile.id);
    const fused = isExpedition() && game.fuse?.ids.includes(tile.id);
    el.classList.toggle('ward-mark', isExpedition() && !!game.trial && !game.procAllowed(tile));
    el.classList.toggle('lightning-mark', !!lightning); el.classList.toggle('fuse-mark', !!fused);
    el.querySelector('.fuse-count')?.remove();
    if (fused) { const badge = document.createElement('span'); badge.className = 'fuse-count'; badge.textContent = game.fuse.ticks; badge.title = t('expFuseTile', { n: game.fuse.ticks }); el.append(badge); }
  }
  function localizePage() {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    document.title = t('title'); document.querySelector('meta[name="description"]').content = t('description');
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $('music-toggle').textContent = t(music.playing ? 'musicPause' : 'musicPlay');
    $('music-toggle').setAttribute('aria-pressed', String(music.playing));
    $('brand-name').textContent = t('brand'); document.querySelector('.brand').setAttribute('aria-label', t('home'));
    const labels = { sound: $('music-panel').hidden ? 'musicOpen' : 'musicClose', help: 'help', restart: 'restart', timer: 'time', board: 'board', rack: 'inventory', 'close-modal': 'close' };
    for (const [id, key] of Object.entries(labels)) {
      $(id).setAttribute('aria-label', t(key));
      if (id === 'board') $(id).removeAttribute('title');
      else $(id).title = t(key);
    }
    for (const id of ['language', 'modal-language', 'welcome-language']) {
      $(id).textContent = language === 'zh' ? 'EN' : '中文'; $(id).setAttribute('aria-label', t('language')); $(id).title = t('language');
    }
    for (const tool of ['remove', 'undo', 'shuffle']) $(tool).title = t(`${tool}Hint`);
    document.querySelector('.difficulty-options').setAttribute('aria-label', t('difficulty'));
    document.querySelector('.game-panel').setAttribute('aria-label', t('game'));
    document.querySelector('.progress-track').setAttribute('aria-label', t('progress'));
    document.querySelectorAll('[data-mode]').forEach(button => {
      button.textContent = t(button.dataset.mode);
      button.title = button.dataset.mode === 'expedition' ? t('expModeHint') : t('modeHint', { mode: modeName(button.dataset.mode), n: MODES[button.dataset.mode].count });
    });
    $('inline-ranking-tabs').setAttribute('aria-label', t('rankingModes'));
    renderRankings();
    renderPresence();
    renderWelcome();
    $('effects').textContent = t(sound ? 'soundOff' : 'soundOn');
    $('effects').setAttribute('aria-pressed', String(sound));
    $('wins').textContent = String(wins).padStart(2, '0');
  }
  function renderWelcome() {
    const record = saveState.record;
    $('welcome-resume').hidden = !record;
    $('welcome-save-summary').textContent = record ? t('saveSummary', {
      stage: record.game.stage, n: record.game.banked + record.game.cleared, time: formatTime(record.elapsedMs)
    }) : '';
  }
  function enterPlay() {
    if (!welcomeOpen) return;
    welcomeOpen = false;
    $('welcome-screen').hidden = true;
    const space = document.querySelector('.play-space'); space.hidden = false; space.inert = false;
    window.scrollTo(0, 0);
  }
  function renderPresence() {
    const state = presenceView.status;
    $('presence-status').dataset.state = state;
    $('presence-status').title = t('onlineHint');
    $('presence-text').textContent = state === 'ready' ? t('onlineCount', { n: presenceView.total, expedition: presenceView.expedition })
      : t(state === 'idle' ? 'onlineIdle' : state === 'connecting' ? 'onlineConnecting' : 'onlineUnavailable');
  }
  const newRunId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, digit => (Number(digit) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(digit) / 4).toString(16));
  function captureTen() {
    if (!isExpedition() || !game.competitive || game.completedStages < 10 || tenTime !== null) return;
    tenTime = Math.round(elapsed);
    tenRecord = { runId: newRunId(), elapsedMs: tenTime, cleared: game.recovered, loadout: game.loadout(), playerId: null, receipt: null };
  }
  function updateSaveLabel() {
    if (!$('expedition-save-status')) return;
    $('expedition-save-status').textContent = t(savePaused ? 'saveConflict' : saveNote ? 'saveUnavailable' : 'saveLocal');
    $('expedition-save-status').classList.toggle('save-warning', !!saveNote || savePaused);
  }
  function checkpoint() {
    if (!isExpedition() || !saveStore.owned || savePaused || !runId) { updateSaveLabel(); return; }
    lastCheckpoint = performance.now();
    captureTen();
    const record = { schema: 3, savedAt: Date.now(), runId, elapsedMs: elapsed, timerStarted, finalized, receipt,
      submissionPayload, stageRewardClaimed, playerDraft, tenTime, tenRecord, game: game.toSave() };
    const result = saveStore.write(record);
    if (result.ok) { saveNote = null; saveState = { record, raw: saveStore.expected, error: null, recovered: false }; }
    else {
      saveNote = result.error;
      if (['conflict', 'locked'].includes(result.error)) {
        savePaused = true; clockActive = false; saveStore.release();
        queueMicrotask(() => { showSaveLocked(); render(); });
      }
    }
    updateSaveLabel();
  }
  function renderResumeBanner() {
    if (!$('resume-banner')) return;
    const available = saveState.record || saveState.error === 'corrupt';
    $('resume-banner').hidden = !available || (isExpedition() && !savePaused);
    if (!available) return;
    $('resume-summary').textContent = saveState.record ? t('saveSummary', {
      stage: saveState.record.game.stage, n: saveState.record.game.banked + saveState.record.game.cleared,
      time: formatTime(saveState.record.elapsedMs)
    }) : t('saveCorrupt');
  }
  function showResume() {
    saveState = saveStore.read();
    const record = saveState.record;
    showDialog('resume', `<span class="modal-eyebrow">EXPEDITION / CONTINUE</span><h2 id="modal-title">${t(record ? 'saveFound' : 'saveProblem')}</h2><p>${record ? t('saveSummary', { stage: record.game.stage, n: record.game.banked + record.game.cleared, time: formatTime(record.elapsedMs) }) : t('saveCorrupt')}</p><p>${t('saveScope')}</p>${saveState.recovered ? `<p>${t('saveRecovered')}</p>` : ''}${record ? `<button class="primary-button" id="resume-confirm">${t('saveContinue')}</button>` : ''}<button class="secondary-button" id="resume-new">${t('saveNew')}</button><p class="input-hint">${t('saveReplace')}</p>`);
    $('resume-confirm')?.addEventListener('click', () => beginExpedition(true));
    $('resume-new').addEventListener('click', () => beginExpedition(false));
  }
  function requestExpedition() {
    saveState = saveStore.read();
    if (saveState.record || saveState.error === 'corrupt') showResume();
    else beginExpedition(false);
  }
  async function beginExpedition(resume) {
    if (acquiringSave) return;
    acquiringSave = true;
    const token = ++navigationToken;
    const acquired = await saveStore.acquire(); acquiringSave = false;
    if (!acquired) { if (token === navigationToken) showSaveLocked(); return; }
    if (token !== navigationToken) { saveStore.release(); return; }
    saveState = saveStore.read(); saveStore.adopt(saveState.raw);
    if (resume && !saveState.record) { saveStore.release(); showResume(); return; }
    if (resume) restoreRun(saveState.record);
    else { start('expedition'); }
  }
  function restoreRun(record) {
    enterPlay();
    cancelEffects(); closeDialog(); clockActive = false;
    game = RainExpedition.Expedition.fromSave(record.game); elapsed = record.elapsedMs; tick = performance.now();
    timerStarted = record.timerStarted ?? (elapsed > 0 || game.totalMoves > 0);
    runId = record.runId; finalized = record.finalized; receipt = record.receipt; submissionPayload = record.submissionPayload;
    tenTime = record.tenTime; tenRecord = record.tenRecord; tenSubmitting = false;
    stageRewardClaimed = record.stageRewardClaimed; playerDraft = record.playerDraft;
    savedWin = false; submitting = false; formError = ''; lastStatus = null;
    animating = false; targeting = null; replacementItem = null; selectedReward = null; selectedReplacement = null; savePaused = false;
    clearTimeout(comboTimeout); $('combo').classList.remove('show'); $('board').replaceChildren();
    document.querySelectorAll('[data-mode]').forEach(button => {
      const selected = button.dataset.mode === 'expedition'; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    $('timer').textContent = formatTime(elapsed); render(); refreshRankings('expedition');
    if (game.pendingReward) showExpeditionReward();
    else if (game.status !== 'playing') showResult();
    else if (game.pressure && !game.pressure.started) showBossIntro();
    else if (game.environment && !game.environment.started) showEnvironmentIntro();
    syncClock();
  }
  function confirmRestart() {
    if (!isExpedition()) { start(); return; }
    updateClock(); checkpoint();
    showDialog('restartRun', `<h2 id="modal-title">${t('saveRestartTitle')}</h2><p>${t('saveReplace')}</p><button class="primary-button" id="restart-confirm">${t('saveNew')}</button><button class="secondary-button" id="restart-cancel">${t('expStay')}</button>`);
    $('restart-confirm').addEventListener('click', () => beginExpedition(false));
    $('restart-cancel').addEventListener('click', closeDialog);
  }
  function showSaveLocked() {
    showDialog('saveLocked', `<h2 id="modal-title">${t('saveLockedTitle')}</h2><p>${t('saveLockedCopy')}</p><button class="primary-button" id="save-lock-retry">${t('saveContinue')}</button>`);
    $('save-lock-retry').addEventListener('click', () => beginExpedition(true));
  }
  $('resume-expedition').addEventListener('click', showResume);

  function start(mode = game?.mode || 'expedition') {
    if (mode === 'expedition' && !saveStore.owned) { requestExpedition(); return; }
    const restartView = !welcomeOpen && runId && mode === game?.mode ? { left: scrollX, boardTop: $('board').getBoundingClientRect().top } : null;
    enterPlay();
    if (isExpedition()) { updateClock(); checkpoint(); }
    if (mode !== 'expedition') saveStore.release();
    savePaused = false;
    cancelEffects();
    const outgoing = runId && game ? fx.captureBoard() : null;
    animating = !!runId;
    closeDialog(); game = mode === 'expedition' ? new RainExpedition.Expedition() : mode === 'eclipse' ? new CritterEclipse.Eclipse() : new RainMatch.Game(mode);
    targeting = null; stageRewardClaimed = false; replacementItem = null; selectedReward = null; selectedReplacement = null; timerStarted = false; elapsed = 0; tick = performance.now();
    savedWin = false; finalized = false; receipt = null; formError = ''; lastStatus = null; submitting = false; submissionPayload = null;
    tenTime = null; tenRecord = null; tenSubmitting = false;
    runId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, digit => (Number(digit) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(digit) / 4).toString(16));
    clearTimeout(comboTimeout); $('combo').classList.remove('show');
    $('board').replaceChildren(); $('timer').textContent = '00:00';
    document.querySelectorAll('[data-mode]').forEach(button => {
      const selected = button.dataset.mode === game.mode;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    refreshRankings(game.mode);
    if (animating) {
      playEffect(() => { music.sound('restart'); return fx.restart(outgoing); }, () => {
        if (isExpedition()) showExpeditionReward();
        else if (game.mode === 'eclipse' && !eclipseIntroHidden) showEclipseIntro();
      });
    } else {
      render(true); syncClock();
      if (isExpedition()) showExpeditionReward();
      else if (game.mode === 'eclipse' && !eclipseIntroHidden) showEclipseIntro();
    }
    // Anchor the board rather than the document offset: a fresh Expedition
    // team can make the panel above the mobile board shorter.
    if (restartView) window.scrollTo({ left: restartView.left, top: scrollY + $('board').getBoundingClientRect().top - restartView.boardTop, behavior: 'instant' });
  }
  function render(enter = false) {
    game.refreshEnvironment?.();
    lightningMarks = new Set(isExpedition() ? game.lightningTarget || [] : []);
    $('timer').title = t(timerStarted ? 'time' : 'timerWaiting');
    $('mode-title').textContent = isExpedition() ? t('expStage', { n: game.stage }) + ' · ' + modeName(game.mode) : modeName(game.mode);
    const available = new Set(game.available().map(tile => tile.id));
    const targets = new Set(isExpedition() && targeting ? (targeting === 'feather' ? game.featherTargets() : game.cubeTargets()).map(tile => tile.id) : []);
    const preview = new Set(isExpedition() ? game.previewIds() : []);
    const existing = new Map([...$('board').children].map(el => [Number(el.dataset.id), el]));
    for (const tile of game.tiles) {
      let el = existing.get(tile.id);
      if (tile.zone !== 'board') { el?.remove(); continue; }
      if (el && Number(el.dataset.type) !== tile.type) { el.remove(); el = null; }
      if (!el) {
        el = tileElement(tile); el.dataset.pile = tile.pile;
        el.style.left = `${tile.x / 6}%`; el.style.top = `${tile.y / 5.9}%`; el.style.zIndex = tile.z + 1;
        if (enter && available.has(tile.id)) el.classList.add('fresh');
        $('board').append(el);
      }
      const blocked = !available.has(tile.id);
      el.disabled = (targeting ? !targets.has(tile.id) : blocked) || game.status !== 'playing' || finalized || animating || savePaused || !!game.pendingReward;
      el.classList.toggle('blocked', blocked && !targets.has(tile.id));
      el.classList.toggle('relic-target', targets.has(tile.id)); el.classList.toggle('feather-target', targeting === 'feather' && targets.has(tile.id));
      el.style.zIndex = targets.has(tile.id) ? 100 + tile.z : tile.z + 1;
      const pair = game.rack.filter(id => game.tiles[id].type === tile.type).length === 2;
      el.classList.toggle('radar-pair', isExpedition() && game.radarActive && (tile.type === game.radarMark || (!blocked && pair)));
      const blind = blocked && ['left', 'right'].includes(tile.pile) && !preview.has(tile.id) && !targets.has(tile.id);
      el.classList.toggle('blind', blind);
      decorateTarget(el, tile);
      el.title = blind ? t('blindTile') : itemName(tile.type); el.setAttribute('aria-label', blind ? t('blindTile') : itemName(tile.type) + (blocked ? t('covered') : ''));
    }
    $('rack').replaceChildren();
    for (let i = 0; i < 7; i++) {
      const slot = document.createElement('div'); slot.className = 'slot';
      if (game.rack[i] !== undefined) slot.append(tileElement(game.tiles[game.rack[i]], false));
      else slot.setAttribute('aria-label', t('emptySlot', { n: i + 1 }));
      $('rack').append(slot);
    }
    const oldReserve = [...$('reserve').children];
    const reserveTiles = game.reserve.map(id => {
      const tile = game.tiles[id];
      const el = oldReserve.find(el => Number(el.dataset.id) === id && Number(el.dataset.type) === tile.type) || tileElement(tile);
      el.disabled = finalized || animating || savePaused || !!game.pendingReward || !!targeting || game.status !== 'playing';
      el.title = itemName(tile.type); el.setAttribute('aria-label', itemName(tile.type)); decorateTarget(el, tile);
      return el;
    });
    // Preserve the native press target when an effect is skipped on pointerdown.
    if (oldReserve.length !== reserveTiles.length || reserveTiles.some((el, i) => el !== oldReserve[i])) $('reserve').replaceChildren(...reserveTiles);
    $('reserve-area').hidden = !game.reserve.length;
    $('capacity').innerHTML = `${game.rack.length} <span>/ 7</span>`;
    $('cleared').textContent = game.cleared; $('total').textContent = ` / ${game.tiles.length}`;
    $('remaining').textContent = t('remaining', { n: game.tiles.filter(tile => tile.zone === 'board').length });
    for (const pile of ['left', 'right']) {
      const count = game.tiles.filter(tile => tile.zone === 'board' && tile.pile === pile).length;
      $(`${pile}-pile-count`).textContent = `${t(pile)} · ${count || t('emptyPile')}`;
    }
    const progress = Math.round(game.cleared / game.tiles.length * 100);
    $('progress').style.width = `${progress}%`; document.querySelector('.progress-track').setAttribute('aria-valuenow', progress);
    const danger = game.rack.length >= 5;
    $('rack').classList.toggle('danger', danger); $('status').classList.toggle('danger', danger);
    $('status').textContent = lastStatus ? t(lastStatus) : receipt ? t('statusFinal') : finalized ? t('statusPending') : isExpedition() && game.finished ? t('expEnded') : game.status === 'won' ? t('statusWon')
      : game.status === 'lost' ? t('statusLost') : danger ? t('statusDanger', { n: 7 - game.rack.length }) : t('statusReady');
    for (const name of ['remove', 'undo', 'shuffle']) {
      $(name).disabled = finalized || animating || savePaused || !game.canUse(name); $(name).classList.toggle('used', game.used[name]);
      $(name).querySelector('.charge').textContent = t(game.used[name] ? 'used' : 'free');
    }
    $('result-button').hidden = game.status === 'playing' || (isExpedition() && game.status === 'won');
    $('result-button').disabled = savePaused || animating;
    document.querySelector('.free-note').textContent = t(isExpedition() ? 'expFree' : 'freeNote');
    document.querySelector('[data-i18n=boardHint]').textContent = t(isExpedition() ? 'expBoardHint' : 'boardHint');
    music.setScene(isExpedition() ? game.stage : 1, !!game.bossActive, danger);
    renderExpedition(); renderEnvironment(); renderPressure();
    checkpoint(); renderResumeBanner();
    presence?.setMode(game.mode);
  }
  function pick(id) {
    if (modal.open || finalized || animating || savePaused) return;
    const before = fx.snapshot();
    updateClock();
    if (isExpedition() && targeting === 'blackhole') { activateExpedition(id); return; }
    const result = game.pick(id, targeting === 'feather');
    if (result.ok && !timerStarted) { timerStarted = true; tick = performance.now(); }
    syncClock(); if (!result.ok) return;
    targeting = null;
    lastStatus = null; beep(result.matched); render();
    if (!result.events?.some(event => event.kind === 'shield')) {
      try { fx.pick(before, id, result.type, result.matched, (result.events || []).filter(event => event.ids.length === 3).flatMap(event => event.ids)); }
      catch (error) { console.warn('Critter Cascade pick effect skipped:', error); fx.reset(); }
    }
    if (result.matched) {
      $('combo').textContent = t('match', { item: itemName(result.type) });
      $('combo').classList.remove('show'); void $('combo').offsetWidth;
      $('combo').classList.add('show'); clearTimeout(comboTimeout);
      comboTimeout = setTimeout(() => $('combo').classList.remove('show'), 1850);
    }
    if (isExpedition()) { finishExpeditionAction(before, result.events || [], result.recovered); return; }
    if (game.status !== 'playing') showResult(true);
  }
  function use(name) {
    if (activeEffect && !modal.open) { activeEffect.skip(); if (modal.open) return; }
    if (finalized || animating || savePaused) return;
    const before = fx.snapshot();
    updateClock(); if (!game.use(name)) return;
    targeting = null;
    closeDialog(); music.sound(name);
    formError = ''; lastStatus = { remove: 'removed', undo: 'undone', shuffle: 'shuffled' }[name];
    playEffect(() => fx.power(name, before));
  }
  function showDialog(view, content) {
    updateClock(); dialogView = view; $('modal-content').innerHTML = content;
    if (!modal.open) modal.showModal(); syncClock();
  }
  function showResult(animateScene = false) {
    if (game.status === 'playing') return;
    if (isExpedition() && game.status === 'won') { showExpeditionStage(animateScene === true); return; }
    const won = game.status === 'won';
    if (animateScene === true) music.sound(won ? 'win' : 'lose');
    if (won && !savedWin) {
      savedWin = true; wins++; $('wins').textContent = String(wins).padStart(2, '0'); savePreference('rain-match-wins', String(wins));
    }
    const canSubmit = !isExpedition() || game.competitive || !!submissionPayload;
    const rescue = !won && !finalized && (game.canUse('remove') || game.canUse('undo'));
    showDialog('result', `${fx.resultScene(won, t(won ? 'escapeSignal' : 'defeatSignal'), animateScene === true)}<span class="modal-eyebrow">${modeName(game.mode)}</span>
      <h2 id="modal-title">${t(isExpedition() ? 'expEnded' : won ? 'wonTitle' : game.pressure?.hearts === 0 ? 'pressureLostTitle' : 'lostTitle')}</h2>
      <p>${t(game.pressure?.hearts === 0 ? game.mode === 'eclipse' ? 'eclipseDefeat' : 'pressureDefeat' : rescue ? 'rescueCopy' : isExpedition() ? 'expEndedCopy' : won ? 'wonCopy' : 'lostCopy')}</p>
      <div class="result-stats"><span>${t('recovered')}<b>${recovered()}${isExpedition() ? '' : ' / ' + game.tiles.length}</b></span><span>${t('time')}<b>${formatTime(Math.round(elapsed), true)}</b></span><span>${t(isExpedition() ? 'expReached' : 'moves')}<b>${isExpedition() ? game.stage : game.moves}</b></span></div>${isExpedition() ? loadoutMarkup() + `<p class="build-summary">${t('expBestChain', { n: game.bestChain })}</p>` : ''}
      ${rescue && game.canUse('remove') ? `<button class="secondary-button" data-rescue="remove">${t('rescueRemove')}</button>` : ''}
      ${rescue && game.canUse('undo') ? `<button class="secondary-button" data-rescue="undo">${t('rescueUndo')}</button>` : ''}
      <div class="score-entry"><p class="scope-note">${t('rankingScope')}</p>
      ${!canSubmit ? `<p>${t('expLegacyRun')}</p>` : receipt ? `<p id="save-feedback" class="save-feedback" role="status" tabindex="-1">${t(receipt.improved ? 'saved' : 'notBest', { rank: receipt.rank })}</p>` :
        `<form id="score-form" novalidate><label for="player-id">${t('player')}</label><div class="score-input-row"><input id="player-id" name="player-id" type="text" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="id-rules score-error" placeholder="${t('playerPlaceholder')}" required><button class="primary-button" type="submit" ${submitting || !leaderboard.configured ? 'disabled' : ''}>${t(submitting ? 'sending' : rescue ? 'submitEnd' : 'submit')}</button></div><p id="id-rules" class="input-hint">${t('idRules')}</p><p id="score-error" class="form-error" role="alert">${formError ? t(formError === 'notConfigured' ? game.mode === 'eclipse' ? 'eclipseDatabase' : isExpedition() ? 'expDatabase' : formError : formError) : !leaderboard.configured ? t('notConfigured') : ''}</p></form>`}
      <button class="text-button" id="view-result-rankings">${t('seeRankings')}</button></div>
      <button class="primary-button" data-new-run>${t(won && game.mode === 'drizzle' ? 'nextRain' : 'again')}</button>`);
    $('modal-content').querySelectorAll('[data-rescue]').forEach(button => button.addEventListener('click', () => use(button.dataset.rescue)));
    $('modal-content').querySelector('[data-new-run]').addEventListener('click', () => start(won && game.mode === 'drizzle' ? 'rain' : game.mode));
    $('view-result-rankings').addEventListener('click', () => showRankings(game.mode));
    if (!receipt && canSubmit) {
      $('player-id').value = playerDraft;
      $('player-id').readOnly = !!submissionPayload;
      $('player-id').addEventListener('input', () => { playerDraft = $('player-id').value; checkpoint(); });
      $('score-form').addEventListener('submit', async event => {
        event.preventDefault(); if (receipt || submitting || savePaused || game.status === 'playing') return;
        playerDraft = RainLeaderboard.normalizeId($('player-id').value);
        if (!RainLeaderboard.validId(playerDraft)) {
          formError = 'invalidId'; $('score-error').textContent = t(formError);
          $('player-id').setAttribute('aria-invalid', 'true'); $('player-id').focus(); return;
        }
        if (!leaderboard.configured) { formError = 'notConfigured'; showResult(); return; }
        // Freeze this run on submission, including after an ambiguous timeout.
        // A retry sends the same ID and payload, so the database can deduplicate it.
        submissionPayload ||= { runId, playerId: playerDraft, mode: game.mode, cleared: recovered(), elapsedMs: Math.round(elapsed), ...(isExpedition() ? { rules: 3, stage: game.stage, completedStages: game.completedStages, tenMs: tenTime, loadout: game.loadout() } : {}) };
        const submittingRun = runId;
        finalized = true; submitting = true; formError = ''; lastStatus = null;
        syncClock(); render(); showResult();
        const result = await leaderboard.submit(submissionPayload);
        if (runId !== submittingRun) return;
        submitting = false;
        if (!result.ok) formError = result.error;
        else {
          receipt = result; playerDraft = result.playerId; savePreference('rain-match-player', playerDraft);
          rankingCache.delete('formal:expedition_distance'); rankingCache.delete('formal:expedition_speed');
          rankingCache.delete('formal:' + game.mode); rankingPeriod = 'formal'; refreshRankings(game.mode, true);
        }
        render();
        if (modal.open && dialogView === 'result') { showResult(); (receipt ? $('save-feedback') : $('score-error')).focus(); }
      });
    }
  }
  function renderRankings() {
    const content = $('inline-ranking-content');
    const expeditionRanking = rankingMode.startsWith('expedition');
    $('leaderboard-title').textContent = t('modeRankingTitle', {mode: t(expeditionRanking ? 'expedition' : rankingMode)});
    $('ranking-period-tabs').hidden = !expeditionRanking;
    $('ranking-period-tabs').setAttribute('aria-label', t('rankingPeriod'));
    $('ranking-period-tabs').querySelectorAll('button').forEach(button => {
      const selected = button.dataset.rankingPeriod === rankingPeriod;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    $('ranking-period-note').textContent = t(rankingPeriod === 'beta' ? 'betaBoardNote' : 'formalBoardNote');
    content.setAttribute('aria-busy', String(rankingLoading));
    $('refresh-rankings').disabled = rankingLoading || !leaderboard.configured;
    $('inline-ranking-tabs').querySelectorAll('[data-leaderboard-mode]').forEach(button => {
      const selected = button.dataset.leaderboardMode === (rankingMode.startsWith('expedition') ? 'expedition' : rankingMode);
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    $('expedition-ranking-tabs').hidden = !rankingMode.startsWith('expedition');
    $('expedition-ranking-tabs').querySelectorAll('button').forEach(button => { const selected = button.dataset.expBoard === rankingMode; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
    document.querySelector('.ranking-rules').textContent = t(rankingMode === 'expedition_distance' ? 'expDistanceRules' : rankingMode === 'expedition_speed' ? 'expSpeedRules' : 'rankingRules');
    if (rankingLoading) {
      content.innerHTML = `<p class="empty-ranking" role="status">${t('loading')}</p>`; return;
    }
    if (rankingError) {
      let message = rankingError;
      if (rankingError === 'notConfigured') {
        if (rankingPeriod === 'beta') message = 'betaPending';
        else if (rankingMode.startsWith('expedition')) message = 'expDatabase';
        else if (rankingMode === 'eclipse') message = 'eclipseDatabase';
      }
      content.innerHTML = `<p class="form-error" role="status">${t(message)}</p>`; return;
    }
    const { entries = [], total = 0 } = rankingData || {};
    content.innerHTML = entries.length ? `<div class="ranking-scroll" tabindex="0" role="region" aria-label="${modeName(rankingMode)}"><table class="ranking-table"><caption class="visually-hidden">${modeName(rankingMode)}</caption><thead><tr><th scope="col">${t('rank')}</th><th scope="col">${t('player')}</th><th scope="col">${t(['expedition_distance', 'expedition_speed'].includes(rankingMode) ? 'expCompleted' : 'score')}</th><th scope="col">${t('duration')}</th></tr></thead><tbody id="ranking-rows"></tbody></table></div><p class="ranking-count">${t('leaderboardCount', { n: total })}</p>`
      : `<div class="ranking-empty"><span aria-hidden="true">⚙</span><p class="empty-ranking" role="status">${t('noScores')}</p></div>`;
    const ownId = receipt?.playerId || readPreference('rain-match-player');
    entries.slice(0, 10).forEach((entry, index) => {
      const row = document.createElement('tr');
      if (ownId === entry.playerId) row.className = 'own-score';
      for (const value of [index + 1, entry.playerId, rankingMode === 'expedition_distance' ? entry.completedStages : rankingMode === 'expedition_speed' ? 10 : entry.cleared, formatTime(entry.elapsedMs, true)]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      if (rankingMode.startsWith('expedition') && entry.stage) {
        const detail = document.createElement('details'); detail.className = 'ranking-build';
        const summary = document.createElement('summary'); summary.textContent = t('expStage', { n: entry.stage });
        const build = document.createElement('span'); build.textContent = (entry.loadout || []).map(relic => relicName(relic.id, relic.level) + ' ' + relic.level).join(' · ');
        detail.append(summary, build);
        row.children[1].append(detail);
      }
      $('ranking-rows').append(row);
    });
  }
  async function refreshRankings(mode = rankingMode, force = false) {
    if (mode === 'expedition') mode = expeditionBoard;
    if (!mode.startsWith('expedition') && rankingPeriod !== 'formal') { rankingPeriod = 'formal'; force = true; }
    // A tab change never starts a game. Ignore responses for previously selected tabs.
    if (!force && rankingLoading && mode === rankingMode) return;
    rankingMode = mode;
    const request = ++rankingRequest;
    const period = rankingPeriod, cacheKey = period + ':' + mode;
    const cached = rankingCache.get(cacheKey);
    rankingError = '';
    if (!force && cached && Date.now() - cached.loadedAt < 30000) {
      rankingLoading = false; rankingData = cached.data; renderRankings(); return;
    }
    rankingData = null; rankingLoading = leaderboard.configured;
    if (!leaderboard.configured) rankingError = 'notConfigured';
    renderRankings();
    if (!leaderboard.configured) return;
    try {
      const data = await leaderboard.list(mode, period);
      if (request !== rankingRequest) return;
      rankingCache.set(cacheKey, { data, loadedAt: Date.now() }); rankingData = data;
    } catch (error) {
      if (request !== rankingRequest) return;
      rankingError = error.message === 'notConfigured' ? 'notConfigured' : 'rankingLoadError';
    }
    if (request !== rankingRequest) return;
    rankingLoading = false; renderRankings();
  }
  function showRankings(mode = game.mode) {
    closeDialog(); rankingPeriod = 'formal'; refreshRankings(mode, true);
    $('leaderboard-panel').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
    $('leaderboard-panel').focus({ preventScroll: true });
  }
  function relicName(id, level = game.relics[id] || game.ownedRelics?.()[id] || 1) { return ClackCompanions.name(id, level, language); }
  function relicDescription(id, level = game.relics[id] || game.ownedRelics()[id] || 1) {
    return ClackCompanions.description(id, level, game, language);
  }
  function relicEffect(id, level) { return ClackCompanions.profile(id, level, game, language).effect; }
  function relicRules(id, level) { return ClackCompanions.profile(id, level, game, language).rules; }
  function relicIcon(id, level = game.relics[id] || game.ownedRelics?.()[id] || 1) {
    const relic = RainExpedition.RELICS[id], visibleLevel = Math.max(1, Math.min(5, level));
    const box = ClackAtlas[relic.family][relic.row][visibleLevel-1];
    return `<span class="relic-portrait" data-rarity="${RainExpedition.rarityAt(visibleLevel)}" aria-hidden="true"><span class="animal-sprite" data-family="${relic.family}" data-level="${visibleLevel}"><svg viewBox="${box.join(' ')}" preserveAspectRatio="xMidYMid meet"><image href="assets/companions/${relic.family}.webp" width="1402" height="1122"/></svg></span></span>`;
  }
  function relicMeter(id) {
    if (!game.relics[id]) return '';
    if (id === 'ukulele') return t(game.lightningReady ? game.lightningTarget ? 'expLightningTarget' : 'expLightningWait' : 'expLightningCharge', { n: game.spark, max: game.lightningLimit });
    if (id === 'seeker') return t(game.seekerCharge >= RainExpedition.chargeLimit(game.relics.seeker) ? 'expSeekerWait' : 'expSeekerMeter', { n: game.seekerCharge, max: RainExpedition.chargeLimit(game.relics.seeker) });
    if (id === 'resin' && game.fuse) return t('expFuseMeter', { n: game.fuse.ticks });
    if (id === 'turbine') return t('expTurbineMeter', { n: game.turbineCharge, max: game.familyCount('shells') >= 4 ? 2 : 3 });
    if (id === 'capacitor') return t('expCapacitorMeter', { n: game.capacitorCharge, max: RainExpedition.chargeLimit(game.relics.capacitor) });
    if (id === 'behemoth') return t('expBoilerMeter', { n: game.blastCharge, max: RainExpedition.chargeLimit(game.relics.behemoth) });
    if (id === 'recycler') return t('expRecyclerMeter', { n: 6 + 3 * game.relics.recycler });
    return '';
  }
  function relicBadge(id) {
    const role = t('role_' + id), level = game.relics[id];
    if (!level) return role;
    const counters = {
      ukulele: game.lightningReady ? t('expReady') : `${game.spark}/${game.lightningLimit}`,
      behemoth: `${game.blastCharge}/${RainExpedition.chargeLimit(level)}`,
      seeker: `${game.seekerCharge}/${RainExpedition.chargeLimit(level)}`,
      resin: game.fuse ? String(game.fuse.ticks) : '',
      turbine: `${game.turbineCharge}/${game.familyCount('shells') >= 4 ? 2 : 3}`, capacitor: `${game.capacitorCharge}/${RainExpedition.chargeLimit(level)}`,
      feather: game.featherCharge ? t('expReady') : `${game.featherEnergy}/${game.featherRecharge}`,
      shield: t(game.shieldSpent ? 'used' : 'expReady')
    };
    return role + (counters[id] ? ' · ' + counters[id] : '');
  }
  function renderProcLog() {
    const log = $('proc-log'); log.replaceChildren();
    const feedback = $('equipment-feedback');
    feedback.textContent = t('expFeedbackEmpty'); feedback.removeAttribute('title');
    log.hidden = !isExpedition();
    if (log.hidden) return;
    log.setAttribute('aria-label', t('expProcLog'));
    if (!lastProc || lastProc.run !== runId || lastProc.stage !== game.stage) {
      log.textContent = t('expProcEmpty'); return;
    }
    const title = document.createElement('strong'); title.className = 'proc-log-title'; title.textContent = t('expProcLog') + ' · ' + t('expProcCount', { n: lastProc.total }); log.append(title);
    const totals = new Map();
    for (const event of lastProc.events) if (RainExpedition.RELICS[event.kind]) {
      const value = totals.get(event.kind) || 0; totals.set(event.kind, value + (event.kind === 'turbine' ? event.amount : event.ids.length === 3 ? 3 : 0));
    }
    for (const [id, n] of totals) {
      const chip = document.createElement('span'); chip.className = 'proc-entry'; chip.dataset.proc = id;
      const copied = id === 'echo' ? [...new Set(lastProc.events.filter(event => event.kind === id && event.source).map(event => t('role_' + event.source)))].join(' / ') : '';
      const item = relicName(id) + ' · ' + t('role_' + id) + (copied ? ` (${copied})` : '');
      chip.textContent = n ? t(id === 'turbine' ? 'expProcEnergy' : 'expProcRecovered', { item, n }) : item; log.append(chip);
    }
    feedback.textContent = [...totals].map(([id, n]) => t('role_' + id) + (n ? id === 'turbine' ? ` +${n}⚡` : ` +${n}` : '')).join(' → ') || t('expFeedbackEmpty');
    feedback.title = [...totals].map(([id, n]) => relicName(id) + ' · ' + t('role_' + id) + ` +${n}`).join(' → ');
  }
  function showCatalog() {
    showDialog('catalog', `<h2 id="modal-title">${t('expCatalogTitle')}</h2><p>${t('expCatalogCopy')}</p>${Object.entries(RainExpedition.FAMILIES).map(([family, ids]) => `<section class="family-catalog"><h3>${ClackCompanions.families[language][family]}</h3><p>${ClackCompanions.bonuses[language][family]}</p><div class="equipment-catalog">${ids.map(id => `<button class="catalog-item" data-catalog="${id}">${relicIcon(id)}<span>${relicName(id)}<small>${t('role_' + id)}</small></span></button>`).join('')}</div></section>`).join('')}<button id="catalog-close" class="secondary-button">${t('expStay')}</button>`);
    $('catalog-close').addEventListener('click', closeDialog);
    $('modal-content').querySelectorAll('[data-catalog]').forEach(button => button.addEventListener('click', () => showRelic(button.dataset.catalog)));
  }
  function loadoutMarkup() {
    return `<p class="build-summary">${t('expLoadout')} · ${game.loadout().map(({ id, level }) => `${relicName(id,level)} ${level}`).join(' / ')}</p>`;
  }
  function showRelic(id = selectedRelic) {
    selectedRelic = id;
    const level = game.relics[id] || game.ownedRelics()[id] || 1, relic = RainExpedition.RELICS[id];
    const seal = game.sealed[id] ? `<p class="boss-victory">${t('expPartial', { n: game.relics[id] || 0, max: game.sealed[id] })}</p>` : '';
    const rarity = RainExpedition.rarityAt(level);
    showDialog('relic', `<div class="relic-large">${relicIcon(id, level)}</div><p class="rarity-badge" data-rarity="${rarity}">${t('expRarity_' + rarity)} · ${t('expLevel', {n:level})} · ${ClackCompanions.families[language][relic.family]}</p><h2 id="modal-title">${relicName(id, level)}</h2><p class="equipment-role">${t('role_' + id)}</p>${seal}${relicMeter(id) ? `<p class="relic-state">${relicMeter(id)}</p>` : ''}<p class="companion-effect">${relicEffect(id, level)}</p><div class="companion-rules"><b>${t('companionRules')}</b><p>${relicRules(id, level)}</p></div><p class="relic-synergy">${ClackCompanions.bonuses[language][relic.family]}</p><div class="evolution-strip">${[1,2,3,4,5].map(n => `<div data-rarity="${RainExpedition.rarityAt(n)}">${relicIcon(id,n)}<small>Lv.${n}</small><b>${relicName(id,n)}</b></div>`).join('')}</div>${level < 5 ? `<p class="relic-next"><b>${t('expNextLevel')} · ${relicName(id,level+1)}</b><br>${relicEffect(id,level+1)}<br><small>${relicRules(id,level+1)}</small></p>` : ''}<details class="companion-basics"><summary>${t('help')}</summary><p>${t('companionBasics')}</p></details><button class="primary-button" id="relic-close">${t('expStay')}</button><button class="text-button" id="relic-catalog">${t('expCatalog')}</button>`);
    $('relic-catalog').addEventListener('click', showCatalog);
    $('relic-close').addEventListener('click', closeDialog);
  }
  function renderExpedition() {
    document.body.classList.toggle('expedition-run', isExpedition());
    $('expedition-panel').hidden = !isExpedition();
    if (!isExpedition()) { document.body.classList.remove('boss-run'); $('proc-log').hidden = true; return; }
    const spec = RainExpedition.stageSpec(game.stage);
    $('expedition-stage').textContent = (game.environment ? t('environmentName_' + game.environment.kind) : game.bossEncounter ? bossTitle(game.stage) : t(spec.theme === 'boss' ? 'expStorm' : 'exp' + spec.theme[0].toUpperCase() + spec.theme.slice(1))) + ' · ' + t('expTotal', { n: game.recovered });
    captureTen();
    $('boss-status').hidden = !game.bossActive;
    const sealedCount = Object.keys(game.sealed).length;
    $('boss-seals').textContent = t(sealedCount ? 'expBossStatus' : 'expBossRestored', { n: sealedCount, levels: game.sealedLevels });
    $('boss-energy-label').textContent = t(!sealedCount ? 'expBossFinish' : !game.bossStarted ? 'expBossFirst' : 'expBossEnergy', { n: game.bossEnergy });
    $('boss-meter').hidden = !sealedCount;
    $('boss-meter').setAttribute('aria-label', t('expBossEnergy', { n: game.bossEnergy }));
    $('boss-meter').setAttribute('aria-valuenow', String(game.bossEnergy));
    [...$('boss-meter').children].forEach((pip, index) => pip.classList.toggle('charged', index < game.bossEnergy));
    $('boss-status').classList.toggle('restored', !sealedCount);
    document.body.classList.toggle('boss-run', game.bossActive);
    document.body.dataset.boss = game.bossActive ? game.bossKind : '';
    if (game.bossActive) { const boss = RainExpedition.BOSSES[game.stage]; $('boss-status').style.setProperty('--boss-color', boss.color); $('boss-status').querySelector('.boss-sigil').textContent = boss.symbol; }
    $('boss-trial').hidden = !game.trial;
    $('boss-trial').textContent = bossProgress();
    $('relic-slots').textContent = t('expSlots', { n: game.loadout().filter(item => RainExpedition.RELICS[item.id].kind === 'passive').length, active: game.loadout().filter(item => RainExpedition.RELICS[item.id].kind === 'active').length, total: game.loadout().length });
    $('expedition-ten').hidden = !tenRecord; $('expedition-ten').disabled = animating || savePaused;
    $('expedition-ten').textContent = t('expTenButton', { time: formatTime(tenTime || 0, true) });
    const relicBar = $('relic-bar'); relicBar.replaceChildren();
    const groups = {};
    for (const kind of ['passive', 'active']) {
      const count = game.loadout().filter(item => RainExpedition.RELICS[item.id].kind === kind).length;
      const section = document.createElement('section'); section.className = 'relic-group'; section.dataset.kind = kind;
      const title = document.createElement('h3'); title.textContent = t(kind === 'passive' ? 'slotPassive' : 'slotActive', { n: count });
      groups[kind] = document.createElement('div'); groups[kind].className = 'relic-group-items';
      if (!count) { const empty = document.createElement('span'); empty.className = 'relic-empty'; empty.textContent = t('slotEmpty'); groups[kind].append(empty); }
      section.append(title, groups[kind]); relicBar.append(section);
    }
    for (const { id, level } of game.loadout()) {
      const button = document.createElement('button'); button.className = 'relic-chip'; button.dataset.relic = id;
      button.dataset.rarity = RainExpedition.rarityAt(game.relics[id] || level);
      const sealed = Object.hasOwn(game.sealed, id), current = game.relics[id] || 0;
      button.classList.toggle('sealed', sealed && !current); button.classList.toggle('partial', sealed && !!current);
      const label = sealed ? current ? t('expPartial', { n: current, max: level }) : t('expSealed') : t('expLevel', { n: level });
      button.innerHTML = `${relicIcon(id)}<span class="relic-copy"><span class="relic-name">${relicName(id)}</span><small>${t('expRarity_' + button.dataset.rarity)} · ${label}</small><small class="relic-meter">${relicBadge(id)}</small></span>`;
      button.title = t('expRarity_' + button.dataset.rarity) + ' · ' + label + ' · ' + (sealed && !current ? t('expSealedHint') : relicDescription(id));
      button.title += relicMeter(id) ? ' · ' + relicMeter(id) : '';
      button.setAttribute('aria-label', relicName(id) + ' · ' + button.title);
      button.addEventListener('click', () => showRelic(id));
      groups[RainExpedition.RELICS[id].kind].append(button);
    }
    $('family-bonuses').innerHTML = Object.entries(RainExpedition.FAMILIES).map(([family]) => {
      const count = game.familyCount(family);
      return `<span data-family="${family}" class="family-bonus ${count >= 2 ? 'active' : ''}" title="${ClackCompanions.bonuses[language][family]}">${ClackCompanions.families[language][family].split(' · ')[0]} ${count}/4${count >= 2 ? ' ◆' : ''}${count >= 4 ? ' ◆' : ''}</span>`;
    }).join('');
    const owned = game.ownedRelics(), ownedActive = Object.keys(owned).find(id => RainExpedition.RELICS[id].kind === 'active');
    $('expedition-feather').hidden = !owned.feather;
    $('expedition-feather').textContent = targeting === 'feather' ? t('expCancel') : `${t('expFeather')} · ${!game.relics.feather ? t('expSealed') : game.featherCharge ? t('expReady') : t('expCharging', { n: game.featherRecharge - game.featherEnergy })}`;
    $('expedition-feather').disabled = animating || finalized || savePaused || !!game.pendingReward || game.status !== 'playing' || !game.featherTargets().length;
    $('expedition-active').hidden = !ownedActive;
    $('expedition-active').textContent = targeting === 'blackhole' ? t('expCancel') : `${relicName(ownedActive)} · ${!game.equipment ? t('expSealed') : t('expCharge', { n: game.charge, max: game.capacity })}`;
    $('expedition-active').disabled = animating || finalized || savePaused || !game.canActivate();
    $('expedition-active').title = game.equipment ? relicDescription(game.equipment) : '';
    const pending = !!game.pendingReward || game.status === 'won';
    $('expedition-continue').hidden = !pending;
    $('expedition-continue').textContent = t(game.pendingReward ? 'expResumeReward' : 'expResumeStage');
    $('expedition-continue').disabled = animating || savePaused;
    $('expedition-extract').disabled = animating || finalized || savePaused || !!game.pendingReward || game.finished;
    let hint = targeting ? t(targeting === 'feather' ? 'expFeatherHint' : 'expCubeHint') : game.pendingReward ? t('expRewardPending')
      : t('expNextSupply', { n: game.stage + (game.stage % 2) + (stageRewardClaimed && game.stage % 2 === 0 ? 2 : 0) });
    if (!targeting && !game.pendingReward) {
      if (game.radarActive) hint += ' · ' + t('expRadarOn', { n: game.radarUntil - game.moves });
      else if (game.equipment === 'blackhole' && game.charge && !game.cubeTargets().length) hint += ' · ' + t('expNeedPair');
      else if (game.equipment && game.charge < game.capacity) hint += ' · ' + t('expCharging', { n: Math.ceil((game.recharge - game.energy) / (game.familyCount('birds') >= 2 ? 1.25 : 1)) });
      if (game.relics.shield) hint += ' · ' + t(game.shieldSpent ? 'expShieldSpent' : 'expShieldReady');

      if (game.radarActive && game.radarMark !== null) hint += ' · ' + t('expMarked', { item: itemName(game.radarMark) });
    }
    if (game.bossActive && !targeting) hint = sealedCount ? t(game.bossKind === 'dream' ? 'bossProgress_dream' : 'expBossHint') : game.trial ? bossProgress() : t('expBossFinish');
    if (!game.competitive) hint += ' · ' + t('expLegacyRun');
    $('expedition-hint').textContent = hint;
    $('lightning-status').hidden = !owned.ukulele;
    $('lightning-status').classList.toggle('charged', game.lightningReady);
    $('lightning-status').textContent = game.relics.ukulele ? relicMeter('ukulele') : t('relic_ukulele') + ' · ' + t('expSealed');
    $('lightning-status').title = t('expLightningExplain');
    renderProcLog();
    $('radar-preview').hidden = !owned.radar;
    $('radar-preview').classList.toggle('inactive', !game.radarActive);
    $('radar-preview').replaceChildren(...game.previewIds().map(id => {
      const tile = game.tiles[id], label = document.createElement('span');
      label.className = 'radar-preview-tile'; label.title = t(tile.pile) + ' · ' + itemName(tile.type);
      const img = document.createElement('img'); img.src = `assets/tiles/${ITEMS[tile.type].icon}.webp`; img.alt = label.title;
      label.append(img); return label;
    }));
  }
  function rewardMarkup(id) {
    if (id === 'recharge') return `<b>${t('expRecharge')}</b><span>${t('expRechargeCopy')}</span>`;
    if (id.startsWith('restore_')) return `<b>${t('expRestore', { item: t(id.slice(8)) })}</b><span>${t('expRestoreCopy')}</span>`;
    const level = game.relics[id] || 0, active = RainExpedition.RELICS[id].kind === 'active';
    return `${relicIcon(id, level + 1)}<div><small>${t('expRarity_' + RainExpedition.rarityAt(level + 1))} · ${t(active ? 'expActive' : 'expPassive')} · ${t(level ? 'expUpgrade' : active && game.equipment ? 'expReplaceActive' : 'expObtain', { n: level + 1 })}</small><b>${relicName(id, level + 1)} <em class="equipment-role">${t('role_' + id)}</em></b><span>${relicEffect(id, level + 1)}</span><span class="reward-rule">${relicRules(id, level + 1)}</span></div>`;
  }
  function rewardSkipMarkup() {
    return game.canSkipReward ? `<button class="secondary-button" id="reward-skip">${t('expSkipReward')}</button><p class="input-hint">${t('expSkipRewardCopy')}</p>` : '';
  }
  function bindRewardSkip() {
    $('reward-skip')?.addEventListener('click', () => {
      if (animating || savePaused || !game.skipReward()) return;
      afterReward();
    });
  }
  function showExpeditionReward() {
    if (!isExpedition() || !game.pendingReward || animating || savePaused) return;
    targeting = null;
    const first = !game.loadout().length;
    showDialog('reward', `<span class="modal-eyebrow">EXPEDITION / SUPPLY</span><h2 id="modal-title">${t(first ? 'expStartTitle' : 'expRewardTitle')}</h2><p>${t(first ? 'expStartCopy' : 'expRewardCopy')}</p>${first ? '' : `<p class="input-hint">${t('expGrowthGate', { n: game.levelCap, left: 2 - game.restocksUsed })}<br>${game.levelCap < 5 ? t('expMythicGate') : t('expRewardOdds', { n: Math.round(game.legendaryChance * 100) })}</p>`}<div class="reward-choices">${game.pendingReward.map(id => `<button class="reward-choice" data-reward="${id}" data-rarity="${RainExpedition.RELICS[id] ? RainExpedition.rarityAt((game.relics[id] || 0) + 1) : 'supply'}">${rewardMarkup(id)}</button>`).join('')}</div>`);
    $('modal-content').insertAdjacentHTML('beforeend', rewardSkipMarkup());
    bindRewardSkip();
    if (!game.pendingReward.includes(selectedReward)) selectedReward = null;
    $('modal-content').querySelector('.reward-choices').insertAdjacentHTML('afterend', `<div class="reward-confirmation"><button class="primary-button" id="reward-confirm" disabled>${t('rewardChooseFirst')}</button></div>`);
    const refreshSelection = () => {
      $('modal-content').querySelectorAll('[data-reward]').forEach(button => {
        const selected = button.dataset.reward === selectedReward;
        button.classList.toggle('reward-selected', selected); button.setAttribute('aria-pressed', String(selected));
      });
      $('reward-confirm').disabled = !selectedReward;
      const name = RainExpedition.RELICS[selectedReward] ? relicName(selectedReward, (game.relics[selectedReward] || 0) + 1) : selectedReward === 'recharge' ? t('expRecharge') : selectedReward?.startsWith('restore_') ? t(selectedReward.slice(8)) : '';
      $('reward-confirm').textContent = t(selectedReward ? 'rewardConfirm' : 'rewardChooseFirst', {name});
    };
    $('modal-content').querySelectorAll('[data-reward]').forEach(button => button.addEventListener('click', () => {
      selectedReward = button.dataset.reward; refreshSelection();
    }));
    $('reward-confirm').addEventListener('click', () => {
      if (dialogView !== 'reward' || animating || savePaused || !game.pendingReward?.includes(selectedReward)) return;
      const id = selectedReward;
      if (RainExpedition.RELICS[id]?.kind === 'active' && game.equipment && game.equipment !== id) { showReplacement(id); return; }
      if (!game.choose(id)) { showReplacement(id); return; }
      afterReward();
    });
    refreshSelection();
  }
  function showReplacement(id) {
    if (replacementItem !== id) selectedReplacement = null;
    replacementItem = id;
    const active = RainExpedition.RELICS[id]?.kind === 'active';
    const candidates = game.loadout().filter(relic => RainExpedition.RELICS[relic.id].kind === (active ? 'active' : 'passive'));
    const ability = (key, level, incoming = false) => {
      // An outgoing choice changes family bonuses. Show the incoming base
      // ability rather than promising bonuses from a team that may be replaced.
      const profile = ClackCompanions.profile(key, level, incoming ? null : game, language);
      return `${relicIcon(key, level)}<div><small>${t('expRarity_' + RainExpedition.rarityAt(level))} · ${t('expLevel', {n: level})}</small><b>${relicName(key, level)} <em class="equipment-role">${t('role_' + key)}</em></b><span>${profile.effect}</span><span class="reward-rule">${profile.rules}</span></div>`;
    };
    showDialog('replace', `<h2 id="modal-title">${t('expReplaceTitle')}</h2><p>${t('replaceCompare')}</p><h3 class="replacement-label">${t('replaceIncoming')}</h3><div class="reward-choice replacement-incoming" data-rarity="common">${ability(id, 1, true)}</div><p class="input-hint">${t('replaceTeamNote')}</p><h3 class="replacement-label">${t('replaceOutgoing')}</h3><div class="reward-choices">${candidates.map(relic => `<button class="reward-choice" data-replace="${relic.id}" data-rarity="${RainExpedition.rarityAt(relic.level)}">${ability(relic.id, relic.level)}<strong class="replace-action">${t('replaceChoose')}</strong></button>`).join('')}</div><div class="reward-confirmation"><button class="primary-button" id="replacement-confirm" disabled>${t('rewardChooseFirst')}</button></div><button class="secondary-button" id="reward-back">${t('expBack')}</button>`);
    $('modal-content').insertAdjacentHTML('beforeend', rewardSkipMarkup());
    bindRewardSkip();
    $('reward-back').addEventListener('click', showExpeditionReward);
    if (!candidates.some(relic => relic.id === selectedReplacement)) selectedReplacement = null;
    const refreshSelection = () => {
      $('modal-content').querySelectorAll('[data-replace]').forEach(button => {
        const selected = button.dataset.replace === selectedReplacement;
        button.classList.toggle('reward-selected', selected); button.setAttribute('aria-pressed', String(selected));
      });
      $('replacement-confirm').disabled = !selectedReplacement;
      $('replacement-confirm').textContent = t(selectedReplacement ? 'replacementConfirm' : 'rewardChooseFirst', {name: selectedReplacement ? relicName(selectedReplacement) : ''});
    };
    $('modal-content').querySelectorAll('[data-replace]').forEach(button => button.addEventListener('click', () => {
      selectedReplacement = button.dataset.replace; refreshSelection();
    }));
    $('replacement-confirm').addEventListener('click', () => {
      if (dialogView !== 'replace' || animating || savePaused || !selectedReplacement) return;
      if (game.choose(id, selectedReplacement)) afterReward();
    });
    refreshSelection();
  }
  function afterReward() {
    replacementItem = null; selectedReward = null; selectedReplacement = null; closeDialog(); render(); syncClock();
    if (game.status === 'won') showExpeditionStage();
  }
  function showExpeditionStage(animate = false) {
    if (animate === true) music.sound('win');
    if (!isExpedition() || savePaused || game.status !== 'won') return;
    if (game.pendingReward) { showExpeditionReward(); return; }
    showDialog('stage', `${fx.resultScene(true, t('expStageClear'), animate === true)}<span class="modal-eyebrow">${t('expStage', { n: game.stage })}</span><h2 id="modal-title">${t('expStageClear')}</h2><p>${t('expStageClearCopy')}</p><p>${t('expTotal', { n: game.recovered })}</p>${loadoutMarkup()}${game.environment ? `<p class="environment-clear">${t('environmentClear')}</p>` : ''}${game.bossEncounter ? `<p class="boss-victory">${game.stage === 100 ? t('bossFinalVictory') : t('bossVictory', {name: t('bossName_' + game.bossKind)})}</p>` : ''}${tenRecord ? `<button class="secondary-button" id="stage-ten">${t('expTenButton', { time: formatTime(tenTime, true) })}</button>` : ''}<button class="primary-button" id="stage-next">${t(game.stageRewardDue && !stageRewardClaimed ? 'expStageReward' : 'expNext')}</button><button class="text-button" id="stage-extract">${t('expExtract')}</button>`);
    $('stage-ten')?.addEventListener('click', showTenRecord);
    $('stage-extract').addEventListener('click', showExtract);
    $('stage-next').addEventListener('click', () => {
      if (animating || savePaused || finalized) return;
      if (game.stageRewardDue && !stageRewardClaimed) {
        selectedReward = null; selectedReplacement = null; stageRewardClaimed = true; game.offerReward(); render(); showExpeditionReward(); return;
      }
      cancelEffects(); const outgoing = fx.captureBoard();
      if (!game.nextStage()) { outgoing?.remove(); return; }
      stageRewardClaimed = false; targeting = null; animating = true; lastStatus = null;
      closeDialog(); $('board').replaceChildren();
      playEffect(() => { music.sound('restart'); return fx.restart(outgoing); }, () => {
        if (game.bossActive) showBossIntro();
        else if (game.environment) showEnvironmentIntro();
      });
    });
  }
  function showExtract() {
    if (!isExpedition() || savePaused || game.finished || game.pendingReward || finalized || animating) return;
    showDialog('extract', `<h2 id="modal-title">${t('expExtractTitle')}</h2><p>${t('expExtractCopy')}</p><p>${t('expTotal', { n: game.recovered })} · ${t('expStage', { n: game.stage })}</p><button class="primary-button" id="extract-confirm">${t('expEnd')}</button><button class="secondary-button" id="extract-cancel">${t('expStay')}</button>`);
    $('extract-cancel').addEventListener('click', () => { closeDialog(); if (game.status === 'won') showExpeditionStage(); });
    $('extract-confirm').addEventListener('click', () => { if (game.end()) { targeting = null; lastStatus = null; render(); showResult(true); } });
  }
  function expeditionOutcome() {
    if (game.status !== 'playing') showResult(true);
    else if (game.pendingReward) showExpeditionReward();
  }
  function finishExpeditionAction(before, events, recoveredCount) {
    if (events.some(event => RainExpedition.RELICS[event.kind])) {
      lastProc = { run: runId, stage: game.stage, events, total: recoveredCount }; renderProcLog();
    }
    if (!events.length) { expeditionOutcome(); return; }
    const chain = recoveredCount ?? events.reduce((sum, event) => sum + (event.ids.length === 3 ? 3 : 0), 0);
    clearTimeout(comboTimeout); $('combo').textContent = chain >= 6 ? t('expChain', { n: chain }) : (RainExpedition.RELICS[events[events.length - 1].kind] ? relicName(events[events.length - 1].kind) + ' · ' + t('role_' + events[events.length - 1].kind) : t('expFx_' + events[events.length - 1].kind));
    const returned = events.filter(event => event.kind === 'reclaim');
    if (returned.length && chain < 6) {
      const last = returned[returned.length - 1];
      $('combo').textContent = t('expReclaimed', { item: relicName(last.relic), n: last.level });
    }
    $('combo').classList.add('show'); comboTimeout = setTimeout(() => $('combo').classList.remove('show'), 2700);
    playEffect(() => {
      [...new Set(events.map(event => event.relic || event.kind))].forEach(id => { const chip = [...$('relic-bar').children].find(el => el.dataset.relic === id); chip?.classList.add('proc-flash'); });
      music.chain(events, chain, matchMedia('(prefers-reduced-motion: reduce)').matches);
      return fx.relic(events, before, chain);
    }, expeditionOutcome);
  }
  function activateExpedition(id) {
    if (!isExpedition() || finalized || animating || savePaused) return;
    const before = fx.snapshot(); updateClock(); const result = game.activate(id);
    if (!result.ok) return;
    targeting = null; lastStatus = null; render(); finishExpeditionAction(before, result.events, result.recovered);
  }
  function renderEnvironment() {
    const env = game.environment;
    document.body.classList.toggle('environment-mono', env?.kind === 'mono');
    $('environment-status').hidden = !env;
    $('eclipse-status').hidden = game.mode !== 'eclipse';
    if (game.mode === 'eclipse') $('eclipse-memory').textContent = t(!env.started ? 'eclipseWaiting' : env.preview > 0 ? 'eclipseObserve' : 'eclipseMemory', {n: Math.ceil(env.preview / 1000)});
    if (env) {
      $('environment-name').textContent = t('environmentName_' + env.kind);
      const seconds = Math.ceil(Math.max(env.preview, ...env.cards.map(card => card.remaining)) / 1000);
      $('environment-progress').textContent = t(env.kind === 'mono' ? 'environmentMonoHint' : game.radarActive ? 'environmentScout' : seconds > 0 ? 'environmentObserve' : 'environmentRemember', {n: seconds});
    }
    for (const el of $('board').children) {
      const id = Number(el.dataset.id), hidden = game.memoryHidden?.(id);
      el.classList.toggle('memory-hidden', !!hidden);
      el.classList.toggle('memory-mark', !!env?.cards.some(card => card.id === id));
      const blind = el.classList.contains('blind');
      const label = hidden ? t('environmentHidden') : blind ? t('blindTile') : itemName(game.tiles[id].type) + (el.classList.contains('blocked') ? t('covered') : '');
      if (el.title !== label) { el.title = label; el.setAttribute('aria-label', label); }
    }
  }
  function showEnvironmentIntro() {
    if (!game.environment) return;
    showDialog('environment', `<span class="modal-eyebrow">${t('expStage', {n: game.stage})}</span><h2 id="modal-title">${t('environmentName_' + game.environment.kind)}</h2><p>${t('environmentRule_' + game.environment.kind)}</p><p class="environment-clear">${t('environmentClear')}</p><button id="environment-start" class="primary-button">${t(game.environment.started ? 'expStay' : 'environmentStart')}</button>`);
    $('environment-start').addEventListener('click', () => { closeDialog(); render(); });
  }
  $('environment-info').addEventListener('click', showEnvironmentIntro);
  modal.addEventListener('cancel', event => {
    if (!runId && ['resume', 'saveLocked'].includes(dialogView)) { event.preventDefault(); dismissDialog(); return; }
    if (dialogView === 'eclipse') { event.preventDefault(); closeDialog(); return; }
    if (dialogView === 'environment' || (dialogView === 'boss' && game.pressure && !game.pressure.started)) { event.preventDefault(); closeDialog(); render(); }
  });
  function renderPressure() {
    const p = game.pressure;
    $('pressure-status').hidden = !p;
    if (!p) return;
    $('pressure-hearts').textContent = '♥'.repeat(p.hearts) + '♡'.repeat(3 - p.hearts);
    $('pressure-hearts').setAttribute('aria-label', t('pressureHearts', {n: p.hearts}));
    $('pressure-time').textContent = t(!p.hearts ? 'pressureEnded' : !p.started ? game.mode === 'eclipse' ? 'eclipsePressureReady' : 'pressureReady' : clockActive ? 'pressureTime' : 'pressurePaused', {n: (p.remaining / 1000).toFixed(1)});
    $('pressure-fill').style.transform = `scaleX(${p.remaining / 8000})`;
    $('pressure-status').classList.toggle('urgent', p.started && p.hearts > 0 && p.remaining <= 3000);
    $('pressure-pause').disabled = game.status !== 'playing' || finalized || savePaused;
  }
  function showPressurePause() {
    if (!game.pressure || game.status !== 'playing') return;
    showDialog('pressurePause', `<h2 id="modal-title">${t('pressurePauseTitle')}</h2><p>${t(game.mode === 'eclipse' ? 'eclipsePressureRule' : 'pressureRule')}</p><button id="pressure-resume" class="primary-button">${t('pressureResume')}</button>`);
    $('pressure-resume').addEventListener('click', () => { closeDialog(); renderPressure(); });
    renderPressure();
  }
  $('pressure-pause').addEventListener('click', showPressurePause);
  function bossTitle(stage) { return t('bossTitle', {n: stage, name: t('bossName_' + RainExpedition.BOSSES[stage].kind)}); }
  function bossProgress() {
    if (!game.trial) return '';
    const kind = game.bossKind, cap = game.trialBurstLimit === game.normalBurstLimit ? t('bossFull') : game.trialBurstLimit;
    const target = game.trial.lastType == null ? t('bossNoTarget') : itemName(game.trial.lastType);
    const targets = game.protectedTypes.map(itemName).join(' / ');
    const values = {cap, target, targets, manual: Math.min(9, game.stageMatches)};
    if (['ward','crown','roots'].includes(kind)) values.n = Math.min(kind === 'roots' ? 4 : 3, game.trial.broken.length);
    if (kind === 'armor') values.n = Math.min(6, game.stageMatches);
    if (['tide','migrate'].includes(kind)) values.n = 2 - game.stageMatches % 2;
    if (kind === 'roots') values.state = t(game.trial.broken.length >= 4 ? 'bossPierceOpen' : 'bossPierceClosed');
    if (kind === 'tide') values.state = t(game.trialBurstLimit === 2 ? 'bossHighTide' : 'bossLowTide');
    if (kind === 'echo') values.state = t(game.trial.open ? 'bossOpen' : 'bossClosed');
    return t('bossProgress_' + kind, values);
  }
  function showBossCatalog() {
    showDialog('bossCatalog', `<h2 id="modal-title">${t('bossCatalogTitle')}</h2><p>${t('bossCatalogCopy')}</p><div class="boss-catalog">${Object.entries(RainExpedition.BOSSES).map(([stage, boss]) => `<section style="--boss-color:${boss.color}"><span aria-hidden="true">${boss.symbol}</span><h3>${bossTitle(stage)}</h3><p>${t('bossRule_' + boss.kind)}</p>${Number(stage) === 70 ? `<p>${t('pressureRule')}</p>` : ''}</section>`).join('')}</div><button id="boss-catalog-close" class="secondary-button">${t('expStay')}</button>`);
    $('boss-catalog-close').addEventListener('click', closeDialog);
  }
  function showBossIntro() {
    const kind = game.bossKind, boss = RainExpedition.BOSSES[game.stage];
    showDialog('boss', `<div class="boss-emblem" data-boss="${kind}" style="--boss-color:${boss.color}" aria-hidden="true"><i></i><i></i><span>${boss.symbol}</span></div><span class="modal-eyebrow">STAGE ${game.stage} / GUARDIAN</span><h2 id="modal-title">${bossTitle(game.stage)}</h2><p>${t('expBossIntro')}</p>${kind === 'seal' ? '' : `<p class="boss-special-rule">${t('bossRule_' + kind)}</p>`}${game.pressure ? `<p class="boss-special-rule">${t('pressureRule')}</p>` : ''}<button class="primary-button" id="boss-start">${t('bossEnter')}</button>`);
    $('boss-start').addEventListener('click', () => {
      closeDialog(); playEffect(() => { music.sound('boss'); return fx.bossEntrance(kind); });
    });
  }

  function showTenRecord() {
    if (!tenRecord || savePaused) return;
    showDialog('ten', `<span class="modal-eyebrow">TEN STAGES / RECORD</span><h2 id="modal-title">${t('expTenTitle')}</h2><p class="ten-time">${formatTime(tenTime, true)}</p><p>${t('expTenCopy')}</p>${tenRecord.receipt ? `<p class="save-feedback">${t('expTenSaved', { n: tenRecord.receipt.speedRank || '—' })}</p>` : `<form id="ten-form" novalidate><label for="ten-player">${t('player')}</label><div class="score-input-row"><input id="ten-player" maxlength="20" autocomplete="off" autocapitalize="off"><button class="primary-button" ${tenSubmitting ? 'disabled' : ''}>${t(tenSubmitting ? 'sending' : 'submit')}</button></div><p id="ten-error" class="form-error" role="alert"></p></form>`}<button class="secondary-button" id="ten-continue">${t('expTenContinue')}</button>`);
    $('ten-continue').addEventListener('click', () => { closeDialog(); if (game.status === 'won') showExpeditionStage(); });
    if (!tenRecord.receipt) {
      $('ten-player').value = tenRecord.playerId || playerDraft; $('ten-player').readOnly = !!tenRecord.playerId;
      $('ten-form').addEventListener('submit', async event => {
        event.preventDefault(); if (tenSubmitting || savePaused) return;
        const id = RainLeaderboard.normalizeId($('ten-player').value);
        if (!RainLeaderboard.validId(id)) { $('ten-error').textContent = t('invalidId'); return; }
        tenRecord.playerId ||= id; playerDraft = id; tenSubmitting = true; checkpoint(); showTenRecord();
        const currentRun = runId, milestone = tenRecord;
        const result = await leaderboard.submit({ rules: 3, runId: milestone.runId, playerId: milestone.playerId, mode: 'expedition',
          cleared: milestone.cleared, elapsedMs: milestone.elapsedMs, stage: 10, completedStages: 10, tenMs: milestone.elapsedMs, loadout: milestone.loadout });
        if (currentRun !== runId || tenRecord !== milestone) return;
        tenSubmitting = false;
        if (result.ok) { tenRecord.receipt = result; savePreference('rain-match-player', id); rankingCache.delete('formal:expedition_distance'); rankingCache.delete('formal:expedition_speed'); refreshRankings('expedition', true); }
        checkpoint();
        if (modal.open && dialogView === 'ten') { showTenRecord(); if (!result.ok) $('ten-error').textContent = t(result.error === 'notConfigured' ? 'expDatabase' : result.error); }
      });
    }
  }
  $('expedition-ten').addEventListener('click', showTenRecord);
  $('expedition-extract').addEventListener('click', showExtract);
  $('expedition-continue').addEventListener('click', () => game.pendingReward ? showExpeditionReward() : showExpeditionStage());
  $('expedition-feather').addEventListener('click', () => { targeting = targeting === 'feather' ? null : 'feather'; render(); });
  $('expedition-active').addEventListener('click', () => {
    if (game.equipment === 'radar') activateExpedition();
    else { targeting = targeting === 'blackhole' ? null : 'blackhole'; render(); }
  });

  function showEclipseIntro() {
    eclipseDialogScroll ||= { left: scrollX, top: scrollY };
    showDialog('eclipse', `<span class="modal-eyebrow">ECLIPSE / CHALLENGE</span><h2 id="modal-title">${t('eclipseTitle')}</h2><ol>${t('eclipseRules').map(rule => `<li>${rule}</li>`).join('')}</ol><label class="eclipse-intro-preference"><input type="checkbox" id="eclipse-skip-intro" aria-describedby="eclipse-skip-hint" ${eclipseIntroHidden ? 'checked' : ''}><span>${t('eclipseSkipIntro')}</span></label><p id="eclipse-skip-hint" class="input-hint">${t('eclipseSkipHint')}</p><button id="eclipse-start" class="primary-button">${t(timerStarted ? 'pressureResume' : 'welcomePlay')}</button>`);
    window.scrollTo({ ...eclipseDialogScroll, behavior: 'instant' });
    $('eclipse-skip-intro').addEventListener('change', event => {
      eclipseIntroHidden = event.target.checked;
      savePreference('critter-eclipse-hide-intro', eclipseIntroHidden ? 'yes' : 'no');
    });
    $('eclipse-start').addEventListener('click', closeDialog);
  }
  $('eclipse-info').addEventListener('click', showEclipseIntro);
  function showHelp() {
    if (game.mode === 'eclipse') { showEclipseIntro(); return; }
    if (isExpedition()) { showDialog('help', `<div class="modal-symbol">◇</div><h2 id="modal-title">${t('expHelpTitle')}</h2><ol>${t('expHelpSteps').map(step => `<li>${step}</li>`).join('')}</ol><p>${t('expHelpNote')}</p><p>${t('helpRanking')}</p>`); return; }
    showDialog('help', `<div class="modal-symbol">◇</div><h2 id="modal-title">${t('helpTitle')}</h2><ol>${t('helpSteps').map(step => `<li>${step}</li>`).join('')}</ol><p>${t('helpStrategy')}</p><p>${t('helpPowers')}</p><p>${t('helpRanking')}</p><p class="keyboard-note">${t('helpKeys')}</p>`);
  }
  function showCredits() {
    showDialog('credits', `<div class="modal-symbol">✧</div><h2 id="modal-title">${t('creditsTitle')}</h2><p>${t('creditsCopy')}</p><p>${t('creditsArt')}</p><p>${t('creditsMusic')}</p><p><a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300035" target="_blank" rel="noopener">George Street Shuffle — Kevin MacLeod</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a></p><p><a href="assets/audio/george-street-shuffle-NOTICE.txt" target="_blank" rel="noopener">${t('creditsMusicSource')}</a></p><p>${t('creditsThanks')}</p>`);
  }
  function toggleLanguage() {
    if ($('player-id')) playerDraft = $('player-id').value;
    updateClock(); language = language === 'zh' ? 'en' : 'zh'; savePreference('rain-match-language', language);
    localizePage(); render(); clearTimeout(comboTimeout); $('combo').classList.remove('show');
    if (modal.open) ({ eclipse: showEclipseIntro, pressurePause: showPressurePause, environment: showEnvironmentIntro, bossCatalog: showBossCatalog, boss: showBossIntro, ten: showTenRecord, resume: showResume, restartRun: confirmRestart, saveLocked: showSaveLocked, result: showResult, help: showHelp, credits: showCredits, catalog: showCatalog, relic: showRelic, reward: showExpeditionReward, stage: showExpeditionStage, extract: showExtract, replace: () => showReplacement(replacementItem) })[dialogView]?.();
    syncClock();
  }
  $('welcome-language').addEventListener('click', toggleLanguage);
  $('welcome-continue').addEventListener('click', () => { enterPlay(); requestExpedition(); });
  document.querySelectorAll('[data-welcome-mode]').forEach(button => button.addEventListener('click', () => {
    enterPlay();
    if (button.dataset.welcomeMode === 'expedition') requestExpedition();
    else start(button.dataset.welcomeMode);
  }));
  $('equipment-catalog').addEventListener('click', showCatalog);
  $('boss-catalog').addEventListener('click', showBossCatalog);
  $('board').addEventListener('click', event => { const tile = event.target.closest('button[data-id]'); if (tile) pick(Number(tile.dataset.id)); });
  $('reserve').addEventListener('click', event => { const tile = event.target.closest('button[data-id]'); if (tile) pick(Number(tile.dataset.id)); });
  for (const name of ['remove', 'undo', 'shuffle']) $(name).addEventListener('click', () => use(name));
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { if (button.dataset.mode !== game.mode || !runId || (savePaused && !isExpedition())) { navigationToken++; if (button.dataset.mode === 'expedition') requestExpedition(); else start(button.dataset.mode); } }));
  $('restart').addEventListener('click', () => isExpedition() ? confirmRestart() : start());
  $('close-modal').addEventListener('click', dismissDialog);
  modal.addEventListener('close', () => { if (!modal.open) { dialogView = null; updateClock(); syncClock(); } });
  function toggleMusic() {
    const open = $('music-panel').hidden;
    $('music-panel').hidden = !open;
    $('sound').setAttribute('aria-expanded', String(open));
    $('sound').style.color = open ? 'var(--purple)' : '';
    if (!open) { music.stop(); $('sound').focus(); }
    localizePage();
  }
  $('sound').addEventListener('click', toggleMusic);
  $('music-close').addEventListener('click', toggleMusic);
  $('music-toggle').addEventListener('click', async () => {
    $('music-error').hidden = true;
    if (music.playing) music.stop();
    else {
      try {
        const playing = music.play(); localizePage();
        if (!await playing) return;
        if (readPreference('rain-match-effects') === null) { sound = true; music.setEffects(true); }
      }
      catch (_) { $('music-error').hidden = false; }
    }
    localizePage();
  });
  $('music-volume').addEventListener('input', event => music.setVolume(Number(event.target.value) / 100));
  $('effects-volume').addEventListener('input', event => music.setEffectsVolume(Number(event.target.value) / 100));
  document.addEventListener('visibilitychange', () => {
    music.visibility(document.hidden).catch(() => { music.stop(); $('music-error').hidden = false; localizePage(); });
  });
  window.addEventListener('pagehide', () => { music.stop(); music.cancelEffects(); localizePage(); });
  $('effects').addEventListener('click', () => {
    sound = !sound; music.setEffects(sound); savePreference('rain-match-effects', sound ? 'on' : 'off');
    localizePage(); beep();
  });
  $('help').addEventListener('click', showHelp); $('credits').addEventListener('click', showCredits);
  $('ranking-period-tabs').querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    if (rankingPeriod === button.dataset.rankingPeriod) return;
    rankingPeriod = button.dataset.rankingPeriod; refreshRankings(rankingMode, true);
  }));
  $('refresh-rankings').addEventListener('click', () => refreshRankings(rankingMode, true));
  $('inline-ranking-tabs').querySelectorAll('[data-leaderboard-mode]').forEach(button => button.addEventListener('click', () => refreshRankings(button.dataset.leaderboardMode)));
  $('expedition-ranking-tabs').querySelectorAll('button').forEach(button => button.addEventListener('click', () => { expeditionBoard = button.dataset.expBoard; refreshRankings(expeditionBoard); }));
  $('rankings').addEventListener('click', () => showRankings()); $('result-button').addEventListener('click', showResult);
  $('language').addEventListener('click', toggleLanguage); $('modal-language').addEventListener('click', toggleLanguage);
  document.addEventListener('keydown', event => {
    suppressEffectClick = false;
    if (welcomeOpen || modal.open || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.matches('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'Escape' && targeting) { targeting = null; render(); return; }
    if (activeEffect && ['Enter', ' '].includes(event.key) && event.target.closest(gameplayControls)) {
      activeEffect.skip(); if (modal.open) { event.preventDefault(); return; }
    }
    const tool = { 1: 'remove', 2: 'undo', 3: 'shuffle' }[event.key];
    if (tool) { event.preventDefault(); use(tool); }
  });
  setInterval(() => { updateClock(); syncClock(); $('timer').textContent = formatTime(elapsed); renderPressure(); if (game.environment) renderEnvironment(); if (performance.now() - lastCheckpoint > 5000) checkpoint(); }, 250);
  document.addEventListener('visibilitychange', () => {
    updateClock();
    if (document.hidden) { activeEffect?.skip(); fx.reset(); }
    checkpoint(); syncClock();
  });
  window.addEventListener('pagehide', () => { updateClock(); checkpoint(); saveStore.release(); clockActive = false; });
  window.addEventListener('pageshow', async event => {
    if (!event.persisted || !isExpedition()) return;
    tick = performance.now();
    if (!await saveStore.acquire()) { savePaused = true; showSaveLocked(); }
    else {
      const latest = saveStore.read();
      if (latest.raw !== saveStore.expected && latest.record) { saveStore.adopt(latest.raw); restoreRun(latest.record); }
      else savePaused = false;
    }
    render(); syncClock();
  });
  window.addEventListener('storage', event => {
    if (event.key !== RainSave.KEY) return;
    if (isExpedition() && saveStore.owned && event.newValue !== saveStore.expected) {
      updateClock(); savePaused = true; saveStore.release(); showSaveLocked(); render(); syncClock();
    } else { saveState = saveStore.read(); renderResumeBanner(); renderWelcome(); }
  });
  // Prepare a paused classic preview; opening the welcome screen never creates
  // an Expedition save, acquires its lock, or consumes any gameplay time.
  game = new RainMatch.Game('drizzle'); savePaused = true;
  localizePage(); render();
  document.querySelectorAll('#welcome-screen button').forEach(button => { button.disabled = false; });
  $('welcome-loading').hidden = true;
  const requestedMode = new URLSearchParams(location.search).get('mode');
  if (requestedMode === 'expedition' || Object.hasOwn(MODES, requestedMode)) {
    enterPlay();
    if (requestedMode === 'expedition') requestExpedition();
    else start(requestedMode);
  }
  if (window.RainPresence) {
    presence = new RainPresence.Presence(window.RAIN_CONFIG, {
      storage, createClient: window.supabase?.createClient,
      onChange: state => { presenceView = state; renderPresence(); }
    });
    presence.setMode(game.mode); presence.setVisible(!document.hidden); presence.setOnline(navigator.onLine); presence.start();
    for (const name of ['pointerdown', 'keydown', 'scroll']) document.addEventListener(name, () => presence.activity(), { passive: true });
    document.addEventListener('visibilitychange', () => presence.setVisible(!document.hidden));
    window.addEventListener('offline', () => presence.setOnline(false));
    window.addEventListener('online', () => presence.setOnline(true));
    window.addEventListener('pagehide', () => presence.stop());
    window.addEventListener('pageshow', event => { if (event.persisted) { presence.setVisible(!document.hidden); presence.setOnline(navigator.onLine); presence.start(); } });
    window.addEventListener('storage', event => { if (event.key === RainPresence.KEY) presence.refreshIdentity(); });
  } else { presenceView = { status: 'unavailable' }; renderPresence(); }
})();
