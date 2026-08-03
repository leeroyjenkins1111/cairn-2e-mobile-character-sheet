'use strict';

(() => {
  const PHASES = Object.freeze({
    IDLE: 'idle',
    ARMED: 'armed',
    ANTICIPATION: 'anticipation',
    THROWING: 'throwing',
    SETTLING: 'settling',
    REVEALED: 'revealed'
  });
  const bypass = new WeakSet();
  let selectedButton = null;
  let selectedSides = 20;
  let animationToken = 0;
  let pressTimer = 0;

  function diceView() { return document.querySelector('#view-dice'); }
  function consoleNode() { return diceView()?.querySelector('.dice-console'); }
  function resultNode() { return document.querySelector('#diceResult'); }

  function setPhase(phase) {
    const view = diceView();
    const stage = view?.querySelector('.dice-experience-stage');
    if (!view || !stage) return;
    view.dataset.dicePhase = phase;
    stage.dataset.phase = phase;
    stage.setAttribute('aria-busy', String([PHASES.ANTICIPATION, PHASES.THROWING, PHASES.SETTLING].includes(phase)));
  }

  function sidesFor(button) {
    const value = button?.querySelector('[data-die]')?.dataset.die || button?.getAttribute('aria-label')?.match(/k(\d+)/i)?.[1];
    const sides = Number(value);
    return Number.isFinite(sides) ? sides : 20;
  }

  function outcomeFromResult(result) {
    const label = result?.getAttribute('aria-label') || '';
    const shell = result?.firstElementChild;
    const tone = shell?.dataset.tone || shell?.getAttribute('data-tone') || 'neutral';
    if (/kość losu/i.test(label)) return { kicker: 'Kość Losu', title: /sprzyja/i.test(label) ? 'Pomyślny obrót' : 'Niepomyślny obrót', tone: /sprzyja/i.test(label) ? 'success' : 'failure' };
    if (/sukces|udany|zdany/i.test(label) || tone === 'success' || tone === 'positive') return { kicker: 'Próba rozstrzygnięta', title: 'Sukces', tone: 'success' };
    if (/porażk|nieudany|niezdany/i.test(label) || tone === 'failure' || tone === 'negative' || tone === 'danger') return { kicker: 'Próba rozstrzygnięta', title: 'Porażka', tone: 'failure' };
    return { kicker: `Rzut k${selectedSides}`, title: 'Wynik rzutu', tone: 'neutral' };
  }

  function updateStageCopy() {
    const result = resultNode();
    const stage = diceView()?.querySelector('.dice-experience-stage');
    if (!stage) return;
    const outcome = outcomeFromResult(result);
    stage.dataset.outcome = outcome.tone;
    stage.querySelector('.dice-stage-kicker').textContent = outcome.kicker;
    stage.querySelector('.dice-stage-title').textContent = outcome.title;
    const detail = result?.getAttribute('aria-label') || `Wybrano kość k${selectedSides}`;
    stage.querySelector('.dice-stage-detail').textContent = detail.replace(/^.*?:\s*/, '');
  }

  function markSelected(button) {
    diceView()?.querySelectorAll('.die-button.is-selected').forEach(node => node.classList.remove('is-selected'));
    selectedButton = button;
    selectedSides = sidesFor(button);
    button?.classList.add('is-selected');
    const stage = diceView()?.querySelector('.dice-experience-stage');
    if (stage) {
      stage.querySelector('.dice-stage-kicker').textContent = 'Przygotowany rzut';
      stage.querySelector('.dice-stage-title').textContent = `Kość k${selectedSides}`;
      stage.querySelector('.dice-stage-detail').textContent = 'Rzuć, gdy będziesz gotowy.';
      stage.dataset.outcome = 'neutral';
    }
    setPhase(PHASES.ARMED);
  }

  function executeSelected() {
    if (!selectedButton?.isConnected) selectedButton = diceView()?.querySelector(`.die-button [data-die="${selectedSides}"]`)?.closest('.die-button');
    if (!selectedButton) return;
    bypass.add(selectedButton);
    setPhase(PHASES.ANTICIPATION);
    requestAnimationFrame(() => {
      setTimeout(() => {
        setPhase(PHASES.THROWING);
        selectedButton.click();
      }, 170);
    });
  }

  function onResultChanged() {
    const token = ++animationToken;
    setPhase(PHASES.THROWING);
    window.setTimeout(() => token === animationToken && setPhase(PHASES.SETTLING), 690);
    window.setTimeout(() => {
      if (token !== animationToken) return;
      updateStageCopy();
      setPhase(PHASES.REVEALED);
    }, 1120);
  }

  function createStage(consoleElement) {
    if (consoleElement.querySelector('.dice-experience-stage')) return;
    const result = consoleElement.querySelector('#diceResult');
    if (!result) return;
    const stage = document.createElement('section');
    stage.className = 'dice-experience-stage';
    stage.dataset.phase = PHASES.IDLE;
    stage.dataset.outcome = 'neutral';
    stage.setAttribute('aria-label', 'Scena rzutu kośćmi');
    stage.innerHTML = `
      <div class="dice-stage-atmosphere" aria-hidden="true"></div>
      <header class="dice-stage-copy">
        <span class="dice-stage-kicker">Stół do rzutu</span>
        <h2 class="dice-stage-title">Wybierz kość</h2>
        <p class="dice-stage-detail">Przygotuj rzut lub wybierz procedurę.</p>
      </header>
      <div class="dice-stage-result-slot"></div>
      <div class="dice-stage-actions">
        <button class="btn btn-primary dice-stage-roll" type="button" disabled>Rzuć</button>
        <button class="btn btn-secondary dice-stage-done" type="button" hidden>Gotowe</button>
      </div>`;
    stage.querySelector('.dice-stage-result-slot').append(result);
    consoleElement.insertBefore(stage, consoleElement.querySelector('.dice-result-actions') || null);
    stage.querySelector('.dice-stage-roll').addEventListener('click', executeSelected);
    stage.querySelector('.dice-stage-done').addEventListener('click', () => {
      setPhase(PHASES.IDLE);
      stage.querySelector('.dice-stage-kicker').textContent = 'Stół do rzutu';
      stage.querySelector('.dice-stage-title').textContent = 'Wybierz kość';
      stage.querySelector('.dice-stage-detail').textContent = 'Przygotuj rzut lub wybierz procedurę.';
    });
    new MutationObserver(onResultChanged).observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label'] });
  }

  function wireDiceButtons(view) {
    view.querySelectorAll('.die-button').forEach(button => {
      if (button.dataset.experienceBound) return;
      button.dataset.experienceBound = 'true';
      button.addEventListener('click', event => {
        if (bypass.has(button)) { bypass.delete(button); return; }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (selectedButton === button && view.dataset.dicePhase === PHASES.ARMED) executeSelected();
        else markSelected(button);
      }, true);
      button.addEventListener('pointerdown', () => {
        window.clearTimeout(pressTimer);
        pressTimer = window.setTimeout(() => { markSelected(button); executeSelected(); }, 520);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => button.addEventListener(type, () => window.clearTimeout(pressTimer)));
    });
  }

  function enhance() {
    const view = diceView();
    const consoleElement = consoleNode();
    if (!view || !consoleElement) return;
    createStage(consoleElement);
    wireDiceButtons(view);
    const rollButton = view.querySelector('.dice-stage-roll');
    if (rollButton) rollButton.disabled = !selectedButton;
    const doneButton = view.querySelector('.dice-stage-done');
    if (doneButton) doneButton.hidden = view.dataset.dicePhase !== PHASES.REVEALED;
  }

  const rootObserver = new MutationObserver(() => requestAnimationFrame(enhance));
  rootObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('DOMContentLoaded', enhance, { once: true });
  window.addEventListener('pageshow', enhance);
})();
