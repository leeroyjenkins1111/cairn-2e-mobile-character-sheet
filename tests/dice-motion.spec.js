import { test, expect } from '@playwright/test';

test.describe('physical dice renderer', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.physicalDice === 'true');
  });

  test('uses a 10-face kite mesh for k10', async ({ page }) => {
    const mesh = await page.evaluate(() => {
      const result = createDieMesh(10);
      return {
        vertices: result.vertices.length,
        faces: result.faces.length,
        faceSizes: result.faces.map(face => face.length)
      };
    });

    expect(mesh.vertices).toBe(12);
    expect(mesh.faces).toBe(10);
    expect(mesh.faceSizes).toEqual(Array(10).fill(4));
  });

  test('keeps both dice visible when resolving the higher result', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const host = document.createElement('div');
      document.body.append(host);
      animateHighestDamageDice(
        host,
        [{ sides: 6, value: 3 }, { sides: 6, value: 6 }],
        6,
        'obrażeń',
        'success',
        'Krótki łuk · 2k6, zachowaj wyższy'
      );
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        diceCount: host.querySelectorAll('.damage-die-scene').length,
        loserConnected: Boolean(host.querySelector('.damage-die-loser')?.isConnected),
        winnerConnected: Boolean(host.querySelector('.damage-die-winner')?.isConnected),
        context: host.querySelector('.result-die-context')?.textContent,
        result: host.querySelector('.result-die-copy')?.textContent
      };
    });

    expect(result.diceCount).toBe(2);
    expect(result.loserConnected).toBe(true);
    expect(result.winnerConnected).toBe(true);
    expect(result.context).toContain('zachowaj wyższy');
    expect(result.result).toContain('Wyższy wynik: 6');
  });

  test('renders the result on the die and exposes roll context separately', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const host = document.createElement('div');
      document.body.append(host);
      animateDiceResult(host, 17, 'wynik', 20, 'neutral');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const object = host.querySelector('.result-die-object');
      return {
        hiddenValue: host.querySelector('.result-die-value')?.textContent,
        faceReveal: object?.dataset.faceReveal,
        context: host.querySelector('.result-die-context')?.textContent,
        notationVisible: getComputedStyle(host.querySelector('.result-die-notation')).display
      };
    });

    expect(result.hiddenValue).toBe('17');
    expect(result.faceReveal).toBe('1');
    expect(result.context).toBe('Rzut k20');
    expect(result.notationVisible).toBe('none');
  });
}

test('travels to the right wall and rebounds without a stationary spin phase', async ({ page }) => {
  const samples = await page.evaluate(() => ({
    launch: physicalSinglePose(0.18, 120, 44),
    beforeWall: physicalSinglePose(0.54, 120, 44),
    wall: physicalSinglePose(0.56, 120, 44),
    rebound: physicalSinglePose(0.66, 120, 44),
    settled: physicalSinglePose(1, 120, 44)
  }));

  expect(samples.wall.x).toBeGreaterThan(samples.beforeWall.x);
  expect(Math.abs(samples.wall.y)).toBeLessThan(0.01);
  expect(samples.rebound.x).toBeLessThan(samples.wall.x);
  expect(samples.rebound.y).toBeLessThan(-12);
  expect(Math.abs(samples.settled.y)).toBeLessThan(0.01);
});

test('couples angular motion to travelled distance', async ({ page }) => {
  const result = await page.evaluate(() => {
    const entry = { sides: 6, seed: 91, finalRotation: { x: 0.6, y: 0.8, z: 0.1 } };
    const spin = physicalInitialSpin(entry, 1);
    const magnitude = rotation => Math.abs(rotation.x) + Math.abs(rotation.y) + Math.abs(rotation.z);
    physicalAdvanceSpin(spin, entry.finalRotation, 1 / 60, 0.20, { x: 0, y: 0 });
    const initial = { ...spin.rotation };
    physicalAdvanceSpin(spin, entry.finalRotation, 1 / 60, 0.21, { x: 0, y: 0 });
    const stationaryDelta = magnitude({
      x: spin.rotation.x - initial.x,
      y: spin.rotation.y - initial.y,
      z: spin.rotation.z - initial.z
    });
    const stationary = { ...spin.rotation };
    physicalAdvanceSpin(spin, entry.finalRotation, 1 / 60, 0.22, { x: 36, y: 0 });
    const movingDelta = magnitude({
      x: spin.rotation.x - stationary.x,
      y: spin.rotation.y - stationary.y,
      z: spin.rotation.z - stationary.z
    });
    return { stationaryDelta, movingDelta };
  });

  expect(result.stationaryDelta).toBeLessThan(0.001);
  expect(result.movingDelta).toBeGreaterThan(0.15);
});

});
