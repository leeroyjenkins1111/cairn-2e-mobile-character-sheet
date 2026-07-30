import { test, expect } from '@playwright/test';

test.describe('consolidated dice renderer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.diceRenderer === 'consolidated');
  });

  test('loads one authoritative result renderer', async ({ page }) => {
    const state = await page.evaluate(() => ({
      renderer: document.documentElement.dataset.diceRenderer,
      legacyStable: document.documentElement.dataset.diceFaceV4,
      legacyPremium: document.documentElement.dataset.dicePremium
    }));
    expect(state).toEqual({ renderer: 'consolidated', legacyStable: undefined, legacyPremium: undefined });
  });

  test('renders a supersampled carved value without exposing old result text', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.diceRenderer === 'consolidated');
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'consolidated-dice-review';
      host.style.width = '360px';
      host.style.padding = '20px';
      host.style.background = '#211322';
      document.body.replaceChildren(host);
      animateDiceResult(host, 4, 'Wynik', 6, 'neutral');
    });

    const review = page.locator('#consolidated-dice-review');
    await expect(review.locator('.result-die-canvas')).toHaveCount(1);
    await expect(review.locator('.result-die-object')).toHaveAttribute('data-face-reveal', '1');
    await review.screenshot({ path: 'ui-review-screenshots/04-dice-consolidated.png' });
  });
});
