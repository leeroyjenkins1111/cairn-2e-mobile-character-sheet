from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')

css_marker = '/* PR6 compact dice dashboard */'
css = r'''
    /* PR6 compact dice dashboard */
    #view-dice { gap: 0; }
    .dice-dashboard-compact {
      display: grid;
      gap: 8px;
      min-width: 0;
    }
    .dice-dashboard-compact .card-pad { padding: 10px; }
    .dice-console-card { display: grid; gap: 8px; }
    .dice-console-head {
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(112px, 0.72fr);
      align-items: center;
      gap: 8px;
    }
    .dice-console-title h2 { margin: 0; font-size: 0.96rem; }
    .dice-console-title p { margin: 2px 0 0; color: var(--muted); font-size: 0.63rem; line-height: 1.2; }
    .dice-result-inline {
      min-height: 46px;
      padding: 5px 8px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: color-mix(in srgb, var(--surface-soft) 82%, transparent);
      overflow: hidden;
    }
    .dice-result-inline > div:not(.animated-dice-result) {
      min-height: 34px;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 7px;
      text-align: left;
    }
    .dice-result-inline > div:not(.animated-dice-result) strong { font-size: 1.12rem; }
    .dice-result-inline > div:not(.animated-dice-result) span {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      color: var(--muted);
      font-size: 0.6rem;
    }
    .dice-result-inline .animated-dice-result {
      min-height: 34px;
      grid-template-columns: 25px auto minmax(0, 1fr);
      grid-auto-flow: column;
      justify-content: start;
      gap: 6px;
      text-align: left;
    }
    .dice-result-inline .animated-dice-result .die-icon { width: 24px; height: 24px; }
    .dice-result-inline .animated-dice-result strong { font-size: 1.15rem; line-height: 1; }
    .dice-result-inline .animated-dice-result span {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: 0.58rem;
      line-height: 1.15;
    }

    .dice-dashboard-compact .dice-grid.dice-icon-grid {
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 4px;
    }
    .dice-dashboard-compact .die-button {
      min-height: 48px;
      padding: 4px 2px;
      gap: 1px;
      border-radius: 11px;
    }
    .dice-dashboard-compact .die-button .die-icon { width: 22px; height: 22px; }
    .dice-dashboard-compact .die-button span { font-size: 0.62rem; }

    .combat-scenarios-compact { display: grid; gap: 7px; }
    .combat-scenarios-head {
      min-width: 0;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .combat-scenarios-head h2 { margin: 0; font-size: 0.94rem; }
    .combat-scenarios-head p {
      margin: 0;
      color: var(--muted);
      font-size: 0.59rem;
      line-height: 1.2;
      text-align: right;
    }
    .dice-dashboard-compact .scenario-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 5px;
    }
    .dice-dashboard-compact .scenario-button {
      min-height: 72px;
      grid-template-columns: 1fr;
      grid-template-rows: 20px minmax(0, 1fr);
      place-items: center;
      gap: 3px;
      padding: 6px 4px;
      border-radius: 11px;
      text-align: center;
    }
    .dice-dashboard-compact .scenario-button > svg { width: 20px; height: 20px; color: var(--green-strong); }
    .dice-dashboard-compact .scenario-copy { gap: 1px; justify-items: center; }
    .dice-dashboard-compact .scenario-copy strong {
      max-width: 100%;
      font-size: 0.65rem;
      line-height: 1.05;
    }
    .dice-dashboard-compact .scenario-copy small {
      display: -webkit-box;
      max-width: 100%;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      color: var(--muted);
      font-size: 0.53rem;
      line-height: 1.12;
    }
    .dice-dashboard-compact .scenario-notation { color: var(--amber-strong); white-space: nowrap; }

    .dice-utility-grid {
      min-width: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      align-items: start;
    }
    .dice-utility-card {
      min-width: 0;
      min-height: 54px;
      padding: 7px 9px;
      border-radius: 14px;
    }
    .fate-utility {
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr) auto;
      align-items: center;
      gap: 7px;
      text-align: left;
      color: var(--text);
      background: var(--surface);
    }
    .fate-utility > svg { width: 22px; height: 22px; color: var(--green-strong); }
    .fate-utility-copy { min-width: 0; display: grid; gap: 1px; }
    .fate-utility-copy strong { font-family: var(--font-display); font-size: 0.75rem; }
    .fate-utility-copy small {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      color: var(--muted);
      font-size: 0.51rem;
      font-weight: 650;
    }
    .fate-utility-roll {
      display: inline-grid;
      place-items: center;
      min-width: 32px;
      min-height: 32px;
      padding: 3px 6px;
      border-radius: 9px;
      color: #22180c;
      background: linear-gradient(180deg, var(--amber-strong), var(--amber));
      font-size: 0.65rem;
      font-weight: 900;
    }
    .custom-utility { padding: 0 10px; }
    .custom-utility .advanced-roll > summary {
      min-height: 52px;
      font-family: var(--font-display);
      font-size: 0.76rem;
    }
    .custom-utility[open], .custom-utility:has(details[open]) { grid-column: 1 / -1; }
    .custom-utility .advanced-roll .form-grid { padding-bottom: 10px; }

    @media (max-width: 359px) {
      .dice-console-head { grid-template-columns: minmax(0, 1fr) 104px; }
      .dice-dashboard-compact .dice-grid.dice-icon-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .dice-dashboard-compact .die-button { min-height: 44px; }
      .dice-dashboard-compact .scenario-button { min-height: 68px; padding-inline: 3px; }
      .dice-dashboard-compact .scenario-copy strong { font-size: 0.59rem; }
      .dice-dashboard-compact .scenario-copy small { font-size: 0.48rem; }
      .fate-utility-copy small { display: none; }
    }
'''

if css_marker not in text:
    anchor = '    @media (prefers-reduced-motion: reduce) {'
    if anchor not in text:
        raise SystemExit('CSS insertion anchor not found')
    text = text.replace(anchor, css + '\n' + anchor, 1)

new_render = r'''  function renderDiceView() {
    const root = $('#view-dice');
    if (!root) return;
    root.replaceChildren();

    const dashboard = createEl('div', { className: 'dice-dashboard-compact' });

    const consoleCard = card([], 'card-pad dice-console-card');
    const consoleHead = createEl('div', { className: 'dice-console-head' }, [
      createEl('div', { className: 'dice-console-title' }, [
        createEl('h2', { text: 'Rzut kością' }),
        createEl('p', { text: 'Wybierz kość — wynik pojawi się obok.' })
      ]),
      createEl('div', {
        className: 'dice-result dice-result-inline',
        id: 'diceResult',
        attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' }
      }, [createEl('div', {}, [createEl('strong', { text: '—' }), createEl('span', { text: 'Ostatni wynik' })])])
    ]);
    consoleCard.append(consoleHead);

    const grid = createEl('div', { className: 'dice-grid dice-icon-grid' });
    for (const sides of DICE_SIDES) {
      grid.append(createEl('button', {
        type: 'button',
        className: 'btn die-button',
        attrs: { 'aria-label': `Rzuć kością k${sides}` },
        onclick: () => performRoll({ count: 1, sides }, `k${sides}`)
      }, [dieIcon(sides), createEl('span', { text: `k${sides}` })]));
    }
    consoleCard.append(grid);
    dashboard.append(consoleCard);

    const scenarios = card([], 'card-pad combat-scenarios combat-scenarios-compact');
    scenarios.append(createEl('div', { className: 'combat-scenarios-head' }, [
      createEl('h2', { text: 'Sytuacje w walce' }),
      createEl('p', { text: 'Helper wynika z fikcji lub decyzji Wardena.' })
    ]));
    scenarios.append(createEl('div', { className: 'scenario-grid' }, combatScenarioDefinitions().map(scenarioButton)));
    dashboard.append(scenarios);

    const utility = createEl('div', { className: 'dice-utility-grid' });
    const fate = createEl('button', {
      type: 'button',
      className: 'btn card dice-utility-card fate-utility',
      attrs: { 'aria-label': 'Rzuć Kością Losu k6. Wynik 1 do 3 oznacza pecha, 4 do 6 zwykle sprzyja postaciom.' },
      onclick: performFateRoll
    }, [
      uiIcon('fate'),
      createEl('span', { className: 'fate-utility-copy' }, [
        createEl('strong', { text: 'Kość Losu' }),
        createEl('small', { text: '1–3 pech · 4–6 sprzyja' })
      ]),
      createEl('span', { className: 'fate-utility-roll', text: 'k6' })
    ]);
    utility.append(fate);

    const custom = card([], 'dice-utility-card custom-utility');
    const disclosure = createEl('details', { className: 'advanced-roll' });
    disclosure.append(createEl('summary', { text: 'Rzut własny' }));
    const count = numberInput(1, 1, 100);
    const sides = selectInput(DICE_SIDES.map(side => [String(side), `k${side}`]), '6');
    const modifier = numberInput(0, -999, 999);
    const keep = createEl('input', { type: 'checkbox' });
    const form = createEl('div', { className: 'form-grid' }, [
      createEl('div', { className: 'form-grid two' }, [field('Liczba kości', count), field('Kość', sides)]),
      field('Modyfikator', modifier),
      createEl('label', { className: 'check-row' }, [keep, createEl('span', { text: 'Zachowaj tylko najwyższy wynik' })]),
      button('Rzuć', () => performRoll({ count: count.value, sides: sides.value, modifier: modifier.value, keepHighest: keep.checked }, 'Rzut własny'), 'btn btn-primary btn-block')
    ]);
    disclosure.append(form);
    custom.append(disclosure);
    utility.append(custom);
    dashboard.append(utility);

    root.append(dashboard);
  }

'''

start = text.find("  function renderDiceView() {")
if start < 0:
    raise SystemExit('renderDiceView start not found')
end = text.find("  function renderDiceResult", start)
if end < 0:
    raise SystemExit('renderDiceResult start not found')
text = text[:start] + new_render + text[end:]

path.write_text(text, encoding='utf-8')
print('Applied compact dice dashboard')
