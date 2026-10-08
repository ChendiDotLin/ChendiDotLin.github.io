/* Original animal identities and level-specific descriptions. No changes to saved item IDs. */
(function (root) {
  'use strict';
  const names = {"prism": [["奶猫", "橘猫", "斑纹虎", "玉角白虎", "云鬃神虎"], ["Kitten", "Tabby", "Tiger", "Jade Tiger", "Celestial Tiger"]], "behemoth": [["幼狮", "鬃狮", "焰鬃狮", "赤日狮", "曜阳神狮"], ["Lion Cub", "Young Lion", "Flame Lion", "Sun Lion", "Solar Guardian"]], "clover": [["小猞猁", "尖耳猞猁", "银斑猞猁", "林卫猞猁", "翡翠灵猞"], ["Bobkitten", "Lynx", "Silver Lynx", "Forest Lynx", "Emerald Guardian"]], "echo": [["雪团猫", "霜绒猫", "雪豹", "双尾雪豹", "幻影灵豹"], ["Snow Kitten", "Frost Cat", "Snow Leopard", "Twin-tail Leopard", "Spirit Leopard"]], "ukulele": [["水蛇", "蓝鳍蛇", "须角蛟", "碧霆龙", "苍雷神龙"], ["Water Snake", "Fin Snake", "Azure Wyrm", "Thunder Drake", "Storm Dragon"]], "gasoline": [["红蝾螈", "火冠蜥", "赤翼龙", "烈焰龙", "焚霞神龙"], ["Salamander", "Ember Lizard", "Red Drake", "Flame Dragon", "Crimson Dragon"]], "capacitor": [["紫蛇", "鳍颊蛇", "刃尾蛟", "晶鳍龙", "星渊神龙"], ["Violet Viper", "Fin Viper", "Blade Wyrm", "Crystal Drake", "Cosmic Dragon"]], "resin": [["小壁虎", "冠壁虎", "玉鳞蜥", "孢光龙", "森叶神龙"], ["Gecko", "Crested Gecko", "Jade Lizard", "Spore Drake", "Forest Dragon"]], "feather": [["小麻雀", "金冠雀", "橙羽雀", "琥珀鹰", "金羽大鹏"], ["Sparrow", "Goldcrest", "Amber Bird", "Amber Eagle", "Golden Roc"]], "seeker": [["小燕子", "蓝燕", "青雨燕", "蓝隼", "苍穹神隼"], ["Swallow", "Blue Swallow", "Swift", "Blue Falcon", "Sky Falcon"]], "radar": [["小灰鸮", "眼镜鸮", "雪鸮", "月眉鸮", "月轮神鸮"], ["Owlet", "Spectacled Owl", "Snowy Owl", "Moon Owl", "Lunar Guardian"]], "blackhole": [["小翠鸟", "碧翠鸟", "长尾翠鸟", "旋翼鸟", "青风神凰"], ["Kingfisher", "Jade Fisher", "Longtail", "Wind Bird", "Wind Phoenix"]], "shield": [["小绿龟", "薄荷龟", "玉甲龟", "角甲玄龟", "玄武"], ["Turtle", "Mint Turtle", "Jade Tortoise", "Horned Tortoise", "Xuanwu"]], "cell": [["小蜗牛", "粉壳蜗牛", "琥珀蜗牛", "晶旋蜗牛", "星旋灵螺"], ["Snail", "Pink Snail", "Amber Snail", "Crystal Snail", "Cosmic Snail"]], "turbine": [["寄居蟹", "蓝壳蟹", "海螺蟹", "潮钳蟹", "沧海灵蟹"], ["Hermit Crab", "Blue-shell Crab", "Conch Crab", "Wave Crab", "Tidal Guardian"]], "recycler": [["小穿山甲", "卷尾穿山甲", "铜甲兽", "岩甲兽", "镇山灵兽"], ["Pangolin", "Curltail", "Bronze Pangolin", "Stone Pangolin", "Mountain Guardian"]]};
  [names.echo, names.blackhole] = [names.blackhole, names.echo];
  const families = {
    zh: {cats: '猫科 · 暴击追击', dragons: '蛇龙 · 元素连锁', birds: '飞羽 · 找牌补对', shells: '甲壳 · 救命与技能'},
    en: {cats: 'Felines · Critical pursuit', dragons: 'Dragons · Element chains', birds: 'Birds · Scout & pair', shells: 'Shells · Guard & recharge'}
  };
  const bonuses = {
    zh: {cats: '2 种：暴击概率 +5 个百分点。4 种：暴击追加消除两组。', dragons: '2 种：闪电每 3 次三消触发。4 种：连锁穿透多穿一层。', birds: '2 种：每次手动三消，主动技能恢复进度 +1.25（原为 +1）。4 种：穿层取牌少等一次三消；侦察多持续两次取牌。', shells: '2 种：主动技能多存一次。4 种：寄居蟹每两组伙伴消除就加速技能恢复（原为三组）。'},
    en: {cats: '2 species: +5 percentage points to critical chance. 4: critical hits clear two extra groups.', dragons: '2 species: lightning every 3 manual matches. 4: chain piercing reaches one cover deeper.', birds: '2 species: manual triples add 1.25 active recharge progress instead of 1. 4: Reach needs one fewer triple; Scout lasts two more picks.', shells: '2 species: store one extra active use. 4: Hermit Crab recharges skills every 2 companion-cleared groups instead of 3.'}
  };
  const name = (id, level = 1, language = 'zh') => names[id]?.[language === 'en' ? 1 : 0]?.[Math.max(0, Math.min(4, level - 1))] || id;
  // One visible purpose per companion. Rules and UI copy share this source of truth.
  function profile(id, level = 1, game, language = 'zh') {
    const l = level, zh = language !== 'en', count = family => game?.familyCount?.(family) || 0;
    const luck = game?.relics?.clover || 0, threshold = Math.max(2, 5-l);
    const lightning = count('dragons') >= 2 ? 3 : 4;
    const pierce = Math.max(1,l-2) + Number(count('dragons') >= 4);
    const crit = 10+10*l+5*luck+Number(count('cats')>=2)*5;
    const effects = {
      feather: [`点击技能，可直接取出被最多 ${Math.max(1,l-1)} 张牌挡住的一张牌。`, `Activate to pick one tile beneath up to ${Math.max(1,l-1)} covering tiles.`],
      shield: ['每关自动救命一次：撤回让背包塞满的那次取牌。', 'Once per stage, automatically undo the pick that would make you lose.'],
      ukulele: [`每手动三消 ${lightning} 次，闪电自动消除最多 ${l} 组未遮挡牌。`, `Every ${lightning} manual triples, lightning clears up to ${l} exposed board groups.`],
      cell: [`主动技能最多存 ${1+l+Number(count('shells')>=2)} 次使用机会，并更快恢复。`, `Store up to ${1+l+Number(count('shells')>=2)} active uses and recharge them faster.`],
      gasoline: [`每消除一组，有 ${15+10*l+5*luck}% 概率再烧掉一组相同图案的牌。`, `Each cleared group has a ${15+10*l+5*luck}% chance to burn another group of the same picture.`],
      behemoth: [`累计消除 ${threshold} 组后，狮吼额外震碎一组牌，优先炸开被挡住的牌。`, `Every ${threshold} cleared groups, the lion smashes one extra group, preferring covered tiles.`],
      clover: [`猫咪暴击和火蜥燃烧的概率，各提高 ${5*l} 个百分点。`, `Add ${5*l} percentage points to the cat's critical chance and the salamander's burn chance.`],
      blackhole: [`点击技能，为背包里的${l>=3?'最多 3 对':'一对'}相同牌找来第三张并消除。`, `Activate to fetch a third tile and clear ${l>=3?'up to 3 matching pairs':'one matching pair'} from your tray.`],
      radar: [`点击技能，偷看两边牌堆下两张牌；凑齐标记图案，额外消除 ${l>=3?2:1} 组。`, `Activate to peek at two hidden tiles in each supply pile. Match the marked picture to clear ${l>=3?2:1} extra groups.`],
      prism: [`每次手动三消有 ${crit}% 概率暴击，额外消除 ${count('cats')>=4?2:1} 组牌。`, `Each manual triple has a ${crit}% critical chance to clear ${count('cats')>=4?2:1} extra groups.`],
      seeker: [`每手动三消 ${threshold} 次，燕子自动帮背包补齐最多 ${l} 对牌并消除。`, `Every ${threshold} manual triples, the swallow fetches missing tiles to clear up to ${l} tray pairs.`],
      resin: [`手动三消后给最多 ${Math.max(1,l-2)*3} 张同图案牌放上炸弹；再三消 ${Math.max(1,4-l)} 次后炸掉。`, `After a manual triple, mark up to ${Math.max(1,l-2)*3} matching tiles with bombs. They pop after ${Math.max(1,4-l)} more manual triples.`],
      turbine: [`伙伴每额外消除 ${count('shells')>=4?2:3} 组，主动技能和穿层取牌各推进 ${l} 点恢复进度。`, `Every ${count('shells')>=4?2:3} companion-cleared groups, add ${l} recharge progress to both the active skill and Reach.`],
      capacitor: [`伙伴每额外消除 ${threshold} 组，紫蛇再穿透消除一组牌。`, `Every ${threshold} companion-cleared groups, the viper pierces and clears one extra group.`],
      echo: [`其他伙伴首次成功消牌时，翠鸟用同样的选牌方式再消除最多 ${l} 组。`, `When another companion first clears tiles, the kingfisher clears up to ${l} more groups using the same targeting rule.`],
      recycler: [`一次连锁结束后，若总共只剩 ${6+3*l} 张牌或更少，自动全部消除。`, `At the end of a chain, clear every remaining tile if at most ${6+3*l} remain.`]
    };
    const rules = {
      feather: [`取出的牌进入背包，仍需凑齐三张。用过后再手动三消 ${9-l-Number(count('birds')>=4)} 次恢复。${l>=3?'用它凑成三消时，主动技能另获 2 点恢复进度。':''}`, `The tile enters your tray and still needs a triple. Recharges after ${9-l-Number(count('birds')>=4)} manual triples.${l>=3?' Completing a triple with Reach also adds 2 active recharge progress.':''}`],
      shield: [`进入下一关才能再次救命。${l>=2?'救命时主动技能获得 2 点恢复进度。':''}${l>=3?`另消除最多 ${l-1} 组，由未遮挡牌、背包和暂存牌凑成，优先清背包。`:''}`, `Resets at the next stage.${l>=2?' Adds 2 active recharge progress when triggered.':''}${l>=3?` Also clears up to ${l-1} groups from exposed, tray and reserve tiles, preferring the tray.`:''}`],
      ukulele: ['每组必须是棋盘上三张相同且未被挡住的牌，不使用背包牌。找不齐时显示“等待目标”；之后三消或技能连锁凑出目标时释放，无需重新累计次数。', 'Each group needs three matching exposed board tiles; tray tiles are excluded. If none exist, it waits until a later triple or skill chain provides a target, without restarting the counter.'],
      cell: [`每次使用机会需 ${8-l} 点恢复进度（“电网波动”关再加 2）；手动三消一次通常加 1 点，伙伴技能每额外消一组加 0.25 点。${l>=3?'次数存满后，还能为下一次预存 2 点。':''}`, `Each use takes ${8-l} recharge progress (+2 during Power surge). A manual triple normally adds 1; each extra skill-pulse group adds 0.25.${l>=3?' Bank 2 extra progress when all uses are full.':''}`],
      gasoline: ['只烧棋盘上的同图案牌，无视遮挡；烧掉一组还能再次触发燃烧。有三张相同牌才会生效。', 'Burns matching board tiles through any cover. Each burned group can trigger another burn, if three more matching tiles exist.'],
      behemoth: [`手动和伙伴消除都计数。只选棋盘牌，每张上方最多允许 ${l} 张遮挡牌；凑不齐时等后续消除再找目标。`, `Manual and companion clears both count. Board tiles only, with up to ${l} tiles covering each target. If no group fits, later clears retry. `],
      clover: [`例如原本 20% 的暴击变为 ${20+5*l}%。自身不消牌，也不提高红色伙伴出现率。${l>=3?'单次操作的伙伴连锁上限提高到 52 组。':''}`, `For example, a 20% critical chance becomes ${20+5*l}%. Does not clear tiles or change red-companion drop odds.${l>=3?' Raises the per-action companion chain limit to 52 groups.':''}`],
      blackhole: [`先点击技能，再点击紫框目标。第三张最多被 ${l} 张牌挡住；背包没有对子时不能使用。${l>=3?'选中的第一对消除后，再自动补齐最多两对。':''}`, `Activate, then click a purple-outlined target beneath up to ${l} covering tiles. Requires a tray pair.${l>=3?' After the selected pair clears, complete up to two more automatically.':''}`],
      radar: [`持续 ${3+l+Number(count('birds')>=4)*2} 次取牌。消除标记图案还使主动技能获得 2 点恢复进度；${l>=3?'随后标记另一种图案。':'一次命中后结束侦察。'}额外消除优先使用背包牌，不穿透遮挡。`, `Lasts ${3+l+Number(count('birds')>=4)*2} picks. A marked match also adds 2 active recharge progress; ${l>=3?'then marks another picture.':'scouting ends on the first hit.'} Extra groups prefer tray tiles and cannot pierce covers.`],
      prism: [`优先清背包，也能使用暂存牌和被最多 ${l} 张牌挡住的棋盘牌。伙伴自动消除不会触发暴击。`, `Prefers tray tiles; can use reserve tiles and board tiles beneath up to ${l} covering tiles. Automatic clears cannot trigger a critical hit.`],
      seeker: ['自动从棋盘取来第三张，无视遮挡。背包没有对子时会等待；凑出对子后的下一次手动三消再尝试。', 'Fetches the third tile through any cover. With no pair, it waits and retries on a later manual triple after a pair becomes available.'],
      resin: ['只炸带倒计时的标记牌，优先标记深层牌。标记期间不会放第二批炸弹；若标记牌提前被消除，则重新找目标。', 'Only countdown-marked tiles explode, preferring deep tiles. One batch at a time; if marked tiles clear early, it looks for a new batch.'],
      turbine: ['不直接消牌。进度只补给已拥有且尚未恢复好的技能；穿层取牌的 1 点进度等于少等一次手动三消。', 'Does not clear tiles. Only recharges skills you own that need it. One Reach progress replaces one required manual triple.'],
      capacitor: [`优先清背包，可使用暂存牌及被最多 ${pierce} 张牌挡住的棋盘牌。手动三消不计数，每次操作最多发动一次。`, `Prefers tray tiles, also using reserve and board tiles beneath up to ${pierce} covers. Manual triples do not count. At most once per action.`],
      echo: ['例如跟着闪电清未遮挡牌，跟着火焰烧相同图案。每次操作最多发动一次，不复制自己或清空残局，也不额外复制恢复技能。', 'For example, follows lightning onto exposed tiles or fire onto the same picture. Once per action; never copies itself, the finisher or recharge skills.'],
      recycler: ['剩余张数包括棋盘、背包和暂存牌。必须先完成三消或主动技能连锁；Boss 的结界和护甲限制仍然有效。', 'Counts the board, tray and reserve together. Requires a triple or active-skill chain first. Boss wards and armor limits still apply.']
    };
    return { effect: effects[id]?.[zh?0:1] || '', rules: rules[id]?.[zh?0:1] || '' };
  }
  function description(id, level, game, language) {
    const p = profile(id, level, game, language);
    return p.effect + ' ' + p.rules;
  }
  const api = { names, name, families, bonuses, profile, description };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClackCompanions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
