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
  test('wydziela rozdziały i główne sekcje kompaktowymi ramkami', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoJournal(page);

    const journal = page.locator('#view-more');
    const chapterStyles = await journal.locator(':scope > .journal-chapter-heading').evaluateAll(elements =>
      elements.map(element => {
        const style = getComputedStyle(element);
        return {
          borderWidth: style.borderTopWidth,
          borderStyle: style.borderTopStyle,
          paddingTop: Number.parseFloat(style.paddingTop),
          paddingLeft: Number.parseFloat(style.paddingLeft)
        };
      })
    );
    expect(chapterStyles).toHaveLength(2);
    expect(chapterStyles.every(style => style.borderWidth !== '0px' && style.borderStyle !== 'none')).toBe(true);
    expect(chapterStyles.every(style =>
      style.paddingTop >= 14
      && style.paddingTop <= 18
      && style.paddingLeft >= 18
      && style.paddingLeft <= 24
    )).toBe(true);

    const sectionStyles = await journal.locator(':scope > .journal-section').evaluateAll(elements =>
      elements.map(element => {
        const style = getComputedStyle(element);
        return {
          borderWidth: style.borderTopWidth,
          borderStyle: style.borderTopStyle,
          paddingTop: Number.parseFloat(style.paddingTop),
          paddingRight: Number.parseFloat(style.paddingRight),
          paddingBottom: Number.parseFloat(style.paddingBottom),
          paddingLeft: Number.parseFloat(style.paddingLeft)
        };
      })
    );
    expect(sectionStyles.length).toBeGreaterThan(6);
    expect(sectionStyles.every(style => style.borderWidth !== '0px' && style.borderStyle !== 'none')).toBe(true);
    expect(sectionStyles.every(style =>
      style.paddingTop >= 18
      && style.paddingTop <= 20
      && style.paddingRight >= 18
      && style.paddingRight <= 20
      && style.paddingBottom >= 18
      && style.paddingBottom <= 20
      && style.paddingLeft >= 18
      && style.paddingLeft <= 20
    )).toBe(true);
  });

  test('używa jednego separatora pod tytułem sekcji', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoJournal(page);

    const separators = await page.locator('#view-more > .journal-section > .section-heading').evaluateAll(headings =>
      headings
        .filter(heading => heading.nextElementSibling)
        .map(heading => {
          const firstContent = heading.nextElementSibling;
          const headingStyle = getComputedStyle(heading);
          const contentStyle = getComputedStyle(firstContent);
          const sectionStyle = getComputedStyle(heading.parentElement);
          return {
            headingBorderBottom: Number.parseFloat(headingStyle.borderBottomWidth),
            contentBorderTop: Number.parseFloat(contentStyle.borderTopWidth),
            sectionGap: Number.parseFloat(sectionStyle.rowGap || sectionStyle.gap)
          };
        })
    );

    // The demo currently renders this heading pattern in Szybki wpis,
    // Kronika kampanii and Przedmioty i pochodzenie.
    expect(separators.length).toBeGreaterThanOrEqual(3);
    expect(separators.every(separator => separator.headingBorderBottom === 1)).toBe(true);
    expect(separators.every(separator => separator.contentBorderTop === 0)).toBe(true);
    expect(separators.every(separator => separator.sectionGap >= 10)).toBe(true);
  });

  test('wydziela historie przedmiotów i wpisy kroniki jako osobne rekordy', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoJournal(page);

    const journal = page.locator('#view-more');
    const itemStory = journal.locator('.journal-item-story').first();
    await expect(itemStory).toBeVisible();
    await expect(itemStory).toHaveCSS('border-top-width', '1px');
    await expect(itemStory).toHaveCSS('border-top-style', 'solid');
    await expect(itemStory.locator('summary')).toHaveCSS('padding-top', '14px');

    await startSessionAndAddClue(page);

    const chronicleEntry = journal.locator('.journal-chronicle-entry').first();
    await expect(chronicleEntry).toBeVisible();
    await expect(chronicleEntry).toContainText('Znaki prowadzą do starej wieży.');
    await expect(chronicleEntry).toHaveCSS('border-top-width', '1px');
    await expect(chronicleEntry).toHaveCSS('border-top-style', 'solid');
    await expect(chronicleEntry).toHaveCSS('padding-top', '14px');
  });

  test('zachowuje kompaktowy spacing i brak poziomego overflow na 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await loadDemoJournal(page);

    const journal = page.locator('#view-more');
    const compactSpacing = await journal.evaluate(element => {
      const section = element.querySelector(':scope > .journal-section');
      const chapter = element.querySelector(':scope > .journal-chapter-heading');
      const innerRecord = element.querySelector('.journal-item-story > summary');
      const sectionStyle = getComputedStyle(section);
      const chapterStyle = getComputedStyle(chapter);
      const recordStyle = getComputedStyle(innerRecord);
      return {
        sectionPadding: Number.parseFloat(sectionStyle.paddingTop),
        chapterPadding: Number.parseFloat(chapterStyle.paddingTop),
        recordPadding: Number.parseFloat(recordStyle.paddingTop)
      };
    });
    expect(compactSpacing.sectionPadding).toBeGreaterThanOrEqual(14);
    expect(compactSpacing.sectionPadding).toBeLessThanOrEqual(16);
    expect(compactSpacing.chapterPadding).toBeGreaterThanOrEqual(14);
    expect(compactSpacing.chapterPadding).toBeLessThanOrEqual(16);
    expect(compactSpacing.recordPadding).toBeGreaterThanOrEqual(12);
    expect(compactSpacing.recordPadding).toBeLessThanOrEqual(14);

    const overflowing = await journal.locator('.journal-chapter-heading, .journal-section, .journal-item-story, .journal-disclosure').evaluateAll(elements =>
      elements.filter(element => element.scrollWidth > element.clientWidth + 1).length
    );
    expect(overflowing).toBe(0);

    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(pageOverflows).toBe(false);
  });
});
