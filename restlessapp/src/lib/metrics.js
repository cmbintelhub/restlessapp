// Customer-health and customer-success metrics computed straight from the app's own
// state — no backend needed for any of this, because every input already lives in
// the reducer (impact events, stats, community posts, the usage history in
// state.usage). See src/data/population.js for the metrics that genuinely need many
// real users (DAU/MAU, retention cohorts, CSQL average, NPS distribution) — those
// are simulated there and labelled as such everywhere they reach the UI.
import { daysBetween, addDays, iso } from './logic.js'

const clamp01 = (n) => Math.max(0, Math.min(1, n || 0))
const avg = (...ns) => ns.reduce((a, b) => a + b, 0) / ns.length

/**
 * Customer Health Score, after Hochstein et al. (2023)'s three formative
 * dimensions — Product Usage, Value Realization, Relationship Quality — weighted
 * 40/40/20 as specified, and banded red/yellow/green the way Gainsight's CS Index
 * favors outcomes ("saved money/kg") over raw activity ("opened the app").
 */
export function healthScore(state) {
  const pillarsUsed = state.stats?.pillarsUsed || []
  const mine = state.community.filter((c) => c.owner === 'me')

  const pillarsNorm = clamp01(pillarsUsed.length / 4)
  const activityNorm = clamp01((state.list.length + state.pantry.length + mine.length) / 8)
  const usage = avg(pillarsNorm, activityNorm)

  const kgNorm = clamp01(state.impact.kg / 10)
  const moneyNorm = clamp01(state.impact.money / 100)
  const dealsNorm = clamp01((state.stats?.dealsReserved || 0) / 5)
  const value = avg(kgNorm, moneyNorm, dealsNorm)

  const sharedNorm = clamp01(mine.length / 3)
  const giveBackRate = mine.length ? mine.filter((c) => c.status !== 'open').length / mine.length : 0
  const relationship = avg(sharedNorm, giveBackRate)

  const score = Math.round(100 * (0.4 * usage + 0.4 * value + 0.2 * relationship))
  const band = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red'
  return { score, band, usage, value, relationship }
}

/** Consecutive app-clock days (ending today) that had any real activity on them. */
export function currentStreak(activeDates, todayIso) {
  const set = new Set(activeDates)
  let streak = 0
  let cursor = todayIso
  while (set.has(cursor)) {
    streak += 1
    cursor = iso(addDays(cursor, -1))
  }
  return streak
}

/** Days from onboarding to the first time this household actually saved kg or money. */
export function timeToFirstValueDays(onboardedAt, firstValueAt) {
  if (!onboardedAt || !firstValueAt) return null
  return Math.max(0, daysBetween(onboardedAt, firstValueAt))
}

/** Share of the 4 pillars this household has ever touched. */
export function featureAdoptionRate(pillarFirstUsedAt) {
  const keys = Object.keys(pillarFirstUsedAt || {})
  if (!keys.length) return 0
  return keys.filter((k) => pillarFirstUsedAt[k]).length / keys.length
}

/**
 * Churn-risk score from real inactivity, in the spirit of Hochstein et al. (2021):
 * flag the slide before the household is gone, not after. 0 days inactive -> no
 * risk; 14+ days inactive -> full risk.
 */
export function churnRisk(state) {
  const dates = state.usage?.activeDates || []
  if (!dates.length) return { score: 0, band: 'green', daysInactive: 0 }
  const last = dates[dates.length - 1]
  const daysInactive = Math.max(0, daysBetween(last, state.clock))
  const score = Math.round(clamp01(daysInactive / 14) * 100)
  const band = score >= 60 ? 'red' : score >= 25 ? 'yellow' : 'green'
  return { score, band, daysInactive }
}

/** Real weekly kg/money-saved trend from this household's own impact log, oldest to newest. */
export function weeklyValueTrend(events, todayIso, weeks = 8) {
  const out = []
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const weekEnd = iso(addDays(todayIso, -7 * w))
    const weekStart = iso(addDays(weekEnd, -6))
    const inWeek = events.filter((e) => e.ts >= weekStart && e.ts <= weekEnd)
    out.push({
      weekStart,
      weekEnd,
      kg: Math.round(inWeek.reduce((a, e) => a + (e.kg || 0), 0) * 100) / 100,
      money: Math.round(inWeek.reduce((a, e) => a + (e.money || 0), 0) * 100) / 100,
    })
  }
  return out
}

/** This household's own Radar "matches your list" -> reserved conversion rate. */
export function csqlConversion(stats) {
  const viewed = stats?.dealsViewed || 0
  const reserved = stats?.dealsReserved || 0
  if (!viewed) return null
  return Math.round((reserved / viewed) * 100)
}
