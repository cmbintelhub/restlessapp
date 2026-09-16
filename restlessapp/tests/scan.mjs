// node tests/scan.mjs
// Roda o pipeline inteiro dentro do navegador, com a foto real da nota:
// upload -> pré-processamento -> Tesseract WASM -> parser -> matcher -> revisão.
// É lento de propósito: é o único teste que prova que o OCR embarcado funciona.
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js'
import path from 'path'
import { fileURLToPath } from 'url'

const { chromium } = pw
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.BASE || 'http://127.0.0.1:8080/index.html'
const SHOTS = process.env.SHOTS || '/home/claude/shots'
const PHOTO = path.join(root, 'tests/fixtures/nota.jpg')

let pass = 0
const fails = []
const check = (name, cond, detail) => cond ? pass++ : fails.push(`${name}${detail ? ' — ' + detail : ''}`)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 430, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(BASE)
await page.getByRole('button', { name: /Set up in 90 seconds/i }).click()
await page.getByRole('button', { name: /^Next$/ }).click()
await page.getByRole('button', { name: /^Next$/ }).click()
await page.getByRole('button', { name: /Open restless/i }).click()
await page.waitForTimeout(300)
// This script only cares about the scanner, not the post-onboarding pillar tour.
await page.getByRole('button', { name: /Skip tour/i }).click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: /^Planner$/ }).click()
await page.getByRole('button', { name: /Import a receipt/i }).click()
await page.waitForTimeout(400)

check('o scanner abre com câmera e upload',
  await page.getByRole('button', { name: /Use the camera/i }).count() === 1 &&
  await page.getByRole('button', { name: /Choose a photo/i }).count() === 1)
check('as notas preparadas continuam disponíveis',
  await page.getByText(/Mercado Bom Preço/).count() === 1)
await page.screenshot({ path: `${SHOTS}/30-scan-choose.png` })

const before = Date.now()
await page.setInputFiles('input[type=file]', PHOTO)

// O Tesseract carrega ~15 MB de WASM e modelo na primeira vez.
await page.waitForSelector('text=/Check before importing|Nothing could be read/', { timeout: 180000 })
const seconds = Math.round((Date.now() - before) / 1000)
console.log(`   leitura completa em ${seconds}s`)

const failed = await page.getByText(/Nothing could be read/).count()
check('a foto real produziu uma revisão, não uma falha', failed === 0)

if (!failed) {
  await page.screenshot({ path: `${SHOTS}/31-scan-review.png`, fullPage: true })
  const body = await page.locator('[role="dialog"]').innerText()

  const lines = await page.locator('[role="dialog"] ul li').count()
  check('a revisão listou linhas da nota', lines >= 4, `${lines} linhas`)
  check('reconheceu refrigerante de cola', /Refrigerante de cola|cola/i.test(body))
  check('reconheceu chá gelado', /Chá gelado|Iced tea/i.test(body))
  check('marcou o item que não é alimento', /Not food|Não é alimento/i.test(body))
  check('mostrou o total impresso da nota', /168[,.]47/.test(body))
  check('avisou que a soma não fecha',
    /does not match the printed total|não bate com o total/i.test(body))
  check('mostrou pelo menos um código de barras', /\b789\d{10}\b/.test(body))

  const confirm = page.locator('[role="dialog"] button').filter({ hasText: /Import \d+ items/ })
  check('o botão de importar mostra a contagem', await confirm.count() === 1)
  await confirm.click()
  await page.waitForTimeout(600)

  await page.getByRole('button', { name: /^Pantry$/ }).click()
  await page.waitForTimeout(400)
  const pantry = await page.locator('main').innerText()
  check('os itens da nota chegaram na despensa', /Refrigerante de cola|Cola/i.test(pantry))
  await page.screenshot({ path: `${SHOTS}/32-pantry-after-scan.png` })
}

check('nenhum erro de runtime durante o escaneamento', errors.length === 0, errors.join(' | '))

await browser.close()
console.log(`\n${pass} checks passed, ${fails.length} failed`)
if (fails.length) {
  console.log('\nFAILED:')
  for (const f of fails) console.log('  x ' + f)
  process.exit(1)
}
