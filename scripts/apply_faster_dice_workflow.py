from __future__ import annotations

from pathlib import Path
import hashlib

ROOT = Path(".")
html_path = ROOT / "index.html"
tests_path = ROOT / "tests/app.spec.mjs"
readme_path = ROOT / "README.md"
package_path = ROOT / "package.json"
lock_path = ROOT / "package-lock.json"
sw_path = ROOT / "service-worker.js"
checksums_path = ROOT / "checksums.sha256"

html = html_path.read_text(encoding="utf-8")
tests = tests_path.read_text(encoding="utf-8")
readme = readme_path.read_text(encoding="utf-8")
package = package_path.read_text(encoding="utf-8")
lock = lock_path.read_text(encoding="utf-8")
sw = sw_path.read_text(encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


html = replace_once(html, "const APP_VERSION = '0.10.0';", "const APP_VERSION = '0.11.0';", "app version")
package = replace_once(package, '"version": "0.10.0"', '"version": "0.11.0"', "package version")
lock = lock.replace('"version": "0.10.0"', '"version": "0.11.0"', 2)
sw = replace_once(sw, "const CACHE_NAME = 'cairn-mobile-sheet-v0.10.0';", "const CACHE_NAME = 'cairn-mobile-sheet-v0.11.0';", "service worker cache")

dice_css = r"""

    /* Faster dice workflow v0.11.0. */
    .dice-repeat-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 7px;
      margin-top: 8px;
    }
    .dice-repeat-row .btn { min-width: 0; }
    .dice-recent-strip {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
      margin-top: 8px;
    }
    .dice-recent-item {
      min-width: 0;
      min-height: 52px;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 6px;
      align-items: center;
      padding: 7px;
      border: 1px solid var(--line);
      border-radius: 11px;
      background: var(--surface-soft);
    }
    .dice-recent-type {
      align-self: start;
      padding: 3px 5px;
      border-radius: 999px;
      background: var(--surface);
      color: var(--green-strong);
      font-size: 0.55rem;
      font-weight: 850;
      letter-spacing: 0.035em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .dice-recent-copy {
      min-width: 0;
      display: grid;
      gap: 1px;
    }
    .dice-recent-copy strong,
    .dice-recent-copy span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dice-recent-copy strong { font-size: 0.82rem; }
    .dice-recent-copy span { color: var(--muted); font-size: 0.63rem; }
    .dice-history-item-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }
    .dice-history-item-head time {
      color: var(--faint);
      font-size: 0.62rem;
    }
    .dice-history-item-actions { margin-top: 7px; }

    @media (max-width: 350px) {
      .dice-repeat-row { grid-template-columns: 1fr; }
      .dice-recent-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .dice-recent-item:last-child:nth-child(odd) { grid-column: 1 / -1; }
    }
"""
html = replace_once(html, "\n  </style>", dice_css + "\n  </style>", "dice CSS")

helpers = r"""

  const DICE_ENTRY_TYPE_LABELS = {
    dice: 'Rzut',
    save: 'Obrona',
    damage: 'Obrażenia',
    blast: 'Podmuch',
    scar: 'Blizna'
  };

  function normalizeDiceRepeatSpec(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const kind = trimText(value.kind);
    if (kind === 'roll') {
      const config = value.config && typeof value.config === 'object' ? value.config : {};
      const sides = toInt(config.sides, 0);
      if (!DICE_SIDES.includes(sides)) return null;
      return {
        kind,
        label: trimText(value.label, 'Rzut'),
        config: {
          count: clamp(toInt(config.count, 1), 1, 100),
          sides,
          modifier: clamp(toInt(config.modifier, 0), -999, 999),
          keepHighest: Boolean(config.keepHighest)
        }
      };
    }
    if (kind === 'save') {
      const attrKey = trimText(value.attrKey);
      return ['str', 'dex', 'wil'].includes(attrKey) ? { kind, attrKey } : null;
    }
    return null;
  }

  function canRepeatDiceEntry(entry) {
    return Boolean(normalizeDiceRepeatSpec(entry?.repeat));
  }

  function diceEntryTypeLabel(entry) {
    return DICE_ENTRY_TYPE_LABELS[entry?.type] || 'Rzut';
  }

  function diceEntryResultText(entry) {
    if (Array.isArray(entry?.result)) return entry.result.join(', ');
    if (entry?.result === null || entry?.result === undefined || entry?.result === '') return '—';
    return String(entry.result);
  }

  function recentDiceEntries(sourceState = state, limit = 3) {
    return safeArray(sourceState?.diceHistory).slice(0, clamp(toInt(limit, 3), 1, 10));
  }

  function repeatDiceEntry(entry) {
    const repeat = normalizeDiceRepeatSpec(entry?.repeat);
    if (!repeat) {
      showToast('Ten rzut nie zawiera danych potrzebnych do bezpiecznego powtórzenia.');
      return null;
    }
    if (repeat.kind === 'roll') return performRoll(repeat.config, repeat.label);
    if (repeat.kind === 'save') return performSave(repeat.attrKey);
    return null;
  }

  function repeatDiceEntryFromHistory(entry) {
    closeSheet();
    setView('dice');
    requestAnimationFrame(() => repeatDiceEntry(entry));
  }
"""
html = replace_once(
    html,
    """  function recordDiceEntry(target, entry) {
    target.diceHistory = [{ id: makeId(), time: nowIso(), ...entry }, ...safeArray(target.diceHistory)].slice(0, DICE_HISTORY_LIMIT);
    return target.diceHistory[0];
  }
""",
    """  function recordDiceEntry(target, entry) {
    const recorded = { id: makeId(), time: nowIso(), ...entry };
    const repeat = normalizeDiceRepeatSpec(entry?.repeat);
    if (repeat) recorded.repeat = repeat;
    else delete recorded.repeat;
    target.diceHistory = [recorded, ...safeArray(target.diceHistory)].slice(0, DICE_HISTORY_LIMIT);
    return target.diceHistory[0];
  }
""" + helpers,
    "dice history helpers"
)

html = replace_once(
    html,
    "addDiceHistory({ type: 'dice', label: label || 'Rzut', summary, notation, result: result.total, details });",
    "addDiceHistory({ type: 'dice', label: label || 'Rzut', summary, notation, result: result.total, details, repeat: { kind: 'roll', label: label || 'Rzut', config: { count: result.count, sides: result.sides, modifier: result.modifier, keepHighest: result.keepHighest } } });",
    "generic roll repeat"
)
html = replace_once(
    html,
    "addDiceHistory({ type: 'save', attr: attrKey, label: `Rzut obronny ${ATTRS[attrKey].label}`, summary, notation: '1k20', result: roll, success: result.success, details: `Cel: ${attr.current}` });",
    "addDiceHistory({ type: 'save', attr: attrKey, label: `Rzut obronny ${ATTRS[attrKey].label}`, summary, notation: '1k20', result: roll, success: result.success, details: `Cel: ${attr.current}`, repeat: { kind: 'save', attrKey } });",
    "save repeat"
)

html = replace_once(
    html,
    """    root.replaceChildren();

    const dashboard = createEl('div', { className: 'dice-dashboard-compact' });
""",
    """    root.replaceChildren();
    const entries = safeArray(state.diceHistory);
    const latest = entries[0] || null;

    const dashboard = createEl('div', { className: 'dice-dashboard-compact' });
""",
    "dice dashboard state"
)
html = replace_once(
    html,
    """      createEl('button', {
        type: 'button',
        className: 'dice-result dice-result-inline dice-result-button',
        id: 'diceResult',
        disabled: !safeArray(state.diceHistory).length,
        attrs: { 'aria-live': 'polite', 'aria-atomic': 'true', 'aria-label': safeArray(state.diceHistory).length ? 'Otwórz historię rzutów' : 'Brak historii rzutów' },
        onclick: openDiceHistorySheet
      }, [createEl('div', {}, [createEl('strong', { text: '—' }), createEl('span', { text: safeArray(state.diceHistory).length ? 'Dotknij: historia' : 'Ostatni wynik' })])])
""",
    """      createEl('button', {
        type: 'button',
        className: 'dice-result dice-result-inline dice-result-button',
        id: 'diceResult',
        disabled: !entries.length,
        attrs: {
          'aria-live': 'polite',
          'aria-atomic': 'true',
          'aria-label': latest ? `Ostatni rzut: ${latest.summary}. Otwórz historię rzutów.` : 'Brak historii rzutów'
        },
        onclick: openDiceHistorySheet
      }, [createEl('div', {}, [
        createEl('strong', { text: latest ? diceEntryResultText(latest) : '—' }),
        createEl('span', { text: latest ? `${diceEntryTypeLabel(latest)} · ${latest.label || latest.notation || 'ostatni wynik'}` : 'Ostatni wynik' })
      ])])
""",
    "latest dice result"
)
html = replace_once(
    html,
    """    consoleCard.append(grid);
    dashboard.append(consoleCard);
""",
    """    consoleCard.append(grid);

    const recent = recentDiceEntries(state, 3);
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

    consoleCard.append(createEl('div', { className: 'dice-repeat-row' }, [
      button(
        latest && canRepeatDiceEntry(latest) ? `Powtórz: ${latest.label || latest.notation || 'ostatni rzut'}` : 'Brak rzutu do powtórzenia',
        () => repeatDiceEntry(latest),
        'btn btn-primary',
        {
          disabled: !latest || !canRepeatDiceEntry(latest),
          'aria-label': latest && canRepeatDiceEntry(latest) ? `Powtórz ostatni rzut: ${latest.label || latest.notation || 'rzut'}` : 'Brak rzutu do powtórzenia'
        }
      ),
      button('Historia', openDiceHistorySheet, 'btn', { disabled: !entries.length })
    ]));
    dashboard.append(consoleCard);
""",
    "recent dice dashboard"
)

html = replace_once(
    html,
    """    for (const entry of entries) {
      body.append(createEl('div', { className: 'dice-history-item' }, [
        createEl('p', { text: entry.summary }),
        entry.details ? createEl('p', { className: 'muted small', text: entry.details }) : null,
        createEl('time', { text: formatDateTime(entry.time), dateTime: entry.time })
      ]));
    }
""",
    """    for (const entry of entries) {
      body.append(createEl('div', { className: 'dice-history-item' }, [
        createEl('div', { className: 'dice-history-item-head' }, [
          createEl('span', { className: 'dice-recent-type', text: diceEntryTypeLabel(entry) }),
          createEl('time', { text: formatDateTime(entry.time), dateTime: entry.time })
        ]),
        createEl('p', { text: entry.summary }),
        entry.details ? createEl('p', { className: 'muted small', text: entry.details }) : null,
        canRepeatDiceEntry(entry) ? createEl('div', { className: 'dice-history-item-actions' }, [
          button(`Powtórz ${entry.label || entry.notation || 'rzut'}`, () => repeatDiceEntryFromHistory(entry), 'btn btn-quiet btn-ghost', { 'aria-label': `Powtórz rzut: ${entry.label || entry.notation || 'rzut'}` })
        ]) : null
      ]));
    }
""",
    "dice history repeat buttons"
)

dice_tests = r"""
    test('85. Specyfikacja powtórzenia zwykłego rzutu jest normalizowana', () => { const spec = normalizeDiceRepeatSpec({ kind:'roll', label:'Test', config:{ count:2, sides:6, modifier:1, keepHighest:true } }); assert(spec.kind === 'roll' && spec.label === 'Test' && spec.config.count === 2 && spec.config.sides === 6 && spec.config.modifier === 1 && spec.config.keepHighest); });
    test('86. Nieznany typ powtórzenia jest odrzucany', () => { assert(normalizeDiceRepeatSpec({ kind:'unknown' }) === null); });
    test('87. Starszy wpis bez repeat pozostaje bezpieczny i niepowtarzalny', () => { assert(!canRepeatDiceEntry({ type:'dice', summary:'Stary rzut' })); });
    test('88. Typy historii rozróżniają obronę, obrażenia i podmuch', () => { assert(diceEntryTypeLabel({type:'save'}) === 'Obrona' && diceEntryTypeLabel({type:'damage'}) === 'Obrażenia' && diceEntryTypeLabel({type:'blast'}) === 'Podmuch'); });
    test('89. Pasek ostatnich rzutów zachowuje kolejność i limit trzech', () => { const fixture = createDefaultState(); fixture.diceHistory = [{id:'a'},{id:'b'},{id:'c'},{id:'d'}]; const before = JSON.stringify(fixture.diceHistory); assert(recentDiceEntries(fixture, 3).map(entry => entry.id).join(',') === 'a,b,c' && JSON.stringify(fixture.diceHistory) === before); });
    test('90. Pełna kopia zachowuje metadane bezpiecznego powtórzenia', () => { const fixture = createDemoState(); recordDiceEntry(fixture, { type:'dice', label:'k8', summary:'k8: 4 (1k8)', notation:'1k8', result:4, repeat:{ kind:'roll', label:'k8', config:{ count:1, sides:8, modifier:0, keepHighest:false } } }); const parsed = parseImportText(JSON.stringify(buildBackupPayload(fixture))); assert(parsed.candidate?.diceHistory[0]?.repeat?.kind === 'roll' && parsed.candidate.diceHistory[0].repeat.config.sides === 8); });
"""
html = replace_once(
    html,
    "    return results;\n  }\n\n  function openTestResults()",
    dice_tests + "    return results;\n  }\n\n  function openTestResults()",
    "embedded dice tests"
)

html = replace_once(
    html,
    """      classifySessionChange,
      groupInventoryEntries,
""",
    """      classifySessionChange,
      normalizeDiceRepeatSpec,
      canRepeatDiceEntry,
      diceEntryTypeLabel,
      recentDiceEntries,
      repeatDiceEntry,
      groupInventoryEntries,
""",
    "developer dice API"
)

tests = tests.replace("data-passed', '84'", "data-passed', '90'")
tests = tests.replace("data-total', '84'", "data-total', '90'")
tests = tests.rstrip() + r"""

test('dice dashboard shows recent types and repeats the latest safe roll', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k8' }).click();

  const first = await page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory[0]);
  expect(first.notation).toBe('1k8');
  await expect(page.locator('.dice-recent-strip .dice-recent-item')).toHaveCount(1);
  await expect(page.locator('.dice-recent-strip .dice-recent-type')).toHaveText('Rzut');

  await page.getByRole('button', { name: 'Powtórz ostatni rzut: k8' }).click();
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory.length)).toBe(2);

  const repeated = await page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory.slice(0, 2));
  expect(repeated[0].notation).toBe('1k8');
  expect(repeated[0].repeat.kind).toBe('roll');
  expect(repeated[0].id).not.toBe(repeated[1].id);
  await expect(page.locator('.dice-recent-strip .dice-recent-item')).toHaveCount(2);

  await page.locator('#diceResult').click();
  const history = page.locator('#sheet');
  await expect(history.getByRole('heading', { name: 'Historia rzutów' })).toBeVisible();
  await expect(history.getByRole('button', { name: 'Powtórz rzut: k8' })).toHaveCount(2);
});
""" + "\n"

readme = replace_once(
    readme,
    "- kości, rzuty obronne, Kość Losu i historia rzutów;",
    "- kości, rzuty obronne i Kość Losu, z trzema ostatnimi wynikami, typami rzutów i bezpiecznym powtarzaniem zwykłych rzutów oraz rzutów obronnych;",
    "README dice feature"
)
readme = replace_once(
    readme,
    "Wersja 0.10.0 używa `schemaVersion: 3`, ponieważ pełna kopia obejmuje teraz log sesji. Zapisy i kopie ze `schemaVersion: 2` są migrowane automatycznie, a starsze pliki `cairn-*-eksport.json` z wersji 0.6.0 nadal mogą zostać odtworzone. Raport sesji Markdown/JSON jest czytelnym wyciągiem i nie zastępuje pełnej kopii zapasowej.",
    "Wersja 0.11.0 nadal używa `schemaVersion: 3`. Historia rzutów może zawierać opcjonalne metadane bezpiecznego powtórzenia, ale starsze wpisy bez tych danych pozostają czytelne i nie wymagają migracji. Zapisy i kopie ze `schemaVersion: 2` są migrowane automatycznie, a starsze pliki `cairn-*-eksport.json` z wersji 0.6.0 nadal mogą zostać odtworzone. Raport sesji Markdown/JSON jest czytelnym wyciągiem i nie zastępuje pełnej kopii zapasowej.",
    "README compatibility"
)

html_path.write_text(html, encoding="utf-8")
tests_path.write_text(tests, encoding="utf-8")
readme_path.write_text(readme, encoding="utf-8")
package_path.write_text(package, encoding="utf-8")
lock_path.write_text(lock, encoding="utf-8")
sw_path.write_text(sw, encoding="utf-8")

targets = ["index.html", "manifest.webmanifest", "service-worker.js", "icon.svg"]
checksums_path.write_text(
    "\n".join(f"{hashlib.sha256((ROOT / path).read_bytes()).hexdigest()}  {path}" for path in targets) + "\n",
    encoding="utf-8"
)

print("Applied faster dice workflow v0.11.0")
