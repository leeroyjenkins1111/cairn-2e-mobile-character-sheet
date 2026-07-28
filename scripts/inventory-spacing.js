'use strict';

(() => {
  const INVENTORY_SPACING_RULES = [
    `:root[data-active-view="inventory"] .inventory-overview { padding: 16px; gap: 12px; }`,
    `:root[data-active-view="inventory"] .inventory-summary-head { gap: 12px; }`,
    `:root[data-active-view="inventory"] .inventory-summary-actions { gap: 6px; }`,
    `:root[data-active-view="inventory"] .gold-button { min-height: 42px; padding: 8px 10px; }`,
    `:root[data-active-view="inventory"] .inventory-tools { gap: 8px; }`,
    `:root[data-active-view="inventory"] .inventory-tool { flex: 1 1 140px; padding-inline: 12px; }`,
    `:root[data-active-view="inventory"] .inventory-groups { gap: 14px; }`,
    `:root[data-active-view="inventory"] .inventory-group > summary { padding: 10px 4px; }`,
    `:root[data-active-view="inventory"] .inventory-group-list { display: grid; gap: 8px; padding-top: 8px; }`,
    `:root[data-active-view="inventory"] .inventory-row { min-height: 0; margin-top: 0; padding: 6px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: stretch; gap: 6px; }`,
    `:root[data-active-view="inventory"] .inventory-row-main { min-height: 64px; padding: 10px 11px; border-radius: 12px; gap: 6px; }`,
    `:root[data-active-view="inventory"] .inventory-row-title { align-items: center; gap: 10px; }`,
    `:root[data-active-view="inventory"] .inventory-row-title strong { min-width: 0; }`,
    `:root[data-active-view="inventory"] .inventory-row-facts { gap: 4px 7px; line-height: 1.35; }`,
    `:root[data-active-view="inventory"] .inventory-row-facts > span + span::before { margin-right: 7px; }`,
    `:root[data-active-view="inventory"] .carry-status { min-height: 23px; padding: 4px 8px; border: 1px solid rgba(241, 225, 231, .18); border-radius: 999px; display: inline-flex; align-items: center; background: rgba(241, 225, 231, .04); font-weight: 740; line-height: 1; white-space: nowrap; }`,
    `:root[data-active-view="inventory"] .inventory-group[data-inventory-group="held"] .carry-status { border-color: rgba(223, 189, 104, .46); background: rgba(223, 189, 104, .09); color: var(--character-gold, #dfbd68); }`,
    `:root[data-active-view="inventory"] .inventory-group[data-inventory-group="worn"] .carry-status { border-color: rgba(164, 173, 128, .44); background: rgba(164, 173, 128, .09); color: var(--character-olive, #a4ad80); }`,
    `:root[data-active-view="inventory"] .inventory-group[data-inventory-group="stored"] .carry-status { border-color: rgba(196, 191, 211, .30); background: rgba(196, 191, 211, .06); color: rgba(215, 210, 228, .82); }`,
    `:root[data-active-view="inventory"] .inventory-group[data-inventory-group="spent"] .carry-status { border-color: rgba(231, 132, 146, .42); background: rgba(231, 132, 146, .08); color: var(--character-rose, #e78492); }`,
    `:root[data-active-view="inventory"] .inventory-trailing-action { min-width: 72px; max-width: 104px; min-height: 64px; align-self: stretch; margin: 0; padding: 8px 10px; border: 1px solid rgba(241, 225, 231, .18); border-radius: 12px; font-size: .72rem; line-height: 1.05; white-space: nowrap; }`,
    `:root[data-active-view="inventory"] .inventory-group[data-inventory-group="held"] .inventory-trailing-action { border-color: rgba(223, 189, 104, .32); background: rgba(223, 189, 104, .07); color: var(--character-gold, #dfbd68); }`,
    `html[style*="font-size"][data-active-view="inventory"] .inventory-row { grid-template-columns: minmax(0, 1fr); }`,
    `html[style*="font-size"][data-active-view="inventory"] .inventory-trailing-action { width: 100%; max-width: none; min-height: 46px; }`,
    `@media (max-width: 350px) { :root[data-active-view="inventory"] .inventory-row { grid-template-columns: minmax(0, 1fr); } :root[data-active-view="inventory"] .inventory-trailing-action { width: 100%; max-width: none; min-height: 46px; } }`
  ];

  function installInventorySpacingStyles() {
    if (document.documentElement.dataset.inventorySpacingStyles === 'true') return true;
    const targetSheet = [...document.styleSheets].find(sheet => sheet.href?.endsWith('/styles/app.css'));
    if (!targetSheet) return false;
    for (const rule of INVENTORY_SPACING_RULES) {
      try { targetSheet.insertRule(rule, targetSheet.cssRules.length); }
      catch (error) { console.error('Nie udało się dodać reguły ekwipunku.', error); }
    }
    document.documentElement.dataset.inventorySpacingStyles = 'true';
    return true;
  }

  let frame = 0;
  function installAfterUnifiedScreenStyles() {
    const unifiedReady = document.documentElement.dataset.screenUnificationStyles === 'true';
    if (unifiedReady || frame >= 120) {
      installInventorySpacingStyles();
      return;
    }
    frame += 1;
    requestAnimationFrame(installAfterUnifiedScreenStyles);
  }

  installAfterUnifiedScreenStyles();
})();
