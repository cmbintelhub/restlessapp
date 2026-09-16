import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store.jsx'
import { CATALOG, byId } from '../data/catalog.js'
import { RECEIPTS, storeById } from '../data/seed.js'
import { parseReceipt, keyFromQr, parseAccessKey } from '../lib/nfce.js'
import { matchProduct, quantityFor, consolidate } from '../lib/matcher.js'
import { openCamera, stopStream, readQr, readText, fileToImage } from '../lib/ocr.js'
import { qty as fmtQty, money, shortDate } from '../lib/logic.js'
import { Icon, Sheet, Chip, Empty } from '../components/ui.jsx'

const CONF_STYLE = {
  high: 'text-fresh border-fresh/50',
  medium: 'text-amber border-amber/50',
  low: 'text-amber border-amber/50',
  none: 'text-ember border-ember/50',
}

function ProductPicker({ onPick, onCancel, lang }) {
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = term
      ? CATALOG.filter((p) => p.pt.toLowerCase().includes(term) || p.en.toLowerCase().includes(term))
      : CATALOG
    return list.slice(0, 40)
  }, [q])
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 bg-ink border border-fern/60 rounded-full px-3 py-2">
        <Icon.search size={16} />
        <input
          autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          className="bg-transparent outline-none flex-1 text-[14px]"
        />
        <button onClick={onCancel} className="text-haze"><Icon.x size={16} /></button>
      </div>
      <ul className="mt-2 max-h-52 overflow-y-auto no-scrollbar divide-y divide-fern/25">
        {results.map((p) => (
          <li key={p.id}>
            <button className="w-full text-left py-2 text-[14px] active:opacity-70" onClick={() => onPick(p.id)}>
              {p[lang] || p.en}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Row({ row, onChange, lang, t }) {
  const [picking, setPicking] = useState(false)
  const p = row.productId ? byId(row.productId) : null
  const step = p ? p.packs[0] : 1

  return (
    <li className={`card px-4 py-3.5 ${row.include ? '' : 'opacity-50'}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onChange({ ...row, include: !row.include })}
          className={`mt-0.5 w-5 h-5 rounded-md border shrink-0 grid place-items-center ${row.include ? 'bg-sage border-sage text-ink' : 'border-fern'}`}
          aria-label={t('review.include')}
        >
          {row.include && <Icon.check size={13} />}
        </button>

        <div className="flex-1 min-w-0">
          <button className="text-left w-full" onClick={() => setPicking(!picking)}>
            <span className="block text-[15px] font-semibold leading-tight">
              {p ? (p[lang] || p.en) : row.kind === 'nonfood' ? t('review.nonfood') : t('review.unknown')}
            </span>
            <span className="block text-[12px] text-haze truncate mt-0.5">{row.desc}</span>
          </button>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-[11px] border rounded-full px-2 py-0.5 ${CONF_STYLE[row.confidence] || CONF_STYLE.none}`}>
              {t(`review.conf.${row.confidence}`)}
            </span>
            {row.ean && <span className="text-[11px] text-haze num">{row.ean}</span>}
            {row.mergedFrom > 1 && (
              <span className="text-[11px] text-haze">{t('review.merged', { n: row.mergedFrom })}</span>
            )}
          </div>

          {picking && (
            <ProductPicker
              lang={lang}
              onCancel={() => setPicking(false)}
              onPick={(id) => {
                setPicking(false)
                onChange({ ...row, productId: id, kind: 'food', confidence: 'high', include: true, corrected: true })
              }}
            />
          )}
        </div>

        {p && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              className="w-8 h-8 rounded-full border border-fern grid place-items-center"
              onClick={() => onChange({ ...row, qty: Math.max(step, Math.round((row.qty - step) * 1000) / 1000) })}
              aria-label="−"
            ><Icon.minus size={14} /></button>
            <span className="num text-[13px] w-12 text-center">
              {fmtQty(row.qty)}<span className="text-haze text-[11px]"> {t(`unit.${p.unit}`)}</span>
            </span>
            <button
              className="w-8 h-8 rounded-full border border-fern grid place-items-center"
              onClick={() => onChange({ ...row, qty: Math.round((row.qty + step) * 1000) / 1000 })}
              aria-label="+"
            ><Icon.plus size={14} /></button>
          </div>
        )}
      </div>
    </li>
  )
}

export default function Scan({ open, onClose }) {
  const { state, dispatch, t } = useApp()
  const lang = state.lang
  const [phase, setPhase] = useState('choose')
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [qrText, setQrText] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [rows, setRows] = useState([])
  const [destination, setDestination] = useState('pantry')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const qrTimer = useRef(null)
  const fileRef = useRef(null)

  const shutdown = () => {
    clearInterval(qrTimer.current)
    qrTimer.current = null
    stopStream(streamRef.current)
    streamRef.current = null
  }

  useEffect(() => () => shutdown(), [])
  useEffect(() => {
    if (!open) {
      shutdown()
      setPhase('choose'); setParsed(null); setRows([]); setQrText(null); setProgress(0)
    }
  }, [open])

  async function startCamera() {
    try {
      const stream = await openCamera()
      streamRef.current = stream
      setPhase('camera')
      setQrText(null)
      setTimeout(() => {
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream
        v.play().catch(() => {})
        qrTimer.current = setInterval(() => {
          const hit = readQr(v)
          if (hit) setQrText(hit)
        }, 400)
      }, 60)
    } catch {
      setPhase('nocamera')
    }
  }

  async function processImage(source, qrHint) {
    setPhase('working')
    setStatus(t('scan.loadingEngine'))
    setProgress(0)
    let qr = qrHint || null
    try {
      if (!qr) qr = readQr(source, { maxSide: 1600 })
    } catch { /* segue sem QR */ }

    let text = ''
    try {
      const out = await readText(source, (m) => {
        if (m.status === 'recognizing text') {
          setStatus(t('scan.reading'))
          setProgress(Math.round((m.progress || 0) * 100))
        } else {
          setStatus(t('scan.loadingEngine'))
        }
      })
      text = out.text
    } catch {
      text = ''
    }

    const receipt = parseReceipt(text)
    const fromQr = qr ? keyFromQr(qr) : null
    if (fromQr) {
      receipt.key = fromQr
      receipt.keyStatus = 'qr'
      receipt.keyFields = parseAccessKey(fromQr)
      if (!receipt.header.cnpj) receipt.header.cnpj = receipt.keyFields?.cnpj || null
    }

    const matched = receipt.items.map((i) => {
      const m = matchProduct(i, state.learnedEans)
      const q = m.productId ? quantityFor(m.productId, i) : { qty: i.qty || 1, unit: i.unit || 'un' }
      return {
        ...i, ...m, ...q,
        include: m.kind === 'food' && m.confidence !== 'none',
        destination: 'pantry',
      }
    })
    const merged = consolidate(matched)

    setQrText(qr)
    setParsed(receipt)
    setRows(merged)
    setPhase(merged.length ? 'review' : 'failed')
    shutdown()
  }

  function capture() {
    const v = videoRef.current
    if (!v) return
    const snap = document.createElement('canvas')
    snap.width = v.videoWidth
    snap.height = v.videoHeight
    snap.getContext('2d').drawImage(v, 0, 0)
    processImage(snap, qrText)
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const img = await fileToImage(file)
      processImage(img, null)
    } catch {
      setPhase('failed')
    }
  }

  function confirm() {
    const chosen = rows.filter((r) => r.include && r.productId)
    if (!chosen.length) return
    const date = parsed?.keyFields
      ? `${parsed.keyFields.year}-${String(parsed.keyFields.month).padStart(2, '0')}-01`
      : state.clock
    dispatch({
      type: 'importScanned',
      rows: chosen.map((r) => ({ ...r, destination })),
      key: parsed?.key || null,
      storeName: parsed?.header?.name || null,
      date: date > state.clock ? state.clock : date,
      total: parsed?.totals?.total ?? null,
    })
    for (const r of chosen) if (r.ean && r.corrected) dispatch({ type: 'learnEan', ean: r.ean, productId: r.productId })
    dispatch({ type: 'toast', text: t('review.imported', { n: chosen.length }) })
    onClose()
  }

  const chosenCount = rows.filter((r) => r.include && r.productId).length
  const title = phase === 'review' ? t('review.title') : t('scan.title')

  return (
    <Sheet open={open} onClose={onClose} title={title} tall>
      {phase === 'choose' && (
        <>
          <p className="text-[13.5px] text-haze leading-relaxed mb-4">{t('scan.body')}</p>
          <button className="btn-primary w-full mb-2.5" onClick={startCamera}>{t('scan.camera')}</button>
          <button className="btn-ghost w-full" onClick={() => fileRef.current?.click()}>{t('scan.upload')}</button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

          <p className="text-[14px] mt-6 mb-2">{t('scan.tips')}</p>
          <ul className="space-y-1.5 text-[13px] text-haze leading-snug">
            {['scan.tip1', 'scan.tip2', 'scan.tip3'].map((k) => (
              <li key={k} className="flex gap-2.5"><span className="text-amber">·</span><span>{t(k)}</span></li>
            ))}
          </ul>

          <div className="mt-6 pt-5 border-t border-fern/30">
            <p className="text-[13px] text-haze mb-2.5">{t('scan.demoInstead')}</p>
            <div className="space-y-2">
              {RECEIPTS.map((r) => (
                <button
                  key={r.id}
                  className="card w-full text-left px-4 py-3 flex items-center gap-3 active:bg-bark"
                  onClick={() => {
                    dispatch({ type: 'importReceipt', id: r.id })
                    dispatch({ type: 'toast', text: t('planner.imported', { n: r.items.length }) })
                    onClose()
                  }}
                >
                  <Icon.receipt size={17} />
                  <span className="flex-1 text-[14px]">{storeById(r.store).name}</span>
                  <span className="text-[12px] text-haze num">{r.items.length}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {phase === 'camera' && (
        <>
          <div className="relative rounded-2xl overflow-hidden bg-black">
            <video ref={videoRef} playsInline muted className="w-full h-[46vh] object-cover" />
            <div className="absolute inset-3 border-2 border-sage/70 rounded-xl pointer-events-none" />
            <div className="absolute left-0 right-0 bottom-2 text-center">
              <span className={`text-[12px] px-3 py-1.5 rounded-full ${qrText ? 'bg-fresh text-ink' : 'bg-ink/80 text-haze'}`}>
                {qrText ? t('scan.qrFound') : t('scan.qrHunting')}
              </span>
            </div>
          </div>
          <p className="text-[13px] text-haze text-center mt-3">{t('scan.guide')}</p>
          <button className="btn-primary w-full mt-4" onClick={capture}>{t('scan.capture')}</button>
          <button className="btn-ghost w-full mt-2.5" onClick={() => { shutdown(); setPhase('choose') }}>
            {t('scan.stop')}
          </button>
        </>
      )}

      {phase === 'working' && (
        <div className="py-10 text-center">
          <p className="text-[14px]">{status}</p>
          <div className="h-1.5 bg-fern/40 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-amber transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="num text-[12px] text-haze mt-2">{progress}%</p>
        </div>
      )}

      {phase === 'nocamera' && (
        <>
          <Empty>{t('scan.noCamera')}</Empty>
          <button className="btn-primary w-full mt-4" onClick={() => fileRef.current?.click()}>{t('scan.upload')}</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </>
      )}

      {phase === 'failed' && (
        <>
          <Empty>{t('scan.failed')}</Empty>
          <button className="btn-primary w-full mt-4" onClick={() => setPhase('choose')}>{t('scan.retry')}</button>
        </>
      )}

      {phase === 'review' && parsed && (
        <>
          <p className="text-[13.5px] text-haze leading-relaxed">{t('review.body')}</p>

          <div className="card px-4 py-3.5 mt-4 space-y-1.5">
            <p className="text-[14px]">
              {parsed.header?.name || t('review.unknownStore')}
            </p>
            <p className="text-[12.5px] text-haze num">
              {parsed.keyFields
                ? `${parsed.keyFields.uf} · ${String(parsed.keyFields.month).padStart(2, '0')}/${parsed.keyFields.year}`
                : shortDate(state.clock, lang)}
              {parsed.totals?.total != null && ` · ${money(parsed.totals.total)}`}
            </p>
            <p className={`text-[12px] ${parsed.key ? 'text-fresh' : 'text-haze'}`}>
              {parsed.key ? t('review.keyOk') : t('review.keyMissing')}
            </p>
            <p className={`text-[12px] ${parsed.sumCheck === 'match' ? 'text-fresh' : 'text-amber'}`}>
              {parsed.sumCheck === 'match' ? t('review.sumOk') : t('review.sumBad')}
            </p>
            {!qrText && <p className="text-[12px] text-haze">{t('scan.qrMissing')}</p>}
          </div>

          <div className="flex gap-1 p-1 bg-bark border border-fern/40 rounded-full my-4">
            {[['pantry', t('review.toPantry')], ['list', t('review.toList')]].map(([k, label]) => (
              <button
                key={k} onClick={() => setDestination(k)}
                className={`flex-1 rounded-full py-2 text-[13.5px] font-semibold ${destination === k ? 'bg-sage text-ink' : 'text-haze'}`}
              >{label}</button>
            ))}
          </div>

          <p className="text-[12.5px] text-haze num mb-2">{t('review.lines', { n: rows.length })}</p>
          <ul className="space-y-2.5">
            {rows.map((r, i) => (
              <Row
                key={i} row={r} lang={lang} t={t}
                onChange={(next) => setRows(rows.map((x, j) => (j === i ? next : x)))}
              />
            ))}
          </ul>

          <p className="text-[12px] text-haze mt-3">{t('review.learnedNote')}</p>
          <button className="btn-primary w-full mt-4 disabled:opacity-40" disabled={!chosenCount} onClick={confirm}>
            {chosenCount ? t('review.confirm', { n: chosenCount }) : t('review.nothing')}
          </button>
        </>
      )}
    </Sheet>
  )
}
