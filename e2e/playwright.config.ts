import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run the real web export against a local Supabase:
 *   npx supabase start && npm run test:e2e
 */
export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  outputDir: './test-results',
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:8081',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'node serve.mjs',
    url: 'http://127.0.0.1:8081',
    reuseExistingServer: true,
  },
});
