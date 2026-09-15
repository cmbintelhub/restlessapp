import React, { useEffect, useState } from 'react'
import { useApp, useDerived } from './store.jsx'
import { Icon, Sheet, Empty } from './components/ui.jsx'
import { shortDate } from './lib/logic.js'
import Onboarding from './screens/Onboarding.jsx'
import Home from './screens/Home.jsx'
import Planner from './screens/Planner.jsx'
import Radar from './screens/Radar.jsx'
import Community from './screens/Community.jsx'
import Impact from './screens/Impact.jsx'
import Settings from './screens/Settings.jsx'
import Chat from './screens/Chat.jsx'

const TABS = [
  { id: 'home', icon: Icon.home, label: 'nav.home' },
  { id: 'planner', icon: Icon.basket, label: 'nav.planner' },
  { id: 'radar', icon: Icon.radar, label: 'nav.radar' },
  { id: 'community', icon: Icon.users, label: 'nav.community' },
  { id: 'impact', icon: Icon.leaf, label: 'nav.impact' },
]

function Toast() {
  const { state, dispatch } = useApp()
  const toast = state.toast
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => dispatch({ type: 'toast', text: null }), 3200)
    return () => clearTimeout(id)
  }, [toast?.id])
  if (!toast) return null
  const tone =
    toast.tone === 'warn' ? 'border-amber/70' : toast.tone === 'deal' ? 'border-amber/70' : 'border-fern'
  return (
    <div className="absolute left-4 right-4 top-3 z-[1300] pointer-events-none">
      <div className={`toast-in bg-moss border ${tone} rounded-2xl px-4 py-3 shadow-xl shadow-black/50`}>
        <p className="text-[13.5px] leading-snug">{toast.text}</p>
      </div>
    </div>
  )
}

function Notifications({ open, onClose }) {
  const { state, t } = useApp()
  return (
    <Sheet open={open} onClose={onClose} title={t('common.notifications')}>
      {state.notifications.length === 0 ? (
        <Empty>{t('notif.empty')}</Empty>
      ) : (
        <ul className="divide-y divide-fern/25">
          {state.notifications.map((n) => (
            <li key={n.id} className="py-3 flex gap-3 items-start">
              <span className="mt-0.5 text-haze shrink-0">
                {n.kind === 'deal' ? <Icon.radar size={17} /> : n.kind === 'community' ? <Icon.users size={17} /> : n.kind === 'capture' ? <Icon.receipt size={17} /> : <Icon.clock size={17} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] leading-snug">{t(n.text)}</span>
                <span className="block text-[12px] text-haze num mt-0.5">{shortDate(n.ts, state.lang)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}

function SimPanel({ open, onClose }) {
  const { state, dispatch, t } = useApp()
  const act = (fn) => () => { fn(); onClose() }

  const rows = [
    {
      icon: Icon.clock, label: t('sim.advance'),
      run: act(() => {
        dispatch({ type: 'advance', n: 3, expiryText: t('notif.expiry') })
        dispatch({ type: 'toast', text: t('sim.advanceDone') })
      }),
    },
    {
      icon: Icon.radar, label: t('sim.newDeal'),
      run: act(() => dispatch({ type: 'dropDeal', text: t('notif.deal') })),
    },
    {
      icon: Icon.users, label: t('sim.claim'),
      run: act(() => dispatch({ type: 'neighborClaims', label: t('impact.src.community'), notifyText: t('notif.claimed') })),
    },
    {
      icon: Icon.receipt, label: t('sim.receipt'),
      run: act(() => {
        dispatch({ type: 'importReceipt', id: 'r3' })
        dispatch({ type: 'toast', text: t('planner.imported', { n: 6 }) })
      }),
    },
  ]

  return (
    <Sheet open={open} onClose={onClose} title={t('sim.title')}>
      <p className="text-[13.5px] text-haze leading-relaxed mb-2">{t('sim.body')}</p>
      <p className="text-[12.5px] text-haze num mb-4">{t('sim.clock', { date: shortDate(state.clock, state.lang) })}</p>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const IconEl = r.icon
          return (
            <button key={r.label} onClick={r.run} className="card w-full text-left px-4 py-3.5 flex items-center gap-3.5 active:bg-bark">
              <span className="text-haze shrink-0"><IconEl size={19} /></span>
              <span className="flex-1 text-[14.5px]">{r.label}</span>
              <span className="text-haze shrink-0"><Icon.chevron size={16} /></span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

/**
 * Declared at module scope on purpose: a component defined inside App would be a new
 * type on every render, remounting the whole tree and wiping each screen's local state.
 */
function Frame({ children }) {
  return (
    <div className="h-full w-full bg-[#070B08] flex items-center justify-center sm:p-6">
      <div className="relative w-full max-w-[430px] h-full sm:h-[min(100%,900px)] bg-ink overflow-hidden sm:rounded-[32px] sm:border sm:border-fern/40 sm:shadow-2xl sm:shadow-black flex flex-col">
        {children}
      </div>
    </div>
  )
}

export default function App() {
  const { state, dispatch, t } = useApp()
  const { unread } = useDerived()
  const [tab, setTab] = useState('home')
  const [notifOpen, setNotifOpen] = useState(false)
  const [simOpen, setSimOpen] = useState(false)
  const [setOpen, setSetOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chat, setChat] = useState([])

  const go = (id) => { setTab(id); }

  useEffect(() => {
    document.documentElement.lang = state.lang
  }, [state.lang])

  // Reiniciar o protótipo também começa uma conversa nova com o assistente.
  useEffect(() => {
    if (!state.onboarded) { setChat([]); setChatOpen(false) }
  }, [state.onboarded])

  if (!state.onboarded) {
    return <Frame><Onboarding /></Frame>
  }

  return (
    <Frame>
      <Toast />

      <header className="shrink-0 flex items-center gap-2 px-5 pt-5 pb-1">
        <span className="text-sage"><Icon.leaf size={19} /></span>
        <span className="font-display text-[17px] tracking-tight flex-1">{t('app.name')}</span>
        <button className="p-2 text-haze active:text-sage" onClick={() => setChatOpen(true)} aria-label={t('chat.open')}>
          <Icon.chat size={19} />
        </button>
        <button className="p-2 text-haze active:text-sage" onClick={() => setSimOpen(true)} aria-label={t('sim.title')}>
          <Icon.flask size={19} />
        </button>
        <button
          className="p-2 text-haze active:text-sage relative"
          onClick={() => { setNotifOpen(true); dispatch({ type: 'readNotifications' }) }}
          aria-label={t('common.notifications')}
        >
          <Icon.bell size={19} />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber" />}
        </button>
        <button className="p-2 -mr-2 text-haze active:text-sage" onClick={() => setSetOpen(true)} aria-label={t('common.settings')}>
          <Icon.cog size={19} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar">
        {tab === 'home' && <Home go={go} />}
        {tab === 'planner' && <Planner go={go} />}
        {tab === 'radar' && <Radar />}
        {tab === 'community' && <Community />}
        {tab === 'impact' && <Impact />}
      </main>

      <nav className="shrink-0 border-t border-fern/40 bg-bark/95 backdrop-blur px-2 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <ul className="flex">
          {TABS.map((tb) => {
            const IconEl = tb.icon
            const on = tab === tb.id
            return (
              <li key={tb.id} className="flex-1">
                <button
                  onClick={() => setTab(tb.id)}
                  className={`w-full flex flex-col items-center gap-1 py-1.5 rounded-xl ${on ? 'text-sage' : 'text-haze/70'}`}
                  aria-current={on ? 'page' : undefined}
                >
                  <IconEl size={21} />
                  <span className="text-[10.5px] leading-none">{t(tb.label)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <Notifications open={notifOpen} onClose={() => setNotifOpen(false)} />
      <SimPanel open={simOpen} onClose={() => setSimOpen(false)} />
      <Settings open={setOpen} onClose={() => setSetOpen(false)} />
      <Chat open={chatOpen} onClose={() => setChatOpen(false)} messages={chat} setMessages={setChat} />
    </Frame>
  )
}
