'use strict';

(() => {
  const VERSION = '0.30.1';
  globalThis.CAIRN_APP_CONFIG = Object.freeze({ version: VERSION });
  document.documentElement.dataset.buildVersion = VERSION;
})();
