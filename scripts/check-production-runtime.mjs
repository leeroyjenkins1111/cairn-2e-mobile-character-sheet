import { readFile } from 'node:fs/promises';

const designStylePaths = [
  'styles/tokens.css',
  'styles/foundations.css',
  'styles/shell.css',
  'styles/components.css',
  'styles/screens.css',
  'styles/dice.css',
  'styles/dice-screen.css',
  'styles/dice-roll-fixes.css',
  'styles/atmosphere.css',
  'styles/combat.css'
];

const [index, core, bootstrap, worker, inventoryDomain, diceRollFixes, appStyles, ...designStyles] = await Promise.all([
  readFile('_site/index.html', 'utf8'),
  readFile('_site/scripts/app-core.js', 'utf8'),
  readFile('_site/scripts/app-bootstrap.js', 'utf8'),
  readFile('_site/service-worker.js', 'utf8'),
  readFile('_site/scripts/inventory-domain.js', 'utf8'),
  readFile('_site/scripts/dice-roll-fixes.js', 'utf8'),
  readFile('_site/styles/app.css', 'utf8'),
  ...designStylePaths.map(path => readFile(`_site/${path}`, 'utf8'))
]);

const productionSource = `${core}\n${bootstrap}\n${diceRollFixes}`;
const styleSource = designStyles.join('\n');
const assertions = [
  [index.includes('scripts/app-core.js?v='), 'index loads app-core.js'],
  [index.includes('scripts/app-bootstrap.js?v='), 'index loads app-bootstrap.js'],
  [!index.includes('scripts/app.js?v='), 'index does not load monolithic app.js'],
  [worker.includes('scripts/app-core.js?v='), 'service worker caches app-core.js'],
  [worker.includes('scripts/app-bootstrap.js?v='), 'service worker caches app-bootstrap.js'],
  [index.includes('scripts/app-entry.js?v='), 'index loads app-entry.js'],
  [worker.includes('scripts/app-entry.js?v='), 'service worker caches app-entry.js'],
  [index.includes('scripts/inventory-domain.js?v='), 'index loads inventory-domain.js'],
  [worker.includes('scripts/inventory-domain.js?v='), 'service worker caches inventory-domain.js'],
  [index.includes('scripts/dice-roll-fixes.js?v='), 'index loads dice-roll-fixes.js'],
  [worker.includes('scripts/dice-roll-fixes.js?v='), 'service worker caches dice-roll-fixes.js'],
  [index.indexOf('scripts/dice-roll-fixes.js?v=') < index.indexOf('scripts/app-entry.js?v='), 'dice fixes load before app entry'],
  [inventoryDomain.includes('createInventoryOverviewModel'), 'inventory domain is present in production'],
  [diceRollFixes.includes('normalizeRollConfigStrict'), 'strict dice validation is present in production'],
  [diceRollFixes.includes('winningDamageVisual'), 'winning die selection is present in production'],
  [index.includes('href="./styles/app.css"'), 'index loads the single CSS entrypoint'],
  [worker.includes("'./styles/app.css'"), 'service worker caches the CSS entrypoint'],
  ...designStylePaths.flatMap(path => {
    const filename = path.split('/').pop();
    return [
      [appStyles.includes(`./${filename}?v=`), `app.css imports ${filename}`],
      [worker.includes(`${path}?v=`), `service worker caches ${path}`]
    ];
  }),
  [!appStyles.includes('{'), 'app.css contains imports only'],
  [styleSource.includes('--color-surface-page'), 'semantic surface tokens are present'],
  [styleSource.includes(':root[data-theme="light"]'), 'light theme tokens are present'],
  [styleSource.includes('@media (forced-colors: active)'), 'forced-colors support is present'],
  [styleSource.includes('@media (prefers-reduced-motion: reduce)'), 'reduced-motion support is present'],
  [styleSource.includes('.animated-dice-result'), 'dice presentation is present'],
  [styleSource.includes('.aggregate-dice-result'), 'aggregate dice result is present'],
  [styleSource.includes('The forest illustration is the visual anchor'), 'atmosphere contract is present'],
  [styleSource.includes('.combat-panel-row'), 'focused combat panel layout is present'],
  [!index.includes('character-redesign.css'), 'legacy character CSS is not loaded'],
  [!index.includes('screen-unification.css'), 'legacy screen unification CSS is not loaded'],
  [!index.includes('runtime-overrides.css'), 'legacy override CSS is not loaded'],
  [!index.includes('dice-runtime.css'), 'legacy dice CSS is not loaded'],
  [!index.includes('typography-system.js'), 'runtime typography injection is removed'],
  [!index.includes('inventory-spacing.js'), 'runtime inventory spacing injection is removed'],
  [!bootstrap.trimEnd().endsWith('initialize();'), 'bootstrap does not initialize itself'],
  [!productionSource.includes('function runDeveloperTests'), 'developer test runner excluded'],
  [!productionSource.includes('runTests: runDeveloperTests'), 'developer API hook excluded'],
  [!productionSource.includes('selftestMarker'), 'self-test DOM hook excluded'],
  [!productionSource.includes('Testy deweloperskie'), 'developer settings row excluded'],
  [!productionSource.includes('renderCharacterView = function'), 'character renderer is not monkey patched'],
  [!productionSource.includes("document.createElement('style')"), 'runtime does not create style elements'],
  [!productionSource.includes('insertRule'), 'runtime does not insert CSS rules'],
  [core.includes('function openResetSheet'), 'core retains application features'],
  [bootstrap.includes('function initialize'), 'bootstrap retains initialization']
];

const failures = assertions.filter(([pass]) => !pass).map(([, label]) => label);
if (failures.length) {
  console.error(`Production runtime validation failed: ${failures.join(', ')}`);
  process.exit(1);
}

console.log('Production runtime contains the static Wędrowny Dziennik design system and validated dice fixes.');
