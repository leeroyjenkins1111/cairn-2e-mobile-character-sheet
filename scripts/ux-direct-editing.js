'use strict';

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
  const wilGlyph = wil?.querySelector('.attribute-glyph');
  if (wilGlyph && !wilGlyph.querySelector('.mind-icon')) wilGlyph.replaceChildren(mindIcon());

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
    weaponCopy.setAttribute('title', 'Wybierz broń');
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
    roundAction.setAttribute('aria-label', 'Pierwsza runda · ZRE — Ustal kolejność');
    const icon = roundAction.querySelector('svg');
    roundAction.replaceChildren(
      icon || uiIcon('round'),
      createEl('span', {}, [
        createEl('span', { className: 'sr-only', text: 'Runda 1' }),
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
    if (small) small.textContent = 'Pancerz → OCHR → SIŁ';
  }
}

function enhanceCharacterView() {
  enhanceCharacterStatEditing();
  enhanceCombatAndGameActions();
}

globalThis.CairnRenderHooks.addCharacterHook(enhanceCharacterView);
enhanceCharacterView();
