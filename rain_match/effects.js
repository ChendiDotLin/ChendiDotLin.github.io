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
  function ghost(from, target, type, matched) {
    if (motion.matches || !from) return;
    const item = RainMatch.ITEMS[type], el = node('fx-loot', center(from), item.color);
    const img = document.createElement('img'); img.src = `assets/${item.id}.webp`; img.alt = ''; el.append(img);
    el.style.width = `${from.width}px`; el.style.height = `${from.height}px`;
    const origin = center(from), x = target.x - origin.x, y = target.y - origin.y;
    animate(el, [
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${x * .55}px),calc(-50% + ${y * .45 - 20}px)) scale(1.08)`, opacity: 1, offset: .5 },
      { transform: `translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) scale(${matched ? .15 : .8})`, opacity: 0 }
    ], { duration: matched ? 650 : 440 }, true);
  }
  function pick(before, id, type, matched) {
    if (motion.matches) return;
    const rack = document.getElementById('rack');
    if (matched) {
      const target = center(rack.getBoundingClientRect());
      for (const [tileId, value] of before) {
        if (value.type === type && (tileId === id || !document.querySelector(`.game-shell .tile[data-id="${tileId}"]`)))
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
  function relic(events, before) {
    if (motion.matches) return Promise.resolve();
    const board = document.getElementById('board').getBoundingClientRect();
    const rack = document.getElementById('rack').getBoundingClientRect();
    const pending = [];
    for (const event of events) {
      if (event.kind === 'shield') {
        const shield = node('fx-shield', { x: rack.left - 5, y: rack.top - 5 });
        shield.style.width = `${rack.width + 10}px`; shield.style.height = `${rack.height + 10}px`;
        pending.push(animate(shield, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'scale(1.02)', offset: .25 }, { opacity: 0, transform: 'scale(1.12)' }], { duration: 1150 }, true));
      } else if (event.kind === 'radar') {
        const scan = node('fx-radar', { x: board.left, y: board.top }); scan.style.width = `${board.width}px`;
        pending.push(animate(scan, [{ transform: 'translateY(0)', opacity: 0 }, { opacity: .85, offset: .15 }, { transform: `translateY(${board.height}px)`, opacity: 0 }], { duration: 1250 }, true));
      } else if (event.kind === 'blackhole') {
        const point = center(rack), portal = node('fx-portal', point, '#c7a5fa');
        for (const id of event.ids) if (before.has(id)) ghost(before.get(id).rect, point, before.get(id).type, true);
        pending.push(animate(portal, [{ transform: 'translate(-50%,-50%) scale(.15) rotate(0)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(.65) rotate(80deg)', opacity: .95, offset: .45 }, { transform: 'translate(-50%,-50%) scale(.1) rotate(180deg)', opacity: 0 }], { duration: 1250 }, true));
      } else if (event.kind === 'ukulele') {
        let origin = center(rack);
        event.ids.forEach((id, i) => {
          if (!before.has(id)) return;
          const point = center(before.get(id).rect), dx = point.x - origin.x, dy = point.y - origin.y;
          const arc = node('fx-lightning', origin); arc.style.width = `${Math.hypot(dx, dy)}px`;
          const rotation = `rotate(${Math.atan2(dy, dx)}rad)`;
          pending.push(animate(arc, [{ transform: rotation + ' scaleX(0)', opacity: 0 }, { transform: rotation + ' scaleX(1)', opacity: .9, offset: .25 }, { transform: rotation, opacity: 0 }], { duration: 850, delay: i * 130 }, true));
          burst(point, '#b4dfff', 6); origin = point;
        });
      } else if (event.kind === 'feather') {
        const from = before.get(event.ids[0]);
        if (from) { burst(center(from.rect), '#ead699', 6);
          const ring = node('fx-ring', center(from.rect), '#e8d99d');
          pending.push(animate(ring, [{ transform: 'translate(-50%,-50%) scale(.5)', opacity: .8 }, { transform: 'translate(-50%,-100%) scale(1.5)', opacity: 0 }], { duration: 950 }, true)); }
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
  root.RainEffects = { reset, snapshot, pick, power, relic, captureBoard, restart, resultScene };
})(window);
