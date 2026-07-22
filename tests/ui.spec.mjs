import { test, expect } from '@playwright/test';

async function loadDemo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toBeVisible();
}

test('one consolidated application stylesheet is loaded without editorial overrides', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="stylesheet"]')).toHaveCount(1);
  await expect(page.locator('link[rel="stylesheet"][href="./styles/app.css"]')).toHaveCount(1);
  await expect(page.locator('link[href*="editorial.css"]')).toHaveCount(0);
  const loaded = await page.evaluate(() => Array.from(document.styleSheets).map(sheet => new URL(sheet.href).pathname));
  expect(loaded).toEqual(['/styles/app.css']);
});

test('all four views expose distinct app-like structures and the header names the active view', async ({ page }) => {
  await loadDemo(page);
  await expect(page.locator('#headerTitle')).toHaveText('Postać');
  await expect(page.locator('.character-state')).toBeVisible();
  await expect(page.locator('.protection-control')).toContainText('OCHR');
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  await expect(page.locator('#headerTitle')).toHaveText('Ekwipunek');
  await expect(page.locator('.inventory-overview')).toBeVisible();
  await expect(page.locator('.inventory-list')).toBeVisible();

  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await expect(page.locator('#headerTitle')).toHaveText('Kości');
  await expect(page.locator('.dice-console')).toBeVisible();
  await expect(page.locator('.dice-rail')).toBeVisible();

  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await expect(page.locator('#headerTitle')).toHaveText('Dziennik');
  await expect(page.locator('.quick-note')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dossier postaci' })).toBeVisible();
});

test('character state prioritizes one protection control and direct save targets', async ({ page }) => {
  await loadDemo(page);
  await expect(page.locator('.state-values > .protection-control')).toHaveCount(1);
  await expect(page.locator('.secondary-stat')).toHaveCount(2);
  await expect(page.locator('.secondary-action-grid .compact-action')).toHaveCount(3);
  await expect(page.locator('.damage-primary-action')).toHaveCount(1);

  await page.getByRole('button', { name: /Rzut obronny Siła, aktualna wartość/ }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Rzut obronny SIŁ');
});

test('inventory rows are fully tappable and expose at most one trailing action', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const rows = page.locator('[data-item-id]');
  await expect(rows).toHaveCount(5);
  expect(await rows.evaluateAll(entries => entries.every(row => row.querySelectorAll(':scope > .inventory-trailing-action').length <= 1))).toBe(true);
  await expect(page.locator('.inventory-carry-button')).toHaveCount(0);

  const whistle = rows.filter({ hasText: 'Mosiężny gwizdek' });
  await whistle.locator('.inventory-row-main').click();
  await expect(page.locator('#sheetTitle')).toHaveText('Szczegóły przedmiotu');
  await expect(page.locator('#sheet')).toContainText('Mosiężny gwizdek');
});

test('bottom tab bar preserves semantics and does not cover the last inventory row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadDemo(page);
  const nav = page.locator('.bottom-nav');
  await expect(nav).toHaveCSS('position', 'fixed');
  await expect(page.getByRole('button', { name: 'Postać', exact: true })).toHaveAttribute('aria-current', 'page');

  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const lastRow = page.locator('.inventory-row').last();
  await lastRow.scrollIntoViewIfNeeded();
  const geometry = await page.evaluate(() => {
    const row = document.querySelector('.inventory-row:last-of-type') || [...document.querySelectorAll('.inventory-row')].at(-1);
    const nav = document.querySelector('.bottom-nav');
    const main = document.querySelector('.main');
    return {
      rowBottom: row.getBoundingClientRect().bottom,
      navTop: nav.getBoundingClientRect().top,
      mainPaddingBottom: parseFloat(getComputedStyle(main).paddingBottom),
      navHeight: nav.getBoundingClientRect().height
    };
  });
  expect(geometry.mainPaddingBottom).toBeGreaterThanOrEqual(geometry.navHeight);
  expect(geometry.rowBottom).toBeLessThanOrEqual(geometry.navTop + 1);
});

test('every quick die rolls immediately and repeat plus history stay close to the result', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
    await page.getByRole('button', { name: `Rzuć kością k${sides}`, exact: true }).click();
  }
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory.length)).toBe(7);
  await page.getByRole('button', { name: /Powtórz ostatni rzut:/ }).click();
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory.length)).toBe(8);
  await page.getByRole('button', { name: 'Historia', exact: true }).first().click();
  await expect(page.locator('#sheetTitle')).toHaveText('Historia rzutów');
});

test('custom roll and item details use dismissible sheets with restored focus', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  const custom = page.getByRole('button', { name: /Rzut własny/ });
  await custom.focus();
  await custom.click();
  await expect(page.locator('#sheetTitle')).toHaveText('Rzut własny');
  await page.keyboard.press('Escape');
  await expect(custom).toBeFocused();

  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const item = page.getByRole('button', { name: /Szczegóły przedmiotu: Krótki łuk/ });
  await item.click();
  await expect(page.locator('#sheetBackdrop')).toHaveClass(/open/);
  await page.getByRole('button', { name: 'Zamknij panel' }).click();
  await expect(item).toBeFocused();
});

test('dark and light appearances use distinct readable color schemes', async ({ page }) => {
  await loadDemo(page);
  const dark = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.body).color }));
  expect(dark.theme).toBe('dark');

  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await page.getByRole('checkbox', { name: 'Jasny motyw' }).check();
  const light = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.body).color }));
  expect(light.theme).toBe('light');
  expect(light.bg).not.toBe(dark.bg);
  expect(light.color).not.toBe(dark.color);
});

test('forced colors keeps primary actions and navigation perceivable', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colors emulation is Chromium-specific.');
  await page.emulateMedia({ forcedColors: 'active' });
  await loadDemo(page);
  const result = await page.evaluate(() => ({
    activeNavBg: getComputedStyle(document.querySelector('.nav-btn[aria-current="page"]')).backgroundColor,
    primaryBg: getComputedStyle(document.querySelector('.damage-primary-action')).backgroundColor,
    bodyBg: getComputedStyle(document.body).backgroundColor
  }));
  expect(result.activeNavBg).not.toBe(result.bodyBg);
  expect(result.primaryBg).not.toBe('rgba(0, 0, 0, 0)');
});

test('journal orders session, quick note, recent entries, then dossier', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  const order = await page.locator('#view-more > section').evaluateAll(sections => sections.map(section => section.className));
  expect(order[0]).toContain('session-log-card');
  expect(order[1]).toContain('quick-note');
  expect(order[2]).toContain('recent-journal');
  expect(order[3]).toContain('dossier-intro');
  await expect(page.getByText('Historia rzutów', { exact: true })).toHaveCount(0);
});
