import { test, expect } from '@playwright/test';

async function loadDemo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toBeVisible();
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 5000 });
}

test.describe('panel walki na ekranie postaci', () => {
  test('zawiera wyłącznie wybór broni i ustalenie kolejności tur', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemo(page);

    const combat = page.locator('.combat-launcher');
    await expect(combat.getByRole('heading', { name: 'Walka' })).toBeVisible();
    await expect(combat.locator('.combat-panel-row')).toHaveCount(2);
    await expect(combat.getByRole('button', { name: /Wybierz broń/ })).toBeVisible();
    await expect(combat.getByRole('button', { name: /Ustal kolejność tur/ })).toBeVisible();
    await expect(combat.getByRole('button', { name: 'Odwrót', exact: true })).toHaveCount(0);
    await expect(combat.locator('.damage-primary-action')).toHaveCount(0);
  });

  test('wybór broni otwiera lekki selektor bez dodatkowych działań walki', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemo(page);

    await page.locator('.combat-launcher').getByRole('button', { name: /Wybierz broń/ }).click();

    const sheet = page.locator('#sheet');
    await expect(page.locator('#sheetTitle')).toHaveText('Walka');
    await expect(sheet.getByRole('radiogroup', { name: 'Modyfikator rzutu' })).toBeVisible();
    await expect(sheet.getByRole('radio', { name: 'Normalny · kość broni' })).toBeVisible();
    await expect(sheet.getByRole('radio', { name: 'Osłabiony · k4' })).toBeVisible();
    await expect(sheet.getByRole('radio', { name: 'Wzmocniony · k12' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Krótki łuk', exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Bez broni', exact: true })).toBeVisible();

    await expect(sheet).not.toContainText('Broń w rękach');
    await expect(sheet).not.toContainText('Pierwsza runda');
    await expect(sheet).not.toContainText('Inne działania');
    await expect(sheet).not.toContainText('Odwrót');
    await expect(sheet).not.toContainText('Otrzymaj obrażenia');
  });

  test('modyfikator zmienia kość, a kliknięcie broni wykonuje rzut', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemo(page);

    await page.locator('.combat-launcher').getByRole('button', { name: /Wybierz broń/ }).click();
    const sheet = page.locator('#sheet');

    await sheet.getByRole('radio', { name: 'Wzmocniony · k12' }).click();
    await expect(sheet.getByRole('radio', { name: 'Wzmocniony · k12' })).toHaveAttribute('aria-checked', 'true');
    await expect(sheet.locator('.weapon-picker-row').filter({ hasText: 'Krótki łuk' }).locator('.weapon-picker-value')).toHaveText('k12');

    await sheet.getByRole('button', { name: 'Krótki łuk', exact: true }).click();
    await expect(page.locator('#sheetTitle')).toHaveText('Obrażenia broni');
    await expect(page.locator('#sheet .dice-result strong')).toHaveText(/^(?:[1-9]|1[0-2])$/);
  });

  test('odwrót jest osobną akcją poza panelem walki', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemo(page);

    const retreat = page.locator('.secondary-action-grid').getByRole('button', { name: 'Odwrót', exact: true });
    await expect(retreat).toBeVisible();
    await expect(page.locator('.combat-launcher').getByRole('button', { name: 'Odwrót', exact: true })).toHaveCount(0);

    await retreat.click();
    await expect(page.locator('#sheetTitle')).toHaveText('Przygotuj odwrót');
  });

  test('obrażenia pozostają osobną akcją', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemo(page);

    const damage = page.locator('#view-character > .character-session .damage-primary-action');
    await expect(damage).toBeVisible();
    await expect(damage).toHaveAttribute('aria-label', 'Otrzymaj obrażenia');
    await damage.click();
    await expect(page.locator('#sheetTitle')).toHaveText('Otrzymaj obrażenia');
  });

  test('ustal kolejność tur uruchamia test ZRE', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemo(page);

    await page.locator('.combat-launcher').getByRole('button', { name: /Ustal kolejność tur/ }).click();
    await expect(page.locator('#sheetTitle')).toHaveText('Pierwsza runda walki');
    await expect(page.locator('#sheet .animated-dice-result')).toHaveClass(/settled/);
  });
});
