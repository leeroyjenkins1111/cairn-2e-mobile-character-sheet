import { test, expect } from '@playwright/test';

test.describe('physical dice renderer and motion', () => {
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
      const notation = host.querySelector('.result-die-notation');
      return {
        hiddenValue: host.querySelector('.result-die-value')?.textContent,
        faceReveal: object?.dataset.faceReveal,
        context: host.querySelector('.result-die-context')?.textContent,
        notationState: notation ? getComputedStyle(notation).display : 'absent'
      };
    });

    expect(result.hiddenValue).toBe('17');
    expect(result.faceReveal).toBe('1');
    expect(result.context).toBe('Rzut k20');
    expect(['none', 'absent']).toContain(result.notationState);
  });

  test('orbits the full viewport and returns to the landing frame', async ({ page }) => {
    const samples = await page.evaluate(() => ({
      top: physicalViewportPose(.115, { left: -130, right: 130, top: -240, bottom: 430 }, 44, 0, 1),
      right: physicalViewportPose(.305, { left: -130, right: 130, top: -240, bottom: 430 }, 44, 0, 1),
      bottom: physicalViewportPose(.495, { left: -130, right: 130, top: -240, bottom: 430 }, 44, 0, 1),
      left: physicalViewportPose(.685, { left: -130, right: 130, top: -240, bottom: 430 }, 44, 0, 1),
      settled: physicalViewportPose(1, { left: -130, right: 130, top: -240, bottom: 430 }, 44, 0, 1)
    }));

    expect(samples.top.y).toBeCloseTo(-240, 5);
    expect(samples.right.x).toBeCloseTo(130, 5);
    expect(samples.bottom.y).toBeCloseTo(430, 5);
    expect(samples.left.x).toBeCloseTo(-130, 5);
    expect(samples.settled).toEqual({ x: 0, y: 0, scale: 1 });
  });

  test('moves the k100 pair on opposite viewport routes and lands side by side', async ({ page }) => {
    const samples = await page.evaluate(() => {
      const bounds = { left: -140, right: 140, top: -260, bottom: 440 };
      return {
        tensAtRightWall: physicalViewportPose(.305, bounds, 71, -68, -1),
        unitsAtRightWall: physicalViewportPose(.305, bounds, 91, 68, 1),
        tensSettled: physicalViewportPose(1, bounds, 71, -68, -1),
        unitsSettled: physicalViewportPose(1, bounds, 91, 68, 1)
      };
    });

    expect(Math.abs(samples.tensAtRightWall.x - samples.unitsAtRightWall.x)).toBeGreaterThan(220);
    expect(samples.tensSettled.x).toBe(-68);
    expect(samples.unitsSettled.x).toBe(68);
  });

  test('portals a live roll above the whole screen and restores its landing slot', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.physicalDice === 'true');

    const state = await page.evaluate(async () => {
      const host = document.createElement('div');
      host.style.width = '320px';
      host.style.minHeight = '220px';
      document.body.append(host);
      animateDiceResult(host, 5, 'wynik', 6, 'neutral');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const scene = document.querySelector('body > .result-die-scene.is-viewport-flight');
      const result = {
        portalParent: scene?.parentElement?.tagName,
        hasPlaceholder: Boolean(host.querySelector('.dice-flight-placeholder')),
        position: scene ? getComputedStyle(scene).position : ''
      };
      physicalCancelViewportFlight();
      result.restored = Boolean(host.querySelector('.result-die-scene'));
      host.remove();
      return result;
    });

    expect(state).toEqual({ portalParent: 'BODY', hasPlaceholder: true, position: 'fixed', restored: true });
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
