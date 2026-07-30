import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'cairn-mobile-sheet:state';
const CHECKPOINTS_KEY = 'cairn-mobile-sheet:checkpoints';

async function clearLocalData(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function loadDemo(page) {
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect.poll(() => page.evaluate(key => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value).initialized : false;
  }, STORAGE_KEY)).toBe(true);
}

async function renameCharacter(page, name) {
  await page.getByRole('button', { name: 'Dziennik' }).click();
  await page.getByRole('button', { name: 'Edytuj dane' }).click();
  await page.getByLabel('Imię').fill(name);
  await page.getByRole('button', { name: 'Zapisz dane podstawowe' }).click();
  await expect.poll(() => page.evaluate(key => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value).identity?.name : null;
  }, STORAGE_KEY)).toBe(name);
}

test.beforeEach(async ({ page }) => {
  await clearLocalData(page);
});

test('persists an edited character across a full reload', async ({ page }) => {
  await loadDemo(page);
  await renameCharacter(page, 'Mira z Głębokiego Lasu');

  await page.reload();

  await expect(page.getByText('Mira z Głębokiego Lasu', { exact: true }).first()).toBeVisible();
  const persisted = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), STORAGE_KEY);
  expect(persisted.identity.name).toBe('Mira z Głębokiego Lasu');
  expect(persisted.initialized).toBe(true);
});

test('exports, imports and checkpoints a replaced character through the UI', async ({ page }) => {
  await loadDemo(page);
  const originalName = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').identity?.name, STORAGE_KEY);

  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Pobierz pełną kopię' }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  await page.getByRole('button', { name: 'Zamknij panel' }).click();
  await renameCharacter(page, 'Postać przed importem');

  await page.locator('#backupFileInput').setInputFiles(backupPath);
  await expect(page.getByRole('heading', { name: 'Raport importu' })).toBeVisible();
  await page.getByRole('button', { name: 'Nadpisz kartę importem' }).click();
  await page.getByRole('button', { name: 'Nadpisz kartę', exact: true }).click();

  await expect.poll(() => page.evaluate(key => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value).identity?.name : null;
  }, STORAGE_KEY)).toBe(originalName);

  const checkpoints = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), CHECKPOINTS_KEY);
  expect(checkpoints).toHaveLength(1);
  expect(checkpoints[0].payload.identity.name).toBe('Postać przed importem');
  expect(checkpoints[0].reason).toContain('Przed importem');
});
