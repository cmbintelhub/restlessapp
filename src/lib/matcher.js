import { CATALOG, byId } from '../data/catalog.js'

/**
 * Casamento de uma linha de cupom com o catálogo, em camadas:
 *   1. EAN já aprendido numa revisão anterior            -> confiança alta
 *   2. glossário de abreviações e marcas do varejo       -> confiança alta
 *   3. similaridade por bigramas contra o catálogo       -> média ou baixa
 *   4. classificador de sobra: não alimento, ou categoria pelo contexto
 */

export const norm = (s) =>
  String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const bigrams = (s) => {
  const t = norm(s).replace(/\s/g, '')
  const out = new Set()
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2))
  return out
}

export function dice(a, b) {
  const A = bigrams(a)
  const B = bigrams(b)
  if (!A.size || !B.size) return 0
  let hit = 0
  for (const g of A) if (B.has(g)) hit++
  return (2 * hit) / (A.size + B.size)
}

/**
 * Glossário: o primeiro padrão que casar ganha, então o mais específico vem antes.
 * Cada entrada é [lista de termos que precisam aparecer, id do catálogo].
 */
export const GLOSSARY = [
  // bebidas, que é onde as marcas dominam a descrição
  [['COCA', 'ZERO'], 'colazero'], [['PEPSI', 'BLACK'], 'colazero'],
  [['REFRIG', 'COLA'], 'cola'], [['COCA', 'COLA'], 'cola'], [['COCA'], 'cola'], [['PEPSI'], 'cola'],
  [['FANTA', 'UVA'], 'grapesoda'], [['SUKITA', 'UVA'], 'grapesoda'], [['REFRIG', 'UVA'], 'grapesoda'],
  [['FANTA', 'LARANJA'], 'orangesoda'], [['SUKITA'], 'orangesoda'], [['REFRIG', 'LARANJA'], 'orangesoda'],
  [['GUARANA'], 'guarana'], [['ANTARCTICA'], 'guarana'],
  [['SODA', 'ANTAR'], 'sodaclub'], [['SODA', 'LIMONADA'], 'sodaclub'],
  [['SPRITE'], 'lemonsoda'], [['7UP'], 'lemonsoda'], [['REFRIG', 'LIMAO'], 'lemonsoda'],
  [['SCHWEPPES'], 'tonic'], [['TONICA'], 'tonic'],
  [['AGUA', 'GAS'], 'sparkwater'], [['AGUA', 'MINE'], 'water'], [['AGUA', 'MINERAL'], 'water'],
  [['CRYSTAL'], 'water'], [['BONAFONT'], 'water'], [['MINALBA'], 'water'], [['AGUA', 'COCO'], 'coconutwater'],
  [['ICE', 'TEA'], 'icetea'], [['CHA', 'ARIZONA'], 'icetea'], [['ARIZONA'], 'icetea'],
  [['CHA', 'MATE'], 'mate'], [['MATTE'], 'mate'],
  [['SUCO', 'LARANJA'], 'orangejuice'], [['SUCO', 'UVA'], 'grapejuice'], [['SUCO'], 'juicebox'],
  [['NECTAR'], 'nectar'], [['ENERGETICO'], 'energydrink'], [['RED', 'BULL'], 'energydrink'],
  [['GATORADE'], 'isotonic'], [['ISOTONICO'], 'isotonic'],
  [['ACHOC', 'PO'], 'chocopowder'], [['NESCAU', 'PO'], 'chocopowder'], [['ACHOC'], 'chocomilk'],
  [['TODDYNHO'], 'chocomilk'], [['YAKULT'], 'yakult'], [['KOMBUCHA'], 'kombucha'],
  [['CERVEJA'], 'beer'], [['CERV'], 'beer'], [['HEINEKEN'], 'beer'], [['BRAHMA'], 'beer'], [['SKOL'], 'beer'],
  [['VINHO', 'BRANCO'], 'whitewine'], [['VINHO'], 'wine'], [['ESPUMANTE'], 'sparkling'],
  [['CACHACA'], 'cachaca'], [['VODKA'], 'vodka'], [['GIN'], 'gin'], [['WHISKY'], 'whisky'],

  // laticínios e mercearia, onde manda a abreviação
  [['LEITE', 'PO'], 'milkpowder'], [['LEITE', 'COND'], 'condensed'], [['LEITE', 'COCO'], 'coconutmilk'],
  [['LEITE', 'SEMI'], 'milksemi'], [['LEITE', 'INT'], 'milk'], [['LEITE', 'DESN'], 'milksemi'], [['LT', 'INT'], 'milk'],
  [['CREME', 'LEITE'], 'cream'], [['REQUEIJAO'], 'creamch'], [['REQ'], 'creamch'],
  [['IOG', 'GREGO'], 'greekyog'], [['IOGURTE'], 'yogurt'], [['IOG'], 'yogurt'], [['DANONE'], 'yogurt'],
  [['QJO', 'MUSS'], 'mozza'], [['MUSSARELA'], 'mozza'], [['MUCARELA'], 'mozza'], [['MUSS'], 'mozza'],
  [['QJO', 'MINAS'], 'minas'], [['QUEIJO', 'MINAS'], 'minas'], [['PARMESAO'], 'parmesan'],
  [['QJO', 'PRATO'], 'prato'], [['QUEIJO', 'PRATO'], 'prato'], [['RICOTA'], 'curd'],
  [['MANTEIGA'], 'butter'], [['MARGARINA'], 'margarine'], [['NATA'], 'sourcream'],
  [['PAO', 'QUEIJO'], 'cheesebread'], [['PAO', 'FORMA'], 'slicedbr'], [['PAO', 'INTEGRAL'], 'wholebread'],
  [['PAO', 'FRANCES'], 'breadroll'], [['PAO', 'SAL'], 'breadroll'],
  [['ARROZ', 'INTEGRAL'], 'ricebrown'], [['ARROZ'], 'rice'],
  [['FEIJAO', 'PRETO'], 'beans'], [['FEIJAO', 'CARIOCA'], 'beanscarioca'], [['FEIJAO'], 'beanscarioca'],
  [['MACARRAO', 'INST'], 'instantnoodle'], [['MIOJO'], 'instantnoodle'], [['MACARRAO'], 'pasta'], [['ESPAGUETE'], 'pasta'],
  [['FARINHA', 'TRIGO'], 'flour'], [['FARINHA', 'MANDIOCA'], 'cassavaflour'], [['FUBA'], 'cornflour'],
  [['OLEO', 'SOJA'], 'oil'], [['AZEITE'], 'oliveoil'], [['VINAGRE'], 'vinegar'],
  [['CAFE', 'SOLUVEL'], 'coffeesoluble'], [['CAFE'], 'coffee'],
  [['ACUCAR'], 'sugar'], [['SAL', 'REFINADO'], 'salt'],
  [['MOLHO', 'TOMATE'], 'tomatosauce'], [['EXTRATO', 'TOMATE'], 'tomatopaste'],
  [['MAIONESE'], 'mayo'], [['KETCHUP'], 'ketchup'], [['MOSTARDA'], 'mustard'],
  [['ATUM'], 'tuna'], [['SARDINHA'], 'sardine'], [['MILHO', 'VERDE'], 'cornCan'],
  [['OVOS'], 'eggs'], [['OVO', 'BCO'], 'eggs'], [['OVO'], 'eggs'],

  // hortifruti e proteínas com abreviação comum de balança
  [['TOMATE'], 'tomato'], [['BATATA', 'DOCE'], 'sweetpot'], [['BATATA', 'PALHA'], 'chips'], [['BATATA'], 'potato'],
  [['CEBOLA'], 'onion'], [['ALHO'], 'garlic'], [['CENOURA'], 'carrot'], [['ALFACE'], 'lettuce'],
  [['BANANA'], 'banana'], [['MACA'], 'apple'], [['LARANJA', 'PERA'], 'orange'], [['MAMAO'], 'papaya'],
  [['PEITO', 'FRANGO'], 'chicken'], [['FILE', 'FRANGO'], 'chicken'], [['COXA'], 'chickenthigh'],
  [['FRANGO'], 'chicken'], [['CARNE', 'MOIDA'], 'beef'], [['ALCATRA'], 'steak'], [['ACEM'], 'beefchuck'],
  [['LINGUICA'], 'sausage'], [['SALSICHA'], 'hotdog'], [['PRESUNTO'], 'ham'], [['BACON'], 'bacon'],
  [['SALMAO'], 'salmon'], [['TILAPIA'], 'tilapia'], [['CAMARAO'], 'shrimp'],
]

/** Itens que a nota traz mas não são comida. Entram na revisão e ficam fora da despensa. */
export const NONFOOD = [
  'PANO', 'MICROF', 'DETERG', 'SABAO', 'SABONETE', 'SHAMPOO', 'CONDICION', 'CREME DENTAL',
  'ESCOVA', 'PAPEL HIG', 'PAPEL TOALHA', 'GUARDANAPO', 'ESPONJA', 'DESINF', 'AGUA SANIT',
  'AMACIANT', 'ALVEJANTE', 'LIMPADOR', 'MULTIUSO', 'INSETIC', 'DESODOR', 'ABSORV', 'FRALDA',
  'PILHA', 'LAMPADA', 'VELA', 'ISQUEIRO', 'CIGARRO', 'CARVAO', 'FOSFORO', 'SACO LIXO',
  'FILME PVC', 'ALUMINIO', 'COPO DESC', 'PRATO DESC', 'TALHER', 'LUVA', 'RACAO', 'AREIA GATO',
]

const CATEGORY_HINTS = [
  [['REFRIG', 'AGUA', 'SUCO', 'CHA', 'BEBIDA', 'ENERGET', 'ISOTON', 'NECTAR'], 'beverage'],
  [['CERVEJA', 'VINHO', 'VODKA', 'GIN', 'WHISKY', 'CACHACA', 'ESPUMANTE'], 'alcohol'],
  [['LEITE', 'QUEIJO', 'QJO', 'IOG', 'MANTEIGA', 'REQUEIJAO', 'CREME'], 'dairy'],
  [['CARNE', 'FRANGO', 'BOVIN', 'SUIN', 'PEIXE', 'FILE', 'LINGUICA', 'PEITO'], 'protein'],
  [['PAO', 'BOLO', 'BISCOITO', 'TORRADA', 'ROSCA'], 'bakery'],
  [['CONGELAD', 'PIZZA', 'SORVETE', 'NUGGET'], 'frozen'],
  [['ARROZ', 'FEIJAO', 'MACARRAO', 'FARINHA', 'ACUCAR', 'OLEO', 'CAFE'], 'staple'],
  [['MOLHO', 'TEMPERO', 'VINAGRE', 'AZEITE', 'MAIONESE', 'KETCHUP'], 'condiment'],
  [['BANANA', 'MACA', 'LARANJA', 'UVA', 'MAMAO', 'MANGA', 'FRUTA'], 'fruit'],
  [['ALFACE', 'TOMATE', 'CEBOLA', 'CENOURA', 'COUVE', 'LEGUME', 'VERDURA'], 'veg'],
]

const has = (hay, term) => hay.includes(norm(term))

/**
 * Comparação tolerante: o OCR troca letras dentro da palavra (SCHWEPRES por SCHWEPPES,
 * FARTA por FANTA). Se o termo não aparece literal, aceita um token muito parecido.
 */
const LOOSE_MIN = 0.72
function looseHas(hay, term) {
  const t = norm(term)
  if (hay.includes(t)) return true
  if (t.length < 5 || t.includes(' ')) return false
  return hay.split(' ').some((tok) => tok.length >= 4 && dice(tok, t) >= LOOSE_MIN)
}

export function isNonFood(desc) {
  const d = norm(desc)
  return NONFOOD.some((t) => has(d, t))
}

export function guessCategory(desc) {
  const d = norm(desc)
  for (const [terms, cat] of CATEGORY_HINTS) if (terms.some((t) => has(d, t))) return cat
  return null
}

function fromGlossary(desc) {
  const d = norm(desc)
  for (const [terms, id] of GLOSSARY) {
    if (terms.every((t) => has(d, t)) && byId(id)) return { id, loose: false }
  }
  // Segunda passada, aceitando palavra parecida no lugar da exata.
  for (const [terms, id] of GLOSSARY) {
    if (terms.every((t) => looseHas(d, t)) && byId(id)) return { id, loose: true }
  }
  return null
}

function bestBySimilarity(desc) {
  let best = { id: null, score: 0 }
  for (const p of CATALOG) {
    const score = Math.max(dice(desc, p.pt), dice(desc, p.en))
    if (score > best.score) best = { id: p.id, score }
  }
  return best
}

/**
 * @param line  { ean, desc } vindo do parser
 * @param learned  mapa EAN -> id do catálogo, aprendido em revisões anteriores
 */
export function matchProduct(line, learned = {}) {
  const desc = line.desc || ''

  if (line.ean && learned[line.ean] && byId(learned[line.ean])) {
    return { productId: learned[line.ean], confidence: 'high', via: 'learned', kind: 'food' }
  }

  if (isNonFood(desc)) {
    return { productId: null, confidence: 'high', via: 'nonfood', kind: 'nonfood' }
  }

  const g = fromGlossary(desc)
  if (g) {
    return {
      productId: g.id,
      confidence: g.loose ? 'medium' : 'high',
      via: g.loose ? 'glossary-loose' : 'glossary',
      kind: 'food',
    }
  }

  const sim = bestBySimilarity(desc)
  if (sim.score >= 0.62) {
    return { productId: sim.id, confidence: 'medium', via: 'similarity', kind: 'food', score: sim.score }
  }
  if (sim.score >= 0.45) {
    return { productId: sim.id, confidence: 'low', via: 'similarity', kind: 'food', score: sim.score }
  }

  return {
    productId: null,
    confidence: 'none',
    via: 'fallback',
    kind: 'unknown',
    cat: guessCategory(desc),
    score: sim.score,
  }
}

/** Converte a linha do cupom na quantidade que faz sentido para o produto do catálogo. */
export function quantityFor(productId, line) {
  const p = byId(productId)
  if (!p) return { qty: line.qty || 1, unit: line.unit || 'un' }
  const count = line.qty || 1
  const size = line.size
  if (p.unit === 'un') return { qty: count, unit: 'un' }
  if (size && size.unit === p.unit) {
    return { qty: Math.round(count * size.value * 1000) / 1000, unit: p.unit, derived: true }
  }
  if (line.unit === p.unit) return { qty: count, unit: p.unit }
  // Sem tamanho legível, assume uma embalagem padrão por unidade comprada.
  return { qty: Math.round(count * p.packs[0] * 1000) / 1000, unit: p.unit, assumed: true }
}

/** Linhas repetidas do mesmo produto viram uma entrada só. */
export function consolidate(rows) {
  const out = []
  for (const r of rows) {
    const key = r.productId || r.ean || r.desc
    const hit = out.find((o) => (o.productId || o.ean || o.desc) === key && o.unit === r.unit)
    if (hit) {
      hit.qty = Math.round((hit.qty + r.qty) * 1000) / 1000
      hit.total = Math.round(((hit.total || 0) + (r.total || 0)) * 100) / 100
      hit.mergedFrom = (hit.mergedFrom || 1) + 1
    } else {
      out.push({ ...r })
    }
  }
  return out
}
