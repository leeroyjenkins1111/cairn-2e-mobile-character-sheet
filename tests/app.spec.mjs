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
  await expect(marker).toHaveAttribute('data-passed', '76');
  await expect(marker).toHaveAttribute('data-total', '76');
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
  await page.getByRole('checkbox', { name: 'Panika' }).evaluate(toggle => {
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Oznacz panikę i 0 Ochrony' }).click();
  const prompt = page.locator('.session-prompt');
  await expect(prompt.getByText('Co teraz?')).toBeVisible();
  await expect(prompt.getByRole('heading', { name: 'Postać jest spanikowana' })).toBeVisible();
  await expect(prompt.getByRole('button', { name: 'Rzut WOL', exact: true })).toBeVisible();
});


test('grouped inventory presents demo equipment by carry state', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const held = page.locator('details[data-inventory-group="held"]');
  const worn = page.locator('details[data-inventory-group="worn"]');
  const stored = page.locator('details[data-inventory-group="stored"]');
  await expect(held.getByText('Krótki łuk')).toBeVisible();
  await expect(worn.getByText('Skórzany kaftan')).toBeVisible();
  await expect(stored.getByText('Pochodnia')).toBeVisible();
  await expect(stored.getByText('Suszone racje')).toBeVisible();
  await expect(stored.getByText('Mosiężny gwizdek')).toBeVisible();
});

test('quick carry change updates automatic armor', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const leather = page.locator('[data-item-id]').filter({ hasText: 'Skórzany kaftan' });
  await leather.getByRole('button', { name: /Zmień sposób noszenia: Skórzany kaftan/ }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Schowane', exact: true }).click();
  const result = await page.evaluate(() => {
    const dev = globalThis.CairnSheetDev;
    const snapshot = dev.getState();
    return {
      carryState: snapshot.inventory.items.find(item => item.name === 'Skórzany kaftan')?.carryState,
      armor: dev.deriveArmor(snapshot).effective
    };
  });
  expect(result).toEqual({ carryState: 'stored', armor: 0 });
  await expect(page.locator('details[data-inventory-group="stored"]').getByText('Skórzany kaftan')).toBeVisible();
});

test('inventory quick use and detail sheet preserve session workflows', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const torch = page.locator('[data-item-id]').filter({ hasText: 'Pochodnia' });
  await torch.getByRole('button', { name: 'Użyj Pochodnia' }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Użyj i zmniejsz o 1' }).click();
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().inventory.items.find(item => item.name === 'Pochodnia')?.uses.current)).toBe(1);

  const bow = page.locator('[data-item-id]').filter({ hasText: 'Krótki łuk' });
  await bow.getByRole('button', { name: 'Szczegóły przedmiotu Krótki łuk' }).click();
  await expect(page.locator('#sheet').getByRole('heading', { name: 'Szczegóły przedmiotu' })).toBeVisible();
  await expect(page.locator('#sheet').getByText('Lekki łuk myśliwski.')).toBeVisible();
});

test('spent inventory is grouped and hides primary use actions', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const torch = page.locator('[data-item-id]').filter({ hasText: 'Pochodnia' });
  await torch.getByRole('button', { name: /Zmień sposób noszenia: Pochodnia/ }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Zużyte', exact: true }).click();
  const spent = page.locator('details[data-inventory-group="spent"]');
  await expect(spent).toBeVisible();
  expect(await spent.evaluate(element => element.open)).toBe(false);
  await spent.locator('summary').click();
  await expect(spent.getByText('Pochodnia')).toBeVisible();
  await expect(spent.getByRole('button', { name: 'Użyj Pochodnia' })).toHaveCount(0);
});
