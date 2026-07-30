import { test, expect } from '@playwright/test';

// The value must never be painted on a moving face: reveal happens once, after pose and rotation lock.
test.describe('consolidated carved dice renderer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.diceRenderer === 'consolidated');
  });

  test('keeps the numeral hidden for the entire tumble and reveals it once after settling', async ({ page }) => {
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'dice-renderer-test-host';
      document.body.append(host);
      animateDiceResult(host, 4, 'Wynik', 6, 'neutral');
    });

    const object = page.locator('#dice-renderer-test-host .result-die-object');
    await expect(object).toHaveClass(/is-tumbling/);
    await page.waitForTimeout(1200);
    await expect(object).toHaveAttribute('data-face-reveal', '0');

    await expect(object).not.toHaveClass(/is-tumbling/, { timeout: 2500 });
    await expect(object).toHaveAttribute('data-face-reveal', '1');
  });

  test('hard-locks the result orientation before the final pose', async ({ page }) => {
    const result = await page.evaluate(() => {
      const target = finalDieRotation(6, 4);
      const entry = { sides: 6, value: 4, seed: 42, finalRotation: target };
      const spin = physicalInitialSpin(entry, 1);
      physicalAdvanceSpin(spin, target, 1 / 60, 0.85, { x: 12, y: -2 });
      const first = { ...spin.rotation };
      physicalAdvanceSpin(spin, target, 1 / 60, 0.98, { x: 1, y: 0 });
      return { target, first, second: { ...spin.rotation } };
    });

    expect(result.first.x).toBeCloseTo(result.target.x, 5);
    expect(result.first.y).toBeCloseTo(result.target.y, 5);
    expect(result.first.z).toBeCloseTo(result.target.z, 5);
    expect(result.second).toEqual(result.first);
  });

  test('captures the final consolidated k6 for visual review', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.diceRenderer === 'consolidated');
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'dice-renderer-review';
      host.style.width = '360px';
      host.style.padding = '20px';
      host.style.background = '#211322';
      document.body.replaceChildren(host);
      animateDiceResult(host, 4, 'Wynik', 6, 'neutral');
    });
    const review = page.locator('#dice-renderer-review');
    await expect(review.locator('.result-die-canvas')).toHaveCount(1);
    await review.screenshot({ path: 'ui-review-screenshots/03-dice-renderer.png' });
  });
});
