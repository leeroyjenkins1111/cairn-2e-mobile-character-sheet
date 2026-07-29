import { test, expect } from '@playwright/test';

test.describe('dice result face v2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.diceFaceV2 === 'true');
  });

  test('locks the result orientation before the value is revealed', async ({ page }) => {
    const result = await page.evaluate(() => {
      const entry = { sides: 6, seed: 42, finalRotation: finalDieRotation(6) };
      const spin = physicalInitialSpin(entry, 1);
      const pose = { x: 20, y: -2 };

      physicalAdvanceSpin(spin, entry.finalRotation, 1 / 60, 0.91, pose);
      const first = { ...spin.rotation };
      physicalAdvanceSpin(spin, entry.finalRotation, 1 / 60, 0.97, { x: 21, y: 0 });
      const second = { ...spin.rotation };

      return {
        first,
        second,
        target: entry.finalRotation
      };
    });

    expect(result.first.x).toBeCloseTo(result.target.x, 5);
    expect(result.first.y).toBeCloseTo(result.target.y, 5);
    expect(result.first.z).toBeCloseTo(result.target.z, 5);
    expect(result.second).toEqual(result.first);
  });

  test('renders the result with the v2 engraved face renderer', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const host = document.createElement('div');
      document.body.append(host);
      animateDiceResult(host, 4, 'Wynik', 6, 'neutral');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        enabled: document.documentElement.dataset.diceFaceV2,
        reveal: host.querySelector('.result-die-object')?.dataset.faceReveal,
        canvasCount: host.querySelectorAll('.result-die-canvas').length
      };
    });

    expect(result.enabled).toBe('true');
    expect(result.canvasCount).toBeGreaterThan(0);
    expect(Number(result.reveal)).toBeGreaterThanOrEqual(0);
  });
});
