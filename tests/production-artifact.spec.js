import { test, expect } from '@playwright/test';

test.describe('production artifact contract', () => {
  test('serves the generated split runtime instead of source app.js', async ({ page }) => {
    await page.goto('/');

    const scripts = await page.locator('script[src]').evaluateAll(elements =>
      elements.map(element => new URL(element.src).pathname)
    );

    expect(scripts).toContain('/scripts/app-core.js');
    expect(scripts).toContain('/scripts/app-bootstrap.js');
    expect(scripts).not.toContain('/scripts/app.js');
  });

  test('does not expose the embedded developer test runner', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(globalThis.CairnSheetDev));

    const state = await page.evaluate(() => ({
      hasRunTests: typeof globalThis.CairnSheetDev?.runTests === 'function',
      hasSelfTestMarker: Boolean(document.querySelector('#selftestMarker')),
      hasDeveloperSettingsCopy: document.body.textContent.includes('Testy deweloperskie')
    }));

    expect(state).toEqual({
      hasRunTests: false,
      hasSelfTestMarker: false,
      hasDeveloperSettingsCopy: false
    });
  });

  test('loads the production-only static style layers', async ({ page }) => {
    await page.goto('/');

    const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll(elements =>
      elements.map(element => new URL(element.href).pathname)
    );

    expect(stylesheets).toEqual(expect.arrayContaining([
      '/styles/app.css',
      '/styles/character-redesign.css',
      '/styles/screen-unification.css',
      '/styles/runtime-overrides.css'
    ]));
  });
});
