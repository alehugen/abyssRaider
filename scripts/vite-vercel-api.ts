import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Em `npm run dev`, executa as funções de /api (formato Web Request/Response da
 * Vercel) dentro do próprio Vite — sem precisar do `vercel dev`.
 * Ex.: GET /api/aion/search?... → api/aion/search.ts → export GET(request).
 */
export function vercelApiDev(): Plugin {
  return {
    name: 'abyss-raider:vercel-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const route = url.pathname.replace(/^\/+|\/+$/g, '')
        if (!route || route.split('/').some((part) => part.startsWith('_') || part === '..')) return next()

        const file = resolve(server.config.root, 'api', `${route}.ts`)
        if (!existsSync(file)) return next()

        try {
          const mod = (await server.ssrLoadModule(file)) as Record<string, unknown>
          const handler = mod[req.method ?? 'GET']
          if (typeof handler !== 'function') {
            res.statusCode = 405
            return res.end('Method Not Allowed')
          }
          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value)
            else if (Array.isArray(value)) for (const v of value) headers.append(key, v)
          }
          // POST/PUT (ex.: /api/push/send): repassa o corpo, como a Vercel.
          const method = req.method ?? 'GET'
          let body: Uint8Array<ArrayBuffer> | undefined
          if (method !== 'GET' && method !== 'HEAD') {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            body = new Uint8Array(Buffer.concat(chunks))
          }
          const request = new Request(new URL(`/api${req.url}`, `http://${req.headers.host}`), {
            method,
            headers,
            body,
          })
          const response = (await handler(request)) as Response
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          server.config.logger.error(`[api] ${route}: ${String(error)}`)
          res.statusCode = 500
          res.end('Internal Server Error')
        }
      })
    },
  }
}
