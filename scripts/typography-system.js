'use strict';

const TYPOGRAPHY_RULES = [
  `:root {
    --type-view-title: 1.16rem;
    --type-section-title: 1.18rem;
    --type-record-title: 1rem;
    --type-primary-action: .92rem;
    --type-action: .86rem;
    --type-compact-action: .76rem;
    --type-body: .9rem;
    --type-supporting: .76rem;
    --type-meta: .68rem;
    --type-kicker: .72rem;
    --type-value: 1.35rem;
  }`,
  `.brand-title { font-size: var(--type-view-title); line-height: 1.15; }`,
  `.brand-kicker, .section-kicker, .eyebrow { font-size: var(--type-kicker); line-height: 1.2; }`,
  `.section-heading h1, .section-heading h2, .section-head h2, .section-head h3, .sheet-head h2 { font-size: var(--type-section-title); line-height: 1.15; }`,
  `.section-caption, .state-caption, .combat-weapon-copy span, .inventory-row-facts, .inventory-row-note, .carry-status, .dice-recent-copy span, .field-help { font-size: var(--type-supporting); line-height: 1.3; }`,
  `.btn { font-size: var(--type-action); line-height: 1.15; }`,
  `.btn-primary, .damage-primary-action strong, .inventory-add-item-button { font-size: var(--type-primary-action); }`,
  `.compact-action span, .combat-quick-actions .btn, .inventory-trailing-action, .nav-btn { font-size: var(--type-compact-action); }`,
  `.compact-action small, .combat-order-action small, .inventory-summary-stat span, .inventory-summary-stat small, .tag, .condition-chip, .combat-status { font-size: var(--type-meta); line-height: 1.2; }`,
  `.inventory-row-title strong, .combat-weapon-copy strong, .action-row strong, .report-block h3, .dice-history-item strong { font-size: var(--type-record-title); line-height: 1.2; }`,
  `.inventory-summary-stat strong, .secondary-stat strong { font-size: var(--type-value); line-height: 1; }`,
  `.sheet-body, .report-block p, .inventory-detail-copy p, .quick-note textarea, .form-grid input, .form-grid select, .form-grid textarea { font-size: var(--type-body); }`,
  `.damage-primary-action small { font-size: var(--type-supporting); line-height: 1.25; }`,
  `.combat-order-action strong { font-size: var(--type-action); line-height: 1.15; }`,
  `.inventory-summary-title { font-size: 1.5rem; line-height: 1; }`,
  `.dice-result strong { line-height: .95; }`,
  `.combat-order-action { display: grid; grid-template-columns: auto minmax(0, 1fr); max-width: 100%; }`,
  `.combat-order-action > span { width: 100%; min-width: 0; max-width: 100%; }`,
  `.combat-order-action strong, .combat-order-action small { min-width: 0; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }`,
  `.damage-primary-action { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; max-width: 100%; }`,
  `.damage-primary-action > span { min-width: 0; max-width: 100%; }`,
  `.damage-primary-action strong, .damage-primary-action small { min-width: 0; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }`,
  `html[style*="font-size"] .combat-quick-actions { display: grid; grid-template-columns: minmax(0, 1fr) auto; width: 100%; }`,
  `html[style*="font-size"] .combat-order-action { width: 100%; }`,
  `html[style*="font-size"] .secondary-action-grid { display: grid; grid-template-columns: minmax(0, 1fr); }`,
  `html[style*="font-size"] .combat-weapon-row { grid-template-columns: minmax(0, 1fr); }`,
  `html[style*="font-size"] .combat-weapon-action { width: 100%; }`,
  `html[style*="font-size"] .nav-btn > span:last-child { max-width: 100%; font-size: .5rem; line-height: 1; white-space: normal; overflow-wrap: anywhere; }`,
  `@media (max-height: 700px) {
    #view-character .identity-row { min-height: 54px; padding-bottom: 8px; }
    #view-character .state-values { padding-bottom: 6px; }
    #view-character .attribute-row { padding-top: 3px; }
    #view-character .combat-launcher { margin-top: 8px; padding-block: 8px; gap: 4px; }
    #view-character .game-actions { padding-top: 6px; }
    #view-character .damage-primary-action { min-height: 48px; padding-block: 4px 6px; }
    #view-character .game-actions .compact-action { min-height: 46px; }
  }`,
  `@media (max-width: 350px) {
    :root {
      --type-view-title: 1.08rem;
      --type-section-title: 1.1rem;
      --type-record-title: .96rem;
      --type-primary-action: .88rem;
      --type-action: .82rem;
      --type-compact-action: .72rem;
      --type-body: .86rem;
      --type-supporting: .72rem;
      --type-meta: .64rem;
    }
    .combat-order-action small { font-size: .6rem; }
  }`,
  `@media (min-width: 480px) {
    :root {
      --type-section-title: 1.22rem;
      --type-body: .92rem;
    }
  }`
];

function installTypographySystem() {
  const sheet = [...document.styleSheets].find(entry => entry.href?.endsWith('/styles/app.css'));
  if (!sheet || document.documentElement.dataset.typographySystem === 'true') return;
  document.documentElement.dataset.typographySystem = 'true';
  for (const rule of TYPOGRAPHY_RULES) {
    try { sheet.insertRule(rule, sheet.cssRules.length); }
    catch (_) {}
  }
}

installTypographySystem();
