import { test, expect } from '@playwright/test';

// These checks intentionally keep enough perspective to read the object as a die,
// while ensuring the result face and numeral remain upright for the player.
// The captured review image is the visual acceptance artifact for this renderer.
test.describe('visible dice result face v3', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.diceFaceV3 === 'true');
    const rendererFlags = await page.evaluate(() => ({
      v2: document.documentElement.dataset.diceFaceV2,
      v3: document.documentElement.dataset.diceFaceV3
    }));
    expect(rendererFlags).toEqual({ v2: undefined, v3: 'true' });
  });

  test('freezes a readable k6 result with balanced three-dimensional perspective', async ({ page }) => {
    const result = await page.evaluate(() => {
      const target = finalDieRotation(6);
      const entry = { sides: 6, seed: 42, finalRotation: target };
      const spin = physicalInitialSpin(entry, 1);
      physicalAdvanceSpin(spin, target, 1 / 60, 0.87, { x: 20, y: 0 });
      const first = { ...spin.rotation };
      physicalAdvanceSpin(spin, target, 1 / 60, 0.98, { x: 24, y: 0 });
      return { target, first, second: { ...spin.rotation } };
    });

    expect(Math.abs(result.target.z)).toBeLessThan(0.001);
    expect(Math.abs(result.target.x)).toBeGreaterThan(0.20);
    expect(Math.abs(result.target.x)).toBeLessThan(0.36);
    expect(Math.abs(result.target.y)).toBeGreaterThan(0.30);
    expect(Math.abs(result.target.y)).toBeLessThan(0.46);
    expect(result.first.x).toBeCloseTo(result.target.x, 5);
    expect(result.first.y).toBeCloseTo(result.target.y, 5);
    expect(result.first.z).toBeCloseTo(result.target.z, 5);
    expect(result.second).toEqual(result.first);
  });

  test('captures the final carved k6 face for visual review', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.diceFaceV3 === 'true');
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'dice-v3-review';
      host.style.width = '360px';
      host.style.padding = '20px';
      host.style.background = '#211322';
      document.body.replaceChildren(host);
      animateDiceResult(host, 4, 'Wynik', 6, 'neutral');
    });
    const review = page.locator('#dice-v3-review');
    await expect(review.locator('.result-die-canvas')).toHaveCount(1);
    await review.screenshot({ path: 'ui-review-screenshots/03-dice-face-v3.png' });
  });
});
