import { test, expect } from '@playwright/test';

async function loadDemo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toBeVisible();
}

test('all embedded domain regression tests pass', async ({ page }) => {
  await page.goto('/?selftest=1');
  const marker = page.locator('#selftestMarker');
  await expect(marker).toHaveAttribute('data-passed', '69');
  await expect(marker).toHaveAttribute('data-total', '69');
});

test('full and legacy exports round-trip without losing character data', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const dev = globalThis.CairnSheetDev;
    const fixture = dev.createDemoState();
    fixture.stats.gold = 37;
    fixture.conditions.panicked = true;
    fixture.scars.push({ id: 's1', text: 'Blizna testowa' });
    const full = dev.parseImportText(JSON.stringify(dev.buildBackupPayload(fixture)));
    const legacy = dev.parseImportText(JSON.stringify({ appId: 'cairn-mobile-sheet', schemaVersion: 2, exportedAt: new Date().toISOString(), character: { identity: fixture.identity, stats: fixture.stats, inventory: fixture.inventory, conditions: fixture.conditions, scars: fixture.scars, notes: fixture.notes }, source: fixture.source }));
    return {
      full: { name: full.candidate?.identity.name, gold: full.candidate?.stats.gold, items: full.candidate?.inventory.items.length, scars: full.candidate?.scars.length },
      legacy: { name: legacy.candidate?.identity.name, gold: legacy.candidate?.stats.gold, items: legacy.candidate?.inventory.items.length, scars: legacy.candidate?.scars.length },
      malformedAccepted: Boolean(dev.parseImportText(JSON.stringify({ appId: 'cairn-mobile-sheet', schemaVersion: 2, identity: { name: 'x' } })).candidate)
    };
  });
  expect(result.full).toEqual({ name: 'Mara Ciernista', gold: 37, items: 5, scars: 1 });
  expect(result.legacy).toEqual(result.full);
  expect(result.malformedAccepted).toBe(false);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }, { width: 414, height: 896 }]) {
  test(`core screens have no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await loadDemo(page);
    for (const name of ['Postać', 'Ekwipunek', 'Kości', 'Dziennik']) {
      await page.getByRole('button', { name, exact: true }).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
    const undersized = await page.locator('button:visible').evaluateAll(buttons => buttons.map(button => ({ label: button.getAttribute('aria-label') || button.textContent.trim(), rect: button.getBoundingClientRect() })).filter(entry => entry.rect.width < 44 || entry.rect.height < 44));
    expect(undersized).toEqual([]);
  });
}

test('reduced motion reveals a settled result immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadDemo(page);
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k20' }).click();
  await expect(page.locator('#diceResult')).not.toContainText('Kość w ruchu');
  await expect(page.locator('#diceResult strong')).not.toHaveText('—');
});

test('dice rolls do not consume undo history', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const fixture = globalThis.CairnSheetDev.createDemoState();
    fixture.changeHistory = [{ id: 'change', undoable: true }];
    globalThis.CairnSheetDev.recordDiceEntry(fixture, { summary: 'k6: 4' });
    return { changes: fixture.changeHistory.length, dice: fixture.diceHistory.length };
  });
  expect(result).toEqual({ changes: 1, dice: 1 });
});

test('application shell reloads while offline after Service Worker activation', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Offline Service Worker reload is covered in Chromium; WebKit covers layout and core logic.');
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Mobilna karta postaci')).toBeVisible();
  await context.setOffline(false);
});


test('settings and technical data are separated from the player journal', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dziennik postaci' })).toBeVisible();
  await expect(page.getByText('Dane i kopie zapasowe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await expect(page.getByRole('heading', { name: 'Ustawienia i dane' })).toBeVisible();
  await expect(page.getByText('Dane i kopie zapasowe')).toBeVisible();
  await expect(page.getByText('Testy deweloperskie')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Jak zainstalować' })).toBeVisible();
});

test('session prompt appears for urgent character state', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Stany postaci' }).click();
  await page.getByRole('checkbox', { name: 'Panika' }).check();
  await page.getByRole('button', { name: 'Oznacz panikę i 0 Ochrony' }).click();
  await expect(page.getByText('Co teraz?')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Postać jest spanikowana' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rzut WOL' })).toBeVisible();
});
