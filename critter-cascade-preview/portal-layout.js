/* Only loaded in the portal build. Preserve the original controls and listeners. */
(() => {
  const panel = document.querySelector('.game-panel');
  const board = document.createElement('div'); board.className = 'portal-board-column';
  const controls = document.createElement('div'); controls.className = 'portal-controls-column';
  panel.append(board, controls);
  for (const selector of ['.board-area', '.board-caption']) board.append(document.querySelector(selector));
  for (const selector of ['#portal-coach', '#boss-status', '#boss-trial', '#environment-status', '#eclipse-status', '#pressure-status', '#flip-preview', '#reserve-area', '.inventory-area', '.expedition-controls', '.tools', '#result-button', '#expedition-panel']) controls.append(document.querySelector(selector));
  const companions = document.getElementById('expedition-panel');
  const details = document.createElement('details'); details.className = 'portal-team-details';
  details.innerHTML = '<summary data-i18n="portalTeamDetails"></summary>';
  for (const selector of ['.expedition-heading', '#equipment-catalog', '#boss-catalog', '#expedition-ten', '#relic-slots', '#family-bonuses', '#expedition-save-status', '#expedition-hint', '#equipment-feedback', '#proc-log', '.free-note']) {
    const el = document.querySelector(selector); if (el) details.append(el);
  }
  companions.append(details);
  const modeMenu = document.createElement('details'); modeMenu.className = 'portal-mode-menu';
  modeMenu.innerHTML = '<summary data-i18n="portalModes"></summary>';
  const options = document.querySelector('.difficulty-options'); options.before(modeMenu); modeMenu.append(options);
  options.addEventListener('click', () => { modeMenu.open = false; });
  const actions = document.querySelector('.header-actions');
  options.append(document.getElementById('help'));
  actions.append(modeMenu, document.getElementById('language'));
  document.querySelectorAll('[data-portal-animal]').forEach(el => {
    const [family, row, level] = el.dataset.portalAnimal.split(':');
    el.innerHTML = RainPortal.sprite(family, Number(row), Number(level));
  });
  RainPortal.localize();
})();
