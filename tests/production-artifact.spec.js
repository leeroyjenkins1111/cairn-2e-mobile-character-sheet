import { test, expect } from '@playwright/test';

const DESIGN_MODULES = [
  '/styles/tokens.css',
  '/styles/foundations.css',
  '/styles/shell.css',
  '/styles/components.css',
  '/styles/screens.css',
  '/styles/dice.css',
  '/styles/dice-screen.css',
  '/styles/dice-roll-fixes.css',
  '/styles/dice-experience.css',
  '/styles/atmosphere.css',
  '/styles/combat.css',
  '/styles/inventory.css',
  '/styles/journal.css',
  '/styles/journal-framing.css'
];

test.describe('production artifact contract', () => {
  test('serves the generated split runtime instead of source app.js', async ({ page }) => {
    await page.goto('/');

    const scripts = await page.locator('script[src]').evaluateAll(elements =>
      elements.map(element => new URL(element.src).pathname)
    );

    expect(scripts).toContain('/scripts/app-core.js');
    expect(scripts).toContain('/scripts/app-bootstrap.js');
    expect(scripts).toContain('/scripts/dice-roll-fixes.js');
    expect(scripts.indexOf('/scripts/dice-roll-fixes.js')).toBeLessThan(scripts.indexOf('/scripts/app-entry.js'));
    expect(scripts).toContain('/scripts/journal-redesign.js');
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

  test('loads one CSS entrypoint with the complete static design system', async ({ page }) => {
    await page.goto('/');

    const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll(elements =>
      elements.map(element => new URL(element.href).pathname)
    );
    expect(stylesheets).toEqual(['/styles/app.css']);

    const imports = await page.evaluate(() => {
      const entry = [...document.styleSheets].find(sheet => new URL(sheet.href).pathname === '/styles/app.css');
      return [...(entry?.cssRules || [])]
        .filter(rule => rule.type === CSSRule.IMPORT_RULE)
        .map(rule => new URL(rule.href, entry.href).pathname);
    });
    expect(imports).toEqual(DESIGN_MODULES);
  });
});
