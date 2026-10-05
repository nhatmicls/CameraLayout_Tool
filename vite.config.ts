// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- recommended way to pull in Vitest's `test` config typings
/// <reference types="vitest/config" />
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// This app runs entirely in the browser: no backend, no telemetry, no
// outbound network calls once loaded. The production build gets a CSP
// meta tag that enforces this ('connect-src none'). Dev builds skip it
// so Vite's HMR websocket keeps working.
function productionOnlyContentSecurityPolicy(): Plugin {
  const csp =
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'"

  return {
    name: 'production-only-content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `    <meta http-equiv="Content-Security-Policy" content="${csp}">\n  </head>`,
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), productionOnlyContentSecurityPolicy()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
