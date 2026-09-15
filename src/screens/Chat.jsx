import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../store.jsx'
import { Sheet, Icon, Chip } from '../components/ui.jsx'
import { reply, INTENTS, STARTERS } from '../lib/chatbot.js'
import { translate } from '../lib/i18n.js'

const TYPING_MS = 650
const CONNECT_MS = 1400

let seq = 1
const mid = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`

function Bubble({ msg }) {
  const mine = msg.from === 'user'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <p
        data-from={msg.from}
        className={`max-w-[85%] px-3.5 py-2.5 text-[14px] leading-snug whitespace-pre-line ${
          mine
            ? 'bg-sage text-ink rounded-2xl rounded-br-md'
            : 'bg-bark border border-fern/40 rounded-2xl rounded-bl-md'
        }`}
      >
        {msg.text}
      </p>
    </div>
  )
}

function Handoff({ msg }) {
  // O cartão fica no idioma em que a conversa aconteceu, como as bolhas ao redor.
  const t = (k, v) => translate(msg.lang, k, v)
  return (
    <div className="card px-4 py-3.5 border-amber/60" data-handoff={msg.stage}>
      {msg.stage === 'connecting' ? (
        <p className="text-[14px] flex items-center gap-2.5">
          <span className="inline-flex gap-1" aria-hidden="true">
            <span className="chat-dot" /><span className="chat-dot" /><span className="chat-dot" />
          </span>
          {t('chat.connecting')}
        </p>
      ) : (
        <>
          <p className="text-[14px] leading-snug">{t('chat.queue', { n: msg.position, m: msg.position * 2 })}</p>
          <p className="text-[12.5px] text-haze mt-1.5">{t('chat.queueNote')}</p>
        </>
      )}
    </div>
  )
}

/**
 * A conversa vive no App, então fechar e abrir a folha não apaga o histórico.
 * O estado do app é lido na hora da resposta, então perguntar de novo depois de
 * reservar uma oferta devolve números atualizados.
 */
export default function Chat({ open, onClose, messages, setMessages }) {
  const { state, t } = useApp()
  const lang = state.lang
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [handedOff, setHandedOff] = useState(false)
  const bodyRef = useRef(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing, open])

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))

  const send = (raw) => {
    const text = raw.trim()
    if (!text || typing || handedOff) return
    setDraft('')
    setMessages((m) => [...m, { id: mid(), from: 'user', text }])
    setTyping(true)
    later(() => {
      const r = reply(text, stateRef.current)
      setTyping(false)
      setMessages((m) => [...m, { id: mid(), from: 'bot', text: r.text, suggestions: r.suggestions.map((i) => i.id) }])
      if (r.handoff) {
        setHandedOff(true)
        const hid = mid()
        setMessages((m) => [...m, { id: hid, from: 'system', stage: 'connecting', lang: stateRef.current.lang }])
        later(() => {
          const position = 2 + Math.floor(Math.random() * 4)
          setMessages((m) => m.map((x) => (x.id === hid ? { ...x, stage: 'queue', position } : x)))
        }, CONNECT_MS)
      }
    }, TYPING_MS)
  }

  const backToBot = () => setHandedOff(false)
  const clear = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setTyping(false)
    setHandedOff(false)
    setMessages([])
  }

  const last = [...messages].reverse().find((m) => m.from === 'bot')
  const chipIds = !messages.length ? STARTERS : handedOff || typing ? [] : last?.suggestions || []
  const chips = chipIds.map((id) => INTENTS.find((i) => i.id === id)).filter(Boolean)
  const waitingQueue = handedOff && messages.some((m) => m.stage === 'queue')

  const footer = (
    <>
      {chips.length > 0 && (
        <div className="mb-2.5">
          {!messages.length && <p className="text-[12.5px] text-haze mb-2">{t('chat.suggest')}</p>}
          <div className="flex flex-wrap gap-2" data-chips>
            {chips.map((c) => (
              <Chip key={c.id} onClick={() => send(c.ask[lang])}>{c.ask[lang]}</Chip>
            ))}
          </div>
        </div>
      )}
      {handedOff ? (
        <button className="btn-ghost w-full disabled:opacity-40" onClick={backToBot} disabled={!waitingQueue}>
          {t('chat.back')}
        </button>
      ) : (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); send(draft) }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('chat.placeholder')}
            aria-label={t('chat.placeholder')}
            enterKeyHint="send"
            className="flex-1 min-w-0 bg-ink border border-fern rounded-full px-4 py-2.5 text-[15px] placeholder:text-haze/70 focus:outline-none focus:border-sage"
          />
          <button
            type="submit"
            aria-label={t('chat.send')}
            disabled={!draft.trim() || typing}
            className="w-11 h-11 shrink-0 rounded-full bg-sage text-ink grid place-items-center disabled:opacity-40"
          >
            <Icon.send size={18} />
          </button>
        </form>
      )}
    </>
  )

  return (
    <Sheet open={open} onClose={onClose} title={t('chat.title')} tall footer={footer} bodyRef={bodyRef}>
      <div className="min-h-[46vh] flex flex-col">
        <div className="flex-1" />
        <div className="space-y-2.5 pt-1" aria-live="polite">
          <Bubble msg={{ from: 'bot', text: t('chat.intro') }} />
          {messages.map((m) => (m.from === 'system' ? <Handoff key={m.id} msg={m} /> : <Bubble key={m.id} msg={m} />))}
          {typing && (
            <div className="flex justify-start" aria-label={t('chat.typing')}>
              <span className="bg-bark border border-fern/40 rounded-2xl rounded-bl-md px-3.5 py-3 inline-flex gap-1">
                <span className="chat-dot" /><span className="chat-dot" /><span className="chat-dot" />
              </span>
            </div>
          )}
        </div>
        {messages.length > 0 && (
          <button onClick={clear} className="self-center mt-4 text-[12.5px] text-haze underline underline-offset-2">
            {t('chat.clear')}
          </button>
        )}
      </div>
    </Sheet>
  )
}
