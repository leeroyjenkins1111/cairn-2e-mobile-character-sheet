'use strict';

// ============================================================
// 19. Events and initialization
// ============================================================


function isDeveloperMode() {
  return new URLSearchParams(location.search).get('dev') === '1';
}

function settingsSection(title, children, className = '') {
  return createEl('section', { className: `settings-sheet-section ${className}`.trim() }, [
    createEl('h3', { text: title }),
    ...(Array.isArray(children) ? children : [children])
  ]);
}

function recoveryCheckpointFileStem(checkpoint) {
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
  body.append(settingsSection('Punkty odzyskiwania', [
    createEl('p', { text: 'Do trzech lokalnych stanów karty przed importem, resetem lub odtworzeniem. Nie zastępują kopii pobranej na urządzenie.' }),
    createEl('div', { className: 'data-status' }, [
      createEl('strong', { text: `${recoveryCheckpoints.length}/${CHECKPOINT_LIMIT} punktów` }),
      createEl('span', { text: recoveryCheckpoints[0] ? `Najnowszy: ${formatDateTime(recoveryCheckpoints[0].createdAt)}` : 'Brak lokalnego punktu odzyskiwania.' })
    ]),
    button('Zarządzaj punktami odzyskiwania', openRecoveryCheckpointsSheet, 'btn btn-block')
  ]));

  const themeToggle = createEl('input', { type: 'checkbox', checked: state.settings.theme === 'light', attrs: { 'aria-label': 'Jasny motyw' } });
  themeToggle.addEventListener('change', () => {
    state.settings.theme = themeToggle.checked ? 'light' : 'dark';
    scheduleSave();
    renderAll();
  });
  const motionToggle = createEl('input', { type: 'checkbox', checked: state.settings.reducedMotionOverride !== true, attrs: { 'aria-label': 'Animacje interfejsu' } });
  motionToggle.addEventListener('change', () => {
    state.settings.reducedMotionOverride = motionToggle.checked ? null : true;
    diceAnimationToken += 1;
    scheduleSave();
    renderAll();
  });
  const hapticsToggle = createEl('input', { type: 'checkbox', checked: state.settings.hapticsEnabled !== false, attrs: { 'aria-label': 'Haptyka' } });
  hapticsToggle.addEventListener('change', () => {
    state.settings.hapticsEnabled = hapticsToggle.checked;
    scheduleSave();
    if (hapticsToggle.checked) triggerHaptic('selection');
  });
  const hapticsHelp = supportsHapticFeedback()
    ? 'Delikatne tyknięcia towarzyszą obrotowi kości; mocniejszy impuls podkreśla wynik.'
    : 'Ta przeglądarka nie udostępnia haptyki; ustawienie pozostaje bezpiecznym no-opem.';
  const appRows = createEl('div', { className: 'settings-list' }, [
    createEl('label', { className: 'settings-row settings-row-toggle' }, [
      createEl('div', {}, [createEl('strong', { text: 'Jasny motyw' }), createEl('p', { className: 'help', text: 'Ciemny pozostaje domyślny.' })]),
      themeToggle
    ]),
    createEl('label', { className: 'settings-row settings-row-toggle' }, [
      createEl('div', {}, [createEl('strong', { text: 'Animacje interfejsu' }), createEl('p', { className: 'help', text: 'Systemowe Reduce Motion ma zawsze pierwszeństwo.' })]),
      motionToggle
    ]),
    createEl('label', { className: 'settings-row settings-row-toggle' }, [
      createEl('div', {}, [createEl('strong', { text: 'Haptyka' }), createEl('p', { className: 'help', text: hapticsHelp })]),
      hapticsToggle
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
  renderAll();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./service-worker.js').catch(error => {
    loadWarning = `Nie udało się przygotować trybu offline: ${error.message}`;
    showToast(loadWarning, 'error');
  });
}


function syncVisualViewport() {
  const viewport = globalThis.visualViewport;
  const height = Math.max(1, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 1));
  const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
  document.documentElement.style.setProperty('--visual-viewport-height', `${height}px`);
  document.documentElement.style.setProperty('--visual-viewport-offset-top', `${offsetTop}px`);
  return { height, offsetTop };
}

function keepSheetControlVisible(event) {
  const control = event.target;
  if (!(control instanceof Element) || !control.matches('input, select, textarea')) return;
  setTimeout(() => control.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' }), 80);
}

function bindEvents() {
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; renderAll(); });
  window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; renderAll(); showToast('Aplikacja została zainstalowana.'); });
  for (const nav of $$('[data-nav]')) nav.addEventListener('click', () => setView(nav.dataset.nav, { announceChange: true }));
  document.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target || target.disabled || shouldReduceMotion()) return;
    target.classList.remove('tap-feedback');
    void target.offsetWidth;
    target.classList.add('tap-feedback');
    setTimeout(() => target.classList.remove('tap-feedback'), 190);
  });
  $('#appSettingsBtn').addEventListener('click', openAppSettingsSheet);
  $('#quickUndoBtn').addEventListener('click', undoLastChange);
  $('#sheetCloseBtn').addEventListener('click', closeSheet);
  $('#sheetBackdrop').addEventListener('click', event => { if (event.target === $('#sheetBackdrop')) closeSheet(); });
  $('#sheet').addEventListener('keydown', trapSheetFocus);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !$('#sheetBackdrop').classList.contains('open')) return;
    event.preventDefault();
    closeSheet();
  });
  $('#sheet').addEventListener('focusin', keepSheetControlVisible);
  window.addEventListener('resize', syncVisualViewport);
  globalThis.visualViewport?.addEventListener('resize', syncVisualViewport);
  globalThis.visualViewport?.addEventListener('scroll', syncVisualViewport);
  syncVisualViewport();
  $('#importFileInput').addEventListener('change', event => { handleImportFile(event.target.files[0], 'any'); event.target.value = ''; });
  $('#backupFileInput').addEventListener('change', event => { handleImportFile(event.target.files[0], 'backup'); event.target.value = ''; });
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
}

function initialize() {
  state = loadState();
  backupMeta = loadBackupMeta();
  recoveryCheckpoints = loadRecoveryCheckpoints();
  bindEvents();
  renderAll();
  setView('character');
  registerServiceWorker();
  if (loadWarning) showToast(loadWarning, 'error');
  globalThis.CairnSheetDev = {
    version: APP_VERSION,
    getState: () => deepClone(state),
    calculateDamage,
    resolveSave,
    performSave,
    resolvePanicRecovery,
    normalizeKettlewright,
    parseDamageFormulaNotation,
    rollDamageFormula,
    planFatigueWithDroppedItem,
    calculateInventoryUsage,
    resolveFirstRoundDex,
    performFirstRoundDexSave,
    heldWeaponItems,
    availableWeaponItems,
    rollBlastTargets,
    planItemUse,
    getScarGuide,
    parseImportText,
    buildBackupPayload,
    convertLegacyCharacterExport,
    validateRawBackupShape,
    recordDiceEntry,
    parseAttackDiceList,
    shouldShowBackupReminder,
    getRecoveryCheckpoints: () => deepClone(recoveryCheckpoints),
    normalizeRecoveryCheckpoint,
    normalizeRecoveryCheckpoints,
    createRecoveryCheckpointRecord,
    addRecoveryCheckpointRecord,
    recoveryCheckpointState,
    createRecoveryCheckpoint,
    sessionPromptFor,
    normalizeSessionLog,
    startSessionOn,
    appendSessionEvent,
    finishSessionOn,
    sessionReportMarkdown,
    classifySessionChange,
    normalizeDiceRepeatSpec,
    canRepeatDiceEntry,
    diceEntryTypeLabel,
    diceEntrySides,
    createResultDie,
    createDieMesh,
    paintResultDie,
    hapticPatternFor,
    supportsHapticFeedback,
    triggerHaptic,
    recentDiceEntries,
    repeatDiceEntry,
    groupInventoryEntries,
    moveItemWithinGroup,
    deriveArmor,
    syncVisualViewport,
    updateViewAccessibility,
    createDemoState
  };
}

initialize();
