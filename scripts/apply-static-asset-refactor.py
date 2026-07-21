from __future__ import annotations

import hashlib
import json
import re
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return source.replace(old, new, 1)


html = read("index.html")

style_match = re.search(r"\n  <style>\n(?P<content>.*?)\n  </style>", html, flags=re.DOTALL)
if not style_match:
    raise RuntimeError("Could not find the single inline style block")
if len(re.findall(r"<style(?:\s|>)", html)) != 1:
    raise RuntimeError("Expected exactly one style element")

script_matches = list(re.finditer(r"\n  <script>\n(?P<content>.*?)\n  </script>", html, flags=re.DOTALL))
if len(script_matches) != 1:
    raise RuntimeError(f"Expected exactly one inline application script, found {len(script_matches)}")
script_match = script_matches[0]

css = textwrap.dedent(style_match.group("content")).strip() + "\n"
js = textwrap.dedent(script_match.group("content")).strip() + "\n"

js = replace_once(js, "const APP_VERSION = '0.13.0';", "const APP_VERSION = '0.14.0';", "APP_VERSION")
js = replace_once(
    js,
    "test('34. Dokument nie ładuje zewnętrznych skryptów ani styli', () => { const external = $$('script[src], link[rel=\"stylesheet\"][href]').filter(el => /^https?:/i.test(el.src || el.href)); assert(external.length === 0); });",
    "test('34. Dokument nie ładuje zasobów z obcego originu', () => { const external = $$('script[src], link[rel=\"stylesheet\"][href]').filter(el => new URL(el.src || el.href, location.href).origin !== location.origin); assert(external.length === 0); });",
    "same-origin asset test",
)
js = replace_once(
    js,
    "    return results;\n  }",
    "    test('102. CSS i JavaScript są ładowane z lokalnych plików statycznych', () => { assert(Boolean(document.querySelector('link[rel=\"stylesheet\"][href=\"./styles/app.css\"]')) && Boolean(document.querySelector('script[src=\"./scripts/app.js\"]')) && !document.querySelector('style') && !document.querySelector('script:not([src])')); });\n    return results;\n  }",
    "embedded static asset regression test",
)

style_block = style_match.group(0)
script_block = script_match.group(0)
html = replace_once(html, style_block, '\n  <link rel="stylesheet" href="./styles/app.css">', "style extraction")
html = replace_once(html, script_block, '\n  <script src="./scripts/app.js"></script>', "script extraction")

if "<style" in html or re.search(r"<script>(?:.|\n)*?</script>", html):
    raise RuntimeError("Inline style or application script remained in index.html")

write("styles/app.css", css)
write("scripts/app.js", js)
write("index.html", html)

package = json.loads(read("package.json"))
package["version"] = "0.14.0"
write("package.json", json.dumps(package, ensure_ascii=False, indent=2) + "\n")

package_lock = json.loads(read("package-lock.json"))
package_lock["version"] = "0.14.0"
package_lock["packages"][""]["version"] = "0.14.0"
write("package-lock.json", json.dumps(package_lock, ensure_ascii=False, indent=2) + "\n")

service_worker = read("service-worker.js")
service_worker = replace_once(
    service_worker,
    "const CACHE_NAME = 'cairn-mobile-sheet-v0.13.0';",
    "const CACHE_NAME = 'cairn-mobile-sheet-v0.14.0';",
    "service worker cache version",
)
service_worker = replace_once(
    service_worker,
    "const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './service-worker.js'];",
    "const APP_SHELL = ['./', './index.html', './styles/app.css', './scripts/app.js', './manifest.webmanifest', './icon.svg', './service-worker.js'];",
    "service worker app shell",
)
write("service-worker.js", service_worker)

ci = read(".github/workflows/ci.yml")
old_ci = """      - name: Check inline JavaScript syntax
        shell: bash
        run: |
          python3 - <<'PY'
          from pathlib import Path
          html = Path('index.html').read_text(encoding='utf-8')
          script = html.rsplit('<script>', 1)[1].split('</script>', 1)[0]
          Path('/tmp/cairn-inline.js').write_text(script, encoding='utf-8')
          PY
          node --check /tmp/cairn-inline.js
"""
new_ci = """      - name: Check application JavaScript syntax
        run: node --check scripts/app.js
"""
ci = replace_once(ci, old_ci, new_ci, "CI JavaScript syntax step")
write(".github/workflows/ci.yml", ci)

deploy = read(".github/workflows/deploy-pages.yml")
deploy = replace_once(
    deploy,
    "          mkdir -p _site\n          cp index.html .nojekyll manifest.webmanifest service-worker.js icon.svg _site/",
    "          mkdir -p _site/styles _site/scripts\n          cp index.html .nojekyll manifest.webmanifest service-worker.js icon.svg _site/\n          cp styles/app.css _site/styles/\n          cp scripts/app.js _site/scripts/",
    "Pages static asset copy",
)
write(".github/workflows/deploy-pages.yml", deploy)

readme = read("README.md")
readme = replace_once(readme, "Wersja 0.13.0 nadal używa `schemaVersion: 3`.", "Wersja 0.14.0 nadal używa `schemaVersion: 3`.", "README version")
readme = replace_once(
    readme,
    "## Uruchomienie lokalne\n",
    "## Struktura aplikacji\n\nWarstwa statyczna jest rozdzielona bez zmiany funkcji lub modelu danych:\n\n- `index.html` zawiera semantyczny szkielet dokumentu;\n- `styles/app.css` zawiera cały styl interfejsu;\n- `scripts/app.js` zawiera logikę aplikacji;\n- Service Worker jawnie buforuje oba zasoby do pracy offline.\n\nTen etap nie wprowadza bundlera ani modułów runtime. Rozdzielenie logiki JavaScript na mniejsze moduły pozostaje możliwym późniejszym refaktorem, ale nie jest wymagane do korzystania z aplikacji.\n\n## Uruchomienie lokalne\n",
    "README structure section",
)
write("README.md", readme)

tests = read("tests/app.spec.mjs")
tests = replace_once(tests, "toHaveAttribute('data-passed', '101')", "toHaveAttribute('data-passed', '102')", "selftest passed count")
tests = replace_once(tests, "toHaveAttribute('data-total', '101')", "toHaveAttribute('data-total', '102')", "selftest total count")
asset_test = """

test('application loads extracted same-origin CSS and JavaScript', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="stylesheet"][href="./styles/app.css"]')).toHaveCount(1);
  await expect(page.locator('script[src="./scripts/app.js"]')).toHaveCount(1);
  const result = await page.evaluate(() => ({
    version: globalThis.CairnSheetDev?.version,
    inlineStyles: document.querySelectorAll('style').length,
    inlineScripts: document.querySelectorAll('script:not([src])').length,
    stylesheetLoaded: Array.from(document.styleSheets).some(sheet => sheet.href?.endsWith('/styles/app.css'))
  }));
  expect(result).toEqual({ version: '0.14.0', inlineStyles: 0, inlineScripts: 0, stylesheetLoaded: true });
});
"""
tests = replace_once(tests, "\ntest('full and legacy exports round-trip without losing character data'", asset_test + "\ntest('full and legacy exports round-trip without losing character data'", "Playwright static asset test")
write("tests/app.spec.mjs", tests)

checksum_paths = [
    "index.html",
    "styles/app.css",
    "scripts/app.js",
    "manifest.webmanifest",
    "service-worker.js",
    "icon.svg",
]
checksum_lines = []
for path in checksum_paths:
    digest = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
    checksum_lines.append(f"{digest}  {path}")
write("checksums.sha256", "\n".join(checksum_lines) + "\n")

print("Extracted inline CSS and JavaScript into static assets for v0.14.0")
