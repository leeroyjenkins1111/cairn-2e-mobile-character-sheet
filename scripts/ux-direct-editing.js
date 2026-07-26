'use strict';

const DIRECT_EDITING_RULES = [
  `.inventory-summary-stat-button { border: 0; border-radius: 0; background: transparent; color: var(--text); cursor: pointer; }`,
  `.inventory-summary-stat-button:active, .inventory-summary-stat-button:hover { background: color-mix(in srgb, var(--surface-soft) 46%, transparent); }`,
  `.inventory-summary-stat-button small { color: var(--moss); font-size: .58rem; font-weight: 720; letter-spacing: .04em; text-transform: uppercase; }`,
  `.inventory-add-item-button { min-height: 42px; padding-inline: 12px; font-size: .76rem; white-space: nowrap; }`,
  `.inventory-add-item-button svg { width: 18px; height: 18px; }`,
  `.direct-save-shortcut { position: fixed; right: 1px; bottom: calc(var(--nav-height, 64px) + 1px); z-index: 20; width: 2px; height: 2px; padding: 0; border: 0; opacity: .01; overflow: hidden; pointer-events: auto; }`,
  `.character-quick-stat { width: 100%; min-width: 0; border: 0; text-align: left; color: inherit; background: transparent; cursor: pointer; }`,
  `.character-quick-stat:hover, .character-quick-stat:active { background: color-mix(in srgb, var(--surface-soft) 52%, transparent); }`,
  `.character-quick-stat:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }`,
  `.combat-weapon-copy { cursor: pointer; border-radius: 8px; }`,
  `.combat-weapon-copy:hover, .combat-weapon-copy:active { background: color-mix(in srgb, var(--surface-soft) 45%, transparent); }`,
  `.combat-weapon-copy::after { content: "Wybierz broń"; display: block; margin-top: 2px; color: var(--moss); font-size: .62rem; font-weight: 760; letter-spacing: .04em; text-transform: uppercase; }`,
  `.combat-order-action { min-height: 58px; justify-content: flex-start; padding: 8px 11px; text-align: left; }`,
  `.combat-order-action > span { display: grid; gap: 1px; }`,
  `.combat-order-action strong { font-size: .82rem; }`,
  `.combat-order-action small { font-size: .65rem; font-weight: 560; opacity: .78; }`,
  `.game-actions .compact-action { min-height: 58px; }`,
  `.game-actions .compact-action svg { width: 25px; height: 25px; }`,
  `.damage-primary-action strong { font-size: 1.02rem; }`,
  `.attribute-wil .mind-icon { width: 18px; height: 18px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }`
];

function installDirectEditingStyles() {
  const sheet = [...document.styleSheets].find(entry => entry.href?.endsWith('/styles/app.css'));
  if (!sheet) return;
  for (const rule of DIRECT_EDITING_RULES) {
    try { sheet.insertRule(rule, sheet.cssRules.length); }
    catch (_) {}
  }
}

function openAttributeEditSheet(attrKey) {
  const stat = state.stats[attrKey];
  const current = numberInput(stat.current, 0, 99);
  const maximum = numberInput(stat.max, 0, 99);
  const body = createEl('div', { className: 'form-grid' }, [
    createEl('div', { className: 'form-grid two' }, [
      field(`${ATTRS[attrKey].label} aktualne`, current),
      field(`${ATTRS[attrKey].label} maksymalne`, maximum)
    ])
  ]);
  const save = button(`Zapisz ${ATTRS[attrKey].label}`, () => {
    const max = Math.max(0, toInt(maximum.value, 0));
    const value = clamp(toInt(current.value, 0), 0, max);
    closeSheet();
    commitChange(`Zmieniono ${ATTRS[attrKey].label}`, next => {
      next.stats[attrKey] = { current: value, max };
    });
  }, 'btn btn-primary btn-block');
  openSheet({ title: `Edytuj ${ATTRS[attrKey].full}`, body, footer: save });
}

function mindIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('mind-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of [
    'M9 19h6',
    'M10 22h4',
    'M8.5 15.5c-1.8-1.2-3-3.2-3-5.5A6.5 6.5 0 0 1 12 3.5a6.5 6.5 0 0 1 6.5 6.5c0 2.3-1.2 4.3-3 5.5-.7.5-1.1 1.1-1.2 2H9.7c-.1-.9-.5-1.5-1.2-2z',
    'M9.5 10.5c.8-1.3 1.7-2 2.5-2s1.7.7 2.5 2'
  ]) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

function replaceWithButton(element, onClick, ariaLabel) {
  if (!element || element.tagName === 'BUTTON') return element;
  const control = createEl('button', {
    type: 'button',
    className: `${element.className} character-quick-stat`,
    attrs: { 'aria-label': ariaLabel },
    onclick: onClick
  });
  while (element.firstChild) control.append(element.firstChild);
  element.replaceWith(control);
  return control;
}

function enhanceCharacterStatEditing() {
  const root = document.querySelector('#view-character');
  const attributeRow = root?.querySelector('.attribute-row');
  if (!attributeRow) return;
  attributeRow.setAttribute('aria-label', 'Atrybuty postaci. Kliknij, aby edytować.');

  for (const attrKey of ['str', 'dex', 'wil']) {
    const control = attributeRow.querySelector(`.attribute-${attrKey}`);
    if (!control || control.dataset.directEditReady === 'true') continue;
    control.dataset.directEditReady = 'true';
    control.setAttribute('aria-label', `Edytuj ${ATTRS[attrKey].full}. Aktualna wartość ${state.stats[attrKey].current}, maksymalna ${state.stats[attrKey].max}.`);
    control.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openAttributeEditSheet(attrKey);
    }, true);
  }

  const wil = attributeRow.querySelector('.attribute-wil');
  if (wil && !wil.querySelector('.mind-icon')) {
    wil.querySelector('svg')?.remove();
    wil.prepend(mindIcon());
  }

  if (!attributeRow.querySelector('[data-save-shortcut="str"]')) {
    attributeRow.append(createEl('button', {
      type: 'button',
      className: 'direct-save-shortcut',
      dataset: { saveShortcut: 'str' },
      attrs: { 'aria-label': `Przygotuj rzut obronny ${ATTRS.str.full}, aktualna wartość ${state.stats.str.current}` },
      onclick: () => openSavePreparationSheet('str')
    }, [createEl('span', { text: 'Rzut obronny SIŁ' })]));
  }

  const secondary = [...root.querySelectorAll('.state-secondary .secondary-stat')];
  const armorStat = secondary.find(item => item.textContent.includes('Pancerz'));
  const slotsStat = secondary.find(item => item.textContent.includes('Miejsca'));
  const armor = deriveArmor();
  const usage = calculateInventoryUsage();
  replaceWithButton(armorStat, openArmorSheet, `Pancerz ${armor.effective}. Zmień wartość pancerza.`);
  replaceWithButton(slotsStat, () => document.querySelector('#nav-inventory')?.click(), `Miejsca ${usage.total} z 10. Przejdź do ekwipunku.`);
}

function enhanceCombatAndGameActions() {
  const root = document.querySelector('#view-character');
  if (!root) return;

  const weaponCopy = root.querySelector('.combat-weapon-copy');
  if (weaponCopy && weaponCopy.dataset.weaponChoiceReady !== 'true') {
    weaponCopy.dataset.weaponChoiceReady = 'true';
    weaponCopy.setAttribute('role', 'button');
    weaponCopy.setAttribute('tabindex', '0');
    weaponCopy.setAttribute('aria-label', `${weaponCopy.querySelector('strong')?.textContent || 'Broń'}. Wybierz broń do walki.`);
    const chooseWeapon = () => openCombatSheet();
    weaponCopy.addEventListener('click', chooseWeapon);
    weaponCopy.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        chooseWeapon();
      }
    });
  }

  const roundAction = root.querySelector('[aria-label="Pierwsza runda · ZRE"]');
  if (roundAction && roundAction.dataset.roundCtaReady !== 'true') {
    roundAction.dataset.roundCtaReady = 'true';
    roundAction.classList.add('combat-order-action');
    roundAction.setAttribute('aria-label', 'Ustal kolejność w pierwszej rundzie rzutem obronnym ZRE');
    const icon = roundAction.querySelector('svg');
    roundAction.replaceChildren(
      icon || uiIcon('round'),
      createEl('span', {}, [
        createEl('strong', { text: 'Ustal kolejność' }),
        createEl('small', { text: 'Pierwsza runda · rzut ZRE' })
      ])
    );
  }

  const damageAction = root.querySelector('.damage-primary-action');
  if (damageAction && damageAction.dataset.damageCtaReady !== 'true') {
    damageAction.dataset.damageCtaReady = 'true';
    damageAction.setAttribute('aria-label', 'Otrzymaj obrażenia i rozlicz ich skutki');
    const strong = damageAction.querySelector('strong');
    const small = damageAction.querySelector('small');
    if (strong) strong.textContent = 'Otrzymaj obrażenia';
    if (small) small.textContent = 'Rozlicz pancerz, OCHR i ewentualną utratę SIŁ';
  }
}

function makeInventoryStatButton(statKey, value, label, onClick, ariaLabel) {
  return createEl('button', {
    type: 'button',
    className: 'inventory-summary-stat inventory-summary-stat-button',
    dataset: { inventoryStat: statKey },
    attrs: { 'aria-label': ariaLabel },
    onclick: onClick
  }, [
    createEl('strong', { text: value }),
    createEl('span', { text: label }),
    createEl('small', { text: 'Edytuj' })
  ]);
}

function enhanceInventoryActions() {
  const root = document.querySelector('#view-inventory');
  const stats = root?.querySelector('.inventory-summary-stats');
  if (!stats || stats.dataset.directEditReady === 'true') return;
  stats.dataset.directEditReady = 'true';

  const usage = calculateInventoryUsage();
  const armor = deriveArmor();
  stats.replaceChildren(
    makeInventoryStatButton('fatigue', usage.fatigueSlots, 'zmęczenia', openAddFatigueSheet, `Zmęczenie: ${usage.fatigueSlots}. Dodaj zmęczenie.`),
    makeInventoryStatButton('armor', armor.effective, 'pancerz', openArmorSheet, `Pancerz: ${armor.effective}. Otwórz ustawienia pancerza.`),
    makeInventoryStatButton('gold', state.stats.gold, 'złoto', openGoldSheet, `Złoto: ${state.stats.gold}. Zmień ilość złota.`)
  );

  root.querySelector('.inventory-tools')?.remove();
  root.querySelector('.gold-button')?.remove();

  const actions = root.querySelector('.inventory-summary-actions');
  const addButton = actions?.querySelector('[aria-label="Dodaj przedmiot"]');
  if (actions && addButton) {
    const labeledAddButton = createEl('button', {
      type: 'button',
      className: 'btn btn-primary inventory-add-item-button',
      attrs: { 'aria-label': 'Dodaj przedmiot do ekwipunku' },
      onclick: () => openItemSheet()
    }, [uiIcon('plus'), createEl('span', { text: 'Dodaj przedmiot' })]);
    addButton.replaceWith(labeledAddButton);
  }
}

function enhanceCharacterView() {
  enhanceCharacterStatEditing();
  enhanceCombatAndGameActions();
}

const renderCharacterViewBase = renderCharacterView;
renderCharacterView = function renderCharacterViewWithDirectEditing() {
  renderCharacterViewBase();
  enhanceCharacterView();
};

const renderInventoryViewBase = renderInventoryView;
renderInventoryView = function renderInventoryViewWithDirectActions() {
  renderInventoryViewBase();
  enhanceInventoryActions();
};

installDirectEditingStyles();
enhanceCharacterView();
enhanceInventoryActions();
