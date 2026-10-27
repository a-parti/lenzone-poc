import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev server only: lets the Memes tab's admin "Save" write src/data/gifs/week-N.json directly, so
// the picks show up right away and just need committing. Accepts only { key: [{ id, title }] }.
function saveGifPicks() {
  const dir = fileURLToPath(new URL('./src/data/gifs/', import.meta.url))
  return {
    name: 'save-gif-picks',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-gifs', (req, res) => {
        const week = Number(new URL(req.url, 'http://localhost').searchParams.get('week'))
        if (req.method !== 'POST' || !Number.isInteger(week) || week < 1 || week > 30) {
          res.statusCode = 400
          return res.end()
        }
        let body = ''
        req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy() })
        req.on('end', () => {
          try {
            const picks = JSON.parse(body)
            const clean = Object.fromEntries(Object.entries(picks).map(([key, gifs]) => [
              String(key).replace(/[^\w|-]/g, ''),
              (Array.isArray(gifs) ? gifs : [])
                .filter(g => /^[A-Za-z0-9]+$/.test(g?.id || ''))
                .map(g => ({ id: g.id, title: String(g.title || '').slice(0, 200) }))
            ]).filter(([key, gifs]) => key && gifs.length))
            fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(`${dir}week-${week}.json`, `${JSON.stringify(clean, null, 2)}\n`)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ file: `src/data/gifs/week-${week}.json` }))
          } catch {
            res.statusCode = 400
            res.end()
          }
        })
      })
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    saveGifPicks(),
  ],
})
