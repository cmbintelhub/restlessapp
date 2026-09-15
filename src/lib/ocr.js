import jsQR from 'jsqr'

/**
 * Leitura de imagem: QR primeiro, OCR depois.
 * Tudo roda no dispositivo. Os binários do Tesseract e o modelo de português são
 * servidos do próprio site, então não há chamada a CDN nem envio da foto para lugar nenhum.
 */

const BASE = import.meta.env.BASE_URL || './'
const asset = (f) => new URL(`tesseract/${f}`, new URL(BASE, location.href)).href

/* ---------------- pré-processamento ---------------- */

/**
 * Cinza com alongamento de contraste por percentil.
 * Medimos numa nota real que binarizar piora o resultado: papel térmico já é quase
 * preto e branco, e o limiar come os traços finos dos dígitos.
 */
export function preprocess(source, { maxSide = 2200 } = {}) {
  const sw = source.videoWidth || source.naturalWidth || source.width
  const sh = source.videoHeight || source.naturalHeight || source.height
  const scale = Math.min(1, maxSide / Math.max(sw, sh))
  const w = Math.round(sw * scale)
  const h = Math.round(sh * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, 0, 0, w, h)

  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const hist = new Uint32Array(256)
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0
    d[i] = d[i + 1] = d[i + 2] = g
    hist[g]++
  }
  const total = w * h
  const cut = total * 0.02
  let lo = 0
  let hi = 255
  let acc = 0
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > cut) { lo = v; break } }
  acc = 0
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > cut) { hi = v; break } }
  const span = Math.max(1, hi - lo)
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span))
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

/* ---------------- QR ---------------- */

/** Procura um QR num frame. Trabalha num canvas reduzido para rodar a cada frame. */
export function readQr(source, { maxSide = 900 } = {}) {
  const sw = source.videoWidth || source.naturalWidth || source.width
  const sh = source.videoHeight || source.naturalHeight || source.height
  if (!sw || !sh) return null
  const scale = Math.min(1, maxSide / Math.max(sw, sh))
  const w = Math.round(sw * scale)
  const h = Math.round(sh * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const hit = jsQR(data, w, h, { inversionAttempts: 'attemptBoth' })
  return hit?.data || null
}

/* ---------------- OCR ---------------- */

let workerPromise = null

export async function getWorker(onProgress) {
  if (workerPromise) return workerPromise
  workerPromise = (async () => {
    const { createWorker } = await import('tesseract.js')
    return createWorker('por', 1, {
      workerPath: asset('worker.min.js'),
      corePath: asset(''),
      langPath: asset('').replace(/\/$/, ''),
      gzip: false,
      logger: (m) => onProgress?.(m),
    })
  })()
  return workerPromise
}

export async function readText(source, onProgress) {
  const canvas = preprocess(source)
  const worker = await getWorker(onProgress)
  await worker.setParameters({ tessedit_pageseg_mode: '6' })
  const { data } = await worker.recognize(canvas)
  return { text: data.text || '', confidence: data.confidence ?? null }
}

export function releaseWorker() {
  const p = workerPromise
  workerPromise = null
  p?.then((w) => w.terminate()).catch(() => {})
}

/* ---------------- câmera ---------------- */

export async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-camera')
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  })
}

export const stopStream = (stream) => stream?.getTracks?.().forEach((t) => t.stop())

export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad-image')) }
    img.src = url
  })
}
