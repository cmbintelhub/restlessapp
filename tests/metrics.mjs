// node tests/metrics.mjs
// Unit tests for the Account tab's metrics: the real, per-household health/usage/
// churn/value-trend/CSQL functions in src/lib/metrics.js, and the deterministic
// simulated population in src/data/population.js that stands in for the DAU/MAU,
// retention-cohort and NPS-distribution metrics this backend-less prototype has no
// real multi-user data to compute.
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const metrics = await import(path.join(root, 'src/lib/metrics.js'))
const population = await import(path.join(root, 'src/data/population.js'))

const {
  healthScore, currentStreak, timeToFirstValueDays, featureAdoptionRate,
  churnRisk, weeklyValueTrend, csqlConversion,
} = metrics
const { generatePopulation, populationSnapshot, SIZE, DAYS } = population

let pass = 0
const fails = []
const check = (name, cond, detail) => (cond ? pass++ : fails.push(`${name}${detail !== undefined ? ' — ' + detail : ''}`))

/* ---- healthScore ---- */
{
  const empty = {
    stats: { pillarsUsed: [], dealsReserved: 0 },
    list: [], pantry: [], community: [],
    impact: { kg: 0, money: 0 },
  }
  const h0 = healthScore(empty)
  check('healthScore: an untouched household scores 0', h0.score === 0 && h0.band === 'red')

  const full = {
    stats: { pillarsUsed: ['planner', 'radar', 'quantity', 'community'], dealsReserved: 10 },
    list: Array(4).fill(0), pantry: Array(4).fill(0),
    community: [{ owner: 'me', status: 'claimed' }, { owner: 'me', status: 'claimed' }, { owner: 'me', status: 'claimed' }],
    impact: { kg: 20, money: 200 },
  }
  const h1 = healthScore(full)
  check('healthScore: a fully-engaged household scores 100', h1.score === 100 && h1.band === 'green', h1.score)

  const partial = {
    stats: { pillarsUsed: ['planner'], dealsReserved: 0 },
    list: [1, 2], pantry: [], community: [{ owner: 'me', status: 'open' }],
    impact: { kg: 2, money: 0 },
  }
  const h2 = healthScore(partial)
  check('healthScore: weights sum to a mid-range score for partial use', h2.score > 0 && h2.score < 70, h2.score)
  check('healthScore: is deterministic for the same input', healthScore(partial).score === h2.score)
}

/* ---- currentStreak ---- */
{
  check('streak: three consecutive days ending today', currentStreak(['2026-09-13', '2026-09-14', '2026-09-15'], '2026-09-15') === 3)
  check('streak: a gap breaks it', currentStreak(['2026-09-10', '2026-09-15'], '2026-09-15') === 1)
  check('streak: no activity at all is zero', currentStreak([], '2026-09-15') === 0)
  check('streak: yesterday-only with no entry today is zero', currentStreak(['2026-09-14'], '2026-09-15') === 0)
  check('streak: order in the array does not matter', currentStreak(['2026-09-15', '2026-09-13', '2026-09-14'], '2026-09-15') === 3)
}

/* ---- timeToFirstValueDays / featureAdoptionRate ---- */
{
  check('ttfv: null until onboarded', timeToFirstValueDays(null, '2026-09-15') === null)
  check('ttfv: null until any value is realized', timeToFirstValueDays('2026-09-10', null) === null)
  check('ttfv: counts days from onboarding to first value', timeToFirstValueDays('2026-09-10', '2026-09-13') === 3)
  check('ttfv: never negative', timeToFirstValueDays('2026-09-15', '2026-09-10') === 0)

  check('adoption: no pillars touched yet is 0', featureAdoptionRate({ a: null, b: null }) === 0)
  check('adoption: half the pillars touched is 0.5', featureAdoptionRate({ a: '2026-09-01', b: null }) === 0.5)
  check('adoption: all pillars touched is 1', featureAdoptionRate({ a: '2026-09-01', b: '2026-09-02' }) === 1)
}

/* ---- churnRisk ---- */
{
  const today = '2026-09-15'
  check('churn: no history at all is treated as no risk yet',
    churnRisk({ usage: { activeDates: [] }, clock: today }).band === 'green')
  check('churn: active today is no risk',
    churnRisk({ usage: { activeDates: [today] }, clock: today }).score === 0)
  const stale = churnRisk({ usage: { activeDates: ['2026-08-20'] }, clock: today })
  check('churn: three-and-a-half weeks quiet is full risk', stale.score === 100 && stale.band === 'red', stale)
  const mid = churnRisk({ usage: { activeDates: ['2026-09-08'] }, clock: today })
  check('churn: a week quiet is a partial, yellow-or-worse risk', mid.score > 0 && mid.score < 100)
}

/* ---- weeklyValueTrend ---- */
{
  // Buckets (weeks=3, today=09-15): [08-26..09-01], [09-02..09-08], [09-09..09-15].
  const events = [
    { ts: '2026-09-15', kg: 1, money: 5 },
    { ts: '2026-09-05', kg: 2, money: 8 },
    { ts: '2026-01-01', kg: 99, money: 99 }, // well outside the window
  ]
  const trend = weeklyValueTrend(events, '2026-09-15', 3)
  check('trend: returns exactly the requested number of weeks', trend.length === 3)
  check('trend: is ordered oldest to newest', trend[trend.length - 1].weekEnd === '2026-09-15')
  check('trend: old events outside the window are excluded', trend.reduce((a, w) => a + w.kg, 0) === 3)
  check('trend: each event lands in its own week bucket', trend[1].kg === 2 && trend[2].kg === 1, trend)
}

/* ---- csqlConversion ---- */
{
  check('csql: null with no views yet', csqlConversion({ dealsViewed: 0, dealsReserved: 0 }) === null)
  check('csql: a straight percentage otherwise', csqlConversion({ dealsViewed: 4, dealsReserved: 1 }) === 25)
}

/* ---- simulated population ---- */
{
  const users = generatePopulation()
  check('population: builds the configured size', users.length === SIZE)
  check('population: is memoized for the same seed/size/days', generatePopulation() === users)
  const users2 = generatePopulation(4242, SIZE, DAYS)
  check('population: a different seed gives a different, still-deterministic population',
    users2 !== users && users2.length === SIZE && JSON.stringify(generatePopulation(4242, SIZE, DAYS)) === JSON.stringify(users2))

  const snap = populationSnapshot(users, DAYS)
  check('snapshot: DAU never exceeds WAU never exceeds MAU', snap.dau <= snap.wau && snap.wau <= snap.mau, snap)
  check('snapshot: active counts never exceed the population size', snap.mau <= snap.size)
  check('snapshot: CSQL is a plausible percentage', snap.csqlPct >= 0 && snap.csqlPct <= 100)
  check('snapshot: NPS is bounded -100..100', snap.nps >= -100 && snap.nps <= 100)
  check('snapshot: produces at least one weekly cohort', snap.cohorts.length > 0)
  check('snapshot: some households pause and later come back (LOSS is reachable)',
    snap.cohorts.some((c) => c.loss > 0), JSON.stringify(snap.cohorts))
  check('snapshot: some households churn for good (END is reachable)',
    snap.cohorts.some((c) => c.end > 0))
  check('snapshot: retained count never exceeds the population size', snap.cohorts.every((c) => c.retained <= snap.size))
}

console.log(`\n${pass} checks passed, ${fails.length} failed`)
if (fails.length) {
  console.log('\nFAILED:')
  for (const f of fails) console.log('  x ' + f)
  process.exit(1)
}
