import React from 'react'
import { useApp } from '../store.jsx'
import { bmi, personFactor, eaters, newPerson, peopleOf } from '../lib/logic.js'
import { Stepper, Chip, Field } from './ui.jsx'

const count = (people, kind) => people.filter((p) => p.kind === kind).length

/** Keeps adults before children so the printed labels stay stable while editing. */
function resize(people, kind, next) {
  const same = people.filter((p) => p.kind === kind)
  const other = people.filter((p) => p.kind !== kind)
  let list = same.slice(0, next)
  while (list.length < next) list.push(newPerson(kind))
  const adults = kind === 'adult' ? list : other.filter((p) => p.kind === 'adult')
  const children = kind === 'child' ? list : other.filter((p) => p.kind === 'child')
  return [...adults, ...children]
}

function PersonCard({ person, label, onChange }) {
  const { t } = useApp()
  const index = bmi(person)
  const share = personFactor(person)

  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold">{label}</span>
        <span className="num text-[12.5px] text-haze">{t('onb.house.bmi', { v: index.toLocaleString('pt-BR') })}</span>
      </div>

      <div className="flex gap-2 mt-2.5">
        {['light', 'normal', 'big'].map((a) => (
          <Chip key={a} active={person.appetite === a} onClick={() => onChange({ ...person, appetite: a })}>
            {t(`onb.house.appetite.${a}`)}
          </Chip>
        ))}
      </div>

      <Field label={t('onb.house.height')} hint={`${person.height} cm`}>
        <input
          type="range" min="90" max="210" step="1" value={person.height} className="w-full"
          onChange={(e) => onChange({ ...person, height: +e.target.value })}
          aria-label={`${label} · ${t('onb.house.height')}`}
        />
      </Field>
      <Field label={t('onb.house.weight')} hint={`${person.weight} kg`}>
        <input
          type="range" min="10" max="180" step="1" value={person.weight} className="w-full"
          onChange={(e) => onChange({ ...person, weight: +e.target.value })}
          aria-label={`${label} · ${t('onb.house.weight')}`}
        />
      </Field>

      <p className="text-[12.5px] text-haze num mt-1">
        {t('onb.house.portion', { v: share.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) })}
      </p>
    </div>
  )
}

export default function HouseholdEditor() {
  const { state, dispatch, t } = useApp()
  const h = state.household
  const people = peopleOf(h)
  const setPeople = (next) => dispatch({ type: 'household', patch: { people: next } })

  const toggleDiet = (d) =>
    dispatch({
      type: 'household',
      patch: { diets: h.diets.includes(d) ? h.diets.filter((x) => x !== d) : [...h.diets, d] },
    })

  let adultN = 0
  let childN = 0

  return (
    <>
      <div className="card px-4 divide-y divide-fern/30">
        <div className="py-3.5">
          <Stepper
            label={t('onb.house.adults')} value={count(people, 'adult')} min={1} max={8}
            onChange={(v) => setPeople(resize(people, 'adult', v))}
          />
        </div>
        <div className="py-3.5">
          <Stepper
            label={t('onb.house.children')} value={count(people, 'child')} min={0} max={8}
            onChange={(v) => setPeople(resize(people, 'child', v))}
          />
        </div>
      </div>

      <p className="text-[12.5px] text-haze leading-snug mt-3 mb-2.5">{t('onb.house.mathHint')}</p>

      <div className="space-y-2.5">
        {people.map((p, i) => {
          const label =
            p.kind === 'adult'
              ? t('onb.house.adult', { n: ++adultN })
              : t('onb.house.child', { n: ++childN })
          return (
            <PersonCard
              key={`${p.kind}-${i}`}
              person={p}
              label={label}
              onChange={(next) => setPeople(people.map((x, j) => (j === i ? next : x)))}
            />
          )
        })}
      </div>

      <p className="text-[13px] text-haze num mt-3">
        {t('onb.house.total', { v: eaters(h).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) })}
      </p>

      <div className="card px-4 py-4 mt-3">
        <p className="text-[15px] mb-2.5">{t('onb.house.diet')}</p>
        <div className="flex flex-wrap gap-2">
          {['vegetarian', 'lactose', 'gluten'].map((d) => (
            <Chip key={d} active={h.diets.includes(d)} onClick={() => toggleDiet(d)}>
              {t(`onb.house.diet.${d}`)}
            </Chip>
          ))}
        </div>
      </div>
    </>
  )
}
