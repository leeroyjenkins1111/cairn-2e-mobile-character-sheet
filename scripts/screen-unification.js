'use strict';

(() => {
  function installUnifiedScreenStyles() {
    if (document.documentElement.dataset.screenUnificationStyles === 'true') return Promise.resolve();

    const targetSheet = [...document.styleSheets].find(sheet => sheet.href?.endsWith('/styles/app.css'));
    if (!targetSheet) return Promise.reject(new Error('Nie znaleziono głównego arkusza stylów.'));

    return new Promise((resolve, reject) => {
      const source = document.createElement('link');
      source.rel = 'stylesheet';
      source.href = './styles/screen-unification.css?v=0.25.0';
      source.onload = () => {
        try {
          const rules = [...source.sheet.cssRules].map(rule => rule.cssText);
          for (const rule of rules) targetSheet.insertRule(rule, targetSheet.cssRules.length);
          document.documentElement.dataset.screenUnificationStyles = 'true';
          source.remove();
          resolve();
        } catch (error) {
          source.remove();
          reject(error);
        }
      };
      source.onerror = () => {
        source.remove();
        reject(new Error('Nie udało się wczytać stylów pozostałych ekranów.'));
      };
      document.head.append(source);
    });
  }

  installUnifiedScreenStyles().catch(error => console.error(error));
})();
