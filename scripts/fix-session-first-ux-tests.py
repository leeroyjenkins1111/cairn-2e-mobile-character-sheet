from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'tests/app.spec.mjs'
text = path.read_text(encoding='utf-8')
old = "expect(result).toEqual({ version: '0.14.0', inlineStyles: 0, inlineScripts: 0, stylesheetLoaded: true });"
new = "expect(result).toEqual({ version: '0.15.0', inlineStyles: 0, inlineScripts: 0, stylesheetLoaded: true });"
count = text.count(old)
if count != 1:
    raise RuntimeError(f'Expected one static asset version assertion, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Aligned Playwright version expectation with v0.15.0')
