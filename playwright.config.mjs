import { defineConfig, devices } from '@playwright/test';

const localChrome = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' ? { channel: 'chrome' } : {};

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', locale: 'pl-PL', serviceWorkers: 'allow', trace: 'retain-on-failure' },
  webServer: { command: 'python3 -m http.server 4173 --bind 127.0.0.1', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['iPhone 12'], browserName: 'chromium', ...localChrome } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 12'], browserName: 'webkit' } }
  ]
});
