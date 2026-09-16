import React, { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApp, useDerived } from '../store.jsx'
import { CATEGORIES, HOME, byId, storeById } from '../data/seed.js'
import {
  distanceFromHome, daysBetween, relativeWhen, discountPct, money, qty as fmtQty, kgOf,
} from '../lib/logic.js'
import { Icon, Sheet, Chip, Empty, Field } from '../components/ui.jsx'

/** A deterministic block pattern that reads as a Pix QR without pretending to be one. */
function FakeQR({ seed = 'restless', size = 168 }) {
  const n = 25
  const cells = useMemo(() => {
    let h = 2166136261
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
    const out = []
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        h ^= h << 13; h ^= h >>> 17; h ^= h << 5
        const inFinder =
          (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7)
        if (inFinder) continue
        if ((h >>> 0) % 100 < 46) out.push([x, y])
      }
    }
    return out
  }, [seed])
  const s = size / n
  const finder = (fx, fy) => (
    <g key={`f${fx}${fy}`}>
      <rect x={fx * s} y={fy * s} width={7 * s} height={7 * s} fill="#0E1712" />
      <rect x={(fx + 1) * s} y={(fy + 1) * s} width={5 * s} height={5 * s} fill="#E4EAD9" />
      <rect x={(fx + 2) * s} y={(fy + 2) * s} width={3 * s} height={3 * s} fill="#0E1712" />
    </g>
  )
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Pix code">
      <rect width={size} height={size} fill="#E4EAD9" rx="10" />
      {cells.map(([x, y], i) => (
        <rect key={i} x={x * s} y={y * s} width={s} height={s} fill="#0E1712" />
      ))}
      {finder(0, 0)}{finder(n - 7, 0)}{finder(0, n - 7)}
    </svg>
  )
}

function DealMap({ deals, onPick, lang, t }) {
  const ref = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)

  useEffect(() => {
    if (mapRef.current || !ref.current) return
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true })
      .setView([HOME.lat, HOME.lng], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    L.marker([HOME.lat, HOME.lng], {
      icon: L.divIcon({
        className: '',
        html: `<span style="display:block;width:16px;height:16px;border-radius:99px;background:#E4EAD9;border:3px solid #2C5233;box-shadow:0 0 0 6px rgba(228,234,217,.18)"></span>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      }),
    }).addTo(map).bindPopup(`<b>${t('radar.mapMe')}</b>`)
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    setTimeout(() => map.invalidateSize(), 60)
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    const grouped = {}
    for (const d of deals) (grouped[d.store] ||= []).push(d)
    for (const [storeId, list] of Object.entries(grouped)) {
      const st = storeById(storeId)
      const best = Math.max(...list.map((d) => discountPct(d.from, d.to)))
      const marker = L.marker([st.lat, st.lng], {
        icon: L.divIcon({
          className: '',
          html: `<span style="display:flex;align-items:center;justify-content:center;min-width:34px;height:26px;padding:0 6px;border-radius:99px;background:#C97A1F;color:#0E1712;font:600 12px/1 Archivo,system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.45)">-${best}%</span>`,
          iconSize: [34, 26], iconAnchor: [17, 13],
        }),
      })
      const names = list.map((d) => {
        const p = byId(d.product)
        return `${p[lang] || p.en} · ${money(d.to)}`
      }).join('<br>')
      marker.bindPopup(`<b>${st.name}</b><br>${names}`)
      marker.on('click', () => onPick(list[0]))
      layer.addLayer(marker)
    }
  }, [deals, lang])

  return <div ref={ref} className="h-[320px] rounded-2xl overflow-hidden border border-fern/40" />
}

function FiltersSheet({ open, onClose }) {
  const { state, dispatch, t } = useApp()
  const p = state.prefs
  const setP = (patch) => dispatch({ type: 'prefs', patch })
  const toggleCat = (c) =>
    setP({ categories: p.categories.includes(c) ? p.categories.filter((x) => x !== c) : [...p.categories, c] })

  return (
    <Sheet open={open} onClose={onClose} title={t('radar.filters')}>
      <Field label={t('radar.radius')} hint={`${p.radius} km`}>
        <input type="range" min="1" max="10" step="1" value={p.radius}
          onChange={(e) => setP({ radius: +e.target.value })} className="w-full" />
      </Field>
      <Field label={t('radar.minDiscount')} hint={`${p.minDiscount}%`}>
        <input type="range" min="0" max="70" step="5" value={p.minDiscount}
          onChange={(e) => setP({ minDiscount: +e.target.value })} className="w-full" />
      </Field>
      <Field label={t('radar.categories')}>
        <div className="flex flex-wrap gap-2">
          <Chip active={p.categories.length === 0} onClick={() => setP({ categories: [] })}>{t('common.all')}</Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={p.categories.includes(c)} onClick={() => toggleCat(c)}>{t(`cat.${c}`)}</Chip>
          ))}
        </div>
      </Field>
      <button className="btn-primary w-full mt-5" onClick={onClose}>{t('common.done')}</button>
    </Sheet>
  )
}

function DealSheet({ deal, onClose }) {
  const { state, dispatch, t } = useApp()
  const [paying, setPaying] = useState(false)
  const [usePoints, setUsePoints] = useState(false)
  if (!deal) return null
  const prod = byId(deal.product)
  const st = storeById(deal.store)
  const name = prod[state.lang] || prod.en
  const left = daysBetween(state.clock, deal.expiry)
  const canPoints = state.impact.points >= 100
  const total = Math.max(0, deal.to - (usePoints && canPoints ? 5 : 0))

  function confirm() {
    const kg = kgOf(deal.product, deal.qty)
    dispatch({ type: 'reserveDeal', id: deal.id, usePoints: usePoints && canPoints, label: `${name} · ${st.name}` })
    dispatch({ type: 'toast', text: t('radar.paid', { kg: fmtQty(kg) }) })
    setPaying(false)
    onClose()
  }

  return (
    <Sheet open={!!deal} onClose={onClose} title={paying ? t('radar.payTitle') : name}>
      {!paying ? (
        <>
          <p className="text-[13.5px] text-haze">
            {st.name} · {t('radar.away', { km: fmtQty(distanceFromHome(st)) })}
          </p>
          <div className="mt-4 flex items-end gap-3">
            <span className="num text-[34px] leading-none text-amber">{money(deal.to)}</span>
            <span className="num text-[15px] text-haze line-through mb-0.5">{money(deal.from)}</span>
            <span className="num text-[13px] bg-amber text-ink rounded-full px-2 py-1 mb-0.5">
              -{discountPct(deal.from, deal.to)}%
            </span>
          </div>
          <p className="mt-2 text-[13.5px] num">
            {fmtQty(deal.qty)} {t(`unit.${prod.unit}`)} · {t('radar.expiresIn', { when: relativeWhen(left, t) })}
          </p>
          <p className="mt-4 text-[13px] text-haze">{t('radar.pickup', { store: st.name, time: st.until })}</p>

          {canPoints && (
            <button
              onClick={() => setUsePoints(!usePoints)}
              className={`mt-4 w-full text-left card px-4 py-3 flex items-center gap-3 ${usePoints ? 'border-amber/60' : ''}`}
            >
              <span className={usePoints ? 'text-amber' : 'text-haze'}><Icon.gift size={18} /></span>
              <span className="text-[13.5px] flex-1">{t('radar.usePoints', { n: 100, value: '5,00' })}</span>
              {usePoints && <span className="text-amber"><Icon.check size={16} /></span>}
            </button>
          )}

          <button className="btn-primary w-full mt-5" onClick={() => setPaying(true)}>
            {t('radar.reserve')} · {money(total)}
          </button>
        </>
      ) : (
        <div className="text-center">
          <p className="text-[13.5px] text-haze leading-relaxed mb-5">{t('radar.payBody')}</p>
          <div className="inline-block p-3 bg-sage rounded-2xl"><FakeQR seed={deal.id + deal.product} /></div>
          <p className="mt-5 text-[14px] text-haze">{t('radar.total')}</p>
          <p className="num text-[30px] leading-none mt-1">{money(total)}</p>
          <button className="btn-primary w-full mt-6" onClick={confirm}>{t('radar.pay')}</button>
          <button className="btn-ghost w-full mt-2.5" onClick={() => setPaying(false)}>{t('common.back')}</button>
        </div>
      )}
    </Sheet>
  )
}

export default function Radar() {
  const { state, dispatch, t } = useApp()
  const { listProducts, pantryByProduct } = useDerived()
  const [view, setView] = useState('list')
  const [filters, setFilters] = useState(false)
  const [picked, setPicked] = useState(null)
  const lang = state.lang
  const p = state.prefs

  const deals = useMemo(() => {
    return state.deals
      .filter((d) => d.status === 'open')
      .map((d) => {
        const st = storeById(d.store)
        const prod = byId(d.product)
        return {
          ...d,
          dist: distanceFromHome(st),
          pct: discountPct(d.from, d.to),
          cat: prod.cat,
          match: listProducts.has(d.product),
        }
      })
      .filter((d) => d.dist <= p.radius && d.pct >= p.minDiscount)
      .filter((d) => p.categories.length === 0 || p.categories.includes(d.cat))
      .sort((a, b) => (b.match ? 1 : 0) - (a.match ? 1 : 0) || a.dist - b.dist)
  }, [state.deals, p.radius, p.minDiscount, p.categories, listProducts, pantryByProduct])

  function open(d) {
    dispatch({ type: 'viewDeal' })
    setPicked(d)
  }

  return (
    <div className="px-5 pt-5 pb-8">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-[25px] leading-tight tracking-tight">{t('radar.title')}</h1>
          <p className="text-[13px] text-haze mt-1 max-w-[34ch]">{t('radar.subtitle')}</p>
        </div>
        <button className="p-2.5 -mr-2 text-haze active:text-sage" onClick={() => setFilters(true)} aria-label={t('radar.filters')}>
          <Icon.filter />
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-bark border border-fern/40 rounded-full mb-4">
        {[['list', t('radar.list')], ['map', t('radar.map')]].map(([k, label]) => (
          <button key={k} onClick={() => setView(k)}
            className={`flex-1 rounded-full py-2 text-[14px] font-semibold transition-colors ${view === k ? 'bg-sage text-ink' : 'text-haze'}`}>
            {label}
          </button>
        ))}
      </div>

      {view === 'map' && (
        <div className="mb-4">
          <DealMap deals={deals} onPick={open} lang={lang} t={t} />
        </div>
      )}

      {deals.length === 0 ? (
        <Empty>{t('radar.none')}</Empty>
      ) : (
        <ul className="space-y-2.5" data-tour-el="radar-deals">
          {deals.map((d) => {
            const prod = byId(d.product)
            const st = storeById(d.store)
            const left = daysBetween(state.clock, d.expiry)
            return (
              <li key={d.id}>
                <button onClick={() => open(d)} className={`card w-full text-left px-4 py-3.5 flex items-center gap-3.5 active:bg-moss ${d.match ? 'border-amber/50' : ''}`}>
                  <span className="shrink-0 w-12 h-12 rounded-xl bg-moss grid place-items-center num text-[13px] text-amber font-semibold">
                    -{d.pct}%
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15.5px] font-semibold leading-tight truncate">{prod[lang] || prod.en}</span>
                    <span className="block text-[12.5px] text-haze num mt-0.5 truncate">
                      {st.name} · {t('radar.away', { km: fmtQty(d.dist) })}
                    </span>
                    <span className="block text-[12.5px] num mt-0.5">
                      <span className="text-amber">{money(d.to)}</span>
                      <span className="text-haze line-through ml-1.5">{money(d.from)}</span>
                      <span className="text-haze"> · {t('radar.expiresIn', { when: relativeWhen(left, t) })}</span>
                    </span>
                    {d.match && <span className="inline-block mt-1.5 text-[11.5px] border border-amber/50 text-amber rounded-full px-2 py-0.5">{t('radar.matching')}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <FiltersSheet open={filters} onClose={() => setFilters(false)} />
      <DealSheet deal={picked} onClose={() => setPicked(null)} />
    </div>
  )
}
