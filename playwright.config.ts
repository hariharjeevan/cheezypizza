import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  webServer: {
    command: 'pnpm build && node .next/standalone/server.js',
    url: 'http://127.0.0.1:3000',
    timeout: 120 * 1000,
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  use: {
    baseURL: 'http://127.0.0.1:3000',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-features=WebRtcHideLocalIpsWithMdns'],
        },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'permissions.default.persistent-storage': 1,
            // Disable mDNS ICE candidate obfuscation so two local contexts can
            // establish a WebRTC data channel (same reason as the Chromium
            // --disable-features=WebRtcHideLocalIpsWithMdns flag above).
            'media.peerconnection.ice.obfuscate_host_addresses': false,
          },
        },
      },
    },
  ],
})
