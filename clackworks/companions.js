/* Original animal identities and level-specific descriptions. No changes to saved item IDs. */
(function (root) {
  'use strict';
  const names = {"prism": [["奶猫", "橘猫", "斑纹虎", "玉角白虎", "云鬃神虎"], ["Kitten", "Tabby", "Tiger", "Jade Tiger", "Celestial Tiger"]], "behemoth": [["幼狮", "鬃狮", "焰鬃狮", "赤日狮", "曜阳神狮"], ["Lion Cub", "Young Lion", "Flame Lion", "Sun Lion", "Solar Guardian"]], "clover": [["小猞猁", "尖耳猞猁", "银斑猞猁", "林卫猞猁", "翡翠灵猞"], ["Bobkitten", "Lynx", "Silver Lynx", "Forest Lynx", "Emerald Guardian"]], "echo": [["雪团猫", "霜绒猫", "雪豹", "双尾雪豹", "幻影灵豹"], ["Snow Kitten", "Frost Cat", "Snow Leopard", "Twin-tail Leopard", "Spirit Leopard"]], "ukulele": [["水蛇", "蓝鳍蛇", "须角蛟", "碧霆龙", "苍雷神龙"], ["Water Snake", "Fin Snake", "Azure Wyrm", "Thunder Drake", "Storm Dragon"]], "gasoline": [["红蝾螈", "火冠蜥", "赤翼龙", "烈焰龙", "焚霞神龙"], ["Salamander", "Ember Lizard", "Red Drake", "Flame Dragon", "Crimson Dragon"]], "capacitor": [["紫蛇", "鳍颊蛇", "刃尾蛟", "晶鳍龙", "星渊神龙"], ["Violet Viper", "Fin Viper", "Blade Wyrm", "Crystal Drake", "Cosmic Dragon"]], "resin": [["小壁虎", "冠壁虎", "玉鳞蜥", "孢光龙", "森叶神龙"], ["Gecko", "Crested Gecko", "Jade Lizard", "Spore Drake", "Forest Dragon"]], "feather": [["小麻雀", "金冠雀", "橙羽雀", "琥珀鹰", "金羽大鹏"], ["Sparrow", "Goldcrest", "Amber Bird", "Amber Eagle", "Golden Roc"]], "seeker": [["小燕子", "蓝燕", "青雨燕", "蓝隼", "苍穹神隼"], ["Swallow", "Blue Swallow", "Swift", "Blue Falcon", "Sky Falcon"]], "radar": [["小灰鸮", "眼镜鸮", "雪鸮", "月眉鸮", "月轮神鸮"], ["Owlet", "Spectacled Owl", "Snowy Owl", "Moon Owl", "Lunar Guardian"]], "blackhole": [["小翠鸟", "碧翠鸟", "长尾翠鸟", "旋翼鸟", "青风神凰"], ["Kingfisher", "Jade Fisher", "Longtail", "Wind Bird", "Wind Phoenix"]], "shield": [["小绿龟", "薄荷龟", "玉甲龟", "角甲玄龟", "玄武"], ["Turtle", "Mint Turtle", "Jade Tortoise", "Horned Tortoise", "Xuanwu"]], "cell": [["小蜗牛", "粉壳蜗牛", "琥珀蜗牛", "晶旋蜗牛", "星旋灵螺"], ["Snail", "Pink Snail", "Amber Snail", "Crystal Snail", "Cosmic Snail"]], "turbine": [["寄居蟹", "蓝壳蟹", "海螺蟹", "潮钳蟹", "沧海灵蟹"], ["Hermit Crab", "Blue-shell Crab", "Conch Crab", "Wave Crab", "Tidal Guardian"]], "recycler": [["小穿山甲", "卷尾穿山甲", "铜甲兽", "岩甲兽", "镇山灵兽"], ["Pangolin", "Curltail", "Bronze Pangolin", "Stone Pangolin", "Mountain Guardian"]]};
  [names.echo, names.blackhole] = [names.blackhole, names.echo];
  const families = {
    zh: {cats: '猫科 · 暴击追击', dragons: '蛇龙 · 元素连锁', birds: '飞羽 · 找牌补对', shells: '甲壳 · 防护回能'},
    en: {cats: 'Felines · Critical pursuit', dragons: 'Dragons · Element chains', birds: 'Birds · Scout & pair', shells: 'Shells · Guard & recharge'}
  };
  const bonuses = {
    zh: {cats: '2 种：暴击概率 +5 个百分点。4 种：暴击追加消除两组。', dragons: '2 种：闪电每 3 次三消触发。4 种：连锁穿透多穿一层。', birds: '2 种：手动三消额外回能 0.25。4 种：穿层取牌少充 1 次，侦察多持续 2 次取牌。', shells: '2 种：主动技能多存 1 次。4 种：每 2 组装备消除触发回能。'},
    en: {cats: '2 species: +5 percentage points to critical chance. 4: critical hits clear two extra groups.', dragons: '2 species: lightning every 3 manual matches. 4: chain piercing reaches one cover deeper.', birds: '2 species: +0.25 energy per manual match. 4: Reach recharges one match sooner; Scout lasts two more picks.', shells: '2 species: store one extra active cast. 4: recharge triggers every 2 gear-cleared groups.'}
  };
  const name = (id, level = 1, language = 'zh') => names[id]?.[language === 'en' ? 1 : 0]?.[Math.max(0, Math.min(4, level - 1))] || id;
  function description(id, level, game, language) {
    const l = level, zh = language !== 'en', count = family => game?.familyCount?.(family) || 0;
    const luck = game?.relics?.clover || 0, threshold = Math.max(2, 5-l), groups = Math.max(1,l-2);
    const values = {
      feather: [`主动取下被挡不超过 ${Math.max(1,l-1)} 层的牌；每 ${9-l-Number(count('birds')>=4)} 次手动三消恢复一次。`, `Pick a tile through up to ${Math.max(1,l-1)} covers. Recharges every ${9-l-Number(count('birds')>=4)} manual matches.`],
      shield: [`每关挡住一次爆包，撤回导致满槽的取牌。${l>=2?'触发时回能 2 点。':''}${l>=3?`并清理最多 ${l-1} 组可触及的牌。`:''}`, `Once per stage, undo the pick that would fill the tray. ${l>=2?'Also restore 2 energy. ':''}${l>=3?`Clear up to ${l-1} accessible groups.`:''}`],
      ukulele: [`每 ${count('dragons')>=2?3:4} 次手动三消，连扫最多 ${l} 组表面亮牌。没有目标会保留电量。`, `Every ${count('dragons')>=2?3:4} manual matches, sweep up to ${l} exposed board groups. Holds its charge without a target.`],
      cell: [`主动技能最多存 ${1+l+Number(count('shells')>=2)} 次，每次需 ${8-l} 点能量（离子环境再加 2）。装备脉冲消除回能 0.25。${l>=3?'满充时还能预存 2 点能量。':''}`, `Store ${1+l+Number(count('shells')>=2)} active casts; each costs ${8-l} energy (+2 in ion stages). Gear pulses return 0.25 energy.${l>=3?' Bank up to 2 energy when full.':''}`],
      gasoline: [`每组消除有 ${15+10*l+5*luck}% 概率再烧一组同图案的牌，无视遮挡。只沿同一种图案连烧。`, `Each cleared group has a ${15+10*l+5*luck}% chance to burn another group of the same type through any cover. Fire stays on that type.`],
      behemoth: [`每消除 ${threshold} 组，震碎一组牌；优先选被遮挡的，最多穿 ${l} 层。装备消除也计数。`, `Every ${threshold} cleared groups, smash one group through up to ${l} covers, prioritizing covered tiles. Gear clears count.`],
      clover: [`暴击和燃烧概率各增加 ${5*l} 个百分点。${l>=3?'同时把连锁上限提高到 52 组。':''}本身不消牌。`, `Add ${5*l} percentage points to critical and fire chances.${l>=3?' Raise the chain cap to 52 groups.':''} Does not clear tiles itself.`],
      blackhole: [`主动为背包对子吸来第三张，最多穿 ${l} 层。${l>=3?'一次最多补齐 3 对。':'点击高亮牌发动。'}`, `Pull a third tile to complete a tray pair through ${l} covers. ${l>=3?'Complete up to 3 pairs per cast.':'Click a highlighted target.'}`],
      radar: [`侦察持续 ${3+l+(count('birds')>=4?2:0)} 次取牌，显示补给堆下两张并标记一种图案。消除标记图案回能 2 点，额外消除 ${l>=3?2:1} 组。${l>=3?'随后换新标记。':''}`, `Scout for ${3+l+(count('birds')>=4?2:0)} picks: reveal two supply tiles and mark one type. Match that type for 2 energy and ${l>=3?2:1} extra groups.${l>=3?' Then mark a new type.':''}`],
      prism: [`手动三消有 ${10+10*l+5*luck+(count('cats')>=2?5:0)}% 概率追加消除 ${count('cats')>=4?2:1} 组，最多穿 ${l} 层。`, `Manual matches have a ${10+10*l+5*luck+(count('cats')>=2?5:0)}% critical chance to clear ${count('cats')>=4?2:1} extra groups through ${l} covers.`],
      seeker: [`每 ${threshold} 次手动三消，自动为背包对子补第三张；最多补 ${l} 对，无视遮挡。没有对子会保留进度。`, `Every ${threshold} manual matches, finish up to ${l} tray pairs through any cover. Holds progress without a pair.`],
      resin: [`标记最多 ${groups} 组同图案的牌，再手动三消 ${Math.max(1,4-l)} 次后引爆。只炸标记牌。`, `Mark up to ${groups} groups of one type; detonate after ${Math.max(1,4-l)} more manual matches. Only marked tiles pop.`],
      turbine: [`每 ${count('shells')>=4?2:3} 组装备消除，给主动技能和未充好的穿层取牌各回能 ${l} 点。`, `Every ${count('shells')>=4?2:3} gear-cleared groups, restore ${l} energy to the active skill and uncharged Reach.`],
      capacitor: [`每 ${threshold} 组装备消除，穿透清理一组牌，最多穿 ${Math.max(1,l-2)+Number(count('dragons')>=4)} 层。每次操作最多触发一次。`, `Every ${threshold} gear-cleared groups, pierce one group through ${Math.max(1,l-2)+Number(count('dragons')>=4)} covers. Once per action.`],
      echo: [`跟随本次操作第一个成功消牌的伙伴，按它的选牌规则追加最多 ${l} 组。不会复制自己或清场。`, `Follow the first successful gear clear with up to ${l} groups using its targeting rule. Never copies itself or the finisher.`],
      recycler: [`连锁结束后，剩余不超过 ${6+3*l} 张牌时清空残局；Boss 结界和破甲规则仍然生效。`, `After a chain, sweep the board when at most ${6+3*l} tiles remain. Boss wards and armor still apply.`]
    };
    return values[id]?.[zh?0:1] || '';
  }
  const api = { names, name, families, bonuses, description };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClackCompanions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
