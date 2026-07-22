'use strict';

// ============================================================
// 1. Constants
// ============================================================
const APP_ID = 'cairn-mobile-sheet';
const APP_VERSION = '0.22.0';
const SCHEMA_VERSION = 3;
const STORAGE_KEY = `${APP_ID}:state`;
const RECOVERY_KEY = `${APP_ID}:recovery`;
const CHECKPOINTS_KEY = `${APP_ID}:checkpoints`;
const BACKUP_META_KEY = `${APP_ID}:backup-meta`;
const BACKUP_REMINDER_CHANGE_THRESHOLD = 10;
const BACKUP_REMINDER_DAYS = 14;
const BACKUP_REMINDER_SNOOZE_DAYS = 3;
const HISTORY_LIMIT = 50;
const DICE_HISTORY_LIMIT = 20;
const SESSION_ARCHIVE_LIMIT = 20;
const SESSION_EVENT_LIMIT = 500;
const CHECKPOINT_LIMIT = 3;
const SAVE_DEBOUNCE_MS = 300;
const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];
const DAMAGE_DIE_SIDES = [4, 6, 8, 10, 12];
const MAX_DAMAGE_DICE = 4;
const ATTRS = {
  str: { label: 'SIŁ', full: 'Siła' },
  dex: { label: 'ZRE', full: 'Zręczność' },
  wil: { label: 'WOL', full: 'Wola' }
};
const CARRY_STATES = {
  held: 'trzymany',
  worn: 'noszony',
  stored: 'schowany',
  spent: 'zużyty'
};
const CONDITION_DEFS = [
  ['deprived', 'Pozbawienie'],
  ['panicked', 'Panika'],
  ['criticalDamage', 'Obrażenia krytyczne'],
  ['stabilized', 'Stabilizacja'],
  ['paralyzed', 'Paraliż'],
  ['delirious', 'Delirium']
];
const SCAR_GUIDE = {
  1: { title: 'Trwała blizna', summary: 'Rzuć k6, aby wskazać miejsce blizny. Kolejny k6 może podnieść maksymalną Ochronę.', helper: 'scar-location' },
  2: { title: 'Gruchoczący cios', summary: 'Postać jest zdezorientowana. Opisz, jak odzyskuje koncentrację; k6 może podnieść maksymalną Ochronę.' },
  3: { title: 'Powalony', summary: 'Postać odczuwa dyskomfort do kilku godzin odpoczynku, a następnie dodaje wynik k6 do maksymalnej Ochrony.' },
  4: { title: 'Złamana kość', summary: 'Rzuć k6, aby wskazać uraz. Po zrośnięciu 2k6 może podnieść maksymalną Ochronę.', helper: 'broken-bone' },
  5: { title: 'Choroba', summary: 'Po wyzdrowieniu 2k6 może podnieść maksymalną Ochronę.' },
  6: { title: 'Poważna rana głowy', summary: 'Rzuć k6, aby wskazać atrybut; następnie 3k6 może podnieść jego aktualną wartość.', helper: 'head-wound' },
  7: { title: 'Uszkodzone ścięgno', summary: 'Postać ledwo się porusza do czasu poważnej pomocy i odpoczynku. Po wyzdrowieniu 3k6 może podnieść maksymalne ZRE.' },
  8: { title: 'Ogłuchnięcie', summary: 'Postać nic nie słyszy do czasu wyjątkowej pomocy. Udany rzut WOL pozwala zwiększyć maksymalne WOL o k4.' },
  9: { title: 'Uraz psychiczny', summary: 'Rzut 3k6 może podnieść maksymalne WOL.' },
  10: { title: 'Utrata kończyny', summary: 'Warden wskazuje dotkniętą kończynę. Udany rzut WOL pozwala zwiększyć maksymalne WOL o k6.' },
  11: { title: 'Śmiertelna rana', summary: 'Postać odczuwa dyskomfort, jest wyłączona z działania i umrze w godzinę bez leczenia. Po wyzdrowieniu 2k6 wyznacza nową maksymalną Ochronę.' },
  12: { title: 'Skazany na zagładę', summary: 'Następna porażka rzutu przeciw obrażeniom krytycznym oznacza śmierć. Po sukcesie 3k6 może podnieść maksymalną Ochronę.' }
};

// ============================================================
// 2. Utilities
// ============================================================
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const deepClone = (value) => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));
const nowIso = () => new Date().toISOString();
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const trimText = (value, fallback = '') => typeof value === 'string' ? value.trim() : fallback;
const safeArray = (value) => Array.isArray(value) ? value : [];
const makeId = () => {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${secureRandomInt(1_000_000).toString(36)}`;
};
const formatDateTime = (iso) => {
  try { return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)); }
  catch { return iso || ''; }
};
const initials = (name) => {
  const parts = trimText(name).split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map(p => p[0]).join('') || '?').toUpperCase();
};
const createEl = (tag, options = {}, children = []) => {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (key === 'className') el.className = value;
    else if (key === 'text') el.textContent = String(value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'attrs') for (const [name, val] of Object.entries(value)) {
      if (val === false || val === null || val === undefined) continue;
      el.setAttribute(name, val === true ? '' : String(val));
    }
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in el) el[key] = value;
    else el.setAttribute(key, value);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
};
const button = (label, onClick, className = 'btn', attrs = {}) => createEl('button', {
  type: 'button', className, text: label, attrs, onclick: onClick
});
const field = (labelText, control, helpText = '') => {
  const wrap = createEl('div', { className: 'field' });
  const id = control.id || makeId();
  control.id = id;
  wrap.append(createEl('label', { text: labelText, htmlFor: id }), control);
  if (helpText) wrap.append(createEl('p', { className: 'help', text: helpText }));
  return wrap;
};
const numberInput = (value, min = 0, max = 99, step = 1) => createEl('input', {
  type: 'number', value, min, max, step, inputMode: 'numeric'
});
const textInput = (value = '', maxLength = 200) => createEl('input', {
  type: 'text', value, maxLength, autoComplete: 'off'
});
const textarea = (value = '', maxLength = 5000) => createEl('textarea', { value, maxLength });
const selectInput = (options, value) => {
  const select = createEl('select');
  for (const [optionValue, label] of options) {
    select.append(createEl('option', { value: optionValue, text: label, selected: optionValue === value }));
  }
  return select;
};
const announce = (message) => {
  const live = $('#liveRegion');
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = message; });
};
let toastTimer = null;
const showToast = (message, type = 'info') => {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast show${type === 'error' ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3300);
};
const downloadTextFile = (filename, text, type = 'application/json') => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = createEl('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const jsonEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function parseDamageFormulaNotation(notation, blast = false) {
  const normalized = trimText(notation).toLowerCase().replace(/\s+/g, '');
  if (!normalized) return null;
  const pattern = /^d(?:4|6|8|10|12)(?:\+d(?:4|6|8|10|12)){0,3}$/;
  if (!pattern.test(normalized)) return null;
  const dice = normalized.split('+').map(token => toInt(token.slice(1), 0));
  return { dice, keep: dice.length > 1 ? 'highest' : 'sum', blast: Boolean(blast) };
}

function normalizeDamageFormula(value, fallbackBlast = false) {
  if (!value) return null;
  if (typeof value === 'string') return parseDamageFormulaNotation(value, fallbackBlast);
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const dice = safeArray(value.dice).map(side => toInt(side, 0));
  if (!dice.length || dice.length > MAX_DAMAGE_DICE || dice.some(side => !DAMAGE_DIE_SIDES.includes(side))) return null;
  const keep = dice.length === 1 ? 'sum' : 'highest';
  return { dice, keep, blast: Boolean(value.blast ?? fallbackBlast) };
}

function formatDamageFormula(formula) {
  const normalized = normalizeDamageFormula(formula);
  return normalized ? normalized.dice.map(side => `d${side}`).join('+') : '';
}

function isDamageFormulaTag(value) {
  return Boolean(parseDamageFormulaNotation(String(value || '')));
}

function rollDamageFormula(formula, roller = rollDie) {
  const normalized = normalizeDamageFormula(formula);
  if (!normalized) throw new Error('Nieprawidłowa formuła obrażeń.');
  const rolls = normalized.dice.map((sides, index) => {
    const value = toInt(roller(sides, index), 0);
    if (value < 1 || value > sides) throw new Error(`Nieprawidłowy wynik k${sides}.`);
    return { sides, value };
  });
  const values = rolls.map(entry => entry.value);
  const total = normalized.keep === 'highest' ? Math.max(...values) : values.reduce((sum, value) => sum + value, 0);
  return { formula: normalized, notation: formatDamageFormula(normalized), rolls, total };
}



function parseAttackDiceList(value) {
  const normalized = trimText(value).toLowerCase();
  if (!normalized) return null;
  const tokens = normalized.split(',').map(token => token.trim()).filter(Boolean);
  if (!tokens.length || tokens.length > 20) return null;
  if (tokens.some(token => !/^k(?:4|6|8|10|12)$/.test(token))) return null;
  return tokens.map(token => ({ token, sides: toInt(token.slice(1), 0) }));
}
function polishUsesLabel(value) {
  const count = Math.max(0, toInt(value, 0));
  const lastTwo = count % 100;
  const last = count % 10;
  const noun = count === 1 ? 'użycie' : last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? 'użycia' : 'użyć';
  return `${count} ${noun}`;
}

function formatUses(uses) {
  if (!uses || (uses.current === null && uses.max === null)) return '';
  if (uses.max === null) return polishUsesLabel(uses.current ?? 0);
  return `${uses.current ?? 0}/${uses.max}`;
}

// ============================================================
// 3. Model and defaults
// ============================================================
function createDefaultState() {
  const timestamp = nowIso();
  return {
    appId: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    characterId: makeId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    initialized: false,
    isDemo: false,
    identity: {
      name: '',
      background: '',
      backgroundDescription: '',
      portrait: { type: 'initial', value: '' },
      traits: '',
      bonds: '',
      omens: ''
    },
    stats: {
      hp: { current: 0, max: 0 },
      str: { current: 0, max: 0 },
      dex: { current: 0, max: 0 },
      wil: { current: 0, max: 0 },
      armor: { mode: 'equipment', manual: 0, importedValue: null },
      gold: 0
    },
    inventory: { slotLimit: 10, items: [], fatigue: [] },
    conditions: {
      deprived: false,
      panicked: false,
      criticalDamage: false,
      stabilized: false,
      paralyzed: false,
      delirious: false,
      custom: []
    },
    scars: [],
    notes: '',
    diceHistory: [],
    changeHistory: [],
    sessionLog: { active: null, archive: [] },
    source: {
      type: 'manual',
      importedAt: null,
      adapterVersion: null,
      sourceId: null,
      original: null,
      containerMetadata: [],
      unmappedPaths: [],
      warnings: []
    },
    settings: {
      theme: 'dark',
      reducedMotionOverride: null,
      hapticsEnabled: true
    }
  };
}

function createDemoState() {
  const demo = createDefaultState();
  demo.initialized = true;
  demo.isDemo = true;
  demo.identity = {
    name: 'Mara Ciernista',
    background: 'Zwiadowczyni Głębokiego Boru',
    backgroundDescription: 'Dane demonstracyjne — możesz je dowolnie zmienić lub usunąć.',
    portrait: { type: 'initial', value: 'MC' },
    traits: 'Cicha, uważna i zawsze gotowa do odwrotu.',
    bonds: 'Obiecała wrócić po kogoś, kto został w Lesie.',
    omens: 'Ptaki milkną, gdy zbliża się mgła.'
  };
  demo.stats = {
    hp: { current: 4, max: 5 },
    str: { current: 11, max: 12 },
    dex: { current: 15, max: 15 },
    wil: { current: 10, max: 10 },
    armor: { mode: 'equipment', manual: 0, importedValue: null },
    gold: 18
  };
  demo.inventory.items = [
    makeItem({ name: 'Krótki łuk', description: 'Lekki łuk myśliwski.', damageFormula: parseDamageFormulaNotation('d6'), slots: 1, carryState: 'held' }),
    makeItem({ name: 'Skórzany kaftan', description: 'Wytarty, ale nadal użyteczny.', armorValue: 1, slots: 1, carryState: 'worn' }),
    makeItem({ name: 'Pochodnia', uses: { current: 2, max: 3 }, slots: 1 }),
    makeItem({ name: 'Suszone racje', uses: { current: 2, max: 3 }, slots: 1 }),
    makeItem({ name: 'Mosiężny gwizdek', slots: 0, traits: ['drobiazg'] })
  ];
  demo.notes = 'To przykładowa karta. Nie zawiera danych z importu.';
  return demo;
}

function makeItem(partial = {}) {
  const rawTraits = Array.from(new Set(safeArray(partial.traits).map(String)));
  const blastFromTraits = rawTraits.some(trait => trait.toLowerCase() === 'blast');
  const formulaSource = partial.damageFormula || partial.damageDie || null;
  const damageFormula = normalizeDamageFormula(formulaSource, blastFromTraits);
  const sourceExtras = partial.sourceExtras && typeof partial.sourceExtras === 'object' ? deepClone(partial.sourceExtras) : {};
  if (partial.damageDie && !damageFormula) sourceExtras.legacyDamageDie = String(partial.damageDie);
  if (partial.damageFormula && !damageFormula) sourceExtras.unparsedDamageFormula = deepClone(partial.damageFormula);
  return {
    id: partial.id || makeId(),
    sourceId: partial.sourceId ?? null,
    name: partial.name || 'Nowy przedmiot',
    description: partial.description || '',
    slots: clamp(toInt(partial.slots, 1), 0, 10),
    category: partial.category || 'inne',
    damageFormula,
    armorValue: clamp(toInt(partial.armorValue, 0), 0, 3),
    uses: partial.uses ? {
      current: partial.uses.current === null ? null : Math.max(0, toInt(partial.uses.current, 0)),
      max: partial.uses.max === null || partial.uses.max === undefined || partial.uses.max === '' ? null : Math.max(0, toInt(partial.uses.max, 0))
    } : { current: null, max: null },
    carryState: partial.carryState || 'stored',
    traits: rawTraits.filter(trait => !(damageFormula?.blast && trait.toLowerCase() === 'blast')),
    notes: partial.notes || '',
    sourceExtras
  };
}

function makeFatigue(partial = {}) {
  return {
    id: partial.id || makeId(),
    addedAt: partial.addedAt || nowIso(),
    source: partial.source || 'manual',
    note: partial.note || '',
    slots: 1
  };
}


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

// ============================================================
// 4. Validation and migrations
// ============================================================
function validateState(candidate) {
  const errors = [];
  const warnings = [];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) errors.push('Dane nie są obiektem karty.');
  if (candidate?.appId !== APP_ID) errors.push('Nieprawidłowy identyfikator formatu kopii.');
  if (!Number.isInteger(candidate?.schemaVersion)) errors.push('Brak prawidłowego schemaVersion.');
  if (candidate?.schemaVersion > SCHEMA_VERSION) errors.push(`Kopia używa nowszej wersji schematu (${candidate.schemaVersion}).`);
  if (!candidate?.identity || typeof candidate.identity !== 'object') errors.push('Brak danych podstawowych postaci.');
  if (!candidate?.stats || typeof candidate.stats !== 'object') errors.push('Brak statystyk postaci.');
  if (!candidate?.inventory || !Array.isArray(candidate.inventory.items) || !Array.isArray(candidate.inventory.fatigue)) errors.push('Nieprawidłowy ekwipunek.');
  if (candidate?.inventory?.items?.length > 200) errors.push('Zbyt wiele przedmiotów w pliku.');
  if (!candidate?.sessionLog || typeof candidate.sessionLog !== 'object' || !Array.isArray(candidate.sessionLog.archive)) errors.push('Nieprawidłowy log sesji.');
  if (candidate?.stats) {
    for (const key of ['hp', 'str', 'dex', 'wil']) {
      const pair = candidate.stats[key];
      if (!pair || !Number.isFinite(Number(pair.current)) || !Number.isFinite(Number(pair.max))) errors.push(`Nieprawidłowa statystyka: ${key}.`);
    }
  }
  if (candidate?.inventory) {
    const usage = calculateInventoryUsage(candidate.inventory.items || [], candidate.inventory.fatigue || []);
    if (usage.total > 10) errors.push(`Ekwipunek zajmuje ${usage.total}/10 miejsc.`);
    if (usage.total === 10 && toInt(candidate?.stats?.hp?.current, 0) > 0) warnings.push('Pełny ekwipunek przy Ochronie powyżej 0 wymaga rozpatrzenia reguły 0 Ochrony.');
  }
  if (candidate?.conditions?.panicked && toInt(candidate?.stats?.hp?.current, 0) > 0) warnings.push('Postać jest spanikowana, ale ma Ochronę powyżej 0.');
  return { valid: errors.length === 0, errors, warnings };
}

function migrateV1ToV2(candidate) {
  const migrated = deepClone(candidate);
  migrated.inventory = { slotLimit: 10, items: [], fatigue: [], ...(migrated.inventory || {}) };
  migrated.inventory.items = safeArray(migrated.inventory.items).map(rawItem => {
    const item = rawItem && typeof rawItem === 'object' ? deepClone(rawItem) : {};
    const traits = safeArray(item.traits).map(String);
    const formula = normalizeDamageFormula(item.damageFormula || item.damageDie, traits.some(trait => trait.toLowerCase() === 'blast'));
    item.damageFormula = formula;
    item.traits = traits.filter(trait => !(formula?.blast && trait.toLowerCase() === 'blast'));
    if (Object.prototype.hasOwnProperty.call(item, 'damageDie')) {
      item.sourceExtras = { ...(item.sourceExtras || {}), legacyDamageDie: item.damageDie };
      delete item.damageDie;
    }
    return item;
  });
  migrated.schemaVersion = 2;
  return migrated;
}


function migrateV2ToV3(candidate) {
  const migrated = deepClone(candidate);
  migrated.sessionLog = normalizeSessionLog(migrated.sessionLog);
  migrated.schemaVersion = 3;
  return migrated;
}

function migrateState(candidate) {
  let migrated = deepClone(candidate);
  if (!Number.isInteger(migrated.schemaVersion)) throw new Error('Brak schemaVersion.');
  if (migrated.schemaVersion > SCHEMA_VERSION) throw new Error('Nieobsługiwana nowsza wersja danych.');
  while (migrated.schemaVersion < SCHEMA_VERSION) {
    if (migrated.schemaVersion === 1) migrated = migrateV1ToV2(migrated);
    else if (migrated.schemaVersion === 2) migrated = migrateV2ToV3(migrated);
    else throw new Error(`Brak migracji dla schemaVersion ${migrated.schemaVersion}.`);
  }
  migrated.appVersion = APP_VERSION;
  migrated.schemaVersion = SCHEMA_VERSION;
  migrated.settings = { theme: 'dark', reducedMotionOverride: null, hapticsEnabled: true, ...(migrated.settings || {}) };
  migrated.changeHistory = safeArray(migrated.changeHistory).slice(-HISTORY_LIMIT);
  migrated.diceHistory = safeArray(migrated.diceHistory).slice(-DICE_HISTORY_LIMIT);
  migrated.sessionLog = normalizeSessionLog(migrated.sessionLog);
  return migrated;
}

function sanitizeLoadedState(candidate) {
  const base = createDefaultState();
  const migrated = migrateState(candidate);
  const merged = {
    ...base,
    ...migrated,
    identity: { ...base.identity, ...(migrated.identity || {}), portrait: { ...base.identity.portrait, ...(migrated.identity?.portrait || {}) } },
    stats: {
      ...base.stats,
      ...(migrated.stats || {}),
      hp: { ...base.stats.hp, ...(migrated.stats?.hp || {}) },
      str: { ...base.stats.str, ...(migrated.stats?.str || {}) },
      dex: { ...base.stats.dex, ...(migrated.stats?.dex || {}) },
      wil: { ...base.stats.wil, ...(migrated.stats?.wil || {}) },
      armor: { ...base.stats.armor, ...(migrated.stats?.armor || {}) }
    },
    inventory: { ...base.inventory, ...(migrated.inventory || {}), items: safeArray(migrated.inventory?.items).map(makeItem), fatigue: safeArray(migrated.inventory?.fatigue).map(makeFatigue) },
    conditions: { ...base.conditions, ...(migrated.conditions || {}), custom: safeArray(migrated.conditions?.custom) },
    source: { ...base.source, ...(migrated.source || {}) },
    settings: { ...base.settings, ...(migrated.settings || {}) },
    sessionLog: normalizeSessionLog(migrated.sessionLog)
  };
  return merged;
}

// ============================================================
// 5. Storage
// ============================================================
let state = createDefaultState();
let storageBlocked = false;
let loadWarning = '';
let saveTimer = null;
let backupMeta = createDefaultBackupMeta();
let recoveryCheckpoints = [];
let deferredInstallPrompt = null;

function canUseStorage() {
  try {
    const key = `${APP_ID}:probe`;
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch { return false; }
}


function safeStorageGet(key) {
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
function loadState() {
  if (!canUseStorage()) {
    storageBlocked = true;
    loadWarning = 'Przeglądarka blokuje zapis lokalny. Eksportuj kopię po każdej sesji.';
    return createDefaultState();
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createDefaultState();
  try {
    const parsed = JSON.parse(raw);
    const migrated = sanitizeLoadedState(parsed);
    const validation = validateState(migrated);
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    loadWarning = validation.warnings.join(' ');
    return migrated;
  } catch (error) {
    try { localStorage.setItem(RECOVERY_KEY, raw); } catch {}
    loadWarning = `Nie udało się odczytać zapisu. Oryginalne dane zachowano jako kopię odzyskiwania. ${error.message}`;
    return createDefaultState();
  }
}

function scheduleSave() {
  if (storageBlocked) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, SAVE_DEBOUNCE_MS);
}

function saveNow() {
  if (storageBlocked) return false;
  try {
    state.updatedAt = nowIso();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    storageBlocked = true;
    showToast(`Nie udało się zapisać danych: ${error.message}`, 'error');
    announce('Błąd zapisu lokalnego.');
    return false;
  }
}

// ============================================================
// 6. History and undo
// ============================================================
function snapshotForHistory(sourceState = state) {
  return deepClone({
    initialized: sourceState.initialized,
    isDemo: sourceState.isDemo,
    identity: sourceState.identity,
    stats: sourceState.stats,
    inventory: sourceState.inventory,
    conditions: sourceState.conditions,
    scars: sourceState.scars,
    notes: sourceState.notes
  });
}

function applySnapshot(target, snapshot) {
  for (const key of ['initialized', 'isDemo', 'identity', 'stats', 'inventory', 'conditions', 'scars', 'notes']) {
    target[key] = deepClone(snapshot[key]);
  }
}

function commitChange(description, mutator, options = {}) {
  const before = snapshotForHistory();
  const next = deepClone(state);
  mutator(next);
  next.updatedAt = nowIso();
  const after = snapshotForHistory(next);
  if (jsonEqual(before, after)) {
    if (!options.silentNoop) showToast('Brak zmian do zapisania.');
    return false;
  }
  const entry = {
    id: makeId(),
    time: nowIso(),
    description,
    before,
    after,
    undoable: options.undoable !== false
  };
  next.changeHistory = [...safeArray(state.changeHistory), entry].slice(-HISTORY_LIMIT);
  appendSessionEvent(next, { type: options.sessionType || classifySessionChange(description), summary: description, details: trimText(options.sessionDetails) });
  state = next;
  recordMeaningfulChange();
  scheduleSave();
  renderAll();
  if (!options.silent) showToast(description);
  return true;
}

function recordEvent(description) {
  const unchanged = snapshotForHistory();
  const entry = { id: makeId(), time: nowIso(), description, before: unchanged, after: deepClone(unchanged), undoable: false };
  state.changeHistory = [...safeArray(state.changeHistory), entry].slice(-HISTORY_LIMIT);
  appendSessionEvent(state, { type: classifySessionChange(description), summary: description });
  scheduleSave();
}

function undoLastChange() {
  const history = safeArray(state.changeHistory);
  let index = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].undoable && history[i].before) { index = i; break; }
  }
  if (index < 0) {
    showToast('Brak zmiany możliwej do cofnięcia.');
    return;
  }
  const entry = history[index];
  const next = deepClone(state);
  applySnapshot(next, entry.before);
  next.changeHistory = history.filter((_, i) => i !== index);
  next.updatedAt = nowIso();
  appendSessionEvent(next, { type: 'undo', summary: `Cofnięto: ${entry.description}` });
  state = next;
  recordMeaningfulChange();
  scheduleSave();
  renderAll();
  showToast(`Cofnięto: ${entry.description}`);
  announce(`Cofnięto zmianę: ${entry.description}`);
}

// ============================================================
// 7. Dice engine
// ============================================================
function secureRandomInt(maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) throw new Error('Nieprawidłowy zakres losowania.');
  if (!globalThis.crypto?.getRandomValues) throw new Error('Ta przeglądarka nie udostępnia crypto.getRandomValues.');
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const array = new Uint32Array(1);
  do { crypto.getRandomValues(array); } while (array[0] >= limit);
  return array[0] % maxExclusive;
}

function rollDie(sides) { return secureRandomInt(sides) + 1; }

function rollDice({ count = 1, sides = 6, modifier = 0, keepHighest = false } = {}) {
  count = clamp(toInt(count, 1), 1, 100);
  sides = clamp(toInt(sides, 6), 2, 1000);
  modifier = clamp(toInt(modifier, 0), -999, 999);
  const rolls = Array.from({ length: count }, () => rollDie(sides));
  const base = keepHighest ? Math.max(...rolls) : rolls.reduce((sum, value) => sum + value, 0);
  return { count, sides, modifier, keepHighest, rolls, base, total: base + modifier };
}

function resolveSave(attributeValue, roll) {
  const target = clamp(toInt(attributeValue, 0), 0, 99);
  const natural = toInt(roll, 0);
  const success = natural === 1 ? true : natural === 20 ? false : natural <= target;
  return { target, roll: natural, success, naturalSuccess: natural === 1, naturalFailure: natural === 20 };
}

function resolvePanicRecovery(sourceState, roll) {
  const save = resolveSave(sourceState?.stats?.wil?.current, roll);
  const panickedBefore = Boolean(sourceState?.conditions?.panicked);
  const hpBefore = Math.max(0, toInt(sourceState?.stats?.hp?.current, 0));
  return {
    ...save,
    panickedBefore,
    panickedAfter: panickedBefore && !save.success,
    hpBefore,
    hpAfter: hpBefore
  };
}

function applyPanicRecoveryMutation(target, result) {
  if (result?.success) target.conditions.panicked = false;
}

function recordDiceEntry(target, entry) {
  const recorded = { id: makeId(), time: nowIso(), ...entry };
  const repeat = normalizeDiceRepeatSpec(entry?.repeat);
  if (repeat) recorded.repeat = repeat;
  else delete recorded.repeat;
  target.diceHistory = [recorded, ...safeArray(target.diceHistory)].slice(0, DICE_HISTORY_LIMIT);
  return target.diceHistory[0];
}


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

function addDiceHistory(entry) {
  const recorded = recordDiceEntry(state, entry);
  appendSessionEvent(state, { type: sessionEventTypeForDice(recorded), summary: recorded.summary, details: recorded.details });
  scheduleSave();
  renderDiceView();
  if (activeView === 'more') renderMoreView();
}

function performRoll(config, label = '') {
  try {
    const result = rollDice(config);
    const notation = `${result.count}k${result.sides}${result.modifier ? (result.modifier > 0 ? `+${result.modifier}` : result.modifier) : ''}`;
    const details = `${result.rolls.join(', ')}${result.keepHighest ? ` → najwyższy ${result.base}` : ''}`;
    const summary = `${label || 'Rzut'}: ${result.total} (${notation})`;
    addDiceHistory({ type: 'dice', label: label || 'Rzut', summary, notation, result: result.total, details, repeat: { kind: 'roll', label: label || 'Rzut', config: { count: result.count, sides: result.sides, modifier: result.modifier, keepHighest: result.keepHighest } } });
    renderDiceResult(result.total, `${label || notation} · ${details}`, { sides: result.sides });
    announce(`${summary}. Wyniki kości: ${result.rolls.join(', ')}.`);
    return result;
  } catch (error) {
    showToast(error.message, 'error');
    return null;
  }
}

function performSave(attrKey, forcedRoll = null, options = {}) {
  const attr = state.stats[attrKey];
  if (!attr) return;
  const stake = trimText(options?.stake).slice(0, 200);
  let roll;
  try { roll = forcedRoll ?? rollDie(20); }
  catch (error) { showToast(error.message, 'error'); return; }
  const result = resolveSave(attr.current, roll);
  const natural = result.naturalSuccess ? ' — naturalne 1' : result.naturalFailure ? ' — naturalne 20' : '';
  const summary = `Rzut obronny ${ATTRS[attrKey].label}: ${roll} vs ${attr.current} — ${result.success ? 'sukces' : 'porażka'}${natural}`;
  const historyDetails = [`Cel: ${attr.current}`, stake ? `Stawka: ${stake}` : 'Stawka ustalona przy stole'].join(' · ');
  addDiceHistory({ type: 'save', attr: attrKey, label: `Rzut obronny ${ATTRS[attrKey].label}`, summary, notation: '1k20', result: roll, success: result.success, details: historyDetails, repeat: { kind: 'save', attrKey } });
  announce(summary);
  openSaveResultSheet(attrKey, roll, result, stake);
  return result;
}

function transitionFromSheet(openNext) {
  closeSheet();
  requestAnimationFrame(() => openNext?.());
}

function openSaveResultSheet(attrKey, roll, result, stake = '') {
  const attr = state.stats[attrKey];
  if (!attr) return;
  const success = Boolean(result?.success);
  const body = createEl('div', { className: 'sheet-list save-result-flow' });
  const resultPanel = createEl('div', { className: 'dice-result', attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' } });
  body.append(resultPanel);
  body.append(createEl('div', { className: 'report-block save-result-stake' }, [
    createEl('span', { className: 'section-kicker', text: stake ? 'Ustalona stawka' : 'Skutek ustalony przy stole' }),
    createEl('strong', { text: stake || 'Zastosuj konsekwencję zapowiedzianą przed rzutem.' })
  ]));
  body.append(createEl('p', {
    text: success
      ? 'Unikasz zapowiedzianego negatywnego skutku. Warden opisuje, co dzieje się dalej.'
      : 'Porażka uruchamia ustalony wcześniej skutek. Warden opisuje zmianę sytuacji.'
  }));
  body.append(createEl('p', {
    className: 'muted small',
    text: result.naturalSuccess
      ? 'Naturalne 1 zawsze oznacza sukces.'
      : result.naturalFailure
        ? 'Naturalne 20 zawsze oznacza porażkę.'
        : `Wynik ${roll} jest ${success ? 'równy lub niższy' : 'wyższy'} od ${attr.current}.`
  }));

  const back = button('Wróć do gry', closeSheet, 'btn btn-primary');
  const footer = success
    ? back
    : createEl('div', { className: 'button-row' }, [
        button('Rozpatrz skutek…', () => transitionFromSheet(() => openSaveConsequenceSheet(stake)), 'btn btn-ghost'),
        back
      ]);
  openSheet({ title: `Rzut obronny ${ATTRS[attrKey].label}`, body, footer });
  animateDiceResult(resultPanel, roll, success ? 'Sukces' : 'Porażka', 20, success ? 'success' : 'danger');
}

function consequenceAction(label, description, icon, action) {
  return createEl('button', {
    type: 'button',
    className: 'action-row',
    onclick: action
  }, [
    uiIcon(icon),
    createEl('span', {}, [createEl('strong', { text: label }), createEl('small', { text: description })]),
    createEl('span', { className: 'action-row-value', text: '›', attrs: { 'aria-hidden': 'true' } })
  ]);
}

function openSaveConsequenceSheet(stake = '') {
  const body = createEl('div', { className: 'save-consequence-list' });
  body.append(createEl('p', {
    className: 'muted small',
    text: stake
      ? `Ustalona stawka: ${stake}`
      : 'Wybierz narzędzie tylko wtedy, gdy odpowiada konsekwencji opisanej przez Wardena.'
  }));
  body.append(
    consequenceAction('Rozlicz obrażenia', 'Pancerz → OCHR → SIŁ', 'damage', () => transitionFromSheet(openDamageSheet)),
    consequenceAction('Obrażenia atrybutu', 'Bezpośrednia utrata SIŁ, ZRE lub WOL', 'attribute', () => transitionFromSheet(openDirectDamageSheet)),
    consequenceAction('Zmień stan', 'Panika, pozbawienie lub inny stan', 'more', () => transitionFromSheet(openConditionsSheet)),
    consequenceAction('Przejdź do ekwipunku', 'Użycie, utrata lub zmiana przedmiotu', 'box', () => {
      closeSheet();
      setView('inventory', { announceChange: true });
    }),
    consequenceAction('Zapisz konsekwencję', 'Dodaj ją do szybkiej notatki', 'dice', () => transitionFromSheet(() => openQuickNoteSheet(stake)))
  );
  openSheet({
    title: 'Rozpatrz skutek',
    body,
    footer: button('Tylko skutek w fikcji', closeSheet, 'btn btn-primary btn-block')
  });
}

function normalizeForcedDie(value, sides) {
  return Number.isInteger(value) && value >= 1 && value <= sides ? value : null;
}

function normalizeForcedD20(value) {
  return normalizeForcedDie(value, 20);
}

function attemptRecoverFromPanic(forcedRoll = null) {
  if (!state.conditions.panicked) {
    showToast('Postać nie jest obecnie spanikowana.');
    return null;
  }
  const forcedD20 = normalizeForcedD20(forcedRoll);
  let roll;
  try { roll = forcedD20 ?? rollDie(20); }
  catch (error) { showToast(error.message, 'error'); return null; }
  const result = resolvePanicRecovery(state, roll);
  const natural = result.naturalSuccess ? ' — naturalne 1' : result.naturalFailure ? ' — naturalne 20' : '';
  const summary = `Opanowanie paniki — WOL: ${roll} vs ${result.target} — ${result.success ? 'sukces' : 'porażka'}${natural}`;
  addDiceHistory({ type: 'save', attr: 'wil', label: 'Opanowanie paniki', summary, notation: '1k20', result: roll, success: result.success, details: `Cel: ${result.target}` });
  if (result.success) {
    commitChange('Opanowano panikę po udanym rzucie WOL', next => applyPanicRecoveryMutation(next, result), { silent: true });
  }
  const details = [
    `Aktualna WOL: ${result.target}.`,
    result.naturalSuccess ? 'Naturalne 1 zawsze oznacza sukces.' : result.naturalFailure ? 'Naturalne 20 zawsze oznacza porażkę.' : `Wynik ${roll} jest ${result.success ? 'równy lub niższy' : 'wyższy'} od ${result.target}.`,
    result.success ? `Panika została usunięta. Ochrona pozostaje bez zmian (${result.hpAfter}).` : 'Panika pozostaje aktywna.'
  ];
  openResultSheet('Spróbuj opanować panikę', roll, result.success ? 'Sukces' : 'Porażka', details, result.success ? 'success' : 'danger', { sides: 20 });
  announce(summary);
  return result;
}

function resolveFirstRoundDex(sourceState, roll) {
  const blockedByPanic = Boolean(sourceState?.conditions?.panicked);
  const save = resolveSave(sourceState?.stats?.dex?.current, roll);
  return { ...save, blockedByPanic, canAct: !blockedByPanic && save.success };
}

function performFirstRoundDexSave(forcedRoll = null) {
  if (state.conditions.panicked) {
    openResultSheet('Pierwsza runda walki', '—', 'Brak akcji', [
      'Spanikowana postać nie działa w pierwszej rundzie walki.',
      'Od drugiej rundy działasz normalnie, ale ataki pozostają osłabione, dopóki trwa panika.',
      'Specjalne okoliczności mogą zmienić ten wymóg wyłącznie decyzją Wardena.'
    ], 'danger', { animate: false, footer: button('Wróć do gry', closeSheet, 'btn btn-primary btn-block') });
    announce('Spanikowana postać nie działa w pierwszej rundzie walki.');
    return { blockedByPanic: true, canAct: false };
  }
  const forcedD20 = normalizeForcedD20(forcedRoll);
  let roll;
  try { roll = forcedD20 ?? rollDie(20); }
  catch (error) { showToast(error.message, 'error'); return null; }
  const result = resolveFirstRoundDex(state, roll);
  const natural = result.naturalSuccess ? ' — naturalne 1' : result.naturalFailure ? ' — naturalne 20' : '';
  const summary = `Pierwsza runda — ZRE: ${roll} vs ${result.target} — ${result.canAct ? 'działasz' : 'tracisz turę'}${natural}`;
  addDiceHistory({ type: 'save', attr: 'dex', label: 'Pierwsza runda — ZRE', summary, notation: '1k20', result: roll, success: result.canAct, details: `Cel: ${result.target}` });
  const footer = result.canAct
    ? createEl('div', { className: 'button-row' }, [
        button('Wróć do gry', closeSheet, 'btn btn-ghost'),
        button('Wybierz działanie', () => transitionFromSheet(openCombatSheet), 'btn btn-primary')
      ])
    : button('Wróć do gry', closeSheet, 'btn btn-primary btn-block');
  openResultSheet('Pierwsza runda walki', roll, result.canAct ? 'Możesz działać' : 'Tracisz turę', [
    `Aktualna ZRE: ${result.target}.`,
    result.naturalSuccess ? 'Naturalne 1 zawsze oznacza sukces.' : result.naturalFailure ? 'Naturalne 20 zawsze oznacza porażkę.' : result.canAct ? 'Wynik jest równy lub niższy od ZRE.' : 'Wynik jest wyższy od ZRE.',
    result.canAct ? 'Zadeklaruj ruch i jedno działanie.' : 'Nie działasz w pierwszej rundzie. Od drugiej rundy działasz normalnie.',
    'Specjalne okoliczności mogą zanegować wymóg rzutu decyzją Wardena.'
  ], result.canAct ? 'success' : 'danger', { sides: 20, footer });
  announce(summary);
  return result;
}

function performUnarmedAttack(forcedRoll = null) {
  const forced = normalizeForcedDie(forcedRoll, 4);
  let roll;
  try { roll = forced ?? rollDie(4); }
  catch (error) { showToast(error.message, 'error'); return null; }
  const summary = `Atak bez broni: ${roll} (k4)`;
  addDiceHistory({ type: 'damage', label: 'Atak bez broni', summary, notation: 'k4', result: roll, details: 'Atak trafia automatycznie; pancerz celu odejmuje Warden.' });
  openResultSheet('Atak bez broni', roll, 'Obrażenia k4', [
    'Ataki w walce trafiają automatycznie.',
    'Warden odejmuje pancerz celu i rozpatruje pozostałe obrażenia.'
  ], 'success', { sides: 4 });
  announce(summary);
  return roll;
}



// ============================================================
// 8. Cairn rules
// ============================================================
function calculateDamage(sourceState, rawDamage, armorValue) {
  const raw = Math.max(0, toInt(rawDamage, 0));
  const armor = clamp(toInt(armorValue, 0), 0, 3);
  const afterArmor = Math.max(0, raw - armor);
  const hpBefore = Math.max(0, toInt(sourceState.stats.hp.current, 0));
  const strBefore = Math.max(0, toInt(sourceState.stats.str.current, 0));
  const hpAfter = Math.max(0, hpBefore - afterArmor);
  const overflow = Math.max(0, afterArmor - hpBefore);
  const strAfter = Math.max(0, strBefore - overflow);
  const hpLost = hpBefore - hpAfter;
  return {
    rawDamage: raw,
    armor,
    damageAfterArmor: afterArmor,
    hpBefore,
    hpAfter,
    hpLost,
    overflow,
    strBefore,
    strAfter,
    scarRequired: hpBefore > 0 && afterArmor === hpBefore,
    strengthSaveRequired: overflow > 0 && strAfter > 0,
    strengthSaveTarget: strAfter,
    strengthZero: strAfter === 0 && overflow > 0,
    noEffect: afterArmor === 0
  };
}

function calculateDirectAttributeDamage(sourceState, attrKey, amount) {
  const before = Math.max(0, toInt(sourceState.stats[attrKey]?.current, 0));
  const damage = Math.max(0, toInt(amount, 0));
  const after = Math.max(0, before - damage);
  return { attrKey, damage, before, after, reachedZero: before > 0 && after === 0 };
}

function calculateInventoryUsage(items = state.inventory.items, fatigue = state.inventory.fatigue) {
  const itemSlots = safeArray(items).reduce((sum, item) => sum + clamp(toInt(item.slots, 1), 0, 10), 0);
  const fatigueSlots = safeArray(fatigue).length;
  return { itemSlots, fatigueSlots, total: itemSlots + fatigueSlots, limit: 10 };
}

function activeEquipmentItems(sourceState = state) {
  return safeArray(sourceState?.inventory?.items).filter(item => ['held', 'worn'].includes(item.carryState));
}

function weaponItems(sourceState = state) {
  return safeArray(sourceState?.inventory?.items).filter(item => item.damageFormula && item.carryState !== 'spent');
}

function heldWeaponItems(sourceState = state) {
  return weaponItems(sourceState).filter(item => item.carryState === 'held');
}

function weaponCountLabel(count) {
  if (count === 1) return 'broń';
  if (count >= 2 && count <= 4) return 'bronie';
  return 'broni';
}

function availableWeaponItems(sourceState = state) {
  return weaponItems(sourceState).filter(item => ['held', 'worn'].includes(item.carryState));
}

function planItemUse(sourceState, itemId) {
  const item = safeArray(sourceState?.inventory?.items).find(entry => entry.id === itemId);
  if (!item || item.uses?.current === null) return { valid: false, reason: 'Ten przedmiot nie ma śledzonej liczby użyć.' };
  const before = Math.max(0, toInt(item.uses.current, 0));
  if (before <= 0) return { valid: false, reason: 'Brak pozostałych użyć.', item, before, after: 0 };
  return { valid: true, item, before, after: before - 1 };
}

function applyItemUseMutation(target, itemId) {
  const plan = planItemUse(target, itemId);
  if (!plan.valid) return false;
  const item = target.inventory.items.find(entry => entry.id === itemId);
  item.uses.current = plan.after;
  return true;
}

function rollBlastTargets(formula, targetCount, roller = rollDie) {
  const normalized = normalizeDamageFormula(formula);
  const count = clamp(toInt(targetCount, 0), 0, 20);
  if (!normalized) throw new Error('Nieprawidłowa formuła obrażeń podmuchu.');
  if (count < 1) throw new Error('Podaj co najmniej jeden cel.');
  return Array.from({ length: count }, (_, index) => ({ target: index + 1, ...rollDamageFormula(normalized, roller) }));
}

function getScarGuide(hpLost) {
  const value = toInt(hpLost, 0);
  return SCAR_GUIDE[value] ? { hpLost: value, ...SCAR_GUIDE[value] } : null;
}

function resolveScarHelperRoll(type, roll) {
  const value = normalizeForcedDie(roll, 6);
  if (!value) return null;
  if (type === 'scar-location') return ['Kark', 'Ręce', 'Oko', 'Klatka piersiowa', 'Nogi', 'Ucho'][value - 1];
  if (type === 'broken-bone') return value <= 2 ? 'Noga' : value <= 4 ? 'Ramię' : value === 5 ? 'Żebro' : 'Czaszka';
  if (type === 'head-wound') return value <= 2 ? 'SIŁ' : value <= 4 ? 'ZRE' : 'WOL';
  return null;
}

function droppableInventoryItems(sourceState = state) {
  return safeArray(sourceState?.inventory?.items).filter(item => clamp(toInt(item.slots, 0), 0, 10) >= 1);
}

function planFatigueWithDroppedItem(sourceState, itemId, fatigue = makeFatigue()) {
  const beforeUsage = calculateInventoryUsage(sourceState?.inventory?.items, sourceState?.inventory?.fatigue);
  const droppedItem = safeArray(sourceState?.inventory?.items).find(item => item.id === itemId);
  if (!droppedItem || toInt(droppedItem.slots, 0) < 1) {
    return { valid: false, reason: 'Wybierz przedmiot zajmujący co najmniej jedno miejsce.', beforeUsage };
  }
  const next = deepClone(sourceState);
  next.inventory.items = next.inventory.items.filter(item => item.id !== itemId);
  next.inventory.fatigue.push(makeFatigue(fatigue));
  const afterUsage = calculateInventoryUsage(next.inventory.items, next.inventory.fatigue);
  if (afterUsage.total > next.inventory.slotLimit) {
    return { valid: false, reason: `Operacja zajęłaby ${afterUsage.total}/${next.inventory.slotLimit} miejsc.`, beforeUsage, afterUsage, droppedItem };
  }
  const hpBefore = Math.max(0, toInt(sourceState?.stats?.hp?.current, 0));
  const hpAfter = afterUsage.total === next.inventory.slotLimit ? 0 : hpBefore;
  next.stats.hp.current = hpAfter;
  return { valid: true, next, beforeUsage, afterUsage, droppedItem, fatigue, hpBefore, hpAfter };
}

function applyFatigueDropMutation(target, itemId, fatigue) {
  const plan = planFatigueWithDroppedItem(target, itemId, fatigue);
  if (!plan.valid) return false;
  target.inventory = plan.next.inventory;
  target.stats.hp.current = plan.hpAfter;
  return true;
}

function deriveArmor(sourceState = state) {
  const armor = sourceState.stats.armor || { mode: 'equipment', manual: 0 };
  const sources = safeArray(sourceState.inventory.items)
    .filter(item => ['held', 'worn'].includes(item.carryState) && toInt(item.armorValue, 0) > 0)
    .map(item => ({ name: item.name, value: clamp(toInt(item.armorValue, 0), 0, 3), carryState: item.carryState }));
  const equipmentTotal = sources.reduce((sum, source) => sum + source.value, 0);
  const effective = armor.mode === 'manual' ? clamp(toInt(armor.manual, 0), 0, 3) : clamp(equipmentTotal, 0, 3);
  return { effective, mode: armor.mode, manual: toInt(armor.manual, 0), equipmentTotal, sources, capped: equipmentTotal > 3 };
}

function applyInventoryMutation(description, mutator, options = {}) {
  const beforeUsage = calculateInventoryUsage();
  const proposed = deepClone(state);
  mutator(proposed);
  const afterUsage = calculateInventoryUsage(proposed.inventory.items, proposed.inventory.fatigue);
  if (afterUsage.total > proposed.inventory.slotLimit) {
    showToast(`Brak miejsca: operacja zajęłaby ${afterUsage.total}/10 miejsc.`, 'error');
    announce('Operacja zablokowana: przekroczono limit ekwipunku.');
    return;
  }
  const crossesFull = beforeUsage.total < 10 && afterUsage.total === 10;
  const apply = (setHpZero) => commitChange(description, next => {
    mutator(next);
    if (setHpZero) next.stats.hp.current = 0;
  });
  if (crossesFull && state.stats.hp.current > 0) {
    openConfirmSheet({
      title: 'Pełny ekwipunek',
      message: 'Ta operacja zapełni wszystkie 10 miejsc. Zgodnie z zasadami postać zostaje sprowadzona do 0 Ochrony.',
      confirmLabel: 'Zatwierdź i ustaw 0 Ochrony',
      danger: true,
      onConfirm: () => apply(true)
    });
    return;
  }
  apply(false);
}

// ============================================================
// 9. Kettlewright adapter
// ============================================================
const KW_TOP_KNOWN = new Set(['armor','background','bonds','containers','custom_background','custom_image','custom_name','deprived','description','dexterity','dexterity_max','gold','hp','hp_max','id','image_url','items','name','notes','omens','panicked','scars','strength','strength_max','traits','willpower','willpower_max']);
const KW_ITEM_KNOWN = new Set(['id','location','name','description','tags','uses','editable']);

function looksLikeKettlewright(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Array.isArray(value.items)
    && ('strength' in value || 'dexterity' in value || 'willpower' in value)
    && ('hp' in value || 'hp_max' in value);
}

function parseArmorTag(tags) {
  for (const tag of tags) {
    const match = String(tag).match(/^\s*([123])\s*armor\s*$/i);
    if (match) return toInt(match[1], 0);
  }
  return 0;
}

function parseDamageFormulaTags(tags) {
  const blast = safeArray(tags).some(tag => String(tag).toLowerCase() === 'blast');
  for (const tag of safeArray(tags)) {
    const formula = parseDamageFormulaNotation(String(tag), blast);
    if (formula) return formula;
  }
  return null;
}

function normalizeKettlewright(source) {
  const report = { imported: [], unrecognized: [], manual: [], warnings: [], errors: [] };
  if (!looksLikeKettlewright(source)) {
    report.errors.push('Plik nie przypomina obsługiwanego eksportu Kettlewright.');
    return { candidate: null, report };
  }
  const result = createDefaultState();
  result.initialized = true;
  result.source = {
    type: 'kettlewright',
    importedAt: nowIso(),
    adapterVersion: 2,
    sourceId: source.id ?? null,
    original: deepClone(source),
    containerMetadata: safeArray(source.containers).map(container => deepClone(container)),
    unmappedPaths: [],
    warnings: []
  };
  const chosenName = trimText(source.custom_name) || trimText(source.name) || 'Bez imienia';
  const chosenBackground = trimText(source.custom_background) || trimText(source.background);
  result.identity = {
    name: chosenName,
    background: chosenBackground,
    backgroundDescription: trimText(source.description),
    portrait: { type: 'initial', value: initials(chosenName) },
    traits: trimText(source.traits),
    bonds: trimText(source.bonds),
    omens: trimText(source.omens)
  };
  result.stats.hp = { current: Math.max(0, toInt(source.hp, 0)), max: Math.max(0, toInt(source.hp_max, toInt(source.hp, 0))) };
  result.stats.str = { current: Math.max(0, toInt(source.strength, 0)), max: Math.max(0, toInt(source.strength_max, toInt(source.strength, 0))) };
  result.stats.dex = { current: Math.max(0, toInt(source.dexterity, 0)), max: Math.max(0, toInt(source.dexterity_max, toInt(source.dexterity, 0))) };
  result.stats.wil = { current: Math.max(0, toInt(source.willpower, 0)), max: Math.max(0, toInt(source.willpower_max, toInt(source.willpower, 0))) };
  const importedArmor = clamp(toInt(source.armor, 0), 0, 3);
  result.stats.armor = { mode: 'manual', manual: importedArmor, importedValue: importedArmor };
  result.stats.gold = Math.max(0, toInt(source.gold, 0));
  result.conditions.deprived = source.deprived === true;
  result.conditions.panicked = source.panicked === true;
  result.scars = trimText(source.scars) ? [{ id: makeId(), text: trimText(source.scars), addedAt: nowIso() }] : [];
  result.notes = trimText(source.notes);
  report.imported.push('imię, tło, opis, cechy, więzi, omeny i notatki');
  report.imported.push('aktualną i maksymalną Ochronę, SIŁ, ZRE i WOL');
  report.imported.push('pancerz, złoto oraz stany pozbawienia i paniki');

  for (const [key] of Object.entries(source)) {
    if (!KW_TOP_KNOWN.has(key)) report.unrecognized.push(key);
  }

  for (const [index, rawItem] of safeArray(source.items).entries()) {
    if (!rawItem || typeof rawItem !== 'object') {
      report.warnings.push(`Pominięto nieprawidłowy przedmiot #${index + 1}.`);
      continue;
    }
    const itemName = trimText(rawItem.name, `Przedmiot ${index + 1}`);
    if (itemName.toLowerCase() === 'fatigue') {
      result.inventory.fatigue.push(makeFatigue({ id: rawItem.id || makeId(), source: 'kettlewright', note: '' }));
      report.imported.push(`zmęczenie: ${itemName}`);
      continue;
    }
    const tags = safeArray(rawItem.tags).map(String);
    const lowerTags = tags.map(tag => tag.toLowerCase());
    const slots = lowerTags.includes('petty') ? 0 : lowerTags.includes('bulky') ? 2 : 1;
    const usesCurrent = rawItem.uses === undefined ? null : Math.max(0, toInt(rawItem.uses, 0));
    const extras = {};
    for (const [key, value] of Object.entries(rawItem)) {
      if (!KW_ITEM_KNOWN.has(key) && !tags.includes(key)) extras[key] = deepClone(value);
      if (!KW_ITEM_KNOWN.has(key)) result.source.unmappedPaths.push(`items[${index}].${key || '(pusty klucz)'}`);
    }
    const traits = [];
    if (lowerTags.includes('petty')) traits.push('drobiazg');
    if (lowerTags.includes('bulky')) traits.push('nieporęczny');
    if (lowerTags.includes('blast')) traits.push('blast');
    for (const tag of tags) {
      if (!isDamageFormulaTag(tag) && !/^[123]\s*armor$/i.test(tag) && !['petty','bulky','uses','blast'].includes(tag.toLowerCase())) traits.push(tag);
    }
    result.inventory.items.push(makeItem({
      sourceId: rawItem.id ?? null,
      name: itemName,
      description: typeof rawItem.description === 'string' && rawItem.description !== '-' ? rawItem.description : '',
      slots,
      damageFormula: parseDamageFormulaTags(tags),
      armorValue: parseArmorTag(tags),
      uses: usesCurrent === null ? { current: null, max: null } : { current: usesCurrent, max: null },
      carryState: 'stored',
      traits,
      sourceExtras: extras
    }));
    if (usesCurrent !== null) report.manual.push(`Maksymalna liczba użyć „${itemName}” jest nieznana; zaimportowano tylko wartość aktualną (${usesCurrent}).`);
    if (parseArmorTag(tags) > 0) report.manual.push(`Ustaw, czy pancerz „${itemName}” jest noszony lub trzymany.`);
  }

  const usage = calculateInventoryUsage(result.inventory.items, result.inventory.fatigue);
  report.imported.push(`${result.inventory.items.length} przedmiotów i ${result.inventory.fatigue.length} zmęczenia (${usage.total}/10 miejsc)`);
  if (usage.total > 10) report.errors.push(`Importowany ekwipunek zajmuje ${usage.total}/10 miejsc.`);
  if (usage.total === 10 && result.stats.hp.current > 0) report.warnings.push('Pełne 10 miejsc, ale Ochrona jest wyższa od 0. Import zachowa wartość źródłową i pokaże akcję zastosowania reguły.');
  if (result.conditions.panicked && result.stats.hp.current > 0) report.warnings.push('Postać jest spanikowana, ale ma Ochronę wyższą niż 0. Import zachowa wartość źródłową i pokaże ostrzeżenie.');
  if (trimText(source.image_url)) report.manual.push(`Portret „${source.image_url}” jest ścieżką Kettlewright i nie zostanie osadzony w pojedynczym pliku HTML.`);
  if (result.source.unmappedPaths.length) report.unrecognized.push(...result.source.unmappedPaths);
  report.manual.push('Stan noszenia/trzymania pozostałych przedmiotów wymaga ręcznego ustawienia.');
  result.source.unmappedPaths = Array.from(new Set(result.source.unmappedPaths));
  result.source.warnings = [...report.warnings];
  const validation = validateState(result);
  report.errors.push(...validation.errors);
  report.warnings.push(...validation.warnings.filter(w => !/Pełny ekwipunek|spanikowana/i.test(w) && !report.warnings.includes(w)));
  report.errors = Array.from(new Set(report.errors));
  report.warnings = Array.from(new Set(report.warnings));
  report.manual = Array.from(new Set(report.manual));
  report.unrecognized = Array.from(new Set(report.unrecognized));
  result.source.warnings = [...report.warnings];
  return { candidate: result, report };
}

// ============================================================
// 10. Import and export
// ============================================================
let pendingImport = null;



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
function parseImportText(text) {
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
}

async function handleImportFile(file, expectedType = 'any') {
  if (!file) return;
  if (file.size > 5_000_000) {
    showToast('Plik jest zbyt duży. Limit wynosi 5 MB.', 'error');
    return;
  }
  let text;
  try { text = await file.text(); }
  catch (error) { showToast(`Nie udało się odczytać pliku: ${error.message}`, 'error'); return; }
  const result = parseImportText(text);
  if (expectedType === 'backup' && result.type !== 'backup') result.report.errors.push('Wybrany plik nie jest kopią tej aplikacji.');
  pendingImport = { ...result, filename: file.name };
  openImportReport(pendingImport);
}

function applyPendingImport() {
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

function exportBackup() {
  saveNow();
  const payload = buildBackupPayload(state);
  const name = trimText(state.identity.name, 'postać').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'postac';
  downloadTextFile(`cairn-${name}-kopia-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2));
  markBackupCreated();
  renderAll();
  showToast('Pobrano pełną kopię zapasową JSON.');
  announce('Pobrano pełną kopię zapasową postaci.');
}

// ============================================================
// 11. Sheet controller
// ============================================================
let lastFocusedElement = null;
let lastInvokingControl = null;
let closeHandler = null;

document.addEventListener('pointerdown', event => {
  const control = event.target instanceof Element ? event.target.closest('button, a, input, select, textarea, summary') : null;
  if (control) lastInvokingControl = control;
}, true);

function openSheet({ title, body, footer = null, onClose = null }) {
  const activeElement = document.activeElement;
  const activeControl = activeElement instanceof Element && activeElement.matches('button, a, input, select, textarea, summary')
    ? activeElement
    : null;
  lastFocusedElement = activeControl || lastInvokingControl || activeElement;
  closeHandler = onClose;
  $('#sheetTitle').textContent = title;
  $('#sheetBody').replaceChildren(body instanceof Node ? body : createEl('p', { text: body }));
  $('#sheetFoot').replaceChildren(...(footer ? (Array.isArray(footer) ? footer : [footer]) : []));
  const backdrop = $('#sheetBackdrop');
  const appShell = $('.app-shell');
  if (appShell) {
    appShell.inert = true;
    if (!('inert' in HTMLElement.prototype)) appShell.setAttribute('aria-hidden', 'true');
  }
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  document.body.classList.add('sheet-open');
  document.body.style.overflow = 'hidden';
  syncVisualViewport();
  requestAnimationFrame(() => {
    $('#sheetTitle').focus({ preventScroll: true });
  });
}

function closeSheet() {
  const backdrop = $('#sheetBackdrop');
  if (!backdrop.classList.contains('open')) return;
  const focusTarget = lastFocusedElement;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  const appShell = $('.app-shell');
  if (appShell) {
    appShell.inert = false;
    appShell.removeAttribute('aria-hidden');
  }
  document.body.classList.remove('sheet-open');
  document.body.style.overflow = '';
  const handler = closeHandler;
  closeHandler = null;
  if (handler) handler();
  const restoreFocus = () => {
    if (focusTarget?.isConnected && focusTarget.focus) focusTarget.focus({ preventScroll: true });
  };
  restoreFocus();
  requestAnimationFrame(restoreFocus);
  setTimeout(restoreFocus, 0);
}

function getSheetFocusable() {
  return $$('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])', $('#sheet'));
}

function trapSheetFocus(event) {
  if (event.key === 'Escape') { event.preventDefault(); closeSheet(); return; }
  if (event.key !== 'Tab') return;
  const focusable = getSheetFocusable();
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const title = $('#sheetTitle');
  if (event.shiftKey && (document.activeElement === first || document.activeElement === title)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function openConfirmSheet({ title = 'Potwierdź', message, confirmLabel = 'Potwierdź', cancelLabel = 'Anuluj', danger = false, onConfirm }) {
  const body = createEl('div', { className: 'sheet-list' }, [createEl('p', { text: message })]);
  const confirmBtn = button(confirmLabel, () => { closeSheet(); onConfirm?.(); }, `btn ${danger ? 'btn-danger' : 'btn-primary'}`);
  const cancelBtn = button(cancelLabel, closeSheet, 'btn btn-ghost');
  openSheet({ title, body, footer: createEl('div', { className: 'button-row' }, [cancelBtn, confirmBtn]) });
}

function openResultSheet(title, value, status, details, tone = 'success', options = {}) {
  const body = createEl('div', { className: 'sheet-list' });
  const result = createEl('div', { className: 'dice-result', attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' } });
  body.append(result);
  for (const detail of details) body.append(createEl('p', { className: 'muted', text: detail }));
  openSheet({ title, body, footer: options.footer || button('Zamknij', closeSheet, 'btn btn-primary btn-block') });
  const numericValue = Number(value);
  if (options.animate !== false && Number.isFinite(numericValue)) {
    animateDiceResult(result, numericValue, status, options.sides || 6, tone);
    return;
  }
  result.replaceChildren(createEl('div', {}, [
    createEl('strong', { text: value }),
    createEl('span', { text: status, className: tone === 'danger' ? 'test-fail' : tone === 'success' ? 'test-pass' : '' })
  ]));
}

// ============================================================
// 12. Rendering helpers
// ============================================================
const VIEW_META = Object.freeze({
  character: { label: 'Postać' },
  inventory: { label: 'Ekwipunek' },
  dice: { label: 'Kości' },
  more: { label: 'Dziennik' }
});
let activeView = 'character';

function updateViewAccessibility(announceChange = false) {
  const meta = VIEW_META[activeView] || VIEW_META.character;
  const characterName = state.initialized ? trimText(state.identity.name, 'Karta Wędrowca') : 'Karta Wędrowca';
  document.title = `${characterName} — ${meta.label} — Cairn 2e`;
  const headerTitle = $('#headerTitle');
  if (headerTitle) headerTitle.textContent = meta.label;
  if (!announceChange) return;
  const live = $('#viewLiveRegion');
  if (!live) return;
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = `Widok: ${meta.label}`; });
}

function setView(view, { announceChange = false } = {}) {
  activeView = VIEW_META[view] ? view : 'character';
  document.documentElement.dataset.activeView = activeView;
  for (const section of $$('[data-view]')) section.hidden = section.dataset.view !== activeView;
  for (const nav of $$('[data-nav]')) {
    if (nav.dataset.nav === activeView) nav.setAttribute('aria-current', 'page');
    else nav.removeAttribute('aria-current');
  }
  if (activeView === 'character') renderCharacterView();
  if (activeView === 'inventory') renderInventoryView();
  if (activeView === 'dice') renderDiceView();
  if (activeView === 'more') renderMoreView();
  updateViewAccessibility(announceChange);
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function renderAll() {
  document.documentElement.dataset.theme = state.settings.theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.reduceMotion = state.settings.reducedMotionOverride === true ? 'true' : 'false';
  document.documentElement.dataset.activeView = activeView;
  $('#headerTitle').textContent = (VIEW_META[activeView] || VIEW_META.character).label;
  $('#quickUndoBtn').disabled = !safeArray(state.changeHistory).some(entry => entry.undoable);
  renderCharacterView();
  renderInventoryView();
  renderDiceView();
  renderMoreView();
  updateViewAccessibility(false);
}

function card(children, className = '') { return createEl('section', { className: `card ${className}`.trim() }, children); }
function sectionHead(title, action = null, kicker = '') {
  const left = createEl('div');
  if (kicker) left.append(createEl('p', { className: 'eyebrow', text: kicker }));
  left.append(createEl('h2', { text: title }));
  return createEl('div', { className: 'section-head' }, action ? [left, action] : [left]);
}
function uiIcon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  if (name === 'more') svg.classList.add('icon-solid');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const paths = {
    damage: [['path', { d: 'M12 3s5 5.2 5 9a5 5 0 0 1-10 0c0-3.8 5-9 5-9z' }], ['path', { d: 'M9.5 13.5c.7 1.2 1.5 1.8 2.5 1.8' }]],
    round: [['circle', { cx: '12', cy: '12', r: '8' }], ['path', { d: 'M12 7v5l3 2' }]],
    rest: [['path', { d: 'M4 14h16v4H4z' }], ['path', { d: 'M6 14V8h5a3 3 0 0 1 3 3v3' }], ['path', { d: 'M5 20v-2M19 20v-2' }]],
    dice: [['rect', { x: '4', y: '4', width: '16', height: '16', rx: '4' }], ['path', { d: 'M9 9h.01M15 15h.01M15 9h.01M9 15h.01' }]],
    box: [['path', { d: 'M5 7h14v12H5z' }], ['path', { d: 'M8 7V5h8v2M9 11h6' }]],
    plus: [['path', { d: 'M12 5v14M5 12h14' }]],
    fatigue: [['path', { d: 'M7 4h10M9 4v5l3 3 3-3V4M7 20h10M9 20v-5l3-3 3 3v5' }]],
    attribute: [['path', { d: 'M5 7h14M5 12h14M5 17h14' }], ['circle', { cx: '9', cy: '7', r: '1.5' }], ['circle', { cx: '15', cy: '12', r: '1.5' }], ['circle', { cx: '11', cy: '17', r: '1.5' }]],
    strength: [['path', { d: 'M4 17l4-8 4 8 4-12 4 12' }], ['path', { d: 'M3 20h18' }]],
    dexterity: [['path', { d: 'M5 17L17 5M11 5h6v6' }], ['path', { d: 'M5 8v9h9' }]],
    will: [['path', { d: 'M12 3c3 3.2 5 5.8 5 9a5 5 0 0 1-10 0c0-3.2 2-5.8 5-9z' }], ['path', { d: 'M10 14c.5 1 1.2 1.5 2 1.5' }]],
    armor: [['path', { d: 'M12 3l7 3v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6z' }]],
    roll: [['path', { d: 'M5 5l14 14M8 4h8l4 4v8l-4 4H8l-4-4V8z' }], ['path', { d: 'M9 9h.01M15 15h.01' }]],
    use: [['path', { d: 'M12 3v9' }], ['path', { d: 'M8 8l4 4 4-4' }], ['path', { d: 'M5 15v5h14v-5' }]],
    more: [['circle', { cx: '5', cy: '12', r: '1.25' }], ['circle', { cx: '12', cy: '12', r: '1.25' }], ['circle', { cx: '19', cy: '12', r: '1.25' }]],
    arrow: [['path', { d: 'M5 12h14M14 7l5 5-5 5' }]],
    unarmed: [['path', { d: 'M8 12V7a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-4a1.5 1.5 0 0 1 3 0v7c0 4-2.4 7-6.5 7H10c-2.5 0-4.4-1.4-5.5-3.5L3 14.5a1.6 1.6 0 0 1 2.8-1.6L8 16' }]],
    impaired: [['path', { d: 'M5 5l14 14M7 17l10-10' }], ['circle', { cx: '12', cy: '12', r: '8' }]],
    enhanced: [['path', { d: 'M12 3l2.2 5.1 5.5.5-4.2 3.7 1.3 5.4-4.8-2.8-4.8 2.8 1.3-5.4-4.2-3.7 5.5-.5z' }]],
    blast: [['circle', { cx: '12', cy: '12', r: '3' }], ['path', { d: 'M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3' }]],
    dual: [['path', { d: 'M6 4l12 16M18 4L6 20' }], ['path', { d: 'M5 5l3-1-1 3M19 5l-3-1 1 3' }]],
    group: [['circle', { cx: '8', cy: '9', r: '2.5' }], ['circle', { cx: '16', cy: '9', r: '2.5' }], ['path', { d: 'M3.5 19c.5-3.3 2-5 4.5-5s4 1.7 4.5 5M11.5 19c.5-3.3 2-5 4.5-5s4 1.7 4.5 5' }]],
    fate: [['path', { d: 'M12 3l7 4v10l-7 4-7-4V7z' }], ['path', { d: 'M9 9h.01M15 15h.01M15 9h.01M9 15h.01' }]],
    protection: [['path', { d: 'M3.5 12s3.2-5.2 8.5-5.2 8.5 5.2 8.5 5.2-3.2 5.2-8.5 5.2S3.5 12 3.5 12z' }], ['circle', { cx: '12', cy: '12', r: '2.4' }]],
    weapon: [['path', { d: 'M5 19L19 5M15 5h4v4M7 15l2 2M4 20l3-1-2-2z' }], ['path', { d: 'M5 5l14 14M5 9V5h4M15 17l2-2M20 20l-3-1 2-2z' }]],
    slots: [['path', { d: 'M7 7V5.5A2.5 2.5 0 0 1 9.5 3h5A2.5 2.5 0 0 1 17 5.5V7' }], ['path', { d: 'M5 7h14v13H5zM8 11h8M8 15h8' }]],
    conditions: [['path', { d: 'M12 3v3M5.6 5.6l2.1 2.1M3 12h3M5.6 18.4l2.1-2.1M12 21v-3M18.4 18.4l-2.1-2.1M21 12h-3M18.4 5.6l-2.1 2.1' }], ['circle', { cx: '12', cy: '12', r: '3' }]],
    action: [['path', { d: 'M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z' }], ['path', { d: 'M18.5 16l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z' }]]
  };
  for (const [tag, attrs] of paths[name] || paths.more) {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    svg.append(node);
  }
  return svg;
}

function stateLabel(label, icon) {
  return createEl('span', { className: 'state-label state-label-icon' }, [uiIcon(icon), createEl('span', { text: label })]);
}

function characterSectionTitle(id, label, icon) {
  return createEl('div', { className: 'section-title' }, [uiIcon(icon), createEl('h2', { id, text: label })]);
}

function iconButton(label, icon, onClick, className = 'btn btn-icon btn-ghost', attrs = {}) {
  return createEl('button', {
    type: 'button',
    className,
    attrs: { ...attrs, 'aria-label': attrs['aria-label'] || label, title: attrs.title || label },
    onclick: onClick
  }, [uiIcon(icon)]);
}

function compactActionButton(label, icon, onClick, primary = false) {
  return createEl('button', {
    type: 'button',
    className: `btn compact-action${primary ? ' btn-primary' : ''}`,
    onclick: onClick
  }, [uiIcon(icon), createEl('span', { text: label })]);
}

function dieIcon(sides) {
  const ns = 'http://www.w3.org/2000/svg';
  const value = Number(sides);
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('data-die', String(value));
  svg.classList.add('die-icon');
  const add = (tag, attrs) => {
    const node = document.createElementNS(ns, tag);
    for (const [key, entry] of Object.entries(attrs)) node.setAttribute(key, entry);
    svg.append(node);
  };
  if (value === 4) {
    add('polygon', { points: '12,2.5 21,20.5 3,20.5' });
    add('line', { x1: '12', y1: '2.5', x2: '12', y2: '20.5' });
    add('line', { x1: '3', y1: '20.5', x2: '12', y2: '13' });
    add('line', { x1: '21', y1: '20.5', x2: '12', y2: '13' });
  } else if (value === 6) {
    add('rect', { x: '3', y: '3', width: '18', height: '18', rx: '4' });
    add('circle', { cx: '8', cy: '8', r: '1' });
    add('circle', { cx: '16', cy: '16', r: '1' });
    add('circle', { cx: '16', cy: '8', r: '1' });
    add('circle', { cx: '8', cy: '16', r: '1' });
  } else if (value === 8) {
    add('polygon', { points: '12,2 21,12 12,22 3,12' });
    add('line', { x1: '3', y1: '12', x2: '21', y2: '12' });
    add('line', { x1: '12', y1: '2', x2: '8', y2: '12' });
    add('line', { x1: '12', y1: '2', x2: '16', y2: '12' });
    add('line', { x1: '12', y1: '22', x2: '8', y2: '12' });
    add('line', { x1: '12', y1: '22', x2: '16', y2: '12' });
  } else if (value === 10) {
    add('polygon', { points: '12,2 20.5,8.5 17,21 7,21 3.5,8.5' });
    add('line', { x1: '12', y1: '2', x2: '12', y2: '16' });
    add('line', { x1: '3.5', y1: '8.5', x2: '12', y2: '16' });
    add('line', { x1: '20.5', y1: '8.5', x2: '12', y2: '16' });
    add('line', { x1: '7', y1: '21', x2: '12', y2: '16' });
    add('line', { x1: '17', y1: '21', x2: '12', y2: '16' });
  } else if (value === 12) {
    add('polygon', { points: '12,2 18.5,5 22,11 20,18 14,22 7,20 2,15 3,8 7,3' });
    add('polygon', { points: '12,6.5 17,9 16,15 10.5,18 6.5,13.5 8,8' });
    add('line', { x1: '12', y1: '2', x2: '12', y2: '6.5' });
    add('line', { x1: '22', y1: '11', x2: '17', y2: '9' });
    add('line', { x1: '14', y1: '22', x2: '10.5', y2: '18' });
    add('line', { x1: '2', y1: '15', x2: '6.5', y2: '13.5' });
  } else if (value === 20) {
    add('polygon', { points: '12,2 21,8 18,20 6,20 3,8' });
    add('polygon', { points: '12,6 17.5,10 15.5,17 8.5,17 6.5,10' });
    add('line', { x1: '12', y1: '2', x2: '12', y2: '6' });
    add('line', { x1: '21', y1: '8', x2: '17.5', y2: '10' });
    add('line', { x1: '18', y1: '20', x2: '15.5', y2: '17' });
    add('line', { x1: '6', y1: '20', x2: '8.5', y2: '17' });
    add('line', { x1: '3', y1: '8', x2: '6.5', y2: '10' });
  } else {
    add('circle', { cx: '9', cy: '12', r: '7' });
    add('circle', { cx: '16', cy: '12', r: '7' });
    add('text', { x: '12', y: '12', textContent: '00' });
    svg.lastChild.textContent = '00';
  }
  return svg;
}

function combatScenarioDefinitions() {
  return [
    { id: 'unarmed', title: 'Bez broni', notation: 'k4', description: 'Gdy atakujesz bez broni.', icon: 'unarmed', run: () => performUnarmedAttack() },
    { id: 'impaired', title: 'Osłabiony', notation: 'k4', description: 'Gdy walczysz z niekorzystnej pozycji.', icon: 'impaired', run: () => performRoll({ count: 1, sides: 4 }, 'Atak osłabiony') },
    { id: 'enhanced', title: 'Wzmocniony', notation: 'k12', description: 'Gdy masz wyraźną przewagę.', icon: 'enhanced', run: () => performRoll({ count: 1, sides: 12 }, 'Atak wzmocniony') },
    { id: 'blast', title: 'Podmuch', notation: 'wiele celów', description: 'Osobny rzut dla każdego celu.', icon: 'blast', run: () => openBlastAttackSheet() },
    { id: 'dual', title: 'Dwie bronie', notation: 'wyższa kość', description: 'Rzuć obiema. Zachowaj wyższą.', icon: 'dual', run: openDualWeaponsSheet },
    { id: 'multiple', title: 'Wielu atakujących', notation: 'najwyższa', description: 'Rzuć wszystkie. Zachowaj najwyższą.', icon: 'group', run: openMultipleAttackersSheet }
  ];
}

function scenarioButton(definition) {
  return createEl('button', {
    type: 'button',
    className: 'btn scenario-button',
    attrs: { 'aria-label': `${definition.title}. ${definition.description} ${definition.notation}.` },
    onclick: definition.run
  }, [
    uiIcon(definition.icon),
    createEl('span', { className: 'scenario-copy' }, [
      createEl('strong', { text: definition.title }),
      createEl('small', {}, [definition.description, ' ', createEl('span', { className: 'scenario-notation', text: definition.notation })])
    ])
  ]);
}

const HAPTIC_PATTERNS = Object.freeze({
  tick: Object.freeze([6]),
  selection: Object.freeze([8]),
  roll: Object.freeze([8, 22, 14]),
  success: Object.freeze([10, 20, 18]),
  danger: Object.freeze([18, 28, 26]),
  impact: Object.freeze([20])
});

let diceAnimationToken = 0;

function shouldReduceMotion() {
  if (state?.settings?.reducedMotionOverride === true) return true;
  return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function hapticPatternFor(kind = 'selection') {
  return [...(HAPTIC_PATTERNS[kind] || HAPTIC_PATTERNS.selection)];
}

function supportsHapticFeedback() {
  return typeof globalThis.navigator?.vibrate === 'function';
}

function triggerHaptic(kind = 'selection') {
  if (state?.settings?.hapticsEnabled === false || !supportsHapticFeedback()) return false;
  try {
    return Boolean(globalThis.navigator.vibrate(hapticPatternFor(kind)));
  } catch {
    return false;
  }
}

function resultHapticForTone(tone) {
  if (tone === 'danger') return 'danger';
  if (tone === 'success') return 'success';
  return 'roll';
}

function diceEntrySides(entry) {
  const repeat = normalizeDiceRepeatSpec(entry?.repeat);
  if (repeat?.kind === 'roll') return repeat.config.sides;
  if (repeat?.kind === 'save') return 20;
  const notation = trimText(entry?.notation);
  const match = notation.match(/[kd](100|20|12|10|8|6|4)(?!\d)/i);
  return match ? Number(match[1]) : 20;
}

const DIE_ROLL_DURATION = 1250;
const DIE_HAPTIC_TICKS = Object.freeze([0.07, 0.14, 0.22, 0.31, 0.41, 0.52, 0.64, 0.77, 0.89]);
const DIE_MESH_CACHE = new Map();

function vectorCross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function vectorDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vectorNormalize(value) {
  const length = Math.hypot(...value) || 1;
  return value.map(entry => entry / length);
}

function normalizeDieVertices(vertices) {
  const radius = Math.max(...vertices.map(vertex => Math.hypot(...vertex))) || 1;
  return vertices.map(vertex => vertex.map(entry => entry / radius));
}

function orientFacesOutward(vertices, faces) {
  return faces.map(face => {
    const [a, b, c] = face.map(index => vertices[index]);
    const normal = vectorCross(b.map((entry, index) => entry - a[index]), c.map((entry, index) => entry - a[index]));
    const center = face.reduce((sum, index) => sum.map((entry, axis) => entry + vertices[index][axis]), [0, 0, 0]).map(entry => entry / face.length);
    return vectorDot(normal, center) < 0 ? [...face].reverse() : [...face];
  });
}

function convexHullFaces(vertices) {
  const planes = new Map();
  const epsilon = 1e-5;
  for (let a = 0; a < vertices.length - 2; a += 1) {
    for (let b = a + 1; b < vertices.length - 1; b += 1) {
      for (let c = b + 1; c < vertices.length; c += 1) {
        const ab = vertices[b].map((entry, axis) => entry - vertices[a][axis]);
        const ac = vertices[c].map((entry, axis) => entry - vertices[a][axis]);
        const rawNormal = vectorCross(ab, ac);
        if (Math.hypot(...rawNormal) < epsilon) continue;
        let normal = vectorNormalize(rawNormal);
        let distance = vectorDot(normal, vertices[a]);
        const offsets = vertices.map(vertex => vectorDot(normal, vertex) - distance);
        if (!(offsets.every(offset => offset <= epsilon) || offsets.every(offset => offset >= -epsilon))) continue;
        if (distance < 0) {
          normal = normal.map(entry => -entry);
          distance *= -1;
        }
        const key = [...normal, distance].map(entry => entry.toFixed(4)).join(':');
        if (planes.has(key)) continue;
        const face = vertices.map((vertex, index) => Math.abs(vectorDot(normal, vertex) - distance) <= epsilon * 4 ? index : -1).filter(index => index >= 0);
        if (face.length < 3) continue;
        const center = face.reduce((sum, index) => sum.map((entry, axis) => entry + vertices[index][axis]), [0, 0, 0]).map(entry => entry / face.length);
        const reference = vectorNormalize(Math.abs(normal[0]) < 0.8 ? vectorCross(normal, [1, 0, 0]) : vectorCross(normal, [0, 1, 0]));
        const tangent = vectorCross(normal, reference);
        face.sort((left, right) => {
          const l = vertices[left].map((entry, axis) => entry - center[axis]);
          const r = vertices[right].map((entry, axis) => entry - center[axis]);
          return Math.atan2(vectorDot(l, tangent), vectorDot(l, reference)) - Math.atan2(vectorDot(r, tangent), vectorDot(r, reference));
        });
        planes.set(key, face);
      }
    }
  }
  return orientFacesOutward(vertices, [...planes.values()]);
}

function createDieMesh(sides) {
  const numericSides = DICE_SIDES.includes(Number(sides)) ? Number(sides) : 20;
  if (DIE_MESH_CACHE.has(numericSides)) return DIE_MESH_CACHE.get(numericSides);
  let vertices;
  let faces;
  if (numericSides === 4) {
    vertices = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]];
    faces = [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]];
  } else if (numericSides === 6) {
    vertices = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
    faces = [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
  } else if (numericSides === 8) {
    vertices = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    faces = [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]];
  } else if (numericSides === 10 || numericSides === 100) {
    vertices = [[0, 0, 1.2], [0, 0, -1.2]];
    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI * 2 - Math.PI / 2;
      vertices.push([Math.cos(angle), Math.sin(angle), 0]);
    }
    faces = [];
    for (let index = 0; index < 5; index += 1) {
      const current = index + 2;
      const next = ((index + 1) % 5) + 2;
      faces.push([0, current, next], [1, next, current]);
    }
  } else {
    const phi = (1 + Math.sqrt(5)) / 2;
    vertices = numericSides === 12
      ? [[1,1,1],[1,1,-1],[1,-1,1],[1,-1,-1],[-1,1,1],[-1,1,-1],[-1,-1,1],[-1,-1,-1],[0,1/phi,phi],[0,1/phi,-phi],[0,-1/phi,phi],[0,-1/phi,-phi],[1/phi,phi,0],[1/phi,-phi,0],[-1/phi,phi,0],[-1/phi,-phi,0],[phi,0,1/phi],[phi,0,-1/phi],[-phi,0,1/phi],[-phi,0,-1/phi]]
      : [[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]];
    faces = convexHullFaces(vertices);
  }
  const normalized = normalizeDieVertices(vertices);
  const mesh = { vertices: normalized, faces: orientFacesOutward(normalized, faces), sides: numericSides };
  DIE_MESH_CACHE.set(numericSides, mesh);
  return mesh;
}

function rotateDiePoint(point, rotation) {
  const [sinX, cosX] = [Math.sin(rotation.x), Math.cos(rotation.x)];
  const [sinY, cosY] = [Math.sin(rotation.y), Math.cos(rotation.y)];
  const [sinZ, cosZ] = [Math.sin(rotation.z), Math.cos(rotation.z)];
  const afterX = [point[0], point[1] * cosX - point[2] * sinX, point[1] * sinX + point[2] * cosX];
  const afterY = [afterX[0] * cosY + afterX[2] * sinY, afterX[1], -afterX[0] * sinY + afterX[2] * cosY];
  return [afterY[0] * cosZ - afterY[1] * sinZ, afterY[0] * sinZ + afterY[1] * cosZ, afterY[2]];
}

function finalDieRotation(sides, value) {
  return { x: 0.5 + (Number(value) % 4) * 0.17, y: 0.65 + (Number(value) % 7) * 0.11, z: -0.12 + (Number(sides) % 5) * 0.045 };
}

function paintResultDie(canvas, sides, rotation, lift = 0) {
  const context = canvas?.getContext?.('2d');
  if (!context) return false;
  const bounds = canvas.getBoundingClientRect();
  const cssSize = Math.max(104, Math.round(Math.min(bounds.width || 132, bounds.height || 132)));
  const pixelRatio = Math.min(2, globalThis.devicePixelRatio || 1);
  const targetSize = Math.round(cssSize * pixelRatio);
  if (canvas.width !== targetSize || canvas.height !== targetSize) {
    canvas.width = targetSize;
    canvas.height = targetSize;
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssSize, cssSize);
  const mesh = createDieMesh(sides);
  const transformed = mesh.vertices.map(vertex => rotateDiePoint(vertex, rotation));
  const center = cssSize / 2;
  const radius = cssSize * (mesh.sides === 4 ? 0.42 : 0.39);
  const project = point => {
    const perspective = 3.8 / (3.8 - point[2]);
    return [center + point[0] * radius * perspective, center + lift + point[1] * radius * perspective];
  };
  const light = vectorNormalize([-0.35, -0.55, 0.9]);
  const isLight = document.documentElement.dataset.theme === 'light';
  const visibleFaces = mesh.faces.map(face => {
    const [a, b, c] = face.map(index => transformed[index]);
    const normal = vectorNormalize(vectorCross(b.map((entry, axis) => entry - a[axis]), c.map((entry, axis) => entry - a[axis])));
    return { face, normal, depth: face.reduce((sum, index) => sum + transformed[index][2], 0) / face.length };
  }).filter(entry => entry.normal[2] > -0.03).sort((left, right) => left.depth - right.depth);
  for (const entry of visibleFaces) {
    const brightness = clamp(0.2 + Math.max(0, vectorDot(entry.normal, light)) * 0.8, 0.2, 1);
    const points = entry.face.map(index => project(transformed[index]));
    context.beginPath();
    points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
    context.closePath();
    const lightness = isLight ? 34 + brightness * 34 : 13 + brightness * 29;
    context.fillStyle = `hsl(38 34% ${lightness}%)`;
    context.fill();
    context.lineWidth = 1.15;
    context.strokeStyle = isLight ? 'rgba(70, 48, 20, .72)' : 'rgba(226, 197, 139, .76)';
    context.stroke();
  }
  return true;
}

function createResultDie(value, sides, rolling = false) {
  const numericSides = DICE_SIDES.includes(Number(sides)) ? Number(sides) : 20;
  const canvases = numericSides === 100
    ? [
        createEl('canvas', { className: 'result-die-canvas percentile-die percentile-die-first', attrs: { 'aria-hidden': 'true' } }),
        createEl('canvas', { className: 'result-die-canvas percentile-die percentile-die-second', attrs: { 'aria-hidden': 'true' } })
      ]
    : [createEl('canvas', { className: 'result-die-canvas', attrs: { 'aria-hidden': 'true' } })];
  const object = createEl('div', {
    className: `result-die-object${rolling ? ' is-tumbling' : ''}`,
    attrs: { 'data-sides': String(numericSides), 'data-value': String(value) }
  }, [
    ...canvases,
    createEl('span', { className: 'result-die-notation', text: `k${numericSides}` }),
    createEl('strong', { className: 'result-die-value', text: rolling ? '' : String(value) })
  ]);
  const scene = createEl('div', { className: 'result-die-scene' }, [
    object,
    createEl('span', { className: 'result-die-shadow', attrs: { 'aria-hidden': 'true' } })
  ]);
  requestAnimationFrame(() => canvases.forEach((canvas, index) => paintResultDie(
    canvas,
    numericSides === 100 ? 10 : numericSides,
    { ...finalDieRotation(numericSides, value), y: finalDieRotation(numericSides, value).y + index * 0.72 },
    index ? 2 : -2
  )));
  return scene;
}

function createDiceResultVisual(value, label, sides = 6, tone = 'neutral', rolling = false) {
  const copy = createEl('span', {
    text: rolling ? 'Kość w ruchu…' : label,
    className: `result-die-copy${tone === 'danger' ? ' test-fail' : tone === 'success' ? ' test-pass' : ''}`
  });
  return createEl('div', {
    className: `animated-dice-result ${rolling ? 'rolling' : 'settled'}`,
    attrs: { 'data-tone': tone }
  }, [createResultDie(value, sides, rolling), copy]);
}

function animateElementFeedback(target, className = 'feedback-pop') {
  if (shouldReduceMotion()) return;
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  element.addEventListener('animationend', () => element.classList.remove(className), { once: true });
}

function animateDiceResult(container, value, label, sides = 6, tone = 'neutral') {
  if (!container) return;
  const token = ++diceAnimationToken;
  const numericSides = DICE_SIDES.includes(Number(sides)) ? Number(sides) : 6;
  const reduced = shouldReduceMotion();
  const shell = createDiceResultVisual(value, label, numericSides, tone, !reduced);
  const number = shell.querySelector('.result-die-value');
  const copy = shell.querySelector('.result-die-copy');
  const object = shell.querySelector('.result-die-object');
  const canvases = [...shell.querySelectorAll('.result-die-canvas')];
  const shadow = shell.querySelector('.result-die-shadow');
  if (!reduced) shell.setAttribute('aria-hidden', 'true');
  container.replaceChildren(shell);
  if (reduced) {
    triggerHaptic(resultHapticForTone(tone));
    return;
  }
  const started = performance.now();
  const finalRotation = finalDieRotation(numericSides, value);
  let nextHapticTick = 0;
  const paintCanvases = (rotation, lift = 0) => canvases.forEach((canvas, index) => paintResultDie(
    canvas,
    numericSides === 100 ? 10 : numericSides,
    { ...rotation, x: rotation.x + index * 0.44, y: rotation.y + index * 0.72 },
    lift + (index ? 2 : -2)
  ));
  const tick = now => {
    if (token !== diceAnimationToken || !shell.isConnected) return;
    const progress = Math.min(1, (now - started) / DIE_ROLL_DURATION);
    const eased = 1 - Math.pow(1 - progress, 3);
    const remaining = 1 - eased;
    const rotation = {
      x: finalRotation.x + remaining * Math.PI * 7,
      y: finalRotation.y + remaining * Math.PI * 11,
      z: finalRotation.z + remaining * Math.PI * 4
    };
    const lift = -Math.sin(progress * Math.PI) * 8;
    paintCanvases(rotation, lift);
    if (shadow) {
      shadow.style.opacity = String(0.42 + eased * 0.5);
      shadow.style.transform = `scaleX(${0.56 + eased * 0.28})`;
    }
    while (nextHapticTick < DIE_HAPTIC_TICKS.length && progress >= DIE_HAPTIC_TICKS[nextHapticTick]) {
      triggerHaptic('tick');
      nextHapticTick += 1;
    }
    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }
    number.textContent = String(value);
    copy.textContent = label;
    shell.removeAttribute('aria-hidden');
    shell.classList.remove('rolling');
    shell.classList.add('settled');
    object?.classList.remove('is-tumbling');
    paintCanvases(finalRotation);
    triggerHaptic(resultHapticForTone(tone));
  };
  requestAnimationFrame(tick);
}

function renderConditionChips(compact = false) {
  const list = createEl('div', { className: 'condition-list' });
  const active = CONDITION_DEFS.filter(([key]) => state.conditions[key]);
  for (const [key, label] of active) list.append(createEl('span', { className: 'condition-chip active', text: label }));
  for (const custom of safeArray(state.conditions.custom)) list.append(createEl('span', { className: 'condition-chip active', text: custom.name || 'Własny stan' }));
  if (!active.length && !state.conditions.custom.length && !compact) list.append(createEl('span', { className: 'condition-chip good', text: 'Brak aktywnych stanów' }));
  return list;
}



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
function inconsistencyAlerts() {
  const alerts = [];
  if (loadWarning) {
    alerts.push(createEl('div', { className: 'alert' }, [
      createEl('strong', { text: 'Uwaga dotycząca danych' }),
      createEl('p', { className: 'small wrap-anywhere', text: loadWarning })
    ]));
  }
  return alerts;
}

// ============================================================
// 13. Character view
// ============================================================
function sessionPromptFor(sourceState = state) {
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
  if (sourceState.conditions.panicked && sourceState.stats.hp.current > 0) {
    return {
      id: 'panicked-protection',
      tone: 'danger',
      title: 'Panika wymaga 0 Ochrony',
      message: 'Spanikowana postać ma 0 Ochrony, nie działa w pierwszej rundzie i atakuje jako osłabiona. Zastosuj brakującą konsekwencję stanu.',
      primaryLabel: 'Ustaw Ochronę na 0',
      primaryAction: applyPanickedProtectionRule
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

function applyPanickedProtectionRule() {
  openConfirmSheet({
    title: 'Skutek Paniki',
    message: 'Zastosować 0 Ochrony dla spanikowanej postaci? Zmianę będzie można cofnąć.',
    confirmLabel: 'Ustaw 0 Ochrony',
    danger: true,
    onConfirm: () => commitChange('Panika: Ochrona spadła do 0', next => { next.stats.hp.current = 0; })
  });
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
  const conditions = button('Wszystkie stany', openConditionsSheet, 'btn btn-ghost');
  return createEl('aside', {
    className: `session-alert session-alert-${prompt.tone}`,
    attrs: { 'aria-labelledby': `session-alert-${prompt.id}` }
  }, [
    createEl('p', { className: 'section-kicker', text: 'Co teraz?' }),
    createEl('h2', { id: `session-alert-${prompt.id}`, text: prompt.title }),
    createEl('p', { text: prompt.message }),
    createEl('div', { className: 'session-alert-actions' }, [primary, conditions])
  ]);
}

function openSavePickerSheet() {
  const body = createEl('div', { className: 'save-picker-grid' });
  for (const key of ['str', 'dex', 'wil']) {
    const attr = state.stats[key];
    body.append(button(`${ATTRS[key].label} ${attr.current}`, () => {
      transitionFromSheet(() => openSavePreparationSheet(key));
    }, 'btn save-picker-button', {
      'aria-label': `Przygotuj rzut obronny ${ATTRS[key].full}, aktualna wartość ${attr.current}`
    }));
  }
  openSheet({
    title: 'Rzut obronny',
    body: createEl('div', { className: 'form-grid' }, [
      createEl('p', { className: 'muted small', text: 'Wybierz cechę wskazaną przez Wardena. Przed rzutem ustalcie, jaki negatywny skutek grozi przy porażce.' }),
      body
    ])
  });
}

function openSavePreparationSheet(attrKey) {
  const attr = state.stats[attrKey];
  if (!attr) return;
  const stake = textInput('', 200);
  const body = createEl('div', { className: 'form-grid save-preparation-flow' }, [
    createEl('div', { className: 'report-block save-target' }, [
      createEl('span', { className: 'section-kicker', text: `Rzut obronny ${ATTRS[attrKey].label}` }),
      createEl('strong', { text: `1k20 ≤ ${attr.current}` }),
      createEl('p', { className: 'muted small', text: 'Rzucaj, gdy Warden wskaże ryzyko. Naturalne 1 zawsze oznacza sukces, a naturalne 20 — porażkę.' })
    ]),
    field('Co grozi przy porażce? (opcjonalnie)', stake, 'Możesz zapisać ustaloną stawkę, np. „Strażnicy mnie zauważą”. Bez wpisywania aplikacja nadal przeprowadzi rzut.'),
    createEl('p', { className: 'help', text: 'Aplikacja pokaże wynik, ale nie wymyśli konsekwencji za Wardena.' })
  ]);
  const roll = button('Rzuć 1k20', () => {
    const announcedStake = trimText(stake.value).slice(0, 200);
    transitionFromSheet(() => performSave(attrKey, null, { stake: announcedStake }));
  }, 'btn btn-primary btn-block');
  openSheet({ title: `Przygotuj rzut ${ATTRS[attrKey].label}`, body, footer: roll });
}

function weaponCombatMeta(item, mode = 'normal') {
  if (mode === 'impaired') return 'atak osłabiony · k4';
  if (mode === 'enhanced') return 'atak wzmocniony · k12';
  const traits = [item.damageFormula?.blast ? 'podmuch' : '', ...safeArray(item.traits).slice(0, 2)].filter(Boolean);
  return [formatDamageFormula(item.damageFormula), ...traits].join(' · ');
}

function runCombatWeapon(item, mode = 'normal') {
  closeSheet();
  requestAnimationFrame(() => runItemAttack(item, mode));
}

function openCombatWeaponPicker(mode) {
  const weapons = heldWeaponItems();
  if (!weapons.length) {
    showToast('Najpierw przygotuj broń w Ekwipunku.', 'error');
    return;
  }
  if (weapons.length === 1) {
    runItemAttack(weapons[0], mode);
    return;
  }
  const body = createEl('div', { className: 'combat-weapon-list' });
  for (const weapon of weapons) {
    body.append(consequenceAction(
      weapon.name,
      weaponCombatMeta(weapon, mode),
      mode === 'impaired' ? 'impaired' : mode === 'enhanced' ? 'enhanced' : 'roll',
      () => runCombatWeapon(weapon, mode)
    ));
  }
  openSheet({
    title: mode === 'impaired' ? 'Atak osłabiony' : mode === 'enhanced' ? 'Atak wzmocniony' : 'Wybierz broń',
    body,
    footer: button('Wróć do walki', () => transitionFromSheet(openCombatSheet), 'btn btn-ghost btn-block')
  });
}

function prepareWeaponForCombat(itemId) {
  const item = state.inventory.items.find(entry => entry.id === itemId);
  if (!item?.damageFormula || item.carryState === 'spent') return;
  closeSheet();
  commitChange(`Przygotowano do walki: ${item.name}`, next => {
    const target = next.inventory.items.find(entry => entry.id === itemId);
    if (target) target.carryState = 'held';
  });
  requestAnimationFrame(openCombatSheet);
}

function openRetreatSheet() {
  const destination = textInput('', 200);
  const body = createEl('div', { className: 'form-grid' }, [
    createEl('div', { className: 'report-block' }, [
      createEl('span', { className: 'section-kicker', text: 'Odwrót' }),
      createEl('strong', { text: `Rzut ZRE · 1k20 ≤ ${state.stats.dex.current}` }),
      createEl('p', { className: 'muted small', text: 'Odwrót wymaga bezpiecznego celu. Warden określa pozycję i konsekwencję nieudanego rzutu.' })
    ]),
    field('Dokąd się wycofujesz? (opcjonalnie)', destination, 'Nazwij bezpieczne miejsce w fikcji przed rzutem.')
  ]);
  const roll = button('Rzuć ZRE na odwrót', () => {
    const place = trimText(destination.value).slice(0, 200);
    transitionFromSheet(() => performSave('dex', null, {
      stake: place ? `Nie docieram bezpiecznie do: ${place}` : 'Odwrót nie prowadzi bezpiecznie do wskazanego celu'
    }));
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Przygotuj odwrót', body, footer: roll });
}

function openCombatSheet() {
  const ready = heldWeaponItems();
  const unready = weaponItems().filter(item => item.carryState !== 'held');
  const panicked = state.conditions.panicked;
  const body = createEl('div', { className: 'combat-flow' });
  body.append(createEl('div', { className: `report-block combat-rule${panicked ? ' combat-rule-danger' : ''}` }, [
    createEl('span', { className: 'section-kicker', text: panicked ? 'Panika' : 'Zasada ataku' }),
    createEl('strong', { text: panicked ? 'Ataki są osłabione do k4' : 'Ataki trafiają automatycznie' }),
    createEl('p', { className: 'muted small', text: panicked ? 'Wybierz broń i rzuć k4. Warden może rozstrzygnąć szczególną sytuację inaczej.' : 'Zadeklaruj ruch i jedno działanie. Warden odejmuje pancerz celu od wyniku obrażeń.' })
  ]));
  body.append(consequenceAction(
    'Pierwsza runda — ZRE',
    panicked ? 'Panika blokuje działanie w pierwszej rundzie.' : `Rzuć 1k20 przeciw ZRE ${state.stats.dex.current}.`,
    'round',
    () => { closeSheet(); requestAnimationFrame(() => performFirstRoundDexSave()); }
  ));

  body.append(createEl('div', { className: 'combat-section-heading' }, [
    createEl('h3', { text: 'Broń w rękach' }),
    createEl('span', { className: 'section-caption', text: ready.length ? `${ready.length} ${weaponCountLabel(ready.length)}` : 'brak' })
  ]));
  if (ready.length) {
    const mode = panicked ? 'impaired' : 'normal';
    const list = createEl('div', { className: 'combat-weapon-list' });
    for (const weapon of ready) {
      list.append(consequenceAction(weapon.name, weaponCombatMeta(weapon, mode), weapon.damageFormula.blast ? 'blast' : 'roll', () => runCombatWeapon(weapon, mode)));
    }
    body.append(list);
    if (!panicked) {
      body.append(createEl('div', { className: 'combat-mode-grid' }, [
        button('Osłabiony · k4', () => transitionFromSheet(() => openCombatWeaponPicker('impaired')), 'btn btn-quiet'),
        button('Wzmocniony · k12', () => transitionFromSheet(() => openCombatWeaponPicker('enhanced')), 'btn btn-quiet')
      ]));
    }
    if (ready.length >= 2) {
      body.append(consequenceAction('Dwie bronie', 'Rzuć przygotowanymi broniami i zachowaj wyższy wynik.', 'dual', () => transitionFromSheet(openDualWeaponsSheet)));
    }
  } else {
    body.append(createEl('div', { className: 'combat-empty' }, [
      createEl('strong', { text: 'Nie trzymasz broni' }),
      createEl('p', { className: 'muted small', text: 'Możesz walczyć bez broni albo przygotować jeden z dostępnych przedmiotów.' })
    ]));
  }

  if (unready.length) {
    const disclosure = createEl('details', { className: 'combat-ready-disclosure' });
    disclosure.append(createEl('summary', {}, [
      createEl('span', { text: 'Przygotuj inną broń' }),
      createEl('span', { className: 'section-caption', text: `${unready.length}` })
    ]));
    const list = createEl('div', { className: 'combat-ready-list' });
    for (const weapon of unready) {
      list.append(consequenceAction(weapon.name, `${CARRY_STATES[weapon.carryState] || weapon.carryState} · ${formatDamageFormula(weapon.damageFormula)}`, 'arrow', () => prepareWeaponForCombat(weapon.id)));
    }
    disclosure.append(list);
    body.append(disclosure);
  }

  body.append(createEl('div', { className: 'combat-section-heading' }, [createEl('h3', { text: 'Inne działania' })]));
  body.append(createEl('div', { className: 'combat-other-actions' }, [
    consequenceAction('Bez broni', 'Atak trafia automatycznie i zadaje k4 obrażeń.', 'unarmed', () => { closeSheet(); requestAnimationFrame(() => performUnarmedAttack()); }),
    consequenceAction('Odwrót', 'Wskaż bezpieczny cel i wykonaj rzut ZRE.', 'arrow', () => transitionFromSheet(openRetreatSheet)),
    consequenceAction('Otrzymaj obrażenia', 'Pancerz → OCHR → SIŁ.', 'damage', () => transitionFromSheet(openDamageSheet))
  ]));
  openSheet({ title: 'Walka', body, footer: button('Wróć do gry', closeSheet, 'btn btn-primary btn-block') });
}

function renderCombatLauncher() {
  const ready = heldWeaponItems();
  const panicked = state.conditions.panicked;
  const section = createEl('section', { className: 'combat-launcher', attrs: { 'aria-labelledby': 'combat-launcher-title' } });
  section.append(createEl('div', { className: 'section-heading' }, [
    characterSectionTitle('combat-launcher-title', 'Walka', 'weapon'),
    panicked ? createEl('span', { className: 'combat-status', text: 'Osłabione' }) : null
  ]));

  let title = 'Bez broni';
  let meta = '';
  let actionLabel = 'k4';
  let action = () => performUnarmedAttack();
  let actionAria = 'Rzuć k4 obrażeń za atak bez broni';
  if (ready.length === 1) {
    const weapon = ready[0];
    title = weapon.name;
    meta = [weapon.damageFormula?.blast ? 'podmuch' : '', ...safeArray(weapon.traits).slice(0, 2)].filter(Boolean).join(' · ');
    actionLabel = panicked ? 'k4' : formatDamageFormula(weapon.damageFormula);
    action = () => runItemAttack(weapon);
    actionAria = `Rzuć obrażenia przygotowaną bronią: ${weapon.name}`;
  } else if (ready.length > 1) {
    title = `${ready.length} ${weaponCountLabel(ready.length)} w rękach`;
    meta = 'Wybierz broń';
    actionLabel = 'Wybierz';
    action = openCombatSheet;
    actionAria = 'Wybierz przygotowaną broń do ataku';
  }
  section.append(createEl('div', { className: 'combat-weapon-row' }, [
    createEl('div', { className: 'combat-weapon-copy' }, [
      createEl('strong', { text: title }),
      meta ? createEl('span', { text: meta }) : null
    ]),
    createEl('button', {
      type: 'button',
      className: 'btn btn-quiet combat-weapon-action',
      attrs: { 'aria-label': actionAria },
      onclick: action
    }, [uiIcon('roll'), createEl('span', { text: actionLabel })])
  ]));
  section.append(createEl('div', { className: 'combat-quick-actions' }, [
    createEl('button', {
      type: 'button',
      className: 'btn btn-ghost combat-utility-action',
      attrs: { 'aria-label': 'Pierwsza runda · ZRE' },
      onclick: () => performFirstRoundDexSave()
    }, [uiIcon('round'), createEl('span', { text: 'Runda 1' }), createEl('small', { text: 'ZRE' })]),
    createEl('button', {
      type: 'button',
      className: 'btn btn-ghost combat-utility-action',
      attrs: { 'aria-label': 'Opcje walki' },
      onclick: openCombatSheet
    }, [uiIcon('more'), createEl('span', { className: 'sr-only', text: 'Opcje' })])
  ]));
  return section;
}

function renderCharacterView() {
  const root = $('#view-character');
  if (!root) return;
  root.replaceChildren();
  if (!state.initialized) {
    const welcome = createEl('section', { className: 'onboarding' });
    welcome.append(
      createEl('div', { className: 'onboarding-mark', text: 'C', attrs: { 'aria-hidden': 'true' } }),
      createEl('p', { className: 'section-kicker', text: 'Cairn 2e przy stole' }),
      createEl('h1', { text: 'Twoja wyprawa w zasięgu kciuka' }),
      createEl('p', { text: 'Jedna lokalna postać, szybki stan, ekwipunek i rzuty. Bez konta — dane zostają na tym urządzeniu.' }),
      createEl('div', { className: 'onboarding-actions' }, [
        button('Utwórz postać', openCreateCharacterSheet, 'btn btn-primary btn-block'),
        button('Importuj z Kettlewright', () => $('#importFileInput').click(), 'btn btn-block'),
        button('Tryb demonstracyjny', () => openConfirmSheet({ title: 'Dane demonstracyjne', message: 'Tryb demonstracyjny zastąpi obecną pustą kartę przykładową postacią.', confirmLabel: 'Wczytaj demo', onConfirm: () => { state = createDemoState(); saveNow(); renderAll(); showToast('Wczytano dane demonstracyjne.'); } }), 'btn btn-ghost btn-block')
      ])
    );
    root.append(welcome);
    for (const alert of inconsistencyAlerts()) root.append(alert);
    return;
  }

  for (const alert of inconsistencyAlerts()) root.append(alert);
  const backupReminder = renderBackupReminder();
  if (backupReminder) root.append(backupReminder);

  const armor = deriveArmor();
  const usage = calculateInventoryUsage();
  const sessionLayout = createEl('div', { className: 'character-session' });
  const hero = createEl('section', { className: 'character-state', attrs: { 'aria-labelledby': 'character-name' } });
  const identity = createEl('div', { className: 'identity-row' }, [
    createEl('div', { className: 'avatar', text: initials(state.identity.name) }),
    createEl('div', { className: 'identity-copy' }, [
      createEl('h1', { id: 'character-name', className: 'character-name', text: state.identity.name || 'Bez imienia' }),
      createEl('p', { className: 'character-background', text: state.identity.background || 'Bez tła' })
    ])
  ]);
  hero.append(identity);

  const statusStrip = createEl('div', { className: 'state-values' }, [
    createEl('button', {
      type: 'button',
      className: 'protection-control',
      attrs: { 'aria-label': `Ochrona ${state.stats.hp.current} z ${state.stats.hp.max}. Ochrona przed trafieniem (OCHR) opisuje zdolność unikania obrażeń. Otwórz wyjaśnienie i edycję.` },
      onclick: openProtectionSheet
    }, [
      stateLabel('OCHR', 'protection'),
      createEl('span', { className: 'protection-value' }, [String(state.stats.hp.current), createEl('small', { text: ` / ${state.stats.hp.max}` })])
    ]),
    createEl('div', { className: 'state-secondary' }, [
      createEl('div', {
        className: 'secondary-stat',
        attrs: { 'aria-label': `Pancerz ${armor.effective}, ${armor.mode === 'manual' ? 'ustawiony ręcznie' : 'ze sprzętu'}` }
      }, [
        stateLabel('Pancerz', 'armor'),
        createEl('strong', { text: armor.effective })
      ]),
      createEl('div', { className: 'secondary-stat' }, [
        stateLabel('Miejsca', 'slots'),
        createEl('strong', { text: `${usage.total}/10` }),
        usage.fatigueSlots > 0 ? createEl('span', { className: 'state-caption', text: `${usage.fatigueSlots} zmęczenia` }) : null
      ])
    ])
  ]);
  hero.append(statusStrip);
  const protectionRatio = state.stats.hp.max > 0 ? clamp(state.stats.hp.current / state.stats.hp.max, 0, 1) : 0;
  const protectionMeter = createEl('div', {
    className: 'protection-meter',
    attrs: { 'aria-hidden': 'true' }
  });
  protectionMeter.style.setProperty('--protection-ratio', String(protectionRatio));
  hero.append(protectionMeter);
  hero.append(createEl('div', {
    className: 'attribute-row',
    attrs: { 'aria-label': 'Rzuty obronne według aktualnych cech' }
  }, [
    ...['str', 'dex', 'wil'].map(key => createEl('button', {
      type: 'button',
      className: `attribute-control attribute-${key}`,
      attrs: { 'aria-label': `Przygotuj rzut obronny ${ATTRS[key].full}, aktualna wartość ${state.stats[key].current}` },
      onclick: () => openSavePreparationSheet(key)
    }, [
      createEl('span', { className: 'attribute-glyph' }, [uiIcon({ str: 'strength', dex: 'dexterity', wil: 'will' }[key])]),
      createEl('span', { className: 'attribute-copy' }, [
        createEl('span', { text: ATTRS[key].label }),
        createEl('strong', { text: state.stats[key].current })
      ])
    ]))
  ]));
  sessionLayout.append(hero);

  const sessionPrompt = renderSessionPrompt();
  if (sessionPrompt) sessionLayout.append(sessionPrompt);
  sessionLayout.append(renderCombatLauncher());

  const gameActions = createEl('section', { className: 'game-actions', attrs: { 'aria-label': 'Akcje w grze' } });
  gameActions.append(createEl('button', {
    type: 'button',
    className: 'btn damage-primary-action',
    onclick: openDamageSheet
  }, [uiIcon('damage'), createEl('span', {}, [createEl('strong', { text: 'Obrażenia' }), createEl('small', { text: 'Pancerz → OCHR → SIŁ' })]), uiIcon('arrow')]));
  gameActions.append(createEl('div', { className: 'secondary-action-grid' }, [
    compactActionButton('Rzut obronny', 'dice', openSavePickerSheet),
    compactActionButton('Odpoczynek', 'rest', openRestSheet),
    compactActionButton('Stany', 'conditions', openConditionsSheet)
  ]));
  sessionLayout.append(gameActions);


  if (renderConditionChips(true).childElementCount) {
    const activeConditionLabels = [
      ...CONDITION_DEFS.filter(([key]) => state.conditions[key]).map(([, label]) => label),
      ...safeArray(state.conditions.custom).map(entry => entry.name || 'Własny stan')
    ];
    const actions = createEl('div', { className: 'compact-condition-actions' });
    if (state.conditions.panicked) {
      actions.append(createEl('button', {
        type: 'button',
        className: 'btn btn-primary panic-roll-button',
        attrs: { 'aria-label': 'Spróbuj opanować panikę — rzut WOL' },
        onclick: () => attemptRecoverFromPanic()
      }, [createEl('span', { text: 'Rzut WOL' })]));
    }
    actions.append(iconButton('Zarządzaj stanami', 'arrow', openConditionsSheet));
    sessionLayout.append(createEl('section', { className: 'condition-summary', attrs: { 'aria-label': 'Aktywne stany postaci' } }, [
      createEl('div', { className: 'compact-condition-copy' }, [
        createEl('strong', { text: 'Aktywne stany' }),
        renderConditionChips(true)
      ]),
      actions
    ]));
  }

  root.append(sessionLayout);

}

// ============================================================
// 14. Damage, recovery and stat sheets
// ============================================================
function openProtectionSheet() {
  const current = numberInput(state.stats.hp.current, 0, 99);
  const maximum = numberInput(state.stats.hp.max, 0, 99);
  const explainer = createEl('div', { className: 'report-block protection-explainer' }, [
    createEl('strong', { text: 'Ochrona przed trafieniem' }),
    createEl('p', { text: 'Ochrona opisuje zdolność uniknięcia obrażeń dzięki refleksowi, wytrzymałości i szczęściu. Nie jest zdrowiem.' }),
    createEl('p', { className: 'help', text: 'Pancerz najpierw zmniejsza obrażenia. Pozostała wartość obniża Ochronę, a nadmiar może przejść na SIŁ.' })
  ]);
  const body = createEl('div', { className: 'form-grid' }, [
    explainer,
    createEl('div', { className: 'form-grid two' }, [field('Aktualna Ochrona', current), field('Maksymalna Ochrona', maximum)])
  ]);
  const save = button('Zapisz Ochronę', () => {
    const max = Math.max(0, toInt(maximum.value, 0));
    const value = clamp(toInt(current.value, 0), 0, max);
    const before = state.stats.hp.current;
    closeSheet();
    const changed = commitChange('Zmieniono Ochronę', next => { next.stats.hp = { current: value, max }; });
    if (changed) {
      triggerHaptic(value < before ? 'impact' : 'selection');
      requestAnimationFrame(() => animateElementFeedback('.protection-control', value < before ? 'feedback-impact' : 'feedback-pop'));
    }
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Ochrona', body, footer: save });
}

function openDamageSheet() {
  const body = createEl('form', { className: 'form-grid', id: 'damageForm' });
  const raw = numberInput(1, 0, 999);
  const armor = numberInput(deriveArmor().effective, 0, 3);
  const source = textInput('', 200);
  const preview = createEl('div', { className: 'report-block', attrs: { 'aria-live': 'polite' } });
  const update = () => {
    const result = calculateDamage(state, raw.value, armor.value);
    preview.replaceChildren(
      createEl('h3', { text: 'Podgląd' }),
      createEl('p', { text: `${result.rawDamage} obrażeń − ${result.armor} pancerza = ${result.damageAfterArmor}` }),
      createEl('p', { text: `Ochrona: ${result.hpBefore} → ${result.hpAfter}` }),
      createEl('p', { text: `SIŁ: ${result.strBefore} → ${result.strAfter}` }),
      createEl('p', { className: result.scarRequired || result.strengthSaveRequired || result.strengthZero ? 'test-fail' : 'muted', text: result.noEffect ? 'Pancerz zatrzymuje wszystkie obrażenia.' : result.scarRequired ? `Dokładnie 0 Ochrony: rozpatrz Bliznę według ${result.hpLost} utraconych punktów Ochrony.` : result.strengthZero ? 'SIŁ spada do 0: postać umiera.' : result.strengthSaveRequired ? `Po zatwierdzeniu wykonaj rzut obronny SIŁ przeciw ${result.strengthSaveTarget}.` : 'Obrażenia nie przechodzą na SIŁ.' })
    );
  };
  raw.addEventListener('input', update);
  armor.addEventListener('input', update);
  body.append(
    field('Surowe obrażenia', raw),
    field('Pancerz', armor, 'Domyślnie pobrany z karty. Maksimum 3.'),
    field('Źródło lub notatka (opcjonalnie)', source),
    preview
  );
  update();
  const apply = button('Zatwierdź obrażenia', () => {
    const result = calculateDamage(state, raw.value, armor.value);
    const label = trimText(source.value);
    closeSheet();
    const changed = commitChange(`Obrażenia ${result.damageAfterArmor}${label ? ` — ${label}` : ''}`, next => {
      next.stats.hp.current = result.hpAfter;
      next.stats.str.current = result.strAfter;
    });
    if (changed) {
      triggerHaptic(result.damageAfterArmor > 0 ? 'danger' : 'selection');
      requestAnimationFrame(() => animateElementFeedback('.protection-control', result.damageAfterArmor > 0 ? 'feedback-impact' : 'feedback-pop'));
    }
    if (result.strengthZero) {
      openResultSheet('Skutek obrażeń', 0, 'SIŁ spadła do zera', ['Zgodnie z zasadami postać umiera. Aplikacja nie podejmuje dalszych decyzji fabularnych.'], 'danger');
    } else if (result.strengthSaveRequired) {
      openCriticalSavePrompt(result.strengthSaveTarget);
    } else if (result.scarRequired) {
      openScarPrompt(result.hpLost);
    }
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Otrzymaj obrażenia', body, footer: apply });
}

function openCriticalSavePrompt(target) {
  const body = createEl('div', { className: 'sheet-list' }, [
    createEl('p', { text: `Obrażenia przeszły na SIŁ. Wykonaj natychmiast rzut obronny SIŁ przy nowej wartości ${target}.` }),
    createEl('p', { className: 'help', text: 'Aplikacja nie oznaczy obrażeń krytycznych bez wyniku rzutu.' })
  ]);
  const rollBtn = button('Rzuć 1k20', () => {
    closeSheet();
    performCriticalStrengthSave(target);
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Wymagany rzut SIŁ', body, footer: rollBtn });
}


function performCriticalStrengthSave(target) {
  let roll;
  try { roll = rollDie(20); }
  catch (error) { showToast(error.message, 'error'); return; }
  const result = resolveSave(target, roll);
  const natural = result.naturalSuccess ? ' — naturalne 1' : result.naturalFailure ? ' — naturalne 20' : '';
  const summary = `Rzut obronny SIŁ po obrażeniach: ${roll} vs ${target} — ${result.success ? 'sukces' : 'porażka'}${natural}`;
  addDiceHistory({ type: 'save', attr: 'str', label: 'Rzut SIŁ po obrażeniach', summary, notation: '1k20', result: roll, success: result.success, details: `Cel: ${target}` });
  announce(summary);
  const animatedResult = createEl('div', { className: 'dice-result', attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' } });
  const body = createEl('div', { className: 'sheet-list' }, [
    animatedResult,
    createEl('p', { className: 'muted', text: result.naturalSuccess ? 'Naturalne 1 zawsze oznacza sukces.' : result.naturalFailure ? 'Naturalne 20 zawsze oznacza porażkę.' : `Cel rzutu: ${target}.` }),
    createEl('p', { text: result.success ? 'Postać pozostaje w walce z obniżoną SIŁ.' : 'Porażka oznacza obrażenia krytyczne: postać może tylko pełzać i umrze w ciągu godziny bez pomocy.' })
  ]);
  if (result.success) {
    openSheet({ title: 'Rzut obronny SIŁ', body, footer: button('Zamknij', closeSheet, 'btn btn-primary btn-block') });
    animateDiceResult(animatedResult, roll, 'Sukces', 20, 'success');
    return;
  }
  const later = button('Warden rozstrzygnął inaczej', closeSheet, 'btn btn-ghost');
  const mark = button('Oznacz obrażenia krytyczne', () => {
    closeSheet();
    commitChange('Oznaczono obrażenia krytyczne', next => { next.conditions.criticalDamage = true; next.conditions.stabilized = false; });
  }, 'btn btn-danger');
  openSheet({ title: 'Rzut obronny SIŁ', body, footer: createEl('div', { className: 'button-row' }, [later, mark]) });
  animateDiceResult(animatedResult, roll, 'Porażka', 20, 'danger');
}

function openScarPrompt(hpLost) {
  const guide = getScarGuide(hpLost);
  const body = createEl('div', { className: 'sheet-list' });
  body.append(createEl('p', { text: `Atak sprowadził Ochronę dokładnie do zera po utracie ${hpLost} punktów Ochrony.` }));
  if (guide) {
    body.append(
      createEl('div', { className: 'report-block' }, [
        createEl('h3', { text: `${guide.hpLost}. ${guide.title}` }),
        createEl('p', { text: guide.summary })
      ]),
      createEl('p', { className: 'help', text: 'Helper przypomina wpis tabeli, ale nie stosuje trwałych zmian bez decyzji gracza i Wardena.' })
    );
  } else {
    body.append(createEl('div', { className: 'alert' }, [createEl('strong', { text: 'Brak pozycji w tabeli' }), createEl('p', { className: 'small', text: 'Oficjalna tabela Blizn obejmuje utratę od 1 do 12 punktów Ochrony. Warden musi rozstrzygnąć wynik.' })]));
  }
  const actions = [];
  actions.push(button('Rozpatrz później', closeSheet, 'btn btn-ghost'));
  if (guide?.helper) actions.push(button('Rzuć kością pomocniczą', () => performScarHelperRoll(guide), 'btn'));
  actions.push(button('Zapisz opis Blizny', () => { closeSheet(); openAddScarSheet(hpLost, guide); }, 'btn btn-primary'));
  openSheet({ title: 'Helper Blizny', body, footer: createEl('div', { className: 'button-row' }, actions) });
}

function performScarHelperRoll(guide) {
  let roll;
  try { roll = rollDie(6); }
  catch (error) { showToast(error.message, 'error'); return null; }
  const interpretation = resolveScarHelperRoll(guide.helper, roll);
  const summary = `${guide.title} — rzut pomocniczy: ${roll} (${interpretation})`;
  addDiceHistory({ type: 'scar', label: guide.title, summary, notation: 'k6', result: roll, details: interpretation });
  closeSheet();
  openResultSheet(guide.title, roll, interpretation, [guide.summary, 'Zapisz własny opis Blizny po uzgodnieniu szczegółów z Wardenem.'], 'success', { sides: 6 });
  return { roll, interpretation };
}


function openAddScarSheet(hpLost = null, guide = null) {
  const input = textarea(guide ? `${guide.title}: ` : '', 1000);
  const body = createEl('div', { className: 'form-grid' }, [field('Opis Blizny', input, hpLost ? `Wskazówka: pozycja ${hpLost} według liczby utraconych punktów Ochrony.` : '')]);
  const save = button('Zapisz Bliznę', () => {
    const text = trimText(input.value);
    if (!text) { showToast('Wpisz opis Blizny.', 'error'); return; }
    closeSheet();
    commitChange('Dodano Bliznę', next => { next.scars.push({ id: makeId(), text, addedAt: nowIso(), hpLost, guideTitle: guide?.title || null }); });
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Dodaj Bliznę', body, footer: save });
}

function openDirectDamageSheet() {
  const attr = selectInput([['str','SIŁ'],['dex','ZRE'],['wil','WOL']], 'str');
  const amount = numberInput(1, 0, 999);
  const note = textInput('', 200);
  const preview = createEl('div', { className: 'report-block' });
  const update = () => {
    const result = calculateDirectAttributeDamage(state, attr.value, amount.value);
    preview.replaceChildren(createEl('h3', { text: 'Podgląd' }), createEl('p', { text: `${ATTRS[result.attrKey].label}: ${result.before} → ${result.after}` }), result.reachedZero ? createEl('p', { className: 'test-fail', text: result.attrKey === 'str' ? 'SIŁ 0: postać umiera.' : result.attrKey === 'dex' ? 'ZRE 0: postać jest sparaliżowana.' : 'WOL 0: postać jest w delirium.' }) : createEl('p', { className: 'muted', text: 'To narzędzie nie zakłada automatycznie, który atrybut powinien otrzymać obrażenia.' }));
  };
  attr.addEventListener('change', update); amount.addEventListener('input', update); update();
  const body = createEl('div', { className: 'form-grid' }, [field('Atrybut', attr), field('Obrażenia', amount), field('Źródło lub notatka', note), preview]);
  const apply = button('Zatwierdź', () => {
    const result = calculateDirectAttributeDamage(state, attr.value, amount.value);
    const label = trimText(note.value);
    closeSheet();
    commitChange(`Obrażenia bezpośrednie ${ATTRS[result.attrKey].label}: ${result.damage}${label ? ` — ${label}` : ''}`, next => {
      next.stats[result.attrKey].current = result.after;
      if (result.reachedZero && result.attrKey === 'dex') next.conditions.paralyzed = true;
      if (result.reachedZero && result.attrKey === 'wil') next.conditions.delirious = true;
    });
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Obrażenia atrybutu', body, footer: apply });
}

function openRestSheet() {
  const usage = calculateInventoryUsage();
  const blockers = [];
  if (state.conditions.deprived) blockers.push('Postać jest pozbawiona kluczowej potrzeby i nie może odzyskiwać Ochrony.');
  if (state.conditions.panicked) blockers.push('Spanikowana postać ma 0 Ochrony; najpierw rozpatrz panikę.');
  if (usage.total === 10) blockers.push('Pełny ekwipunek sprowadza Ochronę do 0; najpierw zwolnij miejsce.');
  const body = createEl('div', { className: 'sheet-list' }, [
    createEl('p', { text: 'Potwierdź z Wardenem, że macie kilka chwil, wodę i bezpieczne miejsce. W podziemiach odpoczynek zajmuje turę i może wystawić drużynę na niebezpieczeństwo.' }),
    createEl('p', { className: 'help', text: 'Ta akcja nie przywraca atrybutów, nie usuwa zmęczenia, stanów ani użyć przedmiotów.' })
  ]);
  for (const blocker of blockers) body.append(createEl('div', { className: 'alert' }, [createEl('strong', { text: 'Blokada' }), createEl('p', { className: 'small', text: blocker })]));
  const apply = button(`Warunki są bezpieczne — przywróć OCHR do ${state.stats.hp.max}`, () => {
    closeSheet();
    commitChange('Krótki odpoczynek: przywrócono Ochronę', next => { next.stats.hp.current = next.stats.hp.max; });
  }, 'btn btn-primary btn-block', { disabled: blockers.length > 0 || state.stats.hp.current === state.stats.hp.max });
  openSheet({ title: 'Krótki odpoczynek', body, footer: apply });
}

function openEditStatsSheet() {
  const controls = {};
  const body = createEl('form', { className: 'form-grid' });
  for (const key of ['hp','str','dex','wil']) {
    controls[key] = { current: numberInput(state.stats[key].current, 0, 99), max: numberInput(state.stats[key].max, 0, 99) };
    body.append(createEl('div', { className: 'form-grid two' }, [field(key === 'hp' ? 'Ochrona aktualna' : `${ATTRS[key].label} aktualne`, controls[key].current), field(key === 'hp' ? 'Ochrona maksymalna' : `${ATTRS[key].label} maksymalne`, controls[key].max)]));
  }
  controls.gold = numberInput(state.stats.gold, 0, 999999);
  body.append(field('Złoto', controls.gold));
  const save = button('Zapisz statystyki', () => {
    closeSheet();
    commitChange('Zmieniono statystyki', next => {
      for (const key of ['hp','str','dex','wil']) {
        const max = Math.max(0, toInt(controls[key].max.value, 0));
        const current = clamp(toInt(controls[key].current.value, 0), 0, max);
        next.stats[key] = { current, max };
      }
      next.stats.gold = Math.max(0, toInt(controls.gold.value, 0));
    });
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Edytuj statystyki', body, footer: save });
}

function openItemDamageResultSheet(item, result, options = {}) {
  const mode = options.mode || (options.impaired === true ? 'impaired' : 'normal');
  const modeLabel = mode === 'impaired' ? 'Atak osłabiony' : mode === 'enhanced' ? 'Atak wzmocniony' : 'Atak trafia automatycznie';
  const notation = mode === 'impaired' ? 'k4' : mode === 'enhanced' ? 'k12' : result.notation;
  const resultPanel = createEl('div', { className: 'dice-result', attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' } });
  const body = createEl('div', { className: 'sheet-list item-damage-result' }, [
    resultPanel,
    createEl('div', { className: 'report-block' }, [
      createEl('span', { className: 'section-kicker', text: modeLabel }),
      createEl('strong', { text: `${item.name} · ${notation}` }),
      createEl('p', { className: 'muted small', text: 'Przekaż wynik Wardenowi. Pancerz celu i skutki obrażeń są rozpatrywane osobno.' })
    ])
  ]);
  const footer = createEl('div', { className: 'button-row' }, [
    button('Historia', () => transitionFromSheet(openDiceHistorySheet), 'btn btn-ghost'),
    button('Gotowe', closeSheet, 'btn btn-primary')
  ]);
  openSheet({ title: 'Obrażenia broni', body, footer });
  animateDiceResult(resultPanel, result.total, 'obrażeń', mode === 'impaired' ? 4 : mode === 'enhanced' ? 12 : (result.rolls?.[0]?.sides || 6), 'success');
}

function performDamageFormulaRoll(item, mode = 'normal') {
  try {
    const formula = mode === 'impaired'
      ? parseDamageFormulaNotation('d4')
      : mode === 'enhanced'
        ? parseDamageFormulaNotation('d12')
        : item.damageFormula;
    const result = rollDamageFormula(formula);
    const rollText = result.rolls.map(entry => `d${entry.sides}: ${entry.value}`).join(', ');
    const keepText = result.formula.keep === 'highest' && result.rolls.length > 1 ? ` → najwyższy ${result.total}` : '';
    const blastText = result.formula.blast ? ' · blast' : '';
    const modeText = mode === 'impaired' ? ' · osłabiony' : mode === 'enhanced' ? ' · wzmocniony' : '';
    const summary = `${item.name}${modeText}: ${result.total} (${result.notation}${blastText})`;
    addDiceHistory({ type: 'damage', label: `${item.name}${modeText}`, summary, notation: result.notation, result: result.total, details: `${rollText}${keepText}${blastText}` });
    renderDiceResult(result.total, `${item.name}${modeText} · ${rollText}${keepText}${blastText}`, { sides: result.rolls[0]?.sides || 6 });
    announce(`${summary}. ${rollText}${keepText}.`);
    openItemDamageResultSheet(item, result, { mode });
    return result;
  } catch (error) {
    showToast(error.message, 'error');
    return null;
  }
}



function runItemAttack(item, mode = 'normal') {
  if (!item?.damageFormula) return null;
  const requestedMode = ['normal', 'impaired', 'enhanced'].includes(mode) ? mode : 'normal';
  if (!state.conditions.panicked || requestedMode === 'impaired') {
    return item.damageFormula.blast ? openBlastAttackSheet(item, { mode: requestedMode }) : performDamageFormulaRoll(item, requestedMode);
  }
  const body = createEl('div', { className: 'sheet-list' }, [
    createEl('p', { text: 'Spanikowana postać wykonuje ataki jako osłabione. Zamiast kości broni użyj k4.' }),
    createEl('p', { className: 'help', text: 'Warden może rozstrzygnąć szczególną sytuację inaczej. Ochrona nie jest przywracana przez ten rzut.' })
  ]);
  const impaired = button('Rzuć osłabiony k4', () => {
    closeSheet();
    if (item.damageFormula.blast) openBlastAttackSheet(item, { mode: 'impaired' });
    else performDamageFormulaRoll(item, 'impaired');
  }, 'btn btn-primary');
  const override = button('Warden pozwala na wybrany wariant', () => {
    closeSheet();
    if (item.damageFormula.blast) openBlastAttackSheet(item, { mode: requestedMode });
    else performDamageFormulaRoll(item, requestedMode);
  }, 'btn btn-ghost');
  openSheet({ title: 'Panika: atak osłabiony', body, footer: createEl('div', { className: 'button-row' }, [override, impaired]) });
  return null;
}
function openBlastAttackSheet(sourceItem = null, config = {}) {
  const mode = config.mode || (config.impaired === true ? 'impaired' : 'normal');
  const impaired = mode === 'impaired';
  const enhanced = mode === 'enhanced';
  const blastItems = heldWeaponItems().filter(item => item.damageFormula?.blast);
  const options = [
    ['manual-d4', 'Ręcznie: k4'], ['manual-d6', 'Ręcznie: k6'], ['manual-d8', 'Ręcznie: k8'], ['manual-d10', 'Ręcznie: k10'], ['manual-d12', 'Ręcznie: k12'],
    ...blastItems.map(item => [item.id, `${item.name} · ${formatDamageFormula(item.damageFormula)}`])
  ];
  const selected = sourceItem?.id && options.some(([value]) => value === sourceItem.id) ? sourceItem.id : options[0][0];
  const source = selectInput(options, selected);
  const targets = numberInput(2, 1, 20);
  const body = createEl('div', { className: 'form-grid' }, [
    createEl('p', { text: 'Podmuch wpływa na wszystkie cele w obszarze. Dla każdego celu wykonuje się oddzielny rzut obrażeń.' }),
    impaired
      ? createEl('div', { className: 'alert alert-info' }, [createEl('strong', { text: 'Atak osłabiony · k4' }), createEl('p', { className: 'small', text: 'Dla każdego celu zostanie rzucone k4 zamiast kości broni.' })])
      : enhanced
        ? createEl('div', { className: 'alert alert-info' }, [createEl('strong', { text: 'Atak wzmocniony · k12' }), createEl('p', { className: 'small', text: 'Dla każdego celu zostanie rzucone k12 zamiast kości broni.' })])
        : field('Źródło obrażeń', source),
    field('Liczba celów', targets, 'Warden określa, kto znajduje się w obszarze. Aplikacja nie śledzi przeciwników ani ich pancerza.'),
    createEl('p', { className: 'help', text: 'Gdy liczba celów jest niepewna, oficjalna zasada pozwala rzucić odpowiednią kością obrażeń, aby ją ustalić.' })
  ]);
  const roll = button('Rzuć osobno dla każdego celu', () => {
    const item = mode !== 'normal' ? sourceItem : blastItems.find(entry => entry.id === source.value);
    const manualSide = source.value.startsWith('manual-d') ? toInt(source.value.slice(8), 6) : null;
    const formula = impaired
      ? parseDamageFormulaNotation('d4', true)
      : enhanced
        ? parseDamageFormulaNotation('d12', true)
        : (item?.damageFormula || parseDamageFormulaNotation(`d${manualSide}`, true));
    let results;
    try { results = rollBlastTargets(formula, targets.value); }
    catch (error) { showToast(error.message, 'error'); return; }
    const details = results.map(entry => `Cel ${entry.target}: ${entry.total}${entry.rolls.length > 1 ? ` (${entry.rolls.map(die => die.value).join(', ')} → najwyższy)` : ''}`);
    const label = impaired
      ? `${item?.name || 'Podmuch'} — osłabiony`
      : enhanced
        ? `${item?.name || 'Podmuch'} — wzmocniony`
        : (item?.name || `Podmuch ${formatDamageFormula(formula)}`);
    const summary = `${label}: ${results.length} ${results.length === 1 ? 'cel' : 'cele'} — ${results.map(entry => entry.total).join(', ')}`;
    addDiceHistory({ type: 'blast', label, summary, notation: formatDamageFormula(formula), result: results.map(entry => entry.total), details: details.join(' · ') });
    closeSheet();
    openResultSheet('Podmuch — osobne rzuty', results.length, `${results.length} ${results.length === 1 ? 'cel' : 'cele'}`, [...details, 'Pancerz i skutki obrażeń rozpatruje Warden osobno dla każdego celu.']);
    announce(summary);
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Helper podmuchu', body, footer: roll });
}

// ============================================================
// 15. Inventory view and sheets
// ============================================================
function renderSlotMeter(usage) {
  const meter = createEl('div', { className: 'slot-meter', attrs: { role: 'img', 'aria-label': `Zajęto ${usage.total} z 10 miejsc, w tym ${usage.fatigueSlots} zmęczenia.` } });
  const itemFilled = Math.min(10, usage.itemSlots);
  const fatigueFilled = Math.min(10 - itemFilled, usage.fatigueSlots);
  for (let i = 0; i < 10; i++) {
    const cls = i < itemFilled ? 'slot-cell filled' : i < itemFilled + fatigueFilled ? 'slot-cell fatigue' : 'slot-cell';
    meter.append(createEl('span', { className: cls }));
  }
  return meter;
}

const INVENTORY_GROUP_DEFS = [
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
  const overview = createEl('section', { className: 'inventory-overview', attrs: { 'aria-label': 'Stan ekwipunku' } });
  overview.append(createEl('div', { className: 'inventory-summary-head' }, [
    createEl('div', {}, [
      createEl('strong', { className: 'inventory-summary-title', text: `${usage.total}/10 miejsc` }),
      createEl('span', { className: 'section-caption', text: usage.total === 10 ? 'Pełny ekwipunek · OCHR krytyczne' : `${10 - usage.total} wolnych` })
    ]),
    createEl('div', { className: 'inventory-summary-actions' }, [
      button('Zmień złoto', openGoldSheet, 'btn btn-ghost gold-button', { 'aria-label': `Złoto: ${state.stats.gold}. Otwórz szybką korektę.` }),
      iconButton('Dodaj przedmiot', 'plus', () => openItemSheet(), 'btn btn-icon btn-primary')
    ])
  ]));
  overview.append(createEl('div', { className: 'inventory-summary-stats' }, [
    createEl('div', { className: 'inventory-summary-stat', dataset: { inventoryStat: 'fatigue' } }, [createEl('strong', { text: usage.fatigueSlots }), createEl('span', { text: 'zmęczenia' })]),
    createEl('div', { className: 'inventory-summary-stat', dataset: { inventoryStat: 'armor' } }, [createEl('strong', { text: armor.effective }), createEl('span', { text: 'pancerz' })]),
    createEl('div', { className: 'inventory-summary-stat', dataset: { inventoryStat: 'gold' } }, [createEl('strong', { text: state.stats.gold }), createEl('span', { text: 'złoto' })])
  ]));
  overview.append(renderSlotMeter(usage));
  overview.append(createEl('p', { className: 'inventory-legend', text: 'Drobiazg 0 · zwykły 1 · nieporęczny 2 · zmęczenie 1' }));
  overview.append(createEl('div', { className: 'inventory-tools' }, [
    button('Dodaj zmęczenie', openAddFatigueSheet, 'btn btn-ghost inventory-tool'),
    button('Ustaw pancerz', openArmorSheet, 'btn btn-ghost inventory-tool')
  ]));
  root.append(overview);

  const listCard = createEl('section', { className: 'inventory-list', attrs: { 'aria-labelledby': 'inventory-list-title' } });
  listCard.append(createEl('div', { className: 'section-heading' }, [
    createEl('h2', { id: 'inventory-list-title', text: 'Przedmioty' })
  ]));
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
  if (item.carryState === 'held' && item.damageFormula?.blast) kinds.push('blast');
  else if (item.carryState === 'held' && item.damageFormula) kinds.push('roll');
  else if (item.damageFormula) kinds.push('prepare');
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
  const carryLabel = CARRY_STATES[item.carryState] || 'inny stan';
  const facts = [
    formatSlotLabel(item.slots),
    item.damageFormula ? formatDamageFormula(item.damageFormula) : '',
    item.armorValue ? `pancerz +${item.armorValue}` : '',
    item.uses.current !== null || item.uses.max !== null ? `użycia ${formatUses(item.uses)}` : '',
    ...safeArray(item.traits).slice(0, 2)
  ].filter(Boolean).slice(0, 4);
  const main = createEl('button', {
    type: 'button',
    className: 'inventory-row-main',
    attrs: { 'aria-label': `Szczegóły przedmiotu: ${item.name}. ${facts.join(', ')}. ${carryLabel}.` },
    onclick: () => openItemActionsSheet(item.id)
  }, [
    createEl('span', { className: 'inventory-row-title' }, [
      createEl('strong', { text: item.name }),
      createEl('span', { className: 'carry-status', text: carryLabel })
    ]),
    createEl('span', { className: 'inventory-row-facts' }, facts.map(fact => createEl('span', { text: fact }))),
    item.uses.current === 0 ? createEl('span', { className: 'item-warning', text: 'Brak użyć · otwórz szczegóły' }) : null
  ]);
  let trailing = null;
  if (!spent && item.carryState === 'held' && item.damageFormula) {
    trailing = button(formatDamageFormula(item.damageFormula), () => runItemAttack(item), 'btn btn-quiet inventory-trailing-action', {
      'aria-label': `Rzuć obrażenia: ${item.name}`
    });
  } else if (!spent && item.uses.current !== null) {
    trailing = button('Użyj', () => openUseItemSheet(item.id), 'btn btn-quiet inventory-trailing-action', {
      disabled: item.uses.current <= 0,
      'aria-label': `Użyj ${item.name}`
    });
  }
  wrap.append(main);
  if (trailing) wrap.append(trailing);
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
  if (item.carryState !== 'spent' && item.uses.current !== null) {
    primary.append(button('Użyj przedmiotu', () => { closeSheet(); openUseItemSheet(itemId); }, 'btn btn-primary', { disabled: item.uses.current <= 0 }));
    if (item.damageFormula && item.carryState === 'held') primary.append(button(item.damageFormula.blast ? 'Rzuć podmuch' : 'Rzuć obrażenia', () => { closeSheet(); runItemAttack(item); }, 'btn btn-quiet'));
    else if (item.damageFormula) primary.append(button('Przygotuj do walki', () => prepareWeaponForCombat(itemId), 'btn btn-quiet'));
  } else if (item.carryState === 'held' && item.damageFormula) {
    primary.append(button(item.damageFormula.blast ? 'Rzuć podmuch' : 'Rzuć obrażenia', () => { closeSheet(); runItemAttack(item); }, 'btn btn-primary'));
  } else if (item.carryState !== 'spent' && item.damageFormula) {
    primary.append(button('Przygotuj do walki', () => prepareWeaponForCombat(itemId), 'btn btn-primary'));
  }
  primary.append(
    button(`Sposób noszenia: ${CARRY_STATES[item.carryState] || item.carryState}`, () => { closeSheet(); openQuickCarrySheet(itemId); }, 'btn btn-quiet'),
    button('Edytuj', () => { closeSheet(); openItemSheet(itemId); }, 'btn btn-quiet')
  );
  if (item.uses.current !== null) primary.append(button('Przywróć 1 użycie', () => { closeSheet(); openRestoreItemUseSheet(itemId); }, 'btn btn-ghost', { disabled: item.uses.max !== null && item.uses.current >= item.uses.max }));
  primary.append(button(item.carryState === 'spent' ? 'Przywróć przedmiot' : 'Oznacz jako zużyty', () => { closeSheet(); toggleItemSpent(itemId); }, 'btn btn-ghost'));
  body.append(primary);

  const secondary = createEl('details', { className: 'inventory-secondary-actions' });
  secondary.append(createEl('summary', { text: 'Więcej i operacje niebezpieczne' }));
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
  wrap.append(createEl('button', {
    type: 'button',
    className: 'inventory-row-main fatigue-row-main',
    attrs: { 'aria-label': 'Zmęczenie, 1 miejsce. Otwórz szczegóły regeneracji.' },
    onclick: () => openRemoveFatigueSheet(fatigue.id)
  }, [
    createEl('span', { className: 'inventory-row-title' }, [
      createEl('strong', { text: 'Zmęczenie' }),
      createEl('span', { className: 'carry-status', text: 'część ekwipunku' })
    ]),
    createEl('span', { className: 'inventory-row-facts' }, [createEl('span', { text: '1 miejsce' })]),
    createEl('span', { className: 'inventory-row-note', text: fatigue.note || 'Odpoczynek może je usunąć.' })
  ]));
  return wrap;
}

function openItemSheet(itemId = null) {
  const existing = itemId ? state.inventory.items.find(item => item.id === itemId) : null;
  const item = existing ? deepClone(existing) : makeItem();
  const name = textInput(existing ? item.name : '', 200);
  const description = textarea(item.description, 2000);
  const slots = selectInput([['0','0 — drobiazg'],['1','1 — zwykły'],['2','2 — nieporęczny']], String(item.slots));
  const category = textInput(item.category, 80);
  const damage = textInput(formatDamageFormula(item.damageFormula), 40);
  const blast = createEl('input', { type: 'checkbox', checked: Boolean(item.damageFormula?.blast) });
  const armor = selectInput([['0','0'],['1','1'],['2','2'],['3','3']], String(item.armorValue));
  const carry = selectInput(Object.entries(CARRY_STATES), item.carryState);
  const usesCurrent = numberInput(item.uses.current ?? 0, 0, 999);
  const usesMax = numberInput(item.uses.max ?? '', 0, 999);
  const hasUses = createEl('input', { type: 'checkbox', checked: item.uses.current !== null || item.uses.max !== null });
  const traits = textInput(item.traits.join(', '), 300);
  const notes = textarea(item.notes, 1000);
  const body = createEl('div', { className: 'form-grid' }, [
    field('Nazwa', name),
    field('Opis', description),
    createEl('div', { className: 'form-grid two' }, [field('Zajmowane miejsca', slots), field('Kategoria', category)]),
    createEl('div', { className: 'form-grid two' }, [field('Formuła obrażeń', damage, 'Do 4 kości: d4, d6, d8, d10 lub d12, np. d6+d6. Przy wielu kościach zachowywany jest najwyższy wynik.'), field('Wartość pancerza', armor)]),
    createEl('label', { className: 'check-row' }, [blast, createEl('span', { text: 'Atak ma cechę blast' })]),
    field('Stan', carry),
    createEl('label', { className: 'check-row' }, [hasUses, createEl('span', { text: 'Przedmiot ma liczbę użyć' })]),
    createEl('div', { className: 'form-grid two' }, [field('Aktualne użycia', usesCurrent), field('Maksymalne użycia', usesMax)]),
    field('Cechy, oddzielone przecinkami', traits, 'Np. drobiazg, nieporęczny, blast.'),
    field('Własne notatki', notes)
  ]);
  const save = button(existing ? 'Zapisz przedmiot' : 'Dodaj przedmiot', () => {
    const itemName = trimText(name.value);
    if (!itemName) { showToast('Nazwa przedmiotu jest wymagana.', 'error'); name.focus(); return; }
    const damageNotation = trimText(damage.value);
    const damageFormula = damageNotation ? parseDamageFormulaNotation(damageNotation, blast.checked) : null;
    if (damageNotation && !damageFormula) { showToast('Nieprawidłowa formuła. Użyj np. d6 albo d6+d6.', 'error'); damage.focus(); return; }
    const enteredTraits = traits.value.split(',').map(value => value.trim()).filter(Boolean).filter(value => value.toLowerCase() !== 'blast');
    const nextItem = makeItem({
      ...item,
      name: itemName,
      description: description.value,
      slots: toInt(slots.value, 1),
      category: trimText(category.value, 'inne'),
      damageFormula,
      armorValue: toInt(armor.value, 0),
      carryState: carry.value,
      uses: hasUses.checked ? { current: toInt(usesCurrent.value, 0), max: trimText(usesMax.value) === '' ? null : toInt(usesMax.value, 0) } : { current: null, max: null },
      traits: enteredTraits,
      notes: notes.value
    });
    closeSheet();
    applyInventoryMutation(existing ? `Zmieniono przedmiot: ${itemName}` : `Dodano przedmiot: ${itemName}`, next => {
      if (existing) next.inventory.items = next.inventory.items.map(old => old.id === existing.id ? nextItem : old);
      else next.inventory.items.push(nextItem);
    });
  }, 'btn btn-primary btn-block');
  openSheet({ title: existing ? 'Edytuj przedmiot' : 'Dodaj przedmiot', body, footer: save });
}

function toggleItemSpent(itemId) {
  const item = state.inventory.items.find(entry => entry.id === itemId);
  if (!item) return;
  const spent = item.carryState !== 'spent';
  commitChange(`${spent ? 'Oznaczono jako zużyty' : 'Przywrócono przedmiot'}: ${item.name}`, next => {
    const target = next.inventory.items.find(entry => entry.id === itemId);
    target.carryState = spent ? 'spent' : 'stored';
  });
}

function openUseItemSheet(itemId) {
  const plan = planItemUse(state, itemId);
  if (!plan.valid) { showToast(plan.reason, 'error'); return; }
  const body = createEl('div', { className: 'sheet-list' }, [
    createEl('p', { text: `Użyć „${plan.item.name}”?` }),
    createEl('div', { className: 'report-block' }, [
      createEl('h3', { text: 'Podgląd zmiany' }),
      createEl('p', { text: `Użycia: ${plan.before} → ${plan.after}` }),
      createEl('p', { className: plan.after === 0 ? 'test-fail' : 'muted', text: plan.after === 0 ? 'Po tej operacji przedmiot nie będzie miał pozostałych użyć.' : 'Zmianę będzie można cofnąć jednym Undo.' })
    ])
  ]);
  const apply = button('Użyj i zmniejsz o 1', () => {
    closeSheet();
    const changed = commitChange(`Użyto: ${plan.item.name}`, next => applyItemUseMutation(next, itemId));
    if (changed) {
      triggerHaptic(plan.after === 0 ? 'impact' : 'selection');
      requestAnimationFrame(() => {
        const row = [...document.querySelectorAll('[data-item-id]')].find(element => element.dataset.itemId === itemId);
        animateElementFeedback(row, 'feedback-consume');
      });
    }
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Użyj przedmiotu', body, footer: apply });
}

function openRestoreItemUseSheet(itemId) {
  const item = state.inventory.items.find(entry => entry.id === itemId);
  if (!item || item.uses.current === null) return;
  const before = Math.max(0, toInt(item.uses.current, 0));
  const after = Math.min(item.uses.max ?? 999, before + 1);
  if (after === before) { showToast('Osiągnięto maksymalną liczbę użyć.'); return; }
  openConfirmSheet({
    title: 'Przywróć użycie',
    message: `Przywrócić jedno użycie „${item.name}”? Użycia: ${before} → ${after}. Potwierdź, że doładowanie lub korekta wynika z fikcji albo decyzji Wardena.`,
    confirmLabel: 'Przywróć 1 użycie',
    onConfirm: () => commitChange(`Przywrócono użycie: ${item.name}`, next => { const target = next.inventory.items.find(entry => entry.id === itemId); target.uses.current = after; })
  });
}

function adjustItemUses(itemId, delta) {
  if (delta < 0) openUseItemSheet(itemId);
  else if (delta > 0) openRestoreItemUseSheet(itemId);
}


function moveItem(itemId, direction) {
  const current = state.inventory.items.find(item => item.id === itemId);
  if (!current) return;
  const moved = moveItemWithinGroup(deepClone(state), itemId, direction);
  if (!moved) { showToast('Nie można przesunąć dalej w tej grupie.'); return; }
  commitChange('Zmieniono kolejność ekwipunku w grupie', next => { moveItemWithinGroup(next, itemId, direction); }, { silent: true });
}

function duplicateItem(itemId) {
  const item = state.inventory.items.find(entry => entry.id === itemId);
  if (!item) return;
  const duplicate = makeItem({ ...deepClone(item), id: makeId(), sourceId: null, name: `${item.name} — kopia` });
  applyInventoryMutation(`Zduplikowano przedmiot: ${item.name}`, next => { next.inventory.items.push(duplicate); });
}

function confirmDeleteItem(itemId) {
  const item = state.inventory.items.find(entry => entry.id === itemId);
  if (!item) return;
  openConfirmSheet({
    title: 'Usuń przedmiot',
    message: `Usunąć „${item.name}”? Dane przedmiotu znikną z aktywnej karty, ale zmianę będzie można cofnąć.`,
    confirmLabel: 'Usuń przedmiot',
    danger: true,
    onConfirm: () => commitChange(`Usunięto przedmiot: ${item.name}`, next => { next.inventory.items = next.inventory.items.filter(entry => entry.id !== itemId); })
  });
}

function openAddFatigueSheet() {
  const usage = calculateInventoryUsage();
  if (usage.total >= state.inventory.slotLimit) {
    const candidates = droppableInventoryItems();
    if (!candidates.length) {
      const body = createEl('div', { className: 'sheet-list' }, [
        createEl('p', { text: 'Nie ma wolnego miejsca, a ekwipunek nie zawiera przedmiotu zajmującego co najmniej jedno miejsce.' }),
        createEl('p', { className: 'help', text: 'Drobiazgi zajmujące 0 miejsc nie rozwiązują konfliktu. Dane nie zostały zmienione.' })
      ]);
      openSheet({ title: 'Nie można dodać zmęczenia', body, footer: button('Zamknij', closeSheet, 'btn btn-primary btn-block') });
      return;
    }
    const select = selectInput(candidates.map(item => [item.id, `${item.name} (${item.slots} ${item.slots === 1 ? 'miejsce' : 'miejsca'})`]), candidates[0].id);
    const note = textInput('', 200);
    const preview = createEl('div', { className: 'report-block', attrs: { 'aria-live': 'polite' } });
    const updatePreview = () => {
      const plan = planFatigueWithDroppedItem(state, select.value, { id: 'preview-fatigue', note: trimText(note.value), source: 'manual', slots: 1 });
      if (!plan.valid) {
        preview.replaceChildren(createEl('h3', { text: 'Konflikt' }), createEl('p', { className: 'test-fail', text: plan.reason }));
        return;
      }
      preview.replaceChildren(
        createEl('h3', { text: 'Wspólny podgląd' }),
        createEl('p', { text: `Upuszczany przedmiot: ${plan.droppedItem.name} (${plan.droppedItem.slots} ${plan.droppedItem.slots === 1 ? 'miejsce' : 'miejsca'}).` }),
        createEl('p', { text: 'Dodawane: 1 zmęczenie (1 miejsce).' }),
        createEl('p', { text: `Miejsca: ${plan.beforeUsage.total}/10 → ${plan.afterUsage.total}/10.` }),
        createEl('p', { text: `Ochrona: ${plan.hpBefore} → ${plan.hpAfter}.` })
      );
    };
    select.addEventListener('change', updatePreview);
    note.addEventListener('input', updatePreview);
    const body = createEl('div', { className: 'form-grid' }, [
      createEl('p', { text: 'Brak wolnego miejsca. Zgodnie z zasadami postać musi upuścić przedmiot, aby dodać zmęczenie.' }),
      field('Przedmiot do upuszczenia', select, 'Drobiazgi zajmujące 0 miejsc nie są dostępne na tej liście.'),
      field('Powód lub notatka zmęczenia (opcjonalnie)', note),
      preview
    ]);
    updatePreview();
    const add = button('Upuść przedmiot i dodaj zmęczenie', () => {
      const fatigue = makeFatigue({ note: trimText(note.value) });
      const plan = planFatigueWithDroppedItem(state, select.value, fatigue);
      if (!plan.valid) { showToast(plan.reason, 'error'); return; }
      closeSheet();
      commitChange(`Upuszczono ${plan.droppedItem.name} i dodano zmęczenie`, next => applyFatigueDropMutation(next, select.value, fatigue));
    }, 'btn btn-danger btn-block');
    openSheet({ title: 'Zwolnij miejsce na zmęczenie', body, footer: add });
    return;
  }
  const note = textInput('', 200);
  const body = createEl('div', { className: 'form-grid' }, [
    createEl('p', { text: 'Każde zmęczenie zajmuje jedno miejsce. Usuń je dopiero, gdy warunki w fikcji pozwolą postaci się zregenerować.' }),
    field('Powód lub notatka (opcjonalnie)', note)
  ]);
  const add = button('Dodaj zmęczenie', () => {
    const fatigue = makeFatigue({ note: trimText(note.value) });
    closeSheet();
    applyInventoryMutation('Dodano zmęczenie', next => { next.inventory.fatigue.push(fatigue); });
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Dodaj zmęczenie', body, footer: add });
}

function openRemoveFatigueSheet(fatigueId) {
  openConfirmSheet({
    title: 'Usuń zmęczenie',
    message: 'Zmęczenie usuwa się po odpowiedniej regeneracji, np. pełnym nocnym odpoczynku w bezpiecznym miejscu. Potwierdź, że warunki zostały spełnione.',
    confirmLabel: 'Usuń jedno zmęczenie',
    onConfirm: () => commitChange('Usunięto zmęczenie po regeneracji', next => { next.inventory.fatigue = next.inventory.fatigue.filter(entry => entry.id !== fatigueId); })
  });
}



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
function openArmorSheet() {
  const mode = selectInput([['equipment','Automatycznie z noszonego/trzymanego sprzętu'],['manual','Wartość ręczna']], state.stats.armor.mode);
  const manual = numberInput(state.stats.armor.manual, 0, 3);
  const body = createEl('div', { className: 'form-grid' }, [
    field('Tryb pancerza', mode),
    field('Wartość ręczna', manual, 'Maksimum 3. Przydatne po imporcie, zanim oznaczysz stan wyposażenia.'),
    createEl('p', { className: 'help', text: 'Tryb automatyczny liczy tylko przedmioty oznaczone jako noszone lub trzymane.' })
  ]);
  const save = button('Zapisz ustawienia pancerza', () => {
    closeSheet();
    commitChange('Zmieniono ustawienia pancerza', next => { next.stats.armor.mode = mode.value; next.stats.armor.manual = clamp(toInt(manual.value, 0), 0, 3); });
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Pancerz', body, footer: save });
}

// ============================================================
// 16. Dice view
// ============================================================
function renderDiceView() {
  const root = $('#view-dice');
  if (!root) return;
  root.replaceChildren();
  const entries = safeArray(state.diceHistory);
  const latest = entries[0] || null;
  const consolePanel = createEl('section', { className: 'dice-console', attrs: { 'aria-labelledby': 'dice-console-title' } });
  consolePanel.append(createEl('div', { className: 'section-heading' }, [
    createEl('h1', { id: 'dice-console-title', text: 'Ostatni wynik' }),
    button('Historia', openDiceHistorySheet, 'btn btn-ghost', { disabled: !entries.length })
  ]));
  const latestVisual = createDiceResultVisual(
    latest ? diceEntryResultText(latest) : '—',
    latest ? diceEntryTypeLabel(latest) : 'Jeszcze nie rzucano',
    latest ? diceEntrySides(latest) : 20
  );
  consolePanel.append(createEl('button', {
    type: 'button',
    className: 'dice-result dice-result-button',
    id: 'diceResult',
    disabled: !entries.length,
    attrs: {
      'aria-live': 'polite',
      'aria-atomic': 'true',
      'aria-label': latest ? `Ostatni rzut: ${latest.summary}. Otwórz historię rzutów.` : 'Brak historii rzutów'
    },
    onclick: openDiceHistorySheet
  }, [
    latestVisual,
    createEl('small', { className: 'result-die-context', text: latest ? latest.label || latest.notation || 'ostatni wynik' : 'Wybierz kość poniżej' })
  ]));
  consolePanel.append(createEl('div', { className: 'dice-result-actions' }, [
    button(
      'Powtórz',
      () => repeatDiceEntry(latest),
      'btn btn-quiet',
      {
        disabled: !latest || !canRepeatDiceEntry(latest),
        'aria-label': latest && canRepeatDiceEntry(latest) ? `Powtórz ostatni rzut: ${latest.label || latest.notation || 'rzut'}` : 'Brak rzutu do powtórzenia'
      }
    ),
    createEl('span', { className: 'section-caption', text: latest?.notation || '' })
  ]));

  const quickDice = createEl('section', { className: 'quick-dice', attrs: { 'aria-labelledby': 'quick-dice-title' } });
  quickDice.append(createEl('div', { className: 'section-heading' }, [
    createEl('h2', { id: 'quick-dice-title', text: 'Szybkie kości' })
  ]));
  const grid = createEl('div', { className: 'dice-rail' });
  for (const sides of DICE_SIDES) {
    grid.append(createEl('button', {
      type: 'button',
      className: `btn die-button${latest?.notation === `1k${sides}` || latest?.notation === `k${sides}` ? ' is-recent' : ''}`,
      attrs: { 'aria-label': `Rzuć kością k${sides}` },
      onclick: () => performRoll({ count: 1, sides }, `k${sides}`)
    }, [dieIcon(sides), createEl('span', { text: `k${sides}` })]));
  }
  quickDice.append(grid);

  const utilities = createEl('section', { className: 'dice-utilities', attrs: { 'aria-label': 'Dodatkowe rzuty' } });
  utilities.append(createEl('button', {
    type: 'button',
    className: 'action-row',
    attrs: { 'aria-label': 'Rzuć Kością Losu k6. Wynik 1 do 3 oznacza pecha, 4 do 6 zwykle sprzyja postaciom.' },
    onclick: performFateRoll
  }, [uiIcon('fate'), createEl('span', {}, [createEl('strong', { text: 'Kość Losu' }), createEl('small', { text: '1–3: zwykle pech · 4–6: zwykle sprzyja' })]), createEl('span', { className: 'action-row-value', text: 'k6' })]));
  utilities.append(createEl('button', {
    type: 'button',
    className: 'action-row',
    onclick: openCustomRollSheet
  }, [uiIcon('dice'), createEl('span', {}, [createEl('strong', { text: 'Rzut własny' }), createEl('small', { text: 'notacja i modyfikator' })]), createEl('span', { className: 'action-row-value', text: '›', attrs: { 'aria-hidden': 'true' } })]));

  const scenarios = createEl('section', { className: 'combat-scenarios' });
  const scenarioDisclosure = createEl('details', { className: 'combat-scenarios-disclosure' });
  scenarioDisclosure.append(createEl('summary', {}, [
    createEl('span', {}, [
      createEl('strong', { text: 'Procedury walki' }),
      createEl('small', { text: 'Sytuacje szczególne' })
    ]),
    createEl('span', { text: 'Rozwiń', className: 'muted small' })
  ]));
  scenarioDisclosure.append(createEl('div', { className: 'combat-scenarios-body' }, [
    createEl('p', { className: 'muted small', text: 'Używaj tylko wtedy, gdy wynika to z fikcji lub decyzji Wardena.' }),
    createEl('div', { className: 'scenario-grid' }, combatScenarioDefinitions().map(scenarioButton))
  ]));
  scenarios.append(scenarioDisclosure);

  root.append(consolePanel, quickDice, utilities, scenarios);
}

function openCustomRollSheet() {
  const count = numberInput(1, 1, 100);
  const sides = selectInput(DICE_SIDES.map(side => [String(side), `k${side}`]), '6');
  const modifier = numberInput(0, -999, 999);
  const keep = createEl('input', { type: 'checkbox' });
  const body = createEl('div', { className: 'form-grid' }, [
    createEl('div', { className: 'form-grid two' }, [field('Liczba kości', count), field('Kość', sides)]),
    field('Modyfikator', modifier),
    createEl('label', { className: 'check-row' }, [keep, createEl('span', { text: 'Zachowaj tylko najwyższy wynik' })])
  ]);
  const roll = button('Rzuć', () => {
    closeSheet();
    setView('dice');
    performRoll({ count: count.value, sides: sides.value, modifier: modifier.value, keepHighest: keep.checked }, 'Rzut własny');
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Rzut własny', body, footer: roll });
}

function renderDiceResult(value, label, options = {}) {
  animateDiceResult($('#diceResult'), value, label, options.sides || 6);
}



function openDiceHistorySheet() {
  const entries = safeArray(state.diceHistory);
  const body = createEl('div', { className: 'dice-history-sheet-list' });
  if (!entries.length) body.append(createEl('p', { className: 'muted', text: 'Brak zapisanych rzutów.' }));
  for (const entry of entries) {
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
  const footer = entries.length
    ? createEl('div', { className: 'button-row' }, [button('Zamknij', closeSheet, 'btn btn-primary'), button('Wyczyść historię', () => { closeSheet(); confirmClearDiceHistory(); }, 'btn btn-danger')])
    : button('Zamknij', closeSheet, 'btn btn-primary btn-block');
  openSheet({ title: 'Historia rzutów', body, footer });
}
function performFateRoll() {
  let result;
  try { result = rollDice({ count: 1, sides: 6 }); }
  catch (error) { showToast(error.message, 'error'); return null; }
  const verdict = result.total >= 4 ? 'Wynik zwykle sprzyja postaciom.' : 'Wynik zwykle oznacza niepomyślny obrót.';
  const summary = `Kość Losu: ${result.total} (1k6)`;
  addDiceHistory({ type: 'dice', label: 'Kość Losu', summary, notation: '1k6', result: result.total, details: verdict });
  renderDiceResult(result.total, `Kość Losu · ${verdict}`, { sides: 6 });
  announce(`${summary}. ${verdict}`);
  return result;
}

function openDualWeaponsSheet() {
  const weapons = heldWeaponItems();
  if (weapons.length < 2) {
    const body = createEl('div', { className: 'sheet-list' }, [
      createEl('p', { text: 'Aby użyć tej procedury, postać musi trzymać co najmniej dwie bronie.' }),
      createEl('p', { className: 'muted small', text: 'Przygotuj broń w Ekwipunku albo w panelu Walka. Aplikacja nie wybiera schowanych przedmiotów automatycznie.' })
    ]);
    openSheet({ title: 'Dwie bronie', body, footer: button('Wróć do gry', closeSheet, 'btn btn-primary btn-block') });
    return;
  }
  const options = weapons.map(weapon => [weapon.id, `${weapon.name} · ${formatDamageFormula(weapon.damageFormula)}`]);
  const first = selectInput(options, weapons[0].id);
  const second = selectInput(options, weapons[1].id);
  const body = createEl('div', { className: 'form-grid' }, [
    createEl('p', { text: state.conditions.panicked ? 'Panika osłabia oba ataki do k4. Rzuć obiema kośćmi i zachowaj wyższy wynik.' : 'Rzuć kośćmi obu przygotowanych broni i zachowaj pojedynczy najwyższy wynik.' }),
    createEl('div', { className: 'form-grid two' }, [field('Pierwsza broń', first), field('Druga broń', second)])
  ]);
  const roll = button('Rzuć obiema', () => {
    if (first.value === second.value) { showToast('Wybierz dwie różne bronie.', 'error'); return; }
    const firstWeapon = weapons.find(weapon => weapon.id === first.value);
    const secondWeapon = weapons.find(weapon => weapon.id === second.value);
    if (!firstWeapon || !secondWeapon) { showToast('Wybrane bronie nie są już dostępne.', 'error'); return; }
    const firstFormula = state.conditions.panicked ? parseDamageFormulaNotation('d4') : firstWeapon.damageFormula;
    const secondFormula = state.conditions.panicked ? parseDamageFormulaNotation('d4') : secondWeapon.damageFormula;
    const firstResult = rollDamageFormula(firstFormula);
    const secondResult = rollDamageFormula(secondFormula);
    const high = Math.max(firstResult.total, secondResult.total);
    const notation = `${formatDamageFormula(firstFormula)}+${formatDamageFormula(secondFormula)}`;
    const details = `${firstWeapon.name}: ${firstResult.total} · ${secondWeapon.name}: ${secondResult.total} → najwyższy ${high}`;
    const summary = `Dwie bronie: ${high} — ${firstWeapon.name} i ${secondWeapon.name}`;
    addDiceHistory({ type: 'damage', label: 'Dwie bronie', summary, notation, result: high, details });
    closeSheet();
    requestAnimationFrame(() => openResultSheet('Dwie bronie', high, 'Najwyższy wynik', [details, 'Atak trafia automatycznie. Warden odejmuje pancerz celu i rozpatruje skutki.'], 'success', { sides: firstResult.total >= secondResult.total ? firstResult.rolls[0]?.sides : secondResult.rolls[0]?.sides }));
    announce(`${summary}. ${details}.`);
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Dwie bronie', body, footer: roll });
}

function openMultipleAttackersSheet() {
  const notation = textInput('k6, k8, k6', 200);
  const body = createEl('div', { className: 'form-grid' }, [
    createEl('p', { text: 'Wpisz kości oddzielone przecinkami. Aplikacja rzuci wszystkie i zachowa jeden najwyższy wynik.' }),
    field('Kości atakujących', notation, 'Dozwolone: k4, k6, k8, k10, k12.')
  ]);
  const roll = button('Rzuć i zachowaj najwyższy', () => {
    const parsed = parseAttackDiceList(notation.value);
    if (!parsed) { showToast('Wpisz od 1 do 20 kości w formacie k6, k8, k6.', 'error'); return; }
    const results = parsed.map(entry => ({ token: entry.token, value: rollDie(entry.sides) }));
    const high = Math.max(...results.map(result => result.value));
    const details = results.map(result => `${result.token}: ${result.value}`).join(', ');
    const summary = `Wielu atakujących: ${high} — najwyższy wynik`;
    addDiceHistory({ type: 'dice', label: 'Wielu atakujących', summary, notation: parsed.map(entry => entry.token).join('+'), result: high, details });
    closeSheet(); setView('dice'); renderDiceResult(high, `${details} → najwyższy`); announce(`${summary}. ${details}`);
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Wielu atakujących', body, footer: roll });
}

function confirmClearDiceHistory() {
  openConfirmSheet({ title: 'Wyczyść historię rzutów', message: 'Usunąć całą lokalną historię rzutów? Tej operacji nie można cofnąć.', confirmLabel: 'Wyczyść', danger: true, onConfirm: () => { state.diceHistory = []; scheduleSave(); renderDiceView(); showToast('Wyczyszczono historię rzutów.'); } });
}

// ============================================================
// 17. More view and conditions
// ============================================================
function journalDisclosure(label, text) {
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
  const section = createEl('section', { className: 'journal-section session-log-card', attrs: { 'aria-label': 'Sesja' } });
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

function renderMoreView() {
  const root = $('#view-more');
  if (!root) return;
  root.replaceChildren();
  if (!state.initialized) {
    root.append(card([createEl('div', { className: 'card-pad' }, [sectionHead('Dziennik'), createEl('p', { className: 'muted', text: 'Najpierw utwórz lub zaimportuj postać.' }), button('Importuj z Kettlewright', () => $('#importFileInput').click(), 'btn btn-primary btn-block')])]))
    return;
  }

  root.append(renderSessionLogCard());

  const quickNote = createEl('section', { className: 'journal-section quick-note', attrs: { 'aria-labelledby': 'quick-note-title' } }, [
    createEl('div', { className: 'section-heading' }, [
      createEl('h2', { id: 'quick-note-title', text: 'Szybka notatka' }),
      button('Zapisz', openQuickNoteSheet, 'btn btn-primary')
    ]),
    createEl('p', { className: `notes-preview${trimText(state.notes) ? '' : ' muted'}`, text: trimText(state.notes) || 'Zapisz trop, imię albo decyzję, zanim zniknie z rozmowy.' })
  ]);
  root.append(quickNote);

  const recentChanges = safeArray(state.changeHistory).slice(-3).reverse();
  const recent = createEl('section', { className: 'journal-section recent-journal', attrs: { 'aria-labelledby': 'recent-journal-title' } }, [
    createEl('div', { className: 'section-heading' }, [
      createEl('h2', { id: 'recent-journal-title', text: 'Ostatnie wpisy' })
    ])
  ]);
  if (!recentChanges.length) recent.append(createEl('p', { className: 'muted', text: 'Pierwsze zmiany postaci i notatki pojawią się tutaj.' }));
  for (const entry of recentChanges) recent.append(createEl('div', { className: 'journal-entry-row' }, [
    createEl('p', { text: entry.description }),
    createEl('time', { text: formatDateTime(entry.time), dateTime: entry.time })
  ]));
  root.append(recent);

  const identity = createEl('section', { className: 'journal-section dossier-intro' });
  identity.append(sectionHead('Dossier postaci', button('Edytuj dane', openEditIdentitySheet, 'btn btn-quiet btn-ghost')));
  identity.append(createEl('p', { className: 'eyebrow', text: state.identity.background || 'Bez tła' }));
  identity.append(createEl('p', { text: state.identity.backgroundDescription || 'Brak opisu tła.', className: 'muted small wrap-anywhere notes-preview' }));
  root.append(identity);

  const characterData = createEl('section', { className: 'journal-section character-data-card' });
  characterData.append(sectionHead('Karta postaci'));
  characterData.append(createEl('div', { className: 'character-data-actions' }, [
    button('Edytuj statystyki', openEditStatsSheet, 'btn'),
    button('Obrażenia atrybutu', openDirectDamageSheet, 'btn')
  ]));
  const notes = createEl('section', { className: 'journal-section' });
  notes.append(sectionHead('Opis, więzi i omeny', button('Edytuj', openNotesSheet, 'btn btn-quiet btn-ghost')));
  notes.append(
    journalDisclosure('Cechy', state.identity.traits),
    journalDisclosure('Więzi', state.identity.bonds),
    journalDisclosure('Omeny', state.identity.omens),
    journalDisclosure('Notatki', state.notes)
  );
  root.append(notes);

  const scars = createEl('section', { className: 'journal-section' });
  scars.append(sectionHead('Blizny', button('Dodaj', () => openAddScarSheet(), 'btn btn-quiet btn-ghost')));
  if (!state.scars.length) scars.append(createEl('p', { className: 'muted small', text: 'Brak zapisanych Blizn.' }));
  for (const [index, scar] of state.scars.entries()) scars.append(journalDisclosure(`Blizna ${index + 1}`, scar.text));
  root.append(scars);
  root.append(characterData);

  const historyCard = createEl('section', { className: 'journal-section history-card' });
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
  root.append(historyCard);
}

function openConditionsSheet() {
  const body = createEl('div', { className: 'sheet-list' });
  body.append(createEl('p', { className: 'muted small', text: 'Zaznaczaj tylko stany wynikające z fikcji i rozstrzygnięć przy stole. Aktywne stany są widoczne na ekranie głównym.' }));
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

function conditionHelp(key) {
  return {
    deprived: 'Brak kluczowej potrzeby blokuje odzyskiwanie Ochrony, atrybutów i zmęczenia.',
    panicked: '0 Ochrony; brak działania w 1. rundzie; ataki osłabione.',
    criticalDamage: 'Tylko pełzanie; bez pomocy śmierć w ciągu godziny.',
    stabilized: 'Zatrzymuje śmierć, nie usuwa obrażeń krytycznych.',
    paralyzed: 'Skutek ZRE sprowadzonej do 0.',
    delirious: 'Skutek WOL sprowadzonej do 0.'
  }[key] || '';
}

function handleConditionToggle(key, enabled) {
  if (key === 'stabilized' && enabled && !state.conditions.criticalDamage) {
    showToast('Stabilizacja dotyczy postaci z obrażeniami krytycznymi.', 'error');
    return;
  }
  if (key === 'panicked' && enabled) {
    openConfirmSheet({
      title: 'Oznacz panikę',
      message: 'Spanikowana postać ma 0 Ochrony, nie działa w pierwszej rundzie walki, a jej ataki są osłabione. Zastosować stan i ustawić 0 Ochrony?',
      confirmLabel: 'Oznacz panikę i 0 Ochrony',
      danger: true,
      onConfirm: () => commitChange('Oznaczono panikę', next => { next.conditions.panicked = true; next.stats.hp.current = 0; })
    });
    return;
  }
  if (key === 'panicked' && !enabled) {
    openConfirmSheet({
      title: 'Usuń panikę ręcznie',
      message: 'Zwykle panikę usuwa udany rzut obronny WOL jako akcja. Potwierdź ręczne usunięcie tylko wtedy, gdy Warden rozstrzygnął sytuację inaczej. Ochrona nie zostanie przywrócona.',
      confirmLabel: 'Warden rozstrzygnął — usuń panikę',
      onConfirm: () => commitChange('Ręcznie usunięto panikę decyzją Wardena', next => { next.conditions.panicked = false; })
    });
    return;
  }
  if (key === 'criticalDamage' && !enabled) {
    openConfirmSheet({ title: 'Usuń obrażenia krytyczne', message: 'Usunąć stan obrażeń krytycznych? Stabilizacja sama w sobie nie usuwa tego stanu.', confirmLabel: 'Usuń stan', onConfirm: () => commitChange('Usunięto obrażenia krytyczne', next => { next.conditions.criticalDamage = false; next.conditions.stabilized = false; }) });
    return;
  }
  commitChange(`${enabled ? 'Dodano' : 'Usunięto'} stan: ${CONDITION_DEFS.find(([id]) => id === key)?.[1] || key}`, next => { next.conditions[key] = enabled; if (key === 'criticalDamage' && enabled) next.conditions.stabilized = false; });
}

function handleStabilize() {
  openConfirmSheet({ title: 'Stabilizuj postać', message: 'Potwierdź, że postać otrzymała odpowiednią pomoc, np. użyto bandaży. Stabilizacja nie usuwa obrażeń krytycznych.', confirmLabel: 'Oznacz stabilizację', onConfirm: () => commitChange('Postać została ustabilizowana', next => { next.conditions.stabilized = true; }) });
}

function openCustomConditionsSheet() {
  const name = textInput('', 120);
  const list = createEl('div', { className: 'sheet-list' });
  const render = () => {
    list.replaceChildren();
    for (const condition of state.conditions.custom) {
      list.append(createEl('div', { className: 'settings-row' }, [createEl('span', { text: condition.name }), button('Usuń', () => { closeSheet(); commitChange(`Usunięto stan: ${condition.name}`, next => { next.conditions.custom = next.conditions.custom.filter(entry => entry.id !== condition.id); }); }, 'btn btn-quiet btn-danger')]));
    }
    if (!state.conditions.custom.length) list.append(createEl('p', { className: 'muted small', text: 'Brak własnych stanów.' }));
  };
  render();
  const body = createEl('div', { className: 'form-grid' }, [field('Nowy stan', name), button('Dodaj stan', () => { const value = trimText(name.value); if (!value) return; closeSheet(); commitChange(`Dodano stan: ${value}`, next => { next.conditions.custom.push({ id: makeId(), name: value }); }); }, 'btn btn-primary btn-block'), list]);
  openSheet({ title: 'Własne stany', body });
}

function openEditIdentitySheet() {
  const name = textInput(state.identity.name, 200);
  const background = textInput(state.identity.background, 200);
  const description = textarea(state.identity.backgroundDescription, 3000);
  const body = createEl('div', { className: 'form-grid' }, [field('Imię', name), field('Tło / profesja', background), field('Opis tła', description)]);
  const save = button('Zapisz dane podstawowe', () => {
    const value = trimText(name.value);
    if (!value) { showToast('Imię jest wymagane.', 'error'); return; }
    closeSheet();
    commitChange('Zmieniono dane postaci', next => { next.identity.name = value; next.identity.background = trimText(background.value); next.identity.backgroundDescription = description.value; next.isDemo = false; });
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Edytuj postać', body, footer: save });
}

function openQuickNoteSheet(seed = '') {
  const consequence = trimText(seed).slice(0, 200);
  const initialNote = consequence
    ? [trimText(state.notes), `Konsekwencja: ${consequence}`].filter(Boolean).join('\n\n')
    : state.notes;
  const note = textarea(initialNote, 8000);
  const body = createEl('div', { className: 'form-grid' }, [
    field('Notatka z sesji', note, 'Tropy, imiona, obietnice i rzeczy, do których chcesz wrócić.')
  ]);
  const save = button('Zapisz notatkę', () => {
    closeSheet();
    commitChange('Zmieniono szybką notatkę', next => { next.notes = note.value; });
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Szybka notatka', body, footer: save });
}

function openNotesSheet() {
  const traits = textarea(state.identity.traits, 3000);
  const bonds = textarea(state.identity.bonds, 5000);
  const omens = textarea(state.identity.omens, 3000);
  const notes = textarea(state.notes, 8000);
  const body = createEl('div', { className: 'form-grid' }, [field('Wygląd i cechy', traits), field('Więzi', bonds), field('Omeny', omens), field('Notatki', notes)]);
  const save = button('Zapisz notatki', () => { closeSheet(); commitChange('Zmieniono notatki i opis', next => { next.identity.traits = traits.value; next.identity.bonds = bonds.value; next.identity.omens = omens.value; next.notes = notes.value; }); }, 'btn btn-primary btn-block');
  openSheet({ title: 'Notatki i opis', body, footer: save });
}

function openCreateCharacterSheet() {
  const name = textInput('', 200);
  const background = textInput('', 200);
  const hp = numberInput(3, 0, 99);
  const str = numberInput(10, 0, 99);
  const dex = numberInput(10, 0, 99);
  const wil = numberInput(10, 0, 99);
  const body = createEl('div', { className: 'form-grid' }, [field('Imię', name), field('Tło / profesja', background), createEl('div', { className: 'form-grid two' }, [field('Ochrona', hp), field('SIŁ', str)]), createEl('div', { className: 'form-grid two' }, [field('ZRE', dex), field('WOL', wil)])]);
  const create = button('Utwórz postać', () => {
    const value = trimText(name.value);
    if (!value) { showToast('Imię jest wymagane.', 'error'); name.focus(); return; }
    const next = createDefaultState();
    next.initialized = true;
    next.identity.name = value;
    next.identity.background = trimText(background.value);
    next.stats.hp = { current: toInt(hp.value, 0), max: toInt(hp.value, 0) };
    next.stats.str = { current: toInt(str.value, 0), max: toInt(str.value, 0) };
    next.stats.dex = { current: toInt(dex.value, 0), max: toInt(dex.value, 0) };
    next.stats.wil = { current: toInt(wil.value, 0), max: toInt(wil.value, 0) };
    state = next;
    saveNow(); closeSheet(); renderAll(); showToast('Utworzono pustą postać.');
  }, 'btn btn-primary btn-block');
  openSheet({ title: 'Nowa postać', body, footer: create });
}

function openImportReport(importData) {
  const body = createEl('div', { className: 'sheet-list' });
  body.append(createEl('p', { className: 'muted small wrap-anywhere', text: `${importData.filename} · format: ${importData.type}` }));
  const sections = [
    ['Zaimportowane', importData.report.imported, 'test-pass'],
    ['Wymaga ręcznego sprawdzenia', importData.report.manual, ''],
    ['Nierozpoznane lub zachowane bez interpretacji', Array.from(new Set(importData.report.unrecognized)), ''],
    ['Ostrzeżenia', Array.from(new Set(importData.report.warnings)), 'test-fail'],
    ['Błędy', Array.from(new Set(importData.report.errors)), 'test-fail']
  ];
  for (const [title, entries, tone] of sections) {
    if (!entries.length) continue;
    const block = createEl('div', { className: 'report-block' });
    block.append(createEl('h3', { text: title, className: tone }));
    const list = createEl('ul');
    for (const entry of entries) list.append(createEl('li', { text: entry }));
    block.append(list);
    body.append(block);
  }
  if (importData.candidate) {
    const usage = calculateInventoryUsage(importData.candidate.inventory.items, importData.candidate.inventory.fatigue);
    body.append(createEl('div', { className: 'report-block' }, [createEl('h3', { text: 'Podsumowanie' }), createEl('p', { text: `${importData.candidate.identity.name} · ${importData.candidate.identity.background || 'bez tła'} · ${usage.total}/10 miejsc` })]));
  }
  const buttons = createEl('div', { className: 'button-row' }, [button('Anuluj', () => { pendingImport = null; closeSheet(); }, 'btn btn-ghost')]);
  buttons.append(button('Nadpisz kartę importem', () => {
    if (!importData.candidate || importData.report.errors.length) return;
    openConfirmSheet({ title: 'Nadpisz aktywną kartę', message: 'Import zastąpi bieżącą aktywną postać. Pobierz wcześniej kopię zapasową, jeśli chcesz ją zachować.', confirmLabel: 'Nadpisz kartę', danger: true, onConfirm: applyPendingImport });
  }, 'btn btn-primary', { disabled: !importData.candidate || importData.report.errors.length > 0 }));
  openSheet({ title: 'Raport importu', body, footer: buttons, onClose: () => {} });
}

function confirmClearChangeHistory() {
  openConfirmSheet({ title: 'Wyczyść historię zmian', message: 'Usunąć historię zmian i możliwość cofania? Aktualny stan postaci pozostanie bez zmian.', confirmLabel: 'Wyczyść historię', danger: true, onConfirm: () => { state.changeHistory = []; scheduleSave(); renderAll(); showToast('Wyczyszczono historię zmian.'); } });
}

function openResetSheet() {
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

// ============================================================
// 18. Developer tests
// ============================================================
function runDeveloperTests() {
  const results = [];
  const test = (name, fn) => {
    try { fn(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.message }); }
  };
  const assert = (condition, message = 'Warunek nie został spełniony') => { if (!condition) throw new Error(message); };
  const base = createDefaultState();
  base.stats.hp = { current: 5, max: 5 };
  base.stats.str = { current: 10, max: 10 };

  const harrowFixture = {
    armor:'1', background:'Fieldwarden', deprived:true, dexterity:14, dexterity_max:14, gold:11, hp:4, hp_max:4,
    name:'Fixture Fieldwarden', panicked:true, strength:14, strength_max:14, willpower:13, willpower_max:13,
    containers:[{id:0,name:'Main',slots:10}],
    items:[
      {id:'letter-a',location:0,name:'Letter',description:'Anonymized petty item.',tags:['petty'],petty:[]},
      {id:'crop',location:0,name:'Diseased Crop',description:'Anonymized item with uses.',tags:['uses'],uses:6},
      {id:'armor',location:0,name:'Brigandine',description:'',tags:['1 Armor','bulky'],'1 Armor,bulky':[]},
      {id:'sling',location:0,name:'Sling',description:'',tags:['d6'],d6:[]},
      {id:'fatigue',location:0,name:'Fatigue',tags:[],editable:false}
    ]
  };
  const fletchwindFixture = {
    armor:'1', background:'Fletchwind', deprived:false, dexterity:14, dexterity_max:14, gold:11, hp:3, hp_max:3,
    name:'Fixture Fletchwind', panicked:false, strength:12, strength_max:12, willpower:9, willpower_max:9,
    containers:[{id:0,name:'Main',slots:10}],
    items:[
      {id:'bow',location:0,name:'Wych Elm',description:'Anonymized bow.',tags:['d6','bulky'],'d6,bulky':[]},
      {id:'knife',location:0,name:'Serrated Knife',description:'',tags:['d6'],d6:[]},
      {id:'leather',location:0,name:'Boiled Leather',description:'',tags:['1 Armor'],'1 Armor':[]},
      {id:'salve',location:0,name:'Heartroot Salve',description:'Restores 1d4 STR.',tags:['uses'],uses:1}
    ]
  };

  test('1. Pancerz zatrzymuje wszystkie obrażenia', () => { const r = calculateDamage(base, 2, 3); assert(r.damageAfterArmor === 0 && r.hpAfter === 5 && r.strAfter === 10); });
  test('2. Obrażenia mniejsze od Ochrony', () => { const r = calculateDamage(base, 3, 0); assert(r.hpAfter === 2 && r.strAfter === 10); });
  test('3. Obrażenia sprowadzają Ochronę dokładnie do zera', () => { const r = calculateDamage(base, 5, 0); assert(r.hpAfter === 0 && r.scarRequired && !r.strengthSaveRequired); });
  test('4. Obrażenia przechodzą na SIŁ', () => { const r = calculateDamage(base, 8, 0); assert(r.hpAfter === 0 && r.strAfter === 7 && r.strengthSaveRequired); });
  test('5. Kolejne obrażenia przy zerowej Ochronie', () => { const fixture = deepClone(base); fixture.stats.hp.current = 0; const r = calculateDamage(fixture, 3, 0); assert(r.strAfter === 7 && r.strengthSaveRequired); });
  test('6. SIŁ sprowadzona do zera', () => { const r = calculateDamage(base, 15, 0); assert(r.strAfter === 0 && r.strengthZero); });
  test('7. Naturalne 1 w rzucie obronnym', () => { assert(resolveSave(0, 1).success); });
  test('8. Naturalne 20 w rzucie obronnym', () => { assert(!resolveSave(20, 20).success); });

  test('9. Sukces wychodzenia z paniki', () => { const fixture = createDefaultState(); fixture.conditions.panicked = true; fixture.stats.wil.current = 12; const r = resolvePanicRecovery(fixture, 8); assert(r.success && !r.panickedAfter); });
  test('10. Porażka wychodzenia z paniki', () => { const fixture = createDefaultState(); fixture.conditions.panicked = true; fixture.stats.wil.current = 8; const r = resolvePanicRecovery(fixture, 15); assert(!r.success && r.panickedAfter); });
  test('11. Naturalne 1 i 20 przy panice', () => { const fixture = createDefaultState(); fixture.conditions.panicked = true; fixture.stats.wil.current = 10; assert(resolvePanicRecovery(fixture, 1).success); assert(!resolvePanicRecovery(fixture, 20).success); });
  test('12. Opanowanie paniki nie przywraca Ochrony', () => { const fixture = createDefaultState(); fixture.conditions.panicked = true; fixture.stats.hp.current = 0; fixture.stats.wil.current = 12; const r = resolvePanicRecovery(fixture, 5); applyPanicRecoveryMutation(fixture, r); assert(!fixture.conditions.panicked && fixture.stats.hp.current === 0); });

  test('13. Pełne 10 miejsc', () => { const usage = calculateInventoryUsage(Array.from({ length: 10 }, (_, index) => makeItem({ id:`i${index}`, slots:1 })), []); assert(usage.total === 10); });
  test('14. Przedmiot nieporęczny zajmuje dwa miejsca', () => { assert(calculateInventoryUsage([makeItem({ slots:2 })], []).total === 2); });
  test('15. Drobiazg zajmuje zero miejsc', () => { assert(calculateInventoryUsage([makeItem({ slots:0 })], []).total === 0); });
  test('16. Dodanie zmęczenia przy 9/10 prowadzi do 10/10', () => { const fixture = createDefaultState(); fixture.inventory.items = Array.from({ length: 9 }, (_, index) => makeItem({ id:`pack-${index}`, slots:1 })); const next = deepClone(fixture); next.inventory.fatigue.push(makeFatigue()); assert(calculateInventoryUsage(next.inventory.items, next.inventory.fatigue).total === 10); });
  test('17. Pełny ekwipunek: upuszczenie przedmiotu i zmęczenie są atomowe', () => { const fixture = createDefaultState(); fixture.initialized = true; fixture.stats.hp.current = 3; fixture.inventory.items = [makeItem({ id:'drop', name:'Drop', slots:1 }), ...Array.from({ length: 9 }, (_, index) => makeItem({ id:`rest-${index}`, slots:1 }))]; const plan = planFatigueWithDroppedItem(fixture, 'drop', makeFatigue({ id:'fatigue-test' })); assert(plan.valid && !plan.next.inventory.items.some(item => item.id === 'drop') && plan.next.inventory.fatigue.length === 1 && plan.afterUsage.total === 10 && plan.hpAfter === 0); });
  test('18. Cofnięcie wspólnej operacji przywraca przedmiot i usuwa zmęczenie', () => { const fixture = createDefaultState(); fixture.initialized = true; fixture.inventory.items = [makeItem({ id:'drop', slots:1 }), ...Array.from({ length: 9 }, (_, index) => makeItem({ id:`rest-${index}`, slots:1 }))]; const snapshot = snapshotForHistory(fixture); const plan = planFatigueWithDroppedItem(fixture, 'drop', makeFatigue({ id:'fatigue-test' })); applySnapshot(fixture, snapshotForHistory(plan.next)); applySnapshot(fixture, snapshot); assert(fixture.inventory.items.some(item => item.id === 'drop') && fixture.inventory.fatigue.length === 0); });
  test('19. Drobiazg nie może zwolnić miejsca na zmęczenie', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'petty', slots:0 }), ...Array.from({ length: 10 }, (_, index) => makeItem({ id:`full-${index}`, slots:1 }))]; assert(!droppableInventoryItems(fixture).some(item => item.id === 'petty')); assert(!planFatigueWithDroppedItem(fixture, 'petty').valid); });
  test('20. Brak przedmiotu do upuszczenia nie zmienia danych', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'petty', slots:0 })]; fixture.inventory.fatigue = Array.from({ length: 10 }, (_, index) => makeFatigue({ id:`fatigue-${index}` })); const before = JSON.stringify(fixture); assert(droppableInventoryItems(fixture).length === 0); assert(!planFatigueWithDroppedItem(fixture, 'petty').valid); assert(JSON.stringify(fixture) === before); });

  test('21. Migracja damageDie d6 do damageFormula', () => { const fixture = createDefaultState(); fixture.schemaVersion = 1; fixture.inventory.items = [{ id:'old', name:'Old', slots:1, damageDie:'d6', uses:{current:null,max:null}, traits:[], sourceExtras:{} }]; const migrated = sanitizeLoadedState(fixture); assert(migrated.schemaVersion === 3 && formatDamageFormula(migrated.inventory.items[0].damageFormula) === 'd6' && migrated.inventory.items[0].sourceExtras.legacyDamageDie === 'd6'); });
  test('22. Import Kettlewright rozpoznaje d6+d6', () => { const fixture = deepClone(fletchwindFixture); fixture.items[0].tags = ['d6+d6','bulky']; const r = normalizeKettlewright(fixture); assert(formatDamageFormula(r.candidate.inventory.items[0].damageFormula) === 'd6+d6' && r.candidate.inventory.items[0].damageFormula.keep === 'highest'); });
  test('23. Rzut dwiema kośćmi zachowuje najwyższy wynik', () => { const values = [2,5]; const result = rollDamageFormula(parseDamageFormulaNotation('d6+d6'), (_sides,index) => values[index]); assert(result.total === 5 && result.rolls.length === 2); });
  test('24. Formuła blast jest serializowalna', () => { const formula = parseDamageFormulaNotation('d8+d8', true); const copy = JSON.parse(JSON.stringify(formula)); assert(copy.blast && copy.keep === 'highest' && formatDamageFormula(copy) === 'd8+d8'); });

  test('25. Harrow fixture importuje panikę, pozbawienie, fatigue, petty, bulky, pancerz i użycia', () => { const r = normalizeKettlewright(harrowFixture); const brigandine = r.candidate.inventory.items.find(item => item.name === 'Brigandine'); const crop = r.candidate.inventory.items.find(item => item.name === 'Diseased Crop'); assert(r.candidate.conditions.panicked && r.candidate.conditions.deprived && r.candidate.inventory.fatigue.length === 1 && brigandine.slots === 2 && brigandine.armorValue === 1 && crop.uses.current === 6 && crop.uses.max === null); });
  test('26. Fletchwind fixture importuje broń, pancerz i przedmiot przywracający atrybut', () => { const r = normalizeKettlewright(fletchwindFixture); assert(r.candidate.inventory.items.some(item => item.damageFormula) && r.candidate.inventory.items.some(item => item.armorValue === 1) && r.candidate.inventory.items.some(item => /1d4 STR/.test(item.description))); });
  test('27. Import uses zachowuje nieznane maksimum', () => { const r = normalizeKettlewright(harrowFixture); const item = r.candidate.inventory.items.find(entry => entry.name === 'Diseased Crop'); assert(item.uses.current === 6 && item.uses.max === null && formatUses(item.uses) === '6 użyć'); assert(r.report.manual.some(message => /Maksymalna liczba użyć/.test(message))); });
  test('28. Import prawidłowego JSON Kettlewright', () => { const r = normalizeKettlewright(fletchwindFixture); assert(r.candidate?.identity.name === 'Fixture Fletchwind' && !r.report.errors.length); });
  test('29. Import uszkodzonego JSON', () => { const r = parseImportText('{nie'); assert(r.type === 'invalid' && r.report.errors.length === 1); });
  test('30. Import nieznanej nowszej wersji', () => { const fixture = createDefaultState(); fixture.schemaVersion = 999; const r = parseImportText(JSON.stringify(fixture)); assert(!r.candidate && r.report.errors.length); });
  test('31. Odczyt starego zapisu schemaVersion 1', () => { const fixture = createDefaultState(); fixture.schemaVersion = 1; fixture.inventory.items = [makeItem({ name:'Legacy' })]; fixture.inventory.items[0].damageDie = 'd8'; delete fixture.inventory.items[0].damageFormula; const copy = sanitizeLoadedState(JSON.parse(JSON.stringify(fixture))); assert(copy.schemaVersion === 3 && formatDamageFormula(copy.inventory.items[0].damageFormula) === 'd8'); });
  test('32. Eksport i ponowny import schemaVersion 3', () => { const fixture = createDemoState(); const r = parseImportText(JSON.stringify(fixture)); assert(r.type === 'backup' && r.candidate?.schemaVersion === 3 && r.candidate?.identity.name === fixture.identity.name); });
  test('33. Długie i niebezpieczne teksty są zachowywane jako dane', () => { const payload = '<img src=x onerror=alert(1)>'.repeat(20); const fixture = { name:payload, hp:1, hp_max:1, strength:1, strength_max:1, dexterity:1, dexterity_max:1, willpower:1, willpower_max:1, items:[] }; const r = normalizeKettlewright(fixture); assert(r.candidate.identity.name === payload); });
  test('34. Dokument nie ładuje zasobów z obcego originu', () => { const external = $$('script[src], link[rel="stylesheet"][href]').filter(el => new URL(el.src || el.href, location.href).origin !== location.origin); assert(external.length === 0); });
  test('35. Efektywny pancerz jest ograniczony do 3', () => { const fixture = createDemoState(); fixture.inventory.items = [makeItem({ armorValue:2, carryState:'worn' }), makeItem({ armorValue:2, carryState:'held' })]; assert(deriveArmor(fixture).effective === 3); });
  test('36. Zdarzenie kliknięcia nie jest traktowane jako wymuszony wynik k20', () => { assert(normalizeForcedD20({ type: 'click' }) === null); assert(normalizeForcedD20(1) === 1); assert(normalizeForcedD20(20) === 20); assert(normalizeForcedD20(21) === null); });
  test('37. Pierwsza runda ZRE rozpoznaje sukces i porażkę', () => { const fixture = createDefaultState(); fixture.stats.dex.current = 11; assert(resolveFirstRoundDex(fixture, 8).canAct); assert(!resolveFirstRoundDex(fixture, 16).canAct); });
  test('38. Panika blokuje działanie w pierwszej rundzie', () => { const fixture = createDefaultState(); fixture.stats.dex.current = 20; fixture.conditions.panicked = true; const result = resolveFirstRoundDex(fixture, 1); assert(result.blockedByPanic && !result.canAct); });
  test('39. Atak bez broni korzysta wyłącznie z k4', () => { assert(normalizeForcedDie(4, 4) === 4); assert(normalizeForcedDie(5, 4) === null); });
  test('40. Podmuch wykonuje osobny rzut dla każdego celu', () => { const values = [2, 5, 3]; let i = 0; const results = rollBlastTargets(parseDamageFormulaNotation('d6', true), 3, () => values[i++]); assert(results.length === 3 && results.map(entry => entry.total).join(',') === '2,5,3'); });
  test('41. Podmuch z d6+d6 zachowuje najwyższy wynik osobno', () => { const values = [2,5,6,1]; let i = 0; const results = rollBlastTargets(parseDamageFormulaNotation('d6+d6', true), 2, () => values[i++]); assert(results[0].total === 5 && results[1].total === 6); });
  test('42. Użycie zasobu zmniejsza licznik i nie schodzi poniżej zera', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'resource', uses:{current:1,max:3} })]; const plan = planItemUse(fixture, 'resource'); assert(plan.valid && plan.after === 0); applyItemUseMutation(fixture, 'resource'); assert(fixture.inventory.items[0].uses.current === 0 && !planItemUse(fixture, 'resource').valid); });
  test('43. Aktywny ekwipunek obejmuje tylko noszone i trzymane przedmioty', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'held', carryState:'held' }), makeItem({ id:'worn', carryState:'worn' }), makeItem({ id:'stored', carryState:'stored' }), makeItem({ id:'spent', carryState:'spent' })]; assert(activeEquipmentItems(fixture).map(item => item.id).join(',') === 'held,worn'); });
  test('44. Helper Blizn wskazuje właściwy wpis i bezpiecznie odrzuca brak wpisu', () => { assert(getScarGuide(3).title === 'Powalony'); assert(getScarGuide(13) === null); assert(resolveScarHelperRoll('broken-bone', 6) === 'Czaszka'); });
  test('45. Karta przedmiotu nie duplikuje akcji użycia', () => { const item = makeItem({ damageFormula:parseDamageFormulaNotation('d6'), uses:{current:2,max:3}, carryState:'held' }); assert(getItemPrimaryActionKinds(item).join(',') === 'roll,use,more'); assert(getItemPrimaryActionKinds(makeItem()).join(',') === 'more'); });
  test('46. Pulpit nie duplikuje nawigacji do Kości', () => { const labels = ['Obrażenia','Pierwsza runda','Odpoczynek','Zmęczenie']; assert(labels.length === 4 && !labels.includes('Kości') && !document.querySelector('#quickDiceBtn')); });
  test('47. Dynamiczne ikony używają przestrzeni nazw SVG', () => { assert(uiIcon('plus').namespaceURI === 'http://www.w3.org/2000/svg'); });
  test('48. Każdy typ kości ma własną ikonę', () => { const signatures = DICE_SIDES.map(side => dieIcon(side).innerHTML); assert(new Set(signatures).size === DICE_SIDES.length); });
  test('49. Sytuacje w walce mają opis użycia', () => { const definitions = combatScenarioDefinitions(); assert(definitions.length === 6 && definitions.every(entry => entry.description && entry.notation)); });
  test('50. Sytuacje w walce nie są oznaczone jako główne akcje', () => { renderDiceView(); assert(!$('#view-dice .combat-scenarios .btn-primary')); });
  test('51. Ochrona ma osobny, wyjaśniający workflow', () => { assert(typeof openProtectionSheet === 'function' && combatScenarioDefinitions().every(entry => entry.title !== 'Pierwsza runda')); });
  test('52. Wspólny animator kości respektuje reduced motion', () => { assert(typeof animateDiceResult === 'function' && typeof shouldReduceMotion === 'function'); });
  test('53. Rzuty w panelach używają wspólnego animatora', () => { assert(openResultSheet.toString().includes('animateDiceResult') && performCriticalStrengthSave.toString().includes('animateDiceResult')); });
  test('54. Kość Losu prezentuje pojedynczy wynik', () => { assert((performFateRoll.toString().match(/renderDiceResult/g) || []).length === 1 && !performFateRoll.toString().includes('performRoll(')); });

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
  test('65. Co teraz priorytetyzuje obrażenia krytyczne przed Paniką', () => { const fixture = createDemoState(); fixture.conditions.criticalDamage = true; fixture.conditions.panicked = true; assert(sessionPromptFor(fixture)?.id === 'critical-damage'); });
  test('66. Pełny ekwipunek proponuje ustawienie Ochrony na 0', () => { const fixture = createDefaultState(); fixture.initialized = true; fixture.stats.hp.current = 3; fixture.inventory.items = Array.from({ length: 10 }, (_, index) => makeItem({ id:`full-${index}`, slots:1 })); assert(sessionPromptFor(fixture)?.id === 'full-inventory'); });
  test('67. Dziennik nie zawiera ustawień technicznych', () => { const source = renderMoreView.toString(); assert(source.includes('Dossier postaci') && !source.includes('Dane i kopie zapasowe') && !source.includes('Testy deweloperskie')); });
  test('68. Ustawienia i dane są dostępne z nagłówka', () => { assert(Boolean($('#appSettingsBtn')) && typeof openAppSettingsSheet === 'function' && $('#nav-more')?.textContent.includes('Dziennik')); });
  test('69. Skróty sytuacji w walce są pełnymi zdaniami', () => { const definitions = combatScenarioDefinitions(); assert(definitions.find(entry => entry.id === 'blast').description === 'Osobny rzut dla każdego celu.' && definitions.find(entry => entry.id === 'dual').description === 'Rzuć obiema. Zachowaj wyższą.' && definitions.find(entry => entry.id === 'multiple').description === 'Rzuć wszystkie. Zachowaj najwyższą.'); });
  test('70. Grupowanie ekwipunku zachowuje ustaloną kolejność sekcji', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'held', carryState:'held' }), makeItem({ id:'worn', carryState:'worn' }), makeItem({ id:'stored', carryState:'stored' }), makeItem({ id:'spent', carryState:'spent' }), makeItem({ id:'other', carryState:'legacy' })]; fixture.inventory.fatigue = [makeFatigue({ id:'fatigue' })]; assert(groupInventoryEntries(fixture).map(group => group.id).join(',') === 'held,worn,stored,fatigue,spent,other'); });
  test('71. Nieznany sposób noszenia trafia do grupy Inne', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'legacy', carryState:'legacy-state' })]; const group = groupInventoryEntries(fixture)[0]; assert(group.id === 'other' && group.entries[0].entry.id === 'legacy'); });
  test('72. Grupowanie nie mutuje danych postaci', () => { const fixture = createDemoState(); const before = JSON.stringify(fixture); groupInventoryEntries(fixture); assert(JSON.stringify(fixture) === before); });
  test('73. Nagłówki grup sumują zajmowane miejsca', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'a', slots:0, carryState:'held' }), makeItem({ id:'b', slots:2, carryState:'held' })]; fixture.inventory.fatigue = [makeFatigue({ id:'f' })]; const groups = groupInventoryEntries(fixture); assert(groups.find(group => group.id === 'held').slots === 2 && groups.find(group => group.id === 'fatigue').slots === 1); });
  test('74. Przesuwanie działa wyłącznie wewnątrz grupy', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'held-a', carryState:'held' }), makeItem({ id:'stored', carryState:'stored' }), makeItem({ id:'held-b', carryState:'held' })]; assert(moveItemWithinGroup(fixture, 'held-b', -1)); assert(fixture.inventory.items.map(item => item.id).join(',') === 'held-b,stored,held-a'); assert(!moveItemWithinGroup(fixture, 'stored', -1)); });
  test('75. Zmiana sposobu noszenia aktualizuje automatyczny pancerz', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'armor', armorValue:1, carryState:'worn' })]; assert(deriveArmor(fixture).effective === 1); fixture.inventory.items[0].carryState = 'stored'; assert(deriveArmor(fixture).effective === 0); });
  test('76. Pełna kopia zachowuje wszystkie dane kompaktowego wiersza', () => { const fixture = createDefaultState(); fixture.initialized = true; fixture.inventory.items = [makeItem({ id:'detail', name:'Detal', description:'Opis', notes:'Notatka', slots:2, category:'broń', damageFormula:parseDamageFormulaNotation('d8+d8', true), armorValue:1, uses:{current:2,max:4}, carryState:'held', traits:['nieporęczny','rzadki'] })]; const parsed = parseImportText(JSON.stringify(buildBackupPayload(fixture))); const item = parsed.candidate?.inventory.items[0]; assert(item?.description === 'Opis' && item.notes === 'Notatka' && item.slots === 2 && item.damageFormula.blast && item.uses.current === 2 && item.traits.length === 2); });

  test('77. Migracja schemaVersion 2 dodaje pusty log sesji', () => { const fixture = createDemoState(); fixture.schemaVersion = 2; delete fixture.sessionLog; const migrated = sanitizeLoadedState(fixture); assert(migrated.schemaVersion === 3 && migrated.sessionLog.active === null && migrated.sessionLog.archive.length === 0); });
  test('78. Nie można rozpocząć drugiej aktywnej sesji', () => { const fixture = createDemoState(); assert(startSessionOn(fixture, 'Pierwsza', '2026-01-01T10:00:00.000Z')); assert(!startSessionOn(fixture, 'Druga', '2026-01-01T11:00:00.000Z')); });
  test('79. Zdarzenia są dopisywane wyłącznie do aktywnej sesji', () => { const fixture = createDemoState(); assert(!appendSessionEvent(fixture, { summary:'Bez sesji' })); startSessionOn(fixture, 'Test'); appendSessionEvent(fixture, { type:'inventory', summary:'Dodano przedmiot' }); assert(fixture.sessionLog.active.events.length === 2 && fixture.sessionLog.active.events[1].type === 'inventory'); });
  test('80. Zakończenie przenosi sesję do archiwum z podsumowaniem', () => { const fixture = createDemoState(); startSessionOn(fixture, 'Ruiny', '2026-01-01T10:00:00.000Z'); appendSessionEvent(fixture, { type:'save', summary:'Rzut WOL' }); const ended = finishSessionOn(fixture, 'Odnaleziono wyjście.', '2026-01-01T12:00:00.000Z'); assert(!fixture.sessionLog.active && fixture.sessionLog.archive[0].id === ended.id && ended.summary === 'Odnaleziono wyjście.' && ended.events.at(-1).summary === 'Zakończono sesję'); });
  test('81. Log ogranicza liczbę zdarzeń i archiwalnych sesji', () => { const fixture = createDemoState(); startSessionOn(fixture, 'Limit'); for (let index = 0; index < SESSION_EVENT_LIMIT + 10; index++) appendSessionEvent(fixture, { summary:`Zdarzenie ${index}` }); assert(fixture.sessionLog.active.events.length === SESSION_EVENT_LIMIT); finishSessionOn(fixture); fixture.sessionLog.archive = Array.from({ length: SESSION_ARCHIVE_LIMIT + 5 }, (_, index) => makeSession({ id:`s${index}`, title:`S${index}`, startedAt:'2026-01-01T10:00:00.000Z', endedAt:'2026-01-01T11:00:00.000Z' })); assert(normalizeSessionLog(fixture.sessionLog).archive.length === SESSION_ARCHIVE_LIMIT); });
  test('82. Undo nie usuwa logu sesji ze snapshotu postaci', () => { const fixture = createDemoState(); startSessionOn(fixture, 'Snapshot'); appendSessionEvent(fixture, { summary:'Zapisane zdarzenie' }); const snapshot = snapshotForHistory(fixture); fixture.stats.gold = 99; applySnapshot(fixture, snapshot); assert(fixture.sessionLog.active.events.some(event => event.summary === 'Zapisane zdarzenie')); });
  test('83. Pełna kopia zachowuje aktywne i zakończone sesje', () => { const fixture = createDemoState(); startSessionOn(fixture, 'Pierwsza'); appendSessionEvent(fixture, { type:'dice', summary:'Rzut k6' }); finishSessionOn(fixture, 'Koniec'); startSessionOn(fixture, 'Druga'); const parsed = parseImportText(JSON.stringify(buildBackupPayload(fixture))); assert(parsed.candidate?.schemaVersion === 3 && parsed.candidate.sessionLog.active.title === 'Druga' && parsed.candidate.sessionLog.archive[0].summary === 'Koniec'); });
  test('84. Raport Markdown zawiera metadane, podsumowanie i zdarzenia', () => { const fixture = createDemoState(); const session = startSessionOn(fixture, 'Raport', '2026-01-01T10:00:00.000Z'); appendSessionEvent(fixture, { type:'damage', summary:'Otrzymano obrażenia', details:'Ochrona 4 → 1' }); const ended = finishSessionOn(fixture, 'Bezpieczny powrót', '2026-01-01T12:00:00.000Z'); const report = sessionReportMarkdown(ended, fixture.identity.name); assert(report.includes('# Raport') && report.includes('Bezpieczny powrót') && report.includes('Otrzymano obrażenia') && report.includes('Mara Ciernista')); });

  test('85. Specyfikacja powtórzenia zwykłego rzutu jest normalizowana', () => { const spec = normalizeDiceRepeatSpec({ kind:'roll', label:'Test', config:{ count:2, sides:6, modifier:1, keepHighest:true } }); assert(spec.kind === 'roll' && spec.label === 'Test' && spec.config.count === 2 && spec.config.sides === 6 && spec.config.modifier === 1 && spec.config.keepHighest); });
  test('86. Nieznany typ powtórzenia jest odrzucany', () => { assert(normalizeDiceRepeatSpec({ kind:'unknown' }) === null); });
  test('87. Starszy wpis bez repeat pozostaje bezpieczny i niepowtarzalny', () => { assert(!canRepeatDiceEntry({ type:'dice', summary:'Stary rzut' })); });
  test('88. Typy historii rozróżniają obronę, obrażenia i podmuch', () => { assert(diceEntryTypeLabel({type:'save'}) === 'Obrona' && diceEntryTypeLabel({type:'damage'}) === 'Obrażenia' && diceEntryTypeLabel({type:'blast'}) === 'Podmuch'); });
  test('89. Pasek ostatnich rzutów zachowuje kolejność i limit trzech', () => { const fixture = createDefaultState(); fixture.diceHistory = [{id:'a'},{id:'b'},{id:'c'},{id:'d'}]; const before = JSON.stringify(fixture.diceHistory); assert(recentDiceEntries(fixture, 3).map(entry => entry.id).join(',') === 'a,b,c' && JSON.stringify(fixture.diceHistory) === before); });
  test('90. Pełna kopia zachowuje metadane bezpiecznego powtórzenia', () => { const fixture = createDemoState(); recordDiceEntry(fixture, { type:'dice', label:'k8', summary:'k8: 4 (1k8)', notation:'1k8', result:4, repeat:{ kind:'roll', label:'k8', config:{ count:1, sides:8, modifier:0, keepHighest:false } } }); const parsed = parseImportText(JSON.stringify(buildBackupPayload(fixture))); assert(parsed.candidate?.diceHistory[0]?.repeat?.kind === 'roll' && parsed.candidate.diceHistory[0].repeat.config.sides === 8); });

  test('91. Punkt odzyskiwania zachowuje pełny stan sesji i historię kości', () => { const fixture = createDemoState(); startSessionOn(fixture, 'Punkt'); recordDiceEntry(fixture, { type:'dice', summary:'k8: 4', repeat:{ kind:'roll', label:'k8', config:{ count:1, sides:8 } } }); const checkpoint = createRecoveryCheckpointRecord(fixture, 'Test', '2026-01-01T10:00:00.000Z'); assert(checkpoint?.payload.sessionLog.active.title === 'Punkt' && checkpoint.payload.diceHistory[0].repeat.config.sides === 8); });
  test('92. Lista punktów zachowuje trzy najnowsze wpisy', () => { const fixture = createDemoState(); const records = ['01','02','03','04'].reduce((list, day) => addRecoveryCheckpointRecord(list, createRecoveryCheckpointRecord(fixture, `D${day}`, `2026-01-${day}T10:00:00.000Z`)), []); assert(records.length === 3 && records.map(entry => entry.reason).join(',') === 'D04,D03,D02'); });
  test('93. Uszkodzony punkt odzyskiwania jest odrzucany', () => { assert(normalizeRecoveryCheckpoint({ id:'x', createdAt:'2026-01-01T10:00:00.000Z', payload:{ appId:APP_ID } }) === null); });
  test('94. Odtworzenie punktu zwraca niezależną i zwalidowaną kopię', () => { const fixture = createDemoState(); const checkpoint = createRecoveryCheckpointRecord(fixture, 'Kopia', '2026-01-01T10:00:00.000Z'); const restored = recoveryCheckpointState(checkpoint); restored.stats.gold = 999; assert(checkpoint.payload.stats.gold !== 999 && validateState(restored).valid); });
  test('95. Pełna kopia postaci nie osadza lokalnej listy punktów', () => { const payload = buildBackupPayload(createDemoState()); assert(!Object.prototype.hasOwnProperty.call(payload, 'recoveryCheckpoints') && !Object.prototype.hasOwnProperty.call(payload, 'checkpoints')); });
  test('96. Punkty odzyskiwania nie wymagają zmiany schemaVersion postaci', () => { const checkpoint = createRecoveryCheckpointRecord(createDemoState(), 'Schemat', '2026-01-01T10:00:00.000Z'); assert(SCHEMA_VERSION === 3 && checkpoint.schemaVersion === 3 && checkpoint.payload.schemaVersion === 3); });
  test('97. Surowa kopia błędnego zapisu i punkty odzyskiwania używają osobnych kluczy', () => { assert(RECOVERY_KEY !== CHECKPOINTS_KEY && CHECKPOINT_LIMIT === 3); });

  test('98. Dokument ma link pomijający nawigację i fokusowalny główny obszar', () => { const skip = $('.skip-link'); assert(skip?.getAttribute('href') === '#main' && $('#main')?.getAttribute('tabindex') === '-1'); });
  test('99. Dolna nawigacja wskazuje kontrolowane widoki', () => { assert($$('[data-nav]').every(nav => nav.getAttribute('aria-controls') === `view-${nav.dataset.nav}`)); });
  test('100. Metadane widoku aktualizują tytuł dokumentu', () => { const previous = activeView; setView('dice'); assert(document.title.includes('Kości') && VIEW_META.dice.label === 'Kości'); setView(previous); });
  test('101. Dialog ma fokusowalny tytuł i obsługę Visual Viewport', () => { assert($('#sheetTitle')?.getAttribute('tabindex') === '-1' && typeof syncVisualViewport === 'function' && trapSheetFocus.toString().includes('document.activeElement === title')); });
  test('102. CSS i JavaScript są ładowane z lokalnych plików statycznych', () => { assert(Boolean(document.querySelector('link[rel="stylesheet"][href="./styles/app.css"]')) && Boolean(document.querySelector('script[src="./scripts/app.js"]')) && !document.querySelector('style') && !document.querySelector('script:not([src])')); });
  test('103. Przygotowane bronie obejmują wyłącznie przedmioty trzymane', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'held-weapon', damageFormula:parseDamageFormulaNotation('d6'), carryState:'held' }), makeItem({ id:'worn-weapon', damageFormula:parseDamageFormulaNotation('d8'), carryState:'worn' }), makeItem({ id:'stored-weapon', damageFormula:parseDamageFormulaNotation('d10'), carryState:'stored' })]; assert(heldWeaponItems(fixture).map(item => item.id).join(',') === 'held-weapon'); });
  test('104. Dostępne bronie nie obejmują schowanych ani zużytych', () => { const fixture = createDefaultState(); fixture.inventory.items = [makeItem({ id:'held', damageFormula:parseDamageFormulaNotation('d6'), carryState:'held' }), makeItem({ id:'worn', damageFormula:parseDamageFormulaNotation('d8'), carryState:'worn' }), makeItem({ id:'stored', damageFormula:parseDamageFormulaNotation('d10'), carryState:'stored' }), makeItem({ id:'spent', damageFormula:parseDamageFormulaNotation('d12'), carryState:'spent' })]; assert(availableWeaponItems(fixture).map(item => item.id).join(',') === 'held,worn'); });
  test('105. Schowana broń proponuje przygotowanie zamiast szybkiego ataku', () => { const item = makeItem({ damageFormula:parseDamageFormulaNotation('d6'), uses:{current:2,max:3}, carryState:'stored' }); assert(getItemPrimaryActionKinds(item).join(',') === 'prepare,use,more'); item.carryState = 'held'; assert(getItemPrimaryActionKinds(item).join(',') === 'roll,use,more'); });
  test('106. Wariant ataku zachowuje nazwę broni i właściwą kość', () => { const item = makeItem({ name:'Miecz', damageFormula:parseDamageFormulaNotation('d8'), carryState:'held' }); assert(weaponCombatMeta(item) === 'd8' && weaponCombatMeta(item, 'impaired').includes('k4') && weaponCombatMeta(item, 'enhanced').includes('k12')); });
  test('107. Launcher walki udostępnia pierwszą rundę i odwrót', () => { const source = openCombatSheet.toString(); assert(source.includes('performFirstRoundDexSave') && source.includes('openRetreatSheet') && source.includes('openDamageSheet')); });
  test('108. Helper dwóch broni wybiera rzeczywiście trzymane przedmioty', () => { const source = openDualWeaponsSheet.toString(); assert(source.includes('heldWeaponItems') && !source.includes("[['4','k4']")); });
  test('109. Starszy zapis otrzymuje domyślnie włączoną haptykę', () => { const fixture = createDemoState(); delete fixture.settings.hapticsEnabled; assert(sanitizeLoadedState(fixture).settings.hapticsEnabled === true); });
  test('110. Wzorce haptyki są krótkie, a obrót używa delikatnego tyknięcia', () => { const tick = hapticPatternFor('tick'); const roll = hapticPatternFor('roll'); const danger = hapticPatternFor('danger'); assert(tick.join(',') === '6' && roll.reduce((sum, value) => sum + value, 0) < 100 && danger.reduce((sum, value) => sum + value, 0) < 100 && roll.join(',') !== danger.join(',')); });
  test('111. Wynik rozpoznaje typ kości z powtórzenia, obrony i notacji', () => { assert(diceEntrySides({ repeat:{kind:'roll',config:{sides:8}} }) === 8 && diceEntrySides({ repeat:{kind:'save',attrKey:'dex'} }) === 20 && diceEntrySides({ notation:'2d12' }) === 12); });
  test('112. Przestrzenna kość przechowuje wynik, typ i płótno bryły', () => { const die = createResultDie(7, 8); const object = die.querySelector('.result-die-object'); assert(object?.dataset.sides === '8' && object.dataset.value === '7' && die.querySelector('.result-die-value')?.textContent === '7' && Boolean(die.querySelector('canvas.result-die-canvas'))); });
  test('113. Każdy typ wyniku ma rzeczywistą siatkę wielościanu', () => { const meshes = DICE_SIDES.map(createDieMesh); assert(meshes.every(mesh => mesh.vertices.length >= 4 && mesh.faces.length >= 4) && createDieMesh(6).faces.length === 6 && createDieMesh(20).faces.length === 20 && DIE_ROLL_DURATION >= 1000); });
  return results;
}

function openTestResults() {
  const results = runDeveloperTests();
  const passed = results.filter(result => result.pass).length;
  const body = createEl('div', { className: 'sheet-list', dataset: { testsPassed: String(passed), testsTotal: String(results.length) } });
  body.append(createEl('p', { className: passed === results.length ? 'test-pass' : 'test-fail', text: `${passed}/${results.length} testów zakończonych powodzeniem.` }));
  for (const result of results) body.append(createEl('div', { className: 'history-item' }, [createEl('p', { className: result.pass ? 'test-pass' : 'test-fail', text: `${result.pass ? '✓' : '✕'} ${result.name}` }), result.error ? createEl('p', { className: 'small muted', text: result.error }) : null]));
  body.append(createEl('div', { className: 'report-block' }, [
    createEl('h3', { text: 'Kontrole ręczne' }),
    createEl('ul', {}, [
      createEl('li', { text: 'viewporty 320, 375, 390 i 414 px bez poziomego overflow' }),
      createEl('li', { text: 'powiększony tekst 125% bez utraty akcji' }),
      createEl('li', { text: 'iPhone safe areas' }),
      createEl('li', { text: 'klawiatura ekranowa i focus' }),
      createEl('li', { text: 'prefers-reduced-motion' }),
      createEl('li', { text: 'odświeżenie i odzyskanie localStorage' }),
      createEl('li', { text: 'działanie po odłączeniu internetu' })
    ])
  ]));
  openSheet({ title: 'Testy deweloperskie', body, footer: button('Zamknij', closeSheet, 'btn btn-primary btn-block') });
}

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
    runTests: runDeveloperTests,
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
  if (new URLSearchParams(location.search).get('selftest') === '1') {
    const results = runDeveloperTests();
    const passed = results.filter(result => result.pass).length;
    document.documentElement.dataset.testsPassed = String(passed);
    document.documentElement.dataset.testsTotal = String(results.length);
    const marker = createEl('div', { id: 'selftestMarker', className: 'sr-only', text: `SELFTEST ${passed}/${results.length}` });
    marker.dataset.passed = String(passed);
    marker.dataset.total = String(results.length);
    document.body.append(marker);
  }
}

initialize();
