import React, { useState } from 'react'
import { useApp } from '../store.jsx'
import { NEIGHBORS, PILLARS, byId } from '../data/seed.js'
import { daysBetween, relativeWhen, qty as fmtQty, kgOf } from '../lib/logic.js'
import { Icon, Sheet, Chip, Empty, Toggle, SectionTitle } from '../components/ui.jsx'

const neighborById = (id) => NEIGHBORS.find((n) => n.id === id)

function ShareSheet({ open, onClose }) {
  const { state, dispatch, t } = useApp()
  const candidates = state.pantry
    .map((p) => ({ ...p, left: daysBetween(state.clock, p.expiry) }))
    .filter((p) => p.left <= 4)
    .sort((a, b) => a.left - b.left)

  return (
    <Sheet open={open} onClose={onClose} title={t('comm.shareTitle')} tall>
      <p className="text-[13.5px] text-haze leading-relaxed mb-4">{t('comm.shareBody')}</p>
      {candidates.length === 0 ? (
        <Empty>{t('comm.shareNone')}</Empty>
      ) : (
        <ul className="space-y-2.5">
          {candidates.map((p) => {
            const prod = byId(p.product)
            const name = prod[state.lang] || prod.en
            return (
              <li key={p.uid}>
                <button
                  className="card w-full text-left px-4 py-3.5 flex items-center gap-3.5 active:bg-bark"
                  onClick={() => {
                    dispatch({ type: 'shareItem', uid: p.uid })
                    dispatch({ type: 'toast', text: t('comm.posted', { item: name }) })
                    onClose()
                  }}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] leading-tight">{name}</span>
                    <span className="block text-[12.5px] text-haze num mt-0.5">
                      {fmtQty(p.qty)} {t(`unit.${prod.unit}`)} · {p.left < 0 ? t('common.expired') : relativeWhen(p.left, t)}
                    </span>
                  </span>
                  <span className="text-amber"><Icon.share size={18} /></span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}

export default function Community() {
  const { state, dispatch, t } = useApp()
  const [share, setShare] = useState(false)
  const [tipText, setTipText] = useState('')
  const [tipPillar, setTipPillar] = useState(null)
  const lang = state.lang
  const p = state.prefs

  const posts = [...state.community].sort((a, b) => {
    if ((a.status === 'open') !== (b.status === 'open')) return a.status === 'open' ? -1 : 1
    return new Date(b.postedOn) - new Date(a.postedOn)
  })

  // Co-creation: neighbors (and this household) contributing their own tips.
  // Newest first, like a feed, so a fresh contribution is seen right away instead
  // of starting buried under tips that have had longer to collect likes.
  const tips = [...state.tips].sort((a, b) => new Date(b.postedOn) - new Date(a.postedOn))

  return (
    <div className="px-5 pt-5 pb-8">
      <div className="mb-4">
        <h1 className="font-display text-[25px] leading-tight tracking-tight">{t('comm.title')}</h1>
        <p className="text-[13px] text-haze mt-1">{t('comm.subtitle')}</p>
      </div>

      <button className="btn-primary w-full mb-5" onClick={() => setShare(true)}>{t('comm.share')}</button>

      <div className="card px-4 py-4 mb-5">
        <p className="text-[14px] mb-2.5">{t('comm.visibility')}</p>
        <div className="flex gap-2 mb-4">
          {['building', 'block', 'neighborhood'].map((v) => (
            <Chip key={v} active={p.visibility === v} onClick={() => dispatch({ type: 'prefs', patch: { visibility: v } })}>
              {t(`comm.vis.${v}`)}
            </Chip>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[14px]">{t('comm.anon')}</span>
          <Toggle on={p.anon} onChange={(v) => dispatch({ type: 'prefs', patch: { anon: v } })} label={t('comm.anon')} />
        </div>
      </div>

      <SectionTitle>{t('comm.board')}</SectionTitle>
      {posts.length === 0 ? (
        <Empty>{t('common.empty')}</Empty>
      ) : (
        <ul className="space-y-2.5" data-tour-el="comm-board">
          {posts.map((c) => {
            const prod = byId(c.product)
            const name = prod[lang] || prod.en
            const n = c.neighbor ? neighborById(c.neighbor) : null
            const who = c.owner === 'me' ? t('comm.you') : `${n?.name} · ${n?.unit}`
            const left = daysBetween(state.clock, c.expiry)
            const claimedByName = c.claimedBy && c.claimedBy !== 'me' ? neighborById(c.claimedBy)?.name : null
            return (
              <li key={c.id} className={`card px-4 py-3.5 ${c.status !== 'open' ? 'opacity-55' : ''}`}>
                <div className="flex items-start gap-3.5">
                  <span className="w-10 h-10 rounded-full bg-moss grid place-items-center shrink-0 text-haze">
                    <Icon.users size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15.5px] font-semibold leading-tight">
                      {name}
                      <span className="num text-haze font-normal"> · {fmtQty(c.qty)} {t(`unit.${prod.unit}`)}</span>
                    </p>
                    <p className="text-[12.5px] text-haze mt-0.5">
                      {t('comm.from', { who: c.owner === 'me' && p.anon ? t('comm.anon') : who })}
                      {' · '}
                      <span className={left <= 1 ? 'text-amber' : ''}>{left < 0 ? t('common.expired') : relativeWhen(left, t)}</span>
                    </p>
                    {c.note && <p className="text-[13px] text-haze/90 mt-1.5 leading-snug">{c.note}</p>}
                    {n && c.status === 'open' && c.owner !== 'me' && (
                      <p className="text-[12px] text-haze mt-1.5">{t('comm.pickup', { place: n.place })}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {c.owner === 'me' ? (
                      <span className="text-[11.5px] border border-fern rounded-full px-2.5 py-1 text-haze">
                        {c.status === 'open' ? t('comm.mine') : claimedByName || t('comm.claimed')}
                      </span>
                    ) : c.status === 'open' ? (
                      <button
                        className="text-[12.5px] bg-sage text-ink rounded-full px-3 py-1.5 font-semibold"
                        onClick={() => {
                          dispatch({ type: 'claimPost', id: c.id, label: name })
                          dispatch({ type: 'toast', text: t('comm.claimedToast', { neighbor: n?.name || '' }) })
                        }}
                      >
                        {t('comm.claim')}
                      </button>
                    ) : (
                      <span className="text-[11.5px] border border-fern rounded-full px-2.5 py-1 text-haze">{t('comm.claimed')}</span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Co-creation (Brodie FP1): neighbors contribute their own tips instead of only
          consuming what the app posts — real local state, no backend needed. */}
      <div className="mt-7">
        <SectionTitle>{t('comm.tips.title')}</SectionTitle>
        <p className="text-[12.5px] text-haze -mt-2 mb-3 max-w-[38ch]">{t('comm.tips.subtitle')}</p>

        <div className="card px-4 py-4 mb-3">
          <textarea
            value={tipText}
            onChange={(e) => setTipText(e.target.value)}
            placeholder={t('comm.tips.placeholder')}
            rows={2}
            className="w-full bg-transparent text-[14px] placeholder:text-haze/70 resize-none outline-none"
          />
          <div className="flex gap-1.5 flex-wrap mt-2.5 mb-3.5">
            {[null, ...PILLARS].map((pl) => (
              <Chip key={pl || 'none'} active={tipPillar === pl} onClick={() => setTipPillar(pl)}>
                {pl ? t(`pillar.${pl}.short`) : t('comm.tips.pillar.none')}
              </Chip>
            ))}
          </div>
          <button
            className="btn-primary w-full py-2.5 text-[13.5px] disabled:opacity-35"
            disabled={!tipText.trim()}
            onClick={() => {
              dispatch({ type: 'addTip', text: tipText, pillar: tipPillar })
              setTipText('')
              setTipPillar(null)
            }}
          >
            {t('comm.tips.submit')}
          </button>
        </div>

        {tips.length === 0 ? (
          <Empty>{t('comm.tips.empty')}</Empty>
        ) : (
          <ul className="space-y-2.5" data-tour-el="comm-tips">
            {tips.map((tp) => {
              const n = tp.mine ? null : neighborById(tp.neighbor)
              const who = tp.mine ? t('comm.tips.mine') : (n?.name || '')
              const ago = daysBetween(state.clock, tp.postedOn)
              return (
                <li key={tp.id} className="card px-4 py-3.5">
                  <p className="text-[12px] text-haze">
                    {who}
                    {tp.pillar && <> · {t(`pillar.${tp.pillar}.short`)}</>}
                    {' · '}{relativeWhen(ago, t)}
                  </p>
                  <p className="text-[14px] leading-snug mt-1">{tp.text}</p>
                  <button
                    className={`mt-2.5 flex items-center gap-1.5 text-[12.5px] ${tp.likedByMe ? 'text-amber' : 'text-haze'}`}
                    onClick={() => dispatch({ type: 'likeTip', id: tp.id })}
                  >
                    <Icon.heart size={15} fill={tp.likedByMe ? 'currentColor' : 'none'} />
                    {tp.likes}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ShareSheet open={share} onClose={() => setShare(false)} />
    </div>
  )
}
