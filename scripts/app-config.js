'use strict';

(() => {
  const VERSION = '0.30.1';
  const config = Object.freeze({ version: VERSION });

  globalThis.CAIRN_APP_CONFIG = config;
  document.documentElement.dataset.buildVersion = VERSION;

  if (typeof state === 'object' && state) state.appVersion = VERSION;
  if (globalThis.CairnSheetDev) globalThis.CairnSheetDev.version = VERSION;

  if (typeof createDefaultState === 'function') {
    const createDefaultStateBase = createDefaultState;
    createDefaultState = function createVersionedDefaultState(...args) {
      return { ...createDefaultStateBase(...args), appVersion: VERSION };
    };
  }

  if (typeof createDemoState === 'function') {
    const createDemoStateBase = createDemoState;
    createDemoState = function createVersionedDemoState(...args) {
      return { ...createDemoStateBase(...args), appVersion: VERSION };
    };
  }

  function updateVisibleVersion() {
    const settings = document.querySelector('.settings-sheet');
    if (!settings) return;
    for (const element of settings.querySelectorAll('strong')) {
      if (/^Wersja\s+\d+\.\d+\.\d+$/.test(element.textContent || '')) {
        element.textContent = `Wersja ${VERSION}`;
      }
    }
  }

  document.querySelector('#appSettingsBtn')?.addEventListener('click', () => queueMicrotask(updateVisibleVersion));
})();
