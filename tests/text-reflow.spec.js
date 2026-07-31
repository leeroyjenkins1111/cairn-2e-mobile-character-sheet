import { test, expect } from '@playwright/test';

async function loadDemo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await expect(page.getByRole('heading', { name: 'Mara Ciernista' })).toBeVisible();
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 5000 });
}

async function expectNoClippedInterfaceText(page, context) {
  const clipped = await page.evaluate(() => {
    const activeView = document.querySelector('.view:not([hidden])');
    const roots = [document.querySelector('.app-header'), activeView, document.querySelector('.bottom-nav')].filter(Boolean);
    const candidates = roots.flatMap(root => [...root.querySelectorAll([
      '.brand-title',
      '.nav-btn > span:last-child',
      'h1', 'h2', 'h3',
      'label',
      'strong',
      '.btn:not(.btn-icon)',
      '.action-row small',
      '.inventory-row-title strong',
      '.combat-main-copy strong',
      '.combat-weapon-copy strong'
    ].join(','))]);

    return candidates.flatMap(element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2 || style.display === 'none' || style.visibility === 'hidden') return [];

      const lineClamp = Number.parseInt(style.webkitLineClamp, 10);
      const hiddenOverflow = ['hidden', 'clip'].includes(style.overflowX);
      const clippedWidth = hiddenOverflow && element.scrollWidth > element.clientWidth + 1;
      const clippedHeight = ['hidden', 'clip'].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
      const truncates = style.textOverflow === 'ellipsis' || (Number.isFinite(lineClamp) && lineClamp > 0);

      if (!clippedWidth && !clippedHeight && !truncates) return [];
      return [{
        tag: element.tagName.toLowerCase(),
        className: element.className,
        text: element.textContent.trim().slice(0, 120),
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        textOverflow: style.textOverflow,
        lineClamp: style.webkitLineClamp,
        client: [element.clientWidth, element.clientHeight],
        scroll: [element.scrollWidth, element.scrollHeight]
      }];
    });
  });

  expect(clipped, `${context}: visible interface text must wrap instead of being clipped`).toEqual([]);
}

for (const theme of ['dark', 'light']) {
  test(`main views do not clip interface text in ${theme} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await loadDemo(page);

    if (theme === 'light') {
      await page.evaluate(() => {
        document.documentElement.dataset.theme = 'light';
        localStorage.setItem('cairn-theme', 'light');
      });
    }

    const views = ['Postać', 'Ekwipunek', 'Kości', 'Dziennik'];
    for (const view of views) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await expect(page.locator('.view:not([hidden])')).toBeVisible();
      await expectNoClippedInterfaceText(page, `${theme}/${view}`);
    }
  });
}
