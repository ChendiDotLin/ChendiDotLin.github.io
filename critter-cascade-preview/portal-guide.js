/* Portal-only onboarding. The existing game remains the sole owner of run state. */
(() => {
  const DONE = 'preview-critter-portal-learned-v1', RUN = 'preview-critter-portal-guide-v1';
  const get = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const put = (key, value) => { try { localStorage.setItem(key, value); } catch (_) { /* Optional preference. */ } };
  let record;
  try { record = JSON.parse(get(RUN)); } catch (_) { record = null; }
  let current, redraw, lastNotice = '', noticeUntil = 0;
  const copy = {
    en: {
      portalEyebrow: 'MATCH · BEFRIEND · EVOLVE', portalIntro: 'Match three tiles. Meet your companions. Turn little sparks into mighty chain reactions.',
      portalStart: 'Start adventure', portalStartNote: 'New here? Learn as you play. No rush.', portalArtLabel: 'A little friend. A legendary future.',
      portalOtherModes: 'Just matching? Explore other modes', portalDrizzle: 'A gentle 36-tile warm-up.', portalRain: 'More layers. Plan your matches.', portalMonsoon: 'Deep stacks. Seven slots.', portalEclipse: 'Hidden tiles and a ticking clock.',
      portalTeamDetails: 'Team details & chain history', portalModes: 'Modes', portalSkip: 'Skip guide', portalFirst: 'Make your first match',
      portalPick: 'Tap three matching bright tiles. They clear from your tray.', portalPair: 'Find another of the same picture. Keep room in your tray!',
      portalFriend: 'You made a friend!', portalFriendCopy: 'Water Snake joins you. Every 4 matches, it zaps 3 matching uncovered tiles.',
      portalCharge: 'Charge your little lightning friend', portalChargeCopy: 'Match sets of three. Each match fills one spark.',
      portalFire: 'That was Water Snake!', portalFireCopy: 'Its lightning cleared 3 extra tiles. Keep matching to charge it again.',
      portalReady: 'Lightning is ready', portalReadyCopy: 'Reveal 3 matching tiles on the board. Water Snake will zap them on your next match.',
      portalGoal: 'Clear the board. Grow your team.', portalGoalCopy: 'Match three to clear. A full seven-slot tray ends the run.',
      portalFuture: 'Your adventure is just beginning', portalFutureCopy: 'Meet another companion after stage 2. From stage 3, future supplies can evolve your friends to Level 2.',
      portalNextForm: 'Next evolution', portalForm1: 'Water Snake', portalForm2: 'Fin Snake', portalLevel2: 'Level 2 · Lightning clears up to 6 tiles',
      portalRules: 'How it works', portalDetail: 'Select a companion to see the details.', portalUsed: 'Help from your companions'
    },
    zh: {
      portalEyebrow: '三消 · 结伴 · 进化', portalIntro: '从三张相同的牌开始，认识小伙伴，让小小闪电变成大大连锁。',
      portalStart: '开始冒险', portalStartNote: '第一次玩？边玩边学，慢慢来。', portalArtLabel: '小小伙伴，也有传说级的未来。',
      portalOtherModes: '只想三消？看看其他模式', portalDrizzle: '36 张牌，轻松热身。', portalRain: '更多叠层，规划三消。', portalMonsoon: '深层牌堆，七格背包。', portalEclipse: '记忆迷雾与限时追猎。',
      portalTeamDetails: '队伍详情与连锁记录', portalModes: '切换模式', portalSkip: '跳过引导', portalFirst: '完成第一次三消',
      portalPick: '点击三张相同的亮牌，它们会从背包中消除。', portalPair: '再找一张相同图案，留意背包空位！',
      portalFriend: '你有新伙伴啦！', portalFriendCopy: '水蛇加入队伍。每三消 4 次，闪电消除棋盘上 3 张相同的亮牌。',
      portalCharge: '给水蛇攒一束闪电', portalChargeCopy: '每完成一次三消，就点亮一格。',
      portalFire: '刚才是水蛇帮了你！', portalFireCopy: '闪电额外消除了 3 张牌。继续三消，就能再次充能。',
      portalReady: '闪电准备好了', portalReadyCopy: '露出 3 张相同的亮牌，下次三消时水蛇就会消掉它们。',
      portalGoal: '清空牌面，结伴前行', portalGoalCopy: '三张相同自动消除，七格背包装满就失败。',
      portalFuture: '小伙伴的冒险才刚开始', portalFutureCopy: '第 2 关后再认识一位伙伴。从第 3 关起，之后的补给可让伙伴进化到 2 级。',
      portalNextForm: '下一次进化', portalForm1: '水蛇', portalForm2: '蓝鳍蛇', portalLevel2: '2 级 · 闪电最多消除 6 张牌',
      portalRules: '详细规则', portalDetail: '选中伙伴后可查看详细规则。', portalUsed: '伙伴帮忙了'
    }
  };
  Object.entries(copy).forEach(([lang, values]) => Object.assign(RainI18n.messages[lang], values));
  const language = () => document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
  const t = key => copy[language()][key];
  let spriteId = 0;
  const sprite = (family, row, level) => {
    const box = ClackAtlas[family][row][level-1], id = 'portal-sprite-' + (++spriteId);
    return `<svg viewBox="${box.join(' ')}" aria-hidden="true"><defs><clipPath id="${id}"><rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}"/></clipPath></defs><image clip-path="url(#${id})" href="assets/companions/${family}.webp" width="1402" height="1122"/></svg>`;
  };
  function persist() { put(RUN, JSON.stringify(record)); }
  function active(g, id) { return g.mode === 'expedition' && g.stage === 1 && record?.run === id && !record.done; }
  function grant(g) {
    if (g.loadout().length) return;
    g.pendingReward = ['ukulele']; g.choose('ukulele');
  }
  const coach = document.createElement('section'); coach.id = 'portal-coach'; coach.setAttribute('aria-label', 'Adventure guide');
  coach.innerHTML = '<button class="portal-coach-portrait" hidden></button><div class="portal-coach-copy" role="status" aria-live="polite"><strong id="portal-coach-title"></strong><p id="portal-coach-text"></p><div id="portal-sparks" hidden></div></div><button id="portal-skip" class="text-button"></button>';
  coach.querySelector('.portal-coach-portrait').addEventListener('click', () => document.querySelector('[data-relic="ukulele"]')?.click());
  document.querySelector('.game-panel').append(coach);
  document.getElementById('portal-skip').addEventListener('click', () => {
    if (!current || !active(current.g, current.id)) return;
    grant(current.g); record.done = true; persist(); put(DONE, 'yes'); redraw?.();
  });
  function localize() {
    document.getElementById('welcome-title').innerHTML = language() === 'en' ? 'Small friends.<br>Big cascades.' : '小小伙伴，<br>大大连锁。';
    document.querySelectorAll('[data-i18n^="portal"]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.getElementById('portal-skip').textContent = t('portalSkip');
  }
  function prepare(g, id) {
    if (g.mode !== 'expedition' || get(DONE) === 'yes') return;
    // Same 36-tile stage size and save format, with a gentle, solvable opening.
    const intro = new RainMatch.Game('drizzle', g.random);
    intro.tiles.forEach((tile, i) => { tile.type = [2, 0, 4, 5][Math.floor(i / 3) % 4]; });
    g.tiles = intro.tiles; g.solution = []; g.pendingReward = null;
    record = {run: id, done: false, fired: false}; persist();
  }
  function picked(g, id, result) {
    if (!active(g, id) || !result.ok) return;
    if (result.matched && !g.loadout().length) grant(g);
    if (result.events?.some(event => event.kind === 'ukulele')) { record.fired = true; persist(); }
  }
  function hints(g, enabled) {
    const ids = new Set();
    if (enabled && g.status === 'playing') {
      const available = g.available(), held = g.rack.map(id => g.tiles[id].type);
      let type = held.find(type => available.filter(tile => tile.type === type).length + held.filter(h => h === type).length >= 3);
      if (type === undefined) type = available.find(tile => available.filter(other => other.type === tile.type).length >= 3)?.type;
      available.filter(tile => tile.type === type).slice(0, 3 - held.filter(h => h === type).length).forEach(tile => ids.add(tile.id));
    }
    document.querySelectorAll('#board .tile').forEach(el => el.classList.toggle('portal-hint', ids.has(Number(el.dataset.id))));
  }
  function render(g, id, rerender) {
    current = {g, id}; redraw = rerender; localize();
    const guided = active(g, id);
    coach.hidden = g.mode === 'expedition' && g.stage > 1;
    // The controls live next to the tray in this build, outside the team panel.
    document.querySelector('.expedition-controls').hidden = g.mode !== 'expedition';
    for (const name of ['boss-status', 'boss-trial', 'environment-status']) {
      if (g.mode !== 'expedition') document.getElementById(name).hidden = true;
    }
    let title = 'portalGoal', text = 'portalGoalCopy';
    if (guided) {
      if (!g.loadout().length) { title = 'portalFirst'; text = g.rack.length ? 'portalPair' : 'portalPick'; }
      else if (record.fired) { title = 'portalFire'; text = 'portalFireCopy'; }
      else if (g.manualMatches <= 1) { title = 'portalFriend'; text = 'portalFriendCopy'; }
      else if (g.lightningReady) { title = 'portalReady'; text = 'portalReadyCopy'; }
      else { title = 'portalCharge'; text = 'portalChargeCopy'; }
      if (g.status === 'won') { record.done = true; persist(); put(DONE, 'yes'); }
    }
    document.getElementById('portal-coach-title').textContent = t(title);
    document.getElementById('portal-coach-text').textContent = !guided && noticeUntil > performance.now() ? lastNotice : t(text);
    const portrait = coach.querySelector('.portal-coach-portrait'), sparks = document.getElementById('portal-sparks');
    portrait.hidden = sparks.hidden = !guided || !g.relics?.ukulele;
    if (!portrait.hidden) {
      portrait.innerHTML = sprite('dragons', 0, 1); portrait.setAttribute('aria-label', ClackCompanions.name('ukulele', 1, language()));
      sparks.innerHTML = Array.from({length:g.lightningLimit}, (_, i) => `<i class="${g.lightningReady || i < g.spark ? 'charged' : ''}"></i>`).join('') + `<span>${g.lightningReady ? g.lightningLimit : g.spark}/${g.lightningLimit}</span>`;
    }
    document.getElementById('portal-skip').hidden = !guided || g.status !== 'playing';
    coach.classList.toggle('is-guided', guided);
    hints(g, guided && !record.fired);
    if (g.mode !== 'expedition') return;
    document.querySelectorAll('.relic-chip').forEach(chip => {
      const key = chip.dataset.relic, level = g.relics[key] || 0;
      chip.dataset.level = level || '◇';
      const progress = key === 'ukulele' ? [g.lightningReady ? g.lightningLimit : g.spark, g.lightningLimit] : key === g.equipment ? [g.charge, g.capacity] : null;
      if (progress && level) {
        const meter = document.createElement('span'); meter.className = 'portal-charge';
        meter.setAttribute('role', 'progressbar'); meter.setAttribute('aria-label', chip.querySelector('.relic-name').textContent);
        meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', progress[1]); meter.setAttribute('aria-valuenow', progress[0]);
        meter.innerHTML = `<i style="width:${100 * progress[0] / progress[1]}%"></i>`; chip.append(meter);
      }
    });
  }
  function events(g, events) {
    const hits = events.filter(event => g.definitions?.[event.kind]);
    if (!hits.length) return;
    const names = [...new Set(hits.map(event => ClackCompanions.name(event.kind, g.relics[event.kind] || 1, language())))];
    lastNotice = `${names.join(' + ')} · ${t('portalUsed')}`; noticeUntil = performance.now() + 3000;
    for (const chip of document.querySelectorAll('.relic-chip')) if (hits.some(event => event.kind === chip.dataset.relic)) {
      chip.classList.add('proc-flash');
    }
  }
  function milestone(g, id) {
    if (g.stage !== 1 || record?.run !== id) return '';
    return `<div class="portal-evolution"><div><span>${t('portalNextForm')}</span><strong>${t('portalForm1')} → ${t('portalForm2')}</strong><p>${t('portalLevel2')}</p></div><div class="portal-evolution-art">${sprite('dragons',0,1)}<span>→</span>${sprite('dragons',0,2)}</div><p>${t('portalFutureCopy')}</p></div>`;
  }
  window.RainPortal = {prepare, picked, render, events, milestone, localize, sprite};
})();
