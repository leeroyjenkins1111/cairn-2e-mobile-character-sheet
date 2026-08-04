'use strict';

(() => {
  const PHASES = Object.freeze({ IDLE: 'idle', ROLLING: 'rolling', SETTLING: 'settling', REVEALED: 'revealed' });
  const FALLBACK_ROLL_MS = 1800;
  const SETTLE_HOLD_MS = 120;
  let selectedSides = 20;
  let rollToken = 0;
  let fallbackTimer = 0;

  function viewNode() { return document.querySelector('#view-dice'); }
  function consoleNode() { return viewNode()?.querySelector('.dice-console'); }
  function resultNode() { return document.querySelector('#diceResult'); }
  function stageNode() { return viewNode()?.querySelector('.dice-experience-stage'); }

  function setPhase(phase) {
    const view = viewNode();
    const stage = stageNode();
    if (!view || !stage) return;
    view.dataset.dicePhase = phase;
    stage.dataset.phase = phase;
    stage.setAttribute('aria-busy', String(phase === PHASES.ROLLING || phase === PHASES.SETTLING));
  }

  function sidesFor(button) {
    const raw = button?.querySelector('[data-die]')?.dataset.die || button?.getAttribute('aria-label')?.match(/k(\d+)/i)?.[1];
    const sides = Number(raw);
    return Number.isFinite(sides) ? sides : 20;
  }

  function cleanResultLabel(label = '') {
    return String(label)
      .replace(/^.*?:\s*/, '')
      .replace(/\s*·\s*/g, ' · ')
      .trim();
  }

  function resultValue(result) {
    const direct = result?.querySelector('.result-total-value, .result-die-value')?.textContent?.trim();
    if (direct && /^[-+]?\d+$/.test(direct)) return direct;
    const label = result?.getAttribute('aria-label') || '';
    const match = label.match(/(?:^|:\s*)(-?\d+)(?:\s|$|\()/);
    return match?.[1] || '—';
  }

  function resultTone(result) {
    const shell = result?.firstElementChild;
    const tone = shell?.dataset.tone || shell?.getAttribute('data-tone') || 'neutral';
    const label = result?.getAttribute('aria-label') || '';
    if (/sukces|udany|zdany|sprzyja/i.test(label) || tone === 'success' || tone === 'positive') return 'success';
    if (/porażk|nieudany|niezdany|niepomyślny/i.test(label) || ['failure', 'negative', 'danger'].includes(tone)) return 'failure';
    return 'neutral';
  }

  function updateResultBand() {
    const result = resultNode();
    const stage = stageNode();
    if (!result || !stage) return;
    const value = resultValue(result);
    const label = cleanResultLabel(result.getAttribute('aria-label')) || `Rzut k${selectedSides}`;
    stage.dataset.outcome = resultTone(result);
    stage.querySelector('.dice-stage-value').textContent = value;
    stage.querySelector('.dice-stage-context').textContent = label;
  }

  function revealResult(token) {
    if (token !== rollToken) return;
    window.clearTimeout(fallbackTimer);
    setPhase(PHASES.SETTLING);
    window.setTimeout(() => {
      if (token !== rollToken) return;
      updateResultBand();
      setPhase(PHASES.REVEALED);
    }, SETTLE_HOLD_MS);
  }

  function beginRoll() {
    const token = ++rollToken;
    const stage = stageNode();
    if (!stage) return;
    window.clearTimeout(fallbackTimer);
    stage.dataset.outcome = 'neutral';
    stage.querySelector('.dice-stage-value').textContent = '';
    stage.querySelector('.dice-stage-context').textContent = `Rzut k${selectedSides}`;
    setPhase(PHASES.ROLLING);
    fallbackTimer = window.setTimeout(() => revealResult(token), FALLBACK_ROLL_MS);
  }

  function onResultMutations(mutations) {
    const result = resultNode();
    if (!result) return;
    const busyMutation = mutations.some(mutation => mutation.type === 'attributes' && mutation.attributeName === 'aria-busy');
    const contentMutation = mutations.some(mutation => mutation.type === 'childList');
    const busyValue = result.getAttribute('aria-busy');

    // The physical renderer historically removed aria-busy on settle. Normalize that
    // transition to the explicit ARIA state consumed by the stage and regression tests.
    if (busyMutation && busyValue === null) {
      result.setAttribute('aria-busy', 'false');
      return;
    }

    const busy = busyValue === 'true';
    if (contentMutation || (busyMutation && busy)) beginRoll();
    if (busyMutation && busyValue === 'false' && rollToken) revealResult(rollToken);
  }

  function dieGlyph(sides) {
    const common = 'viewBox="0 0 48 48" aria-hidden="true" focusable="false"';
    if (sides === 4) return `<svg ${common}><path d="M24 6 43 40H5Z"/><path d="M24 6v34M5 40l19-13 19 13"/><text x="24" y="31">4</text></svg>`;
    if (sides === 6) return `<svg ${common}><path d="m10 15 14-8 14 8v18l-14 8-14-8Z"/><path d="m10 15 14 8 14-8M24 23v18"/><text x="24" y="20">6</text></svg>`;
    if (sides === 8) return `<svg ${common}><path d="M24 5 42 24 24 43 6 24Z"/><path d="M24 5v38M6 24h36"/><text x="24" y="29">8</text></svg>`;
    if (sides === 10) return `<svg ${common}><path d="M24 4 42 18 36 39 12 39 6 18Z"/><path d="m24 4-7 20 7 15 7-15ZM6 18l11 6M42 18l-11 6"/><text x="24" y="28">10</text></svg>`;
    if (sides === 12) return `<svg ${common}><path d="m24 4 16 9 4 17-12 14H16L4 30l4-17Z"/><path d="m24 4-8 13 8 10 8-10ZM8 13l8 4M40 13l-8 4M4 30l20-3 20 3M16 44l8-17 8 17"/><text x="24" y="22">12</text></svg>`;
    if (sides === 20) return `<svg ${common}><path d="M24 3 43 15l-4 22-15 8L9 37 5 15Z"/><path d="M24 3 14 22l10 23 10-23ZM5 15l9 7h20l9-7M9 37l15-15 15 15"/><text x="24" y="20">20</text></svg>`;
    return `<svg ${common} class="percentile-glyph"><g class="percentile-icon-die percentile-icon-tens" transform="translate(-4 1)"><path d="M17 7 31 18 27 37H7L3 18Z"/><path d="m17 7-5 15 5 15 5-15ZM3 18l9 4 10-4"/><text class="percentile-icon-label-tens" x="17" y="27">00</text></g><g class="percentile-icon-die percentile-icon-units" transform="translate(19 6)"><path d="M13 5 25 14 22 31H5L1 14Z"/><path d="m13 5-4 13 4 13 4-13ZM1 14l8 4 8-4"/><text class="percentile-icon-label-units" x="13" y="23">0</text></g></svg>`;
  }

  function enhanceQuickDice(view) {
    view.querySelectorAll('.die-button').forEach(button => {
      const sides = sidesFor(button);
      const icon = button.querySelector('[data-die]');
      if (icon && !icon.dataset.redesigned) {
        icon.dataset.redesigned = 'true';
        icon.innerHTML = dieGlyph(sides);
      }
      if (button.dataset.experienceBound) return;
      button.dataset.experienceBound = 'true';
      button.addEventListener('click', () => {
        selectedSides = sides;
        view.querySelectorAll('.die-button.is-selected').forEach(node => node.classList.remove('is-selected'));
        button.classList.add('is-selected');
      });
    });
  }

  function createStage(consoleElement) {
    if (consoleElement.querySelector('.dice-experience-stage')) return;
    const result = consoleElement.querySelector('#diceResult');
    if (!result) return;

    const stage = document.createElement('section');
    stage.className = 'dice-experience-stage';
    stage.dataset.phase = PHASES.IDLE;
    stage.dataset.outcome = 'neutral';
    stage.setAttribute('aria-label', 'Stół do rzucania kośćmi');
    stage.innerHTML = `
      <div class="dice-stage-surface" aria-hidden="true"></div>
      <div class="dice-stage-result-slot"></div>
      <footer class="dice-stage-result-band" aria-live="polite">
        <strong class="dice-stage-value" aria-hidden="true">—</strong>
        <span class="dice-stage-context">Wybierz kość, aby rzucić</span>
      </footer>`;
    stage.querySelector('.dice-stage-result-slot').append(result);
    consoleElement.insertBefore(stage, consoleElement.querySelector('.dice-result-actions') || null);

    if (!result.hasAttribute('aria-busy')) result.setAttribute('aria-busy', 'false');
    new MutationObserver(onResultMutations).observe(result, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'aria-busy']
    });
  }

  function enhance() {
    const view = viewNode();
    const consoleElement = consoleNode();
    if (!view || !consoleElement) return;
    createStage(consoleElement);
    enhanceQuickDice(view);
    if (!view.dataset.dicePhase) setPhase(PHASES.IDLE);
  }

  const rootObserver = new MutationObserver(() => requestAnimationFrame(enhance));
  rootObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('DOMContentLoaded', enhance, { once: true });
  window.addEventListener('pageshow', enhance);
})();
