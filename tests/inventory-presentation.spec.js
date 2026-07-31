import { test, expect } from '@playwright/test';

async function loadDemoInventory(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toBeVisible();
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 5000 });
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  await expect(page.locator('#view-inventory')).toBeVisible();
}

test.describe('czytelność listy ekwipunku', () => {
  test('oddziela sekcje i nie powtarza stanu przy każdym przedmiocie', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoInventory(page);

    const inventory = page.locator('#view-inventory');
    for (const group of ['held', 'worn', 'stored']) {
      const section = inventory.locator(`[data-inventory-group="${group}"]`);
      await expect(section).toBeVisible();
      await expect(section.locator(':scope > summary')).toBeVisible();
    }

    await expect(inventory.locator('.carry-status')).toHaveCount(0);
    await expect(inventory.locator('[data-inventory-group="held"]')).toContainText('Trzymane');
    await expect(inventory.locator('[data-inventory-group="worn"]')).toContainText('Noszone');
    await expect(inventory.locator('[data-inventory-group="stored"]')).toContainText('Schowane');
  });

  test('nazwy mogą się zawijać i lista nie tworzy poziomego overflow na 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await loadDemoInventory(page);

    const inventory = page.locator('#view-inventory');
    const title = inventory.locator('.inventory-row-title strong').first();
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS('white-space', 'normal');

    const overflowingRows = await inventory.locator('.inventory-row').evaluateAll(rows => rows.filter(row => row.scrollWidth > row.clientWidth + 1).length);
    expect(overflowingRows).toBe(0);

    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(pageOverflows).toBe(false);
  });

  test('sekcje pozostają zwijane bez utraty zawartości', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoInventory(page);

    const stored = page.locator('[data-inventory-group="stored"]');
    const summary = stored.locator(':scope > summary');
    await expect(stored).toHaveAttribute('open', '');
    await summary.click();
    await expect(stored).not.toHaveAttribute('open', '');
    await summary.click();
    await expect(stored).toHaveAttribute('open', '');
    await expect(stored.locator('.inventory-row')).toHaveCount(3);
  });
});
