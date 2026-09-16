import React, { useLayoutEffect, useState } from 'react'

/** Which real on-screen element each pillar's tour step spotlights, keyed by pillar id. */
const FOCUS_TARGET = {
  planner: 'planner-actions',
  quantity: 'planner-tabs',
  radar: 'radar-deals',
  community: 'comm-board',
}

/**
 * Builds the step sequence for the post-onboarding guided tour: an intro card,
 * one spotlight step per pillar in the user's own ranking, a step on the Impact
 * tab (which every pillar feeds but which isn't itself a pillar), a step pointing
 * at the assistant in the header, and a closing card. Each pillar/impact/chatbot
 * step carries a `target` — a real element on that screen — so the tour goes into
 * the screen and explains what's actually there, not just the nav icon.
 */
export function buildTourSteps(ranking, goFor) {
  return [
    { kind: 'intro' },
    ...ranking.map((pillar) => ({ kind: 'pillar', pillar, tab: goFor(pillar), target: FOCUS_TARGET[pillar] })),
    { kind: 'impact', tab: 'impact', target: 'impact-summary' },
    { kind: 'chatbot', tab: 'home', target: 'header-chat' },
    { kind: 'outro', tab: 'home' },
  ]
}

/**
 * Full-screen coach-mark overlay. For a 'pillar'/'impact' step it dims everything except
 * one real, functional element on the current screen — found via [data-tour-el], falling
 * back to the bottom-nav icon (via [data-tour-nav]) if that element isn't on screen right
 * now — and floats an explanation of what it does and what messages appear there next to
 * it. For 'intro'/'outro' it shows a centered card. The real screen underneath is left
 * untouched, so what the caption describes is what's on screen.
 */
export default function Tour({ steps, index, containerRef, onNext, onSkip, t }) {
  const step = steps[index]
  const isCard = step?.kind === 'intro' || step?.kind === 'outro'
  const [rect, setRect] = useState(null)

  useLayoutEffect(() => {
    if (isCard || !step?.tab || !containerRef.current) {
      setRect(null)
      return
    }
    // Switching tabs happens in a passive effect one level up (in App), so the screen
    // this step wants to point at may not have mounted yet on the first paint after the
    // step changes. Retry across a few frames before giving up on the in-screen target
    // and falling back to the always-present nav icon.
    let cancelled = false
    let rafId = null
    let tries = 0
    const attempt = () => {
      if (cancelled) return
      const cont = containerRef.current
      if (!cont) { setRect(null); return }
      const el = step.target && cont.querySelector(`[data-tour-el="${step.target}"]`)
      if (!el && step.target && tries < 30) {
        tries += 1
        rafId = requestAnimationFrame(attempt)
        return
      }
      const target = el || cont.querySelector(`[data-tour-nav="${step.tab}"]`)
      if (!target) {
        setRect(null)
        return
      }
      const nb = target.getBoundingClientRect()
      const cb = cont.getBoundingClientRect()
      // The card used to always sit above the target. When the target itself sits near
      // the top of the screen (the pantry/list toggle, say), "above" leaves so little
      // room that a multi-line explanation gets pushed off the top edge entirely. So
      // measure the space on both sides and put the card wherever there's more of it.
      const spaceAbove = nb.top - cb.top
      const spaceBelow = cb.bottom - nb.bottom
      const place = spaceBelow > spaceAbove ? 'below' : 'above'
      setRect({
        top: nb.top - cb.top,
        left: nb.left - cb.left,
        width: nb.width,
        height: nb.height,
        place,
        // Distance from the container's own bottom edge up to the target's top,
        // so an 'above' card can anchor by `bottom` and grow upward without ever
        // covering the spotlight, whatever its own height turns out to be.
        bottomGap: cb.bottom - nb.top,
        // Distance from the container's own top edge down to the target's bottom,
        // for a 'below' card anchored by `top` instead.
        topGap: nb.bottom - cb.top,
        // Cap the card to the space it actually has on its chosen side, minus a
        // small margin, so a long explanation scrolls inside itself instead of
        // running off the screen.
        avail: Math.max(140, (place === 'below' ? spaceBelow : spaceAbove) - 28),
      })
    }
    attempt()
    window.addEventListener('resize', attempt)
    return () => {
      cancelled = true
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', attempt)
    }
  }, [step, containerRef])

  if (!step) return null

  const last = index === steps.length - 1
  const tourLen = steps.length - 2 // excludes intro + outro

  let title, body
  if (step.kind === 'intro') {
    title = t('onb.tour.introTitle')
    body = t('onb.tour.introBody')
  } else if (step.kind === 'outro') {
    title = t('onb.tour.doneTitle')
    body = t('onb.tour.doneBody')
  } else if (step.kind === 'impact') {
    title = t('onb.tour.focus.impact.title')
    body = t('onb.tour.focus.impact.body')
  } else if (step.kind === 'chatbot') {
    title = t('onb.tour.focus.chatbot.title')
    body = t('onb.tour.focus.chatbot.body')
  } else {
    title = t(`onb.tour.focus.${step.pillar}.title`)
    body = t(`onb.tour.focus.${step.pillar}.body`)
  }

  const primaryLabel = step.kind === 'intro' ? t('onb.tour.start') : last ? t('onb.tour.done') : t('onb.tour.next')

  return (
    <div className="absolute inset-0 z-[1500] pointer-events-none" role="dialog" aria-label={title}>
      {rect ? (
        <div
          className="absolute rounded-2xl"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(4,10,6,0.72)',
            outline: '2px solid rgba(201,122,31,0.9)',
            transition: 'top 220ms ease, left 220ms ease',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-ink/85" />
      )}

      <div
        className={`absolute pointer-events-auto ${isCard ? 'inset-0 flex items-center justify-center px-8' : 'left-4 right-4'}`}
        style={
          isCard
            ? undefined
            : rect?.place === 'below'
              ? { top: rect.topGap + 14 }
              : { bottom: (rect?.bottomGap ?? 90) + 14 }
        }
      >
        <div
          className="card bg-moss border-amber/50 px-5 py-4 max-w-[360px] w-full shadow-2xl shadow-black/60 overflow-y-auto no-scrollbar"
          style={{ maxHeight: isCard ? '70vh' : (rect?.avail ?? 320) }}
        >
          {!isCard && (
            <p className="text-[11.5px] text-haze num mb-1.5">{t('onb.tour.stepOf', { n: index, total: tourLen })}</p>
          )}
          <p className="font-display text-[17px] leading-tight mb-1.5">{title}</p>
          <p className="text-[13.5px] text-haze leading-relaxed mb-4 whitespace-pre-line">{body}</p>
          <div className="flex items-center gap-2.5">
            {step.kind !== 'outro' && (
              <button className="btn-ghost flex-1 text-[13.5px] py-2.5" onClick={onSkip}>
                {t('onb.tour.skip')}
              </button>
            )}
            <button className={`btn-primary text-[13.5px] py-2.5 ${step.kind === 'outro' ? 'w-full' : 'flex-[2]'}`} onClick={onNext}>
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
