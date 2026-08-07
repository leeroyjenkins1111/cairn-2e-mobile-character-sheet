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

    const flyingObject = page.locator('body > .result-die-scene.is-viewport-flight .result-die-object');
    await expect(flyingObject).toHaveClass(/is-tumbling/);
    await page.waitForTimeout(1200);
    await expect(flyingObject).toHaveAttribute('data-face-reveal', '0');

    const settledObject = page.locator('#dice-renderer-test-host .result-die-object');
    await expect(settledObject).not.toHaveClass(/is-tumbling/, { timeout: 4000 });
    await expect(settledObject).toHaveAttribute('data-face-reveal', '1');
  });

  test('keeps rotating through the approach and locks only at landing', async ({ page }) => {
    const result = await page.evaluate(() => {
      const target = finalDieRotation(6, 4);
      const entry = { sides: 6, value: 4, seed: 42, finalRotation: target };
      const spin = physicalInitialSpin(entry, 1);
      physicalAdvanceSpin(spin, target, 1 / 60, 0.92, { x: 12, y: -2 });
      const first = { ...spin.rotation };
      physicalAdvanceSpin(spin, target, 1 / 60, 0.99, { x: 1, y: 0 });
      return { target, first, second: { ...spin.rotation } };
    });

    expect(Math.abs(result.first.x - result.target.x) + Math.abs(result.first.y - result.target.y) + Math.abs(result.first.z - result.target.z)).toBeGreaterThan(.001);
    expect(result.second.x).toBeCloseTo(result.target.x, 5);
    expect(result.second.y).toBeCloseTo(result.target.y, 5);
    expect(result.second.z).toBeCloseTo(result.target.z, 5);
  });

  test('aligns one complete face with the top-down camera for every die', async ({ page }) => {
    const results = await page.evaluate(() => [4, 6, 8, 10, 12, 20, 100].map(sides => {
      const mesh = createDieMesh(sides);
      const rotation = finalDieRotation(sides, Math.min(sides, 7));
      const transformed = mesh.vertices.map(vertex => rotateDiePoint(vertex, rotation));
      const dominantNormal = Math.max(...mesh.faces.map(face => {
        const [a, b, c] = face.map(index => transformed[index]);
        return vectorNormalize(vectorCross(
          b.map((entry, axis) => entry - a[axis]),
          c.map((entry, axis) => entry - a[axis])
        ))[2];
      }));
      return { sides, dominantNormal };
    }));

    for (const result of results) expect(result.dominantNormal, `k${result.sides}`).toBeGreaterThan(.999);
  });

  test('keeps the settled k6 square parallel to the phone edges', async ({ page }) => {
    const rotation = await page.evaluate(() => finalDieRotation(6, 4));
    expect(rotation.x).toBeCloseTo(0, 8);
    expect(rotation.y).toBeCloseTo(0, 8);
    expect(rotation.z).toBeCloseTo(0, 8);
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
