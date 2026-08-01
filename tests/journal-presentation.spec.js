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

async function startSession(page, title = 'Ruiny pod mokradłami') {
  const journal = page.locator('#view-more');
  await journal.getByRole('button', { name: 'Rozpocznij sesję' }).first().click();
  const heading = page.getByRole('heading', { name: 'Rozpocznij sesję' });
  await expect(heading).toBeVisible();
  await page.getByLabel('Nazwa sesji').fill(title);
  await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click();
  await expect(heading).not.toBeVisible();
  await expect(journal.locator('.journal-quick-entry')).toHaveClass(/is-active/);
}

test.describe('czytelność dziennika kampanii', () => {
  test('oddziela szybki wpis od notatek postaci i historii przedmiotów', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoJournal(page);

    const journal = page.locator('#view-more');
    const quickEntry = journal.locator('.journal-quick-entry');
    await expect(quickEntry).toContainText('Szybki wpis');
    await expect(quickEntry).not.toContainText('To przykładowa karta. Nie zawiera danych z importu.');
    await expect(journal.getByRole('heading', { name: 'Szybka notatka' })).toHaveCount(0);

    const characterNotes = journal.locator('.journal-character-notes');
    await expect(characterNotes).toContainText('Notatki postaci');
    await expect(characterNotes).toContainText('To przykładowa karta. Nie zawiera danych z importu.');

    const itemStories = journal.locator('.journal-item-stories');
    await expect(itemStories).toContainText('Przedmioty i pochodzenie');
    await expect(itemStories).toContainText('Krótki łuk');
    await expect(itemStories).toContainText('Skórzany kaftan');

    const bow = itemStories.locator('.journal-item-story').filter({ hasText: 'Krótki łuk' });
    await bow.locator('summary').click();
    await expect(bow).toContainText('Lekki łuk myśliwski.');
    await expect(bow.getByRole('button', { name: 'Otwórz przedmiot' })).toBeVisible();
  });

  test('zapisuje kategoryzowany szybki wpis w aktywnej sesji', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoJournal(page);
    await startSession(page);

    const journal = page.locator('#view-more');
    await journal.getByRole('button', { name: 'Dodaj wpis: Trop' }).click();
    const heading = page.getByRole('heading', { name: 'Nowy wpis: Trop' });
    await expect(heading).toBeVisible();
    await page.getByLabel('Treść wpisu').fill('Ślady prowadzą z ruin do zatopionej kaplicy.');
    await page.getByRole('button', { name: 'Dodaj do sesji' }).click();
    await expect(heading).not.toBeVisible();

    const chronicle = journal.locator('.journal-chronicle');
    await expect(chronicle).toContainText('Kronika kampanii');
    await expect(chronicle).toContainText('Trop');
    await expect(chronicle).toContainText('Ślady prowadzą z ruin do zatopionej kaplicy.');
    await expect(chronicle).toContainText('Ruiny pod mokradłami');

    await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 5000 });
    await page.screenshot({
      path: 'ui-review-screenshots/04a-journal-campaign-entry-dark-390x844.png',
      fullPage: true
    });
  });

  test('zachowuje reflow i nie tworzy poziomego overflow na 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await loadDemoJournal(page);
    await startSession(page, 'Sesja na wąskim ekranie');

    const journal = page.locator('#view-more');
    await expect(journal.locator('.journal-entry-grid')).toBeVisible();

    const overflowingElements = await journal.locator('.journal-section, .journal-entry-type, .journal-item-story').evaluateAll(elements =>
      elements.filter(element => element.scrollWidth > element.clientWidth + 1).length
    );
    expect(overflowingElements).toBe(0);

    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(pageOverflows).toBe(false);
  });
});
