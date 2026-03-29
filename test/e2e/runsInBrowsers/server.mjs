import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

const contentTypes = {
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
}

export async function startServer(rootDir) {
  const root = resolve(rootDir)
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      const pathname =
        url.pathname === '/'
          ? '/test/e2e/runsInBrowsers/index.html'
          : url.pathname
      const filePath = resolve(root, `.${decodeURIComponent(pathname)}`)

      if (!filePath.startsWith(root)) {
        response.writeHead(403)
        response.end('Forbidden')
        return
      }

      const body = await readFile(filePath)
      response.writeHead(200, {
        'content-type':
          contentTypes[extname(filePath)] ?? 'application/octet-stream',
      })
      response.end(body)
    } catch {
      response.writeHead(404)
      response.end('Not found')
    }
  })

  await new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', resolvePromise)
  })

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolvePromise, rejectPromise) => {
        server.close((error) => {
          if (error) {
            rejectPromise(error)
            return
          }
          resolvePromise()
        })
      }),
  }
}
