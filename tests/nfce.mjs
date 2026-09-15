// node tests/nfce.mjs
// Testa o parser de NFC-e e o matcher contra dois casos: um cupom limpo, como o
// OCR entregaria numa foto perfeita, e o OCR real da nota fotografada, com todos
// os defeitos que ela tem de verdade.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nfce = await import(path.join(root, 'src/lib/nfce.js'))
const matcher = await import(path.join(root, 'src/lib/matcher.js'))
const { byId, CATALOG } = await import(path.join(root, 'src/data/catalog.js'))

const {
  validEan, repairEan, findEan, validAccessKey, accessKeyDv, parseAccessKey,
  repairAccessKey, plausibleAccessKey, keyFromQr, validCnpj, findCnpj,
  descriptionFrom, sizeFrom, parseReceipt,
} = nfce
const { matchProduct, quantityFor, consolidate, dice, norm, isNonFood, guessCategory } = matcher

let pass = 0
const fails = []
const check = (name, cond, detail) => cond ? pass++ : fails.push(`${name}${detail ? ' — ' + detail : ''}`)

const truth = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/nfce-truth.json'), 'utf8'))
const KEY = truth.chave

/* ---------------- EAN ---------------- */
check('ean: código real é válido', validEan('7894900027013'))
check('ean: dígito trocado é rejeitado', !validEan('7894900027014'))
check('ean: tamanho errado é rejeitado', !validEan('789490002701'))
check('ean: texto não numérico é rejeitado', !validEan('78949000270AB'))
check('ean: reparo de um dígito devolve o original',
  repairEan('7894900027014') === '7894900027013' || repairEan('7894900027014') === null)
for (const e of new Set(truth.itens.map((i) => i.ean))) {
  check(`ean: ${e} do cupom é válido`, validEan(e))
}
check('ean: janela deslizante acha o código no meio do lixo',
  findEan('0077894900027013119')?.ean === '7894900027013')
check('ean: sem prefixo brasileiro a janela não inventa', findEan('1234567890123456') === null)

/* ---------------- chave de acesso ---------------- */
check('chave: a da nota é válida', validAccessKey(KEY))
check('chave: DV confere com o impresso', accessKeyDv(KEY.slice(0, 43)) === Number(KEY[43]))
check('chave: um dígito trocado reprova', !validAccessKey(KEY.slice(0, 20) + '9' + KEY.slice(21)))
{
  const f = parseAccessKey(KEY)
  check('chave: UF lida é SP', f.uf === 'SP')
  check('chave: ano e mês batem com a emissão', f.year === 2026 && f.month === 9)
  check('chave: CNPJ sai da chave', f.cnpj === truth.cnpj)
  check('chave: modelo é NFC-e', f.model === '65')
  check('chave: série e número batem', f.series === truth.serie && f.number === truth.numero)
}
check('chave: plausibilidade aceita a verdadeira', plausibleAccessKey(KEY))
check('chave: plausibilidade rejeita UF inexistente', !plausibleAccessKey('99' + KEY.slice(2)))
check('chave: plausibilidade rejeita mês 13',
  !plausibleAccessKey(KEY.slice(0, 4) + '13' + KEY.slice(6)))
check('chave: dígito faltando não é recuperado', repairAccessKey(KEY.slice(0, 43)) === null)
check('chave: reparo de um dígito trocado funciona ou desiste', (() => {
  const broken = KEY.slice(0, 30) + (Number(KEY[30]) === 9 ? '0' : '9') + KEY.slice(31)
  const r = repairAccessKey(broken)
  return r === KEY || r === null
})())

/* ---------------- QR ---------------- */
check('qr: extrai a chave do parâmetro p',
  keyFromQr(`https://www.nfce.fazenda.sp.gov.br/qrcode?p=${KEY}|2|1|1|ABCDEF`) === KEY)
check('qr: acha a chave sem o parâmetro', keyFromQr(`qualquer coisa ${KEY} fim`) === KEY)
check('qr: texto sem chave devolve nulo', keyFromQr('https://exemplo.com') === null)
check('qr: chave inválida no parâmetro é rejeitada',
  keyFromQr(`?p=${KEY.slice(0, 43)}0|2`) === null)

/* ---------------- CNPJ ---------------- */
check('cnpj: o da nota é válido', validCnpj(truth.cnpj))
check('cnpj: dígito trocado reprova', !validCnpj(truth.cnpj.slice(0, 13) + '9'))
check('cnpj: repetido reprova', !validCnpj('11111111111111'))
check('cnpj: encontrado dentro de texto formatado',
  findCnpj('CNPJ:28.036.840/0002-04 HORTIFRUTI') === truth.cnpj)

/* ---------------- pedaços do parser ---------------- */
check('descrição: ignora número do item e código',
  descriptionFrom(' 7894900027013 #REFRIG COCA ORIGINAL 2L R$ 11,99') === 'REFRIG COCA ORIGINAL 2L')
check('descrição: aguenta lixo antes do nome',
  descriptionFrom(' Er 4900 180541 SCHWEPPES CITRUS 1,5').startsWith('SCHWEPPES CITRUS'))
check('descrição: linha sem letras devolve vazio', descriptionFrom('1,000 2,99 17,94') === '')
check('tamanho: 2L vira 2 litros', sizeFrom('REFRIG COCA 2L').value === 2)
check('tamanho: 290ML vira 0,29 litro', Math.abs(sizeFrom('CHA ARIZONA 290ML').value - 0.29) < 1e-9)
check('tamanho: 500G vira 0,5 kg', Math.abs(sizeFrom('MACARRAO 500G').value - 0.5) < 1e-9)
check('tamanho: C4 significa 4 unidades',
  sizeFrom('PANO MICROF C4').value === 4 && sizeFrom('PANO MICROF C4').unit === 'un')
check('tamanho: descrição sem medida devolve nulo', sizeFrom('BANANA PRATA') === null)

/* ---------------- cupom limpo ---------------- */
const clean = [
  'CNPJ:28.036.840/0002-04 HORTIFRUTI TURMALINA LTDA',
  'ALAMEDA DOS GUATAS,589,SAUDE,Sao Paulo,SP',
  'ITEM CODIGO DESCRITIVO QTDE UN VL.UNIT',
  ...truth.itens.flatMap((i) => [
    `${String(i.n).padStart(3, '0')} ${i.ean} ${i.desc}`,
    `${i.qtd.toFixed(3).replace('.', ',')} ${i.un} X R$ ${i.unit.toFixed(2).replace('.', ',')} R$ ${i.total.toFixed(2).replace('.', ',')}`,
    ...(i.desconto ? [`desconto -R$ ${i.desconto.toFixed(2).replace('.', ',')} R$ ${(i.total - i.desconto).toFixed(2).replace('.', ',')}`] : []),
  ]),
  'Qtd. total de itens 12',
  'Valor total R$ 168,47',
  'Desconto R$ 3,00',
  'Valor a Pagar R$ 165,47',
  `3526 0928 0368 4000 0204 6500 3000 1050 8414 0890 7006`,
].join('\n')

{
  const r = parseReceipt(clean)
  check('limpo: acha os 12 itens', r.items.length === 12, `achou ${r.items.length}`)
  check('limpo: todos os EANs corretos',
    r.items.every((it, k) => it.ean === truth.itens[k].ean))
  check('limpo: quantidades corretas',
    r.items.every((it, k) => Math.abs(it.qty - truth.itens[k].qtd) < 1e-6))
  check('limpo: totais de linha corretos',
    r.items.every((it, k) => Math.abs(it.total - truth.itens[k].total) < 0.011))
  check('limpo: descontos de item capturados',
    r.items.filter((i) => i.discount > 0).length === 3)
  check('limpo: chave lida e validada', r.key === KEY && r.keyStatus === 'valid')
  check('limpo: CNPJ lido', r.header.cnpj === truth.cnpj)
  check('limpo: total impresso lido', r.totals.total === truth.total)
  check('limpo: valor pago lido', r.totals.paid === truth.pagar)
  check('limpo: desconto total lido', r.totals.discount === truth.desconto)
  check('limpo: soma dos itens bate com o total', r.sumCheck === 'match', `soma ${r.sum}`)
  check('limpo: confiança alta', r.confidence === 'high')
}

/* ---------------- OCR real ---------------- */
const realText = fs.readFileSync(path.join(root, 'tests/fixtures/nfce-ocr-real.txt'), 'utf8')
{
  const r = parseReceipt(realText)
  const TRUE_EANS = new Set(truth.itens.map((i) => i.ean))
  const good = r.items.filter((i) => i.ean && TRUE_EANS.has(i.ean)).length
  check('real: recupera pelo menos 8 linhas com EAN correto', good >= 8, `recuperou ${good}`)
  check('real: nenhum EAN inventado fora do cupom',
    r.items.every((i) => !i.ean || TRUE_EANS.has(i.ean)),
    r.items.filter((i) => i.ean && !TRUE_EANS.has(i.ean)).map((i) => i.ean).join(','))
  check('real: total impresso lido corretamente', r.totals.total === truth.total)
  check('real: valor pago lido corretamente', r.totals.paid === truth.pagar)
  check('real: desconto do rodapé não confunde com desconto de item',
    r.totals.discount === truth.desconto, String(r.totals.discount))
  check('real: a soma não bate e o parser admite isso', r.sumCheck === 'mismatch')
  check('real: confiança não é alta quando a soma não fecha', r.confidence !== 'high')
  check('real: chave não é aceita porque o OCR perdeu um dígito', r.keyStatus === 'missing')

  /* ---------------- matcher sobre o cupom real ---------------- */
  const rows = r.items.map((i) => {
    const m = matchProduct(i)
    const q = m.productId ? quantityFor(m.productId, i) : { qty: i.qty, unit: i.unit }
    return { ...i, ...m, ...q }
  })
  const food = rows.filter((x) => x.kind === 'food')
  check('matcher: casa pelo menos 9 linhas com o catálogo', food.length >= 9, `casou ${food.length}`)
  check('matcher: o pano de microfibra é marcado como não alimento',
    rows.some((x) => x.kind === 'nonfood' && /PANO/i.test(x.desc)))
  check('matcher: nenhuma linha fica sem classificação',
    rows.every((x) => ['food', 'nonfood', 'unknown'].includes(x.kind)))
  check('matcher: Coca vira refrigerante de cola',
    rows.filter((x) => /COCA/i.test(x.desc)).every((x) => x.productId === 'cola'))
  check('matcher: FANTA lida como FARTA ainda cai em refrigerante de uva',
    rows.some((x) => /FARTA UVA/i.test(x.desc) && x.productId === 'grapesoda'))
  check('matcher: Schweppes vira água tônica',
    rows.some((x) => /SCHWEPPES/i.test(x.desc) && x.productId === 'tonic'))
  check('matcher: Arizona vira chá gelado',
    rows.filter((x) => /ARIZONA|ICE TEA/i.test(x.desc)).every((x) => x.productId === 'icetea'))
  check('matcher: 2L na descrição vira 2 litros na despensa',
    rows.filter((x) => x.productId === 'cola').every((x) => x.unit === 'L' && x.qty === 2))

  const merged = consolidate(food)
  check('consolidar: linhas repetidas viram uma só', merged.length < food.length)
  check('consolidar: soma as quantidades das repetidas',
    merged.find((m) => m.productId === 'cola')?.qty === 6,
    String(merged.find((m) => m.productId === 'cola')?.qty))
}

/* ---------------- matcher isolado ---------------- */
check('matcher: EAN aprendido tem prioridade sobre tudo',
  matchProduct({ ean: '7894900027013', desc: 'QUALQUER COISA' }, { 7894900027013: 'banana' }).productId === 'banana')
check('matcher: EAN aprendido inexistente no catálogo é ignorado',
  matchProduct({ ean: '7894900027013', desc: 'BANANA PRATA' }, { 7894900027013: 'produto-que-nao-existe' }).productId === 'banana')
check('matcher: descrição limpa casa por similaridade ou glossário',
  ['high', 'medium'].includes(matchProduct({ desc: 'IOGURTE NATURAL' }).confidence))
check('matcher: descrição sem sentido não inventa produto',
  matchProduct({ desc: 'XKCD ZZZZ QQQ' }).kind === 'unknown')
check('matcher: glossário tolera letra trocada pelo OCR',
  matchProduct({ desc: 'SCHWEPRES CRUS 45' }).productId === 'tonic')
check('matcher: tolerância marca a confiança como provável, não certa',
  matchProduct({ desc: 'SCHWEPRES CRUS 45' }).confidence === 'medium')
check('matcher: tolerância não casa palavra realmente diferente',
  matchProduct({ desc: 'PRODUTO ZZZZZZ' }).kind === 'unknown')
check('matcher: termo exato continua com confiança alta',
  matchProduct({ desc: 'SCHWEPPES CITRUS 1,5' }).confidence === 'high')
check('matcher: detergente é não alimento', isNonFood('DETERG YPE 500ML'))
check('matcher: banana não é não alimento', !isNonFood('BANANA PRATA KG'))
check('matcher: categoria adivinhada para linha desconhecida',
  guessCategory('REFRIG MARCA DESCONHECIDA 2L') === 'beverage')
check('similaridade: idênticos dão 1', dice('ARROZ', 'ARROZ') === 1)
check('similaridade: nada a ver dá perto de zero', dice('ARROZ', 'XYZKW') < 0.2)
check('normalização: tira acento e caixa', norm('Açúcar Mascavo') === 'ACUCAR MASCAVO')

check('quantidade: produto em unidade não multiplica pelo tamanho',
  quantityFor('eggs', { qty: 2, unit: 'un', size: { value: 12, unit: 'un' } }).qty === 2)
check('quantidade: produto em litro multiplica pelo tamanho',
  quantityFor('cola', { qty: 3, unit: 'un', size: { value: 2, unit: 'L' } }).qty === 6)
check('quantidade: sem tamanho legível assume a embalagem padrão',
  quantityFor('milk', { qty: 2, unit: 'un', size: null }).assumed === true)

/* ---------------- catálogo ---------------- */
check('catálogo: passou de 200 itens', CATALOG.length >= 200, String(CATALOG.length))
check('catálogo: sem ids repetidos',
  new Set(CATALOG.map((p) => p.id)).size === CATALOG.length)
check('catálogo: todo destino do glossário existe',
  matcher.GLOSSARY.every(([, id]) => !!byId(id)),
  matcher.GLOSSARY.filter(([, id]) => !byId(id)).map(([, id]) => id).join(','))
check('catálogo: nenhum item de limpeza ou higiene entrou',
  !CATALOG.some((p) => isNonFood(p.pt) || isNonFood(p.en)),
  CATALOG.filter((p) => isNonFood(p.pt)).map((p) => p.id).join(','))

console.log(`\n${pass} checks passed, ${fails.length} failed`)
if (fails.length) {
  console.log('\nFAILED:')
  for (const f of fails) console.log('  x ' + f)
  process.exit(1)
}
