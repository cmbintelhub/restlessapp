import { byId, HOME } from '../data/seed.js'

export const DAY = 86400000

export const toDate = (v) => (v instanceof Date ? v : new Date(v))
export const iso = (d) => toDate(d).toISOString().slice(0, 10)
export const addDays = (d, n) => new Date(toDate(d).getTime() + n * DAY)
export const daysBetween = (a, b) =>
  Math.round((toDate(b).setHours(12, 0, 0, 0) - toDate(a).setHours(12, 0, 0, 0)) / DAY)

/* ---- how much one person eats ----------------------------------------------------
 * Each person carries their own height, weight and appetite. Their share of the
 * household's food is an energy estimate normalised against a reference adult, so a
 * 1.85 m teenager and a 4-year-old are not treated as the same mouth.
 */

export const REFERENCE_ADULT = { height: 170, weight: 70 }
export const APPETITE_FACTOR = { light: 0.85, normal: 1, big: 1.2 }

export const newPerson = (kind = 'adult') =>
  kind === 'child'
    ? { kind: 'child', appetite: 'normal', height: 130, weight: 30 }
    : { kind: 'adult', appetite: 'normal', height: 170, weight: 70 }

export function bmi(p) {
  const m = (p.height || 170) / 100
  return Math.round(((p.weight || 70) / (m * m)) * 10) / 10
}

/** Resting energy, Mifflin-St Jeor without the age and sex terms we never ask for. */
const restingEnergy = (weight, height) => 10 * weight + 6.25 * height
const REF_ENERGY = restingEnergy(REFERENCE_ADULT.weight, REFERENCE_ADULT.height)

/**
 * One person's share, where 1.0 is the reference adult.
 * Height and weight enter through the energy estimate. BMI is not multiplied on top of
 * that (it is derived from the same two numbers, so it would double count); it is used
 * only for the correction clinicians apply above a BMI of 27, where energy needs grow
 * more slowly than body mass because the excess is largely fat rather than lean tissue.
 */
export function personFactor(p) {
  const height = p.height || REFERENCE_ADULT.height
  const weight = p.weight || REFERENCE_ADULT.weight
  const index = bmi({ height, weight })
  const ideal = 22 * (height / 100) ** 2
  const adjusted = index > 27 ? ideal + 0.25 * (weight - ideal) : weight
  const share = (restingEnergy(adjusted, height) / REF_ENERGY) * (APPETITE_FACTOR[p.appetite] ?? 1)
  return Math.max(0.25, Math.min(2.2, Math.round(share * 1000) / 1000))
}

export const peopleOf = (h) => (h?.people?.length ? h.people : [newPerson('adult')])

/** Effective eaters: the household's shares added up, in reference adults. */
export function eaters(h) {
  const total = peopleOf(h).reduce((a, p) => a + personFactor(p), 0)
  return Math.max(0.5, Math.round(total * 1000) / 1000)
}

function dietFactor(product, diets = []) {
  let f = 1
  if (diets.includes('vegetarian')) {
    if (product.id === 'chicken' || product.id === 'beef') return 0
    if (['fruit', 'veg', 'tuber'].includes(product.cat)) f *= 1.2
    if (product.id === 'eggs') f *= 1.15
  }
  if (diets.includes('lactose') && product.cat === 'dairy') f *= 0.2
  if (diets.includes('gluten')) {
    if (product.cat === 'bakery' || product.id === 'pasta') f *= 0.15
  }
  return f
}

/** How much of this product the household gets through in a week, in its own unit. */
export function weeklyNeed(product, household) {
  const raw = product.perWeek * eaters(household) * dietFactor(product, household.diets)
  return Math.round(raw * 100) / 100
}

export const dailyRate = (product, household) => weeklyNeed(product, household) / 7

/**
 * Pick a real pack size for what is still missing.
 * Conservative rounds up so nothing runs out, aggressive rounds down so nothing is left.
 */
export function suggestQuantity(product, household, rounding = 'balanced', atHome = 0) {
  const need = weeklyNeed(product, household)
  const missing = Math.max(0, need - atHome)
  if (missing <= 0.001) return { qty: 0, need, missing, pack: null }

  const round = { conservative: Math.ceil, balanced: Math.round, aggressive: Math.floor }[rounding] || Math.round
  let best = null
  for (const pack of product.packs) {
    let k = round(missing / pack)
    if (k < 1) k = 1
    const qty = Math.round(k * pack * 100) / 100
    const over = qty - missing
    // Aggressive tolerates a shortfall; conservative refuses one.
    if (rounding === 'conservative' && over < -0.001) continue
    const score = Math.abs(over) + (k > 1 ? 0.02 * (k - 1) : 0)
    if (!best || score < best.score) best = { qty, pack, k, score }
  }
  if (!best) {
    const pack = product.packs[0]
    best = { qty: pack, pack, k: 1, score: 0 }
  }
  return { qty: best.qty, pack: best.pack, need, missing }
}

/** How far a quantity overshoots a week of eating, as a percentage. 0 when it fits. */
export function oversizePct(qty, need) {
  if (need <= 0) return qty > 0 ? 999 : 0
  const pct = Math.round(((qty / need) - 1) * 100)
  return pct > 0 ? pct : 0
}

export const WASTE_RISK_PCT = 40

export function kgOf(productId, qty) {
  const p = byId(productId)
  if (!p) return 0
  return Math.round(qty * (p.kgPer ?? 1) * 100) / 100
}

/** Colour band for a pantry item, driven by days left against its date. */
export function freshness(daysLeft) {
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 1) return 'urgent'
  if (daysLeft <= 3) return 'soon'
  if (daysLeft <= 7) return 'watch'
  return 'ok'
}

export const FRESH_COLOR = {
  expired: '#C0483B',
  urgent: '#C0483B',
  soon: '#C97A1F',
  watch: '#A8B96A',
  ok: '#7FA96A',
}

export function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(x)) * 100) / 100
}

export const distanceFromHome = (p) => haversineKm(HOME, p)

export const money = (v, lang = 'en') =>
  (lang === 'pt' ? 'R$ ' : 'R$ ') +
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const qty = (v) =>
  Number.isInteger(v) ? String(v) : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

export function shortDate(d, lang = 'en') {
  return toDate(d).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-GB', { day: '2-digit', month: 'short' })
}

/** "today" / "tomorrow" / "in 4 days" / "3 days ago", translated by the caller's t. */
export function relativeWhen(days, t) {
  if (days === 0) return t('common.today')
  if (days === 1) return t('common.tomorrow')
  if (days < 0) return t('common.daysAgo', { n: Math.abs(days) })
  return t('common.inDays', { n: days })
}

export const discountPct = (from, to) => Math.round((1 - to / from) * 100)

/** Points are the currency the deck ties to waste avoided: 10 per kilo. */
export const pointsFor = (kg) => Math.max(1, Math.round(kg * 10))
