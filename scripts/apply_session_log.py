from __future__ import annotations

from pathlib import Path
import hashlib
import json


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def insert_before(text: str, marker: str, addition: str, label: str) -> str:
    if marker not in text:
        raise RuntimeError(f"{label}: marker not found")
    return text.replace(marker, addition + marker, 1)


html_path = Path('index.html')
tests_path = Path('tests/app.spec.mjs')
readme_path = Path('README.md')
package_path = Path('package.json')
lock_path = Path('package-lock.json')
sw_path = Path('service-worker.js')
checksums_path = Path('checksums.sha256')

html = html_path.read_text(encoding='utf-8')
tests = tests_path.read_text(encoding='utf-8')
readme = readme_path.read_text(encoding='utf-8')
package = package_path.read_text(encoding='utf-8')
lock = lock_path.read_text(encoding='utf-8')
sw = sw_path.read_text(encoding='utf-8')

html = replace_once(html, "const APP_VERSION = '0.9.0';", "const APP_VERSION = '0.10.0';", 'app version')
html = replace_once(html, 'const SCHEMA_VERSION = 2;', 'const SCHEMA_VERSION = 3;', 'schema version')
html = replace_once(
    html,
    '  const DICE_HISTORY_LIMIT = 20;\n  const SAVE_DEBOUNCE_MS = 300;',
    '  const DICE_HISTORY_LIMIT = 20;\n  const SESSION_ARCHIVE_LIMIT = 20;\n  const SESSION_EVENT_LIMIT = 500;\n  const SAVE_DEBOUNCE_MS = 300;',
    'session limits'
)

css = r'''
    /* Session log v0.10.0 — explicit, local and backup-safe. */
    .session-log-card { display: grid; gap: 10px; }
    .session-log-status {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      gap: 10px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 13px;
      background: var(--surface-soft);
    }
    .session-log-status strong { display: block; font-size: 0.98rem; }
    .session-log-status p { margin: 3px 0 0; color: var(--muted); font-size: 0.72rem; line-height: 1.35; }
    .session-live-badge { color: var(--green-strong); }
    .session-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
    .session-actions .btn { min-width: 0; }
    .session-event-list { display: grid; gap: 6px; }
    .session-event {
      min-width: 0;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 8px;
      align-items: start;
      padding: 8px 0;
      border-top: 1px solid var(--line);
    }
    .session-event:first-child { border-top: 0; }
    .session-event-type {
      min-width: 66px;
      color: var(--green-strong);
      font-size: 0.62rem;
      font-weight: 850;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .session-event-copy { min-width: 0; }
    .session-event-copy p { margin: 0; overflow-wrap: anywhere; font-size: 0.78rem; line-height: 1.3; }
    .session-event-copy small { display: block; margin-top: 3px; color: var(--muted); font-size: 0.65rem; line-height: 1.25; }
    .session-event-copy time { display: block; margin-top: 3px; color: var(--faint); font-size: 0.62rem; }
    .session-archive-list { display: grid; gap: 6px; }
    .session-archive-button {
      width: 100%;
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      text-align: left;
    }
    .session-archive-button span { min-width: 0; display: grid; gap: 2px; }
    .session-archive-button strong { overflow-wrap: anywhere; }
    .session-archive-button small { color: var(--muted); font-weight: 650; }
    .session-summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    .session-summary-stat { padding: 8px; border: 1px solid var(--line); border-radius: 11px; background: var(--surface-soft); }
    .session-summary-stat strong { display: block; font-size: 1.05rem; }
    .session-summary-stat span { color: var(--muted); font-size: 0.65rem; }
    .session-report-note { margin: 0; color: var(--muted); font-size: 0.7rem; line-height: 1.35; }

    @media (max-width: 350px) {
      .session-log-status { grid-template-columns: 1fr; }
      .session-actions { grid-template-columns: 1fr; }
      .session-summary-grid { grid-template-columns: 1fr; }
    }

'''
html = insert_before(html, '  </style>', css, 'session css')

html = replace_once(
    html,
    '      diceHistory: [],\n      changeHistory: [],\n      source:',
    '      diceHistory: [],\n      changeHistory: [],\n      sessionLog: { active: null, archive: [] },\n      source:',
    'default session model'
)

session_domain = r'''
  const SESSION_EVENT_LABELS = {
    system: 'Sesja',
    change: 'Zmiana',
    damage: 'Obrażenia',
    recovery: 'Regeneracja',
    attribute: 'Atrybuty',
    condition: 'Stan',
    inventory: 'Ekwipunek',
    fatigue: 'Zmęczenie',
    scar: 'Blizna',
    dice: 'Rzut',
    save: 'Rzut obronny',
    undo: 'Cofnięcie'
  };

  function makeSessionEvent(partial = {}) {
    const requestedType = trimText(partial.type, 'change');
    return {
      id: trimText(partial.id) || makeId(),
      time: trimText(partial.time) || nowIso(),
      type: Object.prototype.hasOwnProperty.call(SESSION_EVENT_LABELS, requestedType) ? requestedType : 'change',
      summary: trimText(partial.summary || partial.description, 'Zdarzenie sesji'),
      details: trimText(partial.details)
    };
  }

  function makeSession(partial = {}) {
    const startedAt = trimText(partial.startedAt) || nowIso();
    return {
      id: trimText(partial.id) || makeId(),
      title: trimText(partial.title, 'Sesja'),
      startedAt,
      endedAt: trimText(partial.endedAt) || null,
      summary: trimText(partial.summary),
      events: safeArray(partial.events).map(makeSessionEvent).slice(-SESSION_EVENT_LIMIT)
    };
  }

  function normalizeSessionLog(value) {
    const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
      active: raw.active && typeof raw.active === 'object' ? makeSession(raw.active) : null,
      archive: safeArray(raw.archive).map(makeSession).filter(session => session.endedAt).slice(0, SESSION_ARCHIVE_LIMIT)
    };
  }

  function defaultSessionTitle(iso = nowIso()) {
    try {
      const date = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short' }).format(new Date(iso));
      return `Sesja ${date}`;
    } catch {
      return 'Nowa sesja';
    }
  }

  function startSessionOn(target, title = '', startedAt = nowIso()) {
    target.sessionLog = normalizeSessionLog(target.sessionLog);
    if (target.sessionLog.active) return null;
    const session = makeSession({ title: trimText(title) || defaultSessionTitle(startedAt), startedAt });
    session.events.push(makeSessionEvent({ time: startedAt, type: 'system', summary: 'Rozpoczęto sesję' }));
    target.sessionLog.active = session;
    return session;
  }

  function appendSessionEvent(target, partial = {}) {
    target.sessionLog = normalizeSessionLog(target.sessionLog);
    if (!target.sessionLog.active) return null;
    const event = makeSessionEvent(partial);
    target.sessionLog.active.events = [...target.sessionLog.active.events, event].slice(-SESSION_EVENT_LIMIT);
    return event;
  }

  function finishSessionOn(target, summary = '', endedAt = nowIso()) {
    target.sessionLog = normalizeSessionLog(target.sessionLog);
    const active = target.sessionLog.active;
    if (!active) return null;
    const completed = makeSession({
      ...active,
      endedAt,
      summary: trimText(summary),
      events: [...active.events, makeSessionEvent({ time: endedAt, type: 'system', summary: 'Zakończono sesję' })]
    });
    target.sessionLog.active = null;
    target.sessionLog.archive = [completed, ...target.sessionLog.archive.filter(session => session.id !== completed.id)].slice(0, SESSION_ARCHIVE_LIMIT);
    return completed;
  }

  function classifySessionChange(description) {
    const value = trimText(description).toLowerCase();
    if (/^cofnięto/.test(value)) return 'undo';
    if (/blizn/.test(value)) return 'scar';
    if (/zmęczen/.test(value)) return 'fatigue';
    if (/obraż|atak|ochrona spadła/.test(value)) return 'damage';
    if (/odpoczynek|regener|wylecz|przywrócono ochronę/.test(value)) return 'recovery';
    if (/stan:|panik|stabiliz|paraliż|deliri|pozbaw/.test(value)) return 'condition';
    if (/przedmiot|ekwipun|sposób noszenia|użyto:|użycie|zduplikowano|upuszczono/.test(value)) return 'inventory';
    if (/statyst|sił|zre|wol|ochron/.test(value)) return 'attribute';
    return 'change';
  }

  function sessionEventTypeForDice(entry) {
    if (entry?.type === 'save') return 'save';
    if (entry?.type === 'damage' || entry?.type === 'blast') return 'damage';
    return 'dice';
  }

  function sessionEventCounts(session) {
    const counts = {};
    for (const event of safeArray(session?.events)) counts[event.type] = (counts[event.type] || 0) + 1;
    return counts;
  }

  function sessionReportMarkdown(session, characterName = state?.identity?.name || 'Postać') {
    const record = makeSession(session);
    const lines = [
      `# ${record.title}`,
      '',
      `- Postać: ${trimText(characterName, 'Postać')}`,
      `- Rozpoczęcie: ${formatDateTime(record.startedAt)}`,
      `- Zakończenie: ${record.endedAt ? formatDateTime(record.endedAt) : 'sesja aktywna'}`,
      `- Liczba zdarzeń: ${record.events.length}`
    ];
    if (record.summary) lines.push('', '## Podsumowanie', '', record.summary);
    lines.push('', '## Zdarzenia', '');
    if (!record.events.length) lines.push('- Brak zapisanych zdarzeń.');
    for (const event of record.events) {
      lines.push(`- ${formatDateTime(event.time)} — **${SESSION_EVENT_LABELS[event.type] || 'Zmiana'}**: ${event.summary}`);
      if (event.details) lines.push(`  - ${event.details}`);
    }
    lines.push('', '_Raport sesji nie zastępuje pełnej kopii zapasowej postaci._', '');
    return lines.join('\n');
  }

'''
html = insert_before(
    html,
    '  // ============================================================\n  // 4. Validation and migrations',
    session_domain,
    'session domain'
)

html = replace_once(
    html,
    "    if (candidate?.inventory?.items?.length > 200) errors.push('Zbyt wiele przedmiotów w pliku.');",
    "    if (candidate?.inventory?.items?.length > 200) errors.push('Zbyt wiele przedmiotów w pliku.');\n    if (!candidate?.sessionLog || typeof candidate.sessionLog !== 'object' || !Array.isArray(candidate.sessionLog.archive)) errors.push('Nieprawidłowy log sesji.');",
    'session validation'
)

migration = r'''
  function migrateV2ToV3(candidate) {
    const migrated = deepClone(candidate);
    migrated.sessionLog = normalizeSessionLog(migrated.sessionLog);
    migrated.schemaVersion = 3;
    return migrated;
  }

'''
html = insert_before(html, '  function migrateState(candidate) {', migration, 'v2 to v3 migration')
html = replace_once(
    html,
    "      if (migrated.schemaVersion === 1) migrated = migrateV1ToV2(migrated);\n      else throw new Error(`Brak migracji dla schemaVersion ${migrated.schemaVersion}.`);",
    "      if (migrated.schemaVersion === 1) migrated = migrateV1ToV2(migrated);\n      else if (migrated.schemaVersion === 2) migrated = migrateV2ToV3(migrated);\n      else throw new Error(`Brak migracji dla schemaVersion ${migrated.schemaVersion}.`);",
    'migration chain'
)
html = replace_once(
    html,
    '    migrated.diceHistory = safeArray(migrated.diceHistory).slice(-DICE_HISTORY_LIMIT);\n    return migrated;',
    '    migrated.diceHistory = safeArray(migrated.diceHistory).slice(-DICE_HISTORY_LIMIT);\n    migrated.sessionLog = normalizeSessionLog(migrated.sessionLog);\n    return migrated;',
    'migrated session normalization'
)
html = replace_once(
    html,
    '      source: { ...base.source, ...(migrated.source || {}) },\n      settings: { ...base.settings, ...(migrated.settings || {}) }',
    '      source: { ...base.source, ...(migrated.source || {}) },\n      settings: { ...base.settings, ...(migrated.settings || {}) },\n      sessionLog: normalizeSessionLog(migrated.sessionLog)',
    'sanitized session log'
)

html = replace_once(
    html,
    '    next.changeHistory = [...safeArray(state.changeHistory), entry].slice(-HISTORY_LIMIT);\n    state = next;',
    "    next.changeHistory = [...safeArray(state.changeHistory), entry].slice(-HISTORY_LIMIT);\n    appendSessionEvent(next, { type: options.sessionType || classifySessionChange(description), summary: description, details: trimText(options.sessionDetails) });\n    state = next;",
    'commit session event'
)
html = replace_once(
    html,
    '    state.changeHistory = [...safeArray(state.changeHistory), entry].slice(-HISTORY_LIMIT);\n    scheduleSave();',
    "    state.changeHistory = [...safeArray(state.changeHistory), entry].slice(-HISTORY_LIMIT);\n    appendSessionEvent(state, { type: classifySessionChange(description), summary: description });\n    scheduleSave();",
    'record event session event'
)
html = replace_once(
    html,
    '    next.updatedAt = nowIso();\n    state = next;\n    recordMeaningfulChange();',
    "    next.updatedAt = nowIso();\n    appendSessionEvent(next, { type: 'undo', summary: `Cofnięto: ${entry.description}` });\n    state = next;\n    recordMeaningfulChange();",
    'undo session event'
)
html = replace_once(
    html,
    '  function addDiceHistory(entry) {\n    recordDiceEntry(state, entry);\n    scheduleSave();\n    renderDiceView();\n  }',
    "  function addDiceHistory(entry) {\n    const recorded = recordDiceEntry(state, entry);\n    appendSessionEvent(state, { type: sessionEventTypeForDice(recorded), summary: recorded.summary, details: recorded.details });\n    scheduleSave();\n    renderDiceView();\n    if (activeView === 'more') renderMoreView();\n  }",
    'dice session event'
)

session_ui = r'''
  function sessionById(sessionId) {
    const log = normalizeSessionLog(state.sessionLog);
    if (sessionId === 'active') return log.active;
    return log.archive.find(session => session.id === sessionId) || null;
  }

  function sessionFileStem(session) {
    const value = trimText(session?.title, 'sesja').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();
    return value || 'sesja';
  }

  function exportSessionReport(sessionId, format) {
    const session = sessionById(sessionId);
    if (!session) { showToast('Nie znaleziono sesji.', 'error'); return; }
    const date = session.startedAt.slice(0, 10);
    const stem = sessionFileStem(session);
    if (format === 'json') {
      const payload = {
        appId: `${APP_ID}-session-report`,
        exportType: 'session-report',
        appVersion: APP_VERSION,
        schemaVersion: SCHEMA_VERSION,
        exportedAt: nowIso(),
        character: { id: state.characterId, name: state.identity.name },
        session: deepClone(session)
      };
      downloadTextFile(`cairn-${stem}-${date}.json`, JSON.stringify(payload, null, 2));
      showToast('Pobrano raport sesji JSON.');
      return;
    }
    downloadTextFile(`cairn-${stem}-${date}.md`, sessionReportMarkdown(session, state.identity.name), 'text/markdown;charset=utf-8');
    showToast('Pobrano raport sesji Markdown.');
  }

  function renderSessionEvent(event) {
    return createEl('div', { className: 'session-event' }, [
      createEl('span', { className: 'session-event-type', text: SESSION_EVENT_LABELS[event.type] || 'Zmiana' }),
      createEl('div', { className: 'session-event-copy' }, [
        createEl('p', { text: event.summary }),
        event.details ? createEl('small', { text: event.details }) : null,
        createEl('time', { text: formatDateTime(event.time), dateTime: event.time })
      ])
    ]);
  }

  function openStartSessionSheet() {
    if (state.sessionLog?.active) { showToast('Sesja jest już aktywna.'); return; }
    const title = textInput(defaultSessionTitle(), 160);
    const body = createEl('div', { className: 'form-grid' }, [
      createEl('p', { text: 'Aktywna sesja zapisuje wykonywane zmiany i rzuty. Nie uruchamia automatycznych rozstrzygnięć ani nie zastępuje Wardena.' }),
      field('Nazwa sesji', title)
    ]);
    const start = button('Rozpocznij', () => {
      const next = deepClone(state);
      const session = startSessionOn(next, title.value);
      if (!session) { showToast('Sesja jest już aktywna.', 'error'); return; }
      state = next;
      recordMeaningfulChange();
      scheduleSave();
      closeSheet();
      renderAll();
      showToast(`Rozpoczęto: ${session.title}`);
      announce('Rozpoczęto log sesji.');
    }, 'btn btn-primary btn-block');
    openSheet({ title: 'Rozpocznij sesję', body, footer: start });
  }

  function openEndSessionSheet() {
    const active = state.sessionLog?.active;
    if (!active) { showToast('Brak aktywnej sesji.'); return; }
    const summary = textarea('', 4000);
    const body = createEl('div', { className: 'form-grid' }, [
      createEl('div', { className: 'report-block' }, [
        createEl('h3', { text: active.title }),
        createEl('p', { className: 'muted small', text: `${formatDateTime(active.startedAt)} · ${safeArray(active.events).length} zdarzeń` })
      ]),
      field('Podsumowanie', summary, 'Opcjonalny opis najważniejszych wydarzeń. Nie jest to kalendarz kampanii.')
    ]);
    const finish = button('Zakończ i zapisz', () => {
      const next = deepClone(state);
      const completed = finishSessionOn(next, summary.value);
      if (!completed) { showToast('Brak aktywnej sesji.', 'error'); return; }
      state = next;
      recordMeaningfulChange();
      scheduleSave();
      closeSheet();
      renderAll();
      showToast(`Zakończono: ${completed.title}`);
      announce('Zakończono i zarchiwizowano log sesji.');
    }, 'btn btn-primary btn-block');
    openSheet({ title: 'Zakończ sesję', body, footer: finish });
  }

  function openSessionDetailsSheet(sessionId) {
    const session = sessionById(sessionId);
    if (!session) { showToast('Nie znaleziono sesji.', 'error'); return; }
    const counts = sessionEventCounts(session);
    const body = createEl('div', { className: 'sheet-list' });
    body.append(createEl('div', { className: 'report-block' }, [
      createEl('h3', { text: session.title }),
      createEl('p', { className: 'muted small', text: `${formatDateTime(session.startedAt)} → ${session.endedAt ? formatDateTime(session.endedAt) : 'aktywna'}` }),
      session.summary ? createEl('p', { text: session.summary }) : createEl('p', { className: 'help', text: 'Brak podsumowania.' })
    ]));
    body.append(createEl('div', { className: 'session-summary-grid' }, [
      createEl('div', { className: 'session-summary-stat' }, [createEl('strong', { text: session.events.length }), createEl('span', { text: 'zdarzeń' })]),
      createEl('div', { className: 'session-summary-stat' }, [createEl('strong', { text: (counts.dice || 0) + (counts.save || 0) + (counts.damage || 0) }), createEl('span', { text: 'rzutów i obrażeń' })])
    ]));
    const events = createEl('div', { className: 'session-event-list' });
    for (const event of session.events.slice().reverse()) events.append(renderSessionEvent(event));
    body.append(events);
    body.append(createEl('p', { className: 'session-report-note', text: 'Raport sesji jest czytelnym wyciągiem. Pełne odtworzenie danych wymaga pełnej kopii zapasowej JSON.' }));
    const footer = createEl('div', { className: 'button-row' }, [
      button('Markdown', () => exportSessionReport(sessionId, 'markdown'), 'btn btn-primary'),
      button('JSON', () => exportSessionReport(sessionId, 'json'), 'btn'),
      button('Zamknij', closeSheet, 'btn btn-ghost')
    ]);
    openSheet({ title: 'Podsumowanie sesji', body, footer });
  }

  function renderSessionLogCard() {
    state.sessionLog = normalizeSessionLog(state.sessionLog);
    const active = state.sessionLog.active;
    const section = card([], 'card-pad session-log-card');
    section.append(sectionHead('Sesja', createEl('span', { className: `tag${active ? ' session-live-badge' : ''}`, text: active ? 'AKTYWNA' : `${state.sessionLog.archive.length}/20` })));
    if (!active) {
      section.append(createEl('p', { className: 'muted small', text: 'Rozpocznij sesję, aby połączyć zmiany postaci i rzuty w jeden czytelny zapis.' }));
      section.append(button('Rozpocznij sesję', openStartSessionSheet, 'btn btn-primary btn-block'));
    } else {
      section.append(createEl('div', { className: 'session-log-status' }, [
        createEl('div', {}, [
          createEl('strong', { text: active.title }),
          createEl('p', { text: `Od ${formatDateTime(active.startedAt)} · ${active.events.length} zdarzeń` })
        ]),
        createEl('span', { className: 'tag session-live-badge', text: 'zapis trwa' })
      ]));
      section.append(createEl('div', { className: 'session-actions' }, [
        button('Zakończ sesję', openEndSessionSheet, 'btn btn-primary'),
        button('Zobacz i eksportuj', () => openSessionDetailsSheet('active'), 'btn')
      ]));
      const recent = createEl('div', { className: 'session-event-list' });
      for (const event of active.events.slice(-8).reverse()) recent.append(renderSessionEvent(event));
      section.append(recent);
    }
    if (state.sessionLog.archive.length) {
      const archive = createEl('details', { className: 'history-disclosure' });
      archive.append(createEl('summary', {}, [createEl('span', { text: 'Zakończone sesje' }), createEl('span', { className: 'tag', text: state.sessionLog.archive.length })]));
      const list = createEl('div', { className: 'history-disclosure-content session-archive-list' });
      for (const session of state.sessionLog.archive) {
        list.append(createEl('button', {
          type: 'button',
          className: 'btn btn-ghost session-archive-button',
          attrs: { 'aria-label': `Otwórz sesję ${session.title}` },
          onclick: () => openSessionDetailsSheet(session.id)
        }, [
          createEl('span', {}, [createEl('strong', { text: session.title }), createEl('small', { text: `${formatDateTime(session.startedAt)} · ${session.events.length} zdarzeń` })]),
          createEl('span', { text: '›', attrs: { 'aria-hidden': 'true' } })
        ]));
      }
      archive.append(list);
      section.append(archive);
    }
    return section;
  }

'''
html = insert_before(html, '  function renderMoreView() {', session_ui, 'session UI')
html = replace_once(
    html,
    '    root.append(identity);\n\n    const notes = card([], \'card-pad\');',
    "    root.append(identity);\n    root.append(renderSessionLogCard());\n\n    const notes = card([], 'card-pad');",
    'session card in journal'
)

html = html.replace('migrated.schemaVersion === 2', 'migrated.schemaVersion === 3')
html = html.replace('copy.schemaVersion === 2', 'copy.schemaVersion === 3')
html = html.replace("test('32. Eksport i ponowny import schemaVersion 2'", "test('32. Eksport i ponowny import schemaVersion 3'")
html = html.replace("r.candidate?.schemaVersion === 2", "r.candidate?.schemaVersion === 3")

session_tests = r'''
    test('77. Migracja schemaVersion 2 dodaje pusty log sesji', () => { const fixture = createDemoState(); fixture.schemaVersion = 2; delete fixture.sessionLog; const migrated = sanitizeLoadedState(fixture); assert(migrated.schemaVersion === 3 && migrated.sessionLog.active === null && migrated.sessionLog.archive.length === 0); });
    test('78. Nie można rozpocząć drugiej aktywnej sesji', () => { const fixture = createDemoState(); assert(startSessionOn(fixture, 'Pierwsza', '2026-01-01T10:00:00.000Z')); assert(!startSessionOn(fixture, 'Druga', '2026-01-01T11:00:00.000Z')); });
    test('79. Zdarzenia są dopisywane wyłącznie do aktywnej sesji', () => { const fixture = createDemoState(); assert(!appendSessionEvent(fixture, { summary:'Bez sesji' })); startSessionOn(fixture, 'Test'); appendSessionEvent(fixture, { type:'inventory', summary:'Dodano przedmiot' }); assert(fixture.sessionLog.active.events.length === 2 && fixture.sessionLog.active.events[1].type === 'inventory'); });
    test('80. Zakończenie przenosi sesję do archiwum z podsumowaniem', () => { const fixture = createDemoState(); startSessionOn(fixture, 'Ruiny', '2026-01-01T10:00:00.000Z'); appendSessionEvent(fixture, { type:'save', summary:'Rzut WOL' }); const ended = finishSessionOn(fixture, 'Odnaleziono wyjście.', '2026-01-01T12:00:00.000Z'); assert(!fixture.sessionLog.active && fixture.sessionLog.archive[0].id === ended.id && ended.summary === 'Odnaleziono wyjście.' && ended.events.at(-1).summary === 'Zakończono sesję'); });
    test('81. Log ogranicza liczbę zdarzeń i archiwalnych sesji', () => { const fixture = createDemoState(); startSessionOn(fixture, 'Limit'); for (let index = 0; index < SESSION_EVENT_LIMIT + 10; index++) appendSessionEvent(fixture, { summary:`Zdarzenie ${index}` }); assert(fixture.sessionLog.active.events.length === SESSION_EVENT_LIMIT); finishSessionOn(fixture); fixture.sessionLog.archive = Array.from({ length: SESSION_ARCHIVE_LIMIT + 5 }, (_, index) => makeSession({ id:`s${index}`, title:`S${index}`, startedAt:'2026-01-01T10:00:00.000Z', endedAt:'2026-01-01T11:00:00.000Z' })); assert(normalizeSessionLog(fixture.sessionLog).archive.length === SESSION_ARCHIVE_LIMIT); });
    test('82. Undo nie usuwa logu sesji ze snapshotu postaci', () => { const fixture = createDemoState(); startSessionOn(fixture, 'Snapshot'); appendSessionEvent(fixture, { summary:'Zapisane zdarzenie' }); const snapshot = snapshotForHistory(fixture); fixture.stats.gold = 99; applySnapshot(fixture, snapshot); assert(fixture.sessionLog.active.events.some(event => event.summary === 'Zapisane zdarzenie')); });
    test('83. Pełna kopia zachowuje aktywne i zakończone sesje', () => { const fixture = createDemoState(); startSessionOn(fixture, 'Pierwsza'); appendSessionEvent(fixture, { type:'dice', summary:'Rzut k6' }); finishSessionOn(fixture, 'Koniec'); startSessionOn(fixture, 'Druga'); const parsed = parseImportText(JSON.stringify(buildBackupPayload(fixture))); assert(parsed.candidate?.schemaVersion === 3 && parsed.candidate.sessionLog.active.title === 'Druga' && parsed.candidate.sessionLog.archive[0].summary === 'Koniec'); });
    test('84. Raport Markdown zawiera metadane, podsumowanie i zdarzenia', () => { const fixture = createDemoState(); const session = startSessionOn(fixture, 'Raport', '2026-01-01T10:00:00.000Z'); appendSessionEvent(fixture, { type:'damage', summary:'Otrzymano obrażenia', details:'Ochrona 4 → 1' }); const ended = finishSessionOn(fixture, 'Bezpieczny powrót', '2026-01-01T12:00:00.000Z'); const report = sessionReportMarkdown(ended, fixture.identity.name); assert(report.includes('# Raport') && report.includes('Bezpieczny powrót') && report.includes('Otrzymano obrażenia') && report.includes('Mara Ciernista')); });
'''
html = replace_once(html, '    return results;\n  }', session_tests + '    return results;\n  }', 'embedded session tests')

html = replace_once(
    html,
    '      sessionPromptFor,\n      createDemoState',
    '      sessionPromptFor,\n      normalizeSessionLog,\n      startSessionOn,\n      appendSessionEvent,\n      finishSessionOn,\n      sessionReportMarkdown,\n      classifySessionChange,\n      createDemoState',
    'developer session API'
)

# Playwright tests.
tests = tests.replace("data-passed', '76'", "data-passed', '84'")
tests = tests.replace("data-total', '76'", "data-total', '84'")
playwright_addition = r'''

test('session workflow records changes and dice, then archives a summary', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await page.getByRole('button', { name: 'Rozpocznij sesję' }).click();
  await page.getByLabel('Nazwa sesji').fill('Wyprawa do ruin');
  await page.locator('#sheet').getByRole('button', { name: 'Rozpocznij', exact: true }).click();

  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const torch = page.locator('[data-item-id]').filter({ hasText: 'Pochodnia' });
  await torch.getByRole('button', { name: 'Użyj Pochodnia' }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Użyj i zmniejsz o 1' }).click();

  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k6' }).click();
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  const sessionCard = page.locator('.session-log-card');
  await expect(sessionCard.getByText('Wyprawa do ruin')).toBeVisible();
  await expect(sessionCard.getByText('Użyto: Pochodnia')).toBeVisible();
  await expect(sessionCard.getByText(/Rzut: \d+ \(1k6\)/)).toBeVisible();

  await sessionCard.getByRole('button', { name: 'Zakończ sesję' }).click();
  await page.getByLabel('Podsumowanie').fill('Odnaleziono przejście i wrócono bezpiecznie.');
  await page.locator('#sheet').getByRole('button', { name: 'Zakończ i zapisz' }).click();
  await expect(sessionCard.getByRole('button', { name: 'Rozpocznij sesję' })).toBeVisible();
  await sessionCard.getByText('Zakończone sesje').click();
  await expect(sessionCard.getByRole('button', { name: 'Otwórz sesję Wyprawa do ruin' })).toBeVisible();
});

test('schema 2 migrates to schema 3 and full backup preserves session log', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const dev = globalThis.CairnSheetDev;
    const old = dev.createDemoState();
    old.schemaVersion = 2;
    delete old.sessionLog;
    const migrated = dev.parseImportText(JSON.stringify(old)).candidate;

    const fixture = dev.createDemoState();
    dev.startSessionOn(fixture, 'Sesja kopii', '2026-01-01T10:00:00.000Z');
    dev.appendSessionEvent(fixture, { type: 'save', summary: 'Rzut obronny WOL' });
    dev.finishSessionOn(fixture, 'Podsumowanie', '2026-01-01T12:00:00.000Z');
    const restored = dev.parseImportText(JSON.stringify(dev.buildBackupPayload(fixture))).candidate;
    return {
      migratedSchema: migrated?.schemaVersion,
      migratedArchive: migrated?.sessionLog.archive.length,
      restoredTitle: restored?.sessionLog.archive[0]?.title,
      restoredSummary: restored?.sessionLog.archive[0]?.summary,
      markdown: dev.sessionReportMarkdown(restored?.sessionLog.archive[0], restored?.identity.name)
    };
  });
  expect(result.migratedSchema).toBe(3);
  expect(result.migratedArchive).toBe(0);
  expect(result.restoredTitle).toBe('Sesja kopii');
  expect(result.restoredSummary).toBe('Podsumowanie');
  expect(result.markdown).toContain('Rzut obronny WOL');
});
'''
tests = tests.rstrip() + playwright_addition + '\n'

# README and versioned assets.
readme = replace_once(
    readme,
    '- kontekstowy tryb sesji z kartą „Co teraz?”, aktywnymi stanami i szybkimi korektami;',
    '- kontekstowy tryb sesji z kartą „Co teraz?”, aktywnymi stanami i szybkimi korektami;\n- jawny log sesji: rozpoczęcie, aktywny zapis zmian i rzutów, zakończenie, podsumowanie oraz eksport Markdown/JSON;',
    'README feature'
)
readme = replace_once(
    readme,
    'Wersja 0.9.0 zachowuje `schemaVersion: 2`, bezpieczny format kopii z 0.7.0–0.8.0 i potrafi również odtworzyć starsze pliki `cairn-*-eksport.json` wygenerowane przez wersję 0.6.0.',
    'Wersja 0.10.0 używa `schemaVersion: 3`, ponieważ pełna kopia obejmuje teraz log sesji. Zapisy i kopie ze `schemaVersion: 2` są migrowane automatycznie, a starsze pliki `cairn-*-eksport.json` z wersji 0.6.0 nadal mogą zostać odtworzone. Raport sesji Markdown/JSON jest czytelnym wyciągiem i nie zastępuje pełnej kopii zapasowej.',
    'README compatibility'
)

package = replace_once(package, '"version": "0.9.0"', '"version": "0.10.0"', 'package version')
lock = lock.replace('"version": "0.9.0"', '"version": "0.10.0"', 2)
sw = replace_once(sw, "const CACHE_NAME = 'cairn-mobile-sheet-v0.9.0';", "const CACHE_NAME = 'cairn-mobile-sheet-v0.10.0';", 'service worker cache')

html_path.write_text(html, encoding='utf-8')
tests_path.write_text(tests, encoding='utf-8')
readme_path.write_text(readme, encoding='utf-8')
package_path.write_text(package, encoding='utf-8')
lock_path.write_text(lock, encoding='utf-8')
sw_path.write_text(sw, encoding='utf-8')

checksum_files = ['index.html', 'manifest.webmanifest', 'service-worker.js', 'icon.svg']
checksums = []
for filename in checksum_files:
    digest = hashlib.sha256(Path(filename).read_bytes()).hexdigest()
    checksums.append(f'{digest}  {filename}')
checksums_path.write_text('\n'.join(checksums) + '\n', encoding='utf-8')

print('Applied session log v0.10.0 implementation.')
