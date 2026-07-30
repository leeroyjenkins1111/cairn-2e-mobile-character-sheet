import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function loadInventoryDomain() {
  const source = await readFile(new URL('../../scripts/inventory-domain.js', import.meta.url), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source, context, { filename: 'inventory-domain.js' });
  return context.CairnInventoryDomain;
}

function plainOverview(model) {
  return {
    ...model,
    stats: {
      fatigue: { ...model.stats.fatigue },
      armor: { ...model.stats.armor },
      gold: { ...model.stats.gold }
    }
  };
}

test('builds an inventory overview without DOM dependencies', async () => {
  const { createInventoryOverviewModel } = await loadInventoryDomain();
  const model = createInventoryOverviewModel({
    usage: { total: 7, fatigueSlots: 2 },
    armor: { effective: 1 },
    gold: 14
  });

  assert.deepEqual(plainOverview(model), {
    total: 7,
    capacity: 10,
    freeSlots: 3,
    isFull: false,
    capacityLabel: '7/10 miejsc',
    capacityCaption: '3 wolnych',
    stats: {
      fatigue: { value: 2, label: 'zmęczenia' },
      armor: { value: 1, label: 'pancerz' },
      gold: { value: 14, label: 'złoto' }
    }
  });
});

test('normalizes invalid and negative numeric input', async () => {
  const { createInventoryOverviewModel } = await loadInventoryDomain();
  const model = createInventoryOverviewModel({
    usage: { total: -4, fatigueSlots: 'nie-liczba' },
    armor: { effective: -2 },
    gold: Number.NaN,
    capacity: 0
  });

  assert.equal(model.total, 0);
  assert.equal(model.capacity, 1);
  assert.equal(model.freeSlots, 1);
  assert.equal(model.stats.fatigue.value, 0);
  assert.equal(model.stats.armor.value, 0);
  assert.equal(model.stats.gold.value, 0);
});

test('marks capacity as full and never exposes negative free slots', async () => {
  const { createInventoryOverviewModel } = await loadInventoryDomain();
  const model = createInventoryOverviewModel({ usage: { total: 12 }, capacity: 10 });

  assert.equal(model.isFull, true);
  assert.equal(model.freeSlots, 0);
  assert.equal(model.capacityCaption, 'Pełny ekwipunek · OCHR krytyczne');
});

test('returns immutable public models', async () => {
  const { createInventoryOverviewModel } = await loadInventoryDomain();
  const model = createInventoryOverviewModel();

  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.stats), true);
  assert.equal(Object.isFrozen(model.stats.armor), true);
});
