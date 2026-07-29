'use strict';

(() => {
  const BUILD_VERSION = '0.30.0';
  const LEGACY_VERSION = '0.23.0';

  globalThis.CAIRN_BUILD_VERSION = BUILD_VERSION;
  document.documentElement.dataset.buildVersion = BUILD_VERSION;

  function replaceLegacyVersion(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.nodeValue?.includes(LEGACY_VERSION)) {
        node.nodeValue = node.nodeValue.replaceAll(LEGACY_VERSION, BUILD_VERSION);
      }
    }
  }

  replaceLegacyVersion();
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue?.includes(LEGACY_VERSION)) {
          node.nodeValue = node.nodeValue.replaceAll(LEGACY_VERSION, BUILD_VERSION);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          replaceLegacyVersion(node);
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
