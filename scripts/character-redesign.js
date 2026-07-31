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
      { attrs: { d: 'm5 4 14 14M19 4 5 18' } },
      { attrs: { d: 'M4 3.5 7.5 5 5 7.5zM20 3.5 16.5 5 19 7.5zM4 20.5l3.5-1.5L5 16.5zM20 20.5 16.5 19l2.5-2.5z' } }
    ]
  };

  const COMBAT_ICONS = {
    turnOrder: [
      { attrs: { d: 'M7 7h9l-2.5-2.5M17 17H8l2.5 2.5' } },
      { attrs: { d: 'M17 7a5 5 0 0 1 0 10M7 17A5 5 0 0 1 7 7' } }
    ],
    chevron: [
      { attrs: { d: 'm9 6 6 6-6 6' } }
    ],
    damage: [
      { attrs: { d: 'M12 3 19 6v5c0 4.7-2.8 8-7 10-4.2-2-7-5.3-7-10V6z' } },
      { attrs: { d: 'm13.5 5.5-3 5.5h3l-3 6.5' } }
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

  function weaponSummary(ready, panicked) {
    if (!ready.length) {
      return { current: 'Bez broni', notation: 'k4' };
    }
    if (ready.length > 1) {
      return { current: `${ready.length} ${weaponCountLabel(ready.length)} w rękach`, notation: '' };
    }
    const weapon = ready[0];
    const notation = displayDamageNotation(formatDamageFormula(weapon.damageFormula)) || 'k4';
    return { current: weapon.name, notation: panicked ? 'k4' : notation };
  }

  function combatSectionTitle() {
    return createEl('div', { className: 'section-title' }, [
      makeWeaponSvg(WEAPON_ICONS.weapon),
      createEl('h2', { id: 'combat-launcher-title', text: 'Walka' })
    ]);
  }

  function renderCombatLauncherRedesigned() {
    const ready = heldWeaponItems();
    const panicked = state.conditions.panicked;
    const summary = weaponSummary(ready, panicked);
    const section = createEl('section', {
      className: 'combat-launcher',
      attrs: { 'aria-labelledby': 'combat-launcher-title' }
    });

    section.append(createEl('div', { className: 'section-heading' }, [
      combatSectionTitle(),
      panicked ? createEl('span', { className: 'combat-status', text: 'Osłabione' }) : null
    ]));

    section.append(createEl('button', {
      type: 'button',
      className: 'combat-panel-row combat-weapon-choice',
      attrs: {
        'aria-label': `Wybierz broń. Aktualnie: ${summary.current}${summary.notation ? `. Obrażenia: ${summary.notation}` : ''}`
      },
      onclick: openCombatSheet
    }, [
      contextualWeaponIcon(ready),
      createEl('span', { className: 'combat-panel-copy' }, [
        createEl('strong', { text: 'Wybierz broń' }),
        createEl('small', { text: summary.current })
      ]),
      summary.notation ? createEl('span', { className: 'combat-panel-value', text: summary.notation }) : null,
      makeWeaponSvg(COMBAT_ICONS.chevron)
    ]));

    section.append(createEl('button', {
      type: 'button',
      className: 'combat-panel-row combat-turn-row',
      attrs: { 'aria-label': `Ustal kolejność tur — wykonaj test ZRE ${state.stats.dex.current}` },
      onclick: () => performFirstRoundDexSave()
    }, [
      makeWeaponSvg(COMBAT_ICONS.turnOrder),
      createEl('span', { className: 'combat-panel-copy' }, [
        createEl('strong', { text: 'Ustal kolejność tur' })
      ]),
      createEl('span', { className: 'combat-turn-value', text: `ZRE ${state.stats.dex.current}` })
    ]));

    return section;
  }

  globalThis.CairnRuntime.registerRenderer('combatLauncher', renderCombatLauncherRedesigned);

  function enhanceCharacterCopy() {
    const damageAction = document.querySelector('#view-character .damage-primary-action');
    if (!damageAction) return;

    damageAction.setAttribute('aria-label', 'Otrzymaj obrażenia');
    const damageTitle = damageAction.querySelector('strong');
    if (damageTitle) damageTitle.textContent = 'Otrzymaj obrażenia';
    const damageDescription = damageAction.querySelector('small');
    if (damageDescription) damageDescription.textContent = 'Pancerz → Ochrona → SIŁ';

    const damageIcon = damageAction.querySelector('svg');
    if (damageIcon) damageIcon.replaceWith(makeWeaponSvg(COMBAT_ICONS.damage));
  }

  globalThis.CairnRenderHooks.addCharacterHook(enhanceCharacterCopy);
})();
