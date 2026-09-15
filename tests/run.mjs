// Real test run, no framework: node tests/run.mjs
// Transpiles store.jsx in place so its relative imports still resolve, then exercises
// the quantity engine, the expiry maths and every reducer path the screens dispatch.
import { build } from 'esbuild'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const shim = path.join(root, 'src', '__store.test.mjs')

await build({
  entryPoints: [path.join(root, 'src', 'store.jsx')],
  outfile: shim,
  format: 'esm',
  bundle: false,
  loader: { '.jsx': 'jsx' },
  jsx: 'automatic',
  logLevel: 'silent',
})

const logic = await import(path.join(root, 'src', 'lib', 'logic.js'))
const seed = await import(path.join(root, 'src', 'data', 'seed.js'))
const store = await import(shim)
fs.unlinkSync(shim)

const {
  weeklyNeed, suggestQuantity, oversizePct, kgOf, freshness, haversineKm, distanceFromHome,
  daysBetween, addDays, iso, discountPct, pointsFor, eaters, personFactor, bmi, newPerson,
  peopleOf, REFERENCE_ADULT,
} = logic
const { byId, HOME, STORES, CATALOG, RECEIPTS } = seed
const { reducer, initialState, migrate } = store

let pass = 0
const fails = []
function check(name, cond, detail) {
  if (cond) { pass++; return }
  fails.push(`${name}${detail ? ` — ${detail}` : ''}`)
}
const close = (a, b, eps = 0.011) => Math.abs(a - b) <= eps

const adult = (over = {}) => ({ ...newPerson('adult'), ...over })
const child = (over = {}) => ({ ...newPerson('child'), ...over })
const H2 = { people: [adult(), adult()], diets: [] }
const H4 = { people: [adult(), adult(), child(), child()], diets: [] }
const tomato = byId('tomato')
const milk = byId('milk')
const chicken = byId('chicken')
const yogurt = byId('yogurt')

/* ---- one person's share ---- */
check('person: the reference adult is exactly one portion',
  close(personFactor(adult({ height: REFERENCE_ADULT.height, weight: REFERENCE_ADULT.weight })), 1))
check('person: a default child eats less than an adult', personFactor(child()) < personFactor(adult()))
check('person: a taller, heavier adult eats more',
  personFactor(adult({ height: 190, weight: 90 })) > personFactor(adult()))
check('person: a shorter, lighter adult eats less',
  personFactor(adult({ height: 155, weight: 52 })) < personFactor(adult()))
check('person: appetite scales the share',
  personFactor(adult({ appetite: 'big' })) > personFactor(adult()) &&
  personFactor(adult({ appetite: 'light' })) < personFactor(adult()))
check('person: two people with the same body differ only by appetite',
  close(personFactor(adult({ appetite: 'big' })) / personFactor(adult()), 1.2))
check('person: the share never goes negative or absurd',
  [adult({ height: 90, weight: 10 }), adult({ height: 210, weight: 180 })]
    .every((p) => personFactor(p) >= 0.25 && personFactor(p) <= 2.2))

check('bmi: 70 kg at 1.70 m is about 24.2', close(bmi({ height: 170, weight: 70 }), 24.2, 0.05))
{
  // Above BMI 27 the estimate must grow more slowly than body mass.
  const lean = adult({ height: 170, weight: 70 })
  const heavy = adult({ height: 170, weight: 110 })
  const ratioWeight = 110 / 70
  const ratioShare = personFactor(heavy) / personFactor(lean)
  check('bmi: above 27 the portion grows slower than the weight', ratioShare < ratioWeight, `${ratioShare}`)
  check('bmi: above 27 the portion still grows', ratioShare > 1)
  const mid = adult({ height: 170, weight: 78 })
  check('bmi: below 27 no correction is applied',
    close(personFactor(mid), personFactor(lean) * ((10 * 78 + 6.25 * 170) / (10 * 70 + 6.25 * 170)), 0.005))
}

/* ---- household need ---- */
check('eaters: two reference adults count as two', close(eaters(H2), 2))
check('eaters: children count less than adults', eaters(H4) > eaters(H2) && eaters(H4) < 4)
check('eaters: an empty household still feeds someone', eaters({ people: [] }) >= 0.5)
check('peopleOf: an empty list falls back to one adult', peopleOf({ people: [] }).length === 1)
check('eaters: the household total is the sum of its people',
  close(eaters(H4), H4.people.reduce((a, p) => a + personFactor(p), 0)))
check('eaters: changing one person changes the household',
  eaters({ people: [adult(), adult({ appetite: 'big' })] }) > eaters(H2))

check('weeklyNeed: 2 reference adults eat 1 kg of tomato a week', close(weeklyNeed(tomato, H2), 1))
check('weeklyNeed: a household of bigger people buys more',
  weeklyNeed(tomato, { people: [adult({ height: 190, weight: 95 }), adult()], diets: [] }) > weeklyNeed(tomato, H2))
check('weeklyNeed: a bigger household needs more', weeklyNeed(tomato, H4) > weeklyNeed(tomato, H2))
check('weeklyNeed: vegetarian drops chicken to zero',
  weeklyNeed(chicken, { ...H2, diets: ['vegetarian'] }) === 0)
check('weeklyNeed: vegetarian raises vegetables',
  weeklyNeed(tomato, { ...H2, diets: ['vegetarian'] }) > weeklyNeed(tomato, H2))
check('weeklyNeed: lactose-free cuts dairy sharply',
  weeklyNeed(milk, { ...H2, diets: ['lactose'] }) < weeklyNeed(milk, H2) * 0.3)

/* ---- quantity engine ---- */
{
  const s = suggestQuantity(tomato, H2, 'balanced', 0)
  check('suggest: balanced picks a real pack size', tomato.packs.some((p) => close(s.qty % p, 0) || close(s.qty % p, p)),
    `qty=${s.qty}`)
  check('suggest: balanced lands near a week of eating', s.qty >= 0.5 && s.qty <= 1.5, `qty=${s.qty}`)
}
for (const prod of CATALOG) {
  const s = suggestQuantity(prod, H2, 'conservative', 0)
  check(`suggest: conservative never leaves ${prod.id} short`, s.qty >= s.missing - 0.001, `qty=${s.qty} need=${s.missing}`)
  const a = suggestQuantity(prod, H2, 'aggressive', 0)
  check(`suggest: aggressive never beats conservative on ${prod.id}`, a.qty <= s.qty + 0.001)
  check(`suggest: ${prod.id} always gets at least one pack`, s.qty >= Math.min(...prod.packs) - 0.001)
}
{
  const atHome = weeklyNeed(tomato, H2)
  const s = suggestQuantity(tomato, H2, 'balanced', atHome)
  check('suggest: a full pantry means nothing to buy', s.qty === 0, `qty=${s.qty}`)
  const half = suggestQuantity(tomato, H2, 'balanced', atHome / 2)
  check('suggest: a half-full pantry shrinks the suggestion', half.qty < suggestQuantity(tomato, H2, 'balanced', 0).qty + 0.001)
}
check('oversize: 5 kg for a 1 kg week is flagged', oversizePct(5, 1) === 400)
check('oversize: a right-sized quantity is not flagged', oversizePct(1, 1) === 0)
check('oversize: a smaller quantity is not flagged', oversizePct(0.5, 1) === 0)

/* ---- units and dates ---- */
check('kgOf: six yoghurt pots weigh about a kilo', close(kgOf('yogurt', 6), 1.02))
check('kgOf: kilo products convert one to one', close(kgOf('tomato', 2), 2))
check('freshness: past the date reads expired', freshness(-1) === 'expired')
check('freshness: tomorrow reads urgent', freshness(1) === 'urgent')
check('freshness: a long runway reads ok', freshness(20) === 'ok')
check('dates: addDays and daysBetween are inverses', daysBetween('2026-03-01', iso(addDays('2026-03-01', 5))) === 5)
check('dates: daysBetween survives a month boundary', daysBetween('2026-02-26', '2026-03-02') === 4)
check('discount: 10 to 5 is half off', discountPct(10, 5) === 50)
check('points: ten per kilo', pointsFor(2) === 20)

/* ---- geography ---- */
check('distance: home to itself is zero', haversineKm(HOME, HOME) === 0)
for (const st of STORES) {
  const d = distanceFromHome(st)
  check(`distance: ${st.name} is within walking range`, d > 0 && d < 3, `${d} km`)
}

/* ---- reducer ---- */
const t = (k, v) => k + (v ? JSON.stringify(v) : '')
let s0 = initialState()
check('state: starts before onboarding', s0.onboarded === false && s0.pantry.length === 0)
check('state: seeds open deals and neighbour posts', s0.deals.length > 0 && s0.community.length > 0)

let s = reducer(s0, { type: 'finishOnboarding' })
check('onboarding: CPF consent fills the pantry', s.pantry.length > 0, `pantry=${s.pantry.length}`)
check('onboarding: purchases are recorded', s.purchases.length === 2)
check('onboarding: a capture notification is raised', s.notifications.some((n) => n.text === 'notif.capture'))

let sNo = reducer({ ...s0, household: { ...s0.household, cpf: false } }, { type: 'finishOnboarding' })
check('onboarding: without consent the pantry stays empty', sNo.pantry.length === 0)

s = reducer(s, { type: 'addToList', product: 'tomato', qty: 1, need: 1, atHome: 0 })
check('list: an item is added', s.list.length === 1 && s.list[0].product === 'tomato')
s = reducer(s, { type: 'addToList', product: 'tomato', qty: 1, need: 1, atHome: 0, dupText: 'dup' })
check('list: the same product is not added twice', s.list.length === 1)
check('list: the duplicate attempt warns the user', s.toast?.text === 'dup')

{
  const before = s.impact.kg
  const uid = s.list[0].uid
  const s2 = reducer(s, { type: 'listQty', uid, qty: 0.5, savedKg: 0.5, label: 'Tomatoes' })
  check('quantity: downsizing credits waste avoided', close(s2.impact.kg, before + 0.5))
  check('quantity: the credited event names the pillar', s2.impact.events[0].src === 'quantity')
  const s3 = reducer(s, { type: 'listQty', uid, qty: 2, savedKg: 0, label: 'Tomatoes' })
  check('quantity: raising the quantity credits nothing', close(s3.impact.kg, before))
  check('quantity: the new quantity is stored', s3.list[0].qty === 2)
}

{
  const uid = s.list[0].uid
  const s2 = reducer(s, { type: 'markBought', uid })
  check('list: buying moves the item to the pantry', s2.list.length === 0 && s2.pantry.length === s.pantry.length + 1)
  const added = s2.pantry[s2.pantry.length - 1]
  check('list: the pantry item gets a date from its shelf life',
    daysBetween(s2.clock, added.expiry) === byId('tomato').shelf)
}

{
  const before = s.pantry.length
  const s2 = reducer(s, { type: 'importReceipt', id: 'r3' })
  check('receipt: importing adds every line to the pantry', s2.pantry.length === before + RECEIPTS[2].items.length)
  check('receipt: the purchase is logged', s2.purchases.length === s.purchases.length + 1)
}

{
  const deal = s.deals[0]
  const s2 = reducer(s, { type: 'viewDeal' })
  const s3 = reducer(s2, { type: 'reserveDeal', id: deal.id, usePoints: false, label: 'deal' })
  check('radar: reserving closes the deal', s3.deals.find((d) => d.id === deal.id).status === 'reserved')
  check('radar: the reserved food lands in the pantry', s3.pantry.length === s2.pantry.length + 1)
  check('radar: money saved is the markdown', close(s3.impact.money, deal.from - deal.to))
  check('radar: kilos saved match the deal size', close(s3.impact.kg, kgOf(deal.product, deal.qty)))
  check('radar: points are credited', s3.impact.points > 0)
  check('radar: conversion stats move', s3.stats.dealsViewed === 1 && s3.stats.dealsReserved === 1)
  const s4 = reducer(s3, { type: 'reserveDeal', id: deal.id, usePoints: false, label: 'deal' })
  check('radar: a deal cannot be reserved twice', s4.impact.kg === s3.impact.kg)
}

{
  // Points path: earn enough, then spend 100 on a second reservation.
  let sp = s
  for (const d of s.deals.slice(0, 6)) sp = reducer(sp, { type: 'reserveDeal', id: d.id, usePoints: false, label: 'd' })
  check('points: several reservations build a balance', sp.impact.points >= 100, `points=${sp.impact.points}`)
  const target = sp.deals.find((d) => d.status === 'open')
  const before = sp.impact.points
  const sp2 = reducer(sp, { type: 'reserveDeal', id: target.id, usePoints: true, label: 'd' })
  const earned = pointsFor(kgOf(target.product, target.qty))
  check('points: spending 100 shows up in the balance', sp2.impact.points === before + earned - 100)
  check('points: the extra R$ 5 reaches the savings', close(sp2.impact.money, sp.impact.money + (target.from - target.to) + 5))
  const sr = reducer(sp, { type: 'redeem' })
  check('points: redeeming converts 100 points into credit', sr.impact.credit === 5 && sr.impact.points === before - 100)
  const poor = reducer({ ...s0, impact: { ...s0.impact, points: 40 } }, { type: 'redeem' })
  check('points: redeeming below the threshold does nothing', poor.impact.credit === 0 && poor.impact.points === 40)
}

{
  const item = s.pantry[0]
  const s2 = reducer(s, { type: 'shareItem', uid: item.uid, note: 'test' })
  check('share: the item leaves the pantry', s2.pantry.find((p) => p.uid === item.uid) === undefined)
  check('share: a post appears under your name', s2.community[0].owner === 'me' && s2.community[0].status === 'open')
  check('share: sharing alone does not credit waste avoided', s2.impact.kg === s.impact.kg)
  const s3 = reducer(s2, { type: 'neighborClaims', label: 'x', notifyText: '{n} took it' })
  check('share: a claim credits the sharing household', s3.impact.kg > s2.impact.kg)
  check('share: the post is marked claimed', s3.community[0].status === 'claimed')
  check('share: the claim raises a notification', s3.notifications[0].text.includes('took it'))
}

{
  const post = s.community.find((c) => c.status === 'open' && c.owner === 'neighbor')
  const s2 = reducer(s, { type: 'claimPost', id: post.id, label: 'x' })
  check('claim: claiming adds the food to your pantry', s2.pantry.length === s.pantry.length + 1)
  check('claim: claiming credits waste avoided', close(s2.impact.kg, s.impact.kg + kgOf(post.product, post.qty)))
  const s3 = reducer(s2, { type: 'claimPost', id: post.id, label: 'x' })
  check('claim: a post cannot be claimed twice', s3.pantry.length === s2.pantry.length)
}

{
  const s2 = reducer(s, { type: 'pantryUse', uid: s.pantry[0].uid, label: 'x' })
  check('pantry: using food in time credits waste avoided', s2.impact.kg > s.impact.kg)
  const stale = { ...s, pantry: [{ ...s.pantry[0], expiry: iso(addDays(s.clock, -2)) }] }
  const s3 = reducer(stale, { type: 'pantryUse', uid: stale.pantry[0].uid, label: 'x' })
  check('pantry: food used past its date credits nothing', s3.impact.kg === stale.impact.kg)
}

{
  const s2 = reducer(s, { type: 'advance', n: 3, expiryText: '{n} items close' })
  check('clock: advancing moves the prototype date', daysBetween(s.clock, s2.clock) === 3)
  check('clock: dates on pantry items stay put', s2.pantry[0].expiry === s.pantry[0].expiry)
  const urgent = s2.pantry.filter((p) => { const d = daysBetween(s2.clock, p.expiry); return d >= 0 && d <= 1 })
  check('clock: newly urgent items raise one notification',
    urgent.length === 0 || s2.notifications[0].text === `${urgent.length} items close`)
}

{
  const s2 = reducer(s, { type: 'dropDeal', text: 'new deal' })
  check('demo: a new deal is added to the radar', s2.deals.length === s.deals.length + 1)
  check('demo: the new deal is open', s2.deals[0].status === 'open')
  check('demo: the deal pool shrinks', s2.extraDealPool.length === s.extraDealPool.length - 1)
  let drained = s
  for (let i = 0; i < 10; i++) drained = reducer(drained, { type: 'dropDeal', text: 'x' })
  check('demo: dropping past the end of the pool is safe', drained.extraDealPool.length === 0)
}

{
  const s2 = reducer({ ...s, lang: 'pt' }, { type: 'reset' })
  check('reset: everything clears', s2.onboarded === false && s2.pantry.length === 0 && s2.impact.kg === 0)
  check('reset: the chosen language survives', s2.lang === 'pt')
}

/* ---- migration from the v1 household ---- */
{
  const v1 = {
    ...initialState(), v: 1,
    household: { adults: 2, children: 1, appetite: 'big', diets: ['lactose'], cpf: false },
  }
  const m = migrate(v1)
  check('migration: v1 salta direto para a versao corrente', m.v === initialState().v)
  check('migration: one person per mouth', m.household.people.length === 3)
  check('migration: adults come first', m.household.people.slice(0, 2).every((p) => p.kind === 'adult'))
  check('migration: the child is kept', m.household.people[2].kind === 'child')
  check('migration: the old shared appetite is carried to everyone',
    m.household.people.every((p) => p.appetite === 'big'))
  check('migration: diets survive', m.household.diets.includes('lactose'))
  check('migration: the CPF choice survives', m.household.cpf === false)
  const v2 = migrate({ ...initialState(), v: 2, learnedEans: { '7894900027013': 'cola' } })
  check('migration: v2 ganha o mapa de EANs sem perder nada',
    v2.v === initialState().v && v2.learnedEans['7894900027013'] === 'cola')
  check('migration: o estado corrente e deixado em paz',
    migrate({ ...initialState() }).v === initialState().v)
  check('migration: an unknown version is rejected', migrate({ v: 99 }) === null)
  check('migration: the migrated household still feeds the engine',
    weeklyNeed(tomato, m.household) > 0)
  check('migration: v1 tambem ganha o mapa de EANs vazio',
    typeof m.learnedEans === 'object' && m.learnedEans !== null)
}

/* ---- i18n parity ---- */
const { DICT } = await import(path.join(root, 'src', 'lib', 'i18n.js'))
check('i18n: Portuguese covers every English key',
  Object.keys(DICT.en).every((k) => k in DICT.pt))
check('i18n: no Portuguese key is orphaned',
  Object.keys(DICT.pt).every((k) => k in DICT.en))
check('i18n: placeholders match across languages',
  Object.keys(DICT.en).every((k) => {
    const a = (DICT.en[k].match(/\{\w+\}/g) || []).sort().join()
    const b = (DICT.pt[k].match(/\{\w+\}/g) || []).sort().join()
    return a === b
  }))

console.log(`\n${pass} checks passed, ${fails.length} failed`)
if (fails.length) {
  console.log('\nFAILED:')
  for (const f of fails) console.log('  ✗ ' + f)
  process.exit(1)
}
