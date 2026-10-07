(function () {
  'use strict';
  const { ITEMS, MODES } = RainMatch;
  const $ = id => document.getElementById(id);
  const modal = $('modal');
  const fx = RainEffects;
  const music = new RainMusic();
  music.onError = () => { $('music-error').hidden = false; localizePage(); };
  let animating = false, targeting = null, stageRewardClaimed = false, replacementItem = null, selectedRelic = null;
  let activeEffect = null;
  let lastProc = null, lightningMarks = new Set();
  const isExpedition = () => game?.mode === 'expedition';
  const recovered = () => isExpedition() ? game.recovered : game.cleared;
  let storage;
  try { storage = window.localStorage; } catch (_) { storage = null; }
  const readPreference = key => { try { return storage?.getItem(key); } catch (_) { return null; } };
  const savePreference = (key, value) => { try { storage?.setItem(key, value); } catch (_) { /* Preferences are optional. */ } };
  const saveStore = new RainSave.Store(storage, navigator.locks);
  let saveState = saveStore.read(), saveNote = saveState.error, savePaused = false, lastCheckpoint = 0, navigationToken = 0, acquiringSave = false;
  const leaderboard = new RainLeaderboard.Leaderboard(window.RAIN_CONFIG);
  let language = readPreference('rain-match-language') === 'en' ? 'en' : 'zh';
  const t = (key, values) => RainI18n.translate(language, key, values);
  const itemName = type => language === 'en' ? ITEMS[type].en : ITEMS[type].name;
  const modeName = mode => t(`${mode}Title`);
  let game, elapsed = 0, tick = performance.now(), clockActive = false, sound = readPreference('rain-match-effects') === 'on', comboTimeout;
  music.setEffects(sound);
  let savedWin = false, finalized = false, receipt = null, runId, dialogView = null, rankingMode = 'expedition_distance';
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
    if (clockActive) elapsed += now - tick;
    tick = now;
  }
  function syncClock() {
    clockActive = !!game && game.status === 'playing' && !finalized && !animating && !document.hidden && !modal.open && !game.pendingReward && !savePaused;
  }
  function closeDialog() {
    updateClock(); if (modal.open) modal.close(); dialogView = null; syncClock();
  }
  function cancelEffects() {
    clearTimeout(activeEffect?.timer); activeEffect = null;
    fx.reset(); music.cancelEffects(); animating = false;
  }
  function playEffect(play, after = () => {}) {
    const effect = { run: runId };
    activeEffect = effect; animating = true; render(); syncClock();
    const finish = () => {
      if (activeEffect !== effect || effect.run !== runId) return;
      clearTimeout(effect.timer); activeEffect = null;
      updateClock(); animating = false; render(); syncClock(); after();
    };
    effect.skip = () => { if (activeEffect === effect) { fx.reset(); music.cancelEffects(); finish(); } };
    // All current scenes finish within 3.1 s. A broken renderer must never own
    // the input lock forever; game state was already committed before the FX.
    effect.timer = setTimeout(effect.skip, 4500);
    Promise.resolve().then(() => activeEffect === effect ? play() : undefined)
      .catch(error => { console.warn('Clackworks effect skipped:', error); if (activeEffect === effect) { fx.reset(); music.cancelEffects(); } })
      .finally(finish);
    if (document.hidden) effect.skip();
  }
  function beep(matched = false) { music.sound(matched ? 'match' : 'pick'); }

  function tileElement(tile, interactive = true) {
    const item = ITEMS[tile.type], el = document.createElement(interactive ? 'button' : 'div');
    el.className = 'tile'; el.dataset.id = tile.id; el.dataset.type = tile.type;
    el.style.setProperty('--rarity', item.color); el.title = itemName(tile.type);
    el.setAttribute('aria-label', itemName(tile.type));
    const img = document.createElement('img');
    img.src = `assets/flat/${item.icon}.webp`; img.alt = ''; img.draggable = false;
    img.addEventListener('error', () => { el.textContent = itemName(tile.type); el.style.fontSize = '9px'; });
    el.append(img);
    decorateTarget(el, tile);
    return el;
  }
  function decorateTarget(el, tile) {
    const lightning = lightningMarks.has(tile.id);
    const fused = isExpedition() && game.fuse?.ids.includes(tile.id);
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
    for (const id of ['language', 'modal-language']) {
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
    $('effects').textContent = t(sound ? 'soundOff' : 'soundOn');
    $('effects').setAttribute('aria-pressed', String(sound));
    $('wins').textContent = String(wins).padStart(2, '0');
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
    const record = { schema: 3, savedAt: Date.now(), runId, elapsedMs: elapsed, finalized, receipt,
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
    cancelEffects(); closeDialog(); clockActive = false;
    game = RainExpedition.Expedition.fromSave(record.game); elapsed = record.elapsedMs; tick = performance.now();
    runId = record.runId; finalized = record.finalized; receipt = record.receipt; submissionPayload = record.submissionPayload;
    tenTime = record.tenTime; tenRecord = record.tenRecord; tenSubmitting = false;
    stageRewardClaimed = record.stageRewardClaimed; playerDraft = record.playerDraft;
    savedWin = false; submitting = false; formError = ''; lastStatus = null;
    animating = false; targeting = null; replacementItem = null; savePaused = false;
    clearTimeout(comboTimeout); $('combo').classList.remove('show'); $('board').replaceChildren();
    document.querySelectorAll('[data-mode]').forEach(button => {
      const selected = button.dataset.mode === 'expedition'; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    $('timer').textContent = formatTime(elapsed); render(); refreshRankings('expedition');
    if (game.pendingReward) showExpeditionReward();
    else if (game.status !== 'playing') showResult();
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
    if (isExpedition()) { updateClock(); checkpoint(); }
    if (mode !== 'expedition') saveStore.release();
    savePaused = false;
    cancelEffects();
    const outgoing = runId && game ? fx.captureBoard() : null;
    animating = !!runId;
    closeDialog(); game = mode === 'expedition' ? new RainExpedition.Expedition() : new RainMatch.Game(mode);
    targeting = null; stageRewardClaimed = false; replacementItem = null; elapsed = 0; tick = performance.now();
    savedWin = false; finalized = false; receipt = null; formError = ''; lastStatus = null; submitting = false; submissionPayload = null;
    tenTime = null; tenRecord = null; tenSubmitting = false;
    runId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, digit => (Number(digit) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(digit) / 4).toString(16));
    clearTimeout(comboTimeout); $('combo').classList.remove('show');
    $('board').replaceChildren(); $('timer').textContent = '00:00';
    document.querySelectorAll('[data-mode]').forEach(button => {
      const selected = button.dataset.mode === game.mode;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    render(!animating); syncClock();
    refreshRankings(game.mode);
    if (animating) {
      playEffect(() => { music.sound('restart'); return fx.restart(outgoing); }, () => {
        if (isExpedition()) showExpeditionReward();
      });
    } else if (isExpedition()) showExpeditionReward();
  }
  function render(enter = false) {
    lightningMarks = new Set(isExpedition() ? game.lightningTarget || [] : []);
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
    $('reserve').replaceChildren(...game.reserve.map(id => {
      const el = tileElement(game.tiles[id]); el.disabled = finalized || animating || savePaused || !!game.pendingReward || !!targeting || game.status !== 'playing'; return el;
    }));
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
    renderExpedition();
    checkpoint(); renderResumeBanner();
    presence?.setMode(game.mode);
  }
  function pick(id) {
    if (finalized || animating || savePaused) return;
    const before = fx.snapshot();
    updateClock();
    if (isExpedition() && targeting === 'blackhole') { activateExpedition(id); return; }
    const result = game.pick(id, targeting === 'feather'); syncClock(); if (!result.ok) return;
    targeting = null;
    lastStatus = null; beep(result.matched); render();
    if (!result.events?.some(event => event.kind === 'shield')) {
      try { fx.pick(before, id, result.type, result.matched, (result.events || []).filter(event => event.ids.length === 3).flatMap(event => event.ids)); }
      catch (error) { console.warn('Clackworks pick effect skipped:', error); fx.reset(); }
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
      <h2 id="modal-title">${t(isExpedition() ? 'expEnded' : won ? 'wonTitle' : 'lostTitle')}</h2>
      <p>${t(rescue ? 'rescueCopy' : isExpedition() ? 'expEndedCopy' : won ? 'wonCopy' : 'lostCopy')}</p>
      <div class="result-stats"><span>${t('recovered')}<b>${recovered()}${isExpedition() ? '' : ' / ' + game.tiles.length}</b></span><span>${t('time')}<b>${formatTime(Math.round(elapsed), true)}</b></span><span>${t(isExpedition() ? 'expReached' : 'moves')}<b>${isExpedition() ? game.stage : game.moves}</b></span></div>${isExpedition() ? loadoutMarkup() + `<p class="build-summary">${t('expBestChain', { n: game.bestChain })}</p>` : ''}
      ${rescue && game.canUse('remove') ? `<button class="secondary-button" data-rescue="remove">${t('rescueRemove')}</button>` : ''}
      ${rescue && game.canUse('undo') ? `<button class="secondary-button" data-rescue="undo">${t('rescueUndo')}</button>` : ''}
      <div class="score-entry"><p class="scope-note">${t('rankingScope')}</p>
      ${!canSubmit ? `<p>${t('expLegacyRun')}</p>` : receipt ? `<p id="save-feedback" class="save-feedback" role="status" tabindex="-1">${t(receipt.improved ? 'saved' : 'notBest', { rank: receipt.rank })}</p>` :
        `<form id="score-form" novalidate><label for="player-id">${t('player')}</label><div class="score-input-row"><input id="player-id" name="player-id" type="text" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="id-rules score-error" placeholder="${t('playerPlaceholder')}" required><button class="primary-button" type="submit" ${submitting || !leaderboard.configured ? 'disabled' : ''}>${t(submitting ? 'sending' : rescue ? 'submitEnd' : 'submit')}</button></div><p id="id-rules" class="input-hint">${t('idRules')}</p><p id="score-error" class="form-error" role="alert">${formError ? t(isExpedition() && formError === 'notConfigured' ? 'expDatabase' : formError) : !leaderboard.configured ? t('notConfigured') : ''}</p></form>`}
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
          rankingCache.delete('expedition_distance'); rankingCache.delete('expedition_speed');
          rankingCache.delete(game.mode); refreshRankings(game.mode, true);
        }
        render();
        if (modal.open && dialogView === 'result') { showResult(); (receipt ? $('save-feedback') : $('score-error')).focus(); }
      });
    }
  }
  function renderRankings() {
    const content = $('inline-ranking-content');
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
      content.innerHTML = `<p class="form-error" role="status">${t(rankingMode.startsWith('expedition') && rankingError === 'notConfigured' ? 'expDatabase' : rankingError)}</p>`; return;
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
        const build = document.createElement('span'); build.textContent = (entry.loadout || []).map(relic => t('relic_' + relic.id) + ' ' + relic.level).join(' · ');
        detail.append(summary, build);
        row.children[1].append(detail);
      }
      $('ranking-rows').append(row);
    });
  }
  async function refreshRankings(mode = rankingMode, force = false) {
    if (mode === 'expedition') mode = expeditionBoard;
    // A tab change never starts a game. Ignore responses for previously selected tabs.
    if (!force && rankingLoading && mode === rankingMode) return;
    rankingMode = mode;
    const request = ++rankingRequest;
    const cached = rankingCache.get(mode);
    rankingError = '';
    if (!force && cached && Date.now() - cached.loadedAt < 30000) {
      rankingLoading = false; rankingData = cached.data; renderRankings(); return;
    }
    rankingData = null; rankingLoading = leaderboard.configured;
    if (!leaderboard.configured) rankingError = 'notConfigured';
    renderRankings();
    if (!leaderboard.configured) return;
    try {
      const data = await leaderboard.list(mode);
      if (request !== rankingRequest) return;
      rankingCache.set(mode, { data, loadedAt: Date.now() }); rankingData = data;
    } catch (error) {
      if (request !== rankingRequest) return;
      rankingError = error.message === 'notConfigured' ? 'notConfigured' : 'rankingLoadError';
    }
    if (request !== rankingRequest) return;
    rankingLoading = false; renderRankings();
  }
  function showRankings(mode = game.mode) {
    closeDialog(); refreshRankings(mode);
    $('leaderboard-panel').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
    $('leaderboard-panel').focus({ preventScroll: true });
  }
  function relicDescription(id, level = game.relics[id] || (RainExpedition.RELICS[id]?.kind === 'active' ? game.ownedRelics()[id] : 1) || 1) {
    const values = { feather: { n: 9 - level, depth: level === 3 ? 2 : 1 }, shield: { n: 1 },
      ukulele: { n: 20 + 5 * level + 5 * (game.relics.clover || 0), m: level >= 2 ? 3 : 4, groups: level }, cell: { n: 1 + level, m: 8 - level },
      blackhole: { n: level }, radar: { n: 3 + level }, gasoline: { n: 15 + 10 * level + 5 * (game.relics.clover || 0) }, behemoth: { n: 5 - level, depth: level }, clover: { n: 5 * level }, prism: { n: 10 + 10 * level + 5 * (game.relics.clover || 0), depth: level },
      seeker: { n: 5 - level, groups: level }, resin: { n: 4 - level }, turbine: { n: level }, capacitor: { n: 5 - level }, echo: { n: level, depth: level }, recycler: { n: 6 + 3 * level } };
    return t('desc_' + id, values[id]) + (level === 3 ? ' ' + t('evolve_' + id) : id === 'shield' && level === 2 ? ' ' + t('shieldEnergy') : '');
  }
  function relicIcon(id) {
    const relic = RainExpedition.RELICS[id];
    return `<span class="relic-portrait" data-rarity="${relic.rarity}" aria-hidden="true"><img src="assets/flat/${relic.icon}.webp" alt=""></span>`;
  }
  function relicMeter(id) {
    if (!game.relics[id]) return '';
    if (id === 'ukulele') return t(game.lightningReady ? game.lightningTarget ? 'expLightningTarget' : 'expLightningWait' : 'expLightningCharge', { n: game.spark, max: game.lightningLimit });
    if (id === 'seeker') return t(game.seekerCharge >= 5 - game.relics.seeker ? 'expSeekerWait' : 'expSeekerMeter', { n: game.seekerCharge, max: 5 - game.relics.seeker });
    if (id === 'resin' && game.fuse) return t('expFuseMeter', { n: game.fuse.ticks });
    if (id === 'turbine') return t('expTurbineMeter', { n: game.turbineCharge });
    if (id === 'capacitor') return t('expCapacitorMeter', { n: game.capacitorCharge, max: 5 - game.relics.capacitor });
    if (id === 'recycler') return t('expRecyclerMeter', { n: 6 + 3 * game.relics.recycler });
    return '';
  }
  function renderProcLog() {
    const log = $('proc-log'); log.replaceChildren();
    log.hidden = !isExpedition();
    if (log.hidden) return;
    log.setAttribute('aria-label', t('expProcLog'));
    if (!lastProc || lastProc.run !== runId || lastProc.stage !== game.stage) {
      log.textContent = t('expProcEmpty'); return;
    }
    const title = document.createElement('strong'); title.className = 'proc-log-title'; title.textContent = t('expProcLog') + ' · ' + t('expProcCount', { n: lastProc.total }); log.append(title);
    const totals = new Map();
    for (const event of lastProc.events) if (RainExpedition.RELICS[event.kind] && (event.ids.length === 3 || event.kind === 'turbine')) {
      const value = totals.get(event.kind) || 0; totals.set(event.kind, value + (event.kind === 'turbine' ? event.amount : event.ids.length));
    }
    for (const [id, n] of totals) {
      const chip = document.createElement('span'); chip.className = 'proc-entry'; chip.dataset.proc = id;
      chip.textContent = t(id === 'turbine' ? 'expProcEnergy' : 'expProcRecovered', { item: t('relic_' + id), n }); log.append(chip);
    }
  }
  function showCatalog() {
    showDialog('catalog', `<h2 id="modal-title">${t('expCatalogTitle')}</h2><p>${t('expCatalogCopy')}</p><div class="equipment-catalog">${Object.keys(RainExpedition.RELICS).map(id => `<button class="catalog-item" data-catalog="${id}">${relicIcon(id)}<span>${t('relic_' + id)}<small>${t('expRarity_' + RainExpedition.RELICS[id].rarity)}</small></span></button>`).join('')}</div><button id="catalog-close" class="secondary-button">${t('expStay')}</button>`);
    $('catalog-close').addEventListener('click', closeDialog);
    $('modal-content').querySelectorAll('[data-catalog]').forEach(button => button.addEventListener('click', () => showRelic(button.dataset.catalog)));
  }
  function loadoutMarkup() {
    return `<p class="build-summary">${t('expLoadout')} · ${game.loadout().map(({ id, level }) => `${t('relic_' + id)} ${level}`).join(' / ')}</p>`;
  }
  function showRelic(id = selectedRelic) {
    selectedRelic = id;
    const seal = game.sealed[id] ? `<p class="boss-victory">${t('expPartial', { n: game.relics[id] || 0, max: game.sealed[id] })} · ${t(game.relics[id] ? 'expPartialHint' : 'expSealedHint')}</p>` : '';
    const rarity = RainExpedition.RELICS[id].rarity;
    showDialog('relic', `<div class="relic-large">${relicIcon(id)}</div><p class="rarity-badge" data-rarity="${rarity}">${t('expRarity_' + rarity)} · ${t(RainExpedition.RELICS[id].kind === 'active' ? 'expActive' : 'expPassive')}</p><h2 id="modal-title">${t('relic_' + id)}</h2>${seal}${relicMeter(id) ? `<p class="relic-state">${relicMeter(id)}</p>` : ''}<p>${relicDescription(id)}</p><p class="relic-synergy"><b>${t('expSynergy')}</b><br>${t('synergy_' + id)}</p>${(game.relics[id] || 1) < 3 ? `<p class="relic-next"><b>${t('expNextLevel')}</b><br>${relicDescription(id, (game.relics[id] || 1) + 1)}</p>` : ''}<button class="primary-button" id="relic-close">${t('expStay')}</button><button class="text-button" id="relic-catalog">${t('expCatalog')}</button>`);
    $('relic-catalog').addEventListener('click', showCatalog);
    $('relic-close').addEventListener('click', closeDialog);
  }
  function renderExpedition() {
    document.body.classList.toggle('expedition-run', isExpedition());
    $('expedition-panel').hidden = !isExpedition();
    if (!isExpedition()) { document.body.classList.remove('boss-run'); $('proc-log').hidden = true; return; }
    const spec = RainExpedition.stageSpec(game.stage);
    $('expedition-stage').textContent = t('exp' + spec.theme[0].toUpperCase() + spec.theme.slice(1)) + ' · ' + t('expTotal', { n: game.recovered });
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
    $('relic-slots').textContent = t('expSlots', { n: game.loadout().filter(item => RainExpedition.RELICS[item.id].kind === 'passive').length, max: RainExpedition.PASSIVE_SLOTS, evolutions: game.evolutionSlots });
    $('expedition-ten').hidden = !tenRecord; $('expedition-ten').disabled = animating || savePaused;
    $('expedition-ten').textContent = t('expTenButton', { time: formatTime(tenTime || 0, true) });
    const relicBar = $('relic-bar'); relicBar.replaceChildren();
    for (const { id, level } of game.loadout()) {
      const button = document.createElement('button'); button.className = 'relic-chip'; button.dataset.relic = id;
      button.dataset.rarity = RainExpedition.RELICS[id].rarity;
      const sealed = Object.hasOwn(game.sealed, id), current = game.relics[id] || 0;
      button.classList.toggle('sealed', sealed && !current); button.classList.toggle('partial', sealed && !!current);
      const label = sealed ? current ? t('expPartial', { n: current, max: level }) : t('expSealed') : level === 3 ? t('expEvolved') : t('expLevel', { n: level });
      button.innerHTML = `${relicIcon(id)}<span class="relic-copy"><span class="relic-name">${t('relic_' + id)}</span><small>${t('expRarity_' + button.dataset.rarity)} · ${label}</small><small class="relic-meter">${id === 'ukulele' && current ? t(game.lightningReady ? 'expLightningMiniReady' : 'expLightningMini', { n: game.spark, max: game.lightningLimit }) : relicMeter(id) || '&nbsp;'}</small></span>`;
      button.title = t('expRarity_' + button.dataset.rarity) + ' · ' + label + ' · ' + (sealed && !current ? t('expSealedHint') : relicDescription(id));
      button.title += relicMeter(id) ? ' · ' + relicMeter(id) : '';
      button.setAttribute('aria-label', t('relic_' + id) + ' · ' + button.title);
      button.addEventListener('click', () => showRelic(id));
      relicBar.append(button);
    }
    if (!game.loadout().length) relicBar.textContent = t('expNoRelics');
    const owned = game.ownedRelics(), ownedActive = Object.keys(owned).find(id => RainExpedition.RELICS[id].kind === 'active');
    $('expedition-feather').hidden = !owned.feather;
    $('expedition-feather').textContent = targeting === 'feather' ? t('expCancel') : `${t('expFeather')} · ${!game.relics.feather ? t('expSealed') : game.featherCharge ? t('expReady') : t('expCharging', { n: game.featherRecharge - game.featherEnergy })}`;
    $('expedition-feather').disabled = animating || finalized || savePaused || !!game.pendingReward || game.status !== 'playing' || !game.featherTargets().length;
    $('expedition-active').hidden = !ownedActive;
    $('expedition-active').textContent = targeting === 'blackhole' ? t('expCancel') : `${t('relic_' + ownedActive)} · ${!game.equipment ? t('expSealed') : t('expCharge', { n: game.charge, max: game.capacity })}`;
    $('expedition-active').disabled = animating || finalized || savePaused || !game.canActivate();
    $('expedition-active').title = game.equipment ? relicDescription(game.equipment) : '';
    const pending = !!game.pendingReward || game.status === 'won';
    $('expedition-continue').hidden = !pending;
    $('expedition-continue').textContent = t(game.pendingReward ? 'expResumeReward' : 'expResumeStage');
    $('expedition-continue').disabled = animating || savePaused;
    $('expedition-extract').disabled = animating || finalized || savePaused || !!game.pendingReward || game.finished;
    let hint = targeting ? t(targeting === 'feather' ? 'expFeatherHint' : 'expCubeHint') : game.pendingReward ? t('expRewardPending')
      : t(game.midRewardTaken ? 'expSupplyDone' : 'expProgress', { n: game.stageMatches, max: game.rewardTarget });
    if (!targeting && !game.pendingReward) {
      if (game.radarActive) hint += ' · ' + t('expRadarOn', { n: game.radarUntil - game.moves });
      else if (game.equipment === 'blackhole' && game.charge && !game.cubeTargets().length) hint += ' · ' + t('expNeedPair');
      else if (game.equipment && game.charge < game.capacity) hint += ' · ' + t('expCharging', { n: Math.ceil(game.recharge - game.energy) });
      if (game.relics.shield) hint += ' · ' + t(game.shieldSpent ? 'expShieldSpent' : 'expShieldReady');

      if (game.radarActive && game.radarMark !== null) hint += ' · ' + t('expMarked', { item: itemName(game.radarMark) });
    }
    if (game.bossActive && !targeting) hint = t(sealedCount ? 'expBossHint' : 'expBossFinish');
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
      const img = document.createElement('img'); img.src = `assets/flat/${ITEMS[tile.type].icon}.webp`; img.alt = label.title;
      label.append(img); return label;
    }));
  }
  function rewardMarkup(id) {
    if (id === 'recharge') return `<b>${t('expRecharge')}</b><span>${t('expRechargeCopy')}</span>`;
    if (id.startsWith('restore_')) return `<b>${t('expRestore', { item: t(id.slice(8)) })}</b><span>${t('expRestoreCopy')}</span>`;
    const level = game.relics[id] || 0, active = RainExpedition.RELICS[id].kind === 'active';
    return `${relicIcon(id)}<div><small>${t('expRarity_' + RainExpedition.RELICS[id].rarity)} · ${t(active ? 'expActive' : 'expPassive')} · ${t(level ? 'expUpgrade' : active && game.equipment ? 'expReplaceActive' : 'expObtain', { n: level + 1 })}</small><b>${t('relic_' + id)}</b><span>${relicDescription(id, level + 1)} <em class="reward-synergy">${t('synergy_' + id)}</em>${level === 2 && game.evolved && Object.values(game.relics).filter(level => level === 3).length >= game.evolutionSlots ? ' ' + t('expEvolutionSwap', { item: t('relic_' + game.evolved) }) : ''}</span></div>`;
  }
  function showExpeditionReward() {
    if (!isExpedition() || !game.pendingReward || animating || savePaused) return;
    targeting = null;
    const first = !game.loadout().length;
    showDialog('reward', `<span class="modal-eyebrow">EXPEDITION / SUPPLY</span><h2 id="modal-title">${t(first ? 'expStartTitle' : 'expRewardTitle')}</h2><p>${t(first ? 'expStartCopy' : 'expRewardCopy')}</p>${first ? '' : `<p class="input-hint">${t('expGrowthGate', { n: game.levelCap, left: 2 - game.restocksUsed, evolutions: game.evolutionSlots })}<br>${t('expRewardOdds', { n: Math.round(game.legendaryChance * 100) })}</p>`}<div class="reward-choices">${game.pendingReward.map(id => `<button class="reward-choice" data-reward="${id}" data-rarity="${RainExpedition.RELICS[id]?.rarity || 'supply'}">${rewardMarkup(id)}</button>`).join('')}</div>`);
    $('modal-content').querySelectorAll('[data-reward]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.reward;
      if (!game.choose(id)) { showReplacement(id); return; }
      afterReward();
    }));
  }
  function showReplacement(id) {
    replacementItem = id;
    const passives = game.loadout().filter(relic => RainExpedition.RELICS[relic.id].kind === 'passive');
    showDialog('replace', `<h2 id="modal-title">${t('expReplaceTitle')}</h2><p>${t('expReplaceCopy')}</p><div class="reward-choices">${passives.map(relic => `<button class="reward-choice" data-replace="${relic.id}" data-rarity="${RainExpedition.RELICS[relic.id].rarity}">${relicIcon(relic.id)}<div><small>${t('expRarity_' + RainExpedition.RELICS[relic.id].rarity)}</small><b>${t('relic_' + relic.id)}</b><span>${t('expLevel', { n: relic.level })} → ${t('relic_' + id)} 1</span></div></button>`).join('')}</div><button class="secondary-button" id="reward-back">${t('expBack')}</button>`);
    $('reward-back').addEventListener('click', showExpeditionReward);
    $('modal-content').querySelectorAll('[data-replace]').forEach(button => button.addEventListener('click', () => {
      if (game.choose(id, button.dataset.replace)) afterReward();
    }));
  }
  function afterReward() {
    replacementItem = null; closeDialog(); render(); syncClock();
    if (game.status === 'won') showExpeditionStage();
  }
  function showExpeditionStage(animate = false) {
    if (animate === true) music.sound('win');
    if (!isExpedition() || savePaused || game.status !== 'won') return;
    if (game.pendingReward) { showExpeditionReward(); return; }
    showDialog('stage', `${fx.resultScene(true, t('expStageClear'), animate === true)}<span class="modal-eyebrow">${t('expStage', { n: game.stage })}</span><h2 id="modal-title">${t('expStageClear')}</h2><p>${t('expStageClearCopy')}</p><p>${t('expTotal', { n: game.recovered })}</p>${loadoutMarkup()}${game.stage === 10 ? `<p class="boss-victory">${t('expBossClear')}</p>` : ''}${tenRecord ? `<button class="secondary-button" id="stage-ten">${t('expTenButton', { time: formatTime(tenTime, true) })}</button>` : ''}<button class="primary-button" id="stage-next">${t(stageRewardClaimed ? 'expNext' : 'expStageReward')}</button><button class="text-button" id="stage-extract">${t('expExtract')}</button>`);
    $('stage-ten')?.addEventListener('click', showTenRecord);
    $('stage-extract').addEventListener('click', showExtract);
    $('stage-next').addEventListener('click', () => {
      if (!stageRewardClaimed) {
        stageRewardClaimed = true; game.offerReward(); render(); showExpeditionReward(); return;
      }
      if (animating || savePaused) return;
      cancelEffects(); const outgoing = fx.captureBoard();
      if (!game.nextStage()) { outgoing?.remove(); return; }
      stageRewardClaimed = false; targeting = null; animating = true; lastStatus = null;
      closeDialog(); $('board').replaceChildren(); render(); syncClock();
      playEffect(() => { music.sound('restart'); return fx.restart(outgoing); }, () => {
        if (game.bossActive) showBossIntro();
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
    if (events.some(event => RainExpedition.RELICS[event.kind] && (event.ids.length === 3 || event.kind === 'turbine'))) {
      lastProc = { run: runId, stage: game.stage, events, total: recoveredCount }; renderProcLog();
    }
    if (!events.length) { expeditionOutcome(); return; }
    const chain = recoveredCount ?? events.reduce((sum, event) => sum + (event.ids.length === 3 ? 3 : 0), 0);
    clearTimeout(comboTimeout); $('combo').textContent = chain >= 6 ? t('expChain', { n: chain }) : t('expFx_' + events[events.length - 1].kind);
    const returned = events.filter(event => event.kind === 'reclaim');
    if (returned.length && chain < 6) {
      const last = returned[returned.length - 1];
      $('combo').textContent = t('expReclaimed', { item: t('relic_' + last.relic), n: last.level });
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
  function showBossIntro() {
    showDialog('boss', `<div class="boss-emblem" aria-hidden="true"><i></i><i></i><span>◇</span></div><span class="modal-eyebrow">STAGE 10 / EQUIPMENT LOCKDOWN</span><h2 id="modal-title">${t('expBoss')}</h2><p>${t('expBossIntro')}</p><p class="boss-intro-rule">${t('expBossHint')}</p><button class="primary-button" id="boss-start">${t('expBossStart')}</button>`);
    $('boss-start').addEventListener('click', () => {
      closeDialog(); playEffect(() => { music.sound('boss'); return fx.bossEntrance(); });
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
        if (result.ok) { tenRecord.receipt = result; savePreference('rain-match-player', id); rankingCache.delete('expedition_distance'); rankingCache.delete('expedition_speed'); refreshRankings('expedition', true); }
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

  function showHelp() {
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
    if (modal.open) ({ boss: showBossIntro, ten: showTenRecord, resume: showResume, restartRun: confirmRestart, saveLocked: showSaveLocked, result: showResult, help: showHelp, credits: showCredits, catalog: showCatalog, relic: showRelic, reward: showExpeditionReward, stage: showExpeditionStage, extract: showExtract, replace: () => showReplacement(replacementItem) })[dialogView]?.();
    syncClock();
  }
  $('equipment-catalog').addEventListener('click', showCatalog);
  $('board').addEventListener('click', event => { const tile = event.target.closest('button[data-id]'); if (tile) pick(Number(tile.dataset.id)); });
  $('reserve').addEventListener('click', event => { const tile = event.target.closest('button[data-id]'); if (tile) pick(Number(tile.dataset.id)); });
  for (const name of ['remove', 'undo', 'shuffle']) $(name).addEventListener('click', () => use(name));
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { if (button.dataset.mode !== game.mode) { navigationToken++; if (button.dataset.mode === 'expedition') requestExpedition(); else start(button.dataset.mode); } }));
  $('restart').addEventListener('click', () => isExpedition() ? confirmRestart() : start());
  $('close-modal').addEventListener('click', closeDialog);
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
  $('refresh-rankings').addEventListener('click', () => refreshRankings(rankingMode, true));
  $('inline-ranking-tabs').querySelectorAll('[data-leaderboard-mode]').forEach(button => button.addEventListener('click', () => refreshRankings(button.dataset.leaderboardMode)));
  $('expedition-ranking-tabs').querySelectorAll('button').forEach(button => button.addEventListener('click', () => { expeditionBoard = button.dataset.expBoard; refreshRankings(expeditionBoard); }));
  $('rankings').addEventListener('click', () => showRankings()); $('result-button').addEventListener('click', showResult);
  $('language').addEventListener('click', toggleLanguage); $('modal-language').addEventListener('click', toggleLanguage);
  document.addEventListener('keydown', event => {
    if (modal.open || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.matches('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'Escape' && targeting) { targeting = null; render(); return; }
    const tool = { 1: 'remove', 2: 'undo', 3: 'shuffle' }[event.key];
    if (tool) { event.preventDefault(); use(tool); }
  });
  setInterval(() => { updateClock(); syncClock(); $('timer').textContent = formatTime(elapsed); if (performance.now() - lastCheckpoint > 5000) checkpoint(); }, 250);
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
    } else { saveState = saveStore.read(); renderResumeBanner(); }
  });
  localizePage();
  const requestedMode = new URLSearchParams(location.search).get('mode');
  if (Object.hasOwn(MODES, requestedMode)) start(requestedMode);
  else {
    // A paused preview keeps the landing screen in Expedition while the player
    // chooses to resume and while the cross-tab save lock is being acquired.
    game = saveState.record ? RainExpedition.Expedition.fromSave(saveState.record.game) : new RainExpedition.Expedition();
    elapsed = saveState.record?.elapsedMs || 0; savePaused = true;
    $('timer').textContent = formatTime(elapsed);
    render(); refreshRankings('expedition'); requestExpedition();
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
