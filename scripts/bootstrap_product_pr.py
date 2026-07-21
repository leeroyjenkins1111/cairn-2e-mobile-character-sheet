from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def insert_before(text: str, marker: str, addition: str, label: str) -> str:
    return replace_once(text, marker, addition + marker, label)


text = INDEX.read_text(encoding="utf-8")

# Metadata, PWA and contrast
text = replace_once(
    text,
    '  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n  <title>Karta Wędrowca — Cairn 2e</title>',
    '  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
    '  <meta name="description" content="Lokalna, mobilna karta postaci do Cairn 2e z obsługą obrażeń, ekwipunku i kości.">\n'
    '  <link rel="manifest" href="./manifest.webmanifest">\n'
    '  <link rel="icon" href="./icon.svg" type="image/svg+xml">\n'
    '  <link rel="apple-touch-icon" href="./icon.svg">\n'
    '  <title>Karta Wędrowca — Cairn 2e</title>',
    "PWA head metadata",
)
text = replace_once(text, '      --faint: #837a82;', '      --faint: #6f666f;', "light faint contrast")
text = replace_once(text, '      .dice-dashboard-compact .scenario-copy small { font-size: 0.48rem; }', '      .dice-dashboard-compact .scenario-copy small { font-size: 0.53rem; }', "small viewport scenario copy")
text = replace_once(text, '      font-size: 0.53rem;\n      line-height: 1.12;', '      font-size: 0.58rem;\n      line-height: 1.18;', "scenario copy readability")

extra_css = r'''

    /* Product reliability and session workflow improvements. */
    .alert-info {
      border-color: color-mix(in srgb, var(--green) 48%, transparent);
      background: color-mix(in srgb, var(--green) 13%, var(--surface));
    }
    .alert-info strong { color: var(--green-strong); }
    .backup-actions { display: grid; grid-template-columns: 1fr auto; gap: 7px; margin-top: 10px; }
    .data-status {
      display: grid;
      gap: 4px;
      margin: 10px 0;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surface-soft);
    }
    .data-status strong { font-size: 0.82rem; }
    .data-status span { color: var(--muted); font-size: 0.72rem; line-height: 1.35; }
    .inventory-summary-actions { display: flex; align-items: center; gap: 6px; }
    .gold-button { min-width: 84px; white-space: nowrap; }
    .gold-adjust-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
    .gold-current { text-align: center; padding: 12px; }
    .gold-current strong { display: block; color: var(--amber-strong); font-size: 2rem; }
    .gold-current span { color: var(--muted); font-size: 0.74rem; }
    .settings-row-toggle { cursor: pointer; }
    .settings-row-toggle input[type="checkbox"] { width: 44px; min-height: 44px; flex: 0 0 44px; }
    .dice-result-button {
      width: 100%;
      color: var(--text);
      font: inherit;
      cursor: pointer;
      text-align: inherit;
    }
    .dice-result-button:disabled { cursor: default; }
    .dice-history-sheet-list { display: grid; gap: 8px; }
    .install-help-list { margin: 0; padding-left: 20px; color: var(--muted); }
    .install-help-list li + li { margin-top: 7px; }

    @media (max-width: 359px) {
      .inventory-summary-actions { gap: 4px; }
      .gold-button { min-width: 70px; padding-inline: 7px; font-size: 0.7rem; }
      .backup-actions { grid-template-columns: 1fr; }
    }
'''
text = insert_before(text, '    @media (prefers-reduced-motion: reduce) {', extra_css, "extra reliability css")

# Constants and rule copy
text = replace_once(text, "  const APP_VERSION = '0.6.0';", "  const APP_VERSION = '0.7.0';", "app version")
text = replace_once(
    text,
    "  const RECOVERY_KEY = `${APP_ID}:recovery`;\n  const HISTORY_LIMIT = 50;",
    "  const RECOVERY_KEY = `${APP_ID}:recovery`;\n"
    "  const BACKUP_META_KEY = `${APP_ID}:backup-meta`;\n"
    "  const BACKUP_REMINDER_CHANGE_THRESHOLD = 10;\n"
    "  const BACKUP_REMINDER_DAYS = 14;\n"
    "  const BACKUP_REMINDER_SNOOZE_DAYS = 3;\n"
    "  const HISTORY_LIMIT = 50;",
    "backup constants",
)
text = replace_once(text, "    ['deprived', 'Pozbawienie / dyskomfort'],", "    ['deprived', 'Pozbawienie'],", "deprived label")
text = replace_once(text, "    7: { title: 'Wstrząs', summary: 'Postać ledwo się porusza do czasu poważnej pomocy i odpoczynku. Po wyzdrowieniu 3k6 może podnieść maksymalne ZRE.' },", "    7: { title: 'Uszkodzone ścięgno', summary: 'Postać ledwo się porusza do czasu poważnej pomocy i odpoczynku. Po wyzdrowieniu 3k6 może podnieść maksymalne ZRE.' },", "scar 7 copy")
text = replace_once(text, "    8: { title: 'Ogłuszenie', summary: 'Postać nic nie słyszy do czasu wyjątkowej pomocy. Udany rzut WOL pozwala zwiększyć maksymalne WOL o k4.' },", "    8: { title: 'Ogłuchnięcie', summary: 'Postać nic nie słyszy do czasu wyjątkowej pomocy. Udany rzut WOL pozwala zwiększyć maksymalne WOL o k4.' },", "scar 8 copy")

parser_code = r'''

  function parseAttackDiceList(value) {
    const normalized = trimText(value).toLowerCase();
    if (!normalized) return null;
    const tokens = normalized.split(',').map(token => token.trim()).filter(Boolean);
    if (!tokens.length || tokens.length > 20) return null;
    if (tokens.some(token => !/^k(?:4|6|8|10|12)$/.test(token))) return null;
    return tokens.map(token => ({ token, sides: toInt(token.slice(1), 0) }));
  }
'''
text = insert_before(text, '  function polishUsesLabel(value) {', parser_code, "strict attack parser")

# Backup metadata, safety and reminder logic
text = replace_once(
    text,
    "  let state = createDefaultState();\n  let storageBlocked = false;\n  let loadWarning = '';\n  let saveTimer = null;",
    "  let state = createDefaultState();\n"
    "  let storageBlocked = false;\n"
    "  let loadWarning = '';\n"
    "  let saveTimer = null;\n"
    "  let backupMeta = createDefaultBackupMeta();\n"
    "  let deferredInstallPrompt = null;",
    "storage globals",
)

backup_meta_code = r'''

  function createDefaultBackupMeta() {
    return { lastBackupAt: null, meaningfulChangesSinceBackup: 0, snoozedAt: null };
  }

  function loadBackupMeta() {
    if (!canUseStorage()) return createDefaultBackupMeta();
    try {
      const raw = localStorage.getItem(BACKUP_META_KEY);
      if (!raw) return createDefaultBackupMeta();
      const parsed = JSON.parse(raw);
      return {
        lastBackupAt: typeof parsed.lastBackupAt === 'string' ? parsed.lastBackupAt : null,
        meaningfulChangesSinceBackup: Math.max(0, toInt(parsed.meaningfulChangesSinceBackup, 0)),
        snoozedAt: typeof parsed.snoozedAt === 'string' ? parsed.snoozedAt : null
      };
    } catch {
      return createDefaultBackupMeta();
    }
  }

  function saveBackupMeta() {
    if (storageBlocked) return false;
    try {
      localStorage.setItem(BACKUP_META_KEY, JSON.stringify(backupMeta));
      return true;
    } catch {
      return false;
    }
  }

  function daysSince(iso) {
    if (!iso) return Number.POSITIVE_INFINITY;
    const timestamp = Date.parse(iso);
    if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
    return Math.max(0, (Date.now() - timestamp) / 86_400_000);
  }

  function recordMeaningfulChange() {
    backupMeta.meaningfulChangesSinceBackup = Math.max(0, toInt(backupMeta.meaningfulChangesSinceBackup, 0)) + 1;
    saveBackupMeta();
  }

  function markBackupCreated() {
    backupMeta.lastBackupAt = nowIso();
    backupMeta.meaningfulChangesSinceBackup = 0;
    backupMeta.snoozedAt = null;
    saveBackupMeta();
  }

  function markBackupImported() {
    backupMeta.lastBackupAt = nowIso();
    backupMeta.meaningfulChangesSinceBackup = 0;
    backupMeta.snoozedAt = null;
    saveBackupMeta();
  }

  function snoozeBackupReminder() {
    backupMeta.snoozedAt = nowIso();
    saveBackupMeta();
    renderAll();
    showToast('Przypomnienie o kopii odłożono na 3 dni.');
  }

  function shouldShowBackupReminder(meta = backupMeta, sourceState = state) {
    if (!sourceState?.initialized) return false;
    if (daysSince(meta?.snoozedAt) < BACKUP_REMINDER_SNOOZE_DAYS) return false;
    const changes = Math.max(0, toInt(meta?.meaningfulChangesSinceBackup, 0));
    if (!meta?.lastBackupAt) return changes >= BACKUP_REMINDER_CHANGE_THRESHOLD;
    return changes > 0 && daysSince(meta.lastBackupAt) >= BACKUP_REMINDER_DAYS;
  }
'''
text = insert_before(text, '  function loadState() {', backup_meta_code, "backup metadata functions")

text = replace_once(
    text,
    "    next.changeHistory = [...safeArray(state.changeHistory), entry].slice(-HISTORY_LIMIT);\n    state = next;\n    scheduleSave();",
    "    next.changeHistory = [...safeArray(state.changeHistory), entry].slice(-HISTORY_LIMIT);\n"
    "    state = next;\n"
    "    recordMeaningfulChange();\n"
    "    scheduleSave();",
    "count meaningful changes",
)
text = replace_once(
    text,
    "    state = next;\n    scheduleSave();\n    renderAll();\n    showToast(`Cofnięto: ${entry.description}`);",
    "    state = next;\n"
    "    recordMeaningfulChange();\n"
    "    scheduleSave();\n"
    "    renderAll();\n"
    "    showToast(`Cofnięto: ${entry.description}`);",
    "undo meaningful change",
)

text = replace_once(
    text,
    "  function addDiceHistory(entry) {\n    state.diceHistory = [{ id: makeId(), time: nowIso(), ...entry }, ...safeArray(state.diceHistory)].slice(0, DICE_HISTORY_LIMIT);\n    recordEvent(entry.summary);\n    scheduleSave();\n    renderDiceView();\n  }",
    "  function recordDiceEntry(target, entry) {\n"
    "    target.diceHistory = [{ id: makeId(), time: nowIso(), ...entry }, ...safeArray(target.diceHistory)].slice(0, DICE_HISTORY_LIMIT);\n"
    "    return target.diceHistory[0];\n"
    "  }\n\n"
    "  function addDiceHistory(entry) {\n"
    "    recordDiceEntry(state, entry);\n"
    "    scheduleSave();\n"
    "    renderDiceView();\n"
    "  }",
    "separate dice and undo history",
)

# Safe backup import/export including recovery of legacy 0.6 exports
backup_contract_code = r'''

  function validateRawBackupShape(candidate) {
    const errors = [];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) errors.push('Kopia nie jest obiektem.');
    if (candidate?.appId !== APP_ID) errors.push('Nieprawidłowy identyfikator kopii.');
    if (!Number.isInteger(candidate?.schemaVersion)) errors.push('Brak prawidłowego schemaVersion.');
    if (!candidate?.identity || typeof candidate.identity !== 'object') errors.push('Kopia nie zawiera danych postaci.');
    if (!candidate?.stats || typeof candidate.stats !== 'object') errors.push('Kopia nie zawiera statystyk.');
    if (!candidate?.inventory || !Array.isArray(candidate.inventory.items) || (candidate.inventory.fatigue !== undefined && !Array.isArray(candidate.inventory.fatigue))) errors.push('Kopia nie zawiera prawidłowego ekwipunku.');
    return { valid: errors.length === 0, errors };
  }

  function convertLegacyCharacterExport(parsed) {
    if (!parsed?.character || typeof parsed.character !== 'object') return null;
    const character = parsed.character;
    const candidate = createDefaultState();
    candidate.appId = APP_ID;
    candidate.schemaVersion = Number.isInteger(parsed.schemaVersion) ? parsed.schemaVersion : SCHEMA_VERSION;
    candidate.appVersion = trimText(parsed.appVersion, '0.6.0');
    candidate.initialized = true;
    candidate.identity = deepClone(character.identity);
    candidate.stats = deepClone(character.stats);
    candidate.inventory = deepClone(character.inventory);
    candidate.conditions = deepClone(character.conditions || candidate.conditions);
    candidate.scars = deepClone(character.scars || []);
    candidate.notes = typeof character.notes === 'string' ? character.notes : '';
    candidate.source = parsed.source && typeof parsed.source === 'object' ? deepClone(parsed.source) : candidate.source;
    candidate.createdAt = trimText(parsed.createdAt, nowIso());
    candidate.updatedAt = trimText(parsed.exportedAt, nowIso());
    return candidate;
  }

  function buildBackupPayload(sourceState = state) {
    const payload = deepClone(sourceState);
    payload.appId = APP_ID;
    payload.schemaVersion = SCHEMA_VERSION;
    payload.appVersion = APP_VERSION;
    payload.updatedAt = nowIso();
    return payload;
  }
'''
text = insert_before(text, '  function parseImportText(text) {', backup_contract_code, "backup contract helpers")

old_parse = r'''  function parseImportText(text) {
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (error) { return { type: 'invalid', candidate: null, report: { imported: [], unrecognized: [], manual: [], warnings: [], errors: [`Uszkodzony JSON: ${error.message}`] } }; }
    if (parsed?.appId === APP_ID) {
      try {
        const candidate = sanitizeLoadedState(parsed);
        const validation = validateState(candidate);
        return { type: 'backup', candidate: validation.valid ? candidate : null, report: { imported: validation.valid ? ['pełna kopia karty aplikacji'] : [], unrecognized: [], manual: [], warnings: validation.warnings, errors: validation.errors } };
      } catch (error) {
        return { type: 'backup', candidate: null, report: { imported: [], unrecognized: [], manual: [], warnings: [], errors: [error.message] } };
      }
    }
    const normalized = normalizeKettlewright(parsed);
    return { type: 'kettlewright', ...normalized };
  }'''
new_parse = r'''  function parseImportText(text) {
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (error) { return { type: 'invalid', candidate: null, report: { imported: [], unrecognized: [], manual: [], warnings: [], errors: [`Uszkodzony JSON: ${error.message}`] } }; }
    if (parsed?.appId === APP_ID) {
      const legacy = Boolean(parsed.character);
      try {
        const rawCandidate = legacy ? convertLegacyCharacterExport(parsed) : parsed;
        const rawValidation = validateRawBackupShape(rawCandidate);
        if (!rawValidation.valid) {
          return { type: 'backup', candidate: null, report: { imported: [], unrecognized: [], manual: legacy ? ['Rozpoznano starszy eksport postaci, ale nie zawiera kompletu danych.'] : [], warnings: [], errors: rawValidation.errors } };
        }
        const candidate = sanitizeLoadedState(rawCandidate);
        const validation = validateState(candidate);
        return {
          type: 'backup',
          candidate: validation.valid ? candidate : null,
          report: {
            imported: validation.valid ? [legacy ? 'starszy eksport postaci przekonwertowany do pełnej kopii' : 'pełna kopia karty aplikacji'] : [],
            unrecognized: [],
            manual: legacy ? ['Plik pochodzi ze starszego przycisku „Eksport postaci” i został bezpiecznie przekonwertowany.'] : [],
            warnings: validation.warnings,
            errors: validation.errors
          }
        };
      } catch (error) {
        return { type: 'backup', candidate: null, report: { imported: [], unrecognized: [], manual: [], warnings: [], errors: [error.message] } };
      }
    }
    const normalized = normalizeKettlewright(parsed);
    return { type: 'kettlewright', ...normalized };
  }'''
text = replace_once(text, old_parse, new_parse, "safe parse import")

text = replace_once(
    text,
    "  function applyPendingImport() {\n    if (!pendingImport?.candidate || pendingImport.report.errors.length) return;\n    const imported = deepClone(pendingImport.candidate);",
    "  function applyPendingImport() {\n"
    "    if (!pendingImport?.candidate || pendingImport.report.errors.length) return;\n"
    "    const importedType = pendingImport.type;\n"
    "    const imported = deepClone(pendingImport.candidate);",
    "capture import type",
)
text = replace_once(
    text,
    "    state = imported;\n    pendingImport = null;\n    saveNow();",
    "    state = imported;\n"
    "    if (importedType === 'backup') markBackupImported();\n"
    "    else { backupMeta = createDefaultBackupMeta(); saveBackupMeta(); }\n"
    "    pendingImport = null;\n"
    "    saveNow();",
    "import backup metadata",
)

old_export_block = r'''  function exportBackup() {
    saveNow();
    const name = trimText(state.identity.name, 'postać').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'postac';
    downloadTextFile(`cairn-${name}-kopia-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(state, null, 2));
    showToast('Pobrano kopię zapasową JSON.');
  }

  function exportCharacterJson() {
    const payload = {
      appId: APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      character: {
        identity: state.identity,
        stats: state.stats,
        inventory: state.inventory,
        conditions: state.conditions,
        scars: state.scars,
        notes: state.notes
      },
      source: state.source
    };
    const name = trimText(state.identity.name, 'postać').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'postac';
    downloadTextFile(`cairn-${name}-eksport.json`, JSON.stringify(payload, null, 2));
    showToast('Pobrano eksport postaci.');
  }'''
new_export_block = r'''  function exportBackup() {
    saveNow();
    const payload = buildBackupPayload(state);
    const name = trimText(state.identity.name, 'postać').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'postac';
    downloadTextFile(`cairn-${name}-kopia-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2));
    markBackupCreated();
    renderAll();
    showToast('Pobrano pełną kopię zapasową JSON.');
    announce('Pobrano pełną kopię zapasową postaci.');
  }'''
text = replace_once(text, old_export_block, new_export_block, "unified safe export")

backup_reminder_render = r'''

  function renderBackupReminder() {
    if (!shouldShowBackupReminder()) return null;
    const last = backupMeta.lastBackupAt ? `Ostatnia kopia: ${formatDateTime(backupMeta.lastBackupAt)}.` : 'Ta postać nie ma jeszcze zapisanej kopii.';
    return createEl('div', { className: 'alert alert-info' }, [
      createEl('strong', { text: 'Zabezpiecz postać' }),
      createEl('p', { className: 'small', text: `${last} Dane istnieją tylko w tej przeglądarce i mogą zniknąć po jej wyczyszczeniu.` }),
      createEl('div', { className: 'backup-actions' }, [
        button('Pobierz pełną kopię', exportBackup, 'btn btn-primary'),
        button('Przypomnij za 3 dni', snoozeBackupReminder, 'btn btn-ghost')
      ])
    ]);
  }
'''
text = insert_before(text, '  function inconsistencyAlerts() {', backup_reminder_render, "backup reminder renderer")
text = replace_once(
    text,
    "    for (const alert of inconsistencyAlerts()) root.append(alert);\n\n    const armor = deriveArmor();",
    "    for (const alert of inconsistencyAlerts()) root.append(alert);\n"
    "    const backupReminder = renderBackupReminder();\n"
    "    if (backupReminder) root.append(backupReminder);\n\n"
    "    const armor = deriveArmor();",
    "show backup reminder",
)

# Gold workflow
text = replace_once(
    text,
    "      iconButton('Dodaj przedmiot', 'plus', () => openItemSheet(), 'btn btn-icon btn-primary')\n    ]));",
    "      createEl('div', { className: 'inventory-summary-actions' }, [\n"
    "        button(`Złoto: ${state.stats.gold}`, openGoldSheet, 'btn btn-quiet gold-button', { 'aria-label': `Złoto: ${state.stats.gold}. Otwórz szybką korektę.` }),\n"
    "        iconButton('Dodaj przedmiot', 'plus', () => openItemSheet(), 'btn btn-icon btn-primary')\n"
    "      ])\n"
    "    ]));",
    "inventory gold action",
)

gold_sheet = r'''

  function openGoldSheet() {
    let draft = Math.max(0, toInt(state.stats.gold, 0));
    const current = createEl('div', { className: 'report-block gold-current', attrs: { 'aria-live': 'polite' } }, [
      createEl('strong', { text: draft }),
      createEl('span', { text: 'sztuk złota' })
    ]);
    const exact = numberInput(draft, 0, 999999);
    const refresh = () => {
      current.querySelector('strong').textContent = String(draft);
      exact.value = String(draft);
    };
    const adjust = delta => {
      draft = Math.max(0, draft + delta);
      refresh();
    };
    exact.addEventListener('input', () => { draft = Math.max(0, toInt(exact.value, 0)); current.querySelector('strong').textContent = String(draft); });
    const body = createEl('div', { className: 'form-grid' }, [
      current,
      createEl('div', { className: 'gold-adjust-grid' }, [
        button('−10', () => adjust(-10), 'btn'),
        button('−1', () => adjust(-1), 'btn'),
        button('+1', () => adjust(1), 'btn'),
        button('+10', () => adjust(10), 'btn')
      ]),
      field('Dokładna wartość', exact)
    ]);
    const save = button('Zapisz złoto', () => {
      const value = Math.max(0, toInt(exact.value, draft));
      closeSheet();
      commitChange(`Zmieniono złoto: ${state.stats.gold} → ${value}`, next => { next.stats.gold = value; });
    }, 'btn btn-primary btn-block');
    openSheet({ title: 'Złoto', body, footer: save });
  }
'''
text = insert_before(text, '  function openArmorSheet() {', gold_sheet, "gold sheet")

# Panicked attacks
panic_attack_code = r'''

  function runItemAttack(item) {
    if (!item?.damageFormula) return null;
    if (!state.conditions.panicked) {
      return item.damageFormula.blast ? openBlastAttackSheet(item) : performDamageFormulaRoll(item);
    }
    const body = createEl('div', { className: 'sheet-list' }, [
      createEl('p', { text: 'Spanikowana postać wykonuje ataki jako osłabione. Zamiast kości broni użyj k4.' }),
      createEl('p', { className: 'help', text: 'Warden może rozstrzygnąć szczególną sytuację inaczej. Ochrona nie jest przywracana przez ten rzut.' })
    ]);
    const impaired = button('Rzuć osłabiony k4', () => {
      closeSheet();
      if (item.damageFormula.blast) openBlastAttackSheet(item, { impaired: true });
      else performRoll({ count: 1, sides: 4 }, `${item.name} — atak osłabiony przez panikę`);
    }, 'btn btn-primary');
    const override = button('Warden pozwala użyć broni', () => {
      closeSheet();
      if (item.damageFormula.blast) openBlastAttackSheet(item);
      else performDamageFormulaRoll(item);
    }, 'btn btn-ghost');
    openSheet({ title: 'Panika: atak osłabiony', body, footer: createEl('div', { className: 'button-row' }, [override, impaired]) });
    return null;
  }
'''
text = insert_before(text, '  function openBlastAttackSheet(sourceItem = null) {', panic_attack_code, "panicked attack choice")
text = replace_once(text, '  function openBlastAttackSheet(sourceItem = null) {', '  function openBlastAttackSheet(sourceItem = null, options = {}) {', "blast options signature")
text = replace_once(
    text,
    "    const blastItems = safeArray(state.inventory.items).filter(item => item.damageFormula?.blast && item.carryState !== 'spent');",
    "    const impaired = options.impaired === true;\n"
    "    const blastItems = safeArray(state.inventory.items).filter(item => item.damageFormula?.blast && item.carryState !== 'spent');",
    "blast impaired flag",
)
text = replace_once(
    text,
    "    const body = createEl('div', { className: 'form-grid' }, [\n      createEl('p', { text: 'Podmuch wpływa na wszystkie cele w obszarze. Dla każdego celu wykonuje się oddzielny rzut obrażeń.' }),\n      field('Źródło obrażeń', source),",
    "    const body = createEl('div', { className: 'form-grid' }, [\n"
    "      createEl('p', { text: 'Podmuch wpływa na wszystkie cele w obszarze. Dla każdego celu wykonuje się oddzielny rzut obrażeń.' }),\n"
    "      impaired ? createEl('div', { className: 'alert alert-info' }, [createEl('strong', { text: 'Atak osłabiony przez panikę' }), createEl('p', { className: 'small', text: 'Dla każdego celu zostanie rzucone k4 zamiast kości broni.' })]) : field('Źródło obrażeń', source),",
    "blast impaired UI",
)
text = replace_once(
    text,
    "      const item = blastItems.find(entry => entry.id === source.value);\n      const manualSide = source.value.startsWith('manual-d') ? toInt(source.value.slice(8), 6) : null;\n      const formula = item?.damageFormula || parseDamageFormulaNotation(`d${manualSide}`, true);",
    "      const item = impaired ? sourceItem : blastItems.find(entry => entry.id === source.value);\n"
    "      const manualSide = source.value.startsWith('manual-d') ? toInt(source.value.slice(8), 6) : null;\n"
    "      const formula = impaired ? parseDamageFormulaNotation('d4', true) : (item?.damageFormula || parseDamageFormulaNotation(`d${manualSide}`, true));",
    "blast impaired formula",
)
text = replace_once(
    text,
    "      const label = item?.name || `Podmuch ${formatDamageFormula(formula)}`;",
    "      const label = impaired ? `${item?.name || 'Podmuch'} — osłabiony` : (item?.name || `Podmuch ${formatDamageFormula(formula)}`);",
    "blast impaired label",
)
text = replace_once(
    text,
    "    if (item.damageFormula?.blast) footer.append(button(`Podmuch ${formatDamageFormula(item.damageFormula)}`, () => openBlastAttackSheet(item), 'btn btn-quiet'));\n    else if (item.damageFormula) footer.append(button(`Rzuć ${formatDamageFormula(item.damageFormula)}`, () => performDamageFormulaRoll(item), 'btn btn-quiet'));",
    "    if (item.damageFormula?.blast) footer.append(button(`Podmuch ${formatDamageFormula(item.damageFormula)}`, () => runItemAttack(item), 'btn btn-quiet'));\n"
    "    else if (item.damageFormula) footer.append(button(`Rzuć ${formatDamageFormula(item.damageFormula)}`, () => runItemAttack(item), 'btn btn-quiet'));",
    "item attacks use panic guard",
)

# Dice history and strict multiple attackers
text = replace_once(
    text,
    "      createEl('div', {\n        className: 'dice-result dice-result-inline',\n        id: 'diceResult',\n        attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' }\n      }, [createEl('div', {}, [createEl('strong', { text: '—' }), createEl('span', { text: 'Ostatni wynik' })])])",
    "      createEl('button', {\n"
    "        type: 'button',\n"
    "        className: 'dice-result dice-result-inline dice-result-button',\n"
    "        id: 'diceResult',\n"
    "        disabled: !safeArray(state.diceHistory).length,\n"
    "        attrs: { 'aria-live': 'polite', 'aria-atomic': 'true', 'aria-label': safeArray(state.diceHistory).length ? 'Otwórz historię rzutów' : 'Brak historii rzutów' },\n"
    "        onclick: openDiceHistorySheet\n"
    "      }, [createEl('div', {}, [createEl('strong', { text: '—' }), createEl('span', { text: safeArray(state.diceHistory).length ? 'Dotknij: historia' : 'Ostatni wynik' })])])",
    "dice result opens history",
)

dice_history_sheet = r'''

  function openDiceHistorySheet() {
    const entries = safeArray(state.diceHistory);
    const body = createEl('div', { className: 'dice-history-sheet-list' });
    if (!entries.length) body.append(createEl('p', { className: 'muted', text: 'Brak zapisanych rzutów.' }));
    for (const entry of entries) {
      body.append(createEl('div', { className: 'dice-history-item' }, [
        createEl('p', { text: entry.summary }),
        entry.details ? createEl('p', { className: 'muted small', text: entry.details }) : null,
        createEl('time', { text: formatDateTime(entry.time), dateTime: entry.time })
      ]));
    }
    const footer = entries.length
      ? createEl('div', { className: 'button-row' }, [button('Zamknij', closeSheet, 'btn btn-primary'), button('Wyczyść historię', () => { closeSheet(); confirmClearDiceHistory(); }, 'btn btn-danger')])
      : button('Zamknij', closeSheet, 'btn btn-primary btn-block');
    openSheet({ title: 'Historia rzutów', body, footer });
  }
'''
text = insert_before(text, '  function performFateRoll() {', dice_history_sheet, "dice history sheet")

old_many = r'''      const matches = notation.value.toLowerCase().match(/k(4|6|8|10|12)/g) || [];
      if (!matches.length || matches.length > 20) { showToast('Wpisz od 1 do 20 prawidłowych kości.', 'error'); return; }
      const results = matches.map(token => ({ token, value: rollDie(toInt(token.slice(1), 6)) }));
      const high = Math.max(...results.map(result => result.value));
      const details = results.map(result => `${result.token}: ${result.value}`).join(', ');
      const summary = `Wielu atakujących: ${high} — najwyższy wynik`;
      addDiceHistory({ type: 'dice', label: 'Wielu atakujących', summary, notation: matches.join('+'), result: high, details });'''
new_many = r'''      const parsed = parseAttackDiceList(notation.value);
      if (!parsed) { showToast('Wpisz od 1 do 20 kości w formacie k6, k8, k6.', 'error'); return; }
      const results = parsed.map(entry => ({ token: entry.token, value: rollDie(entry.sides) }));
      const high = Math.max(...results.map(result => result.value));
      const details = results.map(result => `${result.token}: ${result.value}`).join(', ');
      const summary = `Wielu atakujących: ${high} — najwyższy wynik`;
      addDiceHistory({ type: 'dice', label: 'Wielu atakujących', summary, notation: parsed.map(entry => entry.token).join('+'), result: high, details });'''
text = replace_once(text, old_many, new_many, "strict multiple attackers")

# More screen and accessible toggles
text = replace_once(
    text,
    "      settings.append(createEl('div', { className: 'settings-row' }, [createEl('div', {}, [createEl('strong', { text: label }), createEl('p', { className: 'help', text: conditionHelp(key) })]), toggle]));",
    "      settings.append(createEl('label', { className: 'settings-row settings-row-toggle' }, [createEl('div', {}, [createEl('strong', { text: label }), createEl('p', { className: 'help', text: conditionHelp(key) })]), toggle]));",
    "accessible condition toggles",
)
text = replace_once(
    text,
    "    dataCard.append(createEl('p', { className: 'help', text: 'Dane są zapisane wyłącznie w tej przeglądarce i na tym urządzeniu. Mogą zniknąć po wyczyszczeniu danych przeglądarki. Regularnie pobieraj kopię JSON.' }));\n    dataCard.append(createEl('div', { className: 'button-row' }, [\n      button('Eksportuj kopię', exportBackup, 'btn btn-primary'),\n      button('Eksport postaci', exportCharacterJson, 'btn'),\n      button('Import Kettlewright', () => $('#importFileInput').click(), 'btn'),\n      button('Import kopii', () => $('#backupFileInput').click(), 'btn')\n    ]));",
    "    dataCard.append(createEl('p', { className: 'help', text: 'Dane są zapisane wyłącznie w tej przeglądarce i na tym urządzeniu. Aplikacja działa offline po pierwszym poprawnym otwarciu, ale wyczyszczenie danych przeglądarki nadal usuwa kartę.' }));\n"
    "    dataCard.append(createEl('div', { className: 'data-status' }, [\n"
    "      createEl('strong', { text: backupMeta.lastBackupAt ? `Ostatnia pełna kopia: ${formatDateTime(backupMeta.lastBackupAt)}` : 'Brak potwierdzonej kopii zapasowej' }),\n"
    "      createEl('span', { text: `${backupMeta.meaningfulChangesSinceBackup} zmian od ostatniej kopii. Eksport zawiera całą aktywną postać i może zostać ponownie zaimportowany.` })\n"
    "    ]));\n"
    "    dataCard.append(createEl('div', { className: 'button-row' }, [\n"
    "      button('Pobierz pełną kopię', exportBackup, 'btn btn-primary'),\n"
    "      button('Import Kettlewright', () => $('#importFileInput').click(), 'btn'),\n"
    "      button('Odtwórz pełną kopię', () => $('#backupFileInput').click(), 'btn')\n"
    "    ]));",
    "safe data card",
)
text = replace_once(
    text,
    "    const appSettings = createEl('div', { className: 'settings-list' }, [\n      createEl('div', { className: 'settings-row' }, [createEl('div', {}, [createEl('strong', { text: 'Jasny motyw' }), createEl('p', { className: 'help', text: 'Ciemny pozostaje domyślny.' })]), themeToggle]),",
    "    const appSettings = createEl('div', { className: 'settings-list' }, [\n"
    "      createEl('label', { className: 'settings-row settings-row-toggle' }, [createEl('div', {}, [createEl('strong', { text: 'Jasny motyw' }), createEl('p', { className: 'help', text: 'Ciemny pozostaje domyślny.' })]), themeToggle]),\n"
    "      createEl('div', { className: 'settings-row' }, [createEl('div', {}, [createEl('strong', { text: 'Instalacja i offline' }), createEl('p', { className: 'help', text: deferredInstallPrompt ? 'Przeglądarka pozwala zainstalować kartę jako aplikację.' : 'Po pierwszym otwarciu karta jest buforowana do pracy bez sieci. Na iPhonie użyj Udostępnij → Do ekranu początkowego.' })]), button(deferredInstallPrompt ? 'Zainstaluj' : 'Instrukcja', deferredInstallPrompt ? installApp : openInstallHelp, 'btn btn-quiet btn-ghost')]),",
    "app install row",
)
text = replace_once(text, "      deprived: 'Blokuje odzyskiwanie Ochrony, atrybutów i zmęczenia.',", "      deprived: 'Brak kluczowej potrzeby blokuje odzyskiwanie Ochrony, atrybutów i zmęczenia.',", "deprived help")
text = replace_once(
    text,
    "onConfirm: () => { try { localStorage.removeItem(STORAGE_KEY); } catch {} state = createDefaultState(); saveNow(); setView('character'); renderAll(); showToast('Karta została wyczyszczona.'); }",
    "onConfirm: () => { try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(BACKUP_META_KEY); } catch {} backupMeta = createDefaultBackupMeta(); state = createDefaultState(); saveNow(); setView('character'); renderAll(); showToast('Karta została wyczyszczona.'); }",
    "reset backup meta",
)

# PWA install and Service Worker registration
pwa_functions = r'''

  function openInstallHelp() {
    const body = createEl('div', { className: 'sheet-list' }, [
      createEl('p', { text: 'Po pierwszym poprawnym otwarciu Service Worker zachowuje pliki aplikacji do ponownego uruchomienia bez sieci.' }),
      createEl('ol', { className: 'install-help-list' }, [
        createEl('li', { text: 'iPhone/iPad: otwórz menu Udostępnij w Safari i wybierz „Do ekranu początkowego”.' }),
        createEl('li', { text: 'Android/Chrome: użyj „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”.' }),
        createEl('li', { text: 'Po aktualizacji otwórz aplikację raz z internetem, aby pobrać nową wersję.' })
      ]),
      createEl('p', { className: 'help', text: 'Tryb offline nie jest kopią zapasową. Dane postaci nadal są lokalne i mogą zniknąć po wyczyszczeniu pamięci przeglądarki.' })
    ]);
    openSheet({ title: 'Instalacja i działanie offline', body, footer: button('Zamknij', closeSheet, 'btn btn-primary btn-block') });
  }

  async function installApp() {
    if (!deferredInstallPrompt) { openInstallHelp(); return; }
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch {}
    deferredInstallPrompt = null;
    renderMoreView();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./service-worker.js').catch(error => {
      loadWarning = `Nie udało się przygotować trybu offline: ${error.message}`;
      showToast(loadWarning, 'error');
    });
  }
'''
text = insert_before(text, '  function bindEvents() {', pwa_functions, "PWA functions")
text = replace_once(
    text,
    "  function bindEvents() {\n    for (const nav of $$('[data-nav]')) nav.addEventListener('click', () => setView(nav.dataset.nav));",
    "  function bindEvents() {\n"
    "    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; renderMoreView(); });\n"
    "    window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; renderMoreView(); showToast('Aplikacja została zainstalowana.'); });\n"
    "    for (const nav of $$('[data-nav]')) nav.addEventListener('click', () => setView(nav.dataset.nav));",
    "PWA events",
)
text = replace_once(
    text,
    "  function initialize() {\n    state = loadState();\n    bindEvents();",
    "  function initialize() {\n"
    "    state = loadState();\n"
    "    backupMeta = loadBackupMeta();\n"
    "    bindEvents();",
    "load backup metadata",
)
text = replace_once(
    text,
    "    renderAll();\n    setView('character');\n    if (loadWarning) showToast(loadWarning, 'error');",
    "    renderAll();\n"
    "    setView('character');\n"
    "    registerServiceWorker();\n"
    "    if (loadWarning) showToast(loadWarning, 'error');",
    "register service worker",
)

# Developer tests and public debug API
additional_tests = r'''
    test('55. Parser wielu atakujących wymaga pełnej, poprawnej listy', () => { const valid = parseAttackDiceList('k6, k8, k6'); assert(valid?.map(entry => entry.sides).join(',') === '6,8,6'); assert(parseAttackDiceList('tekst k6') === null); assert(parseAttackDiceList('k6, k20') === null); });
    test('56. Pełna kopia przechodzi bezstratny round-trip', () => { const fixture = createDemoState(); fixture.conditions.panicked = true; fixture.scars.push({ id:'scar', text:'Testowa blizna' }); const payload = buildBackupPayload(fixture); const parsed = parseImportText(JSON.stringify(payload)); assert(parsed.type === 'backup' && parsed.candidate?.identity.name === fixture.identity.name && parsed.candidate.inventory.items.length === fixture.inventory.items.length && parsed.candidate.conditions.panicked && parsed.candidate.scars.length === 1); });
    test('57. Starszy eksport z polem character jest odzyskiwany', () => { const fixture = createDemoState(); const legacy = { appId:APP_ID, schemaVersion:2, exportedAt:nowIso(), character:{ identity:fixture.identity, stats:fixture.stats, inventory:fixture.inventory, conditions:fixture.conditions, scars:fixture.scars, notes:fixture.notes }, source:fixture.source }; const parsed = parseImportText(JSON.stringify(legacy)); assert(parsed.candidate?.initialized && parsed.candidate.identity.name === fixture.identity.name && parsed.report.manual.some(entry => /starszego przycisku/.test(entry))); });
    test('58. Niepełna własna kopia nie może utworzyć pustej karty', () => { const parsed = parseImportText(JSON.stringify({ appId:APP_ID, schemaVersion:2, identity:{name:'Niepełna'} })); assert(!parsed.candidate && parsed.report.errors.length >= 2); });
    test('59. Rzut nie zużywa historii Undo', () => { const fixture = createDefaultState(); fixture.changeHistory = [{ id:'change', undoable:true }]; recordDiceEntry(fixture, { summary:'k6: 4' }); assert(fixture.changeHistory.length === 1 && fixture.diceHistory.length === 1); });
    test('60. Przypomnienie backupu zależy od zmian, czasu i drzemki', () => { const fixture = createDemoState(); assert(shouldShowBackupReminder({ lastBackupAt:null, meaningfulChangesSinceBackup:10, snoozedAt:null }, fixture)); assert(!shouldShowBackupReminder({ lastBackupAt:null, meaningfulChangesSinceBackup:9, snoozedAt:null }, fixture)); assert(!shouldShowBackupReminder({ lastBackupAt:null, meaningfulChangesSinceBackup:20, snoozedAt:nowIso() }, fixture)); });
    test('61. Etykiety Blizn 7 i 8 odpowiadają skutkom reguł', () => { assert(SCAR_GUIDE[7].title === 'Uszkodzone ścięgno' && SCAR_GUIDE[8].title === 'Ogłuchnięcie'); });
    test('62. Dokument deklaruje manifest i ikonę aplikacji', () => { assert(Boolean(document.querySelector('link[rel="manifest"]')) && Boolean(document.querySelector('link[rel="icon"]'))); });
    test('63. Wynik kości udostępnia historię w kontekście', () => { renderDiceView(); assert($('#diceResult')?.tagName === 'BUTTON' && typeof openDiceHistorySheet === 'function'); });
    test('64. Atak przedmiotem przechodzi przez straż paniki', () => { assert(renderItemCard.toString().includes('runItemAttack') && runItemAttack.toString().includes('atak osłabiony')); });
'''
text = replace_once(text, "    test('54. Kość Losu prezentuje pojedynczy wynik', () => { assert((performFateRoll.toString().match(/renderDiceResult/g) || []).length === 1 && !performFateRoll.toString().includes('performRoll(')); });\n    return results;", "    test('54. Kość Losu prezentuje pojedynczy wynik', () => { assert((performFateRoll.toString().match(/renderDiceResult/g) || []).length === 1 && !performFateRoll.toString().includes('performRoll(')); });\n" + additional_tests + "    return results;", "additional tests")
text = replace_once(
    text,
    "      getScarGuide\n    };",
    "      getScarGuide,\n"
    "      parseImportText,\n"
    "      buildBackupPayload,\n"
    "      convertLegacyCharacterExport,\n"
    "      validateRawBackupShape,\n"
    "      recordDiceEntry,\n"
    "      parseAttackDiceList,\n"
    "      shouldShowBackupReminder,\n"
    "      createDemoState\n"
    "    };",
    "debug API",
)

INDEX.write_text(text, encoding="utf-8")

# Static PWA assets
manifest = {
    "name": "Karta Wędrowca — Cairn 2e",
    "short_name": "Karta Cairn",
    "description": "Lokalna, mobilna karta jednej postaci do Cairn 2e.",
    "lang": "pl",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "background_color": "#141116",
    "theme_color": "#17131a",
    "orientation": "portrait-primary",
    "icons": [{"src": "./icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable"}],
}
(ROOT / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

(ROOT / "icon.svg").write_text(r'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#17131a"/>
  <path d="M256 72 406 168v176L256 440 106 344V168Z" fill="#29212d" stroke="#b4c99f" stroke-width="18"/>
  <path d="m256 128 92 58-35 108-114 0-35-108Z" fill="none" stroke="#f2c47f" stroke-width="16" stroke-linejoin="round"/>
  <circle cx="220" cy="224" r="13" fill="#b4c99f"/>
  <circle cx="292" cy="276" r="13" fill="#b4c99f"/>
  <path d="M256 128v58M348 186l-55 40M313 294l-57-42M199 294l57-42M164 186l55 40" fill="none" stroke="#887d8b" stroke-width="12" stroke-linecap="round"/>
</svg>
''', encoding="utf-8")

(ROOT / "service-worker.js").write_text(r'''const CACHE_NAME = 'cairn-mobile-sheet-v0.7.0';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './service-worker.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('cairn-mobile-sheet-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
      return response;
    }).catch(() => caches.match('./index.html').then(response => response || caches.match('./'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  })));
});
''', encoding="utf-8")

# Browser regression suite and CI
(ROOT / "package.json").write_text(json.dumps({
    "name": "cairn-2e-mobile-character-sheet",
    "version": "0.7.0",
    "private": True,
    "type": "module",
    "scripts": {"test": "playwright test", "test:ci": "playwright test --reporter=line"},
    "devDependencies": {"@playwright/test": "1.55.0"},
}, indent=2) + "\n", encoding="utf-8")

(ROOT / "playwright.config.mjs").write_text(r'''import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', locale: 'pl-PL', serviceWorkers: 'allow', trace: 'retain-on-failure' },
  webServer: { command: 'python3 -m http.server 4173 --bind 127.0.0.1', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['iPhone 12'], browserName: 'chromium' } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 12'], browserName: 'webkit' } }
  ]
});
''', encoding="utf-8")

(ROOT / "tests").mkdir(exist_ok=True)
(ROOT / "tests" / "app.spec.mjs").write_text(r'''import { test, expect } from '@playwright/test';

async function loadDemo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toBeVisible();
}

test('all embedded domain regression tests pass', async ({ page }) => {
  await page.goto('/?selftest=1');
  const marker = page.locator('#selftestMarker');
  await expect(marker).toHaveAttribute('data-passed', '64');
  await expect(marker).toHaveAttribute('data-total', '64');
});

test('full and legacy exports round-trip without losing character data', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const dev = globalThis.CairnSheetDev;
    const fixture = dev.createDemoState();
    fixture.stats.gold = 37;
    fixture.conditions.panicked = true;
    fixture.scars.push({ id: 's1', text: 'Blizna testowa' });
    const full = dev.parseImportText(JSON.stringify(dev.buildBackupPayload(fixture)));
    const legacy = dev.parseImportText(JSON.stringify({ appId: 'cairn-mobile-sheet', schemaVersion: 2, exportedAt: new Date().toISOString(), character: { identity: fixture.identity, stats: fixture.stats, inventory: fixture.inventory, conditions: fixture.conditions, scars: fixture.scars, notes: fixture.notes }, source: fixture.source }));
    return {
      full: { name: full.candidate?.identity.name, gold: full.candidate?.stats.gold, items: full.candidate?.inventory.items.length, scars: full.candidate?.scars.length },
      legacy: { name: legacy.candidate?.identity.name, gold: legacy.candidate?.stats.gold, items: legacy.candidate?.inventory.items.length, scars: legacy.candidate?.scars.length },
      malformedAccepted: Boolean(dev.parseImportText(JSON.stringify({ appId: 'cairn-mobile-sheet', schemaVersion: 2, identity: { name: 'x' } })).candidate)
    };
  });
  expect(result.full).toEqual({ name: 'Mara Ciernista', gold: 37, items: 5, scars: 1 });
  expect(result.legacy).toEqual(result.full);
  expect(result.malformedAccepted).toBe(false);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }, { width: 414, height: 896 }]) {
  test(`core screens have no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await loadDemo(page);
    for (const name of ['Postać', 'Ekwipunek', 'Kości', 'Więcej']) {
      await page.getByRole('button', { name, exact: true }).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
    const undersized = await page.locator('button:visible').evaluateAll(buttons => buttons.map(button => ({ label: button.getAttribute('aria-label') || button.textContent.trim(), rect: button.getBoundingClientRect() })).filter(entry => entry.rect.width < 44 || entry.rect.height < 44));
    expect(undersized).toEqual([]);
  });
}

test('reduced motion reveals a settled result immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadDemo(page);
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k20' }).click();
  await expect(page.locator('#diceResult')).not.toContainText('Kość w ruchu');
  await expect(page.locator('#diceResult strong')).not.toHaveText('—');
});

test('dice rolls do not consume undo history', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const fixture = globalThis.CairnSheetDev.createDemoState();
    fixture.changeHistory = [{ id: 'change', undoable: true }];
    globalThis.CairnSheetDev.recordDiceEntry(fixture, { summary: 'k6: 4' });
    return { changes: fixture.changeHistory.length, dice: fixture.diceHistory.length };
  });
  expect(result).toEqual({ changes: 1, dice: 1 });
});

test('application shell reloads while offline after Service Worker activation', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Offline Service Worker reload is covered in Chromium; WebKit covers layout and core logic.');
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Mobilna karta postaci')).toBeVisible();
  await context.setOffline(false);
});
''', encoding="utf-8")

(ROOT / ".github" / "workflows").mkdir(parents=True, exist_ok=True)
(ROOT / ".github" / "workflows" / "ci.yml").write_text(r'''name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  browser-regression:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Install browser engines
        run: npx playwright install --with-deps chromium webkit
      - name: Verify deployment checksums
        run: sha256sum -c checksums.sha256
      - name: Check inline JavaScript syntax
        shell: bash
        run: |
          python3 - <<'PY'
          from pathlib import Path
          html = Path('index.html').read_text(encoding='utf-8')
          script = html.rsplit('<script>', 1)[1].split('</script>', 1)[0]
          Path('/tmp/cairn-inline.js').write_text(script, encoding='utf-8')
          PY
          node --check /tmp/cairn-inline.js
      - name: Run browser regression suite
        run: npm run test:ci
''', encoding="utf-8")

(ROOT / ".github" / "workflows" / "deploy-pages.yml").write_text(r'''# Deployment workflow for the standalone Cairn 2e mobile character sheet.
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Prepare static site
        shell: bash
        run: |
          sha256sum -c checksums.sha256
          mkdir -p _site
          cp index.html .nojekyll manifest.webmanifest service-worker.js icon.svg _site/
      - name: Configure Pages
        uses: actions/configure-pages@v5
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: _site
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
''', encoding="utf-8")

(ROOT / "README.md").write_text(r'''# Cairn 2e Mobile Character Sheet

Lekka, mobilna karta jednej postaci do Cairn 2e. Aplikacja działa bez konta i backendu, a dane pozostają w pamięci przeglądarki.

## Aplikacja

https://leeroyjenkins1111.github.io/cairn-2e-mobile-character-sheet/

## Najważniejsze funkcje

- Ochrona, SIŁ, ZRE, WOL, pancerz, złoto i stany;
- rozliczanie obrażeń, Blizn i obrażeń krytycznych;
- ekwipunek, zmęczenie, drobiazgi, przedmioty nieporęczne i użycia;
- broń, podmuch, dwie bronie i wielu atakujących;
- kości, rzuty obronne, Kość Losu i historia rzutów;
- import postaci z JSON Kettlewright;
- pełna, odtwarzalna kopia zapasowa JSON;
- Undo dla zmian stanu postaci;
- instalacja jako lekka PWA i ponowne uruchomienie offline po pierwszym poprawnym otwarciu.

## Dane i kopie zapasowe

Dane są zapisywane wyłącznie w `localStorage` tej przeglądarki i urządzenia. Wyczyszczenie danych przeglądarki usuwa kartę. Regularnie używaj przycisku **Pobierz pełną kopię**.

Wersja 0.7.0 potrafi również odtworzyć starsze pliki `cairn-*-eksport.json` wygenerowane przez wersję 0.6.0.

## Uruchomienie lokalne

```bash
python3 -m http.server 4173
```

Następnie otwórz `http://127.0.0.1:4173`.

Samo otwarcie `index.html` nadal pozwala korzystać z podstawowej karty, ale Service Worker i test offline wymagają serwera HTTP.

## Testy

Runtime aplikacji nie ma zewnętrznych bibliotek. Playwright jest używany wyłącznie jako zależność deweloperska.

```bash
npm ci
npx playwright install chromium webkit
npm test
```

CI uruchamia testy domenowe osadzone w aplikacji, kontrolę składni, testy mobilnych viewportów, reduced motion, round-trip kopii oraz test offline.

## Publikacja

Zmiany w gałęzi `main` są wdrażane przez `.github/workflows/deploy-pages.yml`. Workflow weryfikuje `checksums.sha256` przed publikacją plików PWA.
''', encoding="utf-8")

assets = ["index.html", "manifest.webmanifest", "service-worker.js", "icon.svg"]
lines = []
for name in assets:
    digest = hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
    lines.append(f"{digest}  {name}")
(ROOT / "checksums.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8")

print("Applied product reliability, offline and session workflow enhancements.")
