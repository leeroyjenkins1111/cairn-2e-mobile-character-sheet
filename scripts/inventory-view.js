'use strict';

(() => {
  function inventoryStatButton(statKey, value, label, onClick, ariaLabel) {
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

  function renderConsolidatedInventoryView() {
    const root = document.querySelector('#view-inventory');
    if (!root) return;
    root.replaceChildren();

    if (!state.initialized) {
      root.append(card([createEl('div', { className: 'card-pad' }, [
        sectionHead('Ekwipunek'),
        createEl('p', { className: 'muted', text: 'Najpierw utwórz lub zaimportuj postać.' })
      ])]));
      return;
    }

    const usage = calculateInventoryUsage();
    const armor = deriveArmor();
    const overview = createEl('section', {
      className: 'inventory-overview',
      attrs: { 'aria-label': 'Stan ekwipunku' }
    });

    overview.append(createEl('div', { className: 'inventory-summary-head' }, [
      createEl('div', {}, [
        createEl('strong', { className: 'inventory-summary-title', text: `${usage.total}/10 miejsc` }),
        createEl('span', {
          className: 'section-caption',
          text: usage.total === 10 ? 'Pełny ekwipunek · OCHR krytyczne' : `${10 - usage.total} wolnych`
        })
      ]),
      createEl('div', { className: 'inventory-summary-actions' }, [
        createEl('button', {
          type: 'button',
          className: 'btn btn-primary inventory-add-item-button',
          attrs: { 'aria-label': 'Dodaj przedmiot do ekwipunku' },
          onclick: () => openItemSheet()
        }, [uiIcon('plus'), createEl('span', { text: 'Dodaj przedmiot' })])
      ])
    ]));

    overview.append(createEl('div', { className: 'inventory-summary-stats' }, [
      inventoryStatButton('fatigue', usage.fatigueSlots, 'zmęczenia', openAddFatigueSheet, `Zmęczenie: ${usage.fatigueSlots}. Dodaj zmęczenie.`),
      inventoryStatButton('armor', armor.effective, 'pancerz', openArmorSheet, `Pancerz: ${armor.effective}. Otwórz ustawienia pancerza.`),
      inventoryStatButton('gold', state.stats.gold, 'złoto', openGoldSheet, `Złoto: ${state.stats.gold}. Zmień ilość złota.`)
    ]));
    overview.append(renderSlotMeter(usage));
    overview.append(createEl('p', {
      className: 'inventory-legend',
      text: 'Drobiazg 0 · zwykły 1 · nieporęczny 2 · zmęczenie 1'
    }));
    root.append(overview);

    const listCard = createEl('section', {
      className: 'inventory-list',
      attrs: { 'aria-labelledby': 'inventory-list-title' }
    });
    listCard.append(createEl('div', { className: 'section-heading' }, [
      createEl('h2', { id: 'inventory-list-title', text: 'Przedmioty' })
    ]));

    const groups = createEl('div', { className: 'inventory-groups' });
    const grouped = groupInventoryEntries();
    if (!grouped.length) groups.append(createEl('p', { className: 'muted small', text: 'Brak przedmiotów.' }));
    for (const group of grouped) groups.append(renderInventoryGroup(group));
    listCard.append(groups);
    root.append(listCard);
  };

  globalThis.CairnRuntime.registerRenderer('inventory', renderConsolidatedInventoryView);
})();
