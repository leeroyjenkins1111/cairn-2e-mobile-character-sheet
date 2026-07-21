from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one regex match, found {count}")
    return updated


app = read("scripts/app.js")
app = replace_once(app, "const APP_VERSION = '0.15.0';", "const APP_VERSION = '0.16.0';", "app version")

new_gameplay_helpers = r'''function openSavePickerSheet() {
  const body = createEl('div', { className: 'save-picker-grid' });
  for (const key of ['str', 'dex', 'wil']) {
    const attr = state.stats[key];
    body.append(button(`${ATTRS[key].label} ${attr.current}`, () => {
      closeSheet();
      requestAnimationFrame(() => performSave(key));
    }, 'btn save-picker-button', {
      'aria-label': `Rzut obronny ${ATTRS[key].full}, aktualna wartość ${attr.current}`
    }));
  }
  openSheet({
    title: 'Rzut obronny',
    body: createEl('div', { className: 'form-grid' }, [
      createEl('p', { className: 'muted small', text: 'Wybierz cechę wskazaną przez Wardena. Sukces wymaga wyniku 1k20 równego lub niższego od aktualnej wartości.' }),
      body
    ])
  });
}

function renderActiveWeaponShortcut() {
  const weapon = activeEquipmentItems().find(item => item.damageFormula && item.carryState !== 'spent');
  if (!weapon) return null;
  const notation = formatDamageFormula(weapon.damageFormula);
  return card([
    createEl('div', { className: 'gameplay-weapon-copy' }, [
      createEl('p', { className: 'eyebrow', text: 'Gotowe do użycia' }),
      createEl('strong', { text: weapon.name }),
      createEl('span', { text: `${notation}${weapon.damageFormula.blast ? ' · podmuch' : ''}` })
    ]),
    button(`Rzuć ${notation}`, () => runItemAttack(weapon), 'btn btn-primary gameplay-weapon-action', {
      'aria-label': `Rzuć obrażenia aktywną bronią: ${weapon.name}`
    })
  ], 'card-pad gameplay-weapon-card');
}

function renderCharacterView() {'''
app = sub_once(
    app,
    r"function renderSessionToolsCard\(\) \{.*?function renderCharacterView\(\) \{",
    new_gameplay_helpers,
    "replace duplicated session dashboard helpers",
)

app = replace_once(
    app,
    "  hero.append(protectionMeter);\n  root.append(hero);",
    """  hero.append(protectionMeter);
  hero.append(createEl('div', {
    className: 'character-attribute-line',
    attrs: { 'aria-label': `Aktualne cechy: SIŁ ${state.stats.str.current}, ZRE ${state.stats.dex.current}, WOL ${state.stats.wil.current}` }
  }, [
    createEl('span', { text: `SIŁ ${state.stats.str.current}` }),
    createEl('span', { text: `ZRE ${state.stats.dex.current}` }),
    createEl('span', { text: `WOL ${state.stats.wil.current}` })
  ]));
  root.append(hero);""",
    "compact attribute line",
)

new_gameplay_block = r'''  const gameActions = card([], 'card-pad gameplay-actions');
  gameActions.append(sectionHead('Akcje w grze', createEl('span', { className: 'muted micro', text: 'najczęstsze przy stole' })));
  gameActions.append(createEl('div', { className: 'gameplay-action-grid' }, [
    compactActionButton('Obrażenia', 'damage', openDamageSheet, true),
    compactActionButton('Rzut obronny', 'dice', openSavePickerSheet),
    compactActionButton('Odpoczynek', 'rest', openRestSheet),
    compactActionButton('Stany postaci', 'more', openConditionsSheet)
  ]));
  root.append(gameActions);

  const activeWeapon = renderActiveWeaponShortcut();
  if (activeWeapon) root.append(activeWeapon);

'''
app = sub_once(
    app,
    r"  root\.append\(renderSessionGlanceCard\(\)\);.*?  root\.append\(attrsCard\);\n\n",
    new_gameplay_block,
    "replace duplicated character dashboard cards",
)
app = replace_once(app, "\n  root.append(renderSessionToolsCard());", "", "remove duplicate session tools")

old_item_actions = r'''  const actions = [];
  if (!spent && item.damageFormula?.blast) actions.push(button(`Podmuch ${formatDamageFormula(item.damageFormula)}`, () => runItemAttack(item), 'btn btn-quiet', { 'aria-label': `Rzuć obrażenia podmuchu: ${item.name}` }));
  else if (!spent && item.damageFormula) actions.push(button(`Rzuć ${formatDamageFormula(item.damageFormula)}`, () => runItemAttack(item), 'btn btn-quiet', { 'aria-label': `Rzuć obrażenia: ${item.name}` }));
  if (!spent && item.uses.current !== null) actions.push(button('Użyj', () => openUseItemSheet(item.id), 'btn btn-primary', { disabled: item.uses.current <= 0, 'aria-label': `Użyj ${item.name}` }));
  const carryLabel = CARRY_STATES[item.carryState] || 'inny stan';
  actions.push(button(carryLabel, () => openQuickCarrySheet(item.id), 'btn btn-quiet inventory-carry-button', { 'aria-label': `Zmień sposób noszenia: ${item.name}. Aktualnie ${carryLabel}.` }));
  actions.push(iconButton(`Szczegóły przedmiotu ${item.name}`, 'more', () => openItemActionsSheet(item.id), 'btn btn-icon btn-ghost inventory-details-button'));
  row.append(createEl('div', { className: `inventory-row-actions actions-${actions.length}` }, actions));'''
new_item_actions = r'''  const actions = [];
  if (!spent && item.damageFormula?.blast) actions.push(button(`Podmuch ${formatDamageFormula(item.damageFormula)}`, () => runItemAttack(item), 'btn btn-quiet', { 'aria-label': `Rzuć obrażenia podmuchu: ${item.name}` }));
  else if (!spent && item.damageFormula) actions.push(button(`Rzuć ${formatDamageFormula(item.damageFormula)}`, () => runItemAttack(item), 'btn btn-quiet', { 'aria-label': `Rzuć obrażenia: ${item.name}` }));
  else if (!spent && item.uses.current !== null) actions.push(button('Użyj', () => openUseItemSheet(item.id), 'btn btn-primary', { disabled: item.uses.current <= 0, 'aria-label': `Użyj ${item.name}` }));
  const carryLabel = CARRY_STATES[item.carryState] || 'inny stan';
  actions.push(button(carryLabel, () => openQuickCarrySheet(item.id), 'btn btn-quiet inventory-carry-button', { 'aria-label': `Zmień sposób noszenia: ${item.name}. Aktualnie ${carryLabel}.` }));
  actions.push(iconButton(`Szczegóły przedmiotu ${item.name}`, 'more', () => openItemActionsSheet(item.id), 'btn btn-icon btn-ghost inventory-details-button'));
  row.append(createEl('div', { className: `inventory-row-actions actions-${actions.length}` }, actions));'''
app = replace_once(app, old_item_actions, new_item_actions, "single primary inventory action")

old_recent_dice = r'''  const recent = recentDiceEntries(state, 3);
  if (recent.length) {
    const strip = createEl('div', { className: 'dice-recent-strip', attrs: { 'aria-label': 'Trzy ostatnie rzuty' } });
    for (const entry of recent) {
      strip.append(createEl('div', { className: 'dice-recent-item' }, [
        createEl('span', { className: 'dice-recent-type', text: diceEntryTypeLabel(entry) }),
        createEl('span', { className: 'dice-recent-copy' }, [
          createEl('strong', { text: diceEntryResultText(entry) }),
          createEl('span', { text: entry.label || entry.notation || 'Rzut' })
        ])
      ]));
    }
    consoleCard.append(strip);
  }

'''
app = replace_once(app, old_recent_dice, "", "remove duplicate recent dice strip")

old_scenarios = r'''  const scenarios = card([], 'card-pad combat-scenarios combat-scenarios-compact');
  scenarios.append(createEl('div', { className: 'combat-scenarios-head' }, [
    createEl('h2', { text: 'Sytuacje w walce' }),
    createEl('p', { text: 'Helper wynika z fikcji lub decyzji Wardena.' })
  ]));
  scenarios.append(createEl('div', { className: 'scenario-grid' }, combatScenarioDefinitions().map(scenarioButton)));
  dashboard.append(scenarios);'''
new_scenarios = r'''  const scenarios = card([], 'card-pad combat-scenarios combat-scenarios-compact');
  const scenarioDisclosure = createEl('details', { className: 'combat-scenarios-disclosure' });
  scenarioDisclosure.append(createEl('summary', {}, [
    createEl('span', {}, [
      createEl('strong', { text: 'Procedury walki' }),
      createEl('small', { text: 'Bez broni, osłabienie, podmuch i wiele ataków' })
    ]),
    createEl('span', { text: 'Rozwiń', className: 'muted small' })
  ]));
  scenarioDisclosure.append(createEl('div', { className: 'combat-scenarios-body' }, [
    createEl('p', { className: 'muted small', text: 'Używaj tylko wtedy, gdy wynika to z fikcji lub decyzji Wardena.' }),
    createEl('div', { className: 'scenario-grid' }, combatScenarioDefinitions().map(scenarioButton))
  ]));
  scenarios.append(scenarioDisclosure);
  dashboard.append(scenarios);'''
app = replace_once(app, old_scenarios, new_scenarios, "collapse combat procedures")

app = replace_once(
    app,
    "  root.append(identity);\n  root.append(renderSessionLogCard());",
    """  root.append(identity);

  const characterData = card([], 'card-pad character-data-card');
  characterData.append(sectionHead('Karta postaci', createEl('span', { className: 'muted micro', text: 'rzadsze korekty' })));
  characterData.append(createEl('div', { className: 'character-data-actions' }, [
    button('Edytuj statystyki', openEditStatsSheet, 'btn'),
    button('Obrażenia atrybutu', openDirectDamageSheet, 'btn')
  ]));
  root.append(characterData);
  root.append(renderSessionLogCard());""",
    "move infrequent character tools to journal",
)

new_history_block = r'''  const historyCard = card([], 'card-pad');
  historyCard.append(sectionHead('Historia zmian', createEl('span', { className: 'muted small', text: `${safeArray(state.changeHistory).length} wpisów` })));

  const changeDetails = createEl('details', { className: 'history-disclosure' });
  changeDetails.append(createEl('summary', {}, [createEl('span', { text: 'Zmiany stanu postaci' }), createEl('span', { className: 'tag', text: safeArray(state.changeHistory).length })]));
  const changeContent = createEl('div', { className: 'history-disclosure-content' });
  changeContent.append(createEl('div', { className: 'button-row' }, [
    button('Cofnij ostatnią', undoLastChange, 'btn btn-quiet', { disabled: !safeArray(state.changeHistory).some(entry => entry.undoable) }),
    button('Wyczyść historię', confirmClearChangeHistory, 'btn btn-quiet btn-ghost', { disabled: !safeArray(state.changeHistory).length })
  ]));
  const changeList = createEl('div', { className: 'history-list' });
  const changeEntries = safeArray(state.changeHistory).slice().reverse();
  if (!changeEntries.length) changeList.append(createEl('p', { className: 'muted small', text: 'Historia jest jeszcze pusta.' }));
  for (const entry of changeEntries) changeList.append(createEl('div', { className: 'history-item' }, [createEl('p', { text: entry.description }), createEl('time', { text: formatDateTime(entry.time), dateTime: entry.time })]));
  changeContent.append(changeList);
  changeDetails.append(changeContent);
  historyCard.append(changeDetails);
  root.append(historyCard);'''
app = sub_once(
    app,
    r"  const historyCard = card\(\[\], 'card-pad'\);.*?  root\.append\(historyCard\);",
    new_history_block,
    "journal owns change history only",
)
app = app.replace("Aktywne stany są widoczne na ekranie Postaci.", "Aktywne stany są widoczne na ekranie głównym.")
write("scripts/app.js", app)

html = read("index.html")
html = replace_once(html, "Przejdź do treści karty", "Przejdź do głównego ekranu", "skip link label")
write("index.html", html)

css = read("styles/app.css")
css += r'''

/* Gameplay-first UX v0.16.0 — one place per task, less duplicated session chrome. */
.app-header {
  position: relative;
  top: auto;
  margin-top: 7px;
}
.main {
  padding-top: 9px;
  padding-bottom: calc(72px + env(safe-area-inset-bottom) + 18px);
}
.character-attribute-line {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 9px;
}
.character-attribute-line span {
  min-width: 0;
  padding: 6px 7px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-highlight) 64%, transparent);
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 800;
  text-align: center;
}
.gameplay-actions { display: grid; gap: 9px; }
.gameplay-action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.gameplay-action-grid .compact-action { min-height: 58px; }
.gameplay-weapon-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}
.gameplay-weapon-copy { min-width: 0; display: grid; gap: 2px; }
.gameplay-weapon-copy .eyebrow { margin: 0; }
.gameplay-weapon-copy strong,
.gameplay-weapon-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gameplay-weapon-copy strong { font-family: var(--font-display); font-size: 1rem; }
.gameplay-weapon-copy span { color: var(--muted); font-size: 0.7rem; }
.gameplay-weapon-action { min-width: 112px; }
.save-picker-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.save-picker-button { min-width: 0; min-height: 64px; }
.combat-scenarios-disclosure > summary {
  min-height: 52px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  list-style: none;
}
.combat-scenarios-disclosure > summary::-webkit-details-marker { display: none; }
.combat-scenarios-disclosure > summary > span:first-child { min-width: 0; display: grid; gap: 2px; }
.combat-scenarios-disclosure > summary strong { font-family: var(--font-display); font-size: 1rem; }
.combat-scenarios-disclosure > summary small { color: var(--muted); font-size: 0.67rem; overflow-wrap: anywhere; }
.combat-scenarios-body { display: grid; gap: 8px; padding-top: 8px; border-top: 1px solid var(--line); }
.combat-scenarios-body > p { margin: 0; }
.character-data-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.inventory-row-actions.actions-2 { grid-template-columns: minmax(0, 1fr) 44px; }
.inventory-row-actions.actions-3 { grid-template-columns: minmax(0, 1fr) minmax(0, 0.78fr) 44px; }
.bottom-nav {
  min-height: 0;
  bottom: max(6px, env(safe-area-inset-bottom));
  padding: 5px 6px;
}
.nav-btn { min-height: 50px; }

@media (max-width: 359px) {
  .gameplay-weapon-card { grid-template-columns: 1fr; }
  .gameplay-weapon-action { width: 100%; }
  .save-picker-grid { grid-template-columns: 1fr; }
  .character-data-actions { grid-template-columns: 1fr; }
  .bottom-nav { bottom: max(4px, env(safe-area-inset-bottom)); }
}

@media (prefers-reduced-motion: reduce) {
  .combat-scenarios-disclosure > summary { scroll-behavior: auto; }
}
'''
write("styles/app.css", css)

tests = read("tests/app.spec.mjs")
tests = replace_once(tests, "version: '0.15.0'", "version: '0.16.0'", "browser version expectation")
old_dice_test_pattern = r"test\('dice dashboard shows recent types and repeats the latest safe roll', async \(\{ page \}\) => \{.*?\n\}\);"
new_dice_test = r'''test('dice dashboard repeats the latest safe roll and owns its history', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k8' }).click();

  const first = await page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory[0]);
  expect(first.notation).toBe('1k8');
  await expect(page.locator('.dice-recent-strip')).toHaveCount(0);

  await page.getByRole('button', { name: 'Powtórz ostatni rzut: k8' }).click();
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory.length)).toBe(2);

  const repeated = await page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory.slice(0, 2));
  expect(repeated[0].notation).toBe('1k8');
  expect(repeated[0].repeat.kind).toBe('roll');
  expect(repeated[0].id).not.toBe(repeated[1].id);

  await page.locator('#diceResult').click();
  const history = page.locator('#sheet');
  await expect(history.getByRole('heading', { name: 'Historia rzutów' })).toBeVisible();
  await expect(history.getByRole('button', { name: 'Powtórz rzut: k8' })).toHaveCount(2);
});'''
tests = sub_once(tests, old_dice_test_pattern, new_dice_test, "replace recent dice browser test")
old_session_test_pattern = r"test\('session dashboard exposes table context and one-tap d20 flow', async \(\{ page \}\) => \{.*?\n\}\);"
new_session_test = r'''test('game view keeps current state and core table actions without duplicate summaries', async ({ page }) => {
  await loadDemo(page);
  await expect(page.getByRole('heading', { name: 'Przy stole' })).toHaveCount(0);
  await expect(page.getByText('Ostatni rzut', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Obrażenia', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rzut obronny', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Odpoczynek', exact: true })).toBeVisible();
  await expect(page.locator('.gameplay-weapon-card')).toContainText('Krótki łuk');

  await page.getByRole('button', { name: 'Rzut obronny', exact: true }).click();
  await expect(page.locator('#sheet').getByRole('heading', { name: 'Rzut obronny' })).toBeVisible();
  await expect(page.locator('#sheet').getByRole('button', { name: /Rzut obronny Siła/ })).toBeVisible();
  await page.getByRole('button', { name: 'Zamknij panel' }).click();

  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await expect(page.locator('.combat-scenarios-disclosure')).not.toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await expect(page.getByText('Historia rzutów', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Karta postaci' })).toBeVisible();
});'''
tests = sub_once(tests, old_session_test_pattern, new_session_test, "replace session dashboard browser test")
tests = replace_once(tests, "name: 'Przejdź do treści karty'", "name: 'Przejdź do głównego ekranu'", "skip link test")
write("tests/app.spec.mjs", tests)

for path in ["package.json", "package-lock.json", "service-worker.js", "README.md"]:
    content = read(path).replace("0.15.0", "0.16.0")
    write(path, content)

readme = read("README.md")
anchor = "- kontekstowy tryb sesji z kartą „Co teraz?”, aktywnymi stanami i szybkimi korektami;"
replacement = anchor + "\n- gameplay-first ekran Postać: bieżący stan, cztery główne akcje i aktywna broń bez powielania notatek oraz historii rzutów;"
readme = replace_once(readme, anchor, replacement, "README feature")
write("README.md", readme)

checksum_path = ROOT / "checksums.sha256"
paths: list[str] = []
for line in checksum_path.read_text(encoding="utf-8").splitlines():
    if not line.strip():
        continue
    _, filename = line.split(maxsplit=1)
    paths.append(filename.lstrip("*"))
checksum_lines = []
for filename in paths:
    digest = hashlib.sha256((ROOT / filename).read_bytes()).hexdigest()
    checksum_lines.append(f"{digest}  {filename}")
checksum_path.write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")

print(json.dumps({"updated": ["index.html", "scripts/app.js", "styles/app.css", "tests/app.spec.mjs", "package.json", "package-lock.json", "service-worker.js", "README.md", "checksums.sha256"]}, ensure_ascii=False))
