import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import {
  CATALOG, DEALS, EXTRA_DEALS, COMMUNITY_SEED, TIP_SEED, IDEA_SEED, RECEIPTS, NEIGHBORS, PILLARS, byId, storeById,
} from './data/seed.js'
import { addDays, iso, daysBetween, kgOf, pointsFor, suggestQuantity, weeklyNeed, newPerson } from './lib/logic.js'
import { translate } from './lib/i18n.js'

const KEY = 'restless.state.v1'
const VERSION = 6

let seq = 1
const uid = (p = 'i') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`

export function initialState() {
  const today = iso(new Date())
  return {
    v: VERSION,
    lang: 'en',
    onboarded: false,
    onboardedAt: null,
    clock: today,
    household: { people: [newPerson('adult'), newPerson('adult')], diets: [], cpf: true },
    prefs: {
      ranking: [...PILLARS],
      rounding: 'balanced',
      radius: 3,
      minDiscount: 20,
      categories: [],
      channel: 'push',
      quiet: { from: 22, to: 7 },
      visibility: 'block',
      anon: false,
    },
    pantry: [],
    list: [],
    purchases: [],
    deals: DEALS.map((d) => ({
      ...d,
      expiry: iso(addDays(today, d.expiresIn)),
      status: 'open',
    })),
    community: COMMUNITY_SEED.map((c) => ({
      ...c,
      owner: 'neighbor',
      postedOn: iso(addDays(today, -c.postedAgo)),
      expiry: iso(addDays(today, c.expiresIn)),
      status: 'open',
    })),
    // Co-creation: neighbor-submitted tips, plus whatever this household adds itself.
    tips: TIP_SEED.map((tp) => ({
      ...tp,
      mine: false,
      postedOn: iso(addDays(today, -tp.postedAgo)),
      likedByMe: false,
    })),
    // Co-creation aimed at the app itself: a feature-idea board inside the assistant.
    ideas: IDEA_SEED.map((it) => ({
      ...it,
      mine: false,
      postedOn: iso(addDays(today, -it.postedAgo)),
      votedByMe: false,
    })),
    impact: { kg: 0, money: 0, points: 0, credit: 0, events: [] },
    notifications: [],
    stats: { dealsViewed: 0, dealsReserved: 0, pillarsUsed: [] },
    extraDealPool: EXTRA_DEALS.map((d) => d.id),
    learnedEans: {},
    // Real, per-household usage history — kept in the same clock the rest of the
    // prototype already fakes time with, so "Advance 3 days" in Demo controls moves
    // streaks/adoption forward exactly like it moves pantry freshness forward.
    usage: {
      sessions: 0,
      activeDates: [],
      firstValueAt: null,
      pillarFirstUsedAt: { planner: null, radar: null, quantity: null, community: null },
    },
    nps: null, // { score: 0-10, ts } once this household answers the in-app pulse
    toast: null,
  }
}

function credit(state, { src, kg = 0, money = 0, label }) {
  const pts = kg > 0 ? pointsFor(kg) : 0
  return {
    ...state.impact,
    kg: Math.round((state.impact.kg + kg) * 100) / 100,
    money: Math.round((state.impact.money + money) * 100) / 100,
    points: state.impact.points + pts,
    events: [
      { id: uid('e'), src, kg, money, pts, label, ts: state.clock },
      ...state.impact.events,
    ].slice(0, 40),
  }
}

function note(state, kind, text) {
  return [{ id: uid('n'), kind, text, ts: state.clock, read: false }, ...state.notifications].slice(0, 30)
}

function usePillar(state, pillar) {
  const used = state.stats.pillarsUsed || []
  return used.includes(pillar) ? used : [...used, pillar]
}

function pantryQtyOf(state, productId) {
  return state.pantry
    .filter((p) => p.product === productId)
    .reduce((a, p) => a + p.qty, 0)
}

function receiptToPantry(state, receipt) {
  const items = receipt.items.map((it) => {
    const p = byId(it.product)
    return {
      uid: uid('p'),
      product: it.product,
      qty: it.qty,
      boughtOn: iso(addDays(state.clock, -receipt.ago)),
      expiry: iso(addDays(addDays(state.clock, -receipt.ago), p.shelf)),
      source: receipt.source,
    }
  })
  return items
}

function reducerBase(state, action) {
  switch (action.type) {
    case 'lang':
      return { ...state, lang: action.lang }

    case 'toast':
      return { ...state, toast: action.text ? { id: uid('t'), text: action.text, tone: action.tone || 'ok' } : null }

    case 'household':
      return { ...state, household: { ...state.household, ...action.patch } }

    case 'prefs':
      return { ...state, prefs: { ...state.prefs, ...action.patch } }

    case 'finishOnboarding': {
      let s = { ...state, onboarded: true }
      if (s.household.cpf) {
        // Consent to CPF na nota means the pantry is already populated on day one.
        const picks = [RECEIPTS[0], RECEIPTS[1]]
        const items = picks.flatMap((r) => receiptToPantry(s, r))
        s = {
          ...s,
          pantry: [...s.pantry, ...items],
          purchases: [
            ...picks.map((r) => ({
              id: uid('pu'), receipt: r.id, store: r.store, source: r.source,
              date: iso(addDays(s.clock, -r.ago)), total: r.total, items: r.items,
            })),
            ...s.purchases,
          ],
        }
        s = { ...s, notifications: note(s, 'capture', 'notif.capture') }
      }
      return s
    }

    case 'addToList': {
      const exists = state.list.find((l) => l.product === action.product)
      if (exists) return { ...state, toast: { id: uid('t'), text: action.dupText, tone: 'warn' } }
      return {
        ...state,
        list: [
          ...state.list,
          {
            uid: uid('l'),
            product: action.product,
            qty: action.qty,
            suggested: action.qty,
            need: action.need,
            atHome: action.atHome,
          },
        ],
        stats: { ...state.stats, pillarsUsed: usePillar(state, 'planner') },
      }
    }

    case 'listQty': {
      const list = state.list.map((l) => (l.uid === action.uid ? { ...l, qty: action.qty } : l))
      let s = { ...state, list }
      if (action.savedKg > 0) {
        s = {
          ...s,
          impact: credit(s, { src: 'quantity', kg: action.savedKg, label: action.label }),
          stats: { ...s.stats, pillarsUsed: usePillar(s, 'quantity') },
        }
      }
      return s
    }

    case 'removeFromList':
      return { ...state, list: state.list.filter((l) => l.uid !== action.uid) }

    case 'markBought': {
      const item = state.list.find((l) => l.uid === action.uid)
      if (!item) return state
      const p = byId(item.product)
      return {
        ...state,
        list: state.list.filter((l) => l.uid !== action.uid),
        pantry: [
          ...state.pantry,
          {
            uid: uid('p'), product: item.product, qty: item.qty,
            boughtOn: state.clock, expiry: iso(addDays(state.clock, p.shelf)), source: 'manual',
          },
        ],
      }
    }

    case 'importReceipt': {
      const r = RECEIPTS.find((x) => x.id === action.id)
      if (!r) return state
      const items = receiptToPantry(state, r)
      return {
        ...state,
        pantry: [...state.pantry, ...items],
        purchases: [
          { id: uid('pu'), receipt: r.id, store: r.store, source: r.source, date: iso(addDays(state.clock, -r.ago)), total: r.total, items: r.items },
          ...state.purchases,
        ],
        stats: { ...state.stats, pillarsUsed: usePillar(state, 'planner') },
      }
    }

    case 'pantryUse': {
      const item = state.pantry.find((p) => p.uid === action.uid)
      if (!item) return state
      const left = daysBetween(state.clock, item.expiry)
      let s = { ...state, pantry: state.pantry.filter((p) => p.uid !== action.uid) }
      if (left >= 0) {
        s = { ...s, impact: credit(s, { src: 'pantry', kg: kgOf(item.product, item.qty), label: action.label }) }
      }
      return s
    }

    case 'pantryDrop':
      return { ...state, pantry: state.pantry.filter((p) => p.uid !== action.uid) }

    case 'shareItem': {
      const item = state.pantry.find((p) => p.uid === action.uid)
      if (!item) return state
      const post = {
        id: uid('c'), product: item.product, qty: item.qty, neighbor: null, owner: 'me',
        postedOn: state.clock, expiry: item.expiry, note: action.note || '', status: 'open',
      }
      return {
        ...state,
        pantry: state.pantry.filter((p) => p.uid !== action.uid),
        community: [post, ...state.community],
        stats: { ...state.stats, pillarsUsed: usePillar(state, 'community') },
      }
    }

    case 'claimPost': {
      const post = state.community.find((c) => c.id === action.id)
      if (!post || post.status !== 'open') return state
      const p = byId(post.product)
      let s = {
        ...state,
        community: state.community.map((c) => (c.id === action.id ? { ...c, status: 'claimed', claimedBy: 'me' } : c)),
        pantry: [
          ...state.pantry,
          {
            uid: uid('p'), product: post.product, qty: post.qty,
            boughtOn: state.clock, expiry: post.expiry, source: 'neighbor',
          },
        ],
        stats: { ...state.stats, pillarsUsed: usePillar(state, 'community') },
      }
      s = { ...s, impact: credit(s, { src: 'community', kg: kgOf(post.product, post.qty), label: action.label }) }
      return s
    }

    case 'addTip': {
      const text = (action.text || '').trim()
      if (!text) return state
      const tip = {
        id: uid('tip'), pillar: action.pillar || null, text, likes: 0,
        postedOn: state.clock, mine: true, likedByMe: false,
      }
      return {
        ...state,
        tips: [tip, ...state.tips],
        stats: { ...state.stats, pillarsUsed: usePillar(state, 'community') },
      }
    }

    case 'likeTip': {
      return {
        ...state,
        tips: state.tips.map((tp) => (tp.id === action.id
          ? { ...tp, likedByMe: !tp.likedByMe, likes: tp.likes + (tp.likedByMe ? -1 : 1) }
          : tp)),
      }
    }

    case 'addIdea': {
      const text = (action.text || '').trim()
      if (!text) return state
      const idea = { id: uid('idea'), text, votes: 0, postedOn: state.clock, mine: true, votedByMe: false }
      return { ...state, ideas: [idea, ...state.ideas] }
    }

    case 'voteIdea': {
      return {
        ...state,
        ideas: state.ideas.map((it) => (it.id === action.id
          ? { ...it, votedByMe: !it.votedByMe, votes: it.votes + (it.votedByMe ? -1 : 1) }
          : it)),
      }
    }

    case 'neighborClaims': {
      const mine = state.community.find((c) => c.owner === 'me' && c.status === 'open')
      if (!mine) return state
      const n = NEIGHBORS[Math.floor(Math.random() * NEIGHBORS.length)]
      let s = {
        ...state,
        community: state.community.map((c) => (c.id === mine.id ? { ...c, status: 'claimed', claimedBy: n.id } : c)),
      }
      s = { ...s, impact: credit(s, { src: 'community', kg: kgOf(mine.product, mine.qty), label: action.label }) }
      s = { ...s, notifications: note(s, 'community', action.notifyText.replace('{n}', n.name)) }
      return { ...s, toast: { id: uid('t'), text: action.notifyText.replace('{n}', n.name), tone: 'ok' } }
    }

    case 'viewDeal':
      return { ...state, stats: { ...state.stats, dealsViewed: state.stats.dealsViewed + 1 } }

    case 'reserveDeal': {
      const deal = state.deals.find((d) => d.id === action.id)
      if (!deal || deal.status !== 'open') return state
      const usedPoints = action.usePoints ? Math.min(state.impact.points, 100) : 0
      const extra = usedPoints >= 100 ? 5 : 0
      const saved = deal.from - deal.to + extra
      const p = byId(deal.product)
      let s = {
        ...state,
        deals: state.deals.map((d) => (d.id === action.id ? { ...d, status: 'reserved' } : d)),
        pantry: [
          ...state.pantry,
          {
            uid: uid('p'), product: deal.product, qty: deal.qty,
            boughtOn: state.clock, expiry: deal.expiry, source: 'radar',
          },
        ],
        stats: {
          ...state.stats,
          dealsReserved: state.stats.dealsReserved + 1,
          pillarsUsed: usePillar(state, 'radar'),
        },
      }
      s = { ...s, impact: credit(s, { src: 'radar', kg: kgOf(deal.product, deal.qty), money: saved, label: action.label }) }
      if (usedPoints >= 100) s = { ...s, impact: { ...s.impact, points: s.impact.points - 100 } }
      return s
    }

    case 'redeem': {
      if (state.impact.points < 100) return state
      return {
        ...state,
        impact: { ...state.impact, points: state.impact.points - 100, credit: state.impact.credit + 5 },
      }
    }

    case 'advance': {
      const clock = iso(addDays(state.clock, action.n))
      let s = { ...state, clock }
      const urgent = s.pantry.filter((p) => {
        const d = daysBetween(clock, p.expiry)
        return d >= 0 && d <= 1
      })
      if (urgent.length) {
        s = { ...s, notifications: note(s, 'expiry', action.expiryText.replace('{n}', urgent.length)) }
      }
      return s
    }

    case 'dropDeal': {
      const pool = state.extraDealPool
      if (!pool.length) return state
      const id = pool[0]
      const d = EXTRA_DEALS.find((x) => x.id === id)
      const deal = { ...d, expiry: iso(addDays(state.clock, d.expiresIn)), status: 'open' }
      let s = { ...state, deals: [deal, ...state.deals], extraDealPool: pool.slice(1) }
      s = { ...s, notifications: note(s, 'deal', action.text) }
      return { ...s, toast: { id: uid('t'), text: action.text, tone: 'deal' } }
    }

    case 'learnEan': {
      if (!action.ean || !action.productId) return state
      return { ...state, learnedEans: { ...state.learnedEans, [action.ean]: action.productId } }
    }

    case 'importScanned': {
      // Linhas já revisadas pelo usuário: cada uma vira despensa ou lista.
      const rows = action.rows || []
      if (!rows.length) return state
      const learned = { ...state.learnedEans }
      for (const r of rows) if (r.ean && r.productId) learned[r.ean] = r.productId

      const pantry = [...state.pantry]
      const list = [...state.list]
      for (const r of rows) {
        const p = byId(r.productId)
        if (!p) continue
        if (r.destination === 'list') {
          if (list.some((l) => l.product === r.productId)) continue
          list.push({
            uid: uid('l'), product: r.productId, qty: r.qty,
            suggested: r.qty, need: weeklyNeed(p, state.household), atHome: 0,
          })
        } else {
          pantry.push({
            uid: uid('p'), product: r.productId, qty: r.qty,
            boughtOn: action.date || state.clock,
            expiry: iso(addDays(action.date || state.clock, p.shelf)),
            source: 'receipt', ean: r.ean || null,
          })
        }
      }

      let s2 = {
        ...state,
        pantry,
        list,
        learnedEans: learned,
        purchases: [
          {
            id: uid('pu'), receipt: action.key || null, store: action.storeName || null,
            source: 'scan', date: action.date || state.clock,
            total: action.total ?? null, items: rows.map((r) => ({ product: r.productId, qty: r.qty })),
          },
          ...state.purchases,
        ],
        stats: { ...state.stats, pillarsUsed: usePillar(state, 'planner') },
      }
      s2 = { ...s2, notifications: note(s2, 'capture', action.notifyText || 'notif.capture') }
      return s2
    }

    case 'readNotifications':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) }

    case 'session':
      // Dispatched once whenever the app mounts: a real, if coarse, "app opened" count.
      return { ...state, usage: { ...state.usage, sessions: state.usage.sessions + 1 } }

    case 'submitNps':
      return { ...state, nps: { score: action.score, ts: state.clock } }

    case 'reset':
      return { ...initialState(), lang: state.lang }

    case 'hydrate':
      return action.state

    default:
      return state
  }
}

/**
 * Runs after every action to keep the real, per-household usage history current:
 * when onboarding finished, the first time any kg/money got saved, the first time
 * each pillar got used, and which of the app's own clock-days had real activity on
 * them. Centralized here so individual action handlers above don't each need to
 * remember to update it. `usage` is what the Account tab's health score, streak,
 * time-to-first-value and feature-adoption metrics are computed from.
 */
function trackUsage(prev, next, action) {
  if (action.type === 'hydrate' || action.type === 'reset' || prev === next) return next

  let usage = next.usage
  let onboardedAt = next.onboardedAt

  if (!prev.onboarded && next.onboarded) onboardedAt = next.clock

  const PASSIVE = ['session', 'lang', 'prefs', 'toast', 'readNotifications']
  if (next.onboarded && !PASSIVE.includes(action.type) && !usage.activeDates.includes(next.clock)) {
    usage = { ...usage, activeDates: [...usage.activeDates, next.clock].slice(-180) }
  }

  if (!usage.firstValueAt && prev.impact.kg === 0 && next.impact.kg > 0) {
    usage = { ...usage, firstValueAt: next.clock }
  }

  const prevPillars = prev.stats?.pillarsUsed || []
  const nextPillars = next.stats?.pillarsUsed || []
  if (nextPillars.length > prevPillars.length) {
    const added = nextPillars.filter((p) => !prevPillars.includes(p))
    const stamped = { ...usage.pillarFirstUsedAt }
    let changed = false
    for (const p of added) if (!stamped[p]) { stamped[p] = next.clock; changed = true }
    if (changed) usage = { ...usage, pillarFirstUsedAt: stamped }
  }

  if (usage === next.usage && onboardedAt === next.onboardedAt) return next
  return { ...next, usage, onboardedAt }
}

export function reducer(state, action) {
  const next = reducerBase(state, action)
  return trackUsage(state, next, action)
}

const Ctx = createContext(null)

/** v1 stored a household as counts plus one shared appetite; v2 stores a person per mouth. */
function migrate(state) {
  if (state.v === VERSION) return state
  // v5 -> v6 only added the in-app feature-idea board; load() backfills the seeded
  // ideas list from initialState() since it's missing here, same trick as v3 -> v4.
  if (state.v === 5) return { ...state, v: VERSION }
  // v4 -> v5 only added the co-creation tips board; load() backfills the seeded
  // tips list from initialState() since it's missing here, same trick as v3 -> v4.
  if (state.v === 4) return { ...state, v: VERSION }
  // v3 -> v4 only added usage/onboardedAt/nps tracking; load() backfills any field
  // missing here from initialState(), so bumping the version number is all that's needed.
  if (state.v === 3) return { ...state, v: VERSION }
  if (state.v === 2) return { ...state, v: VERSION, learnedEans: state.learnedEans || {} }
  if (state.v === 1) {
    const h = state.household || {}
    const people = [
      ...Array.from({ length: h.adults ?? 1 }, () => ({ ...newPerson('adult'), appetite: h.appetite || 'normal' })),
      ...Array.from({ length: h.children ?? 0 }, () => ({ ...newPerson('child'), appetite: h.appetite || 'normal' })),
    ]
    return {
      ...state,
      v: VERSION,
      household: { people: people.length ? people : [newPerson('adult')], diets: h.diets || [], cpf: h.cpf ?? true },
      learnedEans: state.learnedEans || {},
    }
  }
  return null
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const migrated = migrate(JSON.parse(raw))
    if (!migrated) return null
    return { ...initialState(), ...migrated, toast: null }
  } catch {
    return null
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => load() || initialState())

  useEffect(() => {
    const { toast, ...persist } = state
    try {
      localStorage.setItem(KEY, JSON.stringify(persist))
    } catch {
      /* storage full or blocked: the prototype still runs from memory */
    }
  }, [state])

  const t = useMemo(() => (key, vars) => translate(state.lang, key, vars), [state.lang])

  const value = useMemo(() => ({ state, dispatch, t }), [state, t])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside AppProvider')
  return v
}

/** Derived helpers shared across screens. */
export function useDerived() {
  const { state } = useApp()
  return useMemo(() => {
    const pantryByProduct = {}
    for (const item of state.pantry) {
      pantryByProduct[item.product] = (pantryByProduct[item.product] || 0) + item.qty
    }
    const listProducts = new Set(state.list.map((l) => l.product))
    const openDeals = state.deals.filter((d) => d.status === 'open')
    // "matches your list" means exactly that: only what the user plans to buy.
    const matching = openDeals.filter((d) => listProducts.has(d.product))
    const atRisk = state.pantry
      .map((p) => ({ ...p, left: daysBetween(state.clock, p.expiry) }))
      .filter((p) => p.left <= 3)
      .sort((a, b) => a.left - b.left)
    const unread = state.notifications.filter((n) => !n.read).length
    return { pantryByProduct, listProducts, openDeals, matching, atRisk, unread }
  }, [state])
}

export { migrate }
export { CATALOG, byId, storeById, NEIGHBORS, RECEIPTS, PILLARS, suggestQuantity, weeklyNeed }
