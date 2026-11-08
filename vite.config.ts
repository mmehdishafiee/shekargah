import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The public site URL comes from `site.config.json` so index.html never carries
 * a hardcoded domain. `VITE_SITE_URL` overrides it for previews and tests.
 */
function resolveSiteUrl(): string {
  if (process.env.VITE_SITE_URL) return process.env.VITE_SITE_URL.trim().replace(/\/+$/, '')
  const config = JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url), 'utf8')) as { siteUrl: string }
  const value = config.siteUrl.trim().replace(/\/+$/, '')
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

/** Replaces the `%SITE_URL%` placeholder in index.html at build time. */
function siteUrlHtml(): Plugin {
  return {
    name: 'shekargah-site-url-html',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('%SITE_URL%', resolveSiteUrl()),
    },
  }
}

/**
 * Emits `<link rel="preload">` for the Arabic Vazirmatn subset.
 *
 * The font is requested from inside the CSS bundle, so without this the browser
 * only discovers it after the stylesheet has arrived — a full extra round trip
 * before any Persian text can paint. Only the Arabic subset is preloaded: every
 * page renders Persian, while the Latin subsets are fetched on demand for the
 * occasional English word.
 */
function preloadPersianFont(): Plugin {
  return {
    name: 'shekargah-preload-persian-font',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const font = Object.keys(bundle).find((file) => /vazirmatn-arabic-wght-normal-.+\.woff2$/.test(file))
      if (!font) {
        this.warn('Vazirmatn Arabic subset not found; skipping font preload')
        return
      }

      const html = bundle['index.html']
      if (!html || html.type !== 'asset' || typeof html.source !== 'string') return

      const tag = `<link rel="preload" as="font" type="font/woff2" crossorigin href="/${font}" />`
      html.source = html.source.replace('</head>', `    ${tag}\n  </head>`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  /**
   * Local dev and `vite preview` serve the same same-origin routes the Pages
   * Functions handle in production (`functions/api/`), so the proxy setup can be
   * exercised locally before it is deployed.
   */
  const proxy: Record<string, { target: string; changeOrigin: boolean; rewrite: (path: string) => string }> = {}
  const route = (prefix: string, target: string) => ({
    target: target.replace(/\/+$/, ''),
    changeOrigin: true,
    rewrite: (path: string) => path.replace(new RegExp(`^${prefix}`), ''),
  })

  const supabaseDirect = (env.VITE_SUPABASE_URL ?? '').trim()
  const botDirect = (env.VITE_TELEGRAM_BOT_URL ?? '').trim()
  if (supabaseDirect) proxy['/api/supabase'] = route('/api/supabase', supabaseDirect)
  if (botDirect) proxy['/api/bot'] = route('/api/bot', botDirect)

  return {
    plugins: [react(), tailwindcss(), siteUrlHtml(), preloadPersianFont()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { proxy },
    preview: { proxy },
    build: {
      target: 'es2022',
      sourcemap: false,
      rollupOptions: {
        output: {
          /**
           * Framework code changes far less often than app code. Keeping it in
           * its own chunk means a deploy only invalidates the app chunk, so a
           * returning visitor on a slow link re-downloads ~100KB instead of the
           * whole bundle.
           */
          manualChunks: (id: string) => {
            if (!id.includes('node_modules')) return undefined
            return /node_modules[\\/](react|react-dom|react-router|scheduler|@tanstack)[\\/]/.test(id) ? 'vendor' : undefined
          },
        },
      },
    },
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'jsdom',
            globals: true,
            setupFiles: ['./src/test/setup.ts'],
            include: ['src/**/*.test.{ts,tsx}'],
          },
        },
        {
          test: {
            name: 'db',
            environment: 'node',
            include: ['supabase/tests/**/*.test.ts'],
            testTimeout: 60_000,
            hookTimeout: 60_000,
          },
        },
      ],
    },
  }
})
