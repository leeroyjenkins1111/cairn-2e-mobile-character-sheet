'use strict';

animateDiceResult = function animateDiceResultWithImmediateEdgeBounce(container, value, label, sides = 6, tone = 'neutral') {
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

    if (progress < 0.54) {
      const phase = progress / 0.54;
      const eased = diceMotionEaseInOutCubic(phase);
      x = diceMotionLerp(-travel, travel, eased);
      y = -Math.abs(Math.sin(phase * Math.PI * 3)) * (21 - phase * 7);
      rollingProgress = phase * 0.58;
    } else if (progress < 0.69) {
      const phase = (progress - 0.54) / 0.15;
      const bouncePhase = Math.pow(phase, 0.68);
      const eased = diceMotionEaseOutCubic(phase);
      x = diceMotionLerp(travel, travel * 0.27, eased);
      y = -Math.sin(bouncePhase * Math.PI) * 31;
      rollingProgress = 0.58 + phase * 0.2;
      if (!edgeImpactTriggered) {
        edgeImpactTriggered = true;
        triggerHaptic('impact');
      }
    } else {
      const phase = (progress - 0.69) / 0.31;
      const eased = diceMotionEaseOutCubic(phase);
      const spring = Math.sin(phase * Math.PI * 4) * (1 - phase) * 14;
      x = diceMotionLerp(travel * 0.27, 0, eased) + spring;
      y = -Math.abs(Math.sin(phase * Math.PI * 3)) * (1 - phase) * 18;
      rollingProgress = 0.78 + phase * 0.22;
    }

    const remaining = 1 - rollingProgress;
    const rotation = {
      x: entry.finalRotation.x + remaining * Math.PI * 3.2,
      y: entry.finalRotation.y + remaining * Math.PI * 4.4,
      z: entry.finalRotation.z + remaining * Math.PI * 1.5
    };
    diceMotionSetObjectPosition(entry, x, y, 0.58 + (1 - Math.min(1, Math.abs(y) / 32)) * 0.3);
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