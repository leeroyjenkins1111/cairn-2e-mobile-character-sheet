'use strict';

(() => {
  const ENTRY_TYPES = [
    { id: 'clue', label: 'Trop', hint: 'odkrycie', placeholder: 'Co odkryliście i dokąd może to prowadzić?' },
    { id: 'person', label: 'Postać', hint: 'ważna osoba', placeholder: 'Kogo spotkaliście i dlaczego ta osoba jest ważna?' },
    { id: 'place', label: 'Miejsce', hint: 'lokacja', placeholder: 'Gdzie byliście i co warto zapamiętać o tym miejscu?' },
    { id: 'decision', label: 'Decyzja', hint: 'wybór drużyny', placeholder: 'Co postanowiliście i jakie mogą być tego konsekwencje?' },
    { id: 'loot', label: 'Łup', hint: 'zdobycz', placeholder: 'Co zdobyliście, gdzie i w jakich okolicznościach?' },
    { id: 'note', label: 'Inne', hint: 'pozostały zapis', placeholder: 'Co jeszcze warto zachować w kronice kampanii?' }
  ];
  const ENTRY_TYPE_IDS = new Set(ENTRY_TYPES.map(entry => entry.id));

  Object.assign(SESSION_EVENT_LABELS, Object.fromEntries(ENTRY_TYPES.map(entry => [entry.id, entry.label])));

  function entryType(type) {
    return ENTRY_TYPES.find(entry => entry.id === type) || ENTRY_TYPES.at(-1);
  }

  function saveCampaignEntry(type, summary) {
    const text = trimText(summary);
    if (!text) {
      showToast('Wpis nie może być pusty.', 'error');
      return false;
    }

    const next = deepClone(state);
    next.sessionLog = normalizeSessionLog(next.sessionLog);
    if (!next.sessionLog.active) {
      showToast('Najpierw rozpocznij sesję.', 'error');
      return false;
    }

    appendSessionEvent(next, { type, summary: text });
    next.updatedAt = nowIso();
    state = next;
    recordMeaningfulChange();
    scheduleSave();
    renderAll();
    showToast('Dodano wpis do kroniki sesji.');
    return true;
  }

  function openCampaignEntrySheet(initialType = 'note') {
    const sessionLog = normalizeSessionLog(state.sessionLog);
    if (!sessionLog.active) {
      openStartSessionSheet();
      return;
    }

    const selectedType = ENTRY_TYPE_IDS.has(initialType) ? initialType : 'note';
    const typeSelect = selectInput(ENTRY_TYPES.map(entry => [entry.id, entry.label]), selectedType);
    const note = textarea('', 1800);
    note.placeholder = entryType(selectedType).placeholder;
    typeSelect.addEventListener('change', () => {
      note.placeholder = entryType(typeSelect.value).placeholder;
    });

    const body = createEl('div', { className: 'form-grid journal-entry-form' }, [
      createEl('p', {
        className: 'muted small',
        text: `Wpis zostanie dodany do sesji „${sessionLog.active.title}”.`
      }),
      field('Rodzaj wpisu', typeSelect),
      field('Treść wpisu', note, 'Zapisz jedną rzecz, do której drużyna powinna móc wrócić później.')
    ]);

    const save = button('Dodaj do sesji', () => {
      if (!saveCampaignEntry(typeSelect.value, note.value)) return;
      closeSheet();
    }, 'btn btn-primary btn-block');

    openSheet({ title: `Nowy wpis: ${entryType(selectedType).label}`, body, footer: save });
    setTimeout(() => note.focus(), 0);
  }

  function renderJournalChapter(title, description) {
    return createEl('header', { className: 'journal-chapter-heading' }, [
      createEl('p', { className: 'section-kicker', text: title }),
      createEl('p', { text: description })
    ]);
  }

  function renderQuickEntryCard() {
    const sessionLog = normalizeSessionLog(state.sessionLog);
    const active = sessionLog.active;
    const section = createEl('section', {
      className: `journal-section quick-note journal-quick-entry${active ? ' is-active' : ''}`,
      attrs: { 'aria-labelledby': 'journal-quick-entry-title' }
    });

    section.append(createEl('div', { className: 'section-heading' }, [
      createEl('div', {}, [
        createEl('h2', { id: 'journal-quick-entry-title', text: 'Szybki wpis' }),
        createEl('p', {
          className: 'section-caption',
          text: active ? `Do sesji: ${active.title}` : 'Wpisy są przypisywane do konkretnej sesji.'
        })
      ]),
      active ? createEl('span', { className: 'tag session-live-badge', text: 'AKTYWNA' }) : null
    ]));

    if (!active) {
      section.append(createEl('div', { className: 'journal-quick-entry-empty' }, [
        createEl('p', { text: 'Rozpocznij sesję w panelu powyżej, aby zapisywać tropy, osoby, miejsca, decyzje i zdobyte przedmioty w jednej chronologii.' })
      ]));
      return section;
    }

    section.append(createEl('p', {
      className: 'journal-entry-question',
      text: 'Co wydarzyło się w tej chwili?'
    }));

    const actions = createEl('div', { className: 'journal-entry-grid', attrs: { 'aria-label': 'Rodzaje szybkiego wpisu' } });
    for (const entry of ENTRY_TYPES) {
      actions.append(createEl('button', {
        type: 'button',
        className: 'journal-entry-type',
        attrs: { 'aria-label': `Dodaj wpis: ${entry.label}` },
        onclick: () => openCampaignEntrySheet(entry.id)
      }, [
        createEl('strong', { text: entry.label }),
        createEl('small', { text: entry.hint })
      ]));
    }
    section.append(actions);
    return section;
  }

  function campaignEntries() {
    const sessionLog = normalizeSessionLog(state.sessionLog);
    const sessions = [
      ...(sessionLog.active ? [sessionLog.active] : []),
      ...safeArray(sessionLog.archive)
    ];

    return sessions
      .flatMap(session => safeArray(session.events)
        .filter(event => ENTRY_TYPE_IDS.has(event.type))
        .map(event => ({ ...event, sessionTitle: session.title })))
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8);
  }

  function renderCampaignChronicle() {
    const entries = campaignEntries();
    const section = createEl('section', {
      className: 'journal-section journal-chronicle',
      attrs: { 'aria-labelledby': 'journal-chronicle-title' }
    });
    section.append(createEl('div', { className: 'section-heading' }, [
      createEl('div', {}, [
        createEl('h2', { id: 'journal-chronicle-title', text: 'Kronika kampanii' }),
        createEl('p', { className: 'section-caption', text: 'Ostatnie ręcznie zapisane tropy, spotkania i decyzje.' })
      ]),
      createEl('span', { className: 'tag', text: entries.length })
    ]));

    if (!entries.length) {
      section.append(createEl('p', {
        className: 'muted small journal-empty-copy',
        text: 'Brak wpisów kampanii. Rozpocznij sesję i użyj szybkiego wpisu, aby zbudować czytelną chronologię.'
      }));
      return section;
    }

    const list = createEl('div', { className: 'journal-chronicle-list' });
    for (const entry of entries) {
      list.append(createEl('article', { className: 'journal-chronicle-entry' }, [
        createEl('div', { className: 'journal-chronicle-entry-head' }, [
          createEl('span', { className: 'tag', text: SESSION_EVENT_LABELS[entry.type] || 'Wpis' }),
          createEl('time', { text: formatDateTime(entry.time), dateTime: entry.time })
        ]),
        createEl('p', { text: entry.summary }),
        createEl('small', { text: entry.sessionTitle })
      ]));
    }
    section.append(list);
    return section;
  }

  function renderDossierCard() {
    const section = createEl('section', { className: 'journal-section journal-dossier' });
    section.append(sectionHead('Dossier postaci', button('Edytuj dane', openEditIdentitySheet, 'btn btn-quiet btn-ghost')));
    section.append(createEl('div', { className: 'journal-dossier-lead' }, [
      createEl('p', { className: 'eyebrow', text: state.identity.background || 'Bez tła' }),
      createEl('p', {
        text: state.identity.backgroundDescription || 'Brak opisu tła.',
        className: `notes-preview${state.identity.backgroundDescription ? '' : ' muted'}`
      })
    ]));
    return section;
  }

  function renderCharacterNotesCard() {
    const section = createEl('section', { className: 'journal-section journal-character-notes' });
    section.append(sectionHead('Opis postaci', button('Edytuj', openNotesSheet, 'btn btn-quiet btn-ghost')));
    section.append(createEl('div', { className: 'journal-disclosure-list' }, [
      journalDisclosure('Cechy', state.identity.traits),
      journalDisclosure('Więzi', state.identity.bonds),
      journalDisclosure('Omeny', state.identity.omens),
      journalDisclosure('Notatki postaci', state.notes)
    ]));
    return section;
  }

  function renderItemStoriesCard() {
    const items = safeArray(state.inventory?.items)
      .filter(item => trimText(item.description) || trimText(item.notes));

    const section = createEl('section', {
      className: 'journal-section journal-item-stories',
      attrs: { 'aria-labelledby': 'journal-item-stories-title' }
    });
    section.append(createEl('div', { className: 'section-heading' }, [
      createEl('div', {}, [
        createEl('h2', { id: 'journal-item-stories-title', text: 'Przedmioty i pochodzenie' }),
        createEl('p', { className: 'section-caption', text: 'Skąd pochodzą ważne rzeczy i co o nich wiadomo.' })
      ]),
      createEl('span', { className: 'tag', text: items.length })
    ]));

    if (!items.length) {
      section.append(createEl('p', {
        className: 'muted small journal-empty-copy',
        text: 'Brak opisanych przedmiotów. Opis można dodać w szczegółach przedmiotu na ekranie Ekwipunku.'
      }));
      return section;
    }

    const list = createEl('div', { className: 'journal-item-story-list' });
    for (const item of items) {
      const details = createEl('details', { className: 'journal-item-story' });
      details.append(createEl('summary', {}, [
        createEl('strong', { text: item.name }),
        createEl('span', { className: 'journal-item-story-summary', text: trimText(item.description) || 'Notatka przedmiotu' })
      ]));
      const content = createEl('div', { className: 'journal-item-story-content' });
      if (trimText(item.description)) content.append(createEl('p', { text: trimText(item.description) }));
      if (trimText(item.notes)) content.append(createEl('p', { className: 'muted small', text: trimText(item.notes) }));
      content.append(button('Otwórz przedmiot', () => openItemActionsSheet(item.id), 'btn btn-quiet'));
      details.append(content);
      list.append(details);
    }
    section.append(list);
    return section;
  }

  function renderScarsCard() {
    const section = createEl('section', { className: 'journal-section journal-scars' });
    section.append(sectionHead('Blizny', button('Dodaj', () => openAddScarSheet(), 'btn btn-quiet btn-ghost')));
    if (!state.scars.length) {
      section.append(createEl('p', { className: 'muted small journal-empty-copy', text: 'Brak zapisanych Blizn.' }));
      return section;
    }
    const list = createEl('div', { className: 'journal-disclosure-list' });
    for (const [index, scar] of state.scars.entries()) list.append(journalDisclosure(`Blizna ${index + 1}`, scar.text));
    section.append(list);
    return section;
  }

  function renderCharacterToolsCard() {
    const section = createEl('section', { className: 'journal-section journal-character-tools' });
    section.append(sectionHead('Karta postaci'));
    section.append(createEl('div', { className: 'character-data-actions' }, [
      button('Edytuj statystyki', openEditStatsSheet, 'btn'),
      button('Obrażenia atrybutu', openDirectDamageSheet, 'btn')
    ]));
    return section;
  }

  function renderJournalTools() {
    const tools = createEl('details', { className: 'journal-section journal-tools' });
    tools.append(createEl('summary', {}, [
      createEl('span', {}, [
        createEl('strong', { text: 'Historia zmian' }),
        createEl('small', { text: 'Techniczny zapis zmian karty, cofanie i czyszczenie historii.' })
      ]),
      createEl('span', { className: 'tag', text: safeArray(state.changeHistory).length })
    ]));

    const content = createEl('div', { className: 'journal-tools-content' });
    const history = createEl('div', { className: 'journal-technical-history' });
    history.append(createEl('div', { className: 'button-row' }, [
      button('Cofnij ostatnią', undoLastChange, 'btn btn-quiet', {
        disabled: !safeArray(state.changeHistory).some(entry => entry.undoable)
      }),
      button('Wyczyść historię', confirmClearChangeHistory, 'btn btn-quiet btn-ghost', {
        disabled: !safeArray(state.changeHistory).length
      })
    ]));

    const list = createEl('div', { className: 'history-list' });
    const entries = safeArray(state.changeHistory).slice().reverse();
    if (!entries.length) list.append(createEl('p', { className: 'muted small', text: 'Historia zmian jest pusta.' }));
    for (const entry of entries) {
      list.append(createEl('div', { className: 'history-item' }, [
        createEl('p', { text: entry.description }),
        createEl('time', { text: formatDateTime(entry.time), dateTime: entry.time })
      ]));
    }
    history.append(list);
    content.append(history);
    tools.append(content);
    return tools;
  }

  function renderJournalView() {
    const root = document.querySelector('#view-more');
    if (!root) return;
    root.replaceChildren();

    if (!state.initialized) {
      root.append(card([createEl('div', { className: 'card-pad' }, [
        sectionHead('Dziennik'),
        createEl('p', { className: 'muted', text: 'Najpierw utwórz lub zaimportuj postać.' }),
        button('Importuj z Kettlewright', () => document.querySelector('#importFileInput')?.click(), 'btn btn-primary btn-block')
      ])]));
      return;
    }

    root.append(
      renderJournalChapter('Kampania', 'Sesje, ręczne zapiski i chronologia wydarzeń przy stole.'),
      renderSessionLogCard(),
      renderQuickEntryCard(),
      renderCampaignChronicle(),
      renderJournalChapter('Postać i przedmioty', 'Informacje, do których wracasz podczas kolejnych sesji.'),
      renderDossierCard(),
      renderCharacterNotesCard(),
      renderItemStoriesCard(),
      renderScarsCard(),
      renderCharacterToolsCard(),
      renderJournalTools()
    );
  }

  renderMoreView = renderJournalView;
})();
