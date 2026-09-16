// A deterministic, clearly-simulated population of "other restless households".
// This academic prototype has no backend or accounts, so there is no real multi-user
// data to compute DAU/WAU/MAU, retention cohorts, an average CSQL-conversion rate or
// an NPS distribution from. Everything in this file is demo data, generated the same
// way the app already fakes Pix payments and neighbor activity — deterministic so it
// looks the same on every load and is unit-testable, never presented as real users.
// Every place this reaches the UI is labelled "simulated" / "simulado".

const SEED = 1337
const SIZE = 240
const DAYS = 90

/** Small seeded PRNG (mulberry32) so the population is reproducible, not Math.random(). */
function mulberry32(seed) {
  let a = seed
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clampRange = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

function buildUser(rng, id, days) {
  const joinDay = Math.floor(rng() * (days - 7)) // always leaves a week of runway to be visible
  const engagement = rng() // 0..1, higher = stickier household
  const usesScan = rng() < 0.35
  const pillarsUsedCount = 1 + Math.floor(rng() * rng() * 4) // skewed toward fewer pillars, like real adoption

  // Three-state day-by-day model so retention cohorts have somewhere for LOSS to come
  // from: 'active' users can permanently churn (END) or take a break (a temporary
  // LOSS) and later resume, rather than every gap being a one-way door.
  const permanentChurnHazard = 0.01 + (1 - engagement) * 0.03
  const lapseHazard = 0.03 + (1 - engagement) * 0.05
  const resumeChance = 0.15 + engagement * 0.3

  let phase = 'active'
  const activeDays = []
  let dealsMatched = 0
  let dealsReserved = 0
  for (let d = joinDay; d < days; d += 1) {
    if (phase === 'churned') continue
    if (phase === 'lapsed') {
      if (rng() < resumeChance) phase = 'active'
      else if (rng() < permanentChurnHazard * 2) phase = 'churned'
      continue
    }
    const activeToday = rng() < 0.5 + engagement * 0.4
    if (activeToday) {
      activeDays.push(d)
      if (rng() < 0.4) {
        dealsMatched += 1
        if (rng() < 0.3 + engagement * 0.3) dealsReserved += 1
      }
      if (rng() < permanentChurnHazard) { phase = 'churned'; continue }
      if (rng() < lapseHazard) phase = 'lapsed'
    } else if (rng() < lapseHazard) {
      phase = 'lapsed'
    }
  }

  const npsScore = Math.round(clampRange(4 + engagement * 6.5 + (rng() - 0.5) * 3, 0, 10))
  return { id, joinDay, activeDays, usesScan, pillarsUsedCount, dealsMatched, dealsReserved, npsScore }
}

let cache = null

/** Builds (and memoizes) the synthetic population. Same seed -> same households, always. */
export function generatePopulation(seed = SEED, size = SIZE, days = DAYS) {
  if (cache && cache.seed === seed && cache.size === size && cache.days === days) return cache.users
  const rng = mulberry32(seed)
  const users = Array.from({ length: size }, (_, i) => buildUser(rng, i, days))
  cache = { seed, size, days, users }
  return users
}

/**
 * Aggregates the population as of a given day into the "needs many real users"
 * metrics: DAU/WAU/MAU, an expertise/scan-adoption score, an average CSQL
 * conversion, an NPS distribution, and weekly ADD/retained/LOSS/END cohorts after
 * McCarthy, Fader & Hardie (2017)'s customer-base-analysis framework.
 */
export function populationSnapshot(users, days = DAYS, asOfDay = days - 1) {
  const activeInWindow = (start, end) => users.filter((u) => u.activeDays.some((d) => d >= start && d <= end))

  const dau = activeInWindow(asOfDay, asOfDay).length
  const wau = activeInWindow(Math.max(0, asOfDay - 6), asOfDay).length
  const mau = activeInWindow(Math.max(0, asOfDay - 29), asOfDay).length

  const expertiseAvg = users.reduce((a, u) => a + u.pillarsUsedCount, 0) / users.length / 4
  const scanAdoptionPct = Math.round((users.filter((u) => u.usesScan).length / users.length) * 100)

  const matched = users.reduce((a, u) => a + u.dealsMatched, 0)
  const reserved = users.reduce((a, u) => a + u.dealsReserved, 0)
  const csqlPct = matched ? Math.round((reserved / matched) * 100) : 0

  const respondents = users.filter((u) => u.joinDay <= asOfDay)
  const promoters = respondents.filter((u) => u.npsScore >= 9).length
  const detractors = respondents.filter((u) => u.npsScore <= 6).length
  const npsScoreAvg = respondents.length ? respondents.reduce((a, u) => a + u.npsScore, 0) / respondents.length : 0
  const nps = respondents.length ? Math.round(((promoters - detractors) / respondents.length) * 100) : 0

  const weeks = Math.max(1, Math.floor((asOfDay + 1) / 7))
  const cohorts = []
  for (let w = 0; w < weeks; w += 1) {
    const weekStart = w * 7
    const weekEnd = Math.min(asOfDay, weekStart + 6)
    const add = users.filter((u) => u.joinDay >= weekStart && u.joinDay <= weekEnd).length
    const activeThisWeek = new Set(activeInWindow(weekStart, weekEnd).map((u) => u.id))
    const activePrevWeek = w === 0 ? new Set() : new Set(activeInWindow(weekStart - 7, weekStart - 1).map((u) => u.id))
    let loss = 0
    let end = 0
    for (const id of activePrevWeek) {
      if (activeThisWeek.has(id)) continue
      const stillComesBack = users[id].activeDays.some((d) => d > weekEnd)
      if (stillComesBack) loss += 1
      else end += 1
    }
    cohorts.push({ week: w, add, retained: activeThisWeek.size, loss, end })
  }

  return {
    asOfDay,
    size: users.length,
    dau,
    wau,
    mau,
    expertiseAvg,
    scanAdoptionPct,
    csqlPct,
    matched,
    reserved,
    nps,
    npsScoreAvg: Math.round(npsScoreAvg * 10) / 10,
    cohorts,
  }
}

export { SEED, SIZE, DAYS }
