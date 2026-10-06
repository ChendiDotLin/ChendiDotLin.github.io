(function () {
  'use strict';
  const { ITEMS, MODES } = RainMatch;
  const $ = id => document.getElementById(id);
  const modal = $('modal');
  const fx = RainEffects;
  let animating = false;
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
  let playerDraft = readPreference('rain-match-player') || '', formError = '', lastStatus = null;
  let wins = Math.max(0, Number(readPreference('rain-match-wins')) || 0);
  const formatTime = (ms, precise = false) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${precise ? '.' + String(ms % 1000).padStart(3, '0') : ''}`;
  function updateClock() {
    const now = performance.now();
    if (clockActive) elapsed += now - tick;
    tick = now;
  }
  function syncClock() {
    clockActive = !!game && game.status === 'playing' && !finalized && !animating && !document.hidden && !modal.open;
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
    for (const [id, key] of Object.entries(labels)) { $(id).setAttribute('aria-label', t(key)); $(id).title = t(key); }
    for (const id of ['language', 'modal-language']) {
      $(id).textContent = language === 'zh' ? 'EN' : '中文'; $(id).setAttribute('aria-label', t('language')); $(id).title = t('language');
    }
    for (const tool of ['remove', 'undo', 'shuffle']) $(tool).title = t(`${tool}Hint`);
    document.querySelector('.difficulty-options').setAttribute('aria-label', t('difficulty'));
    document.querySelector('.game-panel').setAttribute('aria-label', t('game'));
    document.querySelector('.progress-track').setAttribute('aria-label', t('progress'));
    document.querySelectorAll('[data-mode]').forEach(button => {
      button.textContent = t(button.dataset.mode);
      button.title = t('modeHint', { mode: modeName(button.dataset.mode), n: MODES[button.dataset.mode].count });
    });
    $('effects').textContent = t(sound ? 'soundOff' : 'soundOn');
    $('wins').textContent = String(wins).padStart(2, '0');
  }
  function start(mode = game?.mode || 'rain') {
    fx.reset();
    const outgoing = game ? fx.captureBoard() : null;
    animating = !!game;
    closeDialog(); game = new RainMatch.Game(mode); elapsed = 0; tick = performance.now();
    savedWin = false; finalized = false; receipt = null; formError = ''; lastStatus = null; submitting = false; submissionPayload = null;
    runId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, digit => (Number(digit) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(digit) / 4).toString(16));
    clearTimeout(comboTimeout); $('combo').classList.remove('show');
    $('board').replaceChildren(); $('timer').textContent = '00:00';
    document.querySelectorAll('[data-mode]').forEach(button => {
      const selected = button.dataset.mode === game.mode;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    render(!animating); syncClock();
    if (animating) {
      const effectRun = runId;
      fx.restart(outgoing).finally(() => {
        if (runId !== effectRun) return;
        updateClock(); animating = false; render(); syncClock();
      });
    }
  }
  function render(enter = false) {
    $('mode-title').textContent = modeName(game.mode);
    const available = new Set(game.available().map(tile => tile.id));
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
      el.disabled = blocked || game.status !== 'playing' || finalized || animating; el.classList.toggle('blocked', blocked);
      const blind = blocked && ['left', 'right'].includes(tile.pile);
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
      const el = tileElement(game.tiles[id]); el.disabled = finalized || animating || game.status !== 'playing'; return el;
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
    $('status').textContent = lastStatus ? t(lastStatus) : receipt ? t('statusFinal') : finalized ? t('statusPending') : game.status === 'won' ? t('statusWon')
      : game.status === 'lost' ? t('statusLost') : danger ? t('statusDanger', { n: 7 - game.rack.length }) : t('statusReady');
    for (const name of ['remove', 'undo', 'shuffle']) {
      $(name).disabled = finalized || animating || !game.canUse(name); $(name).classList.toggle('used', game.used[name]);
      $(name).querySelector('.charge').textContent = t(game.used[name] ? 'used' : 'free');
    }
    $('result-button').hidden = game.status === 'playing';
  }
  function pick(id) {
    if (finalized || animating) return;
    const before = fx.snapshot();
    updateClock(); const result = game.pick(id); syncClock(); if (!result.ok) return;
    lastStatus = null; beep(result.matched); render();
    fx.pick(before, id, result.type, result.matched);
    if (result.matched) {
      $('combo').textContent = t('match', { item: itemName(result.type) });
      $('combo').classList.remove('show'); void $('combo').offsetWidth;
      $('combo').classList.add('show'); clearTimeout(comboTimeout);
      comboTimeout = setTimeout(() => $('combo').classList.remove('show'), 1850);
    }
    if (game.status !== 'playing') showResult(true);
  }
  function use(name) {
    if (finalized || animating) return;
    const before = fx.snapshot();
    updateClock(); if (!game.use(name)) return;
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
    const won = game.status === 'won';
    if (won && !savedWin) {
      savedWin = true; wins++; $('wins').textContent = String(wins).padStart(2, '0'); savePreference('rain-match-wins', String(wins));
    }
    const rescue = !won && !finalized && (game.canUse('remove') || game.canUse('undo'));
    showDialog('result', `${fx.resultScene(won, t(won ? 'escapeSignal' : 'defeatSignal'), animateScene === true)}<span class="modal-eyebrow">${modeName(game.mode)}</span>
      <h2 id="modal-title">${t(won ? 'wonTitle' : 'lostTitle')}</h2>
      <p>${t(won ? 'wonCopy' : rescue ? 'rescueCopy' : 'lostCopy')}</p>
      <div class="result-stats"><span>${t('recovered')}<b>${game.cleared} / ${game.tiles.length}</b></span><span>${t('time')}<b>${formatTime(Math.round(elapsed), true)}</b></span><span>${t('moves')}<b>${game.moves}</b></span></div>
      ${rescue && game.canUse('remove') ? `<button class="secondary-button" data-rescue="remove">${t('rescueRemove')}</button>` : ''}
      ${rescue && game.canUse('undo') ? `<button class="secondary-button" data-rescue="undo">${t('rescueUndo')}</button>` : ''}
      <div class="score-entry"><p class="scope-note">${t('rankingScope')}</p>
      ${receipt ? `<p id="save-feedback" class="save-feedback" role="status" tabindex="-1">${t(receipt.improved ? 'saved' : 'notBest', { rank: receipt.rank })}</p>` :
        `<form id="score-form" novalidate><label for="player-id">${t('player')}</label><div class="score-input-row"><input id="player-id" name="player-id" type="text" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="id-rules score-error" placeholder="${t('playerPlaceholder')}" required><button class="primary-button" type="submit" ${submitting || !leaderboard.configured ? 'disabled' : ''}>${t(submitting ? 'sending' : rescue ? 'submitEnd' : 'submit')}</button></div><p id="id-rules" class="input-hint">${t('idRules')}</p><p id="score-error" class="form-error" role="alert">${formError ? t(formError) : !leaderboard.configured ? t('notConfigured') : ''}</p></form>`}
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
        submissionPayload ||= { runId, playerId: playerDraft, mode: game.mode, cleared: game.cleared, elapsedMs: Math.round(elapsed) };
        const submittingRun = runId;
        finalized = true; submitting = true; formError = ''; lastStatus = null;
        syncClock(); render(); showResult();
        const result = await leaderboard.submit(submissionPayload);
        if (runId !== submittingRun) return;
        submitting = false;
        if (!result.ok) formError = result.error;
        else { receipt = result; playerDraft = result.playerId; savePreference('rain-match-player', playerDraft); }
        render();
        if (modal.open && dialogView === 'result') { showResult(); (receipt ? $('save-feedback') : $('score-error')).focus(); }
      });
    }
  }
  async function showRankings(mode = game.mode) {
    rankingMode = mode;
    const request = ++rankingRequest;
    function frame(body) {
      showDialog('rankings', `<div class="modal-symbol">♧</div><h2 id="modal-title">${t('rankingTitle')}</h2>
        <p class="scope-note">${t('rankingScope')}</p><p class="ranking-rules">${t('rankingRules')}</p>
        <div class="ranking-tabs" role="group" aria-label="${t('difficulty')}">${Object.keys(MODES).map(key => `<button class="${key === mode ? 'selected' : ''}" data-leaderboard-mode="${key}" aria-pressed="${key === mode}">${t(key)}</button>`).join('')}</div>
        ${body}${game.status !== 'playing' ? `<button class="secondary-button" id="back-result">${t('backResult')}</button>` : ''}`);
      document.querySelectorAll('[data-leaderboard-mode]').forEach(button => button.addEventListener('click', () => showRankings(button.dataset.leaderboardMode)));
      $('back-result')?.addEventListener('click', showResult);
    }
    frame(`<p class="empty-ranking" role="status">${t(leaderboard.configured ? 'loading' : 'notConfigured')}</p>`);
    if (!leaderboard.configured) return;
    try {
      const { entries, total } = await leaderboard.list(mode);
      if (request !== rankingRequest || !modal.open || dialogView !== 'rankings') return;
      frame(entries.length ? `<div class="ranking-scroll"><table class="ranking-table"><caption class="visually-hidden">${modeName(mode)}</caption><thead><tr><th scope="col">${t('rank')}</th><th scope="col">${t('player')}</th><th scope="col">${t('score')}</th><th scope="col">${t('duration')}</th></tr></thead><tbody id="ranking-rows"></tbody></table></div><p class="input-hint">${t('leaderboardCount', { n: total })}</p>` : `<p class="empty-ranking">${t('noScores')}</p>`);
      entries.forEach((entry, index) => {
        const row = document.createElement('tr');
        if (receipt?.playerId === entry.playerId && game.mode === mode) row.className = 'own-score';
        for (const value of [index + 1, entry.playerId, entry.cleared, formatTime(entry.elapsedMs, true)]) {
          const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
        }
        $('ranking-rows').append(row);
      });
    } catch (error) {
      if (request !== rankingRequest || !modal.open || dialogView !== 'rankings') return;
      frame(`<p class="form-error" role="alert">${t(error.message === 'notConfigured' ? 'notConfigured' : 'networkError')}</p><button class="secondary-button" id="retry-rankings">${t('retry')}</button>`);
      $('retry-rankings').addEventListener('click', () => showRankings(mode));
    }
  }
  function showHelp() {
    showDialog('help', `<div class="modal-symbol">◇</div><h2 id="modal-title">${t('helpTitle')}</h2><ol>${t('helpSteps').map(step => `<li>${step}</li>`).join('')}</ol><p>${t('helpStrategy')}</p><p>${t('helpPowers')}</p><p>${t('helpRanking')}</p><p class="keyboard-note">${t('helpKeys')}</p>`);
  }
  function showCredits() {
    showDialog('credits', `<div class="modal-symbol">✧</div><h2 id="modal-title">${t('creditsTitle')}</h2><p>${t('creditsCopy')}</p><p>${t('creditsArt')} <a href="https://github.com/Glagan/RoR2-Items/tree/master/public/img" target="_blank" rel="noopener noreferrer">Glagan / RoR2-Items</a></p><p>${t('creditsMusic')} <a href="https://chrischristodoulou.bandcamp.com/album/risk-of-rain-2-4" target="_blank" rel="noopener noreferrer">Chris Christodoulou / Bandcamp</a></p><p>${t('creditsThanks')}</p>`);
  }
  function toggleLanguage() {
    if ($('player-id')) playerDraft = $('player-id').value;
    updateClock(); language = language === 'zh' ? 'en' : 'zh'; savePreference('rain-match-language', language);
    localizePage(); render(); clearTimeout(comboTimeout); $('combo').classList.remove('show');
    if (modal.open) ({ result: showResult, rankings: () => showRankings(rankingMode), help: showHelp, credits: showCredits })[dialogView]?.();
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
  $('rankings').addEventListener('click', () => showRankings()); $('result-button').addEventListener('click', showResult);
  $('language').addEventListener('click', toggleLanguage); $('modal-language').addEventListener('click', toggleLanguage);
  document.addEventListener('keydown', event => {
    if (modal.open || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.matches('input, textarea, select, [contenteditable]')) return;
    const tool = { 1: 'remove', 2: 'undo', 3: 'shuffle' }[event.key];
    if (tool) { event.preventDefault(); use(tool); }
  });
  setInterval(() => { updateClock(); syncClock(); $('timer').textContent = formatTime(elapsed); }, 250);
  document.addEventListener('visibilitychange', () => { updateClock(); syncClock(); });
  localizePage(); start();
})();
