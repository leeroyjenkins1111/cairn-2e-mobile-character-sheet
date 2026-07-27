'use strict';

(() => {
  const originalRenderCharacterView = renderCharacterView;

  function displayDamageNotation(notation) {
    const normalized = String(notation || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!normalized) return '';
    const parts = normalized.split('+').map(part => part.replace(/^d/, 'k'));
    if (parts.length > 1 && parts.every(part => part === parts[0])) {
      return `${parts.length}${parts[0]}`;
    }
    return parts.join(' + ');
  }

  renderCombatLauncher = function renderCombatLauncherRedesigned() {
    const ready = heldWeaponItems();
    const panicked = state.conditions.panicked;
    const section = createEl('section', {
      className: 'combat-launcher',
      attrs: { 'aria-labelledby': 'combat-launcher-title' }
    });

    const headingActions = createEl('div', { className: 'section-heading' }, [
      characterSectionTitle('combat-launcher-title', 'Walka', 'weapon'),
      createEl('div', { className: 'combat-heading-actions' }, [
        panicked ? createEl('span', { className: 'combat-status', text: 'Osłabione' }) : null,
        createEl('button', {
          type: 'button',
          className: 'btn btn-icon btn-ghost combat-options-button',
          attrs: { 'aria-label': 'Więcej opcji walki', title: 'Więcej opcji walki' },
          onclick: openCombatSheet
        }, [uiIcon('more')])
      ])
    ]);
    section.append(headingActions);

    let title = 'Bez broni';
    let meta = 'Atak podstawowy';
    let actionText = 'Rzuć k4';
    let action = () => performUnarmedAttack();
    let actionAria = 'Rzuć k4 obrażeń za atak bez broni';

    if (ready.length === 1) {
      const weapon = ready[0];
      title = weapon.name;
      meta = [weapon.damageFormula?.blast ? 'podmuch' : '', ...safeArray(weapon.traits).slice(0, 2)]
        .filter(Boolean)
        .join(' · ') || 'Broń przygotowana';
      const notation = displayDamageNotation(formatDamageFormula(weapon.damageFormula));
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

    section.append(createEl('div', { className: 'combat-main-row' }, [
      createEl('div', { className: 'combat-main-copy' }, [
        uiIcon('weapon'),
        createEl('span', {}, [
          createEl('strong', { text: title }),
          createEl('small', { text: meta })
        ])
      ]),
      createEl('button', {
        type: 'button',
        className: 'btn combat-roll-action',
        attrs: { 'aria-label': actionAria },
        onclick: action
      }, [uiIcon('roll'), createEl('span', { text: actionText })])
    ]));

    section.append(createEl('button', {
      type: 'button',
      className: 'combat-order-action',
      attrs: { 'aria-label': 'Ustal kolejność w pierwszej rundzie — wykonaj test ZRE' },
      onclick: () => performFirstRoundDexSave()
    }, [
      uiIcon('round'),
      createEl('span', { className: 'combat-order-copy' }, [
        createEl('strong', { text: 'Ustal kolejność' }),
        createEl('small', { text: 'Pierwsza runda · test ZRE' })
      ]),
      uiIcon('arrow')
    ]));

    return section;
  };

  function enhanceCharacterCopy() {
    const damageTitle = document.querySelector('#view-character .damage-primary-action strong');
    if (damageTitle) damageTitle.textContent = 'Otrzymaj obrażenia';

    const damageDescription = document.querySelector('#view-character .damage-primary-action small');
    if (damageDescription) damageDescription.textContent = 'Pancerz → Ochrona → SIŁ';
  }

  renderCharacterView = function renderCharacterViewRedesigned() {
    originalRenderCharacterView();
    enhanceCharacterCopy();
  };

  renderAll();
})();
