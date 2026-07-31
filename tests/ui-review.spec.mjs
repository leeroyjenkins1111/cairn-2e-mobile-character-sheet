import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const outputDir = 'ui-review-screenshots';

async function loadDemo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toBeVisible();
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 5000 });
}

async function shot(page, name) {
  await page.screenshot({ path: `${outputDir}/${name}.png`, animations: 'disabled' });
}

test('capture structural UI review screenshots', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'One canonical Chromium review set is sufficient.');
  mkdirSync(outputDir, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await loadDemo(page);

  await shot(page, '01-character-dark-390x844');
  await page.locator('.combat-launcher').getByRole('button', { name: /Wybierz broń/ }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Walka');
  await expect(page.locator('.weapon-picker')).toBeVisible();
  await shot(page, '01a-weapon-picker-dark-390x844');
  await page.getByRole('button', { name: 'Zamknij panel' }).click();

  await page.setViewportSize({ width: 390, height: 744 });
  await shot(page, '01b-character-compact-dark-390x744');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => globalThis.CairnSheetDev.performFirstRoundDexSave(1));
  await expect(page.locator('#sheetTitle')).toHaveText('Pierwsza runda walki');
  await expect(page.locator('#sheet .animated-dice-result')).toHaveClass(/settled/);
  await shot(page, '01c-combat-flow-dark-390x844');
  await page.getByRole('button', { name: 'Zamknij panel' }).click();
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  await shot(page, '02-inventory-dark-390x844');
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k8' }).click();
  await expect(page.locator('#diceResult .animated-dice-result')).toHaveClass(/settled/);
  await shot(page, '03-dice-dark-390x844');
  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await page.getByRole('checkbox', { name: 'Haptyka' }).scrollIntoViewIfNeeded();
  await shot(page, '03b-feedback-settings-dark-390x844');
  await page.getByRole('button', { name: 'Gotowe' }).click();
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await shot(page, '04-journal-dark-390x844');

  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: 'Postać', exact: true }).click();
  await shot(page, '05-character-dark-320x568');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await page.getByRole('checkbox', { name: 'Jasny motyw' }).check();
  await page.getByRole('button', { name: 'Gotowe' }).click();
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  await shot(page, '06-inventory-light-390x844');
  await page.getByRole('button', { name: 'Postać', exact: true }).click();
  await shot(page, '06a-character-light-390x844');
  await page.locator('.combat-launcher').getByRole('button', { name: /Wybierz broń/ }).click();
  await expect(page.locator('.weapon-picker')).toBeVisible();
  await shot(page, '06b-weapon-picker-light-390x844');
  await page.getByRole('button', { name: 'Zamknij panel' }).click();
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await shot(page, '06c-dice-light-390x844');
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await shot(page, '06d-journal-light-390x844');

  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await page.getByRole('checkbox', { name: 'Jasny motyw' }).uncheck();
  await page.getByRole('button', { name: 'Gotowe' }).click();
  await page.getByRole('button', { name: 'Postać', exact: true }).click();
  await page.locator('.damage-primary-action').click();
  await expect(page.locator('#sheetTitle')).toHaveText('Otrzymaj obrażenia');
  await shot(page, '07-damage-sheet-dark-390x844');
  await page.getByRole('button', { name: 'Zamknij panel' }).click();

  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  await page.getByRole('button', { name: /Szczegóły przedmiotu: Krótki łuk/ }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Szczegóły przedmiotu');
  await shot(page, '08-item-detail-sheet-dark-390x844');
});
