'use strict';

(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function displayDamageNotation(notation) {
    const normalized = String(notation || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!normalized) return '';
    const parts = normalized.split('+').map(part => part.replace(/^d/, 'k'));
    if (parts.length > 1 && parts.every(part => part === parts[0])) return `${parts.length}${parts[0]}`;
    return parts.join(' + ');
  }

  function makeWeaponSvg(paths) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (const definition of paths) {
      const element = document.createElementNS(SVG_NS, definition.tag || 'path');
      for (const [name, value] of Object.entries(definition.attrs || {})) element.setAttribute(name, value);
      svg.append(element);
    }
    return svg;
  }

  const WEAPON_ICONS = {
    dagger: [
      { attrs: { d: 'M14.5 3.5 20.5 3l-.5 6-9.7 9.7-5-5z' } },
      { attrs: { d: 'm8.5 16.5-3 3M4 18l2 2M11.5 11.5l1 1' } }
    ],
    sword: [
      { attrs: { d: 'm14 4 6-1-1 6-9.5 9.5-4-4z' } },
      { attrs: { d: 'm8 16-4 4M3 18l3 3M10.5 11.5l2 2' } }
    ],
    axe: [
      { attrs: { d: 'M13 4c3-2 6-1 8 1-1 4-3 6-7 6z' } },
      { attrs: { d: 'M14 8 5 21M8 17l3 2' } }
    ],
    mace: [
      { tag: 'circle', attrs: { cx: '16.5', cy: '6.5', r: '3.5' } },
      { attrs: { d: 'm14 9-9 11M5 17l3 3M16.5 1.5v2M21.5 6.5h-2M19.8 3.2l-1.4 1.4' } }
    ],
    spear: [
      { attrs: { d: 'm18 3 3 3-5 2zM17 7 4 20M4 17l3 3' } }
    ],
    bow: [
      { attrs: { d: 'M7 3c6 4 6 14 0 18M7 3l10 9-10 9M3 12h15M15 10l3 2-3 2' } }
    ],
    staff: [
      { attrs: { d: 'M15 3c-3 1-3 4 0 5 3 1 3 4 0 5L8 21M13 5h4M12 11h5' } }
    ],
    sling: [
      { attrs: { d: 'M7 4c0 5 3 7 5 8s5 3 5 8M7 4l5 8M17 20l-5-8' } },
      { tag: 'circle', attrs: { cx: '7', cy: '4', r: '1.5' } }
    ],
    hand: [
      { attrs: { d: 'M7 12V7a1.5 1.5 0 0 1 3 0v3-4a1.5 1.5 0 0 1 3 0v4-3a1.5 1.5 0 0 1 3 0v3-2a1.5 1.5 0 0 1 3 0v5c0 4-2 6-6 6h-1c-3 0-5-2-6-4l-2-4a1.6 1.6 0 0 1 2.8-1.5z' } }
    ],
    weapon: [
      { attrs: { d: 'm4 4 16 16M20 4 4 20M7 4 4 7M17 4l3 3M4 17l3 3M17 20l3-3' } }
    ]
  };

  function weaponIconType(item) {
    if (!item) return 'hand';
    const haystack = [item.name, item.description, ...safeArray(item.traits)].join(' ').toLowerCase();
    const rules = [
      ['dagger', /dagger|sztylet|nóż|noż|knife|stiletto/],
      ['sword', /sword|miecz|rapier|sabre|saber|falchion|scimitar/],
      ['axe', /axe|topór|topor|siekier|halberd/],
      ['mace', /mace|club|pałk|palka|młot|mlot|hammer|morningstar|flail/],
      ['spear', /spear|włócz|wlocz|lance|pike|oszczep/],
      ['bow', /bow|łuk|luk|crossbow|kusz/],
      ['staff', /staff|kostur|laska|quarterstaff/],
      ['sling', /sling|proca/]
    ];
    return rules.find(([, pattern]) => pattern.test(haystack))?.[0] || 'weapon';
  }

  function contextualWeaponIcon(ready) {
    if (!ready.length) return makeWeaponSvg(WEAPON_ICONS.hand);
    if (ready.length > 1) return makeWeaponSvg(WEAPON_ICONS.weapon);
    return makeWeaponSvg(WEAPON_ICONS[weaponIconType(ready[0])]);
  }

  renderCombatLauncher = function renderCombatLauncherRedesigned() {
    const ready = heldWeaponItems();
    const panicked = state.conditions.panicked;
    const section = createEl('section', {
      className: 'combat-launcher',
      attrs: { 'aria-labelledby': 'combat-launcher-title' }
    });

    section.append(createEl('div', { className: 'section-heading' }, [
      characterSectionTitle('combat-launcher-title', 'Walka', 'weapon'),
      createEl('div', { className: 'header-actions combat-heading-actions' }, [
        panicked ? createEl('span', { className: 'combat-status', text: 'Osłabione' }) : null,
        createEl('button', {
          type: 'button',
          className: 'btn btn-icon btn-ghost combat-options-button',
          attrs: { 'aria-label': 'Więcej opcji walki', title: 'Więcej opcji walki' },
          onclick: openCombatSheet
        }, [uiIcon('more')])
      ])
    ]));

    let title = 'Bez broni';
    let meta = 'Atak podstawowy';
    let actionText = 'Rzuć k4';
    let action = () => performUnarmedAttack();
    let actionAria = 'Rzuć k4 obrażeń za atak bez broni';

    if (ready.length === 1) {
      const weapon = ready[0];
      title = weapon.name;
      meta = [weapon.damageFormula?.blast ? 'podmuch' : '', ...safeArray(weapon.traits).slice(0, 2)].filter(Boolean).join(' · ') || 'Broń przygotowana';
      const notation = displayDamageNotation(formatDamageFormula(weapon.damageFormula)) || 'k4';
      actionText = `Rzuć ${panicked ? 'k4' : notation}`;
      action = () => runItemAttack(weapon);
      actionAria = `Rzuć obrażenia przygotowaną bronią: ${weapon.name}`;
    } else if (ready.length > 1) {
      title = `${ready.length} ${weaponCountLabel(ready.length)} w rękach`;
      meta = 'Wybierz broń do ataku';
      actionText = 'Wybierz';
      action = openCombatSheet;
      actionAria = 'Wybierz przygotowaną broń do ataku';
    }

    section.append(createEl('div', { className: 'combat-main-row combat-weapon-row' }, [
      createEl('div', { className: 'combat-main-copy combat-weapon-copy' }, [
        contextualWeaponIcon(ready),
        createEl('span', {}, [createEl('strong', { text: title }), createEl('small', { text: meta })])
      ]),
      createEl('button', {
        type: 'button',
        className: 'btn combat-weapon-action combat-roll-action',
        attrs: { 'aria-label': actionAria },
        onclick: action
      }, [uiIcon('roll'), createEl('span', { text: actionText })])
    ]));

    section.append(createEl('button', {
      type: 'button',
      className: 'btn btn-ghost combat-utility-action combat-order-action',
      attrs: { 'aria-label': 'Ustal kolejność — wykonaj test ZRE' },
      onclick: () => performFirstRoundDexSave()
    }, [
      uiIcon('round'),
      createEl('span', { className: 'combat-order-copy' }, [createEl('strong', { text: 'Ustal kolejność' })]),
      createEl('span', { className: 'combat-order-badge', text: 'ZRE' })
    ]));

    return section;
  };

  function enhanceCharacterCopy() {
    const damageTitle = document.querySelector('#view-character .damage-primary-action strong');
    if (damageTitle) damageTitle.textContent = 'Otrzymaj obrażenia';
    const damageDescription = document.querySelector('#view-character .damage-primary-action small');
    if (damageDescription) damageDescription.textContent = 'Pancerz → Ochrona → SIŁ';
  }

  globalThis.CairnRenderHooks.addCharacterHook(enhanceCharacterCopy);
  renderAll();
})();
