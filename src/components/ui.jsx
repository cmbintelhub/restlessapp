import React, { useEffect } from 'react'

const S = ({ children, size = 20, ...p }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
)

export const Icon = {
  leaf: (p) => <S {...p}><path d="M4 20c0-8 6-13 16-14 0 10-5 15-13 15H4Z" /><path d="M4 20c3-5 7-8 11-9.5" /></S>,
  basket: (p) => <S {...p}><path d="M4 9h16l-1.6 9.2A2 2 0 0 1 16.4 20H7.6a2 2 0 0 1-2-1.8L4 9Z" /><path d="M8.5 9 11 4M15.5 9 13 4" /><path d="M9.5 13v3M14.5 13v3" /></S>,
  radar: (p) => <S {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><path d="M12 12 18 7" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></S>,
  scale: (p) => <S {...p}><path d="M12 4v16M7 20h10" /><path d="M4 9h16" /><path d="M4 9 1.8 14a3 3 0 0 0 4.4 0L4 9Z" /><path d="M20 9l-2.2 5a3 3 0 0 0 4.4 0L20 9Z" /></S>,
  users: (p) => <S {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 5.5a3.2 3.2 0 0 1 0 6.2M17.5 20c0-2.6-1-4.4-2.5-5.3" /></S>,
  home: (p) => <S {...p}><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></S>,
  bell: (p) => <S {...p}><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" /><path d="M10 18a2 2 0 0 0 4 0" /></S>,
  cog: (p) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2M12 19.2v2M4.2 7.5l1.7 1M18.1 15.5l1.7 1M4.2 16.5l1.7-1M18.1 8.5l1.7-1" /></S>,
  filter: (p) => <S {...p}><path d="M4 6h16M7 12h10M10 18h4" /></S>,
  pin: (p) => <S {...p}><path d="M12 21s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.3" /></S>,
  plus: (p) => <S {...p}><path d="M12 5v14M5 12h14" /></S>,
  minus: (p) => <S {...p}><path d="M5 12h14" /></S>,
  check: (p) => <S {...p}><path d="m5 12.5 4.5 4.5L19 7" /></S>,
  x: (p) => <S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>,
  chevron: (p) => <S {...p}><path d="m9 6 6 6-6 6" /></S>,
  arrowLeft: (p) => <S {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></S>,
  drag: (p) => <S {...p}><path d="M8 7h.01M8 12h.01M8 17h.01M16 7h.01M16 12h.01M16 17h.01" strokeWidth="2.4" /></S>,
  receipt: (p) => <S {...p}><path d="M6 3h12v18l-3-1.6-3 1.6-3-1.6L6 21V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></S>,
  flask: (p) => <S {...p}><path d="M10 3v6.5L4.8 18A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-3L14 9.5V3" /><path d="M9 3h6M7.5 15h9" /></S>,
  clock: (p) => <S {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></S>,
  gift: (p) => <S {...p}><path d="M4 11h16v9H4z" /><path d="M2.5 7.5h19V11h-19z" /><path d="M12 7.5V20" /><path d="M12 7.5S10.5 3.5 8.2 4.3C6.4 4.9 7 7.5 12 7.5Zm0 0s1.5-4 3.8-3.2c1.8.6 1.2 3.2-3.8 3.2Z" /></S>,
  trash: (p) => <S {...p}><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></S>,
  share: (p) => <S {...p}><circle cx="17" cy="6" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="17" cy="18" r="2.5" /><path d="m8.3 10.8 6.4-3.4M8.3 13.2l6.4 3.4" /></S>,
  search: (p) => <S {...p}><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></S>,
  chat: (p) => <S {...p}><path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17.5h-1A1.5 1.5 0 0 1 3 16V7a1.5 1.5 0 0 1 1.5-1.5Z" /><path d="M8 10.5h8M8 13.5h5" /></S>,
  send: (p) => <S {...p}><path d="M4 12 20 4l-6 16-2.5-6.5L4 12Z" /><path d="m11.5 13.5 3-3" /></S>,
  spark: (p) => <S {...p}><path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" /></S>,
}

export function Sheet({ open, onClose, title, children, tall = false, footer = null, bodyRef = null }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="absolute inset-0 z-[1200] flex flex-col justify-end">
      <button aria-label="close" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        className={`sheet-up relative bg-moss rounded-t-[26px] border-t border-x border-fern/60 ${tall ? 'max-h-[92%]' : 'max-h-[82%]'} flex flex-col`}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <h2 className="font-display text-[19px] leading-tight pr-4">{title}</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-haze hover:text-sage" aria-label="close">
            <Icon.x />
          </button>
        </div>
        <div ref={bodyRef} className={`overflow-y-auto no-scrollbar px-5 ${footer ? 'pb-4 flex-1 min-h-0' : 'pb-8'}`}>{children}</div>
        {footer && <div className="shrink-0 border-t border-fern/40 px-4 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}

export function Stepper({ value, min = 0, max = 12, onChange, label }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[15px]">{label}</span>
      <div className="flex items-center gap-1">
        <button
          className="w-9 h-9 rounded-full border border-fern grid place-items-center disabled:opacity-30"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`${label} −`}
        ><Icon.minus size={16} /></button>
        <span className="num w-8 text-center text-[19px]">{value}</span>
        <button
          className="w-9 h-9 rounded-full border border-fern grid place-items-center disabled:opacity-30"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`${label} +`}
        ><Icon.plus size={16} /></button>
      </div>
    </div>
  )
}

export function Chip({ active, children, onClick, tone = 'default' }) {
  const base = active
    ? tone === 'amber'
      ? 'bg-amber text-ink border-amber'
      : 'bg-sage text-ink border-sage'
    : 'border-fern text-haze hover:text-sage'
  return (
    <button onClick={onClick} className={`chip ${base}`} aria-pressed={!!active}>
      {children}
    </button>
  )
}

export function Field({ label, hint, children }) {
  return (
    <div className="py-3.5">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-[15px]">{label}</span>
        {hint && <span className="text-[13px] text-haze num">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function Toggle({ on, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`w-12 h-7 rounded-full border transition-colors shrink-0 ${on ? 'bg-pine border-pine' : 'bg-ink border-fern'}`}
      aria-label={label}
    >
      <span className={`block w-5 h-5 rounded-full bg-sage transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export function Empty({ children }) {
  return (
    <div className="border border-dashed border-fern/60 rounded-2xl px-5 py-8 text-center text-[14px] text-haze leading-relaxed">
      {children}
    </div>
  )
}

export function SectionTitle({ children, right }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <h2 className="font-display text-[17px] leading-none">{children}</h2>
      {right}
    </div>
  )
}
