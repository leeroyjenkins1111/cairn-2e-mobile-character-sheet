'use strict';

(() => {
  const toFiniteNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function createInventoryOverviewModel({ usage, armor, gold, capacity = 10 } = {}) {
    const normalizedCapacity = Math.max(1, Math.trunc(toFiniteNumber(capacity, 10)));
    const total = Math.max(0, Math.trunc(toFiniteNumber(usage?.total, 0)));
    const fatigueSlots = Math.max(0, Math.trunc(toFiniteNumber(usage?.fatigueSlots, 0)));
    const effectiveArmor = Math.max(0, Math.trunc(toFiniteNumber(armor?.effective, 0)));
    const normalizedGold = Math.max(0, Math.trunc(toFiniteNumber(gold, 0)));
    const freeSlots = Math.max(0, normalizedCapacity - total);
    const isFull = total >= normalizedCapacity;

    return Object.freeze({
      total,
      capacity: normalizedCapacity,
      freeSlots,
      isFull,
      capacityLabel: `${total}/${normalizedCapacity} miejsc`,
      capacityCaption: isFull ? 'Pełny ekwipunek · OCHR krytyczne' : `${freeSlots} wolnych`,
      stats: Object.freeze({
        fatigue: Object.freeze({ value: fatigueSlots, label: 'zmęczenia' }),
        armor: Object.freeze({ value: effectiveArmor, label: 'pancerz' }),
        gold: Object.freeze({ value: normalizedGold, label: 'złoto' })
      })
    });
  }

  globalThis.CairnInventoryDomain = Object.freeze({ createInventoryOverviewModel });
})();
