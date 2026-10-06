/* Visual feedback only. Game state is always owned by game.js/core.js. */
(function (root) {
  'use strict';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Set();
  const layer = document.createElement('div');
  layer.className = 'fx-layer'; layer.setAttribute('aria-hidden', 'true'); document.body.append(layer);
  const center = rect => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  function animate(el, frames, options, temporary = false) {
    if (motion.matches || !el.animate) { if (temporary) el.remove(); return Promise.resolve(); }
    const animation = el.animate(frames, { easing: 'cubic-bezier(.2,.7,.25,1)', ...options });
    active.add(animation);
    return animation.finished.catch(() => {}).finally(() => {
      active.delete(animation); animation.cancel(); if (temporary) el.remove();
    });
  }
  function reset() { active.forEach(a => a.cancel()); active.clear(); layer.replaceChildren(); }
  motion.addEventListener('change', reset);
  function node(className, point, color) {
    const el = document.createElement('i'); el.className = className;
    el.style.left = `${point.x}px`; el.style.top = `${point.y}px`;
    if (color) el.style.setProperty('--fx-color', color);
    layer.append(el); return el;
  }
  function burst(point, color, count = 10) {
    if (motion.matches) return;
    const ring = node('fx-ring', point, color);
    animate(ring, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: .7 }, { transform: 'translate(-50%,-50%) scale(2.2)', opacity: 0 }], { duration: 850 }, true);
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count, distance = 22 + (i % 3) * 12;
      const mote = node('fx-mote', point, color);
      animate(mote, [{ transform: 'translate(-50%,-50%) scale(1)', opacity: .9 }, {
        transform: `translate(${Math.cos(angle) * distance}px,${Math.sin(angle) * distance - 18}px) scale(0)`, opacity: 0
      }], { duration: 780 + i * 22 }, true);
    }
  }
  function snapshot() {
    return new Map([...document.querySelectorAll('#board .tile, #rack .tile, #reserve .tile')]
      .map(el => [Number(el.dataset.id), { rect: el.getBoundingClientRect(), type: Number(el.dataset.type) }]));
  }
  function ghost(from, target, type, matched, delay = 0) {
    if (motion.matches || !from) return Promise.resolve();
    const item = RainMatch.ITEMS[type], el = node('fx-loot', center(from), item.color);
    const img = document.createElement('img'); img.src = `assets/toon/${item.icon}.webp`; img.alt = ''; el.append(img);
    el.style.width = `${from.width}px`; el.style.height = `${from.height}px`;
    const origin = center(from), x = target.x - origin.x, y = target.y - origin.y;
    return animate(el, [
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${x * .55}px),calc(-50% + ${y * .45 - 20}px)) scale(1.08)`, opacity: 1, offset: .5 },
      { transform: `translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) scale(${matched ? .15 : .8})`, opacity: 0 }
    ], { duration: matched ? 650 : 440, delay, fill: 'backwards' }, true);
  }
  // Distinct impacts share one bounded timeline, even for a full-board chain.
  function impact(point, kind, delay, size, particles) {
    const blast = kind === 'behemoth', color = blast ? '#ffc36b' : '#ff874f';
    const pending = [], duration = blast ? 1100 : 1000;
    const core = node(blast ? 'fx-blast-core' : 'fx-flame', point, color);
    core.style.width = `${size}px`; core.style.height = `${size}px`;
    pending.push(animate(core, blast ? [
      { transform: 'translate(-50%,-50%) scale(.08)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(.28)', opacity: .8, offset: .16 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: .95, offset: .27 },
      { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 }
    ] : [
      { transform: 'translate(-50%,-35%) scale(.15)', opacity: 0 },
      { transform: 'translate(-50%,-65%) scale(.8,1.15)', opacity: .85, offset: .3 },
      { transform: 'translate(-50%,-115%) scale(.4,1.4)', opacity: 0 }
    ], { duration, delay, easing: 'linear', fill: 'backwards' }, true));
    if (blast) for (let n = 0; n < 2; n++) {
      const wave = node('fx-blast-wave', point, color);
      wave.style.width = `${size * (n ? 1.7 : 1.25)}px`; wave.style.height = wave.style.width;
      pending.push(animate(wave, [
        { transform: `translate(-50%,-50%) scale(.12,${n ? '.06' : '.12'})`, opacity: 0 },
        { opacity: .9, offset: .12 },
        { transform: `translate(-50%,-50%) scale(1,${n ? '.42' : '1'})`, opacity: 0 }
      ], { duration: 850, delay: delay + 180 + n * 80, fill: 'backwards' }, true));
    }
    for (let i = 0; i < particles; i++) {
      const angle = i * Math.PI * 2 / particles + .25, distance = size * (.55 + (i % 3) * .18);
      const spark = node(blast ? 'fx-shrapnel' : 'fx-ember', point, color);
      const dx = Math.cos(angle) * distance, dy = blast ? Math.sin(angle) * distance : -distance;
      pending.push(animate(spark, [
        { transform: `translate(-50%,-50%) rotate(${angle}rad) scale(.2)`, opacity: 0 },
        { opacity: 1, offset: .1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${angle + .8}rad) scale(.1)`, opacity: 0 }
      ], { duration: 650 + (i % 3) * 100, delay: delay + 190, fill: 'backwards' }, true));
    }
    return Promise.all(pending);
  }
  function detonate(from, kind, delay, index) {
    const point = center(from.rect), item = RainMatch.ITEMS[from.type];
    const el = node('fx-loot fx-hit-loot', point, kind === 'behemoth' ? '#ffc36b' : '#ff874f');
    const img = document.createElement('img'); img.src = `assets/toon/${item.icon}.webp`; img.alt = ''; el.append(img);
    el.style.width = `${from.rect.width}px`; el.style.height = `${from.rect.height}px`;
    const direction = index % 2 ? 1 : -1;
    return animate(el, [
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: 'translate(-50%,-50%) scale(.9)', opacity: 1, offset: .2 },
      { transform: `translate(calc(-50% + ${direction * 12}px),-70%) rotate(${direction * 12}deg) scale(1.15)`, opacity: 1, offset: .36 },
      { transform: `translate(calc(-50% + ${direction * 44}px),-135%) rotate(${direction * 40}deg) scale(.15)`, opacity: 0 }
    ], { duration: 850, delay, easing: 'linear', fill: 'backwards' }, true);
  }
  function pick(before, id, type, matched, automaticIds = []) {
    if (motion.matches) return;
    const rack = document.getElementById('rack'), automatic = new Set(automaticIds);
    if (matched) {
      const target = center(rack.getBoundingClientRect());
      for (const [tileId, value] of before) {
        if (!automatic.has(tileId) && value.type === type && (tileId === id || !document.querySelector(`.game-shell .tile[data-id="${tileId}"]`)))
          ghost(value.rect, target, type, true);
      }
      burst(target, RainMatch.ITEMS[type].color, 12);
      animate(rack, [{ boxShadow: `0 0 0 1px ${RainMatch.ITEMS[type].color}` }, { boxShadow: '0 0 24px 4px #bdb2f130' }, { boxShadow: '0 5px 0 #111b29' }], { duration: 950 });
    } else {
      const destination = rack.querySelector(`[data-id="${id}"]`);
      if (destination && before.has(id)) {
        ghost(before.get(id).rect, center(destination.getBoundingClientRect()), type, false);
        animate(destination, [{ opacity: .2 }, { opacity: 1 }], { duration: 440 });
      }
    }
    if (rack.classList.contains('danger')) animate(rack, [
      { transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }
    ], { duration: 360 });
  }
  function power(name, before) {
    if (motion.matches) return Promise.resolve();
    if (name === 'shuffle') {
      const board = document.getElementById('board'), point = center(board.getBoundingClientRect());
      point.y -= board.clientHeight * .12;
      burst(point, '#c7b2ff', 18);
      const portal = node('fx-portal', point, '#b9a0f5');
      const pending = [animate(portal, [
        { transform: 'translate(-50%,-50%) rotate(-80deg) scale(.2)', opacity: 0 },
        { transform: 'translate(-50%,-50%) rotate(20deg) scale(1)', opacity: .8, offset: .45 },
        { transform: 'translate(-50%,-50%) rotate(100deg) scale(1.5)', opacity: 0 }
      ], { duration: 1200 }, true)];
      // Only exposed faces need to move; concealed layers stay cheap to render.
      board.querySelectorAll('.tile:not(.blocked)').forEach((el, i) => {
        pending.push(animate(el, [
          { transform: 'perspective(400px) rotateY(0) scale(1)', opacity: 1 },
          { transform: `perspective(400px) rotateY(90deg) translateY(${i % 2 ? 12 : -12}px) scale(.7)`, opacity: .25, offset: .4 },
          { transform: 'perspective(400px) rotateY(180deg) scale(.9)', opacity: .5, offset: .55 },
          { transform: 'perspective(400px) rotateY(360deg) scale(1)', opacity: 1 }
        ], { duration: 950, delay: (i % 5) * 45 }));
      });
      return Promise.all(pending);
    }
    // Animate the actual cards between their previous and restored/stashed slots.
    const pending = [];
    for (const [id, value] of before) {
      const el = document.querySelector(`.game-shell .tile[data-id="${id}"]`);
      if (!el) continue;
      const rect = el.getBoundingClientRect(), dx = value.rect.left - rect.left, dy = value.rect.top - rect.top;
      if (Math.abs(dx) + Math.abs(dy) < 2) continue;
      pending.push(animate(el, [
        { transform: `translate(${dx}px,${dy}px) scale(${value.rect.width / rect.width})`, opacity: .6 },
        { transform: 'translate(0,0) scale(1)', opacity: 1 }
      ], { duration: 560 }));
    }
    const target = document.getElementById(name === 'remove' ? 'reserve' : 'rack');
    burst(center(target.getBoundingClientRect()), name === 'undo' ? '#9acfe5' : '#b3d8bd', 8);
    return Promise.all(pending);
  }
  function sealShatter(point, size, delay = 0, victory = false) {
    const pending = [], color = victory ? '#a5e9dd' : '#d6beff';
    for (let i = 0; i < 8; i++) {
      const angle = Math.PI * 2 * i / 8;
      const shard = node('fx-seal-shard', point, color);
      const start = size * .36, end = size * (victory ? .85 : .65);
      pending.push(animate(shard, [
        { transform: `translate(${Math.cos(angle) * start}px,${Math.sin(angle) * start}px) rotate(${i * 45}deg)`, opacity: 0 },
        { opacity: 1, offset: .2 },
        { transform: `translate(${Math.cos(angle) * end}px,${Math.sin(angle) * end}px) rotate(${i * 45 + 100}deg) scale(.2)`, opacity: 0 }
      ], { duration: victory ? 1500 : 1100, delay, fill: 'backwards' }, true));
    }
    const seal = node('fx-seal-ring', point, color);
    seal.style.width = `${size}px`; seal.style.height = `${size}px`;
    pending.push(animate(seal, [
      { transform: 'translate(-50%,-50%) rotate(45deg) scale(.75)', opacity: 0 },
      { transform: 'translate(-50%,-50%) rotate(45deg) scale(1)', opacity: .85, offset: .22 },
      { transform: 'translate(-50%,-50%) rotate(80deg) scale(1.3)', opacity: 0 }
    ], { duration: victory ? 1700 : 1250, delay, fill: 'backwards' }, true));
    return Promise.all(pending);
  }
  function bossEntrance() {
    if (motion.matches) return Promise.resolve();
    const board = document.getElementById('board'), rect = board.getBoundingClientRect(), pending = [];
    const seal = node('fx-seal-ring fx-seal-lock', center(rect), '#ddb296');
    seal.style.width = `${rect.width * .7}px`; seal.style.height = `${rect.width * .7}px`;
    pending.push(animate(seal, [
      { transform: 'translate(-50%,-50%) rotate(-45deg) scale(1.3)', opacity: 0 },
      { transform: 'translate(-50%,-50%) rotate(45deg) scale(.85)', opacity: .8, offset: .45 },
      { transform: 'translate(-50%,-50%) rotate(45deg) scale(.85)', opacity: .8, offset: .7 },
      { transform: 'translate(-50%,-50%) rotate(45deg) scale(.25)', opacity: 0 }
    ], { duration: 1850, easing: 'ease-in-out' }, true));
    document.querySelectorAll('.relic-chip.sealed').forEach((chip, i) => {
      pending.push(animate(chip, [
        { boxShadow: 'inset 0 0 0 0 #efb18d00' },
        { boxShadow: 'inset 0 0 18px 1px #efb18d88', offset: .5 },
        { boxShadow: 'inset 0 0 0 0 #efb18d00' }
      ], { duration: 950, delay: i * 100 }));
    });
    return Promise.all(pending);
  }
  function relic(events, before, recoveredCount) {
    if (motion.matches) return Promise.resolve();
    const board = document.getElementById('board').getBoundingClientRect();
    const rack = document.getElementById('rack').getBoundingClientRect();
    const pending = [];
    const step = events.length > 1 ? Math.min(180, 1600 / (events.length - 1)) : 0;
    const heavy = events.filter(event => ['behemoth', 'gasoline'].includes(event.kind));
    const accentEvery = Math.max(1, Math.ceil(heavy.length / 10));
    let impactIndex = 0;
    for (const [index, event] of events.entries()) {
      const delay = index * step;
      // Show the actual recovered cards, including radar and shield follow-ups.
      if (event.ids.length === 3 && !['blackhole', 'gasoline', 'behemoth'].includes(event.kind)) {
        event.ids.forEach((id, i) => { if (before.has(id)) pending.push(ghost(before.get(id).rect, center(rack), before.get(id).type, true, delay + (event.kind === 'ukulele' ? 180 + i * 150 : 0))); });
      }
      if (event.kind === 'shield') {
        const shield = node('fx-shield', { x: rack.left - 5, y: rack.top - 5 });
        shield.style.width = `${rack.width + 10}px`; shield.style.height = `${rack.height + 10}px`;
        pending.push(animate(shield, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'scale(1.02)', offset: .25 }, { opacity: 0, transform: 'scale(1.12)' }], { duration: 1150, delay, fill: 'backwards' }, true));
      } else if (event.kind === 'radar') {
        const scan = node('fx-radar', { x: board.left, y: board.top }); scan.style.width = `${board.width}px`;
        pending.push(animate(scan, [{ transform: 'translateY(0)', opacity: 0 }, { opacity: .85, offset: .15 }, { transform: `translateY(${board.height}px)`, opacity: 0 }], { duration: 1250, delay, fill: 'backwards' }, true));
      } else if (event.kind === 'blackhole') {
        const point = center(rack), portal = node('fx-portal', point, '#c7a5fa');
        for (const id of event.ids) if (before.has(id)) pending.push(ghost(before.get(id).rect, point, before.get(id).type, true, delay));
        pending.push(animate(portal, [{ transform: 'translate(-50%,-50%) scale(.15) rotate(0)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(.65) rotate(80deg)', opacity: .95, offset: .45 }, { transform: 'translate(-50%,-50%) scale(.1) rotate(180deg)', opacity: 0 }], { duration: 1250, delay, fill: 'backwards' }, true));
      } else if (event.kind === 'ukulele') {
        let origin = center(rack);
        event.ids.forEach((id, i) => {
          if (!before.has(id)) return;
          const point = center(before.get(id).rect), dx = point.x - origin.x, dy = point.y - origin.y;
          const arc = node('fx-lightning', origin); arc.style.width = `${Math.hypot(dx, dy)}px`;
          const rotation = `rotate(${Math.atan2(dy, dx)}rad)`;
          pending.push(animate(arc, [{ transform: rotation + ' scaleX(0)', opacity: 0 }, { transform: rotation + ' scaleX(1)', opacity: .9, offset: .25 }, { transform: rotation, opacity: 0 }], { duration: 1000, delay: delay + i * 150, fill: 'backwards' }, true));
          const hit = node('fx-electric-hit', point, '#b4dfff');
          pending.push(animate(hit, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 }, { opacity: 1, offset: .2 }, { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 }], { duration: 650, delay: delay + i * 150 + 160, fill: 'backwards' }, true));
          origin = point;
        });
      } else if (['gasoline', 'behemoth'].includes(event.kind)) {
        const accented = impactIndex++ % accentEvery === 0;
        event.ids.forEach((id, i) => {
          const from = before.get(id); if (!from) return;
          const stagger = delay + i * 75;
          pending.push(detonate(from, event.kind, stagger, index + i));
          if (accented) pending.push(impact(center(from.rect), event.kind, stagger,
            from.rect.width * (event.kind === 'behemoth' ? 2.2 : 1.15), events.length > 12 ? (i ? 0 : 5) : (i ? 3 : 9)));
        });
      } else if (event.kind === 'sealEnergy') {
        const meter = document.getElementById('boss-meter');
        const meterRect = meter.getBoundingClientRect();
        const target = meterRect.width ? center(meterRect) : { x: board.left + board.width / 2, y: board.top }, origin = center(rack);
        for (let i = 0; i < event.amount; i++) {
          const mote = node('fx-seal-energy', origin, '#d6beff');
          pending.push(animate(mote, [
            { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
            { opacity: 1, offset: .15 },
            { transform: `translate(${target.x - origin.x}px,${target.y - origin.y}px) scale(.3)`, opacity: 0 }
          ], { duration: 950, delay: delay + i * 90, fill: 'backwards' }, true));
        }
      } else if (event.kind === 'bossBreak') {
        pending.push(sealShatter(center(board), board.width * .7, delay, true));
      } else if (event.kind === 'reclaim') {
        const chip = event.relic ? document.querySelector(`[data-relic="${event.relic}"]`) : null;
        const point = chip ? center(chip.getBoundingClientRect()) : event.ids.length && before.has(event.ids[0]) ? center(before.get(event.ids[0]).rect) : center(board);
        pending.push(sealShatter(point, 46, delay));
        const label = node('fx-seal-level', { x: point.x, y: point.y - 12 }, '#dbc8ff');
        label.textContent = `Lv.${event.level}`;
        pending.push(animate(label, [
          { transform: 'translate(-50%,0)', opacity: 0 },
          { transform: 'translate(-50%,-12px)', opacity: 1, offset: .25 },
          { transform: 'translate(-50%,-12px)', opacity: 1, offset: .65 },
          { transform: 'translate(-50%,-25px)', opacity: 0 }
        ], { duration: 1450, delay, fill: 'backwards' }, true));
      } else if (event.kind === 'feather') {
        const from = before.get(event.ids[0]);
        if (from) { burst(center(from.rect), '#ead699', 6);
          const ring = node('fx-ring', center(from.rect), '#e8d99d');
          pending.push(animate(ring, [{ transform: 'translate(-50%,-50%) scale(.5)', opacity: .8 }, { transform: 'translate(-50%,-100%) scale(1.5)', opacity: 0 }], { duration: 950 }, true)); }
      }
    }
    const firstBlast = events.findIndex(event => event.kind === 'behemoth');
    if (firstBlast >= 0) {
      // One restrained board kick avoids stacking dozens of competing shakes.
      const strength = Math.min(4, board.width / 100);
      const kick = [
        { transform: 'translate(0,0)' }, { transform: `translate(${-strength}px,${strength / 2}px)`, offset: .22 },
        { transform: `translate(${strength}px,${-strength / 2}px)`, offset: .4 },
        { transform: `translate(${-strength / 2}px,0)`, offset: .62 }, { transform: 'translate(0,0)' }
      ];
      for (const id of ['board', 'rack']) pending.push(animate(document.getElementById(id), kick, { duration: 480, delay: firstBlast * step + 200 }));
    }
    const recovered = new Set(events.filter(event => event.ids.length === 3).flatMap(event => event.ids)).size;
    const total = recoveredCount ?? recovered;
    if (total >= 36) {
      const wave = node('fx-blast-wave fx-chain-wave', { x: board.left + board.width / 2, y: board.top + board.height * .4 });
      wave.style.width = `${board.width * .9}px`; wave.style.height = `${board.height * .75}px`;
      pending.push(animate(wave, [
        { transform: 'translate(-50%,-50%) scale(.15)', opacity: 0 },
        { opacity: .7, offset: .18 },
        { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 0 }
      ], { duration: 1150, delay: (events.length - 1) * step * .65, fill: 'backwards' }, true));
    }
    if (total >= 6) {
      const indices = [...new Set(total >= 24 ? [0, Math.floor(events.length / 3), Math.floor(events.length * 2 / 3), events.length - 1] : [events.length - 1])];
      const seen = new Set();
      for (const [i, event] of events.entries()) {
        if (event.ids.length === 3) event.ids.forEach(id => seen.add(id));
        if (!indices.includes(i)) continue;
        const badge = node('fx-chain-count', { x: rack.right - 4, y: rack.bottom + 12 }, total >= 36 ? '#ffc36b' : '#c9b7ff');
        badge.textContent = `+${total - recovered + seen.size}`;
        const next = indices[indices.indexOf(i) + 1];
        pending.push(animate(badge, [
          { transform: 'translate(-100%,0) scale(.7)', opacity: 0 },
          { transform: 'translate(-100%,0) scale(1.08)', opacity: 1, offset: .2 },
          { transform: 'translate(-100%,0) scale(1)', opacity: 1, offset: .7 },
          { transform: 'translate(-100%,-8px) scale(1)', opacity: 0 }
        ], { duration: next === undefined ? 1050 : Math.max(100, (next - i) * step), delay: i * step + 180, easing: 'linear', fill: 'backwards' }, true));
      }
    }
    return Promise.all(pending);
  }

  function captureBoard() {
    if (motion.matches) return null;
    const board = document.getElementById('board'), rect = board.getBoundingClientRect();
    const copy = board.cloneNode(true);
    copy.removeAttribute('id'); copy.className = 'fx-old-board';
    copy.inert = true; copy.setAttribute('aria-hidden', 'true');
    Object.assign(copy.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    copy.querySelectorAll('.tile').forEach(el => { el.classList.remove('fresh'); el.disabled = true; });
    layer.append(copy); return copy;
  }
  function restart(outgoing) {
    if (motion.matches) { outgoing?.remove(); return Promise.resolve(); }
    const board = document.getElementById('board'), point = center(board.getBoundingClientRect());
    const portal = node('fx-portal fx-restart-portal', point, '#c7b2ff');
    const pending = [animate(portal, [
      { transform: 'translate(-50%,-50%) scale(.3) rotate(-45deg)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.3) rotate(30deg)', opacity: .85, offset: .38 },
      { transform: 'translate(-50%,-50%) scale(2) rotate(100deg)', opacity: 0 }
    ], { duration: 1600 }, true)];
    if (outgoing) pending.push(animate(outgoing, [
      { transform: 'scale(1) rotate(0deg)', opacity: 1 },
      { transform: 'scale(.75) rotate(-4deg)', opacity: .85, offset: .45 },
      { transform: 'scale(.06) rotate(16deg)', opacity: 0 }
    ], { duration: 700, easing: 'cubic-bezier(.55,0,.75,.45)', fill: 'both' }, true));
    pending.push(animate(board, [
      { transform: 'translateY(-32px) scale(.94)', opacity: 0 },
      { transform: 'translateY(-32px) scale(.94)', opacity: 0, offset: .4 },
      { transform: 'translateY(3px) scale(1.01)', opacity: 1, offset: .85 },
      { transform: 'translateY(0) scale(1)', opacity: 1 }
    ], { duration: 1500, fill: 'both' }));
    board.querySelectorAll('.tile:not(.blocked)').forEach((el, i) => {
      pending.push(animate(el, [
        { transform: 'translateY(-26px) rotate(-4deg)', opacity: 0 },
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 }
      ], { duration: 650, delay: 650 + (i % 5) * 45, fill: 'both' }));
    });
    return Promise.all(pending);
  }
  function resultScene(won, label, animateScene) {
    return `<div class="result-scene ${won ? 'escape' : 'defeat'} ${animateScene ? 'scene-enter' : ''}" aria-hidden="true">
      <div class="result-orbit"></div><div class="result-orbit inner"></div><div class="result-beam"></div>
      <div class="result-core"><span></span></div><div class="result-horizon"></div>
      ${Array.from({ length: 12 }, (_, i) => `<i class="result-spark" style="--n:${i};--x:${8 + (i * 37) % 84}%"></i>`).join('')}
      <span class="result-signal">${label}</span></div>`;
  }
  root.RainEffects = { reset, snapshot, pick, power, relic, captureBoard, restart, resultScene, bossEntrance };
})(window);
