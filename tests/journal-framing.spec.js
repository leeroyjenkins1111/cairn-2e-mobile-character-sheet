import { test, expect } from '@playwright/test';

async function loadDemoJournal(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toBeVisible();
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 5000 });
  await page.getByRole('button', { name: 'Dziennik', exact: true }).click();
  await expect(page.locator('#view-more')).toBeVisible();
}

async function startSessionAndAddClue(page) {
  const journal = page.locator('#view-more');
  await journal.getByRole('button', { name: 'Rozpocznij sesję' }).first().click();
  const startHeading = page.getByRole('heading', { name: 'Rozpocznij sesję' });
  await expect(startHeading).toBeVisible();
  await page.getByLabel('Nazwa sesji').fill('Próba obramowania');
  await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click();
  await expect(startHeading).not.toBeVisible();

  await journal.getByRole('button', { name: 'Dodaj wpis: Trop' }).click();
  const entryHeading = page.getByRole('heading', { name: 'Nowy wpis: Trop' });
  await expect(entryHeading).toBeVisible();
  await page.getByLabel('Treść wpisu').fill('Znaki prowadzą do starej wieży.');
  await page.getByRole('button', { name: 'Dodaj do sesji' }).click();
  await expect(entryHeading).not.toBeVisible();
}

test.describe('wizualne grupowanie dziennika', () => {
  test('wydziela rozdziały i główne sekcje ramkami', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoJournal(page);

    const journal = page.locator('#view-more');
    const chapterStyles = await journal.locator(':scope > .journal-chapter-heading').evaluateAll(elements =>
      elements.map(element => {
        const style = getComputedStyle(element);
        return {
          borderWidth: style.borderTopWidth,
          borderStyle: style.borderTopStyle,
          background: style.backgroundColor
        };
      })
    );
    expect(chapterStyles).toHaveLength(2);
    expect(chapterStyles.every(style => style.borderWidth !== '0px' && style.borderStyle !== 'none')).toBe(true);

    const sectionStyles = await journal.locator(':scope > .journal-section').evaluateAll(elements =>
      elements.map(element => {
        const style = getComputedStyle(element);
        return {
          borderWidth: style.borderTopWidth,
          borderStyle: style.borderTopStyle,
          background: style.backgroundColor
        };
      })
    );
    expect(sectionStyles.length).toBeGreaterThan(6);
    expect(sectionStyles.every(style => style.borderWidth !== '0px' && style.borderStyle !== 'none')).toBe(true);
  });

  test('wydziela historie przedmiotów i wpisy kroniki jako osobne rekordy', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoJournal(page);

    const journal = page.locator('#view-more');
    const itemStory = journal.locator('.journal-item-story').first();
    await expect(itemStory).toBeVisible();
    await expect(itemStory).toHaveCSS('border-top-width', '1px');
    await expect(itemStory).toHaveCSS('border-top-style', 'solid');

    await startSessionAndAddClue(page);

    const chronicleEntry = journal.locator('.journal-chronicle-entry').first();
    await expect(chronicleEntry).toBeVisible();
    await expect(chronicleEntry).toContainText('Znaki prowadzą do starej wieży.');
    await expect(chronicleEntry).toHaveCSS('border-top-width', '1px');
    await expect(chronicleEntry).toHaveCSS('border-top-style', 'solid');
  });

  test('zachowuje ramki bez poziomego overflow na 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await loadDemoJournal(page);

    const journal = page.locator('#view-more');
    const overflowing = await journal.locator('.journal-chapter-heading, .journal-section, .journal-item-story, .journal-disclosure').evaluateAll(elements =>
      elements.filter(element => element.scrollWidth > element.clientWidth + 1).length
    );
    expect(overflowing).toBe(0);

    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(pageOverflows).toBe(false);
  });
});
