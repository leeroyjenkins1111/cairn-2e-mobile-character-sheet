import { test, expect } from '@playwright/test';

test.describe('premium dice renderer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.dicePremium === 'true');
  });

  test('loads the premium renderer after the stable face renderer', async ({ page }) => {
    const state = await page.evaluate(() => ({
      stable: document.documentElement.dataset.diceFaceV4,
      premium: document.documentElement.dataset.dicePremium
    }));
    expect(state).toEqual({ stable: 'true', premium: 'true' });
  });

  test('renders a supersampled carved value without exposing the old result text', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.dicePremium === 'true');
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'premium-dice-review';
      host.style.width = '360px';
      host.style.padding = '20px';
      host.style.background = '#211322';
      document.body.replaceChildren(host);
      animateDiceResult(host, 4, 'Wynik', 6, 'neutral');
    });

    const review = page.locator('#premium-dice-review');
    await expect(review.locator('.result-die-canvas')).toHaveCount(1);
    await expect(review.locator('.result-die-object')).toHaveAttribute('data-face-reveal', '1');
    await review.screenshot({ path: 'ui-review-screenshots/04-dice-premium.png' });
  });
});
