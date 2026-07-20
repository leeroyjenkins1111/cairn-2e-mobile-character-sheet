const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
];

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    htmlClientWidth: document.documentElement.clientWidth,
    htmlScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  assert.ok(metrics.htmlScrollWidth <= metrics.htmlClientWidth + 1, `${label}: html overflow ${JSON.stringify(metrics)}`);
  assert.ok(metrics.bodyScrollWidth <= metrics.innerWidth + 1, `${label}: body overflow ${JSON.stringify(metrics)}`);
}

async function assertTapTargets(page, label) {
  const undersized = await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter((button) => {
    const style = getComputedStyle(button);
    const rect = button.getBoundingClientRect();
    const visible = style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    return visible && !button.disabled && (rect.height < 43.5 || rect.width < 43.5);
  }).map((button) => ({
    text: button.getAttribute('aria-label') || button.textContent.trim(),
    width: button.getBoundingClientRect().width,
    height: button.getBoundingClientRect().height,
  })));
  assert.deepEqual(undersized, [], `${label}: undersized tap targets ${JSON.stringify(undersized)}`);
}

async function auditViews(page, suffix) {
  for (const view of ['character', 'inventory', 'dice', 'more']) {
    await page.locator(`[data-nav="${view}"]`).click();
    await page.locator(`[data-view="${view}"]`).waitFor({ state: 'visible' });
    await assertNoHorizontalOverflow(page, `${view} ${suffix}`);
    await assertTapTargets(page, `${view} ${suffix}`);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: viewports[2] });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('http://127.0.0.1:4173/?selftest=1', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Uruchom tryb demonstracyjny' }).click();
  await page.getByRole('button', { name: 'Wczytaj demo' }).click();
  await page.locator('#view-character').waitFor({ state: 'visible' });

  const selftest = await page.locator('#selftestMarker').getAttribute('data-passed');
  const total = await page.locator('#selftestMarker').getAttribute('data-total');
  assert.equal(selftest, total, `embedded tests ${selftest}/${total}`);
  assert.equal(total, '45');

  const svgCount = await page.locator('svg[aria-hidden="true"], .nav-icon svg').count();
  assert.ok(svgCount >= 6, `expected inline SVG icons, found ${svgCount}`);

  await page.getByRole('button', { name: 'Obrażenia', exact: true }).click();
  assert.equal(await page.locator('.app-shell').evaluate((node) => node.inert), true, 'app shell should be inert behind sheet');
  assert.equal(await page.locator('#sheet').evaluate((node) => node.contains(document.activeElement)), true, 'focus should move into sheet');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.app-shell').evaluate((node) => node.inert), false, 'app shell inert should clear after sheet closes');

  await page.locator('[data-nav="inventory"]').click();
  const torch = page.locator('.inventory-item').filter({ hasText: 'Pochodnia' }).first();
  await torch.waitFor({ state: 'visible' });
  assert.equal(await torch.getByRole('button', { name: 'Użyj Pochodnia' }).count(), 1, 'resource item should expose one Use action');
  assert.equal(await torch.getByRole('button', { name: 'Więcej akcji dla Pochodnia' }).count(), 1, 'resource item should expose one More action');

  await page.locator('[data-nav="character"]').click();
  assert.equal(await page.locator('#view-character').getByText('Ostatnie zmiany', { exact: true }).count(), 0, 'change history should not remain on home');
  await page.locator('[data-nav="dice"]').click();
  assert.equal(await page.locator('#view-dice').getByText('Historia rzutów', { exact: true }).count(), 0, 'dice history should not remain in dice view');
  await page.locator('[data-nav="more"]').click();
  assert.equal(await page.locator('#view-more').getByText('Historia zmian', { exact: true }).count(), 1, 'change history should live in More');
  assert.equal(await page.locator('#view-more').getByText('Historia rzutów', { exact: true }).count(), 1, 'dice history should live in More');

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.reload({ waitUntil: 'networkidle' });
    await auditViews(page, `${viewport.width}x${viewport.height}`);
    await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; });
    await auditViews(page, `${viewport.width}x${viewport.height} text-125%`);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  }

  assert.deepEqual(consoleErrors, [], `browser console errors: ${JSON.stringify(consoleErrors)}`);
  await browser.close();
  console.log(`UI audit passed for ${viewports.map((value) => value.width).join(', ')} px and 125% text.`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
