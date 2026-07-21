from __future__ import annotations

from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


index_path = ROOT / "index.html"
index = index_path.read_text(encoding="utf-8")

checkpoint_css = r'''
    /* Local recovery checkpoints v0.12.0. */
    .recovery-checkpoint-list { display: grid; gap: 8px; }
    .recovery-checkpoint-item {
      min-width: 0;
      display: grid;
      gap: 8px;
      padding: 11px;
      border: 1px solid var(--line);
      border-radius: 13px;
      background: var(--surface-soft);
    }
    .recovery-checkpoint-head {
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: start;
    }
    .recovery-checkpoint-head strong,
    .recovery-checkpoint-head span { overflow-wrap: anywhere; }
    .recovery-checkpoint-copy { min-width: 0; display: grid; gap: 3px; }
    .recovery-checkpoint-copy p { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.35; }
    .recovery-checkpoint-copy time { color: var(--faint); font-size: 0.66rem; }
    .recovery-checkpoint-actions {
      min-width: 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 7px;
    }
    .recovery-checkpoint-actions .btn { min-width: 0; padding-inline: 8px; }
    .recovery-checkpoint-empty { margin: 0; color: var(--muted); font-size: 0.82rem; line-height: 1.45; }

    @media (max-width: 350px) {
      .recovery-checkpoint-head { grid-template-columns: 1fr; }
      .recovery-checkpoint-actions { grid-template-columns: 1fr; }
    }

'''
index = replace_once(index, "\n  </style>", checkpoint_css + "  </style>", "checkpoint CSS")

index = replace_once(
    index,
    "  const RECOVERY_KEY = `${APP_ID}:recovery`;\n  const BACKUP_META_KEY = `${APP_ID}:backup-meta`;",
    "  const RECOVERY_KEY = `${APP_ID}:recovery`;\n  const CHECKPOINTS_KEY = `${APP_ID}:checkpoints`;\n  const BACKUP_META_KEY = `${APP_ID}:backup-meta`;",
    "checkpoint storage key",
)
index = replace_once(
    index,
    "  const SESSION_ARCHIVE_LIMIT = 20;\n  const SESSION_EVENT_LIMIT = 500;",
    "  const SESSION_ARCHIVE_LIMIT = 20;\n  const SESSION_EVENT_LIMIT = 500;\n  const CHECKPOINT_LIMIT = 3;",
    "checkpoint limit",
)
index = replace_once(index, "  const APP_VERSION = '0.11.0';", "  const APP_VERSION = '0.12.0';", "app version")

index = replace_once(
    index,
    "  let backupMeta = createDefaultBackupMeta();\n  let deferredInstallPrompt = null;",
    "  let backupMeta = createDefaultBackupMeta();\n  let recoveryCheckpoints = [];\n  let deferredInstallPrompt = null;",
    "checkpoint state variable",
)

storage_marker = '''  function safeStorageGet(key) {
    try { return localStorage.getItem(key); }
    catch { return null; }
  }



'''
storage_code = r'''  function safeStorageGet(key) {
    try { return localStorage.getItem(key); }
    catch { return null; }
  }


  function checkpointTimestamp(value) {
    const timestamp = Date.parse(trimText(value));
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function normalizeRecoveryCheckpoint(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const createdAt = trimText(value.createdAt);
    if (checkpointTimestamp(createdAt) === null) return null;
    const rawValidation = validateRawBackupShape(value.payload);
    if (!rawValidation.valid) return null;
    try {
      const candidate = sanitizeLoadedState(value.payload);
      const validation = validateState(candidate);
      if (!validation.valid) return null;
      const payload = deepClone(candidate);
      payload.appId = APP_ID;
      payload.schemaVersion = SCHEMA_VERSION;
      payload.appVersion = APP_VERSION;
      return {
        id: trimText(value.id) || makeId(),
        createdAt,
        reason: trimText(value.reason, 'Punkt odzyskiwania').slice(0, 200),
        characterName: trimText(value.characterName, candidate.identity?.name || 'Postać').slice(0, 200),
        appVersion: trimText(value.appVersion, payload.appVersion),
        schemaVersion: toInt(value.schemaVersion, payload.schemaVersion),
        payload
      };
    } catch {
      return null;
    }
  }

  function normalizeRecoveryCheckpoints(value, limit = CHECKPOINT_LIMIT) {
    const seen = new Set();
    return safeArray(value)
      .map(normalizeRecoveryCheckpoint)
      .filter(checkpoint => {
        if (!checkpoint || seen.has(checkpoint.id)) return false;
        seen.add(checkpoint.id);
        return true;
      })
      .sort((a, b) => checkpointTimestamp(b.createdAt) - checkpointTimestamp(a.createdAt))
      .slice(0, clamp(toInt(limit, CHECKPOINT_LIMIT), 1, CHECKPOINT_LIMIT));
  }

  function createRecoveryCheckpointRecord(sourceState, reason = 'Ręczny punkt odzyskiwania', createdAt = nowIso()) {
    if (!sourceState?.initialized || checkpointTimestamp(createdAt) === null) return null;
    return normalizeRecoveryCheckpoint({
      id: makeId(),
      createdAt,
      reason,
      characterName: sourceState.identity?.name || 'Postać',
      appVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      payload: buildBackupPayload(sourceState)
    });
  }

  function addRecoveryCheckpointRecord(records, checkpoint) {
    if (!checkpoint) return normalizeRecoveryCheckpoints(records);
    return normalizeRecoveryCheckpoints([checkpoint, ...safeArray(records)]);
  }

  function recoveryCheckpointState(checkpoint) {
    const normalized = normalizeRecoveryCheckpoint(checkpoint);
    return normalized ? sanitizeLoadedState(deepClone(normalized.payload)) : null;
  }

  function loadRecoveryCheckpoints() {
    if (!canUseStorage()) return [];
    const raw = safeStorageGet(CHECKPOINTS_KEY);
    if (!raw) return [];
    try {
      return normalizeRecoveryCheckpoints(JSON.parse(raw));
    } catch {
      loadWarning = [loadWarning, 'Nie udało się odczytać lokalnych punktów odzyskiwania. Aktywna karta nie została zmieniona.'].filter(Boolean).join(' ');
      return [];
    }
  }

  function persistRecoveryCheckpoints(records) {
    if (storageBlocked) return null;
    const normalized = normalizeRecoveryCheckpoints(records);
    try {
      localStorage.setItem(CHECKPOINTS_KEY, JSON.stringify(normalized));
      return normalized;
    } catch {
      return null;
    }
  }

  function createRecoveryCheckpoint(reason = 'Ręczny punkt odzyskiwania', sourceState = state) {
    const checkpoint = createRecoveryCheckpointRecord(sourceState, reason);
    if (!checkpoint) return null;
    const persisted = persistRecoveryCheckpoints(addRecoveryCheckpointRecord(recoveryCheckpoints, checkpoint));
    if (!persisted) return null;
    recoveryCheckpoints = persisted;
    return recoveryCheckpoints.find(entry => entry.id === checkpoint.id) || checkpoint;
  }

  function ensureRecoveryCheckpoint(reason, sourceState = state) {
    if (!sourceState?.initialized) return true;
    const checkpoint = createRecoveryCheckpoint(reason, sourceState);
    if (checkpoint) return true;
    showToast('Nie udało się utworzyć punktu odzyskiwania. Operacja została przerwana, aby nie utracić danych.', 'error');
    announce('Operacja przerwana: nie udało się zabezpieczyć bieżącej karty.');
    return false;
  }

  function deleteRecoveryCheckpointById(checkpointId) {
    const persisted = persistRecoveryCheckpoints(recoveryCheckpoints.filter(checkpoint => checkpoint.id !== checkpointId));
    if (!persisted) return false;
    recoveryCheckpoints = persisted;
    return true;
  }


'''
index = replace_once(index, storage_marker, storage_code, "checkpoint storage helpers")

old_import = '''  function applyPendingImport() {
    if (!pendingImport?.candidate || pendingImport.report.errors.length) return;
    const importedType = pendingImport.type;
    const imported = deepClone(pendingImport.candidate);
    imported.settings = { ...state.settings, ...imported.settings };
    imported.updatedAt = nowIso();
    state = imported;
    if (importedType === 'backup') markBackupImported();
    else { backupMeta = createDefaultBackupMeta(); saveBackupMeta(); }
    pendingImport = null;
    saveNow();
    closeSheet();
    setView('character');
    renderAll();
    showToast('Zaimportowano postać.');
    announce('Import postaci zakończony.');
  }
'''
new_import = '''  function applyPendingImport() {
    if (!pendingImport?.candidate || pendingImport.report.errors.length) return;
    const checkpointReason = `Przed importem: ${trimText(pendingImport.filename, pendingImport.candidate.identity?.name || 'nowa karta')}`;
    if (!ensureRecoveryCheckpoint(checkpointReason)) return;
    const importedType = pendingImport.type;
    const imported = deepClone(pendingImport.candidate);
    imported.settings = { ...state.settings, ...imported.settings };
    imported.updatedAt = nowIso();
    state = imported;
    if (importedType === 'backup') markBackupImported();
    else { backupMeta = createDefaultBackupMeta(); saveBackupMeta(); }
    pendingImport = null;
    saveNow();
    closeSheet();
    setView('character');
    renderAll();
    showToast('Zaimportowano postać. Poprzednia karta została zachowana jako punkt odzyskiwania.');
    announce('Import postaci zakończony. Poprzednia karta została zabezpieczona.');
  }
'''
index = replace_once(index, old_import, new_import, "checkpoint before import")

old_reset = '''  function openResetSheet() {
    const phrase = textInput('', 20);
    const body = createEl('div', { className: 'form-grid' }, [createEl('p', { text: 'Reset usuwa aktywną kartę, ekwipunek, historię i źródło importu z tej przeglądarki. Najpierw pobierz kopię zapasową.' }), field('Wpisz USUŃ', phrase)]);
    const reset = button('Usuń wszystkie dane karty', () => {
      if (phrase.value !== 'USUŃ') { showToast('Wpisz dokładnie: USUŃ', 'error'); return; }
      openConfirmSheet({ title: 'Ostatnie potwierdzenie', message: 'Czy na pewno całkowicie wyczyścić kartę?', confirmLabel: 'Tak, usuń wszystko', danger: true, onConfirm: () => { try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(BACKUP_META_KEY); } catch {} backupMeta = createDefaultBackupMeta(); state = createDefaultState(); saveNow(); setView('character'); renderAll(); showToast('Karta została wyczyszczona.'); } });
    }, 'btn btn-danger btn-block');
    openSheet({ title: 'Reset karty', body, footer: reset });
  }
'''
new_reset = '''  function openResetSheet() {
    const phrase = textInput('', 20);
    const body = createEl('div', { className: 'form-grid' }, [
      createEl('p', { text: 'Reset usuwa aktywną kartę, ekwipunek, historię i źródło importu. Przed resetem aplikacja spróbuje zachować lokalny punkt odzyskiwania.' }),
      createEl('p', { className: 'help', text: 'Punkt odzyskiwania pozostaje tylko w tej przeglądarce i nie zastępuje pobranej kopii JSON.' }),
      field('Wpisz USUŃ', phrase)
    ]);
    const reset = button('Usuń wszystkie dane karty', () => {
      if (phrase.value !== 'USUŃ') { showToast('Wpisz dokładnie: USUŃ', 'error'); return; }
      openConfirmSheet({
        title: 'Ostatnie potwierdzenie',
        message: 'Czy na pewno wyczyścić aktywną kartę? Operacja zostanie wykonana tylko wtedy, gdy bieżące dane uda się zapisać jako punkt odzyskiwania.',
        confirmLabel: 'Tak, zabezpiecz i usuń',
        danger: true,
        onConfirm: () => {
          if (!ensureRecoveryCheckpoint('Przed resetem karty')) return;
          try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(BACKUP_META_KEY);
          } catch {}
          backupMeta = createDefaultBackupMeta();
          state = createDefaultState();
          saveNow();
          setView('character');
          renderAll();
          showToast('Karta została wyczyszczona. Poprzedni stan zachowano w punktach odzyskiwania.');
        }
      });
    }, 'btn btn-danger btn-block');
    openSheet({ title: 'Reset karty', body, footer: reset });
  }
'''
index = replace_once(index, old_reset, new_reset, "checkpoint before reset")

settings_marker = '''  function openAppSettingsSheet() {
'''
settings_helpers = r'''  function recoveryCheckpointFileStem(checkpoint) {
    const value = trimText(checkpoint?.characterName, 'postac')
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    return value || 'postac';
  }

  function downloadRecoveryCheckpoint(checkpointId) {
    const checkpoint = recoveryCheckpoints.find(entry => entry.id === checkpointId);
    if (!checkpoint) { showToast('Nie znaleziono punktu odzyskiwania.', 'error'); return; }
    const date = checkpoint.createdAt.slice(0, 10);
    downloadTextFile(`cairn-${recoveryCheckpointFileStem(checkpoint)}-punkt-${date}.json`, JSON.stringify(checkpoint.payload, null, 2));
    showToast('Pobrano punkt odzyskiwania jako pełną kopię JSON.');
  }

  function reopenRecoveryCheckpointsSheet() {
    requestAnimationFrame(openRecoveryCheckpointsSheet);
  }

  function confirmDeleteRecoveryCheckpoint(checkpointId) {
    const checkpoint = recoveryCheckpoints.find(entry => entry.id === checkpointId);
    if (!checkpoint) { showToast('Nie znaleziono punktu odzyskiwania.', 'error'); return; }
    openConfirmSheet({
      title: 'Usuń punkt odzyskiwania',
      message: `Usunąć punkt „${checkpoint.characterName}” z ${formatDateTime(checkpoint.createdAt)}? Tej operacji nie można cofnąć.`,
      confirmLabel: 'Usuń punkt',
      danger: true,
      onConfirm: () => {
        if (!deleteRecoveryCheckpointById(checkpointId)) {
          showToast('Nie udało się usunąć punktu odzyskiwania.', 'error');
          return;
        }
        showToast('Usunięto punkt odzyskiwania.');
        reopenRecoveryCheckpointsSheet();
      }
    });
  }

  function confirmRestoreRecoveryCheckpoint(checkpointId) {
    const checkpoint = recoveryCheckpoints.find(entry => entry.id === checkpointId);
    if (!checkpoint) { showToast('Nie znaleziono punktu odzyskiwania.', 'error'); return; }
    openConfirmSheet({
      title: 'Odtwórz punkt odzyskiwania',
      message: `Odtworzyć „${checkpoint.characterName}” z ${formatDateTime(checkpoint.createdAt)}? Bieżąca karta zostanie wcześniej zabezpieczona jako nowy punkt.`,
      confirmLabel: 'Odtwórz punkt',
      danger: true,
      onConfirm: () => {
        if (!ensureRecoveryCheckpoint(`Przed odtworzeniem: ${checkpoint.characterName}`)) return;
        const restored = recoveryCheckpointState(checkpoint);
        if (!restored) {
          showToast('Punkt odzyskiwania jest uszkodzony i nie może zostać odtworzony.', 'error');
          return;
        }
        state = restored;
        recordMeaningfulChange();
        saveNow();
        setView('character');
        renderAll();
        showToast(`Odtworzono punkt: ${checkpoint.characterName}.`);
        announce('Odtworzono lokalny punkt odzyskiwania.');
      }
    });
  }

  function openRecoveryCheckpointsSheet() {
    const body = createEl('div', { className: 'sheet-list' });
    body.append(
      createEl('p', { text: 'Punkty odzyskiwania chronią przed przypadkowym importem, resetem lub błędnym odtworzeniem. Są przechowywane wyłącznie lokalnie.' }),
      createEl('p', { className: 'help', text: 'Aplikacja zachowuje trzy najnowsze punkty. Wyczyszczenie danych przeglądarki usuwa również je, dlatego nadal pobieraj pełne kopie JSON.' })
    );

    const createButton = button('Utwórz punkt odzyskiwania', () => {
      const checkpoint = createRecoveryCheckpoint('Ręczny punkt odzyskiwania');
      if (!checkpoint) {
        showToast(state.initialized ? 'Nie udało się utworzyć punktu odzyskiwania.' : 'Najpierw utwórz lub zaimportuj postać.', 'error');
        return;
      }
      closeSheet();
      showToast('Utworzono lokalny punkt odzyskiwania.');
      reopenRecoveryCheckpointsSheet();
    }, 'btn btn-primary btn-block', { disabled: !state.initialized });
    body.append(createButton);

    const list = createEl('div', { className: 'recovery-checkpoint-list' });
    if (!recoveryCheckpoints.length) {
      list.append(createEl('p', { className: 'recovery-checkpoint-empty', text: 'Brak punktów odzyskiwania.' }));
    }
    for (const checkpoint of recoveryCheckpoints) {
      list.append(createEl('article', { className: 'recovery-checkpoint-item', dataset: { checkpointId: checkpoint.id } }, [
        createEl('div', { className: 'recovery-checkpoint-head' }, [
          createEl('div', { className: 'recovery-checkpoint-copy' }, [
            createEl('strong', { text: checkpoint.characterName }),
            createEl('p', { text: checkpoint.reason }),
            createEl('time', { text: formatDateTime(checkpoint.createdAt), dateTime: checkpoint.createdAt })
          ]),
          createEl('span', { className: 'tag', text: `schemat ${checkpoint.schemaVersion}` })
        ]),
        createEl('div', { className: 'recovery-checkpoint-actions' }, [
          button('Odtwórz', () => confirmRestoreRecoveryCheckpoint(checkpoint.id), 'btn btn-primary', { 'aria-label': `Odtwórz punkt odzyskiwania: ${checkpoint.characterName}` }),
          button('Pobierz', () => downloadRecoveryCheckpoint(checkpoint.id), 'btn', { 'aria-label': `Pobierz punkt odzyskiwania: ${checkpoint.characterName}` }),
          button('Usuń', () => confirmDeleteRecoveryCheckpoint(checkpoint.id), 'btn btn-danger', { 'aria-label': `Usuń punkt odzyskiwania: ${checkpoint.characterName}` })
        ])
      ]));
    }
    body.append(list);
    openSheet({
      title: 'Punkty odzyskiwania',
      body,
      footer: button('Zamknij', closeSheet, 'btn btn-primary btn-block')
    });
  }


  function openAppSettingsSheet() {
'''
index = replace_once(index, settings_marker, settings_helpers, "checkpoint settings helpers")

data_section_marker = "    body.append(settingsSection('Dane i kopie zapasowe', dataChildren));\n"
data_section_replacement = '''    body.append(settingsSection('Dane i kopie zapasowe', dataChildren));
    body.append(settingsSection('Punkty odzyskiwania', [
      createEl('p', { text: 'Do trzech lokalnych stanów karty przed importem, resetem lub odtworzeniem. Nie zastępują kopii pobranej na urządzenie.' }),
      createEl('div', { className: 'data-status' }, [
        createEl('strong', { text: `${recoveryCheckpoints.length}/${CHECKPOINT_LIMIT} punktów` }),
        createEl('span', { text: recoveryCheckpoints[0] ? `Najnowszy: ${formatDateTime(recoveryCheckpoints[0].createdAt)}` : 'Brak lokalnego punktu odzyskiwania.' })
      ]),
      button('Zarządzaj punktami odzyskiwania', openRecoveryCheckpointsSheet, 'btn btn-block')
    ]));
'''
index = replace_once(index, data_section_marker, data_section_replacement, "checkpoint settings section")

index = replace_once(
    index,
    "    state = loadState();\n    backupMeta = loadBackupMeta();\n    bindEvents();",
    "    state = loadState();\n    backupMeta = loadBackupMeta();\n    recoveryCheckpoints = loadRecoveryCheckpoints();\n    bindEvents();",
    "load checkpoints at initialization",
)

dev_marker = '''      shouldShowBackupReminder,
      sessionPromptFor,
'''
dev_replacement = '''      shouldShowBackupReminder,
      getRecoveryCheckpoints: () => deepClone(recoveryCheckpoints),
      normalizeRecoveryCheckpoint,
      normalizeRecoveryCheckpoints,
      createRecoveryCheckpointRecord,
      addRecoveryCheckpointRecord,
      recoveryCheckpointState,
      createRecoveryCheckpoint,
      sessionPromptFor,
'''
index = replace_once(index, dev_marker, dev_replacement, "checkpoint developer exports")

test_marker = '''    test('90. Pełna kopia zachowuje metadane bezpiecznego powtórzenia', () => { const fixture = createDemoState(); recordDiceEntry(fixture, { type:'dice', label:'k8', summary:'k8: 4 (1k8)', notation:'1k8', result:4, repeat:{ kind:'roll', label:'k8', config:{ count:1, sides:8, modifier:0, keepHighest:false } } }); const parsed = parseImportText(JSON.stringify(buildBackupPayload(fixture))); assert(parsed.candidate?.diceHistory[0]?.repeat?.kind === 'roll' && parsed.candidate.diceHistory[0].repeat.config.sides === 8); });
    return results;
'''
test_replacement = '''    test('90. Pełna kopia zachowuje metadane bezpiecznego powtórzenia', () => { const fixture = createDemoState(); recordDiceEntry(fixture, { type:'dice', label:'k8', summary:'k8: 4 (1k8)', notation:'1k8', result:4, repeat:{ kind:'roll', label:'k8', config:{ count:1, sides:8, modifier:0, keepHighest:false } } }); const parsed = parseImportText(JSON.stringify(buildBackupPayload(fixture))); assert(parsed.candidate?.diceHistory[0]?.repeat?.kind === 'roll' && parsed.candidate.diceHistory[0].repeat.config.sides === 8); });

    test('91. Punkt odzyskiwania zachowuje pełny stan sesji i historię kości', () => { const fixture = createDemoState(); startSessionOn(fixture, 'Punkt'); recordDiceEntry(fixture, { type:'dice', summary:'k8: 4', repeat:{ kind:'roll', label:'k8', config:{ count:1, sides:8 } } }); const checkpoint = createRecoveryCheckpointRecord(fixture, 'Test', '2026-01-01T10:00:00.000Z'); assert(checkpoint?.payload.sessionLog.active.title === 'Punkt' && checkpoint.payload.diceHistory[0].repeat.config.sides === 8); });
    test('92. Lista punktów zachowuje trzy najnowsze wpisy', () => { const fixture = createDemoState(); const records = ['01','02','03','04'].reduce((list, day) => addRecoveryCheckpointRecord(list, createRecoveryCheckpointRecord(fixture, `D${day}`, `2026-01-${day}T10:00:00.000Z`)), []); assert(records.length === 3 && records.map(entry => entry.reason).join(',') === 'D04,D03,D02'); });
    test('93. Uszkodzony punkt odzyskiwania jest odrzucany', () => { assert(normalizeRecoveryCheckpoint({ id:'x', createdAt:'2026-01-01T10:00:00.000Z', payload:{ appId:APP_ID } }) === null); });
    test('94. Odtworzenie punktu zwraca niezależną i zwalidowaną kopię', () => { const fixture = createDemoState(); const checkpoint = createRecoveryCheckpointRecord(fixture, 'Kopia', '2026-01-01T10:00:00.000Z'); const restored = recoveryCheckpointState(checkpoint); restored.stats.gold = 999; assert(checkpoint.payload.stats.gold !== 999 && validateState(restored).valid); });
    test('95. Pełna kopia postaci nie osadza lokalnej listy punktów', () => { const payload = buildBackupPayload(createDemoState()); assert(!Object.prototype.hasOwnProperty.call(payload, 'recoveryCheckpoints') && !Object.prototype.hasOwnProperty.call(payload, 'checkpoints')); });
    test('96. Punkty odzyskiwania nie wymagają zmiany schemaVersion postaci', () => { const checkpoint = createRecoveryCheckpointRecord(createDemoState(), 'Schemat', '2026-01-01T10:00:00.000Z'); assert(SCHEMA_VERSION === 3 && checkpoint.schemaVersion === 3 && checkpoint.payload.schemaVersion === 3); });
    test('97. Surowa kopia błędnego zapisu i punkty odzyskiwania używają osobnych kluczy', () => { assert(RECOVERY_KEY !== CHECKPOINTS_KEY && CHECKPOINT_LIMIT === 3); });
    return results;
'''
index = replace_once(index, test_marker, test_replacement, "checkpoint embedded tests")

index_path.write_text(index, encoding="utf-8")

tests_path = ROOT / "tests" / "app.spec.mjs"
tests = tests_path.read_text(encoding="utf-8")
tests = replace_once(tests, "data-passed', '90'", "data-passed', '97'", "playwright passed count")
tests = replace_once(tests, "data-total', '90'", "data-total', '97'", "playwright total count")

tests += r'''

test('manual recovery checkpoint restores the previous local character state', async ({ page }) => {
  await loadDemo(page);

  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await page.getByRole('button', { name: 'Zarządzaj punktami odzyskiwania' }).click();
  await page.getByRole('button', { name: 'Utwórz punkt odzyskiwania' }).click();
  await expect(page.locator('.recovery-checkpoint-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Zamknij panel' }).click();

  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  await page.getByRole('button', { name: /Złoto: 11/ }).click();
  await page.locator('#sheet').getByRole('button', { name: '+10', exact: true }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Zapisz złoto' }).click();
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().stats.gold)).toBe(21);

  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await page.getByRole('button', { name: 'Zarządzaj punktami odzyskiwania' }).click();
  await page.getByRole('button', { name: 'Odtwórz punkt odzyskiwania: Mara Ciernista' }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Odtwórz punkt', exact: true }).click();

  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().stats.gold)).toBe(11);
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getRecoveryCheckpoints().length)).toBeGreaterThanOrEqual(1);
});

test('reset creates an automatic recovery checkpoint before clearing the card', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Zresetuj kartę' }).click();
  await page.getByLabel('Wpisz USUŃ').fill('USUŃ');
  await page.locator('#sheet').getByRole('button', { name: 'Usuń wszystkie dane karty' }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Tak, zabezpiecz i usuń' }).click();

  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().initialized)).toBe(false);
  const checkpoints = await page.evaluate(() => globalThis.CairnSheetDev.getRecoveryCheckpoints());
  expect(checkpoints).toHaveLength(1);
  expect(checkpoints[0].reason).toBe('Przed resetem karty');
  expect(checkpoints[0].characterName).toBe('Mara Ciernista');
});

test('confirmed import preserves the overwritten card as a recovery checkpoint', async ({ page }) => {
  await loadDemo(page);
  const replacement = await page.evaluate(() => {
    const fixture = globalThis.CairnSheetDev.createDemoState();
    fixture.identity.name = 'Następczyni';
    fixture.stats.gold = 3;
    return globalThis.CairnSheetDev.buildBackupPayload(fixture);
  });

  await page.locator('#backupFileInput').setInputFiles({
    name: 'replacement-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(replacement))
  });
  await page.locator('#sheet').getByRole('button', { name: 'Nadpisz kartę importem' }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Nadpisz kartę' }).click();

  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().identity.name)).toBe('Następczyni');
  const checkpoints = await page.evaluate(() => globalThis.CairnSheetDev.getRecoveryCheckpoints());
  expect(checkpoints).toHaveLength(1);
  expect(checkpoints[0].characterName).toBe('Mara Ciernista');
  expect(checkpoints[0].reason).toContain('Przed importem');
});
'''
tests_path.write_text(tests, encoding="utf-8")

readme_path = ROOT / "README.md"
readme = readme_path.read_text(encoding="utf-8")
readme = replace_once(
    readme,
    "- pełna, odtwarzalna kopia zapasowa JSON;\n",
    "- pełna, odtwarzalna kopia zapasowa JSON;\n- trzy lokalne punkty odzyskiwania przed importem, resetem lub odtworzeniem;\n",
    "README checkpoint feature",
)
readme = replace_once(
    readme,
    "Wersja 0.11.0 nadal używa `schemaVersion: 3`. Historia rzutów może zawierać opcjonalne metadane bezpiecznego powtórzenia, ale starsze wpisy bez tych danych pozostają czytelne i nie wymagają migracji.",
    "Wersja 0.12.0 nadal używa `schemaVersion: 3`. Trzy najnowsze punkty odzyskiwania są przechowywane osobno w `localStorage` i nie wchodzą do pełnej kopii postaci. Chronią przed przypadkowym importem, resetem lub odtworzeniem, ale znikają po wyczyszczeniu danych przeglądarki i nie zastępują pobranej kopii JSON. Historia rzutów może zawierać opcjonalne metadane bezpiecznego powtórzenia, ale starsze wpisy bez tych danych pozostają czytelne i nie wymagają migracji.",
    "README data version",
)
readme_path.write_text(readme, encoding="utf-8")

package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
package["version"] = "0.12.0"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

lock_path = ROOT / "package-lock.json"
lock = json.loads(lock_path.read_text(encoding="utf-8"))
lock["version"] = "0.12.0"
lock["packages"][""]["version"] = "0.12.0"
lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

sw_path = ROOT / "service-worker.js"
sw = sw_path.read_text(encoding="utf-8")
sw = replace_once(sw, "cairn-mobile-sheet-v0.11.0", "cairn-mobile-sheet-v0.12.0", "service worker cache")
sw_path.write_text(sw, encoding="utf-8")

checksum_path = ROOT / "checksums.sha256"
checksum_files = ["index.html", "manifest.webmanifest", "service-worker.js", "icon.svg"]
checksum_lines = []
for filename in checksum_files:
    digest = hashlib.sha256((ROOT / filename).read_bytes()).hexdigest()
    checksum_lines.append(f"{digest}  {filename}")
checksum_path.write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")
