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
  test('buduje centralny stół i kompaktowe moduły pomocnicze', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoDice(page);

    const cards = page.locator('#view-dice > .dice-console, #view-dice > .quick-dice, #view-dice > .dice-utilities, #view-dice > .combat-scenarios');
    await expect(cards).toHaveCount(4);

    const cardStyles = await cards.evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element);
      return {
        borderWidth: style.borderTopWidth,
        borderStyle: style.borderTopStyle,
        radius: Number.parseFloat(style.borderTopLeftRadius)
      };
    }));
    expect(cardStyles.every(style => style.borderWidth === '1px' && style.borderStyle === 'solid')).toBe(true);
    expect(cardStyles.every(style => style.radius >= 13)).toBe(true);

    const resultSlotPadding = await page.locator('#view-dice .dice-stage-result-slot').evaluate(element =>
      Number.parseFloat(getComputedStyle(element).paddingLeft)
    );
    expect(resultSlotPadding).toBeGreaterThanOrEqual(18);

    await expect(page.locator('#view-dice .dice-stage-actions')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Rzuć ponownie|Gotowe/ })).toHaveCount(0);

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
  });

  test('pokazuje siedem szybkich kości w jednym kompaktowym rzędzie', async ({ page }) => {
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
        overflows: element.scrollWidth > element.clientWidth + 1,
        height: element.getBoundingClientRect().height
      };
    });
    expect(layout.display).toBe('grid');
    expect(layout.columns).toBe(7);
    expect(layout.overflows).toBe(false);
    expect(layout.height).toBeLessThan(76);
  });

  test('ujawnia cyfrę dopiero po zakończeniu animacji renderera', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoDice(page);

    const value = page.locator('.dice-stage-value');
    await page.getByRole('button', { name: 'Rzuć kością k20', exact: true }).click();
    await expect(page.locator('#view-dice')).toHaveAttribute('data-dice-phase', 'rolling');
    await expect(value).toHaveText('');
    await expect(page.locator('#diceResult')).toHaveAttribute('aria-busy', 'false', { timeout: 2500 });
    await expect(page.locator('#view-dice')).toHaveAttribute('data-dice-phase', 'revealed', { timeout: 1000 });
    await expect(value).not.toHaveText('');
  });

  test('rozdziela dwie kości procentowe bez wzajemnego zasłaniania', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoDice(page);
    await page.getByRole('button', { name: 'Rzuć kością k100', exact: true }).click();

    const dice = page.locator('#diceResult .result-die-object[data-sides="100"] .percentile-die');
    await expect(dice).toHaveCount(2);
    const boxes = await dice.evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    }));
    const overlap = Math.max(0, Math.min(boxes[0].right, boxes[1].right) - Math.max(boxes[0].left, boxes[1].left));
    expect(overlap).toBeLessThan(Math.min(boxes[0].width, boxes[1].width) * .12);
  });

  test('zachowuje jeden rząd i brak overflow na 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await loadDemoDice(page);

    const compact = await page.locator('#view-dice').evaluate(element => {
      const slot = element.querySelector('.dice-stage-result-slot');
      const rail = element.querySelector('.dice-rail');
      const result = element.querySelector('.animated-dice-result');
      const slotStyle = getComputedStyle(slot);
      const railStyle = getComputedStyle(rail);
      const resultStyle = getComputedStyle(result);
      return {
        slotPadding: Number.parseFloat(slotStyle.paddingLeft),
        railColumns: railStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
        resultColumns: resultStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
        localOverflow: element.scrollWidth > element.clientWidth + 1,
        railOverflow: rail.scrollWidth > rail.clientWidth + 1
      };
    });

    expect(compact.slotPadding).toBeGreaterThanOrEqual(14);
    expect(compact.railColumns).toBe(7);
    expect(compact.resultColumns).toBe(1);
    expect(compact.localOverflow).toBe(false);
    expect(compact.railOverflow).toBe(false);

    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(pageOverflows).toBe(false);
  });
});
