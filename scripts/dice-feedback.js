'use strict';

const PHYSICAL_DICE_HAPTIC_TIMES = Object.freeze([180, 390, 630, 890]);
const PHYSICAL_DUAL_DICE_HAPTIC_TIMES = Object.freeze([170, 360, 570, 820, 1110]);

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

const animateDiceResultWithPhysicalFeedback = animateDiceResult;
animateDiceResult = function animateDiceResultWithTactileRhythm(...args) {
  const container = args[0];
  animateDiceResultWithPhysicalFeedback(...args);
  schedulePhysicalDiceTicks(container, diceAnimationToken, PHYSICAL_DICE_HAPTIC_TIMES, '.animated-dice-result.rolling');
};

const animateHighestDamageDiceWithPhysicalFeedback = animateHighestDamageDice;
animateHighestDamageDice = function animateHighestDamageDiceWithTactileRhythm(...args) {
  const container = args[0];
  animateHighestDamageDiceWithPhysicalFeedback(...args);
  schedulePhysicalDiceTicks(container, diceAnimationToken, PHYSICAL_DUAL_DICE_HAPTIC_TIMES, '.dual-dice-result.rolling');
};
