from __future__ import annotations

from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return updated


index_path = ROOT / "index.html"
html = index_path.read_text(encoding="utf-8")
html = replace_once(html, "const APP_VERSION = '0.8.0';", "const APP_VERSION = '0.9.0';", "app version")

inventory_css = r'''

    /* Grouped inventory v0.9.0 — compact scan-first rows with 44px actions. */
    .inventory-groups { display: grid; gap: 8px; }
    .inventory-group {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: color-mix(in srgb, var(--surface) 84%, transparent);
      overflow: clip;
    }
    .inventory-group > summary {
      min-height: 48px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      cursor: pointer;
      list-style: none;
      user-select: none;
    }
    .inventory-group > summary::-webkit-details-marker { display: none; }
    .inventory-group > summary::after {
      content: '⌄';
      color: var(--muted);
      font-size: 1rem;
      line-height: 1;
      transform: rotate(-90deg);
      transition: transform 140ms ease;
    }
    .inventory-group[open] > summary::after { transform: rotate(0); }
    .inventory-group-title { min-width: 0; display: grid; gap: 2px; }
    .inventory-group-title strong { font-size: 0.92rem; }
    .inventory-group-title span { color: var(--muted); font-size: 0.67rem; font-weight: 700; }
    .inventory-group-list { padding: 0 10px 4px; border-top: 1px solid var(--line); }
    .inventory-group-empty { margin: 0; padding: 12px 0; }

    .inventory-item.inventory-row {
      padding: 9px 0;
      border-top: 1px solid var(--line);
    }
    .inventory-group-list > .inventory-row:first-child { border-top: 0; }
    .inventory-row-main { min-width: 0; display: grid; gap: 6px; }
    .inventory-row-title {
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      gap: 8px;
    }
    .inventory-row-title h3 {
      min-width: 0;
      margin: 0;
      font-size: 0.92rem;
      line-height: 1.15;
      overflow-wrap: anywhere;
    }
    .inventory-row-tags { min-width: 0; display: flex; flex-wrap: wrap; gap: 4px; }
    .inventory-row-tags .tag { min-height: 22px; padding: 2px 6px; font-size: 0.62rem; }
    .inventory-row-actions {
      min-width: 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }
    .inventory-row-actions .btn { min-width: 0; min-height: 44px; padding: 6px 8px; font-size: 0.74rem; }
    .inventory-row-actions .inventory-details-button { width: 44px; justify-self: end; padding: 0; }
    .inventory-row-actions.actions-3 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 44px; }
    .inventory-row-actions.actions-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .inventory-carry-button { color: var(--green-strong); }
    .inventory-row-spent { opacity: 0.78; }
    .inventory-row-spent .inventory-row-tags { filter: saturate(0.7); }
    .inventory-row-note { margin: 0; color: var(--muted); font-size: 0.7rem; line-height: 1.3; }
    .inventory-detail-copy { display: grid; gap: 8px; }
    .inventory-detail-copy p { margin: 0; }
    .inventory-detail-tags { display: flex; flex-wrap: wrap; gap: 5px; }
    .inventory-detail-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
    .inventory-detail-actions .btn { min-width: 0; }
    .inventory-secondary-actions > summary {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      font-weight: 800;
      list-style: none;
    }
    .inventory-secondary-actions > summary::-webkit-details-marker { display: none; }
    .inventory-secondary-actions > summary::after { content: '＋'; color: var(--muted); }
    .inventory-secondary-actions[open] > summary::after { content: '−'; }
    .inventory-secondary-actions .sheet-list { padding-top: 7px; }
    .quick-carry-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }

    @media (max-width: 350px) {
      .inventory-group > summary { padding-left: 8px; padding-right: 8px; }
      .inventory-group-list { padding-left: 8px; padding-right: 8px; }
      .inventory-row-actions.actions-3,
      .inventory-row-actions.actions-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .inventory-row-actions .inventory-details-button { width: 100%; justify-self: stretch; }
      .inventory-detail-actions { grid-template-columns: 1fr; }
    }
'''
html = replace_once(html, "\n  </style>", inventory_css + "\n  </style>", "inventory CSS insertion")

inventory_js = r'''  const INVENTORY_GROUP_DEFS = [
    { id: 'held', label: 'Trzymane', defaultOpen: true },
    { id: 'worn', label: 'Noszone', defaultOpen: true },
    { id: 'stored', label: 'Schowane', defaultOpen: true },
    { id: 'fatigue', label: 'Zmęczenie', defaultOpen: true },
    { id: 'spent', label: 'Zużyte', defaultOpen: false },
    { id: 'other', label: 'Inne', defaultOpen: true }
  ];

  function inventoryGroupKey(item) {
    return Object.prototype.hasOwnProperty.call(CARRY_STATES, item?.carryState) ? item.carryState : 'other';
  }

  function groupInventoryEntries(sourceState = state) {
    const items = safeArray(sourceState?.inventory?.items);
    const fatigue = safeArray(sourceState?.inventory?.fatigue);
    return INVENTORY_GROUP_DEFS.map(definition => {
      const entries = definition.id === 'fatigue'
        ? fatigue.map(entry => ({ kind: 'fatigue', entry }))
        : items.filter(item => inventoryGroupKey(item) === definition.id).map(entry => ({ kind: 'item', entry }));
      const slots = entries.reduce((sum, entry) => sum + (entry.kind === 'fatigue' ? 1 : clamp(toInt(entry.entry.slots, 1), 0, 10)), 0);
      return { ...definition, entries, count: entries.length, slots };
    }).filter(group => group.count > 0);
  }

  function moveItemWithinGroup(targetState, itemId, direction) {
    const items = safeArray(targetState?.inventory?.items);
    const currentIndex = items.findIndex(item => item.id === itemId);
    if (currentIndex < 0) return false;
    const groupKey = inventoryGroupKey(items[currentIndex]);
    const groupIndices = items.map((item, index) => inventoryGroupKey(item) === groupKey ? index : -1).filter(index => index >= 0);
    const groupPosition = groupIndices.indexOf(currentIndex);
    const targetPosition = groupPosition + direction;
    if (groupPosition < 0 || targetPosition < 0 || targetPosition >= groupIndices.length) return false;
    const targetIndex = groupIndices[targetPosition];
    [items[currentIndex], items[targetIndex]] = [items[targetIndex], items[currentIndex]];
    return true;
  }

  function formatSlotLabel(slots) {
    const value = clamp(toInt(slots, 1), 0, 10);
    return `${value} ${value === 1 ? 'miejsce' : 'miejsca'}`;
  }

  function renderInventoryGroup(group) {
    const details = createEl('details', {
      className: 'inventory-group',
      dataset: { inventoryGroup: group.id },
      attrs: group.defaultOpen ? { open: true } : {}
    });
    details.append(createEl('summary', {}, [
      createEl('span', { className: 'inventory-group-title' }, [
        createEl('strong', { text: group.label }),
        createEl('span', { text: `${group.count} ${group.count === 1 ? 'wpis' : 'wpisów'} · ${formatSlotLabel(group.slots)}` })
      ])
    ]));
    const list = createEl('div', { className: 'inventory-group-list' });
    for (const entry of group.entries) {
      list.append(entry.kind === 'fatigue' ? renderFatigueCard(entry.entry) : renderItemCard(entry.entry));
    }
    details.append(list);
    return details;
  }

  function renderInventoryView() {
    const root = $('#view-inventory');
    if (!root) return;
    root.replaceChildren();
    if (!state.initialized) {
      root.append(card([createEl('div', { className: 'card-pad' }, [sectionHead('Ekwipunek'), createEl('p', { className: 'muted', text: 'Najpierw utwórz lub zaimportuj postać.' })])]))
      return;
    }
    const usage = calculateInventoryUsage();
    const armor = deriveArmor();
    const overview = card([], 'inventory-summary');
    overview.append(createEl('div', { className: 'inventory-summary-head' }, [
      createEl('div', {}, [
        createEl('p', { className: 'eyebrow', text: 'Wyposażenie' }),
        createEl('h1', { className: 'inventory-summary-title', text: 'Ekwipunek' })
      ]),
      createEl('div', { className: 'inventory-summary-actions' }, [
        button(`Złoto: ${state.stats.gold}`, openGoldSheet, 'btn btn-quiet gold-button', { 'aria-label': `Złoto: ${state.stats.gold}. Otwórz szybką korektę.` }),
        iconButton('Dodaj przedmiot', 'plus', () => openItemSheet(), 'btn btn-icon btn-primary')
      ])
    ]));
    overview.append(createEl('div', { className: 'inventory-summary-stats' }, [
      createEl('div', { className: 'inventory-summary-stat', dataset: { inventoryStat: 'slots' } }, [createEl('strong', { text: `${usage.total}/10` }), createEl('span', { text: `${usage.fatigueSlots} zmęczenia` })]),
      createEl('div', { className: 'inventory-summary-stat', dataset: { inventoryStat: 'armor' } }, [createEl('strong', { text: armor.effective }), createEl('span', { text: 'pancerz' })])
    ]));
    overview.append(renderSlotMeter(usage));
    overview.append(createEl('p', { className: 'inventory-legend', text: 'Drobiazg 0 · zwykły 1 · nieporęczny 2 · zmęczenie 1' }));
    overview.append(createEl('div', { className: 'inventory-tools inventory-tools-focused' }, [
      createEl('button', { type: 'button', className: 'btn inventory-tool', onclick: openAddFatigueSheet }, [uiIcon('fatigue'), createEl('span', { text: 'Dodaj zmęczenie' })]),
      createEl('button', { type: 'button', className: 'btn inventory-tool', onclick: openArmorSheet }, [uiIcon('armor'), createEl('span', { text: 'Ustaw pancerz' })])
    ]));
    root.append(overview);

    const listCard = card([], 'card-pad card-flat');
    listCard.append(sectionHead('Przedmioty', createEl('span', { className: 'muted micro', text: `${state.inventory.items.length + state.inventory.fatigue.length} wpisów` })));
    const groups = createEl('div', { className: 'inventory-groups' });
    const grouped = groupInventoryEntries();
    if (!grouped.length) groups.append(createEl('p', { className: 'muted small', text: 'Brak przedmiotów.' }));
    for (const group of grouped) groups.append(renderInventoryGroup(group));
    listCard.append(groups);
    root.append(listCard);
  }

  function getItemPrimaryActionKinds(item) {
    const kinds = [];
    if (item.carryState === 'spent') return ['more'];
    if (item.damageFormula?.blast) kinds.push('blast');
    else if (item.damageFormula) kinds.push('roll');
    if (item.uses.current !== null) kinds.push('use');
    kinds.push('more');
    return kinds;
  }

  function renderItemCard(item) {
    const spent = item.carryState === 'spent';
    const wrap = createEl('article', {
      className: `inventory-item inventory-row${spent ? ' inventory-row-spent' : ''}`,
      dataset: { itemId: item.id }
    });
    const row = createEl('div', { className: 'inventory-row-main' });
    row.append(createEl('div', { className: 'inventory-row-title' }, [
      createEl('h3', { text: item.name }),
      createEl('span', { className: 'tag item-slot', text: formatSlotLabel(item.slots) })
    ]));

    const tags = createEl('div', { className: 'inventory-row-tags' });
    if (item.damageFormula) tags.append(createEl('span', { className: 'tag', text: formatDamageFormula(item.damageFormula) }));
    if (item.damageFormula?.blast) tags.append(createEl('span', { className: 'tag', text: 'podmuch' }));
    if (item.armorValue) tags.append(createEl('span', { className: 'tag', text: `pancerz +${item.armorValue}` }));
    if (item.uses.current !== null || item.uses.max !== null) tags.append(createEl('span', { className: 'tag', text: `użycia ${formatUses(item.uses)}` }));
    for (const trait of safeArray(item.traits).slice(0, 2)) tags.append(createEl('span', { className: 'tag', text: trait }));
    if (tags.childElementCount) row.append(tags);

    const actions = [];
    if (!spent && item.damageFormula?.blast) actions.push(button(`Podmuch ${formatDamageFormula(item.damageFormula)}`, () => runItemAttack(item), 'btn btn-quiet', { 'aria-label': `Rzuć obrażenia podmuchu: ${item.name}` }));
    else if (!spent && item.damageFormula) actions.push(button(`Rzuć ${formatDamageFormula(item.damageFormula)}`, () => runItemAttack(item), 'btn btn-quiet', { 'aria-label': `Rzuć obrażenia: ${item.name}` }));
    if (!spent && item.uses.current !== null) actions.push(button('Użyj', () => openUseItemSheet(item.id), 'btn btn-primary', { disabled: item.uses.current <= 0, 'aria-label': `Użyj ${item.name}` }));
    const carryLabel = CARRY_STATES[item.carryState] || 'inny stan';
    actions.push(button(carryLabel, () => openQuickCarrySheet(item.id), 'btn btn-quiet inventory-carry-button', { 'aria-label': `Zmień sposób noszenia: ${item.name}. Aktualnie ${carryLabel}.` }));
    actions.push(iconButton(`Szczegóły przedmiotu ${item.name}`, 'more', () => openItemActionsSheet(item.id), 'btn btn-icon btn-ghost inventory-details-button'));
    row.append(createEl('div', { className: `inventory-row-actions actions-${actions.length}` }, actions));
    if (item.uses.current === 0) row.append(createEl('p', { className: 'item-warning', text: 'Brak użyć. Przywrócenie jest dostępne w szczegółach.' }));
    wrap.append(row);
    return wrap;
  }

  function openQuickCarrySheet(itemId) {
    const item = state.inventory.items.find(entry => entry.id === itemId);
    if (!item) return;
    const options = [
      ['held', 'Trzymane'],
      ['worn', 'Noszone'],
      ['stored', 'Schowane'],
      ['spent', 'Zużyte']
    ];
    const body = createEl('div', { className: 'quick-carry-grid' });
    for (const [value, label] of options) {
      body.append(button(label, () => {
        if (value === item.carryState) { closeSheet(); return; }
        const before = CARRY_STATES[item.carryState] || item.carryState;
        const after = CARRY_STATES[value] || value;
        closeSheet();
        commitChange(`Zmieniono sposób noszenia: ${item.name} (${before} → ${after})`, next => {
          const target = next.inventory.items.find(entry => entry.id === itemId);
          if (target) target.carryState = value;
        });
      }, value === item.carryState ? 'btn btn-primary' : 'btn'));
    }
    openSheet({
      title: 'Sposób noszenia',
      body: createEl('div', { className: 'form-grid' }, [
        createEl('p', { text: `Wybierz stan dla „${item.name}”. Pancerz automatyczny uwzględnia tylko przedmioty trzymane i noszone.` }),
        body
      ])
    });
  }

  function openItemActionsSheet(itemId) {
    const item = state.inventory.items.find(entry => entry.id === itemId);
    if (!item) return;
    const groupKey = inventoryGroupKey(item);
    const groupItems = state.inventory.items.filter(entry => inventoryGroupKey(entry) === groupKey);
    const groupPosition = groupItems.findIndex(entry => entry.id === itemId);
    const body = createEl('div', { className: 'form-grid' });
    const copy = createEl('div', { className: 'report-block inventory-detail-copy' }, [
      createEl('h3', { text: item.name }),
      createEl('p', { className: 'muted small', text: `${formatSlotLabel(item.slots)} · ${CARRY_STATES[item.carryState] || item.carryState}` }),
      item.description ? createEl('p', { text: item.description }) : createEl('p', { className: 'muted small', text: 'Brak opisu.' }),
      item.notes ? createEl('p', { className: 'inventory-row-note', text: `Notatki: ${item.notes}` }) : null
    ]);
    const tags = createEl('div', { className: 'inventory-detail-tags' });
    if (item.category) tags.append(createEl('span', { className: 'tag', text: item.category }));
    if (item.damageFormula) tags.append(createEl('span', { className: 'tag', text: formatDamageFormula(item.damageFormula) }));
    if (item.damageFormula?.blast) tags.append(createEl('span', { className: 'tag', text: 'podmuch' }));
    if (item.armorValue) tags.append(createEl('span', { className: 'tag', text: `pancerz +${item.armorValue}` }));
    if (item.uses.current !== null || item.uses.max !== null) tags.append(createEl('span', { className: 'tag', text: `użycia ${formatUses(item.uses)}` }));
    for (const trait of safeArray(item.traits)) tags.append(createEl('span', { className: 'tag', text: trait }));
    if (tags.childElementCount) copy.append(tags);
    body.append(copy);

    const primary = createEl('div', { className: 'inventory-detail-actions' });
    if (item.carryState !== 'spent' && item.damageFormula) primary.append(button(item.damageFormula.blast ? 'Rzuć podmuch' : 'Rzuć obrażenia', () => { closeSheet(); runItemAttack(item); }, 'btn'));
    if (item.carryState !== 'spent' && item.uses.current !== null) primary.append(button('Użyj', () => { closeSheet(); openUseItemSheet(itemId); }, 'btn btn-primary', { disabled: item.uses.current <= 0 }));
    primary.append(
      button('Zmień stan', () => { closeSheet(); openQuickCarrySheet(itemId); }, 'btn'),
      button('Edytuj', () => { closeSheet(); openItemSheet(itemId); }, 'btn')
    );
    if (item.uses.current !== null) primary.append(button('Przywróć 1 użycie', () => { closeSheet(); openRestoreItemUseSheet(itemId); }, 'btn btn-ghost', { disabled: item.uses.max !== null && item.uses.current >= item.uses.max }));
    primary.append(button(item.carryState === 'spent' ? 'Przywróć przedmiot' : 'Oznacz jako zużyty', () => { closeSheet(); toggleItemSpent(itemId); }, 'btn btn-ghost'));
    body.append(primary);

    const secondary = createEl('details', { className: 'inventory-secondary-actions' });
    secondary.append(createEl('summary', { text: 'Dalsze operacje' }));
    secondary.append(createEl('div', { className: 'sheet-list' }, [
      button('Przesuń wyżej w grupie', () => { closeSheet(); moveItem(itemId, -1); }, 'btn btn-ghost', { disabled: groupPosition <= 0 }),
      button('Przesuń niżej w grupie', () => { closeSheet(); moveItem(itemId, 1); }, 'btn btn-ghost', { disabled: groupPosition < 0 || groupPosition >= groupItems.length - 1 }),
      button('Duplikuj', () => { closeSheet(); duplicateItem(itemId); }, 'btn btn-ghost'),
      button('Usuń', () => { closeSheet(); confirmDeleteItem(itemId); }, 'btn btn-danger')
    ]));
    body.append(secondary);
    openSheet({ title: 'Szczegóły przedmiotu', body });
  }

  function renderFatigueCard(fatigue) {
    const wrap = createEl('article', { className: 'inventory-item inventory-row', dataset: { fatigueId: fatigue.id } });
    const row = createEl('div', { className: 'inventory-row-main' }, [
      createEl('div', { className: 'inventory-row-title' }, [
        createEl('h3', { text: 'Zmęczenie' }),
        createEl('span', { className: 'tag item-slot', text: '1 miejsce' })
      ]),
      createEl('p', { className: 'inventory-row-note', text: fatigue.note || 'Zajmuje miejsce do czasu odpowiedniej regeneracji.' }),
      button('Usuń po regeneracji', () => openRemoveFatigueSheet(fatigue.id), 'btn btn-quiet btn-block', { 'aria-label': 'Usuń jedno zmęczenie po regeneracji' })
    ]);
    wrap.append(row);
    return wrap;
  }

  function openItemSheet(itemId = null) {'''
html = regex_once(
    html,
    r"  function renderInventoryView\(\) \{.*?\n  function openItemSheet\(itemId = null\) \{",
    inventory_js,
    "inventory view block",
)

move_item_js = r'''  function moveItem(itemId, direction) {
    const current = state.inventory.items.find(item => item.id === itemId);
    if (!current) return;
    const moved = moveItemWithinGroup(deepClone(state), itemId, direction);
    if (!moved) { showToast('Nie można przesunąć dalej w tej grupie.'); return; }
    commitChange('Zmieniono kolejność ekwipunku w grupie', next => { moveItemWithinGroup(next, itemId, direction); }, { silent: true });
  }'''
html = regex_once(
    html,
    r"  function moveItem\(itemId, direction\) \{.*?\n  \}",
    move_item_js,
    "move item function",
)

old_test_69 = "    test('69. Skróty sytuacji w walce są pełnymi zdaniami', () => { const definitions = combatScenarioDefinitions(); assert(definitions.find(entry => entry.id === 'blast').description === 'Osobny rzut dla każdego celu.' && definitions.find(entry => entry.id === 'dual').description === 'Rzuć obiema. Zachowaj wyższą.' && definitions.find(entry => entry.id === 'multiple').description === 'Rzuć wszystkie. Zachowaj najwyższą.'); });"
new_tests = old_test_69 + r'''
    test('70. Grupowanie ekwipunku zachowuje ustaloną kolejność sekcji', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'held', carryState:'held' }), makeItem({ id:'worn', carryState:'worn' }), makeItem({ id:'stored', carryState:'stored' }), makeItem({ id:'spent', carryState:'spent' }), makeItem({ id:'other', carryState:'legacy' })]; fixture.inventory.fatigue = [makeFatigue({ id:'fatigue' })]; assert(groupInventoryEntries(fixture).map(group => group.id).join(',') === 'held,worn,stored,fatigue,spent,other'); });
    test('71. Nieznany sposób noszenia trafia do grupy Inne', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'legacy', carryState:'legacy-state' })]; const group = groupInventoryEntries(fixture)[0]; assert(group.id === 'other' && group.entries[0].entry.id === 'legacy'); });
    test('72. Grupowanie nie mutuje danych postaci', () => { const fixture = createDemoState(); const before = JSON.stringify(fixture); groupInventoryEntries(fixture); assert(JSON.stringify(fixture) === before); });
    test('73. Nagłówki grup sumują zajmowane miejsca', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'a', slots:0, carryState:'held' }), makeItem({ id:'b', slots:2, carryState:'held' })]; fixture.inventory.fatigue = [makeFatigue({ id:'f' })]; const groups = groupInventoryEntries(fixture); assert(groups.find(group => group.id === 'held').slots === 2 && groups.find(group => group.id === 'fatigue').slots === 1); });
    test('74. Przesuwanie działa wyłącznie wewnątrz grupy', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'held-a', carryState:'held' }), makeItem({ id:'stored', carryState:'stored' }), makeItem({ id:'held-b', carryState:'held' })]; assert(moveItemWithinGroup(fixture, 'held-b', -1)); assert(fixture.inventory.items.map(item => item.id).join(',') === 'held-b,stored,held-a'); assert(!moveItemWithinGroup(fixture, 'stored', -1)); });
    test('75. Zmiana sposobu noszenia aktualizuje automatyczny pancerz', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'armor', armorValue:1, carryState:'worn' })]; assert(deriveArmor(fixture).effective === 1); fixture.inventory.items[0].carryState = 'stored'; assert(deriveArmor(fixture).effective === 0); });
    test('76. Pełna kopia zachowuje wszystkie dane kompaktowego wiersza', () => { const fixture = createDefaultState(); fixture.initialized = true; fixture.inventory.items = [makeItem({ id:'detail', name:'Detal', description:'Opis', notes:'Notatka', slots:2, category:'broń', damageFormula:parseDamageFormulaNotation('d8+d8', true), armorValue:1, uses:{current:2,max:4}, carryState:'held', traits:['nieporęczny','rzadki'] })]; const parsed = parseImportText(JSON.stringify(buildBackupPayload(fixture))); const item = parsed.candidate?.inventory.items[0]; assert(item?.description === 'Opis' && item.notes === 'Notatka' && item.slots === 2 && item.damageFormula.blast && item.uses.current === 2 && item.traits.length === 2); });'''
html = replace_once(html, old_test_69, new_tests, "developer inventory tests")

html = replace_once(
    html,
    "      sessionPromptFor,\n      createDemoState",
    "      sessionPromptFor,\n      groupInventoryEntries,\n      moveItemWithinGroup,\n      deriveArmor,\n      createDemoState",
    "developer exports",
)
index_path.write_text(html, encoding="utf-8")

# Playwright regression coverage.
tests_path = ROOT / "tests" / "app.spec.mjs"
tests = tests_path.read_text(encoding="utf-8")
tests = tests.replace("data-passed', '69'", "data-passed', '76'")
tests = tests.replace("data-total', '69'", "data-total', '76'")
if "grouped inventory presents demo equipment by carry state" in tests:
    raise RuntimeError("grouped inventory Playwright tests already present")
tests += r'''

test('grouped inventory presents demo equipment by carry state', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const held = page.locator('details[data-inventory-group="held"]');
  const worn = page.locator('details[data-inventory-group="worn"]');
  const stored = page.locator('details[data-inventory-group="stored"]');
  await expect(held.getByText('Krótki łuk')).toBeVisible();
  await expect(worn.getByText('Skórzany kaftan')).toBeVisible();
  await expect(stored.getByText('Pochodnia')).toBeVisible();
  await expect(stored.getByText('Suszone racje')).toBeVisible();
  await expect(stored.getByText('Mosiężny gwizdek')).toBeVisible();
});

test('quick carry change updates automatic armor', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const leather = page.locator('[data-item-id]').filter({ hasText: 'Skórzany kaftan' });
  await leather.getByRole('button', { name: /Zmień sposób noszenia: Skórzany kaftan/ }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Schowane', exact: true }).click();
  const result = await page.evaluate(() => {
    const dev = globalThis.CairnSheetDev;
    const snapshot = dev.getState();
    return {
      carryState: snapshot.inventory.items.find(item => item.name === 'Skórzany kaftan')?.carryState,
      armor: dev.deriveArmor(snapshot).effective
    };
  });
  expect(result).toEqual({ carryState: 'stored', armor: 0 });
  await expect(page.locator('details[data-inventory-group="stored"]').getByText('Skórzany kaftan')).toBeVisible();
});

test('inventory quick use and detail sheet preserve session workflows', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const torch = page.locator('[data-item-id]').filter({ hasText: 'Pochodnia' });
  await torch.getByRole('button', { name: 'Użyj Pochodnia' }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Użyj i zmniejsz o 1' }).click();
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().inventory.items.find(item => item.name === 'Pochodnia')?.uses.current)).toBe(1);

  const bow = page.locator('[data-item-id]').filter({ hasText: 'Krótki łuk' });
  await bow.getByRole('button', { name: 'Szczegóły przedmiotu Krótki łuk' }).click();
  await expect(page.locator('#sheet').getByRole('heading', { name: 'Szczegóły przedmiotu' })).toBeVisible();
  await expect(page.locator('#sheet').getByText('Lekki łuk myśliwski.')).toBeVisible();
});

test('spent inventory is grouped and hides primary use actions', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const torch = page.locator('[data-item-id]').filter({ hasText: 'Pochodnia' });
  await torch.getByRole('button', { name: /Zmień sposób noszenia: Pochodnia/ }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Zużyte', exact: true }).click();
  const spent = page.locator('details[data-inventory-group="spent"]');
  await expect(spent).toBeVisible();
  expect(await spent.evaluate(element => element.open)).toBe(false);
  await spent.locator('summary').click();
  await expect(spent.getByText('Pochodnia')).toBeVisible();
  await expect(spent.getByRole('button', { name: 'Użyj Pochodnia' })).toHaveCount(0);
});
'''
tests_path.write_text(tests, encoding="utf-8")

# Product-facing documentation and release identifiers.
readme_path = ROOT / "README.md"
readme = readme_path.read_text(encoding="utf-8")
readme = replace_once(
    readme,
    "- ekwipunek, zmęczenie, drobiazgi, przedmioty nieporęczne i użycia;",
    "- kompaktowy, grupowany ekwipunek według sposobu noszenia, ze zmęczeniem, drobiazgami, przedmiotami nieporęcznymi i użyciami;",
    "README inventory bullet",
)
readme = replace_once(
    readme,
    "Wersja 0.8.0 zachowuje bezpieczny format kopii z 0.7.0 i potrafi również odtworzyć starsze pliki `cairn-*-eksport.json` wygenerowane przez wersję 0.6.0.",
    "Wersja 0.9.0 zachowuje `schemaVersion: 2`, bezpieczny format kopii z 0.7.0–0.8.0 i potrafi również odtworzyć starsze pliki `cairn-*-eksport.json` wygenerowane przez wersję 0.6.0.",
    "README version note",
)
readme_path.write_text(readme, encoding="utf-8")

package_path = ROOT / "package.json"
package = package_path.read_text(encoding="utf-8")
package = replace_once(package, '"version": "0.8.0"', '"version": "0.9.0"', "package version")
package_path.write_text(package, encoding="utf-8")

lock_path = ROOT / "package-lock.json"
lock = lock_path.read_text(encoding="utf-8")
if lock.count('"version": "0.8.0"') != 2:
    raise RuntimeError("package-lock version: expected two matches")
lock = lock.replace('"version": "0.8.0"', '"version": "0.9.0"')
lock_path.write_text(lock, encoding="utf-8")

worker_path = ROOT / "service-worker.js"
worker = worker_path.read_text(encoding="utf-8")
worker = replace_once(worker, "cairn-mobile-sheet-v0.8.0", "cairn-mobile-sheet-v0.9.0", "service worker cache")
worker_path.write_text(worker, encoding="utf-8")

# Rebuild deployment checksums after all published files have been updated.
checksum_files = ["index.html", "manifest.webmanifest", "service-worker.js", "icon.svg"]
checksum_lines = []
for filename in checksum_files:
    digest = hashlib.sha256((ROOT / filename).read_bytes()).hexdigest()
    checksum_lines.append(f"{digest}  {filename}")
(ROOT / "checksums.sha256").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")

print("Applied compact grouped inventory v0.9.0")
