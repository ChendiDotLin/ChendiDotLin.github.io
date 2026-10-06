(function () {
  'use strict';
  const { ITEMS, MODES } = RainMatch;
  const $ = id => document.getElementById(id);
  const modal = $('modal');
  const fx = RainEffects;
  let animating = false, targeting = null, stageRewardClaimed = false, replacementItem = null, selectedRelic = null;
  const isExpedition = () => game?.mode === 'expedition';
  const recovered = () => isExpedition() ? game.recovered : game.cleared;
  let storage;
  try { storage = window.localStorage; } catch (_) { storage = null; }
  const readPreference = key => { try { return storage?.getItem(key); } catch (_) { return null; } };
  const savePreference = (key, value) => { try { storage?.setItem(key, value); } catch (_) { /* Preferences are optional. */ } };
  const leaderboard = new RainLeaderboard.Leaderboard(window.RAIN_CONFIG);
  let language = readPreference('rain-match-language') === 'en' ? 'en' : 'zh';
  const t = (key, values) => RainI18n.translate(language, key, values);
  const itemName = type => language === 'en' ? ITEMS[type].en : ITEMS[type].name;
  const modeName = mode => t(`${mode}Title`);
  let game, elapsed = 0, tick = performance.now(), clockActive = false, sound = false, audio, comboTimeout;
  let savedWin = false, finalized = false, receipt = null, runId, dialogView = null, rankingMode = 'rain';
  let submitting = false, submissionPayload = null, rankingRequest = 0;
  let rankingData = null, rankingError = '', rankingLoading = false;
  const rankingCache = new Map();
  let playerDraft = readPreference('rain-match-player') || '', formError = '', lastStatus = null;
  let wins = Math.max(0, Number(readPreference('rain-match-wins')) || 0);
  const formatTime = (ms, precise = false) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${precise ? '.' + String(ms % 1000).padStart(3, '0') : ''}`;
  function updateClock() {
    const now = performance.now();
    if (clockActive) elapsed += now - tick;
    tick = now;
  }
  function syncClock() {
    clockActive = !!game && game.status === 'playing' && !finalized && !animating && !document.hidden && !modal.open && !game.pendingReward;
  }
  function closeDialog() {
    updateClock(); if (modal.open) modal.close(); dialogView = null; syncClock();
  }
  function beep(matched = false) {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const notes = matched ? [523.25, 659.25, 783.99] : [392];
      notes.forEach((frequency, i) => {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        const start = audio.currentTime + i * .07;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.055, start + .008);
        gain.gain.exponentialRampToValueAtTime(.001, start + .17);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.start(start); oscillator.stop(start + .18);
      });
    } catch (_) { /* Audio is optional. */ }
  }

  function tileElement(tile, interactive = true) {
    const item = ITEMS[tile.type], el = document.createElement(interactive ? 'button' : 'div');
    el.className = 'tile'; el.dataset.id = tile.id; el.dataset.type = tile.type;
    el.style.setProperty('--rarity', item.color); el.title = itemName(tile.type);
    el.setAttribute('aria-label', itemName(tile.type));
    const img = document.createElement('img');
    img.src = `assets/${item.id}.webp`; img.alt = ''; img.draggable = false;
    img.addEventListener('error', () => { el.textContent = itemName(tile.type); el.style.fontSize = '9px'; });
    el.append(img); return el;
  }
  function localizePage() {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    document.title = t('title'); document.querySelector('meta[name="description"]').content = t('description');
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
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
    $('effects').textContent = t(sound ? 'soundOff' : 'soundOn');
    $('wins').textContent = String(wins).padStart(2, '0');
  }
  function start(mode = game?.mode || 'rain') {
    fx.reset();
    const outgoing = game ? fx.captureBoard() : null;
    animating = !!game;
    closeDialog(); game = mode === 'expedition' ? new RainExpedition.Expedition() : new RainMatch.Game(mode);
    targeting = null; stageRewardClaimed = false; replacementItem = null; elapsed = 0; tick = performance.now();
    savedWin = false; finalized = false; receipt = null; formError = ''; lastStatus = null; submitting = false; submissionPayload = null;
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
      const effectRun = runId;
      fx.restart(outgoing).finally(() => {
        if (runId !== effectRun) return;
        updateClock(); animating = false; render(); syncClock();
        if (isExpedition()) showExpeditionReward();
      });
    } else if (isExpedition()) showExpeditionReward();
  }
  function render(enter = false) {
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
      el.disabled = (targeting ? !targets.has(tile.id) : blocked) || game.status !== 'playing' || finalized || animating || !!game.pendingReward;
      el.classList.toggle('blocked', blocked && !targets.has(tile.id));
      el.classList.toggle('relic-target', targets.has(tile.id)); el.classList.toggle('feather-target', targeting === 'feather' && targets.has(tile.id));
      el.style.zIndex = targets.has(tile.id) ? 100 + tile.z : tile.z + 1;
      const pair = game.rack.filter(id => game.tiles[id].type === tile.type).length === 2;
      el.classList.toggle('radar-pair', isExpedition() && game.radarActive && !blocked && pair);
      const blind = blocked && ['left', 'right'].includes(tile.pile) && !preview.has(tile.id) && !targets.has(tile.id);
      el.classList.toggle('blind', blind);
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
      const el = tileElement(game.tiles[id]); el.disabled = finalized || animating || !!game.pendingReward || !!targeting || game.status !== 'playing'; return el;
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
      $(name).disabled = finalized || animating || !game.canUse(name); $(name).classList.toggle('used', game.used[name]);
      $(name).querySelector('.charge').textContent = t(game.used[name] ? 'used' : 'free');
    }
    $('result-button').hidden = game.status === 'playing' || (isExpedition() && game.status === 'won');
    document.querySelector('.free-note').textContent = t(isExpedition() ? 'expFree' : 'freeNote');
    document.querySelector('[data-i18n=boardHint]').textContent = t(isExpedition() ? 'expBoardHint' : 'boardHint');
    renderExpedition();
  }
  function pick(id) {
    if (finalized || animating) return;
    const before = fx.snapshot();
    updateClock();
    if (isExpedition() && targeting === 'blackhole') { activateExpedition(id); return; }
    const result = game.pick(id, targeting === 'feather'); syncClock(); if (!result.ok) return;
    targeting = null;
    lastStatus = null; beep(result.matched); render();
    if (!result.events?.some(event => event.kind === 'shield')) fx.pick(before, id, result.type, result.matched);
    if (result.matched) {
      $('combo').textContent = t('match', { item: itemName(result.type) });
      $('combo').classList.remove('show'); void $('combo').offsetWidth;
      $('combo').classList.add('show'); clearTimeout(comboTimeout);
      comboTimeout = setTimeout(() => $('combo').classList.remove('show'), 1850);
    }
    if (isExpedition()) { finishExpeditionAction(before, result.events || []); return; }
    if (game.status !== 'playing') showResult(true);
  }
  function use(name) {
    if (finalized || animating) return;
    const before = fx.snapshot();
    updateClock(); if (!game.use(name)) return;
    targeting = null;
    const effectRun = runId;
    animating = true; closeDialog(); syncClock(); beep();
    formError = ''; lastStatus = { remove: 'removed', undo: 'undone', shuffle: 'shuffled' }[name]; render();
    fx.power(name, before).finally(() => {
      if (runId !== effectRun) return;
      updateClock(); animating = false; render(); syncClock();
    });
  }
  function showDialog(view, content) {
    updateClock(); dialogView = view; $('modal-content').innerHTML = content;
    if (!modal.open) modal.showModal(); syncClock();
  }
  function showResult(animateScene = false) {
    if (game.status === 'playing') return;
    if (isExpedition() && game.status === 'won') { showExpeditionStage(animateScene === true); return; }
    const won = game.status === 'won';
    if (won && !savedWin) {
      savedWin = true; wins++; $('wins').textContent = String(wins).padStart(2, '0'); savePreference('rain-match-wins', String(wins));
    }
    const rescue = !won && !finalized && (game.canUse('remove') || game.canUse('undo'));
    showDialog('result', `${fx.resultScene(won, t(won ? 'escapeSignal' : 'defeatSignal'), animateScene === true)}<span class="modal-eyebrow">${modeName(game.mode)}</span>
      <h2 id="modal-title">${t(isExpedition() ? 'expEnded' : won ? 'wonTitle' : 'lostTitle')}</h2>
      <p>${t(rescue ? 'rescueCopy' : isExpedition() ? 'expEndedCopy' : won ? 'wonCopy' : 'lostCopy')}</p>
      <div class="result-stats"><span>${t('recovered')}<b>${recovered()}${isExpedition() ? '' : ' / ' + game.tiles.length}</b></span><span>${t('time')}<b>${formatTime(Math.round(elapsed), true)}</b></span><span>${t(isExpedition() ? 'expReached' : 'moves')}<b>${isExpedition() ? game.stage : game.moves}</b></span></div>${isExpedition() ? loadoutMarkup() : ''}
      ${rescue && game.canUse('remove') ? `<button class="secondary-button" data-rescue="remove">${t('rescueRemove')}</button>` : ''}
      ${rescue && game.canUse('undo') ? `<button class="secondary-button" data-rescue="undo">${t('rescueUndo')}</button>` : ''}
      <div class="score-entry"><p class="scope-note">${t('rankingScope')}</p>
      ${receipt ? `<p id="save-feedback" class="save-feedback" role="status" tabindex="-1">${t(receipt.improved ? 'saved' : 'notBest', { rank: receipt.rank })}</p>` :
        `<form id="score-form" novalidate><label for="player-id">${t('player')}</label><div class="score-input-row"><input id="player-id" name="player-id" type="text" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="id-rules score-error" placeholder="${t('playerPlaceholder')}" required><button class="primary-button" type="submit" ${submitting || !leaderboard.configured ? 'disabled' : ''}>${t(submitting ? 'sending' : rescue ? 'submitEnd' : 'submit')}</button></div><p id="id-rules" class="input-hint">${t('idRules')}</p><p id="score-error" class="form-error" role="alert">${formError ? t(isExpedition() && formError === 'notConfigured' ? 'expDatabase' : formError) : !leaderboard.configured ? t('notConfigured') : ''}</p></form>`}
      <button class="text-button" id="view-result-rankings">${t('seeRankings')}</button></div>
      <button class="primary-button" data-new-run>${t(won && game.mode === 'drizzle' ? 'nextRain' : 'again')}</button>`);
    $('modal-content').querySelectorAll('[data-rescue]').forEach(button => button.addEventListener('click', () => use(button.dataset.rescue)));
    $('modal-content').querySelector('[data-new-run]').addEventListener('click', () => start(won && game.mode === 'drizzle' ? 'rain' : game.mode));
    $('view-result-rankings').addEventListener('click', () => showRankings(game.mode));
    if (!receipt) {
      $('player-id').value = playerDraft;
      $('player-id').readOnly = !!submissionPayload;
      $('player-id').addEventListener('input', () => { playerDraft = $('player-id').value; });
      $('score-form').addEventListener('submit', async event => {
        event.preventDefault(); if (receipt || submitting || game.status === 'playing') return;
        playerDraft = RainLeaderboard.normalizeId($('player-id').value);
        if (!RainLeaderboard.validId(playerDraft)) {
          formError = 'invalidId'; $('score-error').textContent = t(formError);
          $('player-id').setAttribute('aria-invalid', 'true'); $('player-id').focus(); return;
        }
        if (!leaderboard.configured) { formError = 'notConfigured'; showResult(); return; }
        // Freeze this run on submission, including after an ambiguous timeout.
        // A retry sends the same ID and payload, so the database can deduplicate it.
        submissionPayload ||= { runId, playerId: playerDraft, mode: game.mode, cleared: recovered(), elapsedMs: Math.round(elapsed), ...(isExpedition() ? { stage: game.stage, loadout: game.loadout() } : {}) };
        const submittingRun = runId;
        finalized = true; submitting = true; formError = ''; lastStatus = null;
        syncClock(); render(); showResult();
        const result = await leaderboard.submit(submissionPayload);
        if (runId !== submittingRun) return;
        submitting = false;
        if (!result.ok) formError = result.error;
        else {
          receipt = result; playerDraft = result.playerId; savePreference('rain-match-player', playerDraft);
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
      const selected = button.dataset.leaderboardMode === rankingMode;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    if (rankingLoading) {
      content.innerHTML = `<p class="empty-ranking" role="status">${t('loading')}</p>`; return;
    }
    if (rankingError) {
      content.innerHTML = `<p class="form-error" role="status">${t(rankingMode === 'expedition' && rankingError === 'notConfigured' ? 'expDatabase' : rankingError)}</p>`; return;
    }
    const { entries = [], total = 0 } = rankingData || {};
    content.innerHTML = entries.length ? `<div class="ranking-scroll" tabindex="0" role="region" aria-label="${modeName(rankingMode)}"><table class="ranking-table"><caption class="visually-hidden">${modeName(rankingMode)}</caption><thead><tr><th scope="col">${t('rank')}</th><th scope="col">${t('player')}</th><th scope="col">${t('score')}</th><th scope="col">${t('duration')}</th></tr></thead><tbody id="ranking-rows"></tbody></table></div><p class="ranking-count">${t('leaderboardCount', { n: total })}</p>`
      : `<div class="ranking-empty"><span aria-hidden="true">♧</span><p class="empty-ranking" role="status">${t('noScores')}</p></div>`;
    const ownId = receipt?.playerId || readPreference('rain-match-player');
    entries.slice(0, 10).forEach((entry, index) => {
      const row = document.createElement('tr');
      if (ownId === entry.playerId) row.className = 'own-score';
      for (const value of [index + 1, entry.playerId, entry.cleared, formatTime(entry.elapsedMs, true)]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      if (rankingMode === 'expedition' && entry.stage) {
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
  function relicDescription(id, level = game.relics[id] || 1) {
    const values = { feather: { n: Math.max(3, 6 - level) }, shield: { n: Math.max(3, 6 - level) },
      ukulele: { n: 15 + 10 * level }, cell: { n: 1 + level, m: Math.max(3, 6 - level) },
      blackhole: { n: level }, radar: { n: 3 + level } };
    return t('desc_' + id, values[id]);
  }
  function relicIcon(id) {
    // Safer Spaces uses an original shield glyph; other icons use the credited item art.
    return id === 'shield' ? '<span class="shield-glyph" aria-hidden="true">◈</span>'
      : `<img src="assets/${RainExpedition.RELICS[id].icon}.webp" alt="">`;
  }
  function loadoutMarkup() {
    return `<p class="build-summary">${t('expLoadout')} · ${game.loadout().map(({ id, level }) => `${t('relic_' + id)} ${level}`).join(' / ')}</p>`;
  }
  function showRelic(id = selectedRelic) {
    selectedRelic = id;
    showDialog('relic', `<div class="relic-large">${relicIcon(id)}</div><h2 id="modal-title">${t('relic_' + id)}</h2><p>${relicDescription(id)}</p><button class="primary-button" id="relic-close">${t('expStay')}</button>`);
    $('relic-close').addEventListener('click', closeDialog);
  }
  function renderExpedition() {
    document.body.classList.toggle('expedition-run', isExpedition());
    $('expedition-panel').hidden = !isExpedition();
    if (!isExpedition()) return;
    const spec = RainExpedition.stageSpec(game.stage);
    $('expedition-stage').textContent = t('exp' + spec.theme[0].toUpperCase() + spec.theme.slice(1)) + ' · ' + t('expTotal', { n: game.recovered });
    const relicBar = $('relic-bar'); relicBar.replaceChildren();
    for (const { id, level } of game.loadout()) {
      const button = document.createElement('button'); button.className = 'relic-chip';
      button.innerHTML = `${relicIcon(id)}<span>${t('relic_' + id)}<small>${t('expLevel', { n: level })}</small></span>`;
      button.title = relicDescription(id, level);
      button.setAttribute('aria-label', t('relic_' + id) + ' · ' + t('expLevel', { n: level }) + ' · ' + relicDescription(id, level));
      button.addEventListener('click', () => showRelic(id));
      relicBar.append(button);
    }
    if (!game.loadout().length) relicBar.textContent = t('expNoRelics');
    $('expedition-feather').hidden = !game.relics.feather;
    $('expedition-feather').textContent = targeting === 'feather' ? t('expCancel') : `${t('expFeather')} · ${game.featherCharge ? t('expReady') : t('expCharging', { n: Math.max(3, 6 - game.relics.feather) - game.featherEnergy })}`;
    $('expedition-feather').disabled = animating || finalized || !!game.pendingReward || game.status !== 'playing' || !game.featherTargets().length;
    $('expedition-active').hidden = !game.equipment;
    $('expedition-active').textContent = targeting === 'blackhole' ? t('expCancel') : `${t('relic_' + game.equipment)} · ${t('expCharge', { n: game.charge, max: game.capacity })}`;
    $('expedition-active').disabled = animating || finalized || !game.canActivate();
    $('expedition-active').title = game.equipment ? relicDescription(game.equipment) : '';
    const pending = !!game.pendingReward || game.status === 'won';
    $('expedition-continue').hidden = !pending;
    $('expedition-continue').textContent = t(game.pendingReward ? 'expResumeReward' : 'expResumeStage');
    $('expedition-continue').disabled = animating;
    $('expedition-extract').disabled = animating || finalized || !!game.pendingReward || game.finished;
    let hint = targeting ? t(targeting === 'feather' ? 'expFeatherHint' : 'expCubeHint') : game.pendingReward ? t('expRewardPending')
      : t('expProgress', { n: game.manualMatches % 6 });
    if (!targeting && !game.pendingReward) {
      if (game.radarActive) hint += ' · ' + t('expRadarOn', { n: game.radarUntil - game.moves });
      else if (game.equipment === 'blackhole' && game.charge && !game.cubeTargets().length) hint += ' · ' + t('expNeedPair');
      else if (game.equipment && game.charge < game.capacity) hint += ' · ' + t('expCharging', { n: game.recharge - game.energy });
      if (game.relics.shield) hint += ' · ' + t(game.shieldCooldown ? 'expShieldCharging' : 'expShieldReady', { n: game.shieldCooldown });
    }
    $('expedition-hint').textContent = hint;
    $('radar-preview').hidden = !game.radarActive;
    $('radar-preview').replaceChildren(...game.previewIds().map(id => {
      const tile = game.tiles[id], label = document.createElement('span');
      label.className = 'radar-preview-tile'; label.title = t(tile.pile) + ' · ' + itemName(tile.type);
      const img = document.createElement('img'); img.src = `assets/${ITEMS[tile.type].id}.webp`; img.alt = label.title;
      label.append(img); return label;
    }));
  }
  function rewardMarkup(id) {
    if (id === 'recharge') return `<b>${t('expRecharge')}</b><span>${t('expRechargeCopy')}</span>`;
    if (id.startsWith('restore_')) return `<b>${t('expRestore', { item: t(id.slice(8)) })}</b><span>${t('expRestoreCopy')}</span>`;
    const level = game.relics[id] || 0, active = RainExpedition.RELICS[id].kind === 'active';
    return `${relicIcon(id)}<div><small>${t(active ? 'expActive' : 'expPassive')} · ${t(level ? 'expUpgrade' : active && game.equipment ? 'expReplaceActive' : 'expObtain', { n: level + 1 })}</small><b>${t('relic_' + id)}</b><span>${relicDescription(id, level + 1)}</span></div>`;
  }
  function showExpeditionReward() {
    if (!isExpedition() || !game.pendingReward || animating) return;
    targeting = null;
    const first = !game.loadout().length;
    showDialog('reward', `<span class="modal-eyebrow">EXPEDITION / SUPPLY</span><h2 id="modal-title">${t(first ? 'expStartTitle' : 'expRewardTitle')}</h2><p>${t(first ? 'expStartCopy' : 'expRewardCopy')}</p><div class="reward-choices">${game.pendingReward.map(id => `<button class="reward-choice" data-reward="${id}">${rewardMarkup(id)}</button>`).join('')}</div>`);
    $('modal-content').querySelectorAll('[data-reward]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.reward;
      if (!game.choose(id)) { showReplacement(id); return; }
      afterReward();
    }));
  }
  function showReplacement(id) {
    replacementItem = id;
    const passives = game.loadout().filter(relic => RainExpedition.RELICS[relic.id].kind === 'passive');
    showDialog('replace', `<h2 id="modal-title">${t('expReplaceTitle')}</h2><p>${t('expReplaceCopy')}</p><div class="reward-choices">${passives.map(relic => `<button class="reward-choice" data-replace="${relic.id}">${relicIcon(relic.id)}<div><b>${t('relic_' + relic.id)}</b><span>${t('expLevel', { n: relic.level })} → ${t('relic_' + id)} 1</span></div></button>`).join('')}</div><button class="secondary-button" id="reward-back">${t('expBack')}</button>`);
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
    if (!isExpedition() || game.status !== 'won') return;
    if (game.pendingReward) { showExpeditionReward(); return; }
    showDialog('stage', `${fx.resultScene(true, t('expStageClear'), animate === true)}<span class="modal-eyebrow">${t('expStage', { n: game.stage })}</span><h2 id="modal-title">${t('expStageClear')}</h2><p>${t('expStageClearCopy')}</p><p>${t('expTotal', { n: game.recovered })}</p>${loadoutMarkup()}<button class="primary-button" id="stage-next">${t(stageRewardClaimed ? 'expNext' : 'expStageReward')}</button><button class="text-button" id="stage-extract">${t('expExtract')}</button>`);
    $('stage-extract').addEventListener('click', showExtract);
    $('stage-next').addEventListener('click', () => {
      if (!stageRewardClaimed) {
        stageRewardClaimed = true; game.offerReward(); render(); showExpeditionReward(); return;
      }
      if (animating) return;
      fx.reset(); const outgoing = fx.captureBoard();
      if (!game.nextStage()) { outgoing?.remove(); return; }
      stageRewardClaimed = false; targeting = null; animating = true; lastStatus = null;
      closeDialog(); $('board').replaceChildren(); render(); syncClock();
      const effectRun = runId;
      fx.restart(outgoing).finally(() => {
        if (runId !== effectRun) return;
        updateClock(); animating = false; render(); syncClock();
      });
    });
  }
  function showExtract() {
    if (!isExpedition() || game.finished || game.pendingReward || finalized || animating) return;
    showDialog('extract', `<h2 id="modal-title">${t('expExtractTitle')}</h2><p>${t('expExtractCopy')}</p><p>${t('expTotal', { n: game.recovered })} · ${t('expStage', { n: game.stage })}</p><button class="primary-button" id="extract-confirm">${t('expEnd')}</button><button class="secondary-button" id="extract-cancel">${t('expStay')}</button>`);
    $('extract-cancel').addEventListener('click', () => { closeDialog(); if (game.status === 'won') showExpeditionStage(); });
    $('extract-confirm').addEventListener('click', () => { if (game.end()) { targeting = null; lastStatus = null; render(); showResult(true); } });
  }
  function expeditionOutcome() {
    if (game.status !== 'playing') showResult(true);
    else if (game.pendingReward) showExpeditionReward();
  }
  function finishExpeditionAction(before, events) {
    if (!events.length) { expeditionOutcome(); return; }
    clearTimeout(comboTimeout); $('combo').textContent = t('expFx_' + events[events.length - 1].kind);
    $('combo').classList.add('show'); comboTimeout = setTimeout(() => $('combo').classList.remove('show'), 2200);
    animating = true; render(); syncClock(); const effectRun = runId;
    fx.relic(events, before).finally(() => {
      if (runId !== effectRun) return;
      updateClock(); animating = false; render(); syncClock(); expeditionOutcome();
    });
  }
  function activateExpedition(id) {
    if (!isExpedition() || finalized || animating) return;
    const before = fx.snapshot(); updateClock(); const result = game.activate(id);
    if (!result.ok) return;
    targeting = null; lastStatus = null; render(); finishExpeditionAction(before, result.events);
  }
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
    showDialog('credits', `<div class="modal-symbol">✧</div><h2 id="modal-title">${t('creditsTitle')}</h2><p>${t('creditsCopy')}</p><p>${t('creditsArt')} <a href="https://github.com/Glagan/RoR2-Items/tree/master/public/img" target="_blank" rel="noopener noreferrer">Glagan / RoR2-Items</a></p><p>${t('creditsMusic')} <a href="https://chrischristodoulou.bandcamp.com/album/risk-of-rain-2-4" target="_blank" rel="noopener noreferrer">Chris Christodoulou / Bandcamp</a></p><p>${t('creditsThanks')}</p>`);
  }
  function toggleLanguage() {
    if ($('player-id')) playerDraft = $('player-id').value;
    updateClock(); language = language === 'zh' ? 'en' : 'zh'; savePreference('rain-match-language', language);
    localizePage(); render(); clearTimeout(comboTimeout); $('combo').classList.remove('show');
    if (modal.open) ({ result: showResult, help: showHelp, credits: showCredits, relic: showRelic, reward: showExpeditionReward, stage: showExpeditionStage, extract: showExtract, replace: () => showReplacement(replacementItem) })[dialogView]?.();
    syncClock();
  }
  $('board').addEventListener('click', event => { const tile = event.target.closest('button[data-id]'); if (tile) pick(Number(tile.dataset.id)); });
  $('reserve').addEventListener('click', event => { const tile = event.target.closest('button[data-id]'); if (tile) pick(Number(tile.dataset.id)); });
  for (const name of ['remove', 'undo', 'shuffle']) $(name).addEventListener('click', () => use(name));
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { if (button.dataset.mode !== game.mode) start(button.dataset.mode); }));
  $('restart').addEventListener('click', () => start());
  $('close-modal').addEventListener('click', closeDialog);
  modal.addEventListener('close', () => { if (!modal.open) { dialogView = null; updateClock(); syncClock(); } });
  function toggleMusic() {
    const open = $('music-panel').hidden;
    $('music-panel').hidden = !open;
    $('sound').setAttribute('aria-expanded', String(open));
    $('sound').style.color = open ? 'var(--purple)' : '';
    if (open) {
      // Official streaming embed: no copied audio files or extracted stream URLs.
      const frame = document.createElement('iframe');
      frame.src = 'https://bandcamp.com/EmbeddedPlayer/album=270762832/size=small/bgcol=202936/linkcol=bdb2f1/transparent=true/';
      frame.title = 'Risk of Rain 2 — Chris Christodoulou';
      frame.allow = 'autoplay'; frame.referrerPolicy = 'strict-origin-when-cross-origin';
      $('music-player').replaceChildren(frame);
    } else {
      $('music-player').replaceChildren(); // Removing the player also stops its audio.
      $('sound').focus();
    }
    localizePage();
  }
  $('sound').addEventListener('click', toggleMusic);
  $('music-close').addEventListener('click', toggleMusic);
  $('effects').addEventListener('click', () => {
    sound = !sound; $('effects').setAttribute('aria-pressed', String(sound));
    localizePage(); beep();
  });
  $('help').addEventListener('click', showHelp); $('credits').addEventListener('click', showCredits);
  $('refresh-rankings').addEventListener('click', () => refreshRankings(rankingMode, true));
  $('inline-ranking-tabs').querySelectorAll('[data-leaderboard-mode]').forEach(button => button.addEventListener('click', () => refreshRankings(button.dataset.leaderboardMode)));
  $('rankings').addEventListener('click', () => showRankings()); $('result-button').addEventListener('click', showResult);
  $('language').addEventListener('click', toggleLanguage); $('modal-language').addEventListener('click', toggleLanguage);
  document.addEventListener('keydown', event => {
    if (modal.open || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.matches('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'Escape' && targeting) { targeting = null; render(); return; }
    const tool = { 1: 'remove', 2: 'undo', 3: 'shuffle' }[event.key];
    if (tool) { event.preventDefault(); use(tool); }
  });
  setInterval(() => { updateClock(); syncClock(); $('timer').textContent = formatTime(elapsed); }, 250);
  document.addEventListener('visibilitychange', () => { updateClock(); syncClock(); });
  localizePage(); start(new URLSearchParams(location.search).get('mode') === 'expedition' ? 'expedition' : 'rain');
})();
