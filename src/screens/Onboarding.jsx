import React, { useRef, useState } from 'react'
import { useApp } from '../store.jsx'
import { CATALOG, byId } from '../data/seed.js'
import { suggestQuantity, weeklyNeed, qty as fmtQty } from '../lib/logic.js'
import { Icon, Chip, Toggle } from '../components/ui.jsx'
import HouseholdEditor from '../components/HouseholdEditor.jsx'

const PILLAR_META = {
  planner:   { icon: Icon.basket, name: 'pillar.planner.name',   short: 'pillar.planner.short',   kicker: 'pillar.planner.kicker',   line: 'pillar.planner.line' },
  radar:     { icon: Icon.radar,  name: 'pillar.radar.name',     short: 'pillar.radar.short',     kicker: 'pillar.radar.kicker',     line: 'pillar.radar.line' },
  quantity:  { icon: Icon.scale,  name: 'pillar.quantity.name',  short: 'pillar.quantity.short',  kicker: 'pillar.quantity.kicker',  line: 'pillar.quantity.line' },
  community: { icon: Icon.users,  name: 'pillar.community.name', short: 'pillar.community.short', kicker: 'pillar.community.kicker', line: 'pillar.community.line' },
}
export { PILLAR_META }

const STARTER = ['banana', 'tomato', 'milk', 'rice', 'lettuce', 'eggs', 'potato', 'yogurt', 'chicken', 'apple']
const ROW = 78

export function RankList({ order, setOrder, t }) {
  const [drag, setDrag] = useState(null)
  const startRef = useRef(0)

  function down(i, e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    startRef.current = e.clientY
    setDrag({ i, dy: 0 })
  }
  function move(e) {
    if (!drag) return
    const dy = e.clientY - startRef.current
    const shift = Math.round(dy / ROW)
    const target = Math.max(0, Math.min(order.length - 1, drag.i + shift))
    if (target !== drag.i) {
      const next = [...order]
      const [moved] = next.splice(drag.i, 1)
      next.splice(target, 0, moved)
      setOrder(next)
      startRef.current += (target - drag.i) * ROW
      setDrag({ i: target, dy: e.clientY - startRef.current })
    } else {
      setDrag({ ...drag, dy })
    }
  }
  function up() { setDrag(null) }

  function key(i, e) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const target = e.key === 'ArrowUp' ? i - 1 : i + 1
    if (target < 0 || target >= order.length) return
    const next = [...order]
    const [moved] = next.splice(i, 1)
    next.splice(target, 0, moved)
    setOrder(next)
  }

  return (
    <ul className="select-none" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {order.map((p, i) => {
        const m = PILLAR_META[p]
        const IconEl = m.icon
        const dragging = drag?.i === i
        return (
          <li
            key={p}
            className={`card mb-2.5 flex items-center gap-3 px-4 py-3.5 touch-none ${dragging ? 'border-amber/70 bg-moss shadow-lg shadow-black/40 z-10 relative' : ''}`}
            style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
          >
            <span className="num text-[22px] text-amber w-6 shrink-0">{i + 1}</span>
            <span className="text-haze shrink-0"><IconEl size={22} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold leading-tight truncate">{t(m.short)}</span>
              <span className="block text-[12.5px] text-haze truncate">{t(m.kicker)}</span>
            </span>
            <button
              className="p-2 -mr-2 text-haze cursor-grab active:cursor-grabbing touch-none"
              aria-label={`${t('onb.rank.handle')}: ${t(m.short)}`}
              onPointerDown={(e) => down(i, e)}
              onKeyDown={(e) => key(i, e)}
            >
              <Icon.drag />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default function Onboarding() {
  const { state, dispatch, t } = useApp()
  const [step, setStep] = useState(1)
  const [order, setOrder] = useState(state.prefs.ranking)
  const [picked, setPicked] = useState(['banana', 'tomato', 'milk'])
  const h = state.household

  const setH = (patch) => dispatch({ type: 'household', patch })

  function finish() {
    dispatch({ type: 'prefs', patch: { ranking: order } })
    for (const id of picked) {
      const p = byId(id)
      const s = suggestQuantity(p, h, state.prefs.rounding, 0)
      dispatch({ type: 'addToList', product: id, qty: s.qty, need: s.need, atHome: 0 })
    }
    dispatch({ type: 'finishOnboarding' })
  }

  return (
    <div className="h-full flex flex-col bg-ink">
      <header className="px-6 pt-8 pb-2 shrink-0">
        <div className="flex items-center gap-2 text-sage">
          <Icon.leaf size={22} />
          <span className="font-display text-[21px] tracking-tight">{t('app.name')}</span>
        </div>
        <div className="mt-5 flex gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={`h-[3px] flex-1 rounded-full ${n <= step ? 'bg-amber' : 'bg-fern/50'}`} />
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-haze num">{t('onb.step', { n: step })}</p>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pt-4 pb-4">
        {step === 1 && (
          <div className="rise">
            <h1 className="font-display text-[30px] leading-[1.1] tracking-tight mb-4">{t('onb.welcome.title')}</h1>
            <p className="text-[15px] text-haze leading-relaxed mb-7 max-w-[42ch]">{t('onb.welcome.body')}</p>
            <ul className="space-y-2.5">
              {['planner', 'radar', 'quantity', 'community'].map((p) => {
                const m = PILLAR_META[p]
                const IconEl = m.icon
                return (
                  <li key={p} className="flex gap-3.5 items-start">
                    <span className="mt-0.5 w-9 h-9 rounded-full bg-moss grid place-items-center text-sage shrink-0">
                      <IconEl size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold leading-tight">{t(m.name)}</span>
                      <span className="block text-[13.5px] text-haze leading-snug">{t(m.line)}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {step === 2 && (
          <div className="rise">
            <h1 className="font-display text-[27px] leading-tight tracking-tight mb-3">{t('onb.house.title')}</h1>
            <p className="text-[14.5px] text-haze leading-relaxed mb-5 max-w-[42ch]">{t('onb.house.body')}</p>

            <HouseholdEditor />

            <div className="card mt-3 px-4 py-4 flex items-start gap-4">
              <div className="flex-1">
                <p className="text-[15px] font-semibold mb-1">{t('onb.house.cpf')}</p>
                <p className="text-[13px] text-haze leading-snug">{t('onb.house.cpfHint')}</p>
              </div>
              <Toggle on={h.cpf} onChange={(v) => setH({ cpf: v })} label={t('onb.house.cpf')} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rise">
            <h1 className="font-display text-[27px] leading-tight tracking-tight mb-3">{t('onb.rank.title')}</h1>
            <p className="text-[14.5px] text-haze leading-relaxed mb-5 max-w-[42ch]">{t('onb.rank.body')}</p>
            <RankList order={order} setOrder={setOrder} t={t} />
          </div>
        )}

        {step === 4 && (
          <div className="rise">
            <h1 className="font-display text-[27px] leading-tight tracking-tight mb-3">{t('onb.list.title')}</h1>
            <p className="text-[14.5px] text-haze leading-relaxed mb-5 max-w-[42ch]">{t('onb.list.body')}</p>
            <div className="flex flex-wrap gap-2">
              {STARTER.map((id) => {
                const p = byId(id)
                const on = picked.includes(id)
                const s = suggestQuantity(p, h, state.prefs.rounding, 0)
                return (
                  <button
                    key={id}
                    onClick={() => setPicked(on ? picked.filter((x) => x !== id) : [...picked, id])}
                    className={`chip ${on ? 'bg-sage text-ink border-sage' : 'border-fern text-haze'}`}
                    aria-pressed={on}
                  >
                    {p[state.lang] || p.en}
                    <span className="num opacity-70 ml-1.5">{fmtQty(s.qty)} {t(`unit.${p.unit}`)}</span>
                  </button>
                )
              })}
            </div>
            <p className="mt-5 text-[13px] text-haze num">{t('onb.list.picked', { n: picked.length })}</p>
          </div>
        )}
      </div>

      <footer className="px-6 pb-7 pt-3 shrink-0 flex items-center gap-3 bg-ink">
        {step > 1 && (
          <button className="btn-ghost flex-1" onClick={() => setStep(step - 1)}>{t('common.back')}</button>
        )}
        {step < 4 ? (
          <button className="btn-primary flex-[2]" onClick={() => setStep(step + 1)}>
            {step === 1 ? t('onb.welcome.cta') : t('common.next')}
          </button>
        ) : (
          <button className="btn-primary flex-[2] disabled:opacity-40" disabled={picked.length === 0} onClick={finish}>
            {t('onb.list.cta')}
          </button>
        )}
      </footer>
    </div>
  )
}
