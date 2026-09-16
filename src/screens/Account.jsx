import React, { useMemo, useState } from 'react'
import { useApp } from '../store.jsx'
import { PILLARS } from '../data/seed.js'
import { generatePopulation, populationSnapshot, DAYS as POP_DAYS } from '../data/population.js'
import { money, qty as fmtQty, shortDate } from '../lib/logic.js'
import {
  healthScore, currentStreak, timeToFirstValueDays, featureAdoptionRate,
  churnRisk, weeklyValueTrend, csqlConversion,
} from '../lib/metrics.js'
import { Icon, SectionTitle, Empty } from '../components/ui.jsx'

const SRC_LABEL = {
  radar: 'impact.src.radar',
  community: 'impact.src.community',
  quantity: 'impact.src.quantity',
  pantry: 'impact.src.pantry',
}

const BAND_TEXT = { green: 'text-sage', yellow: 'text-amber', red: 'text-ember' }
const BAND_BORDER = { green: 'border-fern/40', yellow: 'border-amber/50', red: 'border-ember/50' }

function Metric({ label, value, hint }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-[14px] text-haze flex-1 min-w-0">{label}</span>
      <span className="num text-[15px] shrink-0">{value}</span>
      {hint && <span className="text-[12px] text-haze num shrink-0">{hint}</span>}
    </div>
  )
}

/** The same thin bar used for the impact-by-source breakdown, reused for any 0-1 share. */
function Bar({ frac, tone = 'bg-amber' }) {
  return (
    <span className="block h-1.5 rounded-full bg-fern/40 overflow-hidden">
      <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%` }} />
    </span>
  )
}

function SimBadge({ t }) {
  return (
    <span className="text-[10.5px] uppercase tracking-wide border border-fern/50 text-haze rounded-full px-2 py-0.5">
      {t('account.simulated')}
    </span>
  )
}

export default function Account() {
  const { state, dispatch, t } = useApp()
  const { impact, stats, usage } = state
  const lang = state.lang
  const [view, setView] = useState('me')

  const bySource = {}
  for (const e of impact.events) bySource[e.src] = (bySource[e.src] || 0) + (e.kg || 0)
  const total = Object.values(bySource).reduce((a, b) => a + b, 0)

  const conv = stats.dealsViewed > 0 ? Math.round((stats.dealsReserved / stats.dealsViewed) * 100) : 0
  const auto = state.purchases.length
    ? Math.round((state.purchases.filter((p) => p.source === 'cpf').length / state.purchases.length) * 100)
    : 0

  const health = useMemo(() => healthScore(state), [state])
  const streak = useMemo(() => currentStreak(usage.activeDates, state.clock), [usage.activeDates, state.clock])
  const ttfv = useMemo(() => timeToFirstValueDays(state.onboardedAt, usage.firstValueAt), [state.onboardedAt, usage.firstValueAt])
  const adoption = useMemo(() => featureAdoptionRate(usage.pillarFirstUsedAt), [usage.pillarFirstUsedAt])
  const churn = useMemo(() => churnRisk(state), [state])
  const trend = useMemo(() => weeklyValueTrend(impact.events, state.clock, 8), [impact.events, state.clock])
  const csql = useMemo(() => csqlConversion(stats), [stats])
  const maxTrendKg = Math.max(0.01, ...trend.map((w) => w.kg))

  const population = useMemo(() => generatePopulation(), [])
  const pop = useMemo(() => populationSnapshot(population, POP_DAYS), [population])
  const recentCohorts = pop.cohorts.slice(-6)

  return (
    <div className="px-5 pt-5 pb-8">
      <h1 className="font-display text-[25px] leading-tight tracking-tight">{t('impact.title')}</h1>
      <p className="text-[13px] text-haze mt-1 mb-5 max-w-[38ch]">{t('impact.subtitle')}</p>

      <div className="flex gap-1 p-1 bg-bark border border-fern/40 rounded-full mb-5">
        {[['me', t('account.view.me')], ['insights', t('account.view.insights')]].map(([k, label]) => (
          <button key={k} onClick={() => setView(k)}
            className={`flex-1 rounded-full py-2 text-[13.5px] font-semibold transition-colors ${view === k ? 'bg-sage text-ink' : 'text-haze'}`}>
            {label}
          </button>
        ))}
      </div>

      {view === 'me' && (
        <>
          <div className="card px-5 py-6" data-tour-el="impact-summary">
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

          {/* NPS/CSAT pulse: a real, one-time in-app ask for this household. The
              comparison against other users lives in Account Insights, below. */}
          <div className="mt-7">
            <SectionTitle>{t('account.nps.title')}</SectionTitle>
            <div className="card px-4 py-4">
              {state.nps ? (
                <p className="text-[13.5px]">{t('account.nps.thanks', { score: state.nps.score })}</p>
              ) : (
                <>
                  <p className="text-[13px] text-haze mb-3">{t('account.nps.subtitle')}</p>
                  <div className="grid grid-cols-11 gap-1">
                    {Array.from({ length: 11 }, (_, n) => n).map((n) => (
                      <button
                        key={n}
                        className="num text-[12px] py-2 rounded-lg border border-fern/50 text-haze active:bg-moss active:text-sage"
                        onClick={() => dispatch({ type: 'submitNps', score: n })}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
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
                    <Bar frac={kg / total} />
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
        </>
      )}

      {view === 'insights' && (
        <>
          <p className="text-[12.5px] text-haze leading-relaxed -mt-1 mb-2 max-w-[42ch]">{t('account.insights.subtitle')}</p>

          {/* Customer Health Score — Hochstein et al. (2023): Product Usage 40% / Value
              Realization 40% / Relationship Quality 20%, all computed from real state. */}
          <div className="mt-6">
            <SectionTitle>{t('account.health.title')}</SectionTitle>
            <div className={`card px-5 py-5 border ${BAND_BORDER[health.band]}`}>
              <div className="flex items-end gap-3">
                <span className={`num text-[44px] leading-none ${BAND_TEXT[health.band]}`}>{health.score}</span>
                <span className="text-[13px] text-haze mb-1">/ 100 · {t(`account.health.band.${health.band}`)}</span>
              </div>
              <p className="text-[12.5px] text-haze leading-relaxed mt-3">{t('account.health.explain')}</p>
              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex justify-between text-[12.5px] mb-1.5">
                    <span>{t('account.health.usage')}</span><span className="num text-haze">{Math.round(health.usage * 100)}%</span>
                  </div>
                  <Bar frac={health.usage} />
                </div>
                <div>
                  <div className="flex justify-between text-[12.5px] mb-1.5">
                    <span>{t('account.health.value')}</span><span className="num text-haze">{Math.round(health.value * 100)}%</span>
                  </div>
                  <Bar frac={health.value} />
                </div>
                <div>
                  <div className="flex justify-between text-[12.5px] mb-1.5">
                    <span>{t('account.health.relationship')}</span><span className="num text-haze">{Math.round(health.relationship * 100)}%</span>
                  </div>
                  <Bar frac={health.relationship} />
                </div>
              </div>
            </div>
          </div>

          {/* Tier 1 — no backend needed: real, per-household usage history. */}
          <div className="mt-7">
            <SectionTitle>{t('account.usage.title')}</SectionTitle>
            <div className="card px-4 divide-y divide-fern/25">
              <Metric label={t('account.usage.sessions')} value={usage.sessions} />
              <Metric label={t('account.usage.streak')} value={t('account.usage.streak.value', { n: streak })} />
              <Metric
                label={t('account.usage.ttfv')}
                value={ttfv === null ? t('account.usage.ttfv.pending') : t('account.usage.ttfv.value', { n: ttfv })}
              />
              <Metric label={t('account.usage.adoption')} value={`${Math.round(adoption * 100)}%`} hint={`${state.stats.pillarsUsed.length}/${PILLARS.length}`} />
            </div>
          </div>

          {/* Real weekly kg-saved trend — tells actual use apart from a one-time try. */}
          <div className="mt-7">
            <SectionTitle>{t('account.trend.title')}</SectionTitle>
            <p className="text-[12.5px] text-haze -mt-2 mb-3">{t('account.trend.subtitle')}</p>
            <div className="card px-4 py-4">
              <div className="flex items-end gap-1.5 h-24">
                {trend.map((w) => (
                  <div key={w.weekStart} className="flex-1 flex flex-col items-center justify-end gap-1.5">
                    <div
                      className="w-full rounded-t-md bg-amber/80"
                      style={{ height: `${Math.max(3, Math.round((w.kg / maxTrendKg) * 100))}%` }}
                      aria-label={`${shortDate(w.weekEnd, lang)}: ${fmtQty(w.kg)} kg`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-haze mt-2 num">
                <span>{shortDate(trend[0].weekStart, lang)}</span>
                <span>{shortDate(trend[trend.length - 1].weekEnd, lang)}</span>
              </div>
            </div>
          </div>

          {/* Real churn-risk signal from actual inactivity — flag the slide before it's a loss. */}
          <div className="mt-7">
            <SectionTitle>{t('account.churn.title')}</SectionTitle>
            <div className={`card px-4 py-4 border ${BAND_BORDER[churn.band]}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[14.5px] font-semibold ${BAND_TEXT[churn.band]}`}>{t(`account.churn.band.${churn.band}`)}</span>
                <span className={`num text-[18px] ${BAND_TEXT[churn.band]}`}>{churn.score}</span>
              </div>
              <p className="text-[12.5px] text-haze leading-snug mt-2">
                {churn.daysInactive === 0 ? t('account.churn.explain.zero') : t('account.churn.explain', { n: churn.daysInactive })}
              </p>
            </div>
          </div>

          {/* CSQL: real for this household, simulated average for comparison. */}
          <div className="mt-7">
            <SectionTitle>{t('account.csql.title')}</SectionTitle>
            <div className="card px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px]">{t('account.csql.you')}</span>
                <span className="num text-[15px]">{csql === null ? '—' : `${csql}%`}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] flex items-center gap-2">{t('account.csql.avg')} <SimBadge t={t} /></span>
                <span className="num text-[15px] text-haze">{pop.csqlPct}%</span>
              </div>
              {csql === null && <p className="text-[12px] text-haze leading-snug">{t('account.csql.none')}</p>}
            </div>
          </div>

          {/* NPS pulse, from the CS side: this account's own answer plus the simulated benchmark. */}
          <div className="mt-7">
            <SectionTitle>{t('account.nps.title')}</SectionTitle>
            <div className="card px-4 py-4">
              <p className="text-[13.5px]">
                {state.nps ? t('account.nps.insights.score', { score: state.nps.score }) : t('account.nps.notyet')}
              </p>
              <p className="text-[12px] text-haze mt-2 flex items-center gap-2">
                {t('account.nps.benchmark', { nps: pop.nps, avg: pop.npsScoreAvg })} <SimBadge t={t} />
              </p>
            </div>
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

          {/* Tier 2 — genuinely needs many real users; simulated here, clearly labelled. */}
          <div className="mt-7">
            <SectionTitle right={<SimBadge t={t} />}>{t('account.bench.title')}</SectionTitle>
            <p className="text-[12px] text-haze leading-relaxed mb-3">{t('account.bench.note')}</p>
            <div className="card px-4 divide-y divide-fern/25 mb-3">
              <Metric label={t('account.bench.dau')} value={pop.dau} hint={`/${pop.size}`} />
              <Metric label={t('account.bench.wau')} value={pop.wau} hint={`/${pop.size}`} />
              <Metric label={t('account.bench.mau')} value={pop.mau} hint={`/${pop.size}`} />
              <Metric label={t('account.bench.expertise')} value={`${Math.round(pop.expertiseAvg * 4 * 10) / 10}/4`} />
              <Metric label={t('account.bench.scan')} value={`${pop.scanAdoptionPct}%`} />
            </div>

            <p className="text-[13px] mb-2.5">{t('account.bench.cohorts')}</p>
            <div className="card px-4 py-3">
              <div className="space-y-2.5">
                {recentCohorts.map((c) => {
                  const cw = Math.max(1, c.add + c.retained + c.loss + c.end)
                  return (
                    <div key={c.week}>
                      <div className="flex justify-between text-[11.5px] text-haze mb-1 num">
                        <span>{t('account.bench.week', { n: c.week + 1 })}</span>
                        <span>{c.add}+ / {c.retained} / {c.loss} / {c.end}−</span>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-fern/20">
                        <span className="bg-sage" style={{ width: `${(c.add / cw) * 100}%` }} />
                        <span className="bg-fern" style={{ width: `${(c.retained / cw) * 100}%` }} />
                        <span className="bg-amber" style={{ width: `${(c.loss / cw) * 100}%` }} />
                        <span className="bg-ember" style={{ width: `${(c.end / cw) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 mt-3.5 text-[11px] text-haze flex-wrap">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sage inline-block" />{t('account.bench.cohorts.add')}</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-fern inline-block" />{t('account.bench.cohorts.retained')}</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber inline-block" />{t('account.bench.cohorts.loss')}</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-ember inline-block" />{t('account.bench.cohorts.end')}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
