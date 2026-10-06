(function (root) {
  'use strict';
  const messages = {
    zh: {
      title: '羊了个雨 · RoR2 三消', brand: '羊了个雨', home: '羊了个雨首页',
      description: '羊了个羊玩法 × Risk of Rain 2 道具。免费三消叠牌小游戏，三个道具每局各用一次。',
      siteHome: '← 主页', admin: '管理', musicOpen: '打开音乐播放器', musicClose: '关闭并停止', musicAlbum: '原声专辑 ↗', musicHint: '点击播放器里的 ▶ 开始音乐，可以边听边玩。加载失败时可打开原声专辑。', blindTile: '未翻开的补给牌', creditsMusic: '原声音乐通过作曲者官方播放器播放：',
      helpStrategy: '暴雨有九层主牌，季风有十二层。优先挖深中间牌区，左右浅层备用牌留给关键三消；下方盲牌只能看到最上面一张。每局初始牌面有解，但选错路线可能卡住。',
      soundOn: '开启音效', soundOff: '关闭音效', help: '查看玩法', restart: '重新开局', language: 'Switch to English',
      difficulty: '游戏难度', drizzle: '细雨', rain: '暴雨', monsoon: '季风',
      drizzleTitle: '细雨热身', rainTitle: '暴雨挑战', monsoonTitle: '季风试炼', modeHint: '{mode} · {n} 张',
      game: '三消游戏', time: '探索时间', progress: '消除进度', board: '层叠主牌区和左右补给牌堆',
      left: '左补给', right: '右补给', emptyPile: '已清空', boardHint: '点击亮牌 · 三张消除', remaining: '剩余 {n} 张',
      reserve: '临时补给区', reserveHint: '点击放回背包', inventory: '七格背包', emptySlot: '空位 {n}', covered: '（被上层覆盖）',
      remove: '移出三张', undo: '撤回一步', shuffle: '重新洗牌', free: '免费 ×1', used: '本局已使用',
      removeHint: '将背包前面最多三张移入临时补给区', undoHint: '撤销上一次拾取及该次产生的消除', shuffleHint: '打乱主牌区及两侧补给堆的剩余图案',
      freeNote: '每局各免费一次 · 重新开局全部恢复', wins: '累计通关', fan: 'RoR2 非官方同人小游戏', credits: '素材致谢', close: '关闭弹窗',
      statusReady: '先找第三张，再捡第一张。', statusWon: '星球清空，所有战利品都已回收。', statusLost: '背包已满。还有道具的话，可以尝试救场。',
      statusFinal: '本局成绩已提交。准备好再开一局了吗？', statusPending: '本局已结束，可在本局成绩中查看提交状态。', statusDanger: '还剩 {n} 个空位，优先凑齐背包里的道具！',
      removed: '已移入临时补给区，点击即可放回背包。', undone: '已撤回上一次拾取，包括该次产生的消除。', shuffled: '剩余道具已重新洗牌，再找找新的机会。', match: '{item} ×3 · 已回收',
      escapeSignal: '传送器已充能 · 撤离成功', defeatSignal: '生命信号中断 · 再试一次',
      wonTitle: '雨停了，你赢了。', lostTitle: '背包装不下啦。', wonCopy: '每一件战利品，都找到了它的同伴。下一场雨还在等你。',
      rescueCopy: '用剩余的免费道具继续冒险，或输入 ID 提交成绩，结束本局。', lostCopy: '记录这次冒险，再开一局。三个免费道具都会恢复。',
      recovered: '回收数量', moves: '拾取次数', rescueRemove: '免费移出三张 · 继续冒险', rescueUndo: '免费撤回一步 · 继续冒险',
      nextRain: '挑战暴雨 →', again: '再开一局 →', result: '本局成绩',
      rankings: '排行榜', rankingTitle: '幸存者排行榜', loading: '正在加载排行榜…', sending: '正在提交…', retry: '重新加载', notConfigured: '排行榜尚未连接数据库，暂时无法提交成绩。', networkError: '暂时无法连接排行榜。请检查网络后重试，成绩还在本页。', rankingScope: '全站榜 · 成绩跨设备共享', rankingRules: '按回收数量降序，同分按用时升序。每个 ID 在各模式保留最佳成绩。',
      rank: '名次', player: '用户 ID', score: '回收', duration: '用时', noScores: '这个模式还没有成绩。来留下第一个记录吧。',
      playerPlaceholder: '输入你的 ID', idRules: '1–20 个字母、数字、汉字、下划线或短横线；区分大小写。',
      submit: '提交成绩', submitEnd: '提交并结束本局', submitted: '本局已提交', invalidId: '请输入 1–20 个字母、数字、汉字、下划线或短横线。',
      submitFailed: '成绩未能记录，请重试。', saved: '成绩已保存，当前模式排名第 {rank}。', notBest: '本次成绩已登记；保留该 ID 更好的成绩，排名第 {rank}。',
      sessionOnly: '浏览器无法保存数据：本次记录仅在当前页面有效，关闭后会丢失。', corruptScores: '此前的排行榜数据无法读取，当前显示可用的记录。',
      seeRankings: '查看本模式排行榜', backResult: '返回本局成绩', leaderboardCount: '共 {n} 位玩家 · 显示前 100 名',
      helpTitle: '活到最后一件。',
      helpSteps: ['点击中间主牌区亮起的道具，放入七格背包。下方左右各有一叠补给牌，只能取最上面一张。', '凑齐三个相同道具就会消除。第七张若能组成三消，仍然安全。', '清空所有牌堆、背包和临时补给区即可通关。背包满七张且无法消除则失败。', '移出三张：把背包前面最多三张放到临时补给区，之后点击取回。', '撤回一步：撤销最近一次拾取和对应消除。使用其他道具后不能撤销更早的拾取。', '重新洗牌：打乱主牌区和补给堆的图案，保留层级和数量。'],
      helpPowers: '三个道具每局各免费一次，重新开局全部恢复。切换难度会开始新的一局。',
      helpRanking: '胜利或失败后都可提交成绩。提交后本局结束，不能再使用道具救场。排行榜用有效游玩时间排序；打开弹窗或切到后台时暂停计时。用户 ID 是显示名称，不是登录账号。',
      helpKeys: '键盘：Tab 选择 · Enter 拾取 · 1 / 2 / 3 使用道具。音效默认关闭。',
      creditsTitle: '来自雨中的战利品。', creditsCopy: '这是一款「羊了个羊」玩法的非官方同人小游戏，不隶属于原作。', creditsArt: '牌面使用 Risk of Rain 2 道具图标，素材权利归原权利人所有。图标来源：', creditsThanks: '感谢每一位降落在 Petrichor V 的幸存者。'
    },
    en: {
      title: 'Rain Match · RoR2', brand: 'RAIN MATCH', home: 'Rain Match home',
      description: 'A Risk of Rain 2 tile-matching fan game. Match triples and use three free powers each round.',
      siteHome: '← Home', admin: 'Admin', musicOpen: 'Open music player', musicClose: 'Close & stop', musicAlbum: 'Soundtrack ↗', musicHint: 'Press ▶ in the player to listen while playing. If it cannot load, open the soundtrack link.', blindTile: 'Unrevealed supply tile', creditsMusic: 'Soundtrack streamed through the composer’s official player:',
      helpStrategy: 'Rainstorm has nine core layers; Monsoon has twelve. Dig into the center and save shallow side tiles for crucial matches. Only the top supply tile is revealed. Every starting board has a solution, but your choices can lead to a dead end.',
      soundOn: 'Enable sound', soundOff: 'Mute sound', help: 'How to play', restart: 'New round', language: '切换到中文',
      difficulty: 'Difficulty', drizzle: 'Drizzle', rain: 'Rainstorm', monsoon: 'Monsoon',
      drizzleTitle: 'Drizzle warm-up', rainTitle: 'Rainstorm challenge', monsoonTitle: 'Monsoon trial', modeHint: '{mode} · {n} tiles',
      game: 'Tile-matching game', time: 'Play time', progress: 'Clear progress', board: 'Layered board and two supply stacks',
      left: 'Left stack', right: 'Right stack', emptyPile: 'Clear', boardHint: 'Pick bright tiles · Match three', remaining: '{n} tiles left',
      reserve: 'Stash', reserveHint: 'Tap to return to tray', inventory: 'Seven-slot tray', emptySlot: 'Empty slot {n}', covered: ' (covered)',
      remove: 'Stash 3', undo: 'Undo', shuffle: 'Shuffle', free: 'Free ×1', used: 'Used',
      removeHint: 'Move up to three tiles from the front of the tray into the stash', undoHint: 'Undo the last pickup, including its match', shuffleHint: 'Shuffle the remaining board and supply tiles',
      freeNote: 'One free use each · Refilled every round', wins: 'Wins', fan: 'Unofficial RoR2 fan game', credits: 'Credits', close: 'Close dialog',
      statusReady: 'Find the third tile before picking the first.', statusWon: 'Planet cleared. All loot recovered.', statusLost: 'Tray full. An unused power could save this run.',
      statusFinal: 'Score submitted. Ready for another run?', statusPending: 'Run ended. Open the run result to check your submission.', statusDanger: '{n} slots left. Match what is already in your tray!',
      removed: 'Tiles stashed. Tap them to return them to your tray.', undone: 'Last pickup and its match undone.', shuffled: 'Tiles shuffled. Look for a new opportunity.', match: '{item} ×3 · Recovered',
      escapeSignal: 'TELEPORTER CHARGED · EXTRACTED', defeatSignal: 'SIGNAL LOST · TRY AGAIN',
      wonTitle: 'The rain stopped. You won.', lostTitle: 'Your tray is full.', wonCopy: 'Every piece of loot found its match. Another storm awaits.',
      rescueCopy: 'Use a free power to keep playing, or enter your ID and submit your score to end this run.', lostCopy: 'Save your score and try again. All three free powers will be restored.',
      recovered: 'Recovered', moves: 'Pickups', rescueRemove: 'Stash 3 for free · Continue', rescueUndo: 'Undo for free · Continue',
      nextRain: 'Try Rainstorm →', again: 'Play again →', result: 'Run result',
      rankings: 'Rankings', rankingTitle: 'Survivor leaderboard', loading: 'Loading leaderboard…', sending: 'Submitting…', retry: 'Try again', notConfigured: 'The leaderboard database is not connected yet. Score submission is unavailable.', networkError: 'Cannot reach the leaderboard. Check your connection and try again. Your score is still on this page.', rankingScope: 'Global leaderboard · Shared across devices', rankingRules: 'Most tiles recovered first; ties go to the faster time. Each ID keeps its best score in each mode.',
      rank: 'Rank', player: 'Player ID', score: 'Tiles', duration: 'Time', noScores: 'No scores in this mode yet. Set the first record!',
      playerPlaceholder: 'Enter your ID', idRules: '1–20 letters, numbers, underscores or hyphens. Case-sensitive.',
      submit: 'Submit score', submitEnd: 'Submit & end run', submitted: 'Score submitted', invalidId: 'Use 1–20 letters, numbers, underscores or hyphens.',
      submitFailed: 'Could not record your score. Please try again.', saved: 'Score saved. Your rank in this mode is #{rank}.', notBest: 'Run recorded. Your better score is kept at rank #{rank}.',
      sessionOnly: 'Browser storage is unavailable. This record lasts only until you close or reload this page.', corruptScores: 'Some previous leaderboard data could not be read. Available records are shown.',
      seeRankings: 'View this leaderboard', backResult: 'Back to run result', leaderboardCount: 'Players: {n} · Showing the top 100',
      helpTitle: 'Survive the last tile.',
      helpSteps: ['Pick bright, uncovered tiles into the seven-slot tray. Each lower supply stack exposes only its top tile.', 'Three matching tiles disappear. A match on the seventh slot is still safe.', 'Clear the board, both supply stacks, the tray and the stash to win. Seven unmatched tiles in the tray ends the run.', 'Stash 3: move up to three tiles from the front of the tray into a stash. Tap them to bring them back.', 'Undo: reverse the last pickup and any match it caused. Using another power clears the previous undo point.', 'Shuffle: rearrange remaining tile images, preserving their layers and counts.'],
      helpPowers: 'Each power is free once per round. A new round restores all three. Changing difficulty starts a new round.',
      helpRanking: 'Submit a score after a win or loss. Submission ends the run, so rescue powers are no longer available. Rankings use active play time; dialogs and background tabs pause the clock. Player IDs are display names, not login accounts.',
      helpKeys: 'Keyboard: Tab to select · Enter to pick · 1 / 2 / 3 for powers. Sound is off by default.',
      creditsTitle: 'Loot from the rain.', creditsCopy: 'An unofficial fan game inspired by Sheep a Sheep. Not affiliated with the original games.', creditsArt: 'Item icons are from Risk of Rain 2 and belong to their respective rights holders. Icon source:', creditsThanks: 'For every survivor who has landed on Petrichor V.'
    }
  };
  function translate(language, key, values = {}) {
    const value = messages[language]?.[key] ?? messages.zh[key] ?? key;
    return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`) : value;
  }
  const api = { messages, translate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RainI18n = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
