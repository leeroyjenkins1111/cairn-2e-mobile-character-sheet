'use strict';

(() => {
  if (typeof globalThis.CairnInventoryDomain?.createInventoryOverviewModel !== 'function') {
    throw new Error('CairnInventoryDomain must be loaded before inventory-view.js.');
  }

  function inventoryStatButton(statKey, value, label, onClick, ariaLabel) {
    return createEl('button', {
      type: 'button',
      className: 'inventory-summary-stat inventory-summary-stat-button',
      dataset: { inventoryStat: statKey },
      attrs: { 'aria-label': ariaLabel },
      onclick: onClick
    }, [
      createEl('strong', { text: value }),
      createEl('span', { text: label })
    ]);
  }

  function inventoryGroupCountLabel(group) {
    const count = Math.max(0, Number(group.count) || 0);
    if (group.id === 'fatigue') {
      const noun = count === 1 ? 'wpis' : count >= 2 && count <= 4 ? 'wpisy' : 'wpisów';
      return `${count} ${noun}`;
    }
    const noun = count === 1 ? 'przedmiot' : count >= 2 && count <= 4 ? 'przedmioty' : 'przedmiotów';
    return `${count} ${noun}`;
  }

  function renderInventoryItemRow(item) {
    const spent = item.carryState === 'spent';
    const carryLabel = CARRY_STATES[item.carryState] || 'inny stan';
    const facts = [
      formatSlotLabel(item.slots),
      item.damageFormula ? formatDamageFormula(item.damageFormula) : '',
      item.armorValue ? `pancerz +${item.armorValue}` : '',
      item.uses.current !== null || item.uses.max !== null ? `użycia ${formatUses(item.uses)}` : '',
      ...safeArray(item.traits).slice(0, 2)
    ].filter(Boolean).slice(0, 4);

    const row = createEl('article', {
      className: `inventory-item inventory-row${spent ? ' inventory-row-spent' : ''}`,
      dataset: { itemId: item.id, carryState: item.carryState }
    });

    const main = createEl('button', {
      type: 'button',
      className: 'inventory-row-main',
      attrs: { 'aria-label': `Szczegóły przedmiotu: ${item.name}. ${facts.join(', ')}. ${carryLabel}.` },
      onclick: () => openItemActionsSheet(item.id)
    }, [
      createEl('span', { className: 'inventory-row-title' }, [
        createEl('strong', { text: item.name })
      ]),
      createEl('span', { className: 'inventory-row-facts' }, facts.map(fact => createEl('span', { text: fact }))),
      item.uses.current === 0 ? createEl('span', { className: 'item-warning', text: 'Brak użyć · otwórz szczegóły' }) : null
    ]);

    let trailing = null;
    if (!spent && item.carryState === 'held' && item.damageFormula) {
      trailing = button(formatDamageFormula(item.damageFormula), () => runItemAttack(item), 'btn btn-quiet inventory-trailing-action', {
        'aria-label': `Rzuć obrażenia: ${item.name}`
      });
    } else if (!spent && item.uses.current !== null) {
      trailing = button('Użyj', () => openUseItemSheet(item.id), 'btn btn-quiet inventory-trailing-action', {
        disabled: item.uses.current <= 0,
        'aria-label': `Użyj ${item.name}`
      });
    }

    row.append(main);
    if (trailing) row.append(trailing);
    return row;
  }

  function renderInventoryGroupSection(group) {
    const details = createEl('details', {
      className: 'inventory-group',
      dataset: { inventoryGroup: group.id },
      attrs: group.defaultOpen ? { open: true } : {}
    });

    details.append(createEl('summary', {
      attrs: { 'aria-label': `${group.label}: ${inventoryGroupCountLabel(group)}, ${formatSlotLabel(group.slots)}` }
    }, [
      createEl('span', { className: 'inventory-group-title' }, [
        createEl('strong', { text: group.label })
      ])
    ]));

    const list = createEl('div', { className: 'inventory-group-list' });
    for (const entry of group.entries) {
      list.append(entry.kind === 'fatigue' ? renderFatigueCard(entry.entry) : renderInventoryItemRow(entry.entry));
    }
    details.append(list);
    return details;
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
    const overviewModel = globalThis.CairnInventoryDomain.createInventoryOverviewModel({
      usage,
      armor,
      gold: state.stats.gold
    });
    const overview = createEl('section', {
      className: 'inventory-overview',
      attrs: { 'aria-label': 'Stan ekwipunku' }
    });

    overview.append(createEl('div', { className: 'inventory-summary-head' }, [
      createEl('div', {}, [
        createEl('strong', { className: 'inventory-summary-title', text: overviewModel.capacityLabel }),
        createEl('span', { className: 'section-caption', text: overviewModel.capacityCaption })
      ]),
      createEl('div', { className: 'inventory-summary-actions' }, [
        createEl('button', {
          type: 'button',
          className: 'btn btn-primary inventory-add-item-button',
          attrs: { 'aria-label': 'Dodaj przedmiot do ekwipunku', title: 'Dodaj przedmiot' },
          onclick: () => openItemSheet()
        }, [uiIcon('plus'), createEl('span', { className: 'sr-only', text: 'Dodaj przedmiot' })])
      ])
    ]));

    overview.append(createEl('div', { className: 'inventory-summary-stats' }, [
      inventoryStatButton('fatigue', overviewModel.stats.fatigue.value, overviewModel.stats.fatigue.label, openAddFatigueSheet, `Zmęczenie: ${overviewModel.stats.fatigue.value}. Dodaj zmęczenie.`),
      inventoryStatButton('armor', overviewModel.stats.armor.value, overviewModel.stats.armor.label, openArmorSheet, `Pancerz: ${overviewModel.stats.armor.value}. Otwórz ustawienia pancerza.`),
      inventoryStatButton('gold', overviewModel.stats.gold.value, overviewModel.stats.gold.label, openGoldSheet, `Złoto: ${overviewModel.stats.gold.value}. Zmień ilość złota.`)
    ]));
    overview.append(renderSlotMeter(usage));
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
    for (const group of grouped) groups.append(renderInventoryGroupSection(group));
    listCard.append(groups);
    root.append(listCard);
  }

  globalThis.CairnRuntime.registerRenderer('inventory', renderConsolidatedInventoryView);
})();
