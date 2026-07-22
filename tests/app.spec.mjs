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
  const failures = await page.evaluate(() => globalThis.CairnSheetDev.runTests().filter(result => !result.pass));
  expect(failures).toEqual([]);
  await expect(marker).toHaveAttribute('data-passed', '102');
  await expect(marker).toHaveAttribute('data-total', '102');
});


test('application loads extracted same-origin CSS and JavaScript', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="stylesheet"][href="./styles/app.css"]')).toHaveCount(1);
  await expect(page.locator('script[src="./scripts/app.js"]')).toHaveCount(1);
  const result = await page.evaluate(() => ({
    version: globalThis.CairnSheetDev?.version,
    inlineStyles: document.querySelectorAll('style').length,
    inlineScripts: document.querySelectorAll('script:not([src])').length,
    stylesheetLoaded: Array.from(document.styleSheets).some(sheet => sheet.href?.endsWith('/styles/app.css'))
  }));
  expect(result).toEqual({ version: '0.18.0', inlineStyles: 0, inlineScripts: 0, stylesheetLoaded: true });
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
  await expect(page.getByRole('heading', { name: 'Twoja wyprawa w zasięgu kciuka' })).toBeVisible();
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
  await expect(page.getByText('Testy deweloperskie')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Jak zainstalować' })).toBeVisible();
});

test('session prompt appears for urgent character state', async ({ page }) => {
  await loadDemo(page);
  await page.locator('.secondary-action-grid').getByRole('button', { name: 'Stany', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Panika' }).evaluate(toggle => {
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Oznacz panikę i 0 Ochrony' }).click();
  const prompt = page.locator('.session-alert');
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
  await bow.getByRole('button', { name: /Szczegóły przedmiotu: Krótki łuk/ }).click();
  await expect(page.locator('#sheet').getByRole('heading', { name: 'Szczegóły przedmiotu' })).toBeVisible();
  await expect(page.locator('#sheet').getByText('Lekki łuk myśliwski.')).toBeVisible();
});

test('spent inventory is grouped and hides primary use actions', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const torch = page.locator('[data-item-id]').filter({ hasText: 'Pochodnia' });
  await torch.getByRole('button', { name: /Szczegóły przedmiotu: Pochodnia/ }).click();
  await page.locator('#sheet').getByRole('button', { name: /Sposób noszenia:/ }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Zużyte', exact: true }).click();
  const spent = page.locator('details[data-inventory-group="spent"]');
  await expect(spent).toBeVisible();
  expect(await spent.evaluate(element => element.open)).toBe(false);
  await spent.locator('summary').click();
  await expect(spent.getByText('Pochodnia')).toBeVisible();
  await expect(spent.getByRole('button', { name: 'Użyj Pochodnia' })).toHaveCount(0);
});

test('session workflow records changes and dice, then archives a summary', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await page.getByRole('button', { name: 'Rozpocznij sesję' }).click();
  await page.getByLabel('Nazwa sesji').fill('Wyprawa do ruin');
  await page.locator('#sheet').getByRole('button', { name: 'Rozpocznij', exact: true }).click();

  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const torch = page.locator('[data-item-id]').filter({ hasText: 'Pochodnia' });
  await torch.getByRole('button', { name: 'Użyj Pochodnia' }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Użyj i zmniejsz o 1' }).click();

  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k6' }).click();
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  const sessionCard = page.locator('.session-log-card');
  await expect(sessionCard.getByText('Wyprawa do ruin')).toBeVisible();
  await expect(sessionCard.getByText('Użyto: Pochodnia')).toBeVisible();
  await expect(sessionCard.getByText(/k6: \d+ \(1k6\)/)).toBeVisible();

  await sessionCard.getByRole('button', { name: 'Zakończ sesję' }).click();
  await page.getByLabel('Podsumowanie').fill('Odnaleziono przejście i wrócono bezpiecznie.');
  await page.locator('#sheet').getByRole('button', { name: 'Zakończ i zapisz' }).click();
  await expect(sessionCard.getByRole('button', { name: 'Rozpocznij sesję' })).toBeVisible();
  await sessionCard.getByText('Zakończone sesje').click();
  await expect(sessionCard.getByRole('button', { name: 'Otwórz sesję Wyprawa do ruin' })).toBeVisible();
});

test('schema 2 migrates to schema 3 and full backup preserves session log', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(() => {
    const dev = globalThis.CairnSheetDev;
    const old = dev.createDemoState();
    old.schemaVersion = 2;
    delete old.sessionLog;
    const migrated = dev.parseImportText(JSON.stringify(old)).candidate;

    const fixture = dev.createDemoState();
    dev.startSessionOn(fixture, 'Sesja kopii', '2026-01-01T10:00:00.000Z');
    dev.appendSessionEvent(fixture, { type: 'save', summary: 'Rzut obronny WOL' });
    dev.finishSessionOn(fixture, 'Podsumowanie', '2026-01-01T12:00:00.000Z');
    const restored = dev.parseImportText(JSON.stringify(dev.buildBackupPayload(fixture))).candidate;
    return {
      migratedSchema: migrated?.schemaVersion,
      migratedArchive: migrated?.sessionLog.archive.length,
      restoredTitle: restored?.sessionLog.archive[0]?.title,
      restoredSummary: restored?.sessionLog.archive[0]?.summary,
      markdown: dev.sessionReportMarkdown(restored?.sessionLog.archive[0], restored?.identity.name)
    };
  });
  expect(result.migratedSchema).toBe(3);
  expect(result.migratedArchive).toBe(0);
  expect(result.restoredTitle).toBe('Sesja kopii');
  expect(result.restoredSummary).toBe('Podsumowanie');
  expect(result.markdown).toContain('Rzut obronny WOL');
});

test('dice dashboard repeats the latest safe roll and owns its history', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k8' }).click();

  const first = await page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory[0]);
  expect(first.notation).toBe('1k8');
  await expect(page.locator('.dice-recent-strip')).toHaveCount(0);

  await page.getByRole('button', { name: 'Powtórz ostatni rzut: k8' }).click();
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory.length)).toBe(2);

  const repeated = await page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory.slice(0, 2));
  expect(repeated[0].notation).toBe('1k8');
  expect(repeated[0].repeat.kind).toBe('roll');
  expect(repeated[0].id).not.toBe(repeated[1].id);

  await page.locator('#diceResult').click();
  const history = page.locator('#sheet');
  await expect(history.getByRole('heading', { name: 'Historia rzutów' })).toBeVisible();
  await expect(history.getByRole('button', { name: 'Powtórz rzut: k8' })).toHaveCount(2);
});



test('manual recovery checkpoint restores the previous local character state', async ({ page }) => {
  await loadDemo(page);

  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await page.getByRole('button', { name: 'Zarządzaj punktami odzyskiwania' }).click();
  await page.getByRole('button', { name: 'Utwórz punkt odzyskiwania' }).click();
  await expect(page.locator('.recovery-checkpoint-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Zamknij panel' }).click();

  const originalGold = await page.evaluate(() => globalThis.CairnSheetDev.getState().stats.gold);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`Złoto: ${originalGold}`) }).click();
  await page.locator('#sheet').getByRole('button', { name: '+10', exact: true }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Zapisz złoto' }).click();
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().stats.gold)).toBe(originalGold + 10);

  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await page.getByRole('button', { name: 'Zarządzaj punktami odzyskiwania' }).click();
  await page.getByRole('button', { name: 'Odtwórz punkt odzyskiwania: Mara Ciernista' }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Odtwórz punkt', exact: true }).click();

  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().stats.gold)).toBe(originalGold);
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getRecoveryCheckpoints().length)).toBeGreaterThanOrEqual(1);
});

test('reset creates an automatic recovery checkpoint before clearing the card', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Zresetuj kartę' }).click();
  await page.getByLabel('Wpisz USUŃ').fill('USUŃ');
  await page.locator('#sheet').getByRole('button', { name: 'Usuń wszystkie dane karty' }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Tak, zabezpiecz i usuń' }).click();

  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().initialized)).toBe(false);
  const checkpoints = await page.evaluate(() => globalThis.CairnSheetDev.getRecoveryCheckpoints());
  expect(checkpoints).toHaveLength(1);
  expect(checkpoints[0].reason).toBe('Przed resetem karty');
  expect(checkpoints[0].characterName).toBe('Mara Ciernista');
});

test('confirmed import preserves the overwritten card as a recovery checkpoint', async ({ page }) => {
  await loadDemo(page);
  const replacement = await page.evaluate(() => {
    const fixture = globalThis.CairnSheetDev.createDemoState();
    fixture.identity.name = 'Następczyni';
    fixture.stats.gold = 3;
    return globalThis.CairnSheetDev.buildBackupPayload(fixture);
  });

  await page.locator('#backupFileInput').setInputFiles({
    name: 'replacement-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(replacement))
  });
  await page.locator('#sheet').getByRole('button', { name: 'Nadpisz kartę importem' }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Nadpisz kartę' }).click();

  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().identity.name)).toBe('Następczyni');
  const checkpoints = await page.evaluate(() => globalThis.CairnSheetDev.getRecoveryCheckpoints());
  expect(checkpoints).toHaveLength(1);
  expect(checkpoints[0].characterName).toBe('Mara Ciernista');
  expect(checkpoints[0].reason).toContain('Przed importem');
});


test('skip link reaches the main character content before persistent navigation', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Przejdź do głównego ekranu' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('bottom navigation exposes controlled views and announces a view change', async ({ page }) => {
  await loadDemo(page);
  const dice = page.getByRole('button', { name: 'Kości', exact: true });
  await expect(dice).toHaveAttribute('aria-controls', 'view-dice');
  await dice.click();
  await expect(dice).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Postać', exact: true })).not.toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#viewLiveRegion')).toHaveText('Widok: Kości');
  await expect(page).toHaveTitle(/Mara Ciernista — Kości — Cairn 2e/);
});

test('sheet announces its title first and Escape restores the invoking control', async ({ page }) => {
  await loadDemo(page);
  const settings = page.getByRole('button', { name: 'Ustawienia i dane' });
  await settings.focus();
  await settings.click();
  const title = page.locator('#sheetTitle');
  await expect(title).toHaveText('Ustawienia i dane');
  await expect(title).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(settings).toBeFocused();
});

test('core screens remain usable with 200 percent root text size', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await loadDemo(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  for (const name of ['Postać', 'Ekwipunek', 'Kości', 'Dziennik']) {
    await page.getByRole('button', { name, exact: true }).click();
    const layout = await page.evaluate(() => {
      window.scrollTo(1000, 0);
      const horizontalScroll = window.scrollX;
      window.scrollTo(0, 0);
      return {
        reportedOverflow: document.documentElement.scrollWidth - window.innerWidth,
        horizontalScroll,
        overflowingElements: Array.from(document.querySelectorAll('body *')).map(element => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return { element, style, rect };
        }).filter(({ style, rect }) => style.display !== 'none' && style.visibility !== 'hidden' && rect.width && (rect.left < -1 || rect.right > window.innerWidth + 1)).map(({ element, rect }) => ({
          selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${Array.from(element.classList).map(name => `.${name}`).join('')}`,
          left: Math.round(rect.left * 10) / 10,
          right: Math.round(rect.right * 10) / 10,
          width: Math.round(rect.width * 10) / 10
        })).slice(0, 12),
        clippedButtons: Array.from(document.querySelectorAll('button')).filter(button => {
          const style = getComputedStyle(button);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          const rect = button.getBoundingClientRect();
          if (!rect.width || !rect.height) return false;
          return rect.left < -1 || rect.right > window.innerWidth + 1;
        }).map(button => button.getAttribute('aria-label') || button.textContent.trim())
      };
    });
    expect(layout.horizontalScroll, `WebKit reported ${layout.reportedOverflow}px intrinsic overflow`).toBeLessThanOrEqual(1);
    expect(layout.overflowingElements).toEqual([]);
    expect(layout.clippedButtons).toEqual([]);
  }
});

test('game view keeps current state and core table actions without duplicate summaries', async ({ page }) => {
  await loadDemo(page);
  await expect(page.getByRole('heading', { name: 'Przy stole' })).toHaveCount(0);
  await expect(page.getByText('Ostatni rzut', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rozlicz obrażenia', exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rzut obronny', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Odpoczynek', exact: true })).toBeVisible();
  await expect(page.locator('.weapon-row')).toContainText('Krótki łuk');

  await page.getByRole('button', { name: 'Rzut obronny', exact: true }).click();
  await expect(page.locator('#sheet').getByRole('heading', { name: 'Rzut obronny' })).toBeVisible();
  await expect(page.locator('#sheet').getByRole('button', { name: /Rzut obronny Siła/ })).toBeVisible();
  await page.getByRole('button', { name: 'Zamknij panel' }).click();

  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await expect(page.locator('.combat-scenarios-disclosure')).not.toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await expect(page.getByText('Historia rzutów', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Karta postaci' })).toBeVisible();
});
