import { test, expect } from '@playwright/test';

async function loadDemo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toBeVisible();
}

test('editorial visual system is loaded from a local stylesheet', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="stylesheet"][href="./styles/editorial.css"]')).toHaveCount(1);

  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      brass: styles.getPropertyValue('--brass').trim(),
      moss: styles.getPropertyValue('--moss').trim(),
      radius: styles.getPropertyValue('--radius-panel').trim(),
      loaded: Array.from(document.styleSheets).some(sheet => sheet.href?.endsWith('/styles/editorial.css'))
    };
  });

  expect(tokens.loaded).toBe(true);
  expect(tokens.brass).not.toBe('');
  expect(tokens.moss).not.toBe('');
  expect(tokens.radius).toBe('22px');
});

test('core gameplay screens use the authored surface hierarchy', async ({ page }) => {
  await loadDemo(page);

  const character = await page.evaluate(() => {
    const hero = document.querySelector('.session-hero');
    const primary = document.querySelector('.gameplay-action-grid .btn-primary');
    const nav = document.querySelector('.bottom-nav');
    return {
      heroRadius: getComputedStyle(hero).borderRadius,
      primaryBackground: getComputedStyle(primary).backgroundImage,
      navPosition: getComputedStyle(nav).position,
      bodyBackground: getComputedStyle(document.body).backgroundImage
    };
  });

  expect(character.heroRadius).toBe('22px');
  expect(character.primaryBackground).toContain('linear-gradient');
  expect(character.navPosition).toBe('fixed');
  expect(character.bodyBackground).toContain('radial-gradient');

  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const inventory = await page.evaluate(() => {
    const group = document.querySelector('.inventory-group');
    const title = document.querySelector('.inventory-row-title h3');
    return {
      groupBorder: getComputedStyle(group).borderTopWidth,
      titleFamily: getComputedStyle(title).fontFamily
    };
  });
  expect(inventory.groupBorder).toBe('0px');
  expect(inventory.titleFamily.toLowerCase()).toContain('serif');
});

test('editorial layer remains usable at the narrow supported viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await loadDemo(page);

  for (const name of ['Postać', 'Ekwipunek', 'Kości', 'Dziennik']) {
    await page.getByRole('button', { name, exact: true }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
