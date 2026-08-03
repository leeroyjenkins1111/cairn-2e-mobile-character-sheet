import { test, expect } from '@playwright/test';

async function loadDemoDice(page, width = 390, height = 844) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.diceRollFixes === 'true');
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toBeVisible();
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 5000 });
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await expect(page.locator('#view-dice')).toBeVisible();
}

test.describe('poprawki rzutu kośćmi', () => {
  test('pokazuje samą kość bez widocznego statusu i notacji', async ({ page }) => {
    await loadDemoDice(page);

    await page.getByRole('button', { name: 'Rzuć kością k20', exact: true }).click();

    const result = page.locator('#diceResult');
    await expect(result.locator('.result-die-object[data-sides="20"]')).toBeVisible();
    await expect(result.locator('.result-die-copy')).toBeHidden();
    await expect(result.locator('.result-die-context')).toHaveCount(0);
    await expect(result.locator('.result-die-notation')).toHaveCount(0);
    await expect(page.locator('#view-dice .dice-result-actions .section-caption')).toHaveCount(0);

    const visibleText = await result.innerText();
    expect(visibleText).not.toMatch(/kość w ruchu|wynik|rzut|k20/i);
  });

  test('wynik złożony nie udaje ściany pojedynczej kości', async ({ page }) => {
    await loadDemoDice(page);

    await page.getByRole('button', { name: 'Rzut własny' }).click();
    await page.getByLabel('Liczba kości').fill('2');
    await page.getByLabel('Kość', { exact: true }).selectOption('6');
    await page.getByLabel('Modyfikator').fill('1');
    await page.getByRole('button', { name: 'Rzuć', exact: true }).click();

    const result = page.locator('#diceResult');
    await expect(result.locator('.aggregate-dice-result')).toBeVisible();
    await expect(result.locator('.result-total-value')).not.toHaveText('');
    await expect(result.locator('.result-die-object')).toHaveCount(0);

    await page.getByRole('button', { name: 'Historia' }).click();
    await expect(page.locator('.dice-history-item').first()).toContainText('suma');
    await expect(page.locator('.dice-history-item').first()).toContainText('=');
  });

  test('odrzuca błędne dane zamiast po cichu je korygować', async ({ page }) => {
    await loadDemoDice(page);

    await page.getByRole('button', { name: 'Rzut własny' }).click();
    await page.getByLabel('Liczba kości').fill('101');
    await page.getByRole('button', { name: 'Rzuć', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Rzut własny' })).toBeVisible();
    await expect(page.locator('#toast')).toHaveClass(/show/);
    await expect(page.locator('#toast')).toContainText('od 1 do 100');
  });

  test('silnik zachowuje sumę, najwyższy wynik i modyfikator bez biasu modulo', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.diceRollFixes === 'true');

    const result = await page.evaluate(() => {
      const sumValues = [2, 5];
      const highValues = [2, 5, 3];
      let sumIndex = 0;
      let highIndex = 0;
      const sum = rollDice({ count: 2, sides: 6, modifier: 3 }, () => sumValues[sumIndex++]);
      const highest = rollDice({ count: 3, sides: 6, keepHighest: true, modifier: -1 }, () => highValues[highIndex++]);
      const errors = [];
      for (const config of [
        { count: 0, sides: 6 },
        { count: 1.5, sides: 6 },
        { count: 1, sides: 7 },
        { count: 1, sides: 6, modifier: 1000 }
      ]) {
        try { rollDice(config, () => 1); }
        catch (error) { errors.push(error.message); }
      }
      let invalidRoller = '';
      try { rollDice({ count: 1, sides: 6 }, () => 7); }
      catch (error) { invalidRoller = error.message; }
      return { sum, highest, errors, invalidRoller };
    });

    expect(result.sum).toEqual({ count: 2, sides: 6, modifier: 3, keepHighest: false, rolls: [2, 5], base: 7, total: 10 });
    expect(result.highest).toEqual({ count: 3, sides: 6, modifier: -1, keepHighest: true, rolls: [2, 5, 3], base: 5, total: 4 });
    expect(result.errors).toHaveLength(4);
    expect(result.invalidRoller).toContain('nieprawidłowy wynik');
  });

  test('wybiera bryłę kości, która rzeczywiście dała zachowany wynik', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(globalThis.CairnDiceRules));

    const visuals = await page.evaluate(() => ({
      mixed: CairnDiceRules.winningDamageVisual({
        rolls: [{ sides: 4, value: 3 }, { sides: 12, value: 9 }],
        total: 9
      }),
      sum: CairnDiceRules.visualForRollResult({ count: 2, sides: 6, modifier: 0, keepHighest: false, base: 9, total: 9 }),
      highest: CairnDiceRules.visualForRollResult({ count: 2, sides: 6, modifier: 0, keepHighest: true, base: 5, total: 5 })
    }));

    expect(visuals.mixed).toEqual({ kind: 'die', value: 9, sides: 12 });
    expect(visuals.sum).toEqual({ kind: 'total', value: 9, sides: null });
    expect(visuals.highest).toEqual({ kind: 'die', value: 5, sides: 6 });
  });

  test('k100 ma dwie czytelne kości procentowe i nadal renderuje wynik fizyczny', async ({ page }) => {
    await loadDemoDice(page);

    const icon = page.getByRole('button', { name: 'Rzuć kością k100', exact: true }).locator('svg[data-die="100"]');
    await expect(icon).toBeVisible();
    await expect(icon.locator('.percentile-icon-die')).toHaveCount(2);
    await expect(icon.locator('.percentile-icon-label-tens')).toHaveText('00');
    await expect(icon.locator('.percentile-icon-label-units')).toHaveText('0');

    await page.getByRole('button', { name: 'Rzuć kością k100', exact: true }).click();
    await expect(page.locator('#diceResult .result-die-object[data-sides="100"]')).toBeVisible();
    await expect(page.locator('#diceResult canvas.percentile-die')).toHaveCount(2);
  });

  test('nie tworzy poziomego overflow na 320 px', async ({ page }) => {
    await loadDemoDice(page, 320, 568);
    await page.getByRole('button', { name: 'Rzut własny' }).click();
    await page.getByLabel('Liczba kości').fill('4');
    await page.getByLabel('Kość', { exact: true }).selectOption('100');
    await page.getByLabel('Modyfikator').fill('10');
    await page.getByRole('button', { name: 'Rzuć', exact: true }).click();
    await expect(page.locator('#diceResult .aggregate-dice-result')).toBeVisible();

    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      view: document.querySelector('#view-dice').scrollWidth > document.querySelector('#view-dice').clientWidth + 1
    }));
    expect(overflow).toEqual({ page: false, view: false });
  });
});
