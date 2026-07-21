from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def regex_replace_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return updated


app = read("scripts/app.js")
if "session-glance-card" in app or "Session-first UX v0.15.0" in read("styles/app.css"):
    raise RuntimeError("Session-first UX appears to be applied already")

app = replace_once(app, "const APP_VERSION = '0.14.0';", "const APP_VERSION = '0.15.0';", "APP_VERSION")
app = replace_once(app, "const hero = card([], 'compact-hero');", "const hero = card([], 'compact-hero session-hero');", "session hero class")
app = replace_once(
    app,
    "  hero.append(statusStrip);\n",
    "  hero.append(statusStrip);\n"
    "  const protectionRatio = state.stats.hp.max > 0 ? clamp(state.stats.hp.current / state.stats.hp.max, 0, 1) : 0;\n"
    "  const protectionMeter = createEl('div', {\n"
    "    className: 'protection-meter',\n"
    "    attrs: { 'aria-hidden': 'true' }\n"
    "  });\n"
    "  protectionMeter.style.setProperty('--protection-ratio', String(protectionRatio));\n"
    "  hero.append(protectionMeter);\n",
    "protection meter",
)

session_glance = r'''
function renderSessionGlanceCard() {
  const latest = recentDiceEntries(state, 1)[0] || null;
  const activeItems = activeEquipmentItems();
  const activeSummary = activeItems.length
    ? `${activeItems[0].name}${activeItems.length > 1 ? ` +${activeItems.length - 1}` : ''}`
    : 'Brak aktywnego sprzętu';
  const note = trimText(state.notes);
  const needsAttention = Boolean(sessionPromptFor());
  const glance = card([], 'session-glance-card');

  glance.append(createEl('div', { className: 'session-glance-head' }, [
    createEl('div', {}, [
      createEl('p', { className: 'session-glance-kicker', text: 'Sesyjny skrót' }),
      createEl('h2', { text: 'Przy stole' })
    ]),
    createEl('span', {
      className: `session-glance-state${needsAttention ? ' needs-attention' : ''}`,
      text: needsAttention ? 'Wymaga uwagi' : 'Gotowa do gry'
    })
  ]));

  glance.append(createEl('div', { className: 'session-glance-grid' }, [
    createEl('button', {
      type: 'button',
      className: 'session-glance-panel',
      attrs: {
        'aria-label': latest
          ? `Ostatni rzut: ${latest.summary}. Otwórz widok Kości.`
          : 'Brak ostatniego rzutu. Otwórz widok Kości.'
      },
      onclick: () => setView('dice', { announceChange: true })
    }, [
      uiIcon('dice'),
      createEl('span', { className: 'session-glance-copy' }, [
        createEl('small', { text: 'Ostatni rzut' }),
        createEl('strong', { text: latest ? diceEntryResultText(latest) : '—' }),
        createEl('span', { text: latest ? (latest.label || latest.notation || 'Rzut') : 'Otwórz kości' })
      ])
    ]),
    createEl('button', {
      type: 'button',
      className: 'session-glance-panel',
      attrs: { 'aria-label': `Aktywny sprzęt: ${activeSummary}. Otwórz ekwipunek.` },
      onclick: () => setView('inventory', { announceChange: true })
    }, [
      uiIcon('box'),
      createEl('span', { className: 'session-glance-copy' }, [
        createEl('small', { text: 'Aktywny sprzęt' }),
        createEl('strong', { text: activeItems.length ? String(activeItems.length) : '—' }),
        createEl('span', { text: activeSummary })
      ])
    ])
  ]));

  glance.append(createEl('button', {
    type: 'button',
    className: 'session-note-strip',
    attrs: { 'aria-label': 'Otwórz notatki postaci' },
    onclick: openNotesSheet
  }, [
    createEl('span', { className: 'session-note-label', text: 'Notatka' }),
    createEl('span', {
      className: 'session-note-preview',
      text: note ? `${note.slice(0, 80)}${note.length > 80 ? '…' : ''}` : 'Zapisz trop, nazwę lub decyzję z sesji'
    }),
    createEl('span', { className: 'session-note-arrow', text: '›', attrs: { 'aria-hidden': 'true' } })
  ]));

  glance.append(createEl('div', { className: 'session-dock', attrs: { 'aria-label': 'Najczęstsze akcje' } }, [
    compactActionButton('Rzut k20', 'dice', () => {
      setView('dice', { announceChange: true });
      requestAnimationFrame(() => performRoll({ count: 1, sides: 20 }, 'k20'));
    }, true),
    compactActionButton('Notatka', 'more', openNotesSheet),
    compactActionButton('Plecak', 'box', () => setView('inventory', { announceChange: true }))
  ]));

  return glance;
}

'''
app = replace_once(app, "function renderCharacterView() {", session_glance + "function renderCharacterView() {", "session glance helper")
app = replace_once(
    app,
    "  const sessionPrompt = renderSessionPrompt();\n  if (sessionPrompt) root.append(sessionPrompt);\n\n",
    "  const sessionPrompt = renderSessionPrompt();\n  if (sessionPrompt) root.append(sessionPrompt);\n  root.append(renderSessionGlanceCard());\n\n",
    "session glance placement",
)
app = regex_replace_once(
    app,
    r"\n  const allActiveItems = activeEquipmentItems\(\);.*?\n  root\.append\(equipmentBar\);\n",
    "\n",
    "remove duplicated active equipment bar",
)
app = replace_once(
    app,
    "  actions.append(sectionHead('Szybkie akcje', createEl('span', { className: 'muted micro', text: 'przy stole' })));",
    "  actions.append(sectionHead('Sytuacje', createEl('span', { className: 'muted micro', text: 'procedury przy stole' })));",
    "session actions heading",
)
write("scripts/app.js", app)

css = read("styles/app.css").rstrip() + "\n\n" + r'''/* Session-first UX v0.15.0 — editorial polish without changing game logic. */
:root {
  --font-display: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  --surface-glass: color-mix(in srgb, var(--surface) 88%, transparent);
  --surface-highlight: color-mix(in srgb, var(--surface-strong) 82%, transparent);
  --session-shadow: 0 20px 54px rgba(0, 0, 0, 0.26);
  --session-ease: cubic-bezier(0.22, 1, 0.36, 1);
}

body {
  position: relative;
  isolation: isolate;
  background:
    radial-gradient(circle at 8% -4%, rgba(108, 72, 112, 0.3), transparent 28rem),
    radial-gradient(circle at 96% 18%, rgba(81, 104, 74, 0.19), transparent 24rem),
    radial-gradient(circle at 44% 96%, rgba(137, 90, 61, 0.08), transparent 30rem),
    linear-gradient(180deg, color-mix(in srgb, var(--bg) 92%, #24172a), var(--bg));
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: 0.18;
  background-image:
    repeating-radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.04) 0 0.6px, transparent 0.8px 4px),
    linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.012), transparent);
  background-size: 11px 11px, 100% 100%;
  mix-blend-mode: soft-light;
}

.app-header {
  top: calc(env(safe-area-inset-top) + 7px);
  margin: 7px 8px 0;
  border: 1px solid color-mix(in srgb, var(--line) 86%, transparent);
  border-radius: 17px;
  background: color-mix(in srgb, var(--bg-elev) 76%, transparent);
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(24px) saturate(1.08);
  -webkit-backdrop-filter: blur(24px) saturate(1.08);
}

.brand-kicker { color: color-mix(in srgb, var(--green-strong) 88%, var(--text)); }
.brand-title { font-family: var(--font-display); letter-spacing: -0.025em; }
.main { padding-top: 11px; padding-bottom: calc(var(--nav-height) + env(safe-area-inset-bottom) + 28px); }
.view:not([hidden]) { animation: session-view-in 220ms var(--session-ease); }

.card {
  border-color: color-mix(in srgb, var(--line) 92%, transparent);
  background: var(--surface-glass);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(18px) saturate(1.04);
  -webkit-backdrop-filter: blur(18px) saturate(1.04);
}

.session-hero {
  position: relative;
  padding: 14px;
  overflow: hidden;
  background:
    radial-gradient(circle at 94% 6%, rgba(242, 196, 127, 0.14), transparent 15rem),
    radial-gradient(circle at 8% 18%, rgba(145, 169, 130, 0.16), transparent 13rem),
    linear-gradient(150deg, color-mix(in srgb, var(--surface-strong) 90%, transparent), var(--surface-glass));
  box-shadow: var(--session-shadow);
}

.session-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  border: 1px solid rgba(255, 255, 255, 0.025);
  mask-image: linear-gradient(145deg, black, transparent 64%);
}

.session-hero .identity-row { grid-template-columns: 50px minmax(0, 1fr) auto; gap: 11px; }
.session-hero .avatar {
  width: 50px;
  height: 50px;
  border-radius: 16px;
  color: var(--amber-strong);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 8px 20px rgba(0, 0, 0, 0.18);
}
.session-hero .character-name { font-family: var(--font-display); font-size: clamp(1.28rem, 5.5vw, 1.62rem); }
.session-hero .character-background { margin-top: 4px; font-size: 0.78rem; }
.session-hero .status-strip { gap: 8px; margin-top: 13px; }
.session-hero .status-tile {
  min-height: 62px;
  padding: 8px 9px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-highlight) 88%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}
.session-hero .status-tile-primary {
  background: linear-gradient(150deg, rgba(242, 196, 127, 0.14), color-mix(in srgb, var(--surface-highlight) 92%, transparent));
}
.session-hero .status-label { font-size: 0.61rem; }
.session-hero .status-value { margin-top: 4px; font-size: 1.32rem; }
.session-hero .status-tile-primary .status-value { font-size: 1.86rem; }
.session-hero .status-meta { margin-top: 4px; }

.protection-meter {
  --protection-ratio: 0;
  position: relative;
  height: 5px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--line) 74%, transparent);
}
.protection-meter::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(var(--protection-ratio) * 100%);
  min-width: calc(var(--protection-ratio) * 4px);
  border-radius: inherit;
  background: linear-gradient(90deg, var(--green), var(--amber-strong));
  box-shadow: 0 0 18px color-mix(in srgb, var(--amber) 36%, transparent);
  transition: width 220ms var(--session-ease);
}

.session-glance-card {
  position: relative;
  display: grid;
  gap: 10px;
  padding: 13px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--surface) 94%, transparent), color-mix(in srgb, var(--surface-strong) 70%, transparent));
}
.session-glance-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.session-glance-head h2 { margin: 0; font-family: var(--font-display); font-size: 1.08rem; }
.session-glance-kicker {
  margin: 0 0 2px;
  color: var(--green-strong);
  font-size: 0.61rem;
  font-weight: 850;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.session-glance-state {
  flex: 0 0 auto;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 5px 9px;
  border: 1px solid color-mix(in srgb, var(--green) 45%, var(--line));
  border-radius: 999px;
  background: color-mix(in srgb, var(--green) 11%, transparent);
  color: var(--green-strong);
  font-size: 0.65rem;
  font-weight: 800;
}
.session-glance-state.needs-attention {
  border-color: color-mix(in srgb, var(--amber) 54%, var(--line));
  background: color-mix(in srgb, var(--amber) 12%, transparent);
  color: var(--amber-strong);
}
.session-glance-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.session-glance-panel {
  min-width: 0;
  min-height: 86px;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: color-mix(in srgb, var(--surface-highlight) 78%, transparent);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: transform 140ms var(--session-ease), border-color 140ms ease, background 140ms ease;
}
.session-glance-panel > svg { width: 1.35rem; height: 1.35rem; color: var(--green-strong); }
.session-glance-panel:active { transform: scale(0.975); }
.session-glance-copy { min-width: 0; display: grid; gap: 2px; }
.session-glance-copy small {
  color: var(--muted);
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.session-glance-copy strong { font-family: var(--font-display); font-size: 1.42rem; line-height: 1; }
.session-glance-copy span {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.66rem;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-note-strip {
  min-width: 0;
  min-height: 46px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}
.session-note-label { color: var(--amber-strong); font-size: 0.68rem; font-weight: 850; text-transform: uppercase; letter-spacing: 0.08em; }
.session-note-preview { min-width: 0; overflow: hidden; color: var(--muted); font-size: 0.72rem; text-overflow: ellipsis; white-space: nowrap; }
.session-note-arrow { color: var(--faint); font-size: 1.25rem; line-height: 1; }
.session-dock { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.session-dock .compact-action { min-height: 60px; border-radius: 14px; }
.session-dock .compact-action span { font-size: 0.69rem; }

.compact-actions,
.compact-saves { padding: 12px; }
.compact-action-grid { gap: 8px; }
.compact-action { min-height: 62px; border-radius: 14px; }
.compact-action svg { width: 1.18rem; height: 1.18rem; }
.compact-action span { font-size: 0.69rem; }
.compact-saves .attributes-grid { gap: 8px; }
.compact-saves .attribute-btn { min-height: 66px; border-radius: 14px; }
.compact-saves .attribute-btn .attr-value { font-family: var(--font-display); font-size: 1.56rem; }
.session-tools-grid .btn { background: transparent; }

.bottom-nav {
  bottom: 8px;
  width: min(calc(100% - 16px), 704px);
  min-height: calc(var(--nav-height) + env(safe-area-inset-bottom));
  padding: 6px 7px calc(6px + env(safe-area-inset-bottom));
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 19px;
  background: color-mix(in srgb, var(--bg-elev) 82%, transparent);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(26px) saturate(1.1);
  -webkit-backdrop-filter: blur(26px) saturate(1.1);
}
.nav-btn { position: relative; min-height: 54px; border-radius: 14px; }
.nav-btn[aria-current="page"] {
  background: linear-gradient(180deg, color-mix(in srgb, var(--amber) 13%, var(--surface-soft)), var(--surface-soft));
  color: var(--amber-strong);
}
.nav-btn[aria-current="page"]::after {
  content: "";
  position: absolute;
  top: 5px;
  left: 50%;
  width: 22px;
  height: 2px;
  border-radius: 999px;
  background: var(--amber-strong);
  transform: translateX(-50%);
  box-shadow: 0 0 12px color-mix(in srgb, var(--amber) 48%, transparent);
}

.sheet-backdrop { background: rgba(8, 5, 10, 0.72); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
.sheet {
  border-radius: 26px 26px 0 0;
  background: color-mix(in srgb, var(--bg-elev) 96%, transparent);
  box-shadow: 0 -24px 72px rgba(0, 0, 0, 0.46);
}
.sheet-head h2 { font-family: var(--font-display); font-size: 1.16rem; }

@keyframes session-view-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (hover: hover) and (pointer: fine) {
  .session-glance-panel:hover,
  .session-note-strip:hover,
  .btn:hover { border-color: color-mix(in srgb, var(--amber) 38%, var(--line)); }
}

@media (max-width: 359px) {
  .app-header { margin-inline: 6px; }
  .main { padding-inline: 7px; }
  .session-hero { padding: 11px; }
  .session-hero .identity-row { grid-template-columns: 44px minmax(0, 1fr) auto; gap: 8px; }
  .session-hero .avatar { width: 44px; height: 44px; border-radius: 14px; }
  .session-hero .status-tile { padding-inline: 7px; }
  .session-glance-grid { grid-template-columns: 1fr; }
  .session-glance-panel { min-height: 72px; }
  .session-dock { gap: 5px; }
  .session-dock .compact-action { min-height: 58px; padding-inline: 3px; }
  .bottom-nav { width: calc(100% - 12px); bottom: 6px; }
}

@media (prefers-contrast: more) {
  .session-hero,
  .session-glance-card,
  .session-glance-panel,
  .session-note-strip,
  .bottom-nav { backdrop-filter: none; -webkit-backdrop-filter: none; }
}

@media (prefers-reduced-motion: reduce) {
  .view:not([hidden]) { animation: none; }
  .protection-meter::after,
  .session-glance-panel { transition: none; }
}
'''
write("styles/app.css", css)

package = json.loads(read("package.json"))
package["version"] = "0.15.0"
write("package.json", json.dumps(package, ensure_ascii=False, indent=2) + "\n")

package_lock = json.loads(read("package-lock.json"))
package_lock["version"] = "0.15.0"
package_lock["packages"][""]["version"] = "0.15.0"
write("package-lock.json", json.dumps(package_lock, ensure_ascii=False, indent=2) + "\n")

service_worker = read("service-worker.js")
service_worker = replace_once(service_worker, "cairn-mobile-sheet-v0.14.0", "cairn-mobile-sheet-v0.15.0", "service worker cache")
write("service-worker.js", service_worker)

readme = read("README.md")
readme = replace_once(
    readme,
    "- kontekstowy tryb sesji z kartą „Co teraz?”, aktywnymi stanami i szybkimi korektami;",
    "- kontekstowy tryb sesji z kartą „Co teraz?”, aktywnymi stanami i szybkimi korektami;\n- sesyjny ekran główny z Ochroną, ostatnim rzutem, aktywnym sprzętem, notatką i skrótami do najczęstszych akcji;",
    "README session dashboard",
)
readme = replace_once(readme, "Wersja 0.14.0 nadal używa", "Wersja 0.15.0 nadal używa", "README version")
write("README.md", readme)

tests = read("tests/app.spec.mjs").rstrip() + "\n\n" + r'''test('session dashboard exposes table context and one-tap d20 flow', async ({ page }) => {
  await loadDemo(page);
  await expect(page.getByRole('heading', { name: 'Przy stole' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Aktywny sprzęt:/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Otwórz notatki postaci' })).toBeVisible();
  await page.getByRole('button', { name: 'Rzut k20', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rzut kością' })).toBeVisible();
  await expect(page.locator('#diceResult strong')).not.toHaveText('—');
});
'''
write("tests/app.spec.mjs", tests)

published = [
    "index.html",
    "manifest.webmanifest",
    "service-worker.js",
    "icon.svg",
    "styles/app.css",
    "scripts/app.js",
]
checksum_lines = []
for path in published:
    digest = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
    checksum_lines.append(f"{digest}  {path}")
write("checksums.sha256", "\n".join(checksum_lines) + "\n")

print("Applied session-first UX v0.15.0")
