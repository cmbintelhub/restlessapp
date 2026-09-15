import React from 'react'
import { useApp } from '../store.jsx'
import { PILLARS } from '../data/seed.js'
import { money, qty as fmtQty, shortDate } from '../lib/logic.js'
import { Icon, SectionTitle, Empty } from '../components/ui.jsx'

const SRC_LABEL = {
  radar: 'impact.src.radar',
  community: 'impact.src.community',
  quantity: 'impact.src.quantity',
  pantry: 'impact.src.pantry',
}

function Metric({ label, value, hint }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-[14px] text-haze flex-1 min-w-0">{label}</span>
      <span className="num text-[15px] shrink-0">{value}</span>
      {hint && <span className="text-[12px] text-haze num shrink-0">{hint}</span>}
    </div>
  )
}

export default function Impact() {
  const { state, dispatch, t } = useApp()
  const { impact, stats } = state
  const lang = state.lang

  const bySource = {}
  for (const e of impact.events) bySource[e.src] = (bySource[e.src] || 0) + (e.kg || 0)
  const total = Object.values(bySource).reduce((a, b) => a + b, 0)

  const conv = stats.dealsViewed > 0 ? Math.round((stats.dealsReserved / stats.dealsViewed) * 100) : 0
  const auto = state.purchases.length
    ? Math.round((state.purchases.filter((p) => p.source === 'cpf').length / state.purchases.length) * 100)
    : 0

  return (
    <div className="px-5 pt-5 pb-8">
      <h1 className="font-display text-[25px] leading-tight tracking-tight">{t('impact.title')}</h1>
      <p className="text-[13px] text-haze mt-1 mb-5 max-w-[38ch]">{t('impact.subtitle')}</p>

      <div className="card px-5 py-6">
        <div className="flex items-end gap-2">
          <span className="num text-[52px] leading-[0.9] text-sage">{fmtQty(impact.kg)}</span>
          <span className="text-[14px] text-haze mb-1.5">{t('impact.kg')}</span>
        </div>
        <div className="flex gap-8 mt-5 pt-5 border-t border-fern/30">
          <div>
            <p className="num text-[21px] leading-none">{money(impact.money)}</p>
            <p className="text-[12.5px] text-haze mt-1">{t('impact.money')}</p>
          </div>
          <div>
            <p className="num text-[21px] leading-none text-amber">{impact.points}</p>
            <p className="text-[12.5px] text-haze mt-1">{t('impact.points')}</p>
          </div>
          {impact.credit > 0 && (
            <div>
              <p className="num text-[21px] leading-none">{money(impact.credit)}</p>
              <p className="text-[12.5px] text-haze mt-1">{t('impact.redeem')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card px-4 py-4 mt-3">
        <div className="flex items-start gap-3.5">
          <span className="text-amber shrink-0 mt-0.5"><Icon.gift size={20} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-[14.5px] leading-tight">{t('impact.redeem')}</p>
            <p className="text-[12.5px] text-haze mt-1 leading-snug">{t('impact.redeemBody')}</p>
          </div>
        </div>
        <button
          className="btn w-full mt-3.5 py-2.5 text-[13.5px] bg-sage text-ink disabled:opacity-35"
          disabled={impact.points < 100}
          onClick={() => {
            dispatch({ type: 'redeem' })
            dispatch({ type: 'toast', text: t('impact.redeemed') })
          }}
        >
          {impact.points < 100 ? t('impact.noPoints') : t('impact.redeemCta')}
        </button>
      </div>

      {total > 0 && (
        <div className="mt-7">
          <SectionTitle>{t('impact.bySource')}</SectionTitle>
          <div className="card px-4 py-4 space-y-3">
            {Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([src, kg]) => (
              <div key={src}>
                <div className="flex items-baseline justify-between text-[13px] mb-1.5">
                  <span>{t(SRC_LABEL[src] || src)}</span>
                  <span className="num text-haze">{fmtQty(Math.round(kg * 100) / 100)} kg</span>
                </div>
                <span className="block h-1.5 rounded-full bg-fern/40 overflow-hidden">
                  <span className="block h-full rounded-full bg-amber" style={{ width: `${(kg / total) * 100}%` }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-7">
        <SectionTitle>{t('impact.log')}</SectionTitle>
        {impact.events.length === 0 ? (
          <Empty>{t('impact.logEmpty')}</Empty>
        ) : (
          <ul className="card px-4 divide-y divide-fern/25">
            {impact.events.slice(0, 12).map((e) => (
              <li key={e.id} className="py-3 flex items-center gap-3">
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] leading-tight truncate">{e.label}</span>
                  <span className="block text-[12px] text-haze mt-0.5">
                    {t(SRC_LABEL[e.src] || e.src)} · {shortDate(e.ts, lang)}
                  </span>
                </span>
                <span className="num text-[13px] shrink-0">
                  {e.kg > 0 && <span>+{fmtQty(Math.round(e.kg * 100) / 100)} kg</span>}
                  {e.money > 0 && <span className="text-haze"> · {money(e.money)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-7">
        <SectionTitle>{t('impact.metrics')}</SectionTitle>
        <div className="card px-4 divide-y divide-fern/25">
          <Metric label={t('impact.m.onboarding')} value={state.onboarded ? '100%' : '0%'} />
          <Metric label={t('impact.m.autoImport')} value={`${auto}%`} />
          <Metric label={t('impact.m.conversion')} value={`${stats.dealsReserved}/${stats.dealsViewed}`} hint={`${conv}%`} />
          <Metric label={t('impact.m.pillars')} value={`${(stats.pillarsUsed || []).length}/${PILLARS.length}`} />
        </div>
      </div>
    </div>
  )
}
