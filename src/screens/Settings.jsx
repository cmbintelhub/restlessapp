import React, { useState } from 'react'
import { useApp } from '../store.jsx'
import { Icon, Sheet, Chip, Toggle, Field, SectionTitle } from '../components/ui.jsx'
import HouseholdEditor from '../components/HouseholdEditor.jsx'
import { RankList } from './Onboarding.jsx'

export default function Settings({ open, onClose }) {
  const { state, dispatch, t } = useApp()
  const [confirmReset, setConfirmReset] = useState(false)
  const h = state.household
  const p = state.prefs
  const setH = (patch) => dispatch({ type: 'household', patch })
  const setP = (patch) => dispatch({ type: 'prefs', patch })
  const toggleDiet = (d) =>
    setH({ diets: h.diets.includes(d) ? h.diets.filter((x) => x !== d) : [...h.diets, d] })

  return (
    <Sheet open={open} onClose={onClose} title={t('set.title')} tall>
      <SectionTitle>{t('set.language')}</SectionTitle>
      <div className="flex gap-2 mb-6">
        {[['en', 'English'], ['pt', 'Português']].map(([k, label]) => (
          <Chip key={k} active={state.lang === k} onClick={() => dispatch({ type: 'lang', lang: k })}>{label}</Chip>
        ))}
      </div>

      <SectionTitle>{t('set.household')}</SectionTitle>
      <div className="mb-6"><HouseholdEditor /></div>

      <SectionTitle>{t('set.priorities')}</SectionTitle>
      <div className="mb-6">
        <RankList order={p.ranking} setOrder={(r) => setP({ ranking: r })} t={t} />
      </div>

      <SectionTitle>{t('set.quantity')}</SectionTitle>
      <div className="card px-4 py-4 mb-6">
        <div className="flex gap-2 mb-3">
          {['conservative', 'balanced', 'aggressive'].map((r) => (
            <Chip key={r} active={p.rounding === r} onClick={() => setP({ rounding: r })}>{t(`set.rounding.${r}`)}</Chip>
          ))}
        </div>
        <p className="text-[13px] text-haze leading-snug">{t('set.rounding.hint')}</p>
      </div>

      <SectionTitle>{t('set.radar')}</SectionTitle>
      <div className="card px-4 divide-y divide-fern/30 mb-6">
        <Field label={t('radar.radius')} hint={`${p.radius} km`}>
          <input type="range" min="1" max="10" step="1" value={p.radius} onChange={(e) => setP({ radius: +e.target.value })} className="w-full" />
        </Field>
        <Field label={t('radar.minDiscount')} hint={`${p.minDiscount}%`}>
          <input type="range" min="0" max="70" step="5" value={p.minDiscount} onChange={(e) => setP({ minDiscount: +e.target.value })} className="w-full" />
        </Field>
        <Field label={t('set.channel')}>
          <div className="flex gap-2">
            {['push', 'whatsapp', 'both'].map((c) => (
              <Chip key={c} active={p.channel === c} onClick={() => setP({ channel: c })}>{t(`set.channel.${c}`)}</Chip>
            ))}
          </div>
        </Field>
        <Field label={t('set.quiet')} hint={`${String(p.quiet.from).padStart(2, '0')}:00 – ${String(p.quiet.to).padStart(2, '0')}:00`}>
          <input type="range" min="18" max="23" step="1" value={p.quiet.from}
            onChange={(e) => setP({ quiet: { ...p.quiet, from: +e.target.value } })} className="w-full" />
        </Field>
      </div>

      <SectionTitle>{t('set.capture')}</SectionTitle>
      <div className="card px-4 py-4 mb-6 flex items-center gap-4">
        <span className="flex-1">
          <span className="block text-[15px]">{t('set.cpf')}</span>
          <span className="block text-[13px] text-haze mt-0.5">{h.cpf ? t('set.cpfOn') : t('set.cpfOff')}</span>
        </span>
        <Toggle on={h.cpf} onChange={(v) => setH({ cpf: v })} label={t('set.cpf')} />
      </div>

      <SectionTitle>{t('set.demo')}</SectionTitle>
      <div className="card px-4 py-4">
        <p className="text-[13px] text-haze leading-snug mb-3">{t('set.resetHint')}</p>
        {!confirmReset ? (
          <button className="btn-ghost w-full border-ember/60 text-ember py-2.5 text-[14px]" onClick={() => setConfirmReset(true)}>
            {t('set.reset')}
          </button>
        ) : (
          <div className="flex gap-2.5">
            <button className="btn-ghost flex-1 py-2.5 text-[14px]" onClick={() => setConfirmReset(false)}>{t('common.cancel')}</button>
            <button
              className="btn flex-1 bg-ember text-sage py-2.5 text-[14px] font-semibold"
              onClick={() => { dispatch({ type: 'reset' }); onClose() }}
            >
              {t('set.resetConfirm')}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
