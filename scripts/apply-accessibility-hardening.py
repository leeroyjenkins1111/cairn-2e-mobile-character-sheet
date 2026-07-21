from __future__ import annotations

from pathlib import Path
import hashlib
import json

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding='utf-8')


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return content.replace(old, new, 1)


index = read('index.html')

index = replace_once(index, "const APP_VERSION = '0.12.0';", "const APP_VERSION = '0.13.0';", 'app version')

accessibility_css = r'''
    /* Accessibility and real-device hardening v0.13.0. */
    :root {
      --visual-viewport-height: 100dvh;
      --visual-viewport-offset-top: 0px;
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }
    .skip-link {
      position: fixed;
      top: calc(env(safe-area-inset-top) + 8px);
      left: 50%;
      z-index: 300;
      max-width: calc(100% - 24px);
      min-height: 44px;
      padding: 11px 14px;
      border: 2px solid var(--amber-strong);
      border-radius: 12px;
      background: var(--bg-elev);
      color: var(--text);
      font-weight: 850;
      text-decoration: none;
      transform: translate(-50%, -180%);
      transition: transform 120ms ease;
    }
    .skip-link:focus { transform: translate(-50%, 0); box-shadow: var(--focus); }
    #main:focus { outline: none; }
    input, select, textarea { max-width: 100%; }
    .nav-btn > span:last-child { min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
    .sheet-backdrop {
      inset: auto 0 auto;
      top: var(--visual-viewport-offset-top);
      height: var(--visual-viewport-height);
    }
    .sheet { max-height: min(calc(var(--visual-viewport-height) - env(safe-area-inset-top)), 850px); }
    .sheet-body { scroll-padding-block: 24px 128px; }
    .sheet-head h2[tabindex="-1"] { border-radius: 8px; }
    .sheet-head h2[tabindex="-1"]:focus { outline: none; box-shadow: var(--focus); }

    @media (max-width: 430px) {
      .settings-row,
      .recovery-checkpoint-head { align-items: flex-start; flex-wrap: wrap; }
      .settings-row > :first-child,
      .recovery-checkpoint-copy { flex: 1 1 180px; min-width: 0; }
      .settings-row > .btn,
      .settings-row > .tag { flex: 0 1 auto; }
      .sheet-foot .button-row > .btn { flex-basis: 100%; }
    }

    @media (prefers-contrast: more) {
      :root {
        --line: rgba(255, 255, 255, 0.48);
        --muted: #ded5df;
        --faint: #c8bdca;
        --focus: 0 0 0 4px rgba(255, 222, 164, 0.78);
      }
      html[data-theme="light"] {
        --line: rgba(0, 0, 0, 0.46);
        --muted: #3f3841;
        --faint: #514952;
        --focus: 0 0 0 4px rgba(102, 58, 8, 0.68);
      }
      .card, .btn, .sheet, .bottom-nav, .report-block, .settings-sheet-section { box-shadow: none; }
    }

    @media (forced-colors: active) {
      .btn, .nav-btn, .card, .sheet, .report-block, .settings-sheet-section, .recovery-checkpoint-item {
        border: 1px solid CanvasText;
        forced-color-adjust: auto;
      }
      .nav-btn[aria-current="page"] { outline: 2px solid Highlight; outline-offset: -2px; }
      .skip-link, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
        outline: 3px solid Highlight;
        outline-offset: 2px;
        box-shadow: none;
      }
    }
'''
index = replace_once(index, '    @media (prefers-reduced-motion: reduce) {', accessibility_css + '\n    @media (prefers-reduced-motion: reduce) {', 'accessibility css insertion')

index = replace_once(index, '<body>\n  <div class="app-shell">', '<body>\n  <a class="skip-link" href="#main">Przejdź do treści karty</a>\n  <div class="app-shell">', 'skip link')
index = replace_once(index, '<main class="main" id="main">', '<main class="main" id="main" tabindex="-1" aria-label="Treść karty postaci">', 'main landmark')
index = replace_once(index, '<h2 id="sheetTitle">Panel</h2>', '<h2 id="sheetTitle" tabindex="-1">Panel</h2>', 'sheet title focus')
index = replace_once(index, '<div class="sr-only" id="liveRegion" aria-live="assertive" aria-atomic="true"></div>', '<div class="sr-only" id="liveRegion" aria-live="assertive" aria-atomic="true"></div>\n  <div class="sr-only" id="viewLiveRegion" aria-live="polite" aria-atomic="true"></div>', 'view live region')

nav_replacements = {
    '<button class="nav-btn" id="nav-character" type="button" data-nav="character" aria-current="page">': '<button class="nav-btn" id="nav-character" type="button" data-nav="character" aria-controls="view-character" aria-current="page">',
    '<button class="nav-btn" id="nav-inventory" type="button" data-nav="inventory">': '<button class="nav-btn" id="nav-inventory" type="button" data-nav="inventory" aria-controls="view-inventory">',
    '<button class="nav-btn" id="nav-dice" type="button" data-nav="dice">': '<button class="nav-btn" id="nav-dice" type="button" data-nav="dice" aria-controls="view-dice">',
    '<button class="nav-btn" id="nav-more" type="button" data-nav="more">': '<button class="nav-btn" id="nav-more" type="button" data-nav="more" aria-controls="view-more">',
}
for old, new in nav_replacements.items():
    index = replace_once(index, old, new, f'navigation {old}')

old_open_focus = '''    requestAnimationFrame(() => {
      const focusable = getSheetFocusable();
      (focusable[0] || $('#sheetCloseBtn')).focus();
    });'''
new_open_focus = '''    syncVisualViewport();
    requestAnimationFrame(() => {
      $('#sheetTitle').focus({ preventScroll: true });
    });'''
index = replace_once(index, old_open_focus, new_open_focus, 'sheet initial focus')

old_trap = '''    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }'''
new_trap = '''    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const title = $('#sheetTitle');
    if (event.shiftKey && (document.activeElement === first || document.activeElement === title)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }'''
index = replace_once(index, old_trap, new_trap, 'sheet focus trap')

old_view_block = '''  let activeView = 'character';

  function setView(view) {
    activeView = ['character','inventory','dice','more'].includes(view) ? view : 'character';
    for (const section of $$('[data-view]')) section.hidden = section.dataset.view !== activeView;
    for (const nav of $$('[data-nav]')) {
      if (nav.dataset.nav === activeView) nav.setAttribute('aria-current', 'page');
      else nav.removeAttribute('aria-current');
    }
    if (activeView === 'character') renderCharacterView();
    if (activeView === 'inventory') renderInventoryView();
    if (activeView === 'dice') renderDiceView();
    if (activeView === 'more') renderMoreView();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function renderAll() {
    document.documentElement.dataset.theme = state.settings.theme === 'light' ? 'light' : 'dark';
    $('#headerTitle').textContent = state.initialized ? state.identity.name || 'Karta Wędrowca' : 'Karta Wędrowca';
    $('#quickUndoBtn').disabled = !safeArray(state.changeHistory).some(entry => entry.undoable);
    renderCharacterView();
    renderInventoryView();
    renderDiceView();
    renderMoreView();
  }'''
new_view_block = '''  const VIEW_META = Object.freeze({
    character: { label: 'Postać' },
    inventory: { label: 'Ekwipunek' },
    dice: { label: 'Kości' },
    more: { label: 'Dziennik' }
  });
  let activeView = 'character';

  function updateViewAccessibility(announceChange = false) {
    const meta = VIEW_META[activeView] || VIEW_META.character;
    const characterName = state.initialized ? trimText(state.identity.name, 'Karta Wędrowca') : 'Karta Wędrowca';
    document.title = `${characterName} — ${meta.label} — Cairn 2e`;
    if (!announceChange) return;
    const live = $('#viewLiveRegion');
    if (!live) return;
    live.textContent = '';
    requestAnimationFrame(() => { live.textContent = `Widok: ${meta.label}`; });
  }

  function setView(view, { announceChange = false } = {}) {
    activeView = VIEW_META[view] ? view : 'character';
    for (const section of $$('[data-view]')) section.hidden = section.dataset.view !== activeView;
    for (const nav of $$('[data-nav]')) {
      if (nav.dataset.nav === activeView) nav.setAttribute('aria-current', 'page');
      else nav.removeAttribute('aria-current');
    }
    if (activeView === 'character') renderCharacterView();
    if (activeView === 'inventory') renderInventoryView();
    if (activeView === 'dice') renderDiceView();
    if (activeView === 'more') renderMoreView();
    updateViewAccessibility(announceChange);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function renderAll() {
    document.documentElement.dataset.theme = state.settings.theme === 'light' ? 'light' : 'dark';
    $('#headerTitle').textContent = state.initialized ? state.identity.name || 'Karta Wędrowca' : 'Karta Wędrowca';
    $('#quickUndoBtn').disabled = !safeArray(state.changeHistory).some(entry => entry.undoable);
    renderCharacterView();
    renderInventoryView();
    renderDiceView();
    renderMoreView();
    updateViewAccessibility(false);
  }'''
index = replace_once(index, old_view_block, new_view_block, 'view accessibility block')

viewport_helpers = '''

  function syncVisualViewport() {
    const viewport = globalThis.visualViewport;
    const height = Math.max(1, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 1));
    const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
    document.documentElement.style.setProperty('--visual-viewport-height', `${height}px`);
    document.documentElement.style.setProperty('--visual-viewport-offset-top', `${offsetTop}px`);
    return { height, offsetTop };
  }

  function keepSheetControlVisible(event) {
    const control = event.target;
    if (!(control instanceof Element) || !control.matches('input, select, textarea')) return;
    setTimeout(() => control.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' }), 80);
  }
'''
index = replace_once(index, '  function bindEvents() {', viewport_helpers + '\n  function bindEvents() {', 'visual viewport helpers')
index = replace_once(index, "    for (const nav of $$('[data-nav]')) nav.addEventListener('click', () => setView(nav.dataset.nav));", "    for (const nav of $$('[data-nav]')) nav.addEventListener('click', () => setView(nav.dataset.nav, { announceChange: true }));", 'navigation announcement binding')
index = replace_once(index, "    $('#sheet').addEventListener('keydown', trapSheetFocus);", "    $('#sheet').addEventListener('keydown', trapSheetFocus);\n    $('#sheet').addEventListener('focusin', keepSheetControlVisible);\n    window.addEventListener('resize', syncVisualViewport);\n    globalThis.visualViewport?.addEventListener('resize', syncVisualViewport);\n    globalThis.visualViewport?.addEventListener('scroll', syncVisualViewport);\n    syncVisualViewport();", 'viewport event bindings')

index = replace_once(index, "      deriveArmor,\n      createDemoState", "      deriveArmor,\n      syncVisualViewport,\n      updateViewAccessibility,\n      createDemoState", 'developer accessibility exports')

embedded_tests = '''
    test('98. Dokument ma link pomijający nawigację i fokusowalny główny obszar', () => { const skip = $('.skip-link'); assert(skip?.getAttribute('href') === '#main' && $('#main')?.getAttribute('tabindex') === '-1'); });
    test('99. Dolna nawigacja wskazuje kontrolowane widoki', () => { assert($$('[data-nav]').every(nav => nav.getAttribute('aria-controls') === `view-${nav.dataset.nav}`)); });
    test('100. Metadane widoku aktualizują tytuł dokumentu', () => { const previous = activeView; setView('dice'); assert(document.title.includes('Kości') && VIEW_META.dice.label === 'Kości'); setView(previous); });
    test('101. Dialog ma fokusowalny tytuł i obsługę Visual Viewport', () => { assert($('#sheetTitle')?.getAttribute('tabindex') === '-1' && typeof syncVisualViewport === 'function' && trapSheetFocus.toString().includes('document.activeElement === title')); });
'''
index = replace_once(index, '    return results;\n  }\n\n  function openTestResults()', embedded_tests + '    return results;\n  }\n\n  function openTestResults()', 'embedded accessibility tests')

write('index.html', index)

# Playwright regression coverage.
tests = read('tests/app.spec.mjs')
tests = replace_once(tests, "toHaveAttribute('data-passed', '97');", "toHaveAttribute('data-passed', '101');", 'playwright selftest passed count')
tests = replace_once(tests, "toHaveAttribute('data-total', '97');", "toHaveAttribute('data-total', '101');", 'playwright selftest total count')

tests += r'''

test('skip link reaches the main character content before persistent navigation', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Przejdź do treści karty' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('bottom navigation exposes controlled views and announces a view change', async ({ page }) => {
  await loadDemo(page);
  const dice = page.getByRole('button', { name: 'Kości', exact: true });
  await expect(dice).toHaveAttribute('aria-controls', 'view-dice');
  await dice.click();
  await expect(dice).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Postać', exact: true })).not.toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#viewLiveRegion')).toHaveText('Widok: Kości');
  await expect(page).toHaveTitle(/Mara Ciernista — Kości — Cairn 2e/);
});

test('sheet announces its title first and Escape restores the invoking control', async ({ page }) => {
  await loadDemo(page);
  const settings = page.getByRole('button', { name: 'Ustawienia i dane' });
  await settings.focus();
  await settings.click();
  const title = page.locator('#sheetTitle');
  await expect(title).toHaveText('Ustawienia i dane');
  await expect(title).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(settings).toBeFocused();
});

test('core screens remain usable with 200 percent root text size', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await loadDemo(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  for (const name of ['Postać', 'Ekwipunek', 'Kości', 'Dziennik']) {
    await page.getByRole('button', { name, exact: true }).click();
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      clippedButtons: Array.from(document.querySelectorAll('button')).filter(button => {
        const style = getComputedStyle(button);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = button.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        return rect.left < -1 || rect.right > window.innerWidth + 1;
      }).length
    }));
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.clippedButtons).toBe(0);
  }
});
'''
write('tests/app.spec.mjs', tests)

# Version metadata and release notes.
for path in ('package.json', 'package-lock.json'):
    content = read(path)
    content = content.replace('"version": "0.12.0"', '"version": "0.13.0"')
    write(path, content)

service_worker = read('service-worker.js')
service_worker = replace_once(service_worker, "const CACHE_NAME = 'cairn-mobile-sheet-v0.12.0';", "const CACHE_NAME = 'cairn-mobile-sheet-v0.13.0';", 'service worker cache')
write('service-worker.js', service_worker)

readme = read('README.md')
readme = replace_once(readme, '- trzy lokalne punkty odzyskiwania przed importem, resetem lub odtworzeniem;', '- trzy lokalne punkty odzyskiwania przed importem, resetem lub odtworzeniem;\n- dostępność mobilna: link pomijający nawigację, semantyczne przełączanie widoków, fokus dialogów, wsparcie klawiatury ekranowej i wysokiego kontrastu;', 'readme feature')
readme = replace_once(readme, 'Wersja 0.12.0 nadal używa `schemaVersion: 3`.', 'Wersja 0.13.0 nadal używa `schemaVersion: 3`.', 'readme version')
write('README.md', readme)

# Deployment checksums.
checksum_files = ['index.html', 'manifest.webmanifest', 'service-worker.js', 'icon.svg']
lines = []
for path in checksum_files:
    digest = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
    lines.append(f'{digest}  {path}')
write('checksums.sha256', '\n'.join(lines) + '\n')

print(json.dumps({
    'version': '0.13.0',
    'schemaVersion': 3,
    'embeddedTests': 101,
    'changed': ['README.md', 'checksums.sha256', 'index.html', 'package-lock.json', 'package.json', 'service-worker.js', 'tests/app.spec.mjs']
}, ensure_ascii=False))
