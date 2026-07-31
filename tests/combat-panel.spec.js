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
    await expect(combat.locator('.combat-options-button')).toHaveCount(0);
    await expect(combat.locator('.combat-roll-action')).toHaveCount(0);
    await expect(combat.locator('.damage-primary-action')).toHaveCount(0);
  });

  test('wybór broni otwiera walkę, a obrażenia pozostają osobną akcją', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemo(page);

    const weaponChoice = page.locator('.combat-launcher').getByRole('button', { name: /Wybierz broń/ });
    await weaponChoice.click();
    await expect(page.locator('#sheetTitle')).toHaveText('Walka');
    await page.getByRole('button', { name: 'Zamknij panel' }).click();

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
