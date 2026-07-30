'use strict';

(() => {
  if (!globalThis.CairnRuntime) throw new Error('CairnRuntime must be loaded before render-hooks.js.');
  globalThis.CairnRenderHooks = Object.freeze({
    addCharacterHook: globalThis.CairnRuntime.addCharacterHook
  });
})();
