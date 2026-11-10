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

/**
 * Spreads built files across several origins of the same Pages project.
 *
 * Why it exists: an Iranian connection to `shekargaah.ir` delivers about 63KB
 * and then drops to ~2.9KB/s, so a page whose bundle is ~290KB can never load
 * from one origin. Measured: six *parallel* connections each received their own
 * ~59KB (~354KB total, no global cap), and Cloudflare's alternative HTTPS ports
 * (8443/2053/2083/2087/2096) are separate origins, each reachable from Iran with
 * its own allowance — so listing such ports here buys a fresh budget per port.
 * Every origin serves the same Pages project, so no file is copied: only URLs
 * are rewritten, in `index.html` and in the chunks' import specifiers alike.
 *
 * **Currently disabled, and not yet a solution.** An end-to-end browser run from
 * a throttled Iranian line still did not render the app — the origin budget is
 * real, but something in the browser's handling of six ports of one hostname
 * (Chromium caps sockets per host) keeps it from using all of them, and the
 * React DOM chunk is 64,254 bytes, just over the per-response limit, so it can
 * only trickle through. Serving that chunk pre-compressed is not an option
 * either: Cloudflare strips a `Content-Encoding` set by a Pages Function while
 * still sending the compressed body, which ships broken JavaScript.
 *
 * Leave `assetShards` empty (the default) unless you are prepared to finish and
 * verify that work. `VITE_ASSET_SHARDS` overrides the committed list.
 */
function assetShards(): Plugin {
  // The committed list lives in `site.config.json` so every build agrees;
  // `VITE_ASSET_SHARDS` overrides it for a one-off run or a preview. Accepts
  // bare hostnames or full origins, so local runs can point at
  // `http://127.0.0.1:8789` while production uses `https://a.shekargaah.ir`.
  const fromConfig = (JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url), 'utf8')) as {
    assetShards?: string[]
  }).assetShards

  const shards = (process.env.VITE_ASSET_SHARDS ?? fromConfig?.join(',') ?? '')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .map((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`))

  return {
    name: 'shekargah-asset-shards',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      if (shards.length < 2) return

      // Greedy: largest files first, each onto the currently lightest shard, so
      // the big chunks (react-dom, the app entry) end up on different hostnames.
      const files = Object.entries(bundle)
        .filter(([, item]) => item.type === 'asset' || item.type === 'chunk')
        .map(([file, item]) => ({ file, size: item.type === 'chunk' ? item.code.length : String(item.source).length }))
        .sort((a, b) => b.size - a.size)

      const load = shards.map(() => 0)
      const shardOf = new Map<string, string>()
      for (const { file, size } of files) {
        const index = load.indexOf(Math.min(...load))
        shardOf.set(file, shards[index]!)
        load[index] += size
      }

      /** Points a `"/assets/x.js"`-style reference at its assigned hostname. */
      const toAbsolute = (file: string) => `${shardOf.get(file)}/${file}`

      for (const [file, item] of Object.entries(bundle)) {
        if (item.type === 'chunk') {
          let code = item.code
          for (const candidate of shardOf.keys()) {
            // Import specifiers rollup emits are the only places these exact
            // hashed names appear: `"./x.js"`, `"../assets/x.js"`, `"assets/x.js"`.
            code = code
              .replaceAll(`"./` + candidate.split('/').pop() + `"`, `"` + toAbsolute(candidate) + `"`)
              .replaceAll(`"../` + candidate + `"`, `"` + toAbsolute(candidate) + `"`)
              .replaceAll(`"` + candidate + `"`, `"` + toAbsolute(candidate) + `"`)
          }
          item.code = code
          continue
        }

        if (typeof item.source !== 'string') continue
        if (file === 'index.html') {
          let html = item.source
          for (const candidate of shardOf.keys()) {
            html = html.replaceAll(`"/${candidate}"`, `"${toAbsolute(candidate)}"`)
          }
          item.source = html
          continue
        }
        // CSS reaches its fonts with absolute `/assets/...` urls; whichever
        // hostname serves the stylesheet should serve its fonts too, so pin
        // them to the stylesheet's own shard.
        if (file.endsWith('.css')) {
          let css = item.source
          for (const candidate of shardOf.keys()) {
            css = css.replaceAll(`url(/${candidate})`, `url(${toAbsolute(candidate)})`)
          }
          item.source = css
        }
      }

      this.warn(`assets spread over ${shards.length} hostnames: ${shards.join(', ')}`)
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
    plugins: [react(), tailwindcss(), siteUrlHtml(), preloadPersianFont(), assetShards()],
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
           * One chunk per framework library, kept small on purpose.
           *
           * An Iranian connection to `shekargaah.ir` delivers ~63KB and then
           * drops to ~2.9KB/s, so a response has to stay under that or it stalls.
           * Keeping each library separate also means a deploy only invalidates
           * the chunks that actually changed.
           */
          manualChunks: (id: string) => {
            const match = /node_modules[\\/](?:\.vite[\\/]deps[\\/])?((?:@[^\\/]+[\\/])?[^\\/]+)/.exec(id)
            if (!match) return undefined
            const pkg = match[1]

            if (pkg === 'react-dom') return 'vendor-react-dom'
            if (pkg === 'react' || pkg === 'scheduler') return 'vendor-react'
            if (pkg === 'react-router' || pkg === 'react-router-dom') return 'vendor-router'
            if (pkg === '@tanstack/react-query' || pkg === '@tanstack/query-core') return 'vendor-query'
            if (pkg === 'lucide-react') return 'vendor-icons'
            return 'vendor'
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
