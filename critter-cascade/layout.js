(function () {
  'use strict';
  // Move the actual panel, preserving its controls/listeners/state. Never clone
  // gameplay controls or duplicate their IDs when crossing the breakpoint.
  const panel = document.getElementById('expedition-panel');
  const space = document.querySelector('.play-space');
  const anchor = document.createComment('Mobile expedition panel position');
  panel.before(anchor);
  const desktop = matchMedia('(min-width: 1024px)');
  function arrange() {
    const focus = panel.contains(document.activeElement) ? document.activeElement : null;
    if (desktop.matches) space.append(panel);
    else anchor.after(panel);
    focus?.focus({ preventScroll: true });
  }
  desktop.addEventListener('change', arrange);
  arrange();
})();
