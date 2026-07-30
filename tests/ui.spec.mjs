import { test, expect } from '@playwright/test';

async function loadDemo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toBeVisible();
}

test('the primary application stylesheet is loaded', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="stylesheet"][href$="/styles/app.css"], link[rel="stylesheet"][href="./styles/app.css"]')).toHaveCount(1);
  const loaded = await page.evaluate(() => Array.from(document.styleSheets)
    .map(sheet => sheet.href)
    .filter(Boolean)
    .map(href => new URL(href).pathname));
  expect(loaded).toContain('/styles/app.css');
});

test('local forest artwork remains the application background', async ({ page, request }) => {
  const asset = await request.get('/assets/forest-background.jpg');
  expect(asset.ok()).toBeTruthy();
  expect(asset.headers()['content-type']).toContain('image/jpeg');

  await loadDemo(page);
  for (const name of ['Postać', 'Ekwipunek', 'Kości', 'Dziennik']) {
    await page.getByRole('button', { name, exact: true }).click();
    const art = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('.app-shell'), '::before');
      return { image: style.backgroundImage, position: style.position, pointerEvents: style.pointerEvents };
    });
    expect(art.image).toContain('forest-background.jpg');
    expect(art.position).toBe('fixed');
    expect(art.pointerEvents).toBe('none');
  }
});

test('all views expose distinct structures and update the header', async ({ page }) => {
  await loadDemo(page);
  await expect(page.locator('#headerTitle')).toHaveText('Postać');
  await expect(page.locator('.character-state')).toBeVisible();
  await expect(page.locator('.combat-launcher')).toBeVisible();

  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  await expect(page.locator('#headerTitle')).toHaveText('Ekwipunek');
  await expect(page.locator('.inventory-overview')).toBeVisible();
  await expect(page.locator('.inventory-list')).toBeVisible();

  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await expect(page.locator('#headerTitle')).toHaveText('Kości');
  await expect(page.locator('.dice-console')).toBeVisible();
  await expect(page.locator('.dice-rail')).toBeVisible();

  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await expect(page.locator('#headerTitle')).toHaveText('Dziennik');
  await expect(page.locator('.quick-note')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dossier postaci' })).toBeVisible();
});

test('character view exposes direct saves and core actions', async ({ page }) => {
  await loadDemo(page);
  await expect(page.locator('.character-session > .character-state')).toHaveCount(1);
  await expect(page.locator('.character-session > .combat-launcher')).toHaveCount(1);
  await expect(page.locator('.character-session > .game-actions')).toHaveCount(1);
  await expect(page.locator('.damage-primary-action')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rzut obronny', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Odpoczynek', exact: true })).toBeVisible();
});

test('prepared saves preserve the announced stake', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: /Przygotuj rzut obronny Siła, aktualna wartość/ }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Przygotuj rzut SIŁ');
  await page.getByRole('textbox', { name: /Co grozi przy porażce/ }).fill('Strażnicy mnie zauważą');
  await page.getByRole('button', { name: 'Rzuć 1k20' }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Rzut obronny SIŁ');
  await expect(page.locator('#sheet')).toContainText('Strażnicy mnie zauważą');
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory[0]?.details)).toContain('Stawka: Strażnicy mnie zauważą');
});

test('character sections align and visible copy is not clipped', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await loadDemo(page);

  const presentation = await page.evaluate(() => {
    const selectors = ['.identity-row', '.state-values', '.combat-launcher', '.game-actions'];
    const leftEdges = selectors.map(selector => Math.round(document.querySelector(selector).getBoundingClientRect().left * 10) / 10);
    const candidates = Array.from(document.querySelectorAll('.combat-weapon-copy strong, .combat-weapon-copy span, .compact-action span, .damage-primary-action span'))
      .filter(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      });
    const clipped = candidates
      .filter(element => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
      .map(element => element.textContent.trim());
    return { leftEdges, clipped };
  });

  expect(new Set(presentation.leftEdges).size).toBe(1);
  expect(presentation.clipped).toEqual([]);
});

test('failed save routes the Warden consequence without inventing an outcome', async ({ page }) => {
  await loadDemo(page);
  await page.evaluate(() => globalThis.CairnSheetDev.performSave('dex', 20, { stake: 'Pochodnia wpada do wody' }));
  await expect(page.locator('#sheetTitle')).toHaveText('Rzut obronny ZRE');
  await expect(page.locator('#sheet')).toContainText('Porażka uruchamia ustalony wcześniej skutek');
  await page.getByRole('button', { name: 'Rozpatrz skutek…' }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Rozpatrz skutek');
  await expect(page.locator('#sheet')).toContainText('Pochodnia wpada do wody');
  await expect(page.getByRole('button', { name: /Rozlicz obrażenia/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Zmień stan/ })).toBeVisible();
});

test('prepared weapon rolls damage and links to history', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: /Rzuć obrażenia przygotowaną bronią/ }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Obrażenia broni');
  await expect(page.locator('#sheet .dice-result strong')).toHaveText(/^[1-9]\d*$/);
  await page.getByRole('button', { name: 'Historia', exact: true }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Historia rzutów');
  await expect(page.locator('#sheet')).toContainText('Krótki łuk');
});

test('combat domain helpers expose the first round flow', async ({ page }) => {
  await loadDemo(page);
  const launcher = page.locator('.combat-launcher');
  await expect(launcher.getByRole('heading', { name: 'Walka' })).toBeVisible();
  await expect(launcher).toContainText('Krótki łuk');

  await page.evaluate(() => globalThis.CairnSheetDev.performFirstRoundDexSave(1));
  await expect(page.locator('#sheetTitle')).toHaveText('Pierwsza runda walki');
  await expect(page.locator('#sheet')).toContainText('Zadeklaruj ruch i jedno działanie');
});

test('panic state remains visible in combat and offers recovery', async ({ page }) => {
  await loadDemo(page);
  await page.locator('.secondary-action-grid').getByRole('button', { name: 'Stany', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Panika' }).evaluate(toggle => {
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Oznacz panikę i 0 Ochrony' }).click();

  await expect(page.locator('.combat-launcher')).toContainText('Osłabione');
  await expect(page.locator('.session-alert')).toContainText('Postać jest spanikowana');
  await expect(page.locator('.session-alert').getByRole('button', { name: 'Rzut WOL', exact: true })).toBeVisible();
});

test('inventory overview remains directly editable', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  await expect(page.locator('.inventory-overview')).toBeVisible();
  await expect(page.getByRole('button', { name: /Złoto:/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Dodaj przedmiot/ })).toBeVisible();
});

test('dice console keeps the latest result and history accessible', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k8' }).click();
  await expect(page.locator('#diceResult strong')).toHaveText(/^[1-8]$/);
  await page.locator('#diceResult').click();
  await expect(page.locator('#sheetTitle')).toHaveText('Historia rzutów');
});

test('journal separates session, quick notes and character dossier', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await expect(page.locator('.session-log-card')).toBeVisible();
  await expect(page.locator('.quick-note')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dossier postaci' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Karta postaci' })).toBeVisible();
});
