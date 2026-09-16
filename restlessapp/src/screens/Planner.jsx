import React, { useMemo, useState } from 'react'
import { useApp, useDerived } from '../store.jsx'
import { CATALOG, CATEGORIES, byId } from '../data/seed.js'
import {
  suggestQuantity, weeklyNeed, oversizePct, WASTE_RISK_PCT, daysBetween, freshness, FRESH_COLOR,
  addDays, iso, shortDate, relativeWhen, qty as fmtQty, kgOf, money, peopleOf,
} from '../lib/logic.js'
import { Icon, Sheet, Chip, Empty, SectionTitle } from '../components/ui.jsx'
import Scan from './Scan.jsx'

function Flag({ tone = 'warn', children }) {
  const c = tone === 'risk' ? 'text-ember border-ember/40' : tone === 'info' ? 'text-haze border-fern/50' : 'text-amber border-amber/40'
  return <span className={`inline-block text-[11.5px] leading-none border rounded-full px-2 py-1 mr-1.5 mt-1.5 ${c}`}>{children}</span>
}

function QuantitySheet({ open, onClose, entry }) {
  const { state, dispatch, t } = useApp()
  const { pantryByProduct } = useDerived()
  if (!open || !entry) return null
  const prod = byId(entry.product)
  const name = prod[state.lang] || prod.en
  const atHome = pantryByProduct[entry.product] || 0
  const need = weeklyNeed(prod, state.household)
  const rounding = state.prefs.rounding
  const s = suggestQuantity(prod, state.household, rounding, atHome)
  const over = oversizePct(entry.qty, need)
  const step = prod.packs[0]

  const setQty = (v) => {
    const next = Math.max(0, Math.round(v * 100) / 100)
    const savedKg = next < entry.qty ? kgOf(entry.product, entry.qty - next) : 0
    dispatch({
      type: 'listQty', uid: entry.uid, qty: next,
      savedKg: over >= WASTE_RISK_PCT ? savedKg : 0,
      label: name,
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('planner.qtyTitle', { item: name })}>
      <p className="text-[13.5px] text-haze leading-relaxed">
        {t('planner.qtyExplain', {
          rate: fmtQty(need),
          unit: t(`unit.${prod.unit}`),
          packs: prod.packs.map((p) => `${fmtQty(p)} ${t(`unit.${prod.unit}`)}`).join(', '),
        })}
      </p>

      <div className="mt-5 flex items-center justify-center gap-5">
        <button className="w-11 h-11 rounded-full border border-fern grid place-items-center" onClick={() => setQty(entry.qty - step)} aria-label="−">
          <Icon.minus />
        </button>
        <div className="text-center min-w-[110px]">
          <div className="num text-[38px] leading-none">{fmtQty(entry.qty)}</div>
          <div className="text-[13px] text-haze mt-1">{t(`unit.${prod.unit}`)}</div>
        </div>
        <button className="w-11 h-11 rounded-full border border-fern grid place-items-center" onClick={() => setQty(entry.qty + step)} aria-label="+">
          <Icon.plus />
        </button>
      </div>

      {over >= WASTE_RISK_PCT && (
        <div className="mt-4 border border-ember/50 rounded-2xl px-4 py-3">
          <p className="text-[13.5px] text-ember leading-snug">{t('planner.flag.oversized', { pct: over })}</p>
          <p className="text-[13px] text-haze mt-1.5 num">
            {t('planner.savedByDownsize', { kg: fmtQty(kgOf(entry.product, Math.max(0, entry.qty - s.qty))) })}
          </p>
        </div>
      )}
      {atHome > 0 && (
        <p className="mt-3 text-[13px] text-amber num">
          {t('planner.flag.duplicate', { qty: fmtQty(atHome), unit: t(`unit.${prod.unit}`) })}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2 justify-center">
        {prod.packs.map((pk) => (
          <Chip key={pk} active={Math.abs(entry.qty - pk) < 0.001} onClick={() => setQty(pk)}>
            {fmtQty(pk)} {t(`unit.${prod.unit}`)}
          </Chip>
        ))}
      </div>

      <div className="mt-5">
        <p className="text-[14px] mb-2.5">{t('planner.qtyRounding')}</p>
        <div className="flex gap-2">
          {['conservative', 'balanced', 'aggressive'].map((r) => (
            <Chip key={r} active={rounding === r} onClick={() => dispatch({ type: 'prefs', patch: { rounding: r } })}>
              {t(`set.rounding.${r}`)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        {s.qty > 0 ? (
          <button className="btn-primary flex-1" onClick={() => { setQty(s.qty); onClose() }}>
            {t('planner.accept')} · {fmtQty(s.qty)} {t(`unit.${prod.unit}`)}
          </button>
        ) : (
          <p className="flex-1 self-center text-[13.5px] text-haze leading-snug">{t('planner.enough')}</p>
        )}
        <button className="btn-ghost" onClick={onClose}>{t('common.done')}</button>
      </div>
    </Sheet>
  )
}

function AddSheet({ open, onClose }) {
  const { state, dispatch, t } = useApp()
  const { pantryByProduct } = useDerived()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(null)

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    return CATALOG.filter((p) => {
      if (cat && p.cat !== cat) return false
      if (!term) return true
      return p.en.toLowerCase().includes(term) || p.pt.toLowerCase().includes(term)
    })
  }, [q, cat])

  function add(p) {
    const atHome = pantryByProduct[p.id] || 0
    const s = suggestQuantity(p, state.household, state.prefs.rounding, atHome)
    dispatch({
      type: 'addToList', product: p.id, qty: s.qty || p.packs[0], need: s.need, atHome,
      dupText: t('planner.flag.duplicate', { qty: fmtQty(atHome), unit: t(`unit.${p.unit}`) }),
    })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('planner.addItem')} tall>
      <div className="flex items-center gap-2 bg-ink border border-fern/60 rounded-full px-4 py-2.5">
        <Icon.search size={18} />
        <input
          className="bg-transparent outline-none flex-1 text-[15px] placeholder:text-haze/70"
          placeholder={t('planner.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 pb-1">
        <Chip active={!cat} onClick={() => setCat(null)}>{t('common.all')}</Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{t(`cat.${c}`)}</Chip>
        ))}
      </div>
      <ul className="mt-3 divide-y divide-fern/25">
        {results.map((p) => {
          const atHome = pantryByProduct[p.id] || 0
          const s = suggestQuantity(p, state.household, state.prefs.rounding, atHome)
          return (
            <li key={p.id}>
              <button onClick={() => add(p)} className="w-full text-left py-3 flex items-center gap-3 active:opacity-70">
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] leading-tight">{p[state.lang] || p.en}</span>
                  <span className="block text-[12.5px] text-haze num mt-0.5">
                    {t('planner.suggested')}: {fmtQty(s.qty)} {t(`unit.${p.unit}`)}
                    {atHome > 0 && <span className="text-amber"> · {fmtQty(atHome)} {t(`unit.${p.unit}`)}</span>}
                  </span>
                </span>
                <span className="text-haze"><Icon.plus size={18} /></span>
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

export default function Planner({ go }) {
  const { state, dispatch, t } = useApp()
  const { pantryByProduct } = useDerived()
  const [tab, setTab] = useState('list')
  const [addOpen, setAddOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [qtyEntry, setQtyEntry] = useState(null)
  const lang = state.lang

  const entry = qtyEntry ? state.list.find((l) => l.uid === qtyEntry) : null

  const pantry = [...state.pantry]
    .map((p) => ({ ...p, left: daysBetween(state.clock, p.expiry) }))
    .sort((a, b) => a.left - b.left)

  return (
    <div className="px-5 pt-5 pb-8">
      <h1 className="font-display text-[25px] leading-tight tracking-tight mb-4">{t('planner.title')}</h1>

      <div className="flex gap-1 p-1 bg-bark border border-fern/40 rounded-full mb-5" data-tour-el="planner-tabs">
        {[['list', t('planner.tab.list')], ['pantry', t('planner.tab.pantry')]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 rounded-full py-2 text-[14px] font-semibold transition-colors ${tab === k ? 'bg-sage text-ink' : 'text-haze'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <>
          <div className="flex gap-2.5 mb-4" data-tour-el="planner-actions">
            <button className="btn-primary flex-1 py-2.5 text-[14px]" onClick={() => setAddOpen(true)}>
              {t('planner.addItem')}
            </button>
            <button className="btn-ghost py-2.5 text-[14px]" onClick={() => setReceiptOpen(true)}>
              {t('planner.importReceipt')}
            </button>
          </div>

          {state.list.length === 0 ? (
            <Empty>{t('planner.listEmpty')}</Empty>
          ) : (
            <ul className="space-y-2.5">
              {state.list.map((l) => {
                const prod = byId(l.product)
                const atHome = pantryByProduct[l.product] || 0
                const need = weeklyNeed(prod, state.household)
                const over = oversizePct(l.qty, need)
                const daysToFinish = need > 0 ? Math.round((l.qty / (need / 7))) : 99
                const tooSlow = daysToFinish > prod.shelf
                return (
                  <li key={l.uid} className="card px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <button className="flex-1 min-w-0 text-left" onClick={() => setQtyEntry(l.uid)}>
                        <span className="block text-[15.5px] font-semibold leading-tight">{prod[lang] || prod.en}</span>
                        <span className="block text-[13px] text-haze num mt-1">
                          {fmtQty(l.qty)} {t(`unit.${prod.unit}`)}
                          <span className="text-fern"> · </span>
                          {t('planner.needFor', {
                            qty: fmtQty(need), unit: t(`unit.${prod.unit}`),
                            people: peopleOf(state.household).length,
                          })}
                        </span>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button className="p-2 text-haze active:text-sage" aria-label={t('planner.markBought')}
                          onClick={() => { dispatch({ type: 'markBought', uid: l.uid }); dispatch({ type: 'toast', text: t('planner.boughtToast') }) }}>
                          <Icon.check size={18} />
                        </button>
                        <button className="p-2 text-haze active:text-ember" aria-label={t('planner.remove')}
                          onClick={() => dispatch({ type: 'removeFromList', uid: l.uid })}>
                          <Icon.trash size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="-mt-0.5">
                      {atHome > 0 && <Flag>{t('planner.flag.duplicate', { qty: fmtQty(atHome), unit: t(`unit.${prod.unit}`) })}</Flag>}
                      {over >= WASTE_RISK_PCT && <Flag tone="risk">{t('planner.flag.oversized', { pct: over })}</Flag>}
                      {tooSlow && over < WASTE_RISK_PCT && <Flag tone="info">{t('planner.flag.expiry')}</Flag>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {tab === 'pantry' && (
        <>
          <div className="flex gap-2.5 mb-4">
            <button className="btn-ghost flex-1 py-2.5 text-[14px]" onClick={() => setReceiptOpen(true)}>
              {t('planner.importReceipt')}
            </button>
          </div>
          {pantry.length === 0 ? (
            <Empty>{t('planner.pantryEmpty')}</Empty>
          ) : (
            <ul className="space-y-2.5">
              {pantry.map((p) => {
                const prod = byId(p.product)
                const band = freshness(p.left)
                const color = FRESH_COLOR[band]
                const rate = weeklyNeed(prod, state.household) / 7
                const runOut = rate > 0 ? addDays(state.clock, Math.round(p.qty / rate)) : null
                return (
                  <li key={p.uid} className="card px-4 py-3.5 flex items-center gap-3.5">
                    <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: color }} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15.5px] font-semibold leading-tight">{prod[lang] || prod.en}</span>
                      <span className="block text-[12.5px] text-haze num mt-1">
                        {fmtQty(p.qty)} {t(`unit.${prod.unit}`)} · {t('planner.bestBefore', { date: shortDate(p.expiry, lang) })}
                      </span>
                      <span className="block text-[12.5px] num mt-0.5" style={{ color }}>
                        {p.left < 0 ? t('common.expired') : relativeWhen(p.left, t)}
                        {runOut && p.left >= 0 && (
                          <span className="text-haze"> · {t('planner.runsOut', { date: shortDate(runOut, lang) })}</span>
                        )}
                      </span>
                    </span>
                    <span className="flex flex-col gap-1.5 shrink-0">
                      <button className="text-[12px] border border-fern rounded-full px-2.5 py-1 text-haze active:text-sage"
                        onClick={() => { dispatch({ type: 'pantryUse', uid: p.uid, label: prod[lang] || prod.en }); dispatch({ type: 'toast', text: t('planner.usedToast') }) }}>
                        {t('planner.usedIt')}
                      </button>
                      <button className="text-[12px] border border-amber/60 text-amber rounded-full px-2.5 py-1"
                        onClick={() => { dispatch({ type: 'shareItem', uid: p.uid }); dispatch({ type: 'toast', text: t('comm.posted', { item: prod[lang] || prod.en }) }); go('community') }}>
                        {t('planner.shareIt')}
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <Scan open={receiptOpen} onClose={() => setReceiptOpen(false)} />
      <QuantitySheet open={!!entry} entry={entry} onClose={() => setQtyEntry(null)} />
    </div>
  )
}
