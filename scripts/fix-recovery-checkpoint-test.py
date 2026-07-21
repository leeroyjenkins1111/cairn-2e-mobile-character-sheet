from pathlib import Path

path = Path(__file__).resolve().parents[1] / "tests" / "app.spec.mjs"
text = path.read_text(encoding="utf-8")
old = """  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  await page.getByRole('button', { name: /Złoto: 11/ }).click();
  await page.locator('#sheet').getByRole('button', { name: '+10', exact: true }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Zapisz złoto' }).click();
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().stats.gold)).toBe(21);

  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
"""
new = """  const originalGold = await page.evaluate(() => globalThis.CairnSheetDev.getState().stats.gold);
  await page.getByRole('button', { name: 'Ekwipunek', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`Złoto: ${originalGold}`) }).click();
  await page.locator('#sheet').getByRole('button', { name: '+10', exact: true }).click();
  await page.locator('#sheet').getByRole('button', { name: 'Zapisz złoto' }).click();
  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().stats.gold)).toBe(originalGold + 10);

  await page.getByRole('button', { name: 'Ustawienia i dane' }).click();
"""
if text.count(old) != 1:
    raise RuntimeError(f"expected one gold workflow block, found {text.count(old)}")
text = text.replace(old, new, 1)
old_restore = "  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().stats.gold)).toBe(11);"
new_restore = "  await expect.poll(async () => page.evaluate(() => globalThis.CairnSheetDev.getState().stats.gold)).toBe(originalGold);"
if text.count(old_restore) != 1:
    raise RuntimeError(f"expected one restore gold assertion, found {text.count(old_restore)}")
path.write_text(text.replace(old_restore, new_restore, 1), encoding="utf-8")
