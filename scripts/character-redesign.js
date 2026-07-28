'use strict';

(() => {
  const originalRenderCharacterView = renderCharacterView;

  function installCharacterRedesignStyles() {
    if (document.documentElement.dataset.characterRedesignStyles === 'true') return Promise.resolve();

    const targetSheet = [...document.styleSheets].find(sheet => sheet.href?.endsWith('/styles/app.css'));
    if (!targetSheet) return Promise.reject(new Error('Nie znaleziono głównego arkusza stylów.'));

    return new Promise((resolve, reject) => {
      const source = document.createElement('link');
      source.rel = 'stylesheet';
      source.href = './styles/character-redesign.css?v=0.24.0';
      source.onload = () => {
        try {
          const rules = [...source.sheet.cssRules].map(rule => rule.cssText);
          for (const rule of rules) targetSheet.insertRule(rule, targetSheet.cssRules.length);
          document.documentElement.dataset.characterRedesignStyles = 'true';
          source.remove();
          resolve();
        } catch (error) {
          source.remove();
          reject(error);
        }
      };
      source.onerror = () => {
        source.remove();
        reject(new Error('Nie udało się wczytać stylów ekranu postaci.'));
      };
      document.head.append(source);
    });
  }

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
      createEl('div', { className: 'header-actions combat-heading-actions' }, [
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
        uiIcon('weapon'),
        createEl('span', {}, [
          createEl('strong', { text: title }),
          createEl('small', { text: meta })
        ])
      ]),
      createEl('button', {
        type: 'button',
        className: 'btn combat-weapon-action combat-roll-action',
        attrs: { 'aria-label': actionAria },
        onclick: action
      }, [uiIcon('roll'), createEl('span', { text: actionText })])
    ]));

    const orderAction = createEl('button', {
      type: 'button',
      className: 'btn btn-ghost combat-utility-action combat-order-action',
      attrs: { 'aria-label': 'Pierwsza runda · ZRE — Ustal kolejność' },
      onclick: () => performFirstRoundDexSave()
    }, [
      uiIcon('round'),
      createEl('span', { className: 'combat-order-copy' }, [
        createEl('strong', { text: 'Ustal kolejność' }),
        createEl('small', { text: 'Pierwsza runda · test ZRE' })
      ]),
      uiIcon('arrow')
    ]);
    section.append(createEl('div', { className: 'combat-quick-actions' }, [orderAction]));

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

  installCharacterRedesignStyles()
    .catch(error => console.error(error))
    .finally(() => renderAll());
})();
