import { test, expect } from '@playwright/test';

async function loadDemo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toBeVisible();
}

test('application loads local CSS and split production JavaScript', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="stylesheet"][href$="/styles/app.css"], link[rel="stylesheet"][href="./styles/app.css"]')).toHaveCount(1);
  await expect(page.locator('script[src^="./scripts/app-core.js"]')).toHaveCount(1);
  await expect(page.locator('script[src^="./scripts/app-bootstrap.js"]')).toHaveCount(1);
  await expect(page.locator('script[src^="./scripts/app.js"]')).toHaveCount(0);

  const result = await page.evaluate(() => ({
    version: globalThis.CairnSheetDev?.version,
    inlineScripts: document.querySelectorAll('script:not([src])').length,
    appStylesheetLoaded: Array.from(document.styleSheets).some(sheet => sheet.href?.endsWith('/styles/app.css'))
  }));

  expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(result.inlineScripts).toBe(0);
  expect(result.appStylesheetLoaded).toBe(true);
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
    const legacy = dev.parseImportText(JSON.stringify({
      appId: 'cairn-mobile-sheet',
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      character: {
        identity: fixture.identity,
        stats: fixture.stats,
        inventory: fixture.inventory,
        conditions: fixture.conditions,
        scars: fixture.scars,
        notes: fixture.notes
      },
      source: fixture.source
    }));
    return {
      full: { name: full.candidate?.identity.name, gold: full.candidate?.stats.gold, items: full.candidate?.inventory.items.length, scars: full.candidate?.scars.length },
      legacy: { name: legacy.candidate?.identity.name, gold: legacy.candidate?.stats.gold, items: legacy.candidate?.inventory.items.length, scars: legacy.candidate?.scars.length }
    };
  });

  expect(result.full).toEqual({ name: 'Mara Ciernista', gold: 37, items: 5, scars: 1 });
  expect(result.legacy).toEqual(result.full);
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 414, height: 896 }
]) {
  test(`core screens have no horizontal document overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await loadDemo(page);
    for (const name of ['Postać', 'Ekwipunek', 'Kości', 'Dziennik']) {
      await page.getByRole('button', { name, exact: true }).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
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

test('application shell reloads offline after Service Worker activation', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Offline Service Worker reload is covered in Chromium.');
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();

  await expect.poll(() => page.evaluate(async () => {
    const names = await caches.keys();
    const appCache = names.find(name => name.startsWith('cairn-mobile-sheet-v'));
    if (!appCache) return false;
    const requests = await (await caches.open(appCache)).keys();
    return requests.some(request => new URL(request.url).pathname.endsWith('/assets/forest-background.jpg'));
  })).toBe(true);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-shell')).toBeVisible();
  await context.setOffline(false);
});

test('settings and technical data are separated from the player journal', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dossier postaci' })).toBeVisible();
  await expect(page.getByText('Dane i kopie zapasowe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await expect(page.getByRole('heading', { name: 'Ustawienia i dane' })).toBeVisible();
  await expect(page.getByText('Dane i kopie zapasowe')).toBeVisible();
});

test('grouped inventory presents demo equipment by carry state', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  await expect(page.locator('details[data-inventory-group="held"]').getByText('Krótki łuk')).toBeVisible();
  await expect(page.locator('details[data-inventory-group="worn"]').getByText('Skórzany kaftan')).toBeVisible();
  await expect(page.locator('details[data-inventory-group="stored"]').getByText('Pochodnia')).toBeVisible();
});

test('quick carry change updates automatic armor', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const leather = page.locator('[data-item-id]').filter({ hasText: 'Skórzany kaftan' });
  await leather.getByRole('button', { name: /Szczegóły przedmiotu: Skórzany kaftan/ }).click();
  await page.locator('#sheet').getByRole('button', { name: /Sposób noszenia:/ }).click();
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
});

test('session workflow records and archives activity', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await page.getByRole('button', { name: 'Rozpocznij sesję' }).click();
  await page.getByLabel('Nazwa sesji').fill('Wyprawa do ruin');
  await page.locator('#sheet').getByRole('button', { name: 'Rozpocznij', exact: true }).click();

  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k6' }).click();
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();

  const card = page.locator('.session-log-card');
  await expect(card.getByText('Wyprawa do ruin')).toBeVisible();
  await card.getByRole('button', { name: 'Zakończ sesję' }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Zakończ i zapisz' }).click();
  await expect(card.getByRole('button', { name: 'Rozpocznij sesję' })).toBeVisible();
});

test('skip link reaches the main content', async ({ page, browserName }) => {
  await page.goto('/');
  const skip = page.getByRole('link', { name: 'Przejdź do głównego ekranu' });
  if (browserName === 'webkit') await skip.focus();
  else await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('bottom navigation exposes controlled views and announces changes', async ({ page }) => {
  await loadDemo(page);
  const dice = page.getByRole('button', { name: 'Kości', exact: true });
  await expect(dice).toHaveAttribute('aria-controls', 'view-dice');
  await dice.click();
  await expect(dice).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#viewLiveRegion')).toHaveText('Widok: Kości');
});

test('sheet announces its title and Escape restores focus', async ({ page }) => {
  await loadDemo(page);
  const settings = page.getByRole('button', { name: 'Ustawienia i dane' });
  await settings.focus();
  await settings.click();
  await expect(page.locator('#sheetTitle')).toHaveText('Ustawienia i dane');
  await expect(page.locator('#sheetTitle')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(settings).toBeFocused();
});

test('core screens remain horizontally usable at 200 percent text size', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await loadDemo(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });

  for (const name of ['Postać', 'Ekwipunek', 'Kości', 'Dziennik']) {
    await page.getByRole('button', { name, exact: true }).click();
    const layout = await page.evaluate(() => {
      window.scrollTo(1000, 0);
      const horizontalScroll = window.scrollX;
      window.scrollTo(0, 0);
      return { horizontalScroll, documentOverflow: document.documentElement.scrollWidth - window.innerWidth };
    });
    expect(layout.horizontalScroll, `Intrinsic overflow: ${layout.documentOverflow}px`).toBeLessThanOrEqual(1);
  }
});
