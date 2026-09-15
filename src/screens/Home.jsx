import React from 'react'
import { useApp, useDerived } from '../store.jsx'
import { byId, storeById } from '../data/seed.js'
import {
  daysBetween, freshness, FRESH_COLOR, relativeWhen, qty as fmtQty, shortDate,
  discountPct, oversizePct, WASTE_RISK_PCT,
} from '../lib/logic.js'
import { Icon, SectionTitle, Empty } from '../components/ui.jsx'
import { PILLAR_META } from './Onboarding.jsx'

function Shelf({ items, lang, t, clock, onOpen }) {
  if (!items.length) return <Empty>{t('home.shelfEmpty')}</Empty>
  return (
    <div className="-mx-5 px-5 overflow-x-auto no-scrollbar">
      <div className="flex gap-2.5 pb-1">
        {items.map((p) => {
          const prod = byId(p.product)
          const left = daysBetween(clock, p.expiry)
          const band = freshness(left)
          const color = FRESH_COLOR[band]
          const pct = Math.max(0.08, Math.min(1, (left + 1) / (prod.shelf || 10)))
          return (
            <button
              key={p.uid}
              onClick={onOpen}
              className="shrink-0 w-[104px] text-left card px-3 py-3 active:bg-moss"
            >
              <span className="block h-1.5 rounded-full bg-fern/40 mb-2.5 overflow-hidden">
                <span className="block h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
              </span>
              <span className="block text-[13.5px] font-semibold leading-tight line-clamp-2 min-h-[2.4em]">{prod[lang] || prod.en}</span>
              <span className="block text-[12px] text-haze num mt-0.5">{fmtQty(p.qty)} {t(`unit.${prod.unit}`)}</span>
              <span className="block text-[12px] mt-1.5 num" style={{ color }}>
                {left < 0 ? t('common.expired') : relativeWhen(left, t)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Alert({ tone, icon: IconEl, text, cta, onClick }) {
  const ring = tone === 'urgent' ? 'border-ember/60' : tone === 'deal' ? 'border-amber/60' : 'border-fern/50'
  const fg = tone === 'urgent' ? 'text-ember' : tone === 'deal' ? 'text-amber' : 'text-haze'
  return (
    <button onClick={onClick} className={`card ${ring} w-full text-left px-4 py-3.5 flex items-center gap-3.5 active:bg-moss`}>
      <span className={`${fg} shrink-0`}><IconEl size={20} /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] leading-snug">{text}</span>
        <span className="block text-[12.5px] text-haze mt-0.5">{cta}</span>
      </span>
      <span className="text-haze shrink-0"><Icon.chevron size={16} /></span>
    </button>
  )
}

export default function Home({ go }) {
  const { state, t } = useApp()
  const { atRisk, matching, pantryByProduct } = useDerived()
  const lang = state.lang

  const shelf = [...state.pantry]
    .map((p) => ({ ...p, left: daysBetween(state.clock, p.expiry) }))
    .sort((a, b) => a.left - b.left)
    .slice(0, 14)

  const duplicates = state.list.filter((l) => (pantryByProduct[l.product] || 0) > 0)
  const risks = state.list.filter((l) => oversizePct(l.qty, l.need) >= WASTE_RISK_PCT)

  const alerts = []
  const worst = atRisk[0]
  if (worst) {
    const prod = byId(worst.product)
    const gone = worst.left < 0
    alerts.push({
      key: 'exp', tone: 'urgent', icon: Icon.clock,
      text: t(gone ? 'home.alert.expired' : 'home.alert.expiring', {
        item: prod[lang] || prod.en, when: relativeWhen(worst.left, t),
      }),
      cta: t(gone ? 'home.alert.expiredCta' : 'home.alert.expiringCta'),
      onClick: () => go(gone ? 'planner' : 'community'),
    })
  }
  if (matching[0]) {
    const d = matching[0]
    const prod = byId(d.product)
    alerts.push({
      key: 'deal', tone: 'deal', icon: Icon.radar,
      text: t('home.alert.deal', {
        item: prod[lang] || prod.en, pct: discountPct(d.from, d.to), store: storeById(d.store).name,
      }),
      cta: t('home.alert.dealCta'), onClick: () => go('radar'),
    })
  }
  if (duplicates[0]) {
    const prod = byId(duplicates[0].product)
    alerts.push({
      key: 'dup', tone: 'plain', icon: Icon.basket,
      text: t('home.alert.dup', { item: prod[lang] || prod.en }),
      cta: t('home.alert.dupCta'), onClick: () => go('planner'),
    })
  }

  const statFor = (p) => {
    if (p === 'planner') return t('home.stat.listItems', { n: state.list.length })
    if (p === 'radar') return t('home.stat.deals', { n: matching.length })
    if (p === 'quantity') return t('home.stat.risk', { n: risks.length })
    return t('home.stat.shared', { n: state.community.filter((c) => c.status === 'open' && c.owner === 'neighbor').length })
  }
  const goFor = (p) => (p === 'quantity' ? 'planner' : p === 'planner' ? 'planner' : p)

  return (
    <div className="px-5 pt-5 pb-8">
      <div className="flex items-baseline justify-between gap-3 mb-5">
        <div>
          <p className="text-[13px] text-haze">{t('home.hello')}</p>
          <h1 className="font-display text-[26px] leading-tight tracking-tight">
            {atRisk.length === 0
              ? t('home.headingCalm')
              : atRisk.length === 1
                ? t('home.headingRisk1')
                : t('home.headingRisk', { n: atRisk.length })}
          </h1>
        </div>
      </div>

      <SectionTitle right={<span className="text-[12px] text-haze num">{shortDate(state.clock, lang)}</span>}>
        {t('home.shelfTitle')}
      </SectionTitle>
      <Shelf items={shelf} lang={lang} t={t} clock={state.clock} onOpen={() => go('planner')} />

      {alerts.length > 0 && (
        <div className="mt-7">
          <SectionTitle>{t('home.alerts')}</SectionTitle>
          <div className="space-y-2.5">
            {alerts.map((a) => <Alert key={a.key} {...a} />)}
          </div>
        </div>
      )}

      <div className="mt-7">
        <SectionTitle right={<span className="text-[12px] text-haze">{t('home.pillarOrderNote')}</span>}>
          {t('home.yourOrder')}
        </SectionTitle>
        <div className="space-y-2.5">
          {state.prefs.ranking.map((p, i) => {
            const m = PILLAR_META[p]
            const IconEl = m.icon
            return (
              <button
                key={p}
                onClick={() => go(goFor(p))}
                className={`card w-full text-left px-4 py-4 flex items-center gap-3.5 active:bg-moss ${i === 0 ? 'border-amber/50' : ''}`}
              >
                <span className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${i === 0 ? 'bg-amber text-ink' : 'bg-moss text-sage'}`}>
                  <IconEl size={19} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold leading-tight">{t(m.short)}</span>
                  <span className="block text-[12.5px] text-haze mt-0.5 num">{statFor(p)}</span>
                </span>
                <span className="text-haze shrink-0"><Icon.chevron size={16} /></span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
