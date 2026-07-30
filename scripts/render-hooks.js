'use strict';

(() => {
  const characterHooks = new Set();
  const renderCharacterViewBase = renderCharacterView;

  globalThis.CairnRenderHooks = Object.freeze({
    addCharacterHook(hook) {
      if (typeof hook !== 'function') throw new TypeError('Character render hook must be a function.');
      characterHooks.add(hook);
      return () => characterHooks.delete(hook);
    }
  });

  renderCharacterView = function renderCharacterViewWithHooks() {
    renderCharacterViewBase();
    for (const hook of characterHooks) hook();
  };
})();
