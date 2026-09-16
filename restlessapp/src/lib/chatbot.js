import { INTENTS, STARTERS, joinNames } from '../data/chatbot.js'
import { byId } from '../data/catalog.js'
import { storeById } from '../data/seed.js'
import { daysBetween, discountPct, money, qty } from './logic.js'

/**
 * Chatbot simulado, sem modelo de linguagem: cada intenção declara palavras-chave
 * em PT e EN, a mensagem é normalizada e pontuada contra todas, e a melhor vence.
 * Abaixo do limiar a conversa é transferida para um atendente humano simulado.
 *
 * Pontuação por palavra-chave encontrada:
 *   expressão de várias palavras, exata  -> 2
 *   palavra única, exata                 -> 1
 *   palavra única, parecida (erro de digitação)            -> 1 ou 0,75
 * Cada palavra da mensagem pontua uma vez só por intenção.
 */

export const THRESHOLD = 1

export const normalize = (s) =>
  String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const bigrams = (w) => {
  const out = new Set()
  for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2))
  return out
}

/** Similaridade de Dice por bigramas entre duas palavras já normalizadas. */
export function similar(a, b) {
  if (a === b) return 1
  const A = bigrams(a)
  const B = bigrams(b)
  if (!A.size || !B.size) return 0
  let hit = 0
  for (const g of A) if (B.has(g)) hit++
  return (2 * hit) / (A.size + B.size)
}

const FUZZY_STRONG = 0.8
const FUZZY_WEAK = 0.72

/** Keywords normalizadas e sem repetição entre PT e EN, separadas em expressões e palavras. */
const compiled = new WeakMap()
function compile(intent) {
  let c = compiled.get(intent)
  if (c) return c
  const all = [...new Set([...intent.keywords.pt, ...intent.keywords.en].map(normalize).filter(Boolean))]
  c = { phrases: all.filter((k) => k.includes(' ')), singles: all.filter((k) => !k.includes(' ')) }
  compiled.set(intent, c)
  return c
}

/**
 * Cada expressão encontrada vale 2. Cada palavra da mensagem vale no máximo 1, pela
 * melhor keyword que casar com ela, então "oferta" não pontua de novo por "ofertas".
 */
function scoreIntent(intent, text, words) {
  const { phrases, singles } = compile(intent)
  let score = 0
  const padded = ` ${text} `
  for (const kw of phrases) if (padded.includes(` ${kw} `)) score += 2
  for (const w of new Set(words)) {
    let best = 0
    for (const kw of singles) {
      if (w === kw) { best = 1; break }
      if (kw.length >= 5 && w.length >= 4) {
        const sim = similar(w, kw)
        if (sim >= FUZZY_STRONG) best = Math.max(best, 1)
        else if (sim >= FUZZY_WEAK) best = Math.max(best, 0.75)
      }
    }
    score += best
  }
  return score * (intent.weight ?? 1)
}

/** Devolve a intenção vencedora e o placar, ou intent null quando nada passa do limiar. */
export function classify(message, intents = INTENTS) {
  const text = normalize(message)
  const words = text ? text.split(' ') : []
  if (!words.length) return { intent: null, score: 0 }
  let best = null
  let bestScore = 0
  for (const intent of intents) {
    const s = scoreIntent(intent, text, words)
    // Empate: vence a que vem antes na lista, que é ordenada da mais específica para a mais geral.
    if (s > bestScore) { best = intent; bestScore = s }
  }
  if (bestScore < THRESHOLD) return { intent: null, score: bestScore }
  return { intent: best, score: bestScore }
}

/** Fatos do estado do app que as respostas contextuais usam. Função pura. */
export function chatFacts(state) {
  const lang = state.lang === 'pt' ? 'pt' : 'en'
  const name = (id) => {
    const p = byId(id)
    return p ? (p[lang] || p.en) : id
  }
  // Um item pode ter vários lotes na despensa; para o chat vale o lote mais próximo da data.
  const soonest = new Map()
  for (const p of state.pantry) {
    const left = daysBetween(state.clock, p.expiry)
    const n = name(p.product)
    if (!soonest.has(n) || left < soonest.get(n)) soonest.set(n, left)
  }
  const dated = [...soonest].map(([n, left]) => ({ name: n, left })).sort((a, b) => a.left - b.left)
  const expired = dated.filter((p) => p.left < 0).map((p) => p.name)
  const expiring = dated.filter((p) => p.left >= 0 && p.left <= 3)

  const listProducts = new Set(state.list.map((l) => l.product))
  const open = state.deals.filter((d) => d.status === 'open')
  const best = open
    .map((d) => ({ ...d, pct: discountPct(d.from, d.to) }))
    .sort((a, b) => b.pct - a.pct)[0]

  return {
    lang,
    pantryCount: state.pantry.length,
    pantrySample: [...new Set(state.pantry.map((p) => name(p.product)))].slice(0, 4),
    expiring,
    expired,
    listCount: state.list.length,
    listSample: state.list.map((l) => name(l.product)).slice(0, 4),
    dealsOpen: open.length,
    dealsMatching: open.filter((d) => listProducts.has(d.product)).length,
    bestDeal: best ? { item: name(best.product), pct: best.pct, store: storeById(best.store)?.name || '' } : null,
    kg: state.impact.kg,
    // Mesmo formato da aba Impacto, para o número bater com o que está na tela.
    kgText: qty(state.impact.kg),
    money: money(state.impact.money, lang),
    moneyValue: state.impact.money,
    points: state.impact.points,
    postsOpen: state.community.filter((c) => c.status === 'open' && c.owner !== 'me').length,
    myPostsOpen: state.community.filter((c) => c.status === 'open' && c.owner === 'me').length,
    people: state.household?.people?.length || 1,
  }
}

/**
 * Responde uma mensagem. Retorna:
 *   { intentId, text, handoff, suggestions }
 * handoff true significa que a UI deve mostrar a transferência para atendente.
 */
export function reply(message, state) {
  const facts = chatFacts(state)
  const lang = facts.lang
  const { intent } = classify(message)
  if (!intent) {
    return { intentId: null, text: FALLBACK[lang], handoff: true, suggestions: [] }
  }
  const text = typeof intent.answer === 'function' ? intent.answer(facts, lang) : intent.answer[lang]
  return {
    intentId: intent.id,
    text,
    handoff: !!intent.handoff,
    suggestions: (intent.next || []).map((id) => INTENTS.find((i) => i.id === id)).filter(Boolean),
  }
}

export const FALLBACK = {
  pt: 'Não encontrei uma resposta para isso. Estou te transferindo para um atendente humano.',
  en: "I couldn't find an answer to that. I'm transferring you to a human agent.",
}

export { INTENTS, STARTERS, joinNames }
