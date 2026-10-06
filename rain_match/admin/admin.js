(function () {
  'use strict';
  const $ = id => document.getElementById(id), config = window.RAIN_CONFIG;
  const words = {
    zh: {
      back: '← 返回游戏', title: '排行榜管理', intro: '仅开发者账号可管理。所有删除操作都会留档。', loginTitle: '开发者登录', email: '邮箱', password: '密码', login: '登录', logout: '退出登录',
      sessionNote: '关闭或刷新本页后需要重新登录。', scores: '查看成绩', refresh: '刷新', mode: '模式', drizzle: '细雨', rain: '暴雨', monsoon: '季风', expedition: '远征旧榜', expedition_distance: '远征最远', expedition_speed: '最快 10 关', player: '用户 ID', tiles: '回收', time: '用时', action: '操作',
      topNote: '经典及旧榜显示前 100 名，新远征榜显示前 10 名。可输入任意 ID 删除。', manage: '管理操作', manageNote: '单个 ID 和单模式操作使用上方选中的模式。删除后，该玩家仍可提交新一局成绩。', deletePlayer: '删除此 ID 在当前模式的成绩', clearMode: '清空当前模式', clearAll: '清空全部排行榜', audit: '最近操作',
      confirmTitle: '确认删除范围', cancel: '取消', confirmDelete: '确认删除', remove: '删除', empty: '暂无记录', loading: '正在加载…', signingIn: '正在登录…', saving: '正在删除…', ready: '已登录，可以管理排行榜。', loginFailed: '登录失败，请检查邮箱、密码及邮箱确认状态。', forbidden: '此账号没有管理员权限。', setup: '管理接口尚未启用，请先在 Supabase 执行 scripts/rain-admin.sql。', network: '无法连接服务，请稍后刷新。', uncertain: '未收到操作结果。请取消弹窗并刷新榜单，核实后再操作。', expired: '登录已过期，请重新登录。', invalid: '请输入有效的用户 ID。', mismatch: '确认文字不匹配。', deleted: '已删除 {n} 条成绩，并保存操作记录。', confirmHint: '请输入 {text} 确认：', scopePlayer: '删除「{mode}」中 ID「{id}」的成绩。', scopeMode: '清空「{mode}」排行榜，当前有 {n} 条成绩。', scopeAll: '清空全部模式的排行榜，当前共 {n} 条成绩。', auditLine: '{date} · {action} · {scope} · {n} 条', all: '全部模式', signedOut: '已退出登录。'
    },
    en: {
      back: '← Back to game', title: 'Leaderboard admin', intro: 'Developer access only. All deletions are archived.', loginTitle: 'Developer sign in', email: 'Email', password: 'Password', login: 'Sign in', logout: 'Sign out',
      sessionNote: 'Reloading or closing this page requires signing in again.', scores: 'Scores', refresh: 'Refresh', mode: 'Mode', drizzle: 'Drizzle', rain: 'Rainstorm', monsoon: 'Monsoon', expedition: 'Legacy expedition', expedition_distance: 'Farthest expedition', expedition_speed: 'Fastest 10', player: 'Player ID', tiles: 'Tiles', time: 'Time', action: 'Action',
      topNote: 'Top 100 classic/legacy scores, top 10 new expedition scores. Enter any ID below to delete it.', manage: 'Manage scores', manageNote: 'Player and single-mode actions use the mode selected above. Players can still submit new runs after deletion.', deletePlayer: 'Delete this ID’s score in the selected mode', clearMode: 'Clear selected mode', clearAll: 'Clear all leaderboards', audit: 'Recent operations',
      confirmTitle: 'Review deletion', cancel: 'Cancel', confirmDelete: 'Confirm deletion', remove: 'Delete', empty: 'No records', loading: 'Loading…', signingIn: 'Signing in…', saving: 'Deleting…', ready: 'Signed in. You can manage the leaderboards.', loginFailed: 'Sign-in failed. Check your email, password and email confirmation status.', forbidden: 'This account does not have administrator access.', setup: 'Admin functions are not enabled. Run scripts/rain-admin.sql in Supabase first.', network: 'Cannot reach the service. Please refresh later.', uncertain: 'No operation result received. Cancel and refresh the board to verify before trying again.', expired: 'Your session has expired. Please sign in again.', invalid: 'Enter a valid player ID.', mismatch: 'Confirmation text does not match.', deleted: 'Deleted {n} scores and saved the operation record.', confirmHint: 'Type {text} to confirm:', scopePlayer: 'Delete ID “{id}” from {mode}.', scopeMode: 'Clear the {mode} leaderboard. It currently has {n} scores.', scopeAll: 'Clear all leaderboards. They currently have {n} scores.', auditLine: '{date} · {action} · {scope} · {n} scores', all: 'All modes', signedOut: 'Signed out.'
    }
  };
  let lang = 'zh'; try { lang = localStorage.getItem('rain-match-language') === 'en' ? 'en' : 'zh'; } catch (_) {}
  let session = null, expiry, summary = null, entries = [], pending = null, busy = false, request = 0;
  let notice = null;
  const t = (key, values = {}) => (words[lang][key] || key).replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');
  function inform(key, values) { notice = { key, values }; $('notice').textContent = t(key, values); }
  function localize() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; document.title = t('title') + ' · Rain Match';
    document.querySelectorAll('[data-text]').forEach(el => { el.textContent = t(el.dataset.text); });
    $('language').textContent = lang === 'zh' ? 'EN' : '中文';
    if (notice) $('notice').textContent = t(notice.key, notice.values);
    if (summary) render(); if (pending) describePending();
  }
  async function api(path, body, token = session?.access_token) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(config.supabaseUrl + path, {
        method: 'POST', headers: { apikey: config.supabasePublishableKey, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify(body), signal: controller.signal, cache: 'no-store'
      });
      const data = response.status === 204 ? null : await response.json();
      if (!response.ok) {
        const key = data?.code === 'PGRST202' ? 'setup' : data?.code === '42501' || response.status === 403 ? 'forbidden' : response.status === 401 ? 'expired' : 'network';
        throw new Error(key);
      }
      return data;
    } finally { clearTimeout(timeout); }
  }
  const rpc = (name, body = {}) => api('/rest/v1/rpc/' + name, body);
  function resetSession(message = 'signedOut') {
    const previous = session; session = null; clearTimeout(expiry); request++;
    summary = null; entries = []; pending = null;
    $('dashboard').hidden = true; $('login-panel').hidden = false;
    $('rows').replaceChildren(); $('audit').replaceChildren(); $('counts').replaceChildren(); $('identity').textContent = '';
    if ($('confirm-dialog').open) $('confirm-dialog').close();
    inform(message); return previous;
  }
  function handle(error) {
    if (['expired', 'forbidden'].includes(error.message)) resetSession(error.message);
    else inform(['setup', 'network'].includes(error.message) ? error.message : 'network');
  }
  async function refresh() {
    const version = ++request, mode = $('mode').value;
    entries = []; $('rows').replaceChildren();
    try {
      const [status, board] = await Promise.all([rpc('rain_admin_status'), mode.startsWith('expedition_') ? rpc('rain_expedition_v3_leaderboard', { p_board: mode.slice(11) }) : rpc('rain_leaderboard', { p_mode: mode })]);
      if (version !== request || !session) return;
      summary = status; entries = board.entries; render();
    } catch (error) { if (version === request) handle(error); }
  }
  const cell = (tag, value) => { const el = document.createElement(tag); el.textContent = value; return el; };
  function render() {
    $('counts').replaceChildren(...['drizzle', 'rain', 'monsoon', 'expedition', 'expedition_distance', 'expedition_speed'].map(mode => {
      const el = cell('div', t(mode)); el.append(cell('strong', summary.counts[mode] || 0)); return el;
    }));
    $('rows').replaceChildren(...entries.map(score => {
      const row = document.createElement('tr'), time = (score.elapsedMs / 1000).toFixed(3) + ' s';
      row.append(cell('td', score.playerId), cell('td', score.mode === 'expedition_distance' ? `${score.completedStages} / ${score.cleared}` : score.cleared), cell('td', time));
      const button = cell('button', t('remove')); button.className = 'text-button';
      button.addEventListener('click', () => review('player', score.playerId, score.mode));
      const action = document.createElement('td'); action.append(button); row.append(action); return row;
    }));
    if (!entries.length) { const row = document.createElement('tr'), empty = cell('td', t('empty')); empty.colSpan = 4; row.append(empty); $('rows').append(row); }
    $('audit').replaceChildren(...summary.audit.map(event => cell('li', t('auditLine', {
      date: new Date(event.created_at).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US'),
      action: t(event.action === 'player' ? 'remove' : event.action === 'mode' ? 'clearMode' : 'clearAll'),
      scope: event.mode ? t(event.mode) + (event.player_id ? ' / ' + event.player_id : '') : t('all'), n: event.deleted_count
    }))));
    if (!summary.audit.length) $('audit').append(cell('li', t('empty')));
  }
  function describePending() {
    const n = pending.action === 'all' ? Object.values(summary.counts).reduce((a, b) => a + b, 0) : summary.counts[pending.mode];
    $('scope').textContent = t(pending.action === 'all' ? 'scopeAll' : pending.action === 'mode' ? 'scopeMode' : 'scopePlayer', { n, mode: t(pending.mode), id: pending.playerId });
    $('confirmation-label').textContent = t('confirmHint', { text: pending.confirmation });
  }
  function review(action, playerId = '', mode = $('mode').value) {
    if (!session || !summary || busy) return;
    if (action === 'player' && !/^[\p{L}\p{N}_-]{1,20}$/u.test(playerId)) { inform('invalid'); return; }
    pending = { action, playerId, mode };
    pending.confirmation = action === 'all' ? 'CLEAR ALL' : action === 'mode' ? 'CLEAR ' + pending.mode : 'DELETE ' + playerId;
    describePending(); $('confirmation').value = ''; $('confirm-error').textContent = ''; $('confirm-delete').disabled = true;
    $('confirm-dialog').showModal(); $('confirmation').focus();
  }
  $('login-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return; busy = true; $('login').disabled = true; inform('signingIn');
    let authenticated = false;
    try {
      session = await api('/auth/v1/token?grant_type=password', { email: $('email').value.trim(), password: $('password').value }, null);
      authenticated = true;
      // An Auth account alone grants nothing: this RPC checks the database whitelist.
      summary = await rpc('rain_admin_status');
      $('identity').textContent = session.user.email; $('login-panel').hidden = true; $('dashboard').hidden = false;
      const expiresAt = Number(session.expires_at) * 1000 || Date.now() + Number(session.expires_in || 3600) * 1000;
      expiry = setTimeout(() => resetSession('expired'), Math.max(0, expiresAt - Date.now() - 5000));
      inform('ready'); await refresh();
    } catch (error) { resetSession(authenticated && ['setup', 'forbidden'].includes(error.message) ? error.message : 'loginFailed'); }
    finally { $('password').value = ''; busy = false; $('login').disabled = false; }
  });
  $('logout').addEventListener('click', () => {
    const previous = resetSession();
    if (previous) api('/auth/v1/logout?scope=local', {}, previous.access_token).catch(() => {});
  });
  $('refresh').addEventListener('click', refresh); $('mode').addEventListener('change', refresh);
  $('delete-player').addEventListener('click', () => review('player', $('player').value.trim().normalize('NFKC')));
  $('clear-mode').addEventListener('click', () => review('mode')); $('clear-all').addEventListener('click', () => review('all'));
  $('cancel').addEventListener('click', () => { if (!busy) $('confirm-dialog').close(); });
  $('confirm-dialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  $('confirm-dialog').addEventListener('close', () => { pending = null; });
  $('confirmation').addEventListener('input', () => { $('confirm-delete').disabled = busy || $('confirmation').value !== pending?.confirmation; });
  $('confirm-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !pending) return;
    if ($('confirmation').value !== pending.confirmation) { $('confirm-error').textContent = t('mismatch'); return; }
    busy = true; $('confirm-delete').disabled = true; $('cancel').disabled = true; $('confirm-error').textContent = t('saving');
    try {
      const result = await rpc('rain_admin_delete', { p_action: pending.action, p_mode: pending.mode, p_player_id: pending.playerId, p_confirmation: pending.confirmation });
      $('confirm-dialog').close(); inform('deleted', { n: result.deleted }); await refresh();
    } catch (error) {
      if (['expired', 'forbidden', 'setup'].includes(error.message)) handle(error);
      $('confirm-error').textContent = t('uncertain');
    } finally { busy = false; $('cancel').disabled = false; $('confirm-delete').disabled = true; }
  });
  $('language').addEventListener('click', () => {
    lang = lang === 'zh' ? 'en' : 'zh'; try { localStorage.setItem('rain-match-language', lang); } catch (_) {} localize();
  });
  localize();
})();
