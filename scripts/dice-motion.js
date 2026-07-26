'use strict';

const DICE_MOTION_DURATION = 1550;
const DICE_COLLISION_DURATION = 1750;
const DICE_COLLISION_AT = 0.56;

const DICE_MOTION_STYLES = `
  .animated-dice-result,
  .dual-dice-result {
    width: 100%;
  }
  .animated-dice-result {
    overflow: visible;
  }
  .result-die-scene.die-motion-stage {
    width: min(100%, 360px);
    height: 158px;
    overflow: visible;
  }
  .die-motion-stage .result-die-object,
  .die-motion-stage .result-die-shadow,
  .dual-dice-stage .result-die-scene {
    will-change: transform, opacity;
  }
  .die-motion-stage .result-die-shadow {
    right: auto;
    left: 50%;
    width: 92px;
    margin-left: -46px;
  }
  .dual-dice-result {
    display: grid;
    justify-items: center;
    gap: 2px;
    text-align: center;
  }
  .dual-dice-stage {
    position: relative;
    width: min(100%, 360px);
    height: 158px;
    overflow: visible;
  }
  .dual-dice-stage .result-die-scene {
    position: absolute;
    top: 0;
    left: 0;
  }
  .dual-dice-result.rolling .result-die-value {
    opacity: 0;
    transform: scale(.78);
  }
  .dual-dice-result.revealing .result-die-value {
    opacity: 1;
    transform: scale(.88);
    transition: opacity 120ms ease-out, transform 160ms ease-out;
  }
  .dual-dice-result.settled .result-die-value {
    opacity: 1;
    transform: none;
    animation: die-value-reveal 240ms cubic-bezier(.2, .78, .28, 1);
  }
  .dual-dice-result.settled .result-die-copy {
    animation: result-copy-in 240ms ease-out;
  }
  .dual-dice-result .damage-die-winner .result-die-notation {
    color: var(--brass-bright);
  }
  .dual-dice-result .damage-die-loser {
    pointer-events: none;
  }
  :root[data-reduce-motion="true"] .die-motion-stage .result-die-object,
  :root[data-reduce-motion="true"] .die-motion-stage .result-die-shadow,
  :root[data-reduce-motion="true"] .dual-dice-stage .result-die-scene {
    transform: none !important;
  }
  @media (prefers-reduced-motion: reduce) {
    .die-motion-stage .result-die-object,
    .die-motion-stage .result-die-shadow,
    .dual-dice-stage .result-die-scene {
      transform: none !important;
    }
  }
`;

function installDiceMotionStyles() {
  if (document.querySelector('#diceMotionStyles')) return;
  const style = document.createElement('style');
  style.id = 'diceMotionStyles';
  style.textContent = DICE_MOTION_STYLES;
  document.head.append(style);
}

function diceMotionClamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function diceMotionLerp(from, to, progress) {
  return from + (to - from) * progress;
}

function diceMotionEaseOutCubic(progress) {
  const remaining = 1 - diceMotionClamp(progress);
  return 1 - remaining * remaining * remaining;
}

function diceMotionEaseInOutCubic(progress) {
  const value = diceMotionClamp(progress);
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function diceMotionTravel(stage, object) {
  const stageWidth = stage?.clientWidth || stage?.getBoundingClientRect?.().width || 320;
  const objectWidth = object?.offsetWidth || object?.getBoundingClientRect?.().width || 136;
  return Math.max(72, Math.min(132, (stageWidth - objectWidth) / 2 - 4));
}

function diceMotionPaint(entry, rotation, lift = 0) {
  entry.canvases.forEach((canvas, index) => paintResultDie(
    canvas,
    entry.sides === 100 ? 10 : entry.sides,
    { ...rotation, x: rotation.x + index * 0.44, y: rotation.y + index * 0.72 },
    lift + (index ? 2 : -2)
  ));
}

function diceMotionEntry(scene, roll) {
  const sides = DICE_SIDES.includes(Number(roll.sides)) ? Number(roll.sides) : 6;
  const value = Number(roll.value);
  return {
    scene,
    object: scene.querySelector('.result-die-object'),
    shadow: scene.querySelector('.result-die-shadow'),
    number: scene.querySelector('.result-die-value'),
    canvases: [...scene.querySelectorAll('.result-die-canvas')],
    sides,
    value,
    finalRotation: finalDieRotation(sides, value)
  };
}

function diceMotionSetEntryPosition(entry, x, y, opacity = 1, scale = 1) {
  entry.scene.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  entry.scene.style.opacity = String(opacity);
  if (entry.shadow) {
    const shadowOpacity = Math.max(0, opacity * (0.38 + Math.max(0, y) * -0.008));
    entry.shadow.style.opacity = String(shadowOpacity);
  }
}

function diceMotionSetObjectPosition(entry, x, y, shadowScale = 0.82) {
  entry.object.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  if (entry.shadow) {
    entry.shadow.style.transform = `translate3d(${x}px, 0, 0) scaleX(${shadowScale})`;
  }
}

animateDiceResult = function animateDiceResultWithTrajectory(container, value, label, sides = 6, tone = 'neutral') {
  if (!container) return;
  const token = ++diceAnimationToken;
  const numericSides = DICE_SIDES.includes(Number(sides)) ? Number(sides) : 6;
  const reduced = shouldReduceMotion();
  const shell = createDiceResultVisual(value, label, numericSides, tone, !reduced);
  const scene = shell.querySelector('.result-die-scene');
  const copy = shell.querySelector('.result-die-copy');
  const entry = diceMotionEntry(scene, { sides: numericSides, value });
  scene.classList.add('die-motion-stage');
  if (!reduced) shell.setAttribute('aria-hidden', 'true');
  container.replaceChildren(shell);

  if (reduced) {
    triggerHaptic(resultHapticForTone(tone));
    return;
  }

  const started = performance.now();
  const travel = diceMotionTravel(scene, entry.object);
  let nextHapticTick = 0;
  let edgeImpactTriggered = false;

  const tick = now => {
    if (token !== diceAnimationToken || !shell.isConnected) return;
    const progress = Math.min(1, (now - started) / DICE_MOTION_DURATION);
    let x;
    let y;
    let rollingProgress;

    if (progress < 0.62) {
      const phase = progress / 0.62;
      const eased = diceMotionEaseInOutCubic(phase);
      x = diceMotionLerp(-travel, travel, eased);
      y = -Math.abs(Math.sin(phase * Math.PI * 3)) * (12 - phase * 4);
      rollingProgress = phase * 0.72;
    } else if (progress < 0.8) {
      const phase = (progress - 0.62) / 0.18;
      const eased = diceMotionEaseOutCubic(phase);
      x = diceMotionLerp(travel, travel * 0.24, eased);
      y = -Math.sin(phase * Math.PI) * 15;
      rollingProgress = 0.72 + phase * 0.18;
      if (!edgeImpactTriggered) {
        edgeImpactTriggered = true;
        triggerHaptic('impact');
      }
    } else {
      const phase = (progress - 0.8) / 0.2;
      const eased = diceMotionEaseOutCubic(phase);
      x = diceMotionLerp(travel * 0.24, 0, eased);
      y = -Math.sin(phase * Math.PI * 2) * (1 - phase) * 5;
      rollingProgress = 0.9 + phase * 0.1;
    }

    const remaining = 1 - rollingProgress;
    const rotation = {
      x: entry.finalRotation.x + remaining * Math.PI * 8,
      y: entry.finalRotation.y + remaining * Math.PI * 12,
      z: entry.finalRotation.z + remaining * Math.PI * 5
    };
    diceMotionSetObjectPosition(entry, x, y, 0.54 + (1 - Math.min(1, Math.abs(y) / 18)) * 0.3);
    diceMotionPaint(entry, rotation, y * 0.08);

    while (nextHapticTick < DIE_HAPTIC_TICKS.length && progress >= DIE_HAPTIC_TICKS[nextHapticTick]) {
      triggerHaptic('tick');
      nextHapticTick += 1;
    }

    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }

    entry.number.textContent = String(value);
    copy.textContent = label;
    shell.removeAttribute('aria-hidden');
    shell.classList.remove('rolling');
    shell.classList.add('settled');
    entry.object.classList.remove('is-tumbling');
    diceMotionSetObjectPosition(entry, 0, 0);
    diceMotionPaint(entry, entry.finalRotation);
    triggerHaptic(resultHapticForTone(tone));
  };

  requestAnimationFrame(tick);
};

function animateHighestDamageDice(container, rolls, total, label = 'obrażeń', tone = 'success') {
  if (!container || !Array.isArray(rolls) || rolls.length !== 2) {
    animateDiceResult(container, total, label, rolls?.[0]?.sides || 6, tone);
    return;
  }

  const normalizedRolls = rolls.map(roll => ({
    sides: DICE_SIDES.includes(Number(roll.sides)) ? Number(roll.sides) : 6,
    value: Number(roll.value)
  }));
  const winnerIndex = normalizedRolls.findIndex(roll => roll.value === Number(total));
  const resolvedWinnerIndex = winnerIndex >= 0 ? winnerIndex : 0;
  const loserIndex = resolvedWinnerIndex === 0 ? 1 : 0;
  const reduced = shouldReduceMotion();

  if (reduced) {
    container.replaceChildren(createDiceResultVisual(
      normalizedRolls[resolvedWinnerIndex].value,
      label,
      normalizedRolls[resolvedWinnerIndex].sides,
      tone,
      false
    ));
    triggerHaptic(resultHapticForTone(tone));
    return;
  }

  const token = ++diceAnimationToken;
  const scenes = normalizedRolls.map((roll, index) => {
    const scene = createResultDie(roll.value, roll.sides, true);
    scene.classList.add('damage-die-scene', index === resolvedWinnerIndex ? 'damage-die-winner' : 'damage-die-loser');
    scene.dataset.rollIndex = String(index);
    return scene;
  });
  const stage = createEl('div', { className: 'dual-dice-stage' }, scenes);
  const copy = createEl('span', { className: 'result-die-copy', text: 'Kości w ruchu…' });
  const shell = createEl('div', {
    className: 'dual-dice-result rolling',
    attrs: { 'data-tone': tone, 'aria-hidden': 'true' }
  }, [stage, copy]);
  container.replaceChildren(shell);

  const entries = scenes.map((scene, index) => diceMotionEntry(scene, normalizedRolls[index]));
  const started = performance.now();
  let collisionTriggered = false;
  let nextHapticTick = 0;

  requestAnimationFrame(() => {
    const stageWidth = stage.clientWidth || 320;
    entries.forEach(entry => {
      const sceneWidth = entry.scene.offsetWidth || 152;
      entry.scene.style.left = `${(stageWidth - sceneWidth) / 2}px`;
    });
    const travel = Math.max(82, Math.min(138, (stageWidth - (entries[0].object.offsetWidth || 136)) / 2 - 2));
    const collisionOffset = Math.min(52, (entries[0].object.offsetWidth || 136) * 0.38);

    const tick = now => {
      if (token !== diceAnimationToken || !shell.isConnected) return;
      const progress = Math.min(1, (now - started) / DICE_COLLISION_DURATION);
      const beforeCollision = progress < DICE_COLLISION_AT;
      const pre = diceMotionClamp(progress / DICE_COLLISION_AT);
      const post = diceMotionClamp((progress - DICE_COLLISION_AT) / (1 - DICE_COLLISION_AT));
      const preEased = diceMotionEaseInOutCubic(pre);

      entries.forEach((entry, index) => {
        const side = index === 0 ? -1 : 1;
        const collisionX = side * collisionOffset;
        let x;
        let y;
        let opacity = 1;
        let scale = 1;
        let rollingProgress;

        if (beforeCollision) {
          x = diceMotionLerp(side * travel, collisionX, preEased);
          y = -Math.abs(Math.sin(pre * Math.PI * 2.5 + index * 0.45)) * (11 - pre * 3);
          rollingProgress = pre * 0.7;
        } else if (index === resolvedWinnerIndex) {
          const eased = diceMotionEaseOutCubic(post);
          const followThrough = -side * Math.sin(post * Math.PI) * (1 - post) * 20;
          x = diceMotionLerp(collisionX, 0, eased) + followThrough;
          y = -Math.sin(post * Math.PI * 2.2) * (1 - post) * 10;
          rollingProgress = 0.7 + post * 0.3;
        } else {
          const eased = diceMotionEaseOutCubic(post);
          x = diceMotionLerp(collisionX, side * travel * 0.92, eased);
          y = -Math.sin(post * Math.PI) * 30 + post * 16;
          opacity = 1 - diceMotionClamp((post - 0.12) / 0.68);
          scale = 1 - post * 0.24;
          rollingProgress = 0.7 + post * 0.3;
        }

        const remaining = 1 - rollingProgress;
        const rotation = {
          x: entry.finalRotation.x + remaining * Math.PI * (index === 0 ? 9 : -8),
          y: entry.finalRotation.y + remaining * Math.PI * (index === 0 ? 12 : -11),
          z: entry.finalRotation.z + remaining * Math.PI * (index === 0 ? 5 : -5)
        };
        diceMotionSetEntryPosition(entry, x, y, opacity, scale);
        diceMotionPaint(entry, rotation, y * 0.08);
      });

      if (!collisionTriggered && progress >= DICE_COLLISION_AT) {
        collisionTriggered = true;
        entries.forEach(entry => { entry.number.textContent = String(entry.value); });
        shell.classList.add('revealing');
        triggerHaptic('impact');
      }

      while (nextHapticTick < DIE_HAPTIC_TICKS.length && progress >= DIE_HAPTIC_TICKS[nextHapticTick]) {
        triggerHaptic('tick');
        nextHapticTick += 1;
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
        return;
      }

      const winner = entries[resolvedWinnerIndex];
      entries[loserIndex].scene.remove();
      diceMotionSetEntryPosition(winner, 0, 0, 1, 1);
      winner.object.classList.remove('is-tumbling');
      diceMotionPaint(winner, winner.finalRotation);
      copy.textContent = label;
      shell.removeAttribute('aria-hidden');
      shell.classList.remove('rolling', 'revealing');
      shell.classList.add('settled');
      triggerHaptic(resultHapticForTone(tone));
    };

    requestAnimationFrame(tick);
  });
}

openItemDamageResultSheet = function openItemDamageResultSheetWithCollision(item, result, options = {}) {
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

  const usesHighestOfTwo = mode === 'normal'
    && result?.formula?.keep === 'highest'
    && Array.isArray(result.rolls)
    && result.rolls.length === 2;

  if (usesHighestOfTwo) {
    animateHighestDamageDice(resultPanel, result.rolls, result.total, 'obrażeń', 'success');
    return;
  }

  animateDiceResult(
    resultPanel,
    result.total,
    'obrażeń',
    mode === 'impaired' ? 4 : mode === 'enhanced' ? 12 : (result.rolls?.[0]?.sides || 6),
    'success'
  );
};

installDiceMotionStyles();
