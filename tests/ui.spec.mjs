import { test, expect } from '@playwright/test';

async function loadDemo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toBeVisible();
}

test('one consolidated application stylesheet is loaded without editorial overrides', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="stylesheet"]')).toHaveCount(1);
  await expect(page.locator('link[rel="stylesheet"][href="./styles/app.css"]')).toHaveCount(1);
  await expect(page.locator('link[href*="editorial.css"]')).toHaveCount(0);
  const loaded = await page.evaluate(() => Array.from(document.styleSheets).map(sheet => new URL(sheet.href).pathname));
  expect(loaded).toEqual(['/styles/app.css']);
});

test('all four views expose distinct app-like structures and the header names the active view', async ({ page }) => {
  await loadDemo(page);
  await expect(page.locator('#headerTitle')).toHaveText('Postać');
  await expect(page.locator('.character-state')).toBeVisible();
  await expect(page.locator('.protection-control')).toContainText('OCHR');
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toHaveCount(1);

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

test('character state prepares direct saves before rolling and preserves the announced stake', async ({ page }) => {
  await loadDemo(page);
  await expect(page.locator('.state-values > .protection-control')).toHaveCount(1);
  await expect(page.locator('.character-session > .character-state')).toHaveCount(1);
  await expect(page.locator('.character-session > .combat-launcher')).toHaveCount(1);
  await expect(page.locator('.character-session > .game-actions')).toHaveCount(1);
  await expect(page.locator('.secondary-stat')).toHaveCount(2);
  await expect(page.locator('.secondary-action-grid .compact-action')).toHaveCount(3);
  await expect(page.locator('.damage-primary-action')).toHaveCount(1);
  await expect(page.locator('.character-forest-motif[aria-hidden="true"]')).toHaveCount(1);
  await expect(page.locator('.character-state')).not.toContainText('najczęstsze przy stole');
  await expect(page.locator('.combat-launcher')).not.toContainText('ataki trafiają automatycznie');
  await expect(page.locator('.state-label-icon svg')).toHaveCount(3);
  await expect(page.locator('.section-title svg')).toHaveCount(1);
  await expect(page.locator('.attribute-glyph svg')).toHaveCount(3);
  await expect(page.locator('.protection-control')).not.toContainText('unikanie obrażeń');
  await expect(page.locator('.state-caption-icon')).toHaveCount(0);
  await expect(page.locator('.combat-launcher')).not.toContainText('Brak broni w rękach');
  await expect(page.locator('.combat-launcher')).not.toContainText('Atak bez broni');
  await expect(page.locator('.demo-badge')).toHaveCount(0);
  await expect(page.locator('.secondary-stat').first()).not.toContainText('sprzęt');

  await page.getByRole('button', { name: /Przygotuj rzut obronny Siła, aktualna wartość/ }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Przygotuj rzut SIŁ');
  await page.getByRole('textbox', { name: /Co grozi przy porażce/ }).fill('Strażnicy mnie zauważą');
  await page.getByRole('button', { name: 'Rzuć 1k20' }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Rzut obronny SIŁ');
  await expect(page.locator('#sheet')).toContainText('Strażnicy mnie zauważą');
  await expect(page.locator('#sheet')).toContainText('Warden opisuje');
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory[0]?.details)).toContain('Stawka: Strażnicy mnie zauważą');
});

test('compact character layout groups stats with spacing and does not clip interface copy', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await loadDemo(page);

  const presentation = await page.evaluate(() => {
    const style = selector => getComputedStyle(document.querySelector(selector));
    const copySelectors = [
      '.character-name',
      '.character-background',
      '.combat-weapon-copy strong',
      '.combat-weapon-copy span',
      '.combat-utility-action span:not(.sr-only)',
      '.compact-action span'
    ];
    const clipped = copySelectors.flatMap(selector => Array.from(document.querySelectorAll(selector)))
      .filter(element => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
      .map(element => element.textContent.trim());
    return {
      characterBorder: style('.character-state').borderTopWidth,
      protectionDivider: style('.protection-control').borderRightWidth,
      secondaryDivider: style('.secondary-stat + .secondary-stat').borderTopWidth,
      attributeBorder: style('.attribute-control').borderTopWidth,
      clipped
    };
  });

  expect(presentation).toEqual({
    characterBorder: '0px',
    protectionDivider: '0px',
    secondaryDivider: '0px',
    attributeBorder: '1px',
    clipped: []
  });
  await expect(page.locator('.combat-utility-action').first()).toContainText('Runda 1');
});

test('matte visual system avoids glossy panels and a brass-filled damage CTA', async ({ page }) => {
  await loadDemo(page);
  const character = await page.evaluate(() => {
    const damage = getComputedStyle(document.querySelector('.damage-primary-action'));
    const shell = getComputedStyle(document.querySelector('.app-shell'));
    return {
      damageShadow: damage.boxShadow,
      damageBackgroundImage: damage.backgroundImage,
      shellTexture: shell.backgroundImage
    };
  });
  expect(character.damageShadow).toBe('none');
  expect(character.damageBackgroundImage).toBe('none');
  expect(character.shellTexture).toContain('repeating-linear-gradient');

  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  await expect(page.locator('.inventory-overview')).toHaveCSS('border-top-width', '0px');
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await expect(page.locator('.quick-note')).toHaveCSS('border-left-width', '0px');
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
  await expect(page.getByRole('button', { name: /Obrażenia atrybutu/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Zmień stan/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Przejdź do ekwipunku/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tylko skutek w fikcji' })).toBeVisible();
});

test('prepared weapon shows its damage result in place and links to history', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: /Rzuć obrażenia przygotowaną bronią/ }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Obrażenia broni');
  await expect(page.locator('#sheet')).toContainText('Atak trafia automatycznie');
  await expect(page.locator('#sheet .dice-result strong')).toHaveText(/^[1-9]\d*$/);
  await page.getByRole('button', { name: 'Historia', exact: true }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Historia rzutów');
  await expect(page.locator('#sheet')).toContainText('Krótki łuk');
});

test('combat flow exposes first round, current equipment and Warden-bounded next steps', async ({ page }) => {
  await loadDemo(page);
  const launcher = page.locator('.combat-launcher');
  await expect(launcher.getByRole('heading', { name: 'Walka' })).toBeVisible();
  await expect(launcher).toContainText('Krótki łuk');
  await expect(launcher.getByRole('button', { name: 'Pierwsza runda · ZRE' })).toBeVisible();

  await page.evaluate(() => globalThis.CairnSheetDev.performFirstRoundDexSave(1));
  await expect(page.locator('#sheetTitle')).toHaveText('Pierwsza runda walki');
  await expect(page.locator('#sheet')).toContainText('Zadeklaruj ruch i jedno działanie');
  await page.getByRole('button', { name: 'Wybierz działanie' }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Walka');
  await expect(page.locator('#sheet')).toContainText('Ataki trafiają automatycznie');
  await expect(page.getByRole('button', { name: /Odwrót/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Otrzymaj obrażenia/ })).toBeVisible();
  await page.getByRole('button', { name: /Odwrót/ }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Przygotuj odwrót');
  await page.getByRole('textbox', { name: /Dokąd się wycofujesz/ }).fill('Za kamienne drzwi');
  await page.getByRole('button', { name: 'Rzuć ZRE na odwrót' }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Rzut obronny ZRE');
  await expect(page.locator('#sheet')).toContainText('Nie docieram bezpiecznie do: Za kamienne drzwi');
});

test('panic changes combat affordances to impaired attacks without hiding the Warden boundary', async ({ page }) => {
  await loadDemo(page);
  await page.locator('.secondary-action-grid').getByRole('button', { name: 'Stany', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Panika' }).evaluate(toggle => {
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Oznacz panikę i 0 Ochrony' }).click();

  const launcher = page.locator('.combat-launcher');
  await expect(launcher).toContainText('Osłabione');
  await expect(launcher.getByRole('button', { name: /Rzuć obrażenia przygotowaną bronią/ })).toContainText('k4');
  await launcher.getByRole('button', { name: 'Opcje walki' }).click();
  await expect(page.locator('#sheet')).toContainText('Ataki są osłabione do k4');
  await expect(page.getByRole('button', { name: /Wzmocniony/ })).toHaveCount(0);
  await expect(page.locator('#sheet')).toContainText('Warden może rozstrzygnąć szczególną sytuację inaczej');
});

test('multiple held weapons are chosen explicitly and dual attack uses their formulas', async ({ page }) => {
  await page.goto('/');
  const fixture = await page.evaluate(() => {
    const dev = globalThis.CairnSheetDev;
    const next = dev.createDemoState();
    next.inventory.items.push({
      ...next.inventory.items[0],
      id: 'test-sword',
      name: 'Żelazny miecz',
      damageFormula: dev.parseDamageFormulaNotation('d8'),
      carryState: 'held'
    });
    return next;
  });
  await page.addInitScript(value => localStorage.setItem('cairn-mobile-sheet:state', JSON.stringify(value)), fixture);
  await page.reload();

  const launcher = page.locator('.combat-launcher');
  await expect(launcher).toContainText('2 bronie w rękach');
  await expect(launcher.getByRole('button', { name: /Rzuć obrażenia przygotowaną bronią/ })).toHaveCount(0);
  await launcher.getByRole('button', { name: 'Wybierz przygotowaną broń do ataku' }).click();
  await expect(page.locator('#sheet')).toContainText('Krótki łuk');
  await expect(page.locator('#sheet')).toContainText('Żelazny miecz');
  await page.getByRole('button', { name: /Dwie bronie/ }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Dwie bronie');
  await expect(page.getByLabel('Pierwsza broń')).toContainText('Krótki łuk');
  await expect(page.getByLabel('Druga broń')).toContainText('Żelazny miecz');
  await page.getByRole('button', { name: 'Rzuć obiema' }).click();
  await expect(page.locator('#sheet')).toContainText('najwyższy');
});

test('stored weapon must be prepared before it receives a quick damage action', async ({ page }) => {
  await page.goto('/');
  const fixture = await page.evaluate(() => {
    const dev = globalThis.CairnSheetDev;
    const next = dev.createDemoState();
    next.inventory.items.push({
      ...next.inventory.items[0],
      id: 'stored-spear',
      name: 'Schowana włócznia',
      damageFormula: dev.parseDamageFormulaNotation('d8'),
      carryState: 'stored'
    });
    return next;
  });
  await page.addInitScript(value => localStorage.setItem('cairn-mobile-sheet:state', JSON.stringify(value)), fixture);
  await page.reload();
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const spear = page.locator('[data-item-id="stored-spear"]');
  await expect(spear.locator('.inventory-trailing-action')).toHaveCount(0);
  await spear.locator('.inventory-row-main').click();
  await page.getByRole('button', { name: 'Przygotuj do walki' }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Walka');
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().inventory.items.find(item => item.id === 'stored-spear')?.carryState)).toBe('held');
  await page.getByRole('button', { name: 'Wróć do gry' }).click();
  await expect(page.locator('[data-item-id="stored-spear"] .inventory-trailing-action')).toBeVisible();
});

test('rest requires explicit confirmation of safe fictional conditions', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Odpoczynek', exact: true }).click();
  await expect(page.locator('#sheetTitle')).toHaveText('Krótki odpoczynek');
  await expect(page.locator('#sheet')).toContainText('Potwierdź z Wardenem');
  await expect(page.getByRole('button', { name: /Warunki są bezpieczne — przywróć OCHR/ })).toBeVisible();
});

test('inventory rows are fully tappable and expose at most one trailing action', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const rows = page.locator('[data-item-id]');
  await expect(rows).toHaveCount(5);
  expect(await rows.evaluateAll(entries => entries.every(row => row.querySelectorAll(':scope > .inventory-trailing-action').length <= 1))).toBe(true);
  await expect(page.locator('.inventory-carry-button')).toHaveCount(0);

  const whistle = rows.filter({ hasText: 'Mosiężny gwizdek' });
  await whistle.locator('.inventory-row-main').click();
  await expect(page.locator('#sheetTitle')).toHaveText('Szczegóły przedmiotu');
  await expect(page.locator('#sheet')).toContainText('Mosiężny gwizdek');
});

test('bottom tab bar preserves semantics and does not cover the last inventory row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadDemo(page);
  const nav = page.locator('.bottom-nav');
  await expect(nav).toHaveCSS('position', 'fixed');
  await expect(page.getByRole('button', { name: 'Postać', exact: true })).toHaveAttribute('aria-current', 'page');

  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const lastRow = page.locator('.inventory-row').last();
  await lastRow.scrollIntoViewIfNeeded();
  const geometry = await page.evaluate(() => {
    const row = document.querySelector('.inventory-row:last-of-type') || [...document.querySelectorAll('.inventory-row')].at(-1);
    const nav = document.querySelector('.bottom-nav');
    const main = document.querySelector('.main');
    return {
      rowBottom: row.getBoundingClientRect().bottom,
      navTop: nav.getBoundingClientRect().top,
      mainPaddingBottom: parseFloat(getComputedStyle(main).paddingBottom),
      navHeight: nav.getBoundingClientRect().height
    };
  });
  expect(geometry.mainPaddingBottom).toBeGreaterThanOrEqual(geometry.navHeight);
  expect(geometry.rowBottom).toBeLessThanOrEqual(geometry.navTop + 1);
});

test('every quick die rolls immediately and repeat plus history stay close to the result', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
    await page.getByRole('button', { name: `Rzuć kością k${sides}`, exact: true }).click();
  }
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory.length)).toBe(7);
  await page.getByRole('button', { name: /Powtórz ostatni rzut:/ }).click();
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().diceHistory.length)).toBe(8);
  await page.getByRole('button', { name: 'Historia', exact: true }).first().click();
  await expect(page.locator('#sheetTitle')).toHaveText('Historia rzutów');
});

test('latest roll settles on a rendered 3D polyhedron and a newer roll interrupts the previous animation', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k8', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k20', exact: true }).click();

  const result = page.locator('#diceResult .animated-dice-result');
  await expect(result).toHaveClass(/settled/);
  const object = result.locator('.result-die-object');
  await expect(object).toHaveAttribute('data-sides', '20');
  await expect(object).toHaveAttribute('data-value', /^(?:[1-9]|1\d|20)$/);
  await expect(result.locator('.result-die-value')).toHaveText(/^(?:[1-9]|1\d|20)$/);
  const render = await result.locator('canvas.result-die-canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) painted += 1;
    return { width: canvas.width, height: canvas.height, painted };
  });
  expect(render.width).toBeGreaterThan(100);
  expect(render.height).toBeGreaterThan(100);
  expect(render.painted).toBeGreaterThan(500);
});

test('physical roll hides the value until it settles and emits gentle rotation ticks', async ({ page }) => {
  await page.addInitScript(() => {
    const calls = [];
    Object.defineProperty(globalThis, '__cairnHapticCalls', { value: calls });
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: pattern => { calls.push(pattern); return true; } });
  });
  await loadDemo(page);
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k12', exact: true }).click();
  const result = page.locator('#diceResult .animated-dice-result');
  await expect(result).toHaveClass(/rolling/);
  await expect(result.locator('.result-die-value')).toBeEmpty();
  await expect.poll(async () => page.evaluate(() => globalThis.__cairnHapticCalls.filter(pattern => Array.isArray(pattern) && pattern.join(',') === '6').length)).toBeGreaterThanOrEqual(4);
  await expect(result).toHaveClass(/settled/);
  await expect(result.locator('.result-die-value')).toHaveText(/^(?:[1-9]|1[0-2])$/);
  const calls = await page.evaluate(() => globalThis.__cairnHapticCalls);
  expect(calls.filter(pattern => Array.isArray(pattern) && pattern.join(',') === '6').length).toBe(9);
});

test('in-app motion setting settles dice immediately and persists the preference', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await page.getByRole('checkbox', { name: 'Animacje interfejsu' }).uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true');
  await page.getByRole('button', { name: 'Gotowe' }).click();
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k12', exact: true }).click();
  await expect(page.locator('#diceResult .animated-dice-result')).toHaveClass(/settled/);
  await expect(page.locator('#diceResult')).not.toContainText('Kość w ruchu');
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().settings.reducedMotionOverride)).toBe(true);
});

test('haptic feedback is short, optional and disabled from settings', async ({ page }) => {
  await page.addInitScript(() => {
    const calls = [];
    Object.defineProperty(globalThis, '__cairnHapticCalls', { value: calls });
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: pattern => { calls.push(pattern); return true; } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadDemo(page);
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await page.getByRole('button', { name: 'Rzuć kością k6', exact: true }).click();
  await expect.poll(async () => page.evaluate(() => globalThis.__cairnHapticCalls.length)).toBe(1);

  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await page.getByRole('checkbox', { name: 'Haptyka' }).uncheck();
  await page.getByRole('button', { name: 'Gotowe' }).click();
  await page.getByRole('button', { name: 'Rzuć kością k8', exact: true }).click();
  await expect.poll(async () => page.evaluate(() => globalThis.__cairnHapticCalls.length)).toBe(1);
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().settings.hapticsEnabled)).toBe(false);
});

test('custom roll and item details use dismissible sheets with restored focus', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  const custom = page.getByRole('button', { name: /Rzut własny/ });
  await custom.focus();
  await custom.click();
  await expect(page.locator('#sheetTitle')).toHaveText('Rzut własny');
  await page.keyboard.press('Escape');
  await expect(custom).toBeFocused();

  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  const item = page.getByRole('button', { name: /Szczegóły przedmiotu: Krótki łuk/ });
  await item.click();
  await expect(page.locator('#sheetBackdrop')).toHaveClass(/open/);
  await page.getByRole('button', { name: 'Zamknij panel' }).click();
  await expect(item).toBeFocused();
});

test('dark and light appearances use distinct readable color schemes', async ({ page }) => {
  await loadDemo(page);
  const dark = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.body).color }));
  expect(dark.theme).toBe('dark');

  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
  await page.getByRole('checkbox', { name: 'Jasny motyw' }).check();
  const light = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.body).color }));
  expect(light.theme).toBe('light');
  expect(light.bg).not.toBe(dark.bg);
  expect(light.color).not.toBe(dark.color);
});

test('forced colors keeps primary actions and navigation perceivable', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colors emulation is Chromium-specific.');
  await page.emulateMedia({ forcedColors: 'active' });
  await loadDemo(page);
  const result = await page.evaluate(() => ({
    activeNavBg: getComputedStyle(document.querySelector('.nav-btn[aria-current="page"]')).backgroundColor,
    primaryBg: getComputedStyle(document.querySelector('.damage-primary-action')).backgroundColor,
    bodyBg: getComputedStyle(document.body).backgroundColor
  }));
  expect(result.activeNavBg).not.toBe(result.bodyBg);
  expect(result.primaryBg).not.toBe('rgba(0, 0, 0, 0)');
});

test('journal orders session, quick note, recent entries, then dossier', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  const order = await page.locator('#view-more > section').evaluateAll(sections => sections.map(section => section.className));
  expect(order[0]).toContain('session-log-card');
  expect(order[1]).toContain('quick-note');
  expect(order[2]).toContain('recent-journal');
  expect(order[3]).toContain('dossier-intro');
  await expect(page.getByText('Historia rzutów', { exact: true })).toHaveCount(0);
});
