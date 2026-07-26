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

function enhanceCharacterStatEditing() {
  const attributeRow = document.querySelector('#view-character .attribute-row');
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

const renderCharacterViewBase = renderCharacterView;
renderCharacterView = function renderCharacterViewWithDirectEditing() {
  renderCharacterViewBase();
  enhanceCharacterStatEditing();
};

const renderInventoryViewBase = renderInventoryView;
renderInventoryView = function renderInventoryViewWithDirectActions() {
  renderInventoryViewBase();
  enhanceInventoryActions();
};

enhanceCharacterStatEditing();
enhanceInventoryActions();
