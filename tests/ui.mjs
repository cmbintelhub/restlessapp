import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js'
const { chromium } = pw

const BASE = process.env.BASE || 'http://127.0.0.1:8080/index.html'
const SHOTS = process.env.SHOTS || '/home/claude/shots'
const shots = []
let pass = 0
const fails = []
const check = (name, cond, detail) => cond ? pass++ : fails.push(`${name}${detail ? ' — ' + detail : ''}`)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

const shot = async (name) => {
  await page.waitForTimeout(220)
  const f = `${SHOTS}/${name}.png`
  await page.screenshot({ path: f })
  shots.push(f)
}

await page.goto(BASE)
await page.waitForTimeout(500)

check('the browser tab reads Restless only', (await page.title()) === 'Restless', await page.title())
check('an SVG favicon is declared',
  await page.locator('link[rel="icon"][type="image/svg+xml"]').count() === 1)
check('the social preview points at a PNG',
  (await page.locator('meta[property="og:image"]').getAttribute('content') || '').endsWith('.png'))
check('the preview image is reachable',
  (await page.request.get(new URL('preview.png', BASE).href)).status() === 200)
check('the favicon is reachable',
  (await page.request.get(new URL('favicon.svg', BASE).href)).status() === 200)
check('the welcome headline is the short one',
  await page.getByText('Waste starts in the cart.', { exact: true }).count() === 1)
check('the welcome body dropped the third sentence',
  !(await page.locator('body').innerText()).includes('restless works at that moment'))

await shot('01-onb-welcome')

await page.getByRole('button', { name: /Set up in 90 seconds/i }).click()
await shot('02-onb-household')
check('every person gets their own card',
  await page.getByText(/^Adult 1$/).count() === 1 && await page.getByText(/^Adult 2$/).count() === 1)
check('each person shows a BMI', await page.getByText(/BMI /).count() >= 2)
await page.getByRole('button', { name: 'Children +' }).click()
await page.waitForTimeout(250)
check('adding a child adds a card', await page.getByText(/^Child 1$/).count() === 1)
await shot('02b-household-people')
await page.getByRole('button', { name: /^Next$/ }).click()
await shot('03-onb-rank')
await page.getByRole('button', { name: /^Next$/ }).click()
await shot('04-onb-list')
await page.getByRole('button', { name: /Open restless/i }).click()
await page.waitForTimeout(400)
await shot('05-home')

await page.getByRole('button', { name: /^Planner$/ }).click()
await shot('06-planner-list')
// open the quantity sheet on the first list row
await page.locator('main li').filter({ hasText: 'Tomatoes' }).locator('button').first().click()
await page.waitForTimeout(300)
await shot('07-quantity-sheet')
// pick the oversized 5 kg pack to trigger the waste-risk flag
// Regression: a dispatch from inside a sheet must not remount the tree and close it.
// (App used to declare Frame inside the component, which did exactly that.)
await page.getByRole('button', { name: '5 kg', exact: true }).click()
await page.waitForTimeout(300)
check('sheet survives a state update', await page.locator('[role="dialog"]').count() === 1)
check('waste risk is flagged at 5 kg', await page.locator('[role="dialog"]').getByText(/Waste risk/).count() === 1)
await shot('08-quantity-risk')
await page.locator('[role="dialog"] button[aria-label="close"]').click()
await page.waitForTimeout(250)
check('the sheet closes on the X', await page.locator('[role="dialog"]').count() === 0)
check('the flag is visible on the list row', await page.getByText(/Waste risk/).count() >= 1)
await shot('09-planner-flagged')

await page.getByRole('button', { name: /^Pantry$/ }).click()
await shot('10-pantry')

await page.getByRole('button', { name: /^Radar$/ }).click()
await page.waitForTimeout(300)
await shot('11-radar-list')
await page.getByRole('button', { name: /^Map$/ }).click()
await page.waitForTimeout(1200)
await shot('12-radar-map')

// Regression: Leaflet's panes go up to z-index 1000 and used to paint over the sheets.
await page.locator('main li').first().locator('button').first().click()
await page.waitForTimeout(400)
const sheetOnTop = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]')
  if (!d) return false
  const r = d.getBoundingClientRect()
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + 40)
  return d.contains(hit)
})
check('the deal sheet paints above the map', sheetOnTop)
const toastOnTop = await page.evaluate(() => {
  const map = document.querySelector('.leaflet-container')
  return !map || getComputedStyle(map).zIndex === '0'
})
check('the map keeps its own stacking context', toastOnTop)
await shot('12b-deal-over-map')
await page.locator('[role="dialog"] button[aria-label="close"]').click()
await page.waitForTimeout(250)
await page.getByRole('button', { name: /^List$/ }).click()
await page.locator('main li').first().locator('button').first().click()
await page.waitForTimeout(300)
await shot('13-deal-sheet')
await page.locator('[role="dialog"] button').filter({ hasText: /Reserve/ }).click()
await page.waitForTimeout(300)
await shot('14-pix')
await page.locator('[role="dialog"] button').filter({ hasText: /Pay with Pix/ }).click()
await page.waitForTimeout(500)
check('reserving confirms with a toast', await page.getByText(/kept out of the bin/).count() >= 1)
await shot('15-after-pay')

await page.getByRole('button', { name: /^Neighbors$/ }).click()
await page.waitForTimeout(250)
await shot('16-community')
await page.locator('main button').filter({ hasText: /^Claim$/ }).first().click()
await page.waitForTimeout(400)
await shot('17-claimed')

await page.getByRole('button', { name: /^Impact$/ }).click()
await page.waitForTimeout(250)
const kgText = await page.locator('main .num').first().innerText()
check('impact shows a non-zero total', parseFloat(kgText.replace(',', '.')) > 0, kgText)
await shot('18-impact')

// Assistente: ícone no topo, sugestões, resposta contextual e transferência para atendente
await page.locator('header button[aria-label="Open the assistant"]').click()
await page.waitForTimeout(350)
const dlg = page.locator('[role="dialog"]')
check('the assistant opens from the header', await dlg.count() === 1)
check('the assistant greets first', await dlg.getByText(/restless assistant/).count() >= 1)
check('starter suggestions are offered', await dlg.locator('[data-chips] button').count() === 4)
await shot('18a-chat-open')
await dlg.locator('[data-chips] button').filter({ hasText: 'How much have I saved?' }).click()
await page.waitForTimeout(1000)
const botAfterChip = await dlg.locator('p[data-from="bot"]').last().innerText()
check('a suggestion chip gets an answer', /kept .* kg/.test(botAfterChip), botAfterChip)
check('the contextual answer matches the Impact tab', botAfterChip.includes(kgText.trim()), `${kgText} | ${botAfterChip}`)
await dlg.getByRole('textbox').fill('any discounts nearby?')
await dlg.getByRole('button', { name: 'Send' }).click()
await page.waitForTimeout(1000)
check('typed questions are answered from app data', /open deals on the Radar/.test(await dlg.locator('p[data-from="bot"]').last().innerText()))
await shot('18b-chat-answers')
await dlg.getByRole('textbox').fill('can you order me a pizza')
await page.keyboard.press('Enter')
await page.waitForTimeout(900)
check('unknown questions hand off to a human', /human agent/.test(await dlg.locator('p[data-from="bot"]').last().innerText()))
check('the handoff shows a connecting state', await dlg.locator('[data-handoff="connecting"]').count() === 1)
check('the input is hidden while handed off', await dlg.getByRole('textbox').count() === 0)
await page.waitForTimeout(1600)
check('the handoff reaches the queue', await dlg.locator('[data-handoff="queue"]').count() === 1)
await shot('18c-chat-handoff')
await dlg.getByRole('button', { name: 'Back to the assistant' }).click()
await page.waitForTimeout(200)
check('going back restores the input', await dlg.getByRole('textbox').count() === 1)
const bubbles = await dlg.locator('p[data-from]').count()
await dlg.locator('button[aria-label="close"]').first().click()
await page.waitForTimeout(250)
await page.locator('header button[aria-label="Open the assistant"]').click()
await page.waitForTimeout(300)
check('closing the assistant keeps the conversation', await page.locator('[role="dialog"] p[data-from]').count() === bubbles)
await page.locator('[role="dialog"] button[aria-label="close"]').first().click()
await page.waitForTimeout(250)

// demo panel
await page.locator('header button[aria-label="Demo controls"]').click()
await page.waitForTimeout(300)
await shot('19-sim')
await page.locator('[role="dialog"] button').filter({ hasText: /Move 3 days forward/ }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: /^Today$/ }).click()
await page.waitForTimeout(300)
await shot('20-home-after-3-days')

// settings + language toggle
await page.locator('header button[aria-label="Settings"]').click()
await page.waitForTimeout(350)
await shot('21-settings')
await page.locator('[role="dialog"] button').filter({ hasText: /Português/ }).click()
await page.waitForTimeout(350)
await shot('22-settings-pt')
await page.locator('[role="dialog"] button[aria-label="close"]').click()
await page.waitForTimeout(300)
await shot('23-home-pt')
await page.getByRole('button', { name: /^Lista$/ }).click()
await page.waitForTimeout(250)
check('the interface switches to Portuguese', await page.getByText('Lista de compras').count() === 1)
await page.locator('header button[aria-label="Abrir o assistente"]').click()
await page.waitForTimeout(300)
await page.locator('[role="dialog"]').getByRole('textbox').fill('o que vence essa semana')
await page.keyboard.press('Enter')
await page.waitForTimeout(1000)
check('o assistente responde em português', /vence|atenção|controle/.test(await page.locator('[role="dialog"] p[data-from="bot"]').last().innerText()))
// Regressão: o cartão da fila, criado em inglês, trocava de idioma junto com a interface.
check('o cartão da fila fica no idioma em que foi criado',
  /in line/.test(await page.locator('[role="dialog"] [data-handoff="queue"]').innerText()))
const ptAns = await page.locator('[role="dialog"] p[data-from="bot"]').last().innerText()
const ptLines = ptAns.split('\n').filter((l) => l.includes(':') && !l.endsWith(':')).map((l) => l.split(':')[0])
check('nenhum produto repetido na resposta de validade', new Set(ptLines).size === ptLines.length, ptAns)
await shot('23b-chat-pt')
await page.locator('[role="dialog"] button[aria-label="close"]').first().click()
await page.waitForTimeout(250)
await page.locator('header button[aria-label="Ajustes"]').click()
await page.waitForTimeout(300)
await page.locator('[role="dialog"] button').filter({ hasText: /Reiniciar o protótipo/ }).click()
await page.locator('[role="dialog"] button').filter({ hasText: /Reiniciar tudo/ }).click()
await page.waitForTimeout(500)
check('the Portuguese headline is the short one',
  await page.getByText('O desperdício começa no carrinho.', { exact: true }).count() === 1)
check('the Portuguese body dropped the third sentence',
  !(await page.locator('body').innerText()).includes('age nessa hora'))
await shot('24-planner-pt')

// desktop framing
const wide = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await wide.goto(BASE)
await wide.waitForTimeout(700)
await wide.screenshot({ path: `${SHOTS}/25-desktop.png` })
shots.push(`${SHOTS}/25-desktop.png`)

// Página de instalação e artefatos do GitHub Pages
{
  const base = new URL(BASE)
  const dl = await wide.request.get(new URL('baixar/', base).href)
  check('a página de instalação responde', dl.status() === 200, String(dl.status()))
  const html = await dl.text()
  check('a página não oferece mais APK', !/\.apk|APK/.test(html))
  check('a página cobre iPhone', /Adicionar à Tela de Início/.test(html))
  check('a página cobre Android pelo Chrome', /Instalar/.test(html) && /Adicionar à tela inicial/.test(html))
  check('a página mostra o endereço do GitHub Pages', html.includes('cmbintelhub.github.io/restlessapp'))
  check('nenhuma menção ao Netlify na página', !/netlify/i.test(html))

  // O QR é decodificado de verdade: rasteriza o SVG e lê com jsQR.
  const svg = html.match(/<svg[^>]*aria-label="QR code[\s\S]*?<\/svg>/)?.[0]
  check('a página traz o QR embutido', !!svg)
  if (svg) {
    const { default: sharp } = await import('/home/claude/.npm-global/lib/node_modules/sharp/lib/index.js')
    const { default: jsQR } = await import('jsqr')
    const { data, info } = await sharp(Buffer.from(svg)).resize(520, 520).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height)
    check('o QR aponta para a página de instalação no GitHub Pages',
      code?.data === 'https://cmbintelhub.github.io/restlessapp/baixar/', code?.data)
  }

  // Varre o build inteiro, binários incluídos, atrás de qualquer resto do deploy antigo.
  const fsMod = await import('fs')
  const pathMod = await import('path')
  const distDir = pathMod.resolve(pathMod.dirname(new URL(import.meta.url).pathname), '..', 'dist')
  const leftovers = []
  const walk = (d) => {
    for (const f of fsMod.readdirSync(d, { withFileTypes: true })) {
      const full = pathMod.join(d, f.name)
      if (f.isDirectory()) walk(full)
      else if (/netlify|restlesswaste/i.test(fsMod.readFileSync(full).toString('latin1'))) leftovers.push(full)
    }
  }
  walk(distDir)
  check('nenhum arquivo do build menciona o deploy antigo', leftovers.length === 0, leftovers.join(', '))
  check('o APK foi removido do site', (await wide.request.get(new URL('restless.apk', base).href)).status() === 404)
  check('o assetlinks foi removido do site', (await wide.request.get(new URL('.well-known/assetlinks.json', base).href)).status() === 404)
  check('o .nojekyll é publicado', (await wide.request.get(new URL('.nojekyll', base).href)).status() === 200)
  const man = await wide.request.get(new URL('manifest.webmanifest', base).href)
  check('o manifest é publicado', man.status() === 200)
  const mj = await man.json()
  check('o manifest usa caminhos relativos para funcionar em subpasta', mj.start_url.startsWith('./') && mj.scope === './')
  check('o index traz as metatags de app do iOS',
    await wide.locator('meta[name="apple-mobile-web-app-capable"]').count() === 1)
  check('o preview social usa URL absoluta do GitHub Pages',
    (await wide.locator('meta[property="og:image"]').getAttribute('content')) === 'https://cmbintelhub.github.io/restlessapp/preview.png')
  const swReady = await wide.evaluate(async () => {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 4000))])
    return reg ? reg.scope : null
  })
  check('o service worker registra dentro da subpasta', !!swReady && swReady === new URL('./', base).href, swReady)
}

await browser.close()

const real = errors.filter((e) => !/403|ERR_/.test(e))
check('no runtime errors in the console', real.length === 0, real.join(' | '))

console.log(shots.join('\n'))
console.log(`\n${pass} UI checks passed, ${fails.length} failed`)
if (fails.length) {
  console.log('\nFAILED:')
  for (const f of fails) console.log('  x ' + f)
  process.exit(1)
}
