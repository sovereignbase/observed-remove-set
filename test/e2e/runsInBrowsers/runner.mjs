import { chromium, firefox, webkit } from 'playwright'
import { runBrowserSuite } from './package-name.spec.js'

const browserTypes = [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
]

export async function runBrowserMatrix(origin) {
  const failures = []

  for (const [name, browserType] of browserTypes) {
    let browser

    try {
      browser = await browserType.launch({ headless: true })
      const page = await browser.newPage()
      await runBrowserSuite(page, origin)
      console.log(`ok - browser:${name}`)
    } catch (error) {
      failures.push([name, error])
      console.error(`not ok - browser:${name}`)
      console.error(error)
    } finally {
      await browser?.close()
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(
      failures.map(([, error]) => error),
      `Browser E2E failed in ${failures.map(([name]) => name).join(', ')}`
    )
  }
}
