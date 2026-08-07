'use strict';

(() => {
  const SUPPORTED_DICE = Object.freeze([4, 6, 8, 10, 12, 20, 100]);
  const UINT32_RANGE = 0x100000000;
  const originalSecureRandomInt = secureRandomInt;
  const originalAnimateDiceResult = animateDiceResult;
  const originalCreateResultDie = createResultDie;
  const originalRenderDiceView = renderDiceView;
  const originalPerformSave = performSave;
  const originalRepeatDiceEntry = repeatDiceEntry;
  let aggregateAnimationToken = 0;

  function exactInteger(value) {
    if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null;
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (!/^[+-]?\d+$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  function cleanLabel(value, fallback = 'Rzut') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  function normalizeRollConfigStrict(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Nieprawidłowa konfiguracja rzutu.');
    }
    const count = exactInteger(value.count ?? 1);
    const sides = exactInteger(value.sides ?? 6);
    const modifier = exactInteger(value.modifier ?? 0);
    if (count === null || count < 1 || count > 100) {
      throw new Error('Liczba kości musi być liczbą całkowitą od 1 do 100.');
    }
    if (!SUPPORTED_DICE.includes(sides)) {
      throw new Error(`Wybierz obsługiwaną kość: ${SUPPORTED_DICE.map(side => `k${side}`).join(', ')}.`);
    }
    if (modifier === null || modifier < -999 || modifier > 999) {
      throw new Error('Modyfikator musi być liczbą całkowitą od −999 do 999.');
    }
    return {
      count,
      sides,
      modifier,
      keepHighest: Boolean(value.keepHighest) && count > 1
    };
  }

  function tryNormalizeRollConfig(value) {
    try { return normalizeRollConfigStrict(value); }
    catch { return null; }
  }

  function isValidDieFace(value, sides) {
    const face = exactInteger(value);
    const die = exactInteger(sides);
    return SUPPORTED_DICE.includes(die) && face !== null && face >= 1 && face <= die;
  }

  function normalizeVisualSpec(value, fallbackValue = null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const kind = value.kind === 'total' ? 'total' : value.kind === 'die' ? 'die' : null;
    const visualValue = exactInteger(value.value ?? fallbackValue);
    if (!kind || visualValue === null) return null;
    if (kind === 'total') return { kind, value: visualValue, sides: null };
    const sides = exactInteger(value.sides);
    return isValidDieFace(visualValue, sides) ? { kind, value: visualValue, sides } : null;
  }

  function visualForRollResult(result) {
    const canUseSingleFace = result.modifier === 0 && (result.count === 1 || result.keepHighest);
    return canUseSingleFace
      ? { kind: 'die', value: result.base, sides: result.sides }
      : { kind: 'total', value: result.total, sides: null };
  }

  function winningDamageVisual(result) {
    const rolls = Array.isArray(result?.rolls) ? result.rolls : [];
    if (!rolls.length) return { kind: 'total', value: exactInteger(result?.total) ?? 0, sides: null };
    const winner = rolls.reduce((best, current) => current.value > best.value ? current : best, rolls[0]);
    return isValidDieFace(result.total, winner.sides)
      ? { kind: 'die', value: result.total, sides: winner.sides }
      : { kind: 'total', value: exactInteger(result.total) ?? 0, sides: null };
  }

  function visualForHistoryEntry(entry) {
    const recorded = normalizeVisualSpec(entry?.visual, entry?.result);
    if (recorded) return recorded;
    const result = exactInteger(entry?.result);
    if (result === null) return { kind: 'total', value: 0, sides: null };
    const repeat = normalizeDiceRepeatSpec(entry?.repeat);
    if (repeat?.kind === 'roll') {
      const config = repeat.config;
      if (config.modifier === 0 && (config.count === 1 || config.keepHighest) && isValidDieFace(result, config.sides)) {
        return { kind: 'die', value: result, sides: config.sides };
      }
      return { kind: 'total', value: result, sides: null };
    }
    if (repeat?.kind === 'save' && isValidDieFace(result, 20)) return { kind: 'die', value: result, sides: 20 };
    const inferredSides = diceEntrySides(entry);
    return isValidDieFace(result, inferredSides)
      ? { kind: 'die', value: result, sides: inferredSides }
      : { kind: 'total', value: result, sides: null };
  }

  function aggregateIcon() {
    const wrap = createEl('span', { className: 'result-total-icon', attrs: { 'aria-hidden': 'true' } });
    const first = dieIcon(6);
    const second = dieIcon(8);
    first.classList.add('result-total-icon-first');
    second.classList.add('result-total-icon-second');
    wrap.append(first, second);
    return wrap;
  }

  function createAggregateResultVisual(value, rolling = false, tone = 'neutral') {
    return createEl('div', {
      className: `animated-dice-result aggregate-dice-result ${rolling ? 'rolling' : 'settled'}`,
      attrs: { 'data-tone': tone, 'data-result-kind': 'total' }
    }, [
      createEl('div', { className: 'result-total-mark' }, [
        aggregateIcon(),
        createEl('strong', { className: 'result-total-value', text: rolling ? '' : String(value) })
      ])
    ]);
  }

  function renderStaticVisual(container, spec) {
    if (!container) return;
    if (spec.kind === 'total') {
      container.replaceChildren(createAggregateResultVisual(spec.value));
      return;
    }
    container.replaceChildren(createDiceResultVisual(spec.value, '', spec.sides, 'neutral', false));
  }

  function animateAggregateResult(container, value, label, tone = 'neutral') {
    if (!container) return;
    const token = ++aggregateAnimationToken;
    const reduced = shouldReduceMotion();
    const shell = createAggregateResultVisual(value, !reduced, tone);
    const number = shell.querySelector('.result-total-value');
    container.replaceChildren(shell);
    container.setAttribute('aria-busy', reduced ? 'false' : 'true');
    container.setAttribute('aria-label', `${cleanLabel(label)}: ${value}`);
    if (reduced) {
      triggerHaptic(resultHapticForTone(tone));
      return;
    }
    triggerHaptic('roll');
    setTimeout(() => {
      if (token !== aggregateAnimationToken || !shell.isConnected) return;
      number.textContent = String(value);
      shell.classList.remove('rolling');
      shell.classList.add('settled');
      container.setAttribute('aria-busy', 'false');
      triggerHaptic(resultHapticForTone(tone));
    }, 620);
  }

  secureRandomInt = function secureRandomIntValidated(maxExclusive) {
    const range = exactInteger(maxExclusive);
    if (range === null || range <= 0 || range > UINT32_RANGE) {
      throw new Error('Nieprawidłowy zakres losowania.');
    }
    return originalSecureRandomInt(range);
  };

  rollDie = function rollSupportedDie(sides) {
    const normalizedSides = exactInteger(sides);
    if (!SUPPORTED_DICE.includes(normalizedSides)) {
      throw new Error(`Nieobsługiwana kość: k${normalizedSides ?? '?'}.`);
    }
    return secureRandomInt(normalizedSides) + 1;
  };

  rollDice = function rollValidatedDice(config = {}, roller = rollDie) {
    const normalized = normalizeRollConfigStrict(config);
    if (typeof roller !== 'function') throw new Error('Brak prawidłowej funkcji losującej.');
    const rolls = Array.from({ length: normalized.count }, () => {
      const rolled = exactInteger(roller(normalized.sides));
      if (rolled === null || rolled < 1 || rolled > normalized.sides) {
        throw new Error(`Losowanie zwróciło nieprawidłowy wynik dla k${normalized.sides}.`);
      }
      return rolled;
    });
    const base = normalized.keepHighest
      ? Math.max(...rolls)
      : rolls.reduce((sum, current) => sum + current, 0);
    return { ...normalized, rolls, base, total: base + normalized.modifier };
  };

  normalizeDiceRepeatSpec = function normalizeDiceRepeatSpecStrict(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const kind = cleanLabel(value.kind, '');
    if (kind === 'roll') {
      const config = tryNormalizeRollConfig(value.config);
      return config ? { kind, label: cleanLabel(value.label), config } : null;
    }
    if (kind === 'save') {
      const attrKey = cleanLabel(value.attrKey, '');
      return ['str', 'dex', 'wil'].includes(attrKey) ? { kind, attrKey } : null;
    }
    if (kind === 'fate') return { kind };
    return null;
  };

  repeatDiceEntry = function repeatDiceEntryExtended(entry) {
    const repeat = normalizeDiceRepeatSpec(entry?.repeat);
    if (repeat?.kind === 'fate') return performFateRoll();
    return originalRepeatDiceEntry(entry);
  };

  createResultDie = function createResultDieWithoutNotation(value, sides, rolling = false) {
    const scene = originalCreateResultDie(value, sides, rolling);
    scene.querySelector('.result-die-notation')?.remove();
    return scene;
  };

  animateDiceResult = function animateDiceResultValidated(container, value, label, sides = 6, tone = 'neutral', options = {}) {
    const requestedKind = options?.kind === 'total' ? 'total' : options?.kind === 'die' ? 'die' : null;
    const kind = requestedKind || (isValidDieFace(value, sides) ? 'die' : 'total');
    if (kind === 'total') {
      animateAggregateResult(container, exactInteger(value) ?? 0, label, tone);
      return;
    }
    originalAnimateDiceResult(container, value, label, sides, tone);
  };

  renderDiceResult = function renderDiceResultValidated(value, label, options = {}) {
    animateDiceResult(
      document.querySelector('#diceResult'),
      value,
      label,
      options.sides || 6,
      options.tone || 'neutral',
      { kind: options.kind }
    );
  };

  performRoll = function performValidatedRoll(config, label = '') {
    try {
      const result = rollDice(config);
      const notation = `${result.count}k${result.sides}${result.modifier ? (result.modifier > 0 ? `+${result.modifier}` : result.modifier) : ''}`;
      const rolled = result.rolls.join(', ');
      const baseDescription = result.keepHighest
        ? `${rolled} → najwyższy ${result.base}`
        : result.count > 1
          ? `${rolled} → suma ${result.base}`
          : rolled;
      const details = result.modifier
        ? `${baseDescription} ${result.modifier > 0 ? '+' : '−'} ${Math.abs(result.modifier)} = ${result.total}`
        : baseDescription;
      const rollLabel = cleanLabel(label);
      const summary = `${rollLabel}: ${result.total} (${notation})`;
      const visual = visualForRollResult(result);
      addDiceHistory({
        type: 'dice',
        label: rollLabel,
        summary,
        notation,
        result: result.total,
        details,
        rolls: [...result.rolls],
        base: result.base,
        modifier: result.modifier,
        keepHighest: result.keepHighest,
        visual,
        repeat: { kind: 'roll', label: rollLabel, config: { count: result.count, sides: result.sides, modifier: result.modifier, keepHighest: result.keepHighest } }
      });
      renderDiceResult(visual.value, `${rollLabel} · ${details}`, { sides: visual.sides || result.sides, kind: visual.kind });
      announce(`${summary}. Wyniki kości: ${rolled}.`);
      return result;
    } catch (error) {
      showToast(error.message, 'error');
      return null;
    }
  };

  performSave = function performValidatedSave(attrKey, forcedRoll = null, options = {}) {
    if (forcedRoll !== null && !isValidDieFace(forcedRoll, 20)) {
      showToast('Wymuszony wynik k20 musi mieścić się w zakresie 1–20.', 'error');
      return null;
    }
    return originalPerformSave(attrKey, forcedRoll, options);
  };

  openCustomRollSheet = function openValidatedCustomRollSheet() {
    const count = numberInput(1, 1, 100);
    const sides = selectInput(SUPPORTED_DICE.map(side => [String(side), `k${side}`]), '6');
    const modifier = numberInput(0, -999, 999);
    const keep = createEl('input', { type: 'checkbox' });
    const body = createEl('div', { className: 'form-grid' }, [
      createEl('div', { className: 'form-grid two' }, [field('Liczba kości', count), field('Kość', sides)]),
      field('Modyfikator', modifier),
      createEl('label', { className: 'check-row' }, [keep, createEl('span', { text: 'Zachowaj tylko najwyższy wynik' })])
    ]);
    const roll = button('Rzuć', () => {
      let config;
      try {
        config = normalizeRollConfigStrict({ count: count.value, sides: sides.value, modifier: modifier.value, keepHighest: keep.checked });
      } catch (error) {
        showToast(error.message, 'error');
        return;
      }
      closeSheet();
      setView('dice');
      performRoll(config, 'Rzut własny');
    }, 'btn btn-primary btn-block');
    openSheet({ title: 'Rzut własny', body, footer: roll });
  };

  performFateRoll = function performRepeatableFateRoll() {
    let result;
    try { result = rollDice({ count: 1, sides: 6 }); }
    catch (error) { showToast(error.message, 'error'); return null; }
    const verdict = result.total >= 4 ? 'Wynik zwykle sprzyja postaciom.' : 'Wynik zwykle oznacza niepomyślny obrót.';
    const summary = `Kość Losu: ${result.total} (1k6)`;
    const visual = { kind: 'die', value: result.total, sides: 6 };
    addDiceHistory({ type: 'dice', label: 'Kość Losu', summary, notation: '1k6', result: result.total, details: verdict, visual, repeat: { kind: 'fate' } });
    renderDiceResult(result.total, `Kość Losu · ${verdict}`, { sides: 6, kind: 'die' });
    announce(`${summary}. ${verdict}`);
    return result;
  };

  function winningRoll(result) {
    return result.rolls.reduce((best, current) => current.value > best.value ? current : best, result.rolls[0]);
  }

  openItemDamageResultSheet = function openCorrectItemDamageResultSheet(item, result, options = {}) {
    const mode = options.mode || (options.impaired === true ? 'impaired' : 'normal');
    const modeLabel = mode === 'impaired' ? 'Atak osłabiony' : mode === 'enhanced' ? 'Atak wzmocniony' : 'Atak trafia automatycznie';
    const notation = mode === 'impaired' ? 'k4' : mode === 'enhanced' ? 'k12' : result.notation;
    const visual = winningDamageVisual(result);
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
    animateDiceResult(resultPanel, visual.value, 'Obrażenia', visual.sides || 6, 'success', { kind: visual.kind });
  };

  performDamageFormulaRoll = function performCorrectDamageFormulaRoll(item, mode = 'normal') {
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
      const visual = winningDamageVisual(result);
      addDiceHistory({ type: 'damage', label: `${item.name}${modeText}`, summary, notation: result.notation, result: result.total, details: `${rollText}${keepText}${blastText}`, visual });
      renderDiceResult(visual.value, `${item.name}${modeText} · ${rollText}${keepText}${blastText}`, { sides: visual.sides || 6, kind: visual.kind });
      announce(`${summary}. ${rollText}${keepText}.`);
      openItemDamageResultSheet(item, result, { mode });
      return result;
    } catch (error) {
      showToast(error.message, 'error');
      return null;
    }
  };

  dieIcon = function polishedDieIcon(sides) {
    const ns = 'http://www.w3.org/2000/svg';
    const value = exactInteger(sides);
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('data-die', String(value));
    svg.classList.add('die-icon');
    const add = (tag, attrs, text = '') => {
      const node = document.createElementNS(ns, tag);
      for (const [key, entry] of Object.entries(attrs)) node.setAttribute(key, entry);
      if (text) node.textContent = text;
      svg.append(node);
      return node;
    };
    if (value === 4) {
      add('polygon', { points: '12,2.5 21,20.5 3,20.5' });
      add('path', { d: 'M12 2.5L8.2 15.1 3 20.5M12 2.5l3.8 12.6 5.2 5.4M8.2 15.1h7.6' });
    } else if (value === 6) {
      add('polygon', { points: '12,2.5 20.5,7.5 20.5,16.5 12,21.5 3.5,16.5 3.5,7.5' });
      add('path', { d: 'M3.5 7.5L12 12l8.5-4.5M12 12v9.5' });
    } else if (value === 8) {
      add('polygon', { points: '12,2 21,12 12,22 3,12' });
      add('path', { d: 'M3 12h18M12 2L8 12l4 10 4-10z' });
    } else if (value === 10) {
      add('polygon', { points: '12,2 20.5,8.2 17.2,21 6.8,21 3.5,8.2' });
      add('path', { d: 'M12 2v14M3.5 8.2L12 16l8.5-7.8M6.8 21L12 16l5.2 5' });
    } else if (value === 12) {
      add('polygon', { points: '12,2 18.7,4.8 22,11 19.5,18 13.8,22 6.8,20.3 2,15 3,7.8 7.5,3' });
      add('polygon', { points: '12,6.1 17.1,9 16.1,15 10.5,18 6.8,13.5 8.1,8.1' });
      add('path', { d: 'M12 2v4.1M18.7 4.8L17.1 9M22 11l-5.9 4M13.8 22l-3.3-4M2 15l4.8-1.5M3 7.8l5.1.3' });
    } else if (value === 20) {
      add('polygon', { points: '12,2 20.6,6.9 21,16.4 15.6,22 6.4,22 3,15.9 3.5,7.2' });
      add('path', { d: 'M12 2L8.2 8.2h7.6zM3.5 7.2l4.7 1 3.8 7.2 3.8-7.2 4.8-1.3M3 15.9l9-.5 9 1M6.4 22l5.6-6.6 3.6 6.6' });
    } else if (value === 100) {
      add('polygon', { class: 'percentile-icon-die percentile-icon-tens', points: '6.7,3 12.1,7 10.2,17.6 3.6,17.6 1.7,7' });
      add('path', { d: 'M6.7 3v9.3M1.7 7l5 5.3 5.4-5.3M3.6 17.6l3.1-5.3 3.5 5.3' });
      add('polygon', { class: 'percentile-icon-die percentile-icon-units', points: '17.3,6.4 22.7,10.4 20.8,21 14.2,21 12.3,10.4' });
      add('path', { d: 'M17.3 6.4v9.3M12.3 10.4l5 5.3 5.4-5.3M14.2 21l3.1-5.3 3.5 5.3' });
    } else {
      return polishedDieIcon(20);
    }
    return svg;
  };

  renderDiceView = function renderCleanDiceView() {
    originalRenderDiceView();
    const resultButton = document.querySelector('#diceResult');
    const entries = Array.isArray(state?.diceHistory) ? state.diceHistory : [];
    const latest = entries[0] || null;
    if (resultButton) {
      if (latest) renderStaticVisual(resultButton, visualForHistoryEntry(latest));
      else resultButton.replaceChildren(createAggregateResultVisual('—'));
      resultButton.querySelector('.result-die-context')?.remove();
    }
    document.querySelector('#view-dice .dice-result-actions .section-caption')?.remove();
  };

  globalThis.CairnDiceRules = Object.freeze({
    supportedDice: [...SUPPORTED_DICE],
    normalizeRollConfig: normalizeRollConfigStrict,
    visualForRollResult,
    winningDamageVisual
  });
  document.documentElement.dataset.diceRollFixes = 'true';
})();
