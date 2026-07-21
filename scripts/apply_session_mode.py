from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
TESTS = ROOT / "tests/app.spec.mjs"
README = ROOT / "README.md"
SERVICE_WORKER = ROOT / "service-worker.js"
CHECKSUMS = ROOT / "checksums.sha256"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


html = INDEX.read_text(encoding="utf-8")

html = replace_once(html, "const APP_VERSION = '0.7.0';", "const APP_VERSION = '0.8.0';", "app version")

css_anchor = """    @media (prefers-reduced-motion: reduce) {
"""
css_block = """    /* Session mode and journal information architecture. */
    .session-prompt {
      padding: 14px;
      display: grid;
      gap: 10px;
      border-color: color-mix(in srgb, var(--amber) 48%, var(--line));
      background: linear-gradient(145deg, color-mix(in srgb, var(--amber) 10%, var(--surface)), var(--surface));
    }
    .session-prompt-danger { border-color: color-mix(in srgb, var(--danger) 64%, var(--line)); }
    .session-prompt-warning { border-color: color-mix(in srgb, var(--amber) 64%, var(--line)); }
    .session-prompt-info { border-color: color-mix(in srgb, var(--green) 54%, var(--line)); }
    .session-prompt-kicker { margin: 0; color: var(--amber-strong); font-size: 0.7rem; font-weight: 850; letter-spacing: 0.12em; text-transform: uppercase; }
    .session-prompt h2 { margin: 0; font-size: 1.05rem; }
    .session-prompt p { margin: 0; color: var(--muted); font-size: 0.82rem; line-height: 1.42; }
    .session-prompt-actions { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
    .session-prompt-actions .btn { min-width: 0; }
    .session-tools-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .session-tools-grid .btn { min-height: 54px; }
    .journal-intro { display: grid; gap: 8px; }
    .journal-disclosure {
      border-top: 1px solid var(--line);
    }
    .journal-disclosure:first-of-type { border-top: 0; }
    .journal-disclosure summary {
      min-height: 54px;
      padding: 11px 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      list-style: none;
    }
    .journal-disclosure summary::-webkit-details-marker { display: none; }
    .journal-disclosure summary strong { display: block; font-size: 0.9rem; }
    .journal-disclosure summary span:last-child { color: var(--muted); font-size: 0.72rem; text-align: right; }
    .journal-disclosure-content { padding: 0 0 14px; color: var(--muted); font-size: 0.84rem; line-height: 1.5; overflow-wrap: anywhere; }
    .journal-disclosure-content p { margin: 0; white-space: pre-wrap; }
    .settings-sheet { display: grid; gap: 14px; }
    .settings-sheet-section {
      display: grid;
      gap: 10px;
      padding: 13px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface-soft);
    }
    .settings-sheet-section h3 { margin: 0; font-size: 0.98rem; }
    .settings-sheet-section > p { margin: 0; color: var(--muted); font-size: 0.78rem; line-height: 1.42; }
    .settings-sheet .settings-row { padding-inline: 0; }
    .settings-sheet .settings-row .btn { min-width: 116px; white-space: normal; overflow-wrap: normal; word-break: normal; }
    .settings-sheet-danger { border-color: color-mix(in srgb, var(--danger) 48%, var(--line)); }
    .condition-sheet-list { display: grid; gap: 0; }
    .condition-sheet-list .settings-row:first-child { border-top: 0; }
    .header-actions .btn-icon { flex: 0 0 var(--tap); }

    @media (max-width: 359px) {
      .session-prompt-actions { grid-template-columns: 1fr; }
      .session-tools-grid { grid-template-columns: 1fr 1fr; }
      .settings-sheet .settings-row { align-items: flex-start; }
      .settings-sheet .settings-row .btn { min-width: 104px; }
    }

"""
html = replace_once(html, css_anchor, css_block + css_anchor, "session css")

old_header = """      <div class="header-actions">
        <button class="btn btn-icon btn-ghost" id="quickUndoBtn" type="button" aria-label="Cofnij ostatnią zmianę" title="Cofnij"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 7H5v-4"></path><path d="M5.5 7.5a8 8 0 1 1-1.2 7.2"></path></svg></button>
      </div>
"""
new_header = """      <div class="header-actions">
        <button class="btn btn-icon btn-ghost" id="appSettingsBtn" type="button" aria-label="Ustawienia i dane" title="Ustawienia i dane"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"></path></svg></button>
        <button class="btn btn-icon btn-ghost" id="quickUndoBtn" type="button" aria-label="Cofnij ostatnią zmianę" title="Cofnij"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 7H5v-4"></path><path d="M5.5 7.5a8 8 0 1 1-1.2 7.2"></path></svg></button>
      </div>
"""
html = replace_once(html, old_header, new_header, "header settings button")
html = replace_once(html, "<span>Więcej</span></button>", "<span>Dziennik</span></button>", "journal nav label")

html = replace_once(
    html,
    "{ id: 'blast', title: 'Podmuch', notation: 'wiele celów', description: 'Osobny rzut dla każdego celu w obszarze.'",
    "{ id: 'blast', title: 'Podmuch', notation: 'wiele celów', description: 'Osobny rzut dla każdego celu.'",
    "blast helper copy",
)
html = replace_once(
    html,
    "{ id: 'dual', title: 'Dwie bronie', notation: 'wyższa kość', description: 'Rzuć obiema i zachowaj wyższą.'",
    "{ id: 'dual', title: 'Dwie bronie', notation: 'wyższa kość', description: 'Rzuć obiema. Zachowaj wyższą.'",
    "dual helper copy",
)
html = replace_once(
    html,
    "{ id: 'multiple', title: 'Wielu atakujących', notation: 'najwyższa', description: 'Wszystkie kości przeciw jednemu celowi.'",
    "{ id: 'multiple', title: 'Wielu atakujących', notation: 'najwyższa', description: 'Rzuć wszystkie. Zachowaj najwyższą.'",
    "multiple helper copy",
)

character_anchor = """  function renderCharacterView() {
"""
session_functions = """  function sessionPromptFor(sourceState = state) {
    if (!sourceState?.initialized) return null;
    const usage = calculateInventoryUsage(sourceState.inventory.items, sourceState.inventory.fatigue);
    if (sourceState.conditions.criticalDamage && !sourceState.conditions.stabilized) {
      return {
        id: 'critical-damage',
        tone: 'danger',
        title: 'Obrażenia krytyczne wymagają pomocy',
        message: 'Postać może tylko pełzać i bez pomocy umrze w ciągu godziny. Stabilizacja zatrzymuje śmierć, ale nie usuwa obrażeń krytycznych.',
        primaryLabel: 'Stabilizuj',
        primaryAction: handleStabilize
      };
    }
    if (sourceState.conditions.panicked) {
      return {
        id: 'panicked',
        tone: 'warning',
        title: 'Postać jest spanikowana',
        message: 'Nie działa w pierwszej rundzie, a jej ataki są osłabione. Rzut obronny WOL jako akcja może usunąć Panikę.',
        primaryLabel: 'Rzut WOL',
        primaryAction: attemptRecoverFromPanic
      };
    }
    if (usage.total === 10 && sourceState.stats.hp.current > 0) {
      return {
        id: 'full-inventory',
        tone: 'warning',
        title: 'Ekwipunek jest pełny',
        message: 'Przy 10/10 miejsc Ochrona powinna wynosić 0. Możesz zastosować regułę teraz albo najpierw zwolnić miejsce.',
        primaryLabel: 'Ustaw Ochronę na 0',
        primaryAction: applyFullInventoryProtectionRule
      };
    }
    if (sourceState.conditions.deprived) {
      return {
        id: 'deprived',
        tone: 'info',
        title: 'Odpoczynek jest zablokowany',
        message: 'Pozbawienie blokuje odzyskiwanie Ochrony, atrybutów i zmęczenia do czasu zaspokojenia kluczowej potrzeby.',
        primaryLabel: 'Zarządzaj stanem',
        primaryAction: openConditionsSheet
      };
    }
    return null;
  }

  function applyFullInventoryProtectionRule() {
    openConfirmSheet({
      title: 'Pełny ekwipunek',
      message: 'Zastosować regułę pełnych 10 miejsc i ustawić Ochronę na 0? Alternatywnie możesz anulować i zwolnić miejsce w Ekwipunku.',
      confirmLabel: 'Ustaw 0 Ochrony',
      danger: true,
      onConfirm: () => commitChange('Pełny ekwipunek: Ochrona spadła do 0', next => { next.stats.hp.current = 0; })
    });
  }

  function renderSessionPrompt() {
    const prompt = sessionPromptFor();
    if (!prompt) return null;
    const primary = button(prompt.primaryLabel, prompt.primaryAction, 'btn btn-primary');
    const conditions = button('Stany', openConditionsSheet, 'btn btn-ghost');
    return card([
      createEl('p', { className: 'session-prompt-kicker', text: 'Co teraz?' }),
      createEl('h2', { text: prompt.title }),
      createEl('p', { text: prompt.message }),
      createEl('div', { className: 'session-prompt-actions' }, [primary, conditions])
    ], `session-prompt session-prompt-${prompt.tone}`);
  }

  function renderSessionToolsCard() {
    const tools = card([], 'card-pad session-tools-card');
    tools.append(sectionHead('Stan i skutki', createEl('span', { className: 'muted micro', text: 'podczas sesji' })));
    tools.append(createEl('div', { className: 'session-tools-grid' }, [
      button('Stany postaci', openConditionsSheet, 'btn'),
      button('Edytuj statystyki', openEditStatsSheet, 'btn'),
      button('Obrażenia atrybutu', openDirectDamageSheet, 'btn'),
      button('Dodaj Bliznę', () => openAddScarSheet(), 'btn')
    ]));
    return tools;
  }

"""
html = replace_once(html, character_anchor, session_functions + character_anchor, "session prompt functions")

html = replace_once(html, """    root.append(hero);

    const actions = card([], 'card-pad compact-actions');
""", """    root.append(hero);

    const sessionPrompt = renderSessionPrompt();
    if (sessionPrompt) root.append(sessionPrompt);

    const actions = card([], 'card-pad compact-actions');
""", "session prompt placement")

html = replace_once(html, "actions.append(iconButton('Zarządzaj stanami', 'arrow', () => setView('more')));", "actions.append(iconButton('Zarządzaj stanami', 'arrow', openConditionsSheet));", "condition management action")

character_end = """      ], 'compact-condition-summary'));
    }
  }

  // ============================================================
  // 14. Damage, recovery and stat sheets
"""
character_end_new = """      ], 'compact-condition-summary'));
    }

    root.append(renderSessionToolsCard());
  }

  // ============================================================
  // 14. Damage, recovery and stat sheets
"""
html = replace_once(html, character_end, character_end_new, "session tools placement")

more_pattern = re.compile(r"  function renderMoreView\(\) \{.*?\n  function conditionHelp\(key\) \{", re.S)
new_more = r"""  function journalDisclosure(label, text) {
    const content = trimText(text);
    const preview = content ? `${content.slice(0, 54)}${content.length > 54 ? '…' : ''}` : 'Brak wpisu';
    const details = createEl('details', { className: 'journal-disclosure' });
    details.append(createEl('summary', {}, [
      createEl('strong', { text: label }),
      createEl('span', { text: preview })
    ]));
    details.append(createEl('div', { className: 'journal-disclosure-content' }, [
      createEl('p', { text: content || 'Brak dodatkowych informacji.' })
    ]));
    return details;
  }

  function renderMoreView() {
    const root = $('#view-more');
    if (!root) return;
    root.replaceChildren();
    if (!state.initialized) {
      root.append(card([createEl('div', { className: 'card-pad' }, [sectionHead('Dziennik'), createEl('p', { className: 'muted', text: 'Najpierw utwórz lub zaimportuj postać.' }), button('Importuj z Kettlewright', () => $('#importFileInput').click(), 'btn btn-primary btn-block')])]))
      return;
    }

    const identity = card([], 'card-pad compact-more-card journal-intro');
    identity.append(sectionHead('Dziennik postaci', button('Edytuj dane', openEditIdentitySheet, 'btn btn-quiet btn-ghost')));
    identity.append(createEl('p', { className: 'eyebrow', text: state.identity.background || 'Bez tła' }));
    identity.append(createEl('p', { text: state.identity.backgroundDescription || 'Brak opisu tła.', className: 'muted small wrap-anywhere notes-preview' }));
    root.append(identity);

    const notes = card([], 'card-pad');
    notes.append(sectionHead('Notatki i opis', button('Edytuj', openNotesSheet, 'btn btn-quiet btn-ghost')));
    notes.append(
      journalDisclosure('Cechy', state.identity.traits),
      journalDisclosure('Więzi', state.identity.bonds),
      journalDisclosure('Omeny', state.identity.omens),
      journalDisclosure('Notatki', state.notes)
    );
    root.append(notes);

    const scars = card([], 'card-pad');
    scars.append(sectionHead('Blizny', button('Dodaj', () => openAddScarSheet(), 'btn btn-quiet btn-ghost')));
    if (!state.scars.length) scars.append(createEl('p', { className: 'muted small', text: 'Brak zapisanych Blizn.' }));
    for (const [index, scar] of state.scars.entries()) scars.append(journalDisclosure(`Blizna ${index + 1}`, scar.text));
    root.append(scars);

    const historyCard = card([], 'card-pad');
    historyCard.append(sectionHead('Historia', createEl('span', { className: 'muted small', text: `${safeArray(state.changeHistory).length} zmian · ${safeArray(state.diceHistory).length} rzutów` })));

    const changeDetails = createEl('details', { className: 'history-disclosure' });
    changeDetails.append(createEl('summary', {}, [createEl('span', { text: 'Historia zmian' }), createEl('span', { className: 'tag', text: safeArray(state.changeHistory).length })]));
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

    const diceDetails = createEl('details', { className: 'history-disclosure' });
    diceDetails.append(createEl('summary', {}, [createEl('span', { text: 'Historia rzutów' }), createEl('span', { className: 'tag', text: safeArray(state.diceHistory).length })]));
    const diceContent = createEl('div', { className: 'history-disclosure-content' });
    diceContent.append(button('Wyczyść rzuty', confirmClearDiceHistory, 'btn btn-quiet btn-ghost btn-block', { disabled: !safeArray(state.diceHistory).length }));
    const diceList = createEl('div', { className: 'dice-history' });
    if (!safeArray(state.diceHistory).length) diceList.append(createEl('p', { className: 'muted small', text: 'Brak rzutów.' }));
    for (const entry of safeArray(state.diceHistory)) diceList.append(createEl('div', { className: 'dice-history-item' }, [createEl('p', { text: entry.summary }), entry.details ? createEl('p', { className: 'muted small', text: entry.details }) : null, createEl('time', { text: formatDateTime(entry.time), dateTime: entry.time })]));
    diceContent.append(diceList);
    diceDetails.append(diceContent);

    historyCard.append(changeDetails, diceDetails);
    root.append(historyCard);
  }

  function openConditionsSheet() {
    const body = createEl('div', { className: 'sheet-list' });
    body.append(createEl('p', { className: 'muted small', text: 'Zaznaczaj tylko stany wynikające z fikcji i rozstrzygnięć przy stole. Aktywne stany są widoczne na ekranie Postaci.' }));
    const settings = createEl('div', { className: 'condition-sheet-list' });
    for (const [key, label] of CONDITION_DEFS) {
      const toggle = createEl('input', { type: 'checkbox', checked: Boolean(state.conditions[key]), attrs: { 'aria-label': label } });
      toggle.addEventListener('change', () => handleConditionToggle(key, toggle.checked));
      settings.append(createEl('label', { className: 'settings-row settings-row-toggle' }, [
        createEl('div', {}, [createEl('strong', { text: label }), createEl('p', { className: 'help', text: conditionHelp(key) })]),
        toggle
      ]));
    }
    settings.append(createEl('div', { className: 'settings-row' }, [
      createEl('div', {}, [createEl('strong', { text: 'Własne stany' }), createEl('p', { className: 'help', text: state.conditions.custom.map(entry => entry.name).join(', ') || 'Brak' })]),
      button('Zarządzaj', openCustomConditionsSheet, 'btn btn-quiet btn-ghost')
    ]));
    body.append(settings);
    openSheet({ title: 'Stany postaci', body, footer: button('Gotowe', closeSheet, 'btn btn-primary btn-block') });
  }

  function conditionHelp(key) {"""
html, count = more_pattern.subn(new_more, html, count=1)
if count != 1:
    raise RuntimeError(f"renderMoreView replacement: expected one match, found {count}")

html = replace_once(html, """  function handleConditionToggle(key, enabled) {
    renderMoreView();
""", """  function handleConditionToggle(key, enabled) {
""", "condition toggle pre-render")

settings_anchor = """  function openInstallHelp() {
"""
settings_functions = """  function isDeveloperMode() {
    return new URLSearchParams(location.search).get('dev') === '1';
  }

  function settingsSection(title, children, className = '') {
    return createEl('section', { className: `settings-sheet-section ${className}`.trim() }, [
      createEl('h3', { text: title }),
      ...(Array.isArray(children) ? children : [children])
    ]);
  }

  function openAppSettingsSheet() {
    const body = createEl('div', { className: 'settings-sheet' });

    const dataChildren = [
      createEl('p', { text: 'Dane pozostają wyłącznie w tej przeglądarce i na tym urządzeniu. Pełna kopia JSON jest jedyną kopią poza pamięcią przeglądarki.' }),
      createEl('div', { className: 'data-status' }, [
        createEl('strong', { text: backupMeta.lastBackupAt ? `Ostatnia pełna kopia: ${formatDateTime(backupMeta.lastBackupAt)}` : 'Brak potwierdzonej kopii zapasowej' }),
        createEl('span', { text: `${backupMeta.meaningfulChangesSinceBackup} zmian od ostatniej kopii.` })
      ]),
      createEl('div', { className: 'button-row' }, [
        button('Pobierz pełną kopię', exportBackup, 'btn btn-primary'),
        button('Import Kettlewright', () => $('#importFileInput').click(), 'btn'),
        button('Odtwórz kopię', () => $('#backupFileInput').click(), 'btn')
      ])
    ];
    body.append(settingsSection('Dane i kopie zapasowe', dataChildren));

    const themeToggle = createEl('input', { type: 'checkbox', checked: state.settings.theme === 'light', attrs: { 'aria-label': 'Jasny motyw' } });
    themeToggle.addEventListener('change', () => {
      state.settings.theme = themeToggle.checked ? 'light' : 'dark';
      scheduleSave();
      renderAll();
    });
    const appRows = createEl('div', { className: 'settings-list' }, [
      createEl('label', { className: 'settings-row settings-row-toggle' }, [
        createEl('div', {}, [createEl('strong', { text: 'Jasny motyw' }), createEl('p', { className: 'help', text: 'Ciemny pozostaje domyślny.' })]),
        themeToggle
      ]),
      createEl('div', { className: 'settings-row' }, [
        createEl('div', {}, [createEl('strong', { text: 'Instalacja i offline' }), createEl('p', { className: 'help', text: deferredInstallPrompt ? 'Przeglądarka pozwala zainstalować kartę jako aplikację.' : 'Po pierwszym otwarciu karta jest buforowana do pracy bez sieci.' })]),
        button(deferredInstallPrompt ? 'Zainstaluj' : 'Jak zainstalować', deferredInstallPrompt ? installApp : openInstallHelp, 'btn btn-quiet btn-ghost')
      ]),
      createEl('div', { className: 'settings-row' }, [
        createEl('div', {}, [createEl('strong', { text: `Wersja ${APP_VERSION}` }), createEl('p', { className: 'help', text: `Schemat danych ${SCHEMA_VERSION}` })]),
        createEl('span', { className: 'tag', text: state.source.type })
      ])
    ]);
    if (isDeveloperMode()) {
      appRows.append(createEl('div', { className: 'settings-row' }, [
        createEl('div', {}, [createEl('strong', { text: 'Testy deweloperskie' }), createEl('p', { className: 'help', text: 'Widoczne tylko w trybie ?dev=1.' })]),
        button('Uruchom', openTestResults, 'btn btn-quiet btn-ghost')
      ]));
    }
    body.append(settingsSection('Aplikacja', appRows));

    const recoveryRaw = safeStorageGet(RECOVERY_KEY);
    if (recoveryRaw) {
      body.append(settingsSection('Kopia odzyskiwania', [
        createEl('p', { text: 'W pamięci znajduje się surowy zapis, którego aplikacja wcześniej nie mogła odczytać.' }),
        button('Pobierz surowe dane', () => downloadTextFile('cairn-recovery-raw.json', recoveryRaw), 'btn btn-block')
      ]));
    }

    body.append(settingsSection('Operacje destrukcyjne', createEl('div', { className: 'button-row' }, [
      button('Wyczyść historię zmian', confirmClearChangeHistory, 'btn btn-danger'),
      button('Zresetuj kartę', openResetSheet, 'btn btn-danger')
    ]), 'settings-sheet-danger'));

    openSheet({ title: 'Ustawienia i dane', body, footer: button('Gotowe', closeSheet, 'btn btn-primary btn-block') });
  }

"""
html = replace_once(html, settings_anchor, settings_functions + settings_anchor, "settings sheet functions")

html = replace_once(html, """    deferredInstallPrompt = null;
    renderMoreView();
""", """    deferredInstallPrompt = null;
    renderAll();
""", "install rerender")
html = replace_once(html, "window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; renderMoreView(); });", "window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; renderAll(); });", "install prompt event")
html = replace_once(html, "window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; renderMoreView(); showToast('Aplikacja została zainstalowana.'); });", "window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; renderAll(); showToast('Aplikacja została zainstalowana.'); });", "installed event")
html = replace_once(html, """    $('#quickUndoBtn').addEventListener('click', undoLastChange);
""", """    $('#appSettingsBtn').addEventListener('click', openAppSettingsSheet);
    $('#quickUndoBtn').addEventListener('click', undoLastChange);
""", "settings binding")

html = replace_once(html, """      shouldShowBackupReminder,
      createDemoState
""", """      shouldShowBackupReminder,
      sessionPromptFor,
      createDemoState
""", "dev exports")

old_test_tail = """    test('64. Atak przedmiotem przechodzi przez straż paniki', () => { assert(renderItemCard.toString().includes('runItemAttack') && runItemAttack.toString().includes('atak osłabiony')); });
    return results;
"""
new_test_tail = """    test('64. Atak przedmiotem przechodzi przez straż paniki', () => { assert(renderItemCard.toString().includes('runItemAttack') && runItemAttack.toString().includes('atak osłabiony')); });
    test('65. Co teraz priorytetyzuje obrażenia krytyczne przed Paniką', () => { const fixture = createDemoState(); fixture.conditions.criticalDamage = true; fixture.conditions.panicked = true; assert(sessionPromptFor(fixture)?.id === 'critical-damage'); });
    test('66. Pełny ekwipunek proponuje ustawienie Ochrony na 0', () => { const fixture = createDefaultState(); fixture.initialized = true; fixture.stats.hp.current = 3; fixture.inventory.items = Array.from({ length: 10 }, (_, index) => makeItem({ id:`full-${index}`, slots:1 })); assert(sessionPromptFor(fixture)?.id === 'full-inventory'); });
    test('67. Dziennik nie zawiera ustawień technicznych', () => { const source = renderMoreView.toString(); assert(source.includes('Dziennik postaci') && !source.includes('Dane i kopie zapasowe') && !source.includes('Testy deweloperskie')); });
    test('68. Ustawienia i dane są dostępne z nagłówka', () => { assert(Boolean($('#appSettingsBtn')) && typeof openAppSettingsSheet === 'function' && $('#nav-more')?.textContent.includes('Dziennik')); });
    test('69. Skróty sytuacji w walce są pełnymi zdaniami', () => { const definitions = combatScenarioDefinitions(); assert(definitions.find(entry => entry.id === 'blast').description === 'Osobny rzut dla każdego celu.' && definitions.find(entry => entry.id === 'dual').description === 'Rzuć obiema. Zachowaj wyższą.' && definitions.find(entry => entry.id === 'multiple').description === 'Rzuć wszystkie. Zachowaj najwyższą.'); });
    return results;
"""
html = replace_once(html, old_test_tail, new_test_tail, "embedded tests")

INDEX.write_text(html, encoding="utf-8")

# Update browser regression expectations and add direct information-architecture checks.
tests = TESTS.read_text(encoding="utf-8")
tests = tests.replace("data-passed', '64'", "data-passed', '69'").replace("data-total', '64'", "data-total', '69'")
tests = tests.replace("['Postać', 'Ekwipunek', 'Kości', 'Więcej']", "['Postać', 'Ekwipunek', 'Kości', 'Dziennik']")
if "settings and technical data are separated from the player journal" not in tests:
    tests += """

test('settings and technical data are separated from the player journal', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dziennik postaci' })).toBeVisible();
  await expect(page.getByText('Dane i kopie zapasowe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await expect(page.getByRole('heading', { name: 'Ustawienia i dane' })).toBeVisible();
  await expect(page.getByText('Dane i kopie zapasowe')).toBeVisible();
  await expect(page.getByText('Testy deweloperskie')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Jak zainstalować' })).toBeVisible();
});

test('session prompt appears for urgent character state', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const fixture = globalThis.CairnSheetDev.createDemoState();
    fixture.conditions.panicked = true;
    fixture.stats.hp.current = 0;
    localStorage.setItem('cairn-mobile-sheet:state', JSON.stringify(fixture));
  });
  await page.reload();
  await expect(page.getByText('Co teraz?')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Postać jest spanikowana' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rzut WOL' })).toBeVisible();
});
"""
TESTS.write_text(tests, encoding="utf-8")

readme = README.read_text(encoding="utf-8")
readme = readme.replace(
    "- instalacja jako lekka PWA i ponowne uruchomienie offline po pierwszym poprawnym otwarciu.",
    "- instalacja jako lekka PWA i ponowne uruchomienie offline po pierwszym poprawnym otwarciu;\n- kontekstowy tryb sesji z kartą „Co teraz?”, aktywnymi stanami i szybkimi korektami;\n- osobny Dziennik postaci, podczas gdy backup, instalacja i operacje techniczne są dostępne w ustawieniach nagłówka.",
)
readme = readme.replace(
    "Wersja 0.7.0 potrafi również odtworzyć starsze pliki",
    "Wersja 0.8.0 zachowuje bezpieczny format kopii z 0.7.0 i potrafi również odtworzyć starsze pliki",
)
README.write_text(readme, encoding="utf-8")

service_worker = SERVICE_WORKER.read_text(encoding="utf-8")
service_worker = replace_once(service_worker, "cairn-mobile-sheet-v0.7.0", "cairn-mobile-sheet-v0.8.0", "service worker cache")
SERVICE_WORKER.write_text(service_worker, encoding="utf-8")

checksum_lines = []
for name in ["index.html", "manifest.webmanifest", "service-worker.js", "icon.svg"]:
    digest = hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
    checksum_lines.append(f"{digest}  {name}")
CHECKSUMS.write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")

print("Applied session mode and journal changes.")
