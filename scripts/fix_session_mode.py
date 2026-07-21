from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
TESTS = ROOT / "tests/app.spec.mjs"
CHECKSUMS = ROOT / "checksums.sha256"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


html = INDEX.read_text(encoding="utf-8")

# The new contextual prompt replaces the previous duplicate alert cards.
alerts_pattern = re.compile(r"  function inconsistencyAlerts\(\) \{.*?\n  // ============================================================\n  // 13\. Character view", re.S)
alerts_replacement = """  function inconsistencyAlerts() {
    const alerts = [];
    if (loadWarning) {
      alerts.push(createEl('div', { className: 'alert' }, [
        createEl('strong', { text: 'Uwaga dotycząca danych' }),
        createEl('p', { className: 'small wrap-anywhere', text: loadWarning })
      ]));
    }
    return alerts;
  }

  // ============================================================
  // 13. Character view"""
html, count = alerts_pattern.subn(alerts_replacement, html, count=1)
if count != 1:
    raise RuntimeError(f"inconsistency alerts replacement: expected one match, found {count}")

old_panicked_prompt = """    if (sourceState.conditions.panicked) {
      return {
        id: 'panicked',
        tone: 'warning',
        title: 'Postać jest spanikowana',
        message: 'Nie działa w pierwszej rundzie, a jej ataki są osłabione. Rzut obronny WOL jako akcja może usunąć Panikę.',
        primaryLabel: 'Rzut WOL',
        primaryAction: attemptRecoverFromPanic
      };
    }
"""
new_panicked_prompt = """    if (sourceState.conditions.panicked && sourceState.stats.hp.current > 0) {
      return {
        id: 'panicked-protection',
        tone: 'danger',
        title: 'Panika wymaga 0 Ochrony',
        message: 'Spanikowana postać ma 0 Ochrony, nie działa w pierwszej rundzie i atakuje jako osłabiona. Zastosuj brakującą konsekwencję stanu.',
        primaryLabel: 'Ustaw Ochronę na 0',
        primaryAction: applyPanickedProtectionRule
      };
    }
    if (sourceState.conditions.panicked) {
      return {
        id: 'panicked',
        tone: 'warning',
        title: 'Postać jest spanikowana',
        message: 'Nie działa w pierwszej rundzie, a jej ataki są osłabione. Rzut obronny WOL jako akcja może usunąć Panikę.',
        primaryLabel: 'Rzut WOL',
        primaryAction: attemptRecoverFromPanic
      };
    }
"""
html = replace_once(html, old_panicked_prompt, new_panicked_prompt, "panicked session prompt")

full_rule_anchor = """  function applyFullInventoryProtectionRule() {
"""
panicked_rule = """  function applyPanickedProtectionRule() {
    openConfirmSheet({
      title: 'Skutek Paniki',
      message: 'Zastosować 0 Ochrony dla spanikowanej postaci? Zmianę będzie można cofnąć.',
      confirmLabel: 'Ustaw 0 Ochrony',
      danger: true,
      onConfirm: () => commitChange('Panika: Ochrona spadła do 0', next => { next.stats.hp.current = 0; })
    });
  }

"""
html = replace_once(html, full_rule_anchor, panicked_rule + full_rule_anchor, "panicked rule action")

INDEX.write_text(html, encoding="utf-8")

tests = TESTS.read_text(encoding="utf-8")
old_test = """test('session prompt appears for urgent character state', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const fixture = globalThis.CairnSheetDev.createDemoState();
    fixture.conditions.panicked = true;
    fixture.stats.hp.current = 0;
    localStorage.setItem('cairn-mobile-sheet:state', JSON.stringify(fixture));
  });
  await page.reload();
  await expect(page.getByText('Co teraz?')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Postać jest spanikowana' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rzut WOL' })).toBeVisible();
});
"""
new_test = """test('session prompt appears for urgent character state', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: 'Stany postaci' }).click();
  await page.getByRole('checkbox', { name: 'Panika' }).check();
  await page.getByRole('button', { name: 'Oznacz panikę i 0 Ochrony' }).click();
  await expect(page.getByText('Co teraz?')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Postać jest spanikowana' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rzut WOL' })).toBeVisible();
});
"""
tests = replace_once(tests, old_test, new_test, "session prompt browser test")
TESTS.write_text(tests, encoding="utf-8")

checksum_lines = []
for name in ["index.html", "manifest.webmanifest", "service-worker.js", "icon.svg"]:
    digest = hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
    checksum_lines.append(f"{digest}  {name}")
CHECKSUMS.write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")

print("Removed duplicate alerts and corrected the session prompt browser test.")
