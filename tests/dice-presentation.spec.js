import { test, expect } from '@playwright/test';

async function loadDemoDice(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toBeVisible();
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 5000 });
  await page.getByRole('button', { name: 'Kości', exact: true }).click();
  await expect(page.locator('#view-dice')).toBeVisible();
}

test.describe('redesign ekranu Kości', () => {
  test('wydziela cztery zadaniowe moduły i centralny wynik', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoDice(page);

    const cards = page.locator('#view-dice > .dice-console, #view-dice > .quick-dice, #view-dice > .dice-utilities, #view-dice > .combat-scenarios');
    await expect(cards).toHaveCount(4);

    const cardStyles = await cards.evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element);
      return {
        borderWidth: style.borderTopWidth,
        borderStyle: style.borderTopStyle,
        paddingLeft: Number.parseFloat(style.paddingLeft),
        radius: Number.parseFloat(style.borderTopLeftRadius)
      };
    }));

    expect(cardStyles.every(style => style.borderWidth === '1px' && style.borderStyle === 'solid')).toBe(true);
    expect(cardStyles.every(style => style.paddingLeft >= 18 && style.radius >= 13)).toBe(true);

    const resultLayout = await page.locator('#diceResult .animated-dice-result').evaluate(element => {
      const style = getComputedStyle(element);
      return {
        columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
        textAlign: style.textAlign,
        justifyItems: style.justifyItems
      };
    });
    expect(resultLayout.columns).toBe(1);
    expect(resultLayout.textAlign).toBe('center');
    expect(resultLayout.justifyItems).toBe('center');

    const utilityLabel = await page.locator('#view-dice > .dice-utilities').evaluate(element =>
      getComputedStyle(element, '::before').content.replaceAll('"', '')
    );
    expect(utilityLabel).toBe('Inne rzuty');
  });

  test('pokazuje wszystkie szybkie kości bez poziomego przewijania', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoDice(page);

    const rail = page.locator('#view-dice .dice-rail');
    const buttons = rail.locator('.die-button');
    await expect(buttons).toHaveCount(7);

    for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
      await expect(page.getByRole('button', { name: `Rzuć kością k${sides}`, exact: true })).toBeVisible();
    }

    const layout = await rail.evaluate(element => {
      const style = getComputedStyle(element);
      return {
        display: style.display,
        columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
        overflows: element.scrollWidth > element.clientWidth + 1
      };
    });
    expect(layout).toEqual({ display: 'grid', columns: 4, overflows: false });

    await page.getByRole('button', { name: 'Rzuć kością k100', exact: true }).click();
    await expect(page.locator('#diceResult .result-die-object[data-sides="100"]')).toBeVisible();
  });

  test('zachowuje siatkę i brak overflow na 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await loadDemoDice(page);

    const compact = await page.locator('#view-dice').evaluate(element => {
      const card = element.querySelector(':scope > .dice-console');
      const rail = element.querySelector('.dice-rail');
      const result = element.querySelector('.animated-dice-result');
      const cardStyle = getComputedStyle(card);
      const railStyle = getComputedStyle(rail);
      const resultStyle = getComputedStyle(result);
      return {
        cardPadding: Number.parseFloat(cardStyle.paddingLeft),
        railColumns: railStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
        resultColumns: resultStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
        localOverflow: element.scrollWidth > element.clientWidth + 1,
        railOverflow: rail.scrollWidth > rail.clientWidth + 1
      };
    });

    expect(compact.cardPadding).toBeGreaterThanOrEqual(14);
    expect(compact.railColumns).toBe(4);
    expect(compact.resultColumns).toBe(1);
    expect(compact.localOverflow).toBe(false);
    expect(compact.railOverflow).toBe(false);

    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(pageOverflows).toBe(false);
  });
});
