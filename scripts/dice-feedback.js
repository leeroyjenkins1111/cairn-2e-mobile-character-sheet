'use strict';

const PHYSICAL_DICE_HAPTIC_TIMES = Object.freeze([140, 260, 390, 540, 710, 890, 1120]);
const PHYSICAL_DUAL_DICE_HAPTIC_TIMES = Object.freeze([150, 290, 450, 630, 840, 1070, 1320]);

function schedulePhysicalDiceTicks(container, expectedToken, times, selector) {
  if (shouldReduceMotion()) return;
  times.forEach(delay => {
    globalThis.setTimeout(() => {
      if (expectedToken !== diceAnimationToken) return;
      if (!container?.querySelector?.(selector)) return;
      triggerHaptic('tick');
    }, delay);
  });
}

function physicalDiceResultCopy(label, value) {
  const text = String(label || '').trim();
  if (!text) return 'Wynik';
  const compact = text.replace(/\s+/g, ' ');
  const notationOnly = /^[kd0-9+\-x×\s·:]+$/i.test(compact);
  const repeatsValue = compact.includes(String(value));
  return notationOnly && repeatsValue ? 'Wynik' : text;
}

const animateDiceResultWithPhysicalFeedback = animateDiceResult;
animateDiceResult = function animateDiceResultWithTactileRhythm(...args) {
  const [container, value, label, ...rest] = args;
  animateDiceResultWithPhysicalFeedback(container, value, physicalDiceResultCopy(label, value), ...rest);
  schedulePhysicalDiceTicks(container, diceAnimationToken, PHYSICAL_DICE_HAPTIC_TIMES, '.animated-dice-result.rolling');
};

const animateHighestDamageDiceWithPhysicalFeedback = animateHighestDamageDice;
animateHighestDamageDice = function animateHighestDamageDiceWithTactileRhythm(...args) {
  const container = args[0];
  animateHighestDamageDiceWithPhysicalFeedback(...args);
  schedulePhysicalDiceTicks(container, diceAnimationToken, PHYSICAL_DUAL_DICE_HAPTIC_TIMES, '.dual-dice-result.rolling');
};
