/**
 * Leitura de NFC-e a partir de texto de OCR ou de QR code.
 *
 * O cupom traz três verificações independentes que não dependem do OCR acertar:
 *   1. cada EAN-13 valida a si mesmo (módulo 10)
 *   2. a chave de acesso valida a si mesma (módulo 11)
 *   3. a soma dos itens tem que bater com o valor total impresso
 * O parser usa as três para dizer o quanto confia em cada linha e na nota inteira.
 */

/* ---------------- EAN-13 ---------------- */

export function validEan(s) {
  if (!/^\d{13}$/.test(s)) return false
  const sum = [...s.slice(0, 12)].reduce((a, d, i) => a + Number(d) * (i % 2 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === Number(s[12])
}

const BR_PREFIX = /^(789|790)/

/** Um dígito errado: 130 candidatos. Aceita apenas se exatamente um sobreviver. */
export function repairEan(s, { depth = 1, preferBR = true } = {}) {
  if (!/^\d{13}$/.test(s)) return null
  if (validEan(s)) return s
  const hits = new Set()
  const digits = '0123456789'
  for (let i = 0; i < 13; i++) {
    for (const d of digits) {
      if (d === s[i]) continue
      const c = s.slice(0, i) + d + s.slice(i + 1)
      if (validEan(c) && (!preferBR || BR_PREFIX.test(c))) hits.add(c)
    }
  }
  if (hits.size === 1) return [...hits][0]
  if (depth < 2) return null
  // Dois dígitos errados. Só vale se continuar sendo uma resposta única.
  const deep = new Set()
  for (let i = 0; i < 13; i++) {
    for (let j = i + 1; j < 13; j++) {
      for (const d1 of digits) {
        for (const d2 of digits) {
          const c = s.slice(0, i) + d1 + s.slice(i + 1, j) + d2 + s.slice(j + 1)
          if (c !== s && validEan(c) && (!preferBR || BR_PREFIX.test(c))) deep.add(c)
        }
      }
    }
  }
  return deep.size === 1 ? [...deep][0] : null
}

/**
 * Procura um EAN numa sequência de dígitos que pode ter lixo em volta.
 * O OCR costuma quebrar o código com espaços, então a busca é por janela.
 */
export function findEan(digits) {
  if (!digits || digits.length < 13) return null
  const windows = []
  for (let i = 0; i + 13 <= digits.length; i++) windows.push(digits.slice(i, i + 13))
  for (const w of windows) if (BR_PREFIX.test(w) && validEan(w)) return { ean: w, how: 'direct' }
  for (const w of windows) {
    if (!BR_PREFIX.test(w)) continue
    const r = repairEan(w, { depth: 1 })
    if (r) return { ean: r, how: 'repaired1' }
  }
  for (const w of windows) {
    if (!BR_PREFIX.test(w)) continue
    const r = repairEan(w, { depth: 2 })
    if (r) return { ean: r, how: 'repaired2' }
  }
  return null
}

/** Produto importado não tem prefixo 789/790, mas só aceitamos se vier isolado. */
export function findEanStandalone(line) {
  for (const tok of String(line).split(/[^\d]+/)) {
    if (tok.length === 13 && validEan(tok)) return { ean: tok, how: 'direct-import' }
  }
  return null
}

/* ---------------- CNPJ ---------------- */

const cnpjDigit = (base, weights) => {
  let sum = 0
  for (let i = 0; i < base.length; i++) sum += Number(base[i]) * weights[i]
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

export function validCnpj(c) {
  if (!/^\d{14}$/.test(c)) return false
  if (/^(\d)\1{13}$/.test(c)) return false
  return cnpjDigit(c.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(c[12])
    && cnpjDigit(c.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(c[13])
}

export function findCnpj(text) {
  const digits = String(text).replace(/\D/g, '')
  for (let i = 0; i + 14 <= digits.length; i++) {
    const c = digits.slice(i, i + 14)
    if (validCnpj(c)) return c
  }
  return null
}

/* ---------------- chave de acesso ---------------- */

const KEY_WEIGHTS = [2, 3, 4, 5, 6, 7, 8, 9]

export function accessKeyDv(body43) {
  let sum = 0
  for (let i = 0; i < 43; i++) {
    const d = Number(body43[42 - i])
    sum += d * KEY_WEIGHTS[i % 8]
  }
  const rest = sum % 11
  return rest === 0 || rest === 1 ? 0 : 11 - rest
}

export function validAccessKey(s) {
  if (!/^\d{44}$/.test(s)) return false
  return accessKeyDv(s.slice(0, 43)) === Number(s[43])
}

export function parseAccessKey(s) {
  if (!validAccessKey(s)) return null
  const uf = s.slice(0, 2)
  const yy = s.slice(2, 4)
  const mm = s.slice(4, 6)
  return {
    key: s,
    uf: UF_BY_CODE[uf] || uf,
    ufCode: uf,
    year: 2000 + Number(yy),
    month: Number(mm),
    cnpj: s.slice(6, 20),
    model: s.slice(20, 22),
    series: s.slice(22, 25),
    number: s.slice(25, 34),
    code: s.slice(35, 43),
  }
}

/**
 * Uma chave só é aceita se, além do dígito verificador, os campos fizerem sentido:
 * UF existente, mês válido, modelo de nota fiscal e CNPJ que passa no próprio DV.
 */
export function plausibleAccessKey(s) {
  if (!validAccessKey(s)) return false
  if (!UF_BY_CODE[s.slice(0, 2)]) return false
  const mm = Number(s.slice(4, 6))
  const yy = Number(s.slice(2, 4))
  if (mm < 1 || mm > 12) return false
  if (yy < 20 || yy > 40) return false
  if (!['55', '65'].includes(s.slice(20, 22))) return false
  return validCnpj(s.slice(6, 20))
}

/**
 * Conserta um dígito trocado e só devolve resposta única.
 * Dígito faltando (o OCR come um zero) não é recuperável: medimos 17 candidatos
 * plausíveis numa nota real, sem critério para escolher. Nesse caso devolve null e
 * o app cai no QR code, que é o caminho confiável.
 */
export function repairAccessKey(s) {
  if (!/^\d{44}$/.test(s)) return null
  if (plausibleAccessKey(s)) return s
  const hits = new Set()
  for (let i = 0; i < 44; i++) {
    for (const d of '0123456789') {
      if (d === s[i]) continue
      const c = s.slice(0, i) + d + s.slice(i + 1)
      if (plausibleAccessKey(c)) hits.add(c)
    }
  }
  return hits.size === 1 ? [...hits][0] : null
}

export const UF_BY_CODE = {
  11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO',
  21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA',
  31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP',
  41: 'PR', 42: 'SC', 43: 'RS',
  50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
}

/** O QR da NFC-e carrega a chave no parâmetro p, antes do primeiro pipe. */
export function keyFromQr(text) {
  if (!text) return null
  const byParam = text.match(/[?&]p=([^|&\s]+)/i)
  if (byParam && validAccessKey(byParam[1])) return byParam[1]
  const runs = (text.replace(/\D/g, '').match(/\d{44,}/g) || [])
  for (const run of runs) {
    for (let i = 0; i + 44 <= run.length; i++) {
      const c = run.slice(i, i + 44)
      if (validAccessKey(c)) return c
    }
  }
  return null
}

/* ---------------- parser do texto ---------------- */

const money = (s) => {
  const m = String(s).match(/(\d{1,3}(?:\.\d{3})*|\d+)[,.](\d{2})\b/)
  if (!m) return null
  return Number(`${m[1].replace(/\./g, '')}.${m[2]}`)
}

const allMoney = (line) =>
  [...line.matchAll(/(\d{1,3}(?:\.\d{3})*|\d+)[,.](\d{2})(?!\d)/g)]
    .map((m) => Number(`${m[1].replace(/\./g, '')}.${m[2]}`))

const looksLikeItemStart = (line) => /^\s*[\dDOo]{3,4}[\s.]/.test(line)
const isDiscountLine = (line) => /desconto|descto|desc\./i.test(line)

/** Linha de quantidade: 6,000 Un X  R$ 2,99  R$ 17,94 */
const QTY_RE = /(\d{1,3}[.,]\d{1,3})\s*[|Il]?\s*(kg|un|ml|l|g)/i

/** A descrição é o primeiro trecho alfabético de verdade, até o primeiro valor. */
export function descriptionFrom(line) {
  const tokens = line.split(/\s+/).filter(Boolean)
  let start = -1
  for (let i = 0; i < tokens.length; i++) {
    const letters = (tokens[i].match(/[A-Za-zÀ-ÿ]/g) || []).length
    if (letters >= 3) { start = i; break }
  }
  if (start < 0) return ''
  const out = []
  for (let i = start; i < tokens.length; i++) {
    if (/R\$|^R\$?$/.test(tokens[i])) break
    out.push(tokens[i])
  }
  return out.join(' ')
    .replace(/^[#*]+\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Tamanho embutido na descrição: 2L, 1,5, 290ML, 500G, C4. */
export function sizeFrom(desc) {
  const s = desc.toUpperCase()
  let m = s.match(/(\d+(?:[.,]\d+)?)\s*ML\b/)
  if (m) return { value: Number(m[1].replace(',', '.')) / 1000, unit: 'L' }
  m = s.match(/(\d+(?:[.,]\d+)?)\s*L\b/)
  if (m) return { value: Number(m[1].replace(',', '.')), unit: 'L' }
  m = s.match(/(\d+(?:[.,]\d+)?)\s*KG\b/)
  if (m) return { value: Number(m[1].replace(',', '.')), unit: 'kg' }
  m = s.match(/(\d+(?:[.,]\d+)?)\s*G\b/)
  if (m) return { value: Number(m[1].replace(',', '.')) / 1000, unit: 'kg' }
  m = s.match(/\bC(\d{1,2})\b/)
  if (m) return { value: Number(m[1]), unit: 'un' }
  m = s.match(/(\d+,\d)\s*$/)
  if (m) return { value: Number(m[1].replace(',', '.')), unit: 'L' }
  return null
}

export function parseReceipt(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  const header = { cnpj: null, name: null }
  const cnpjLine = lines.find((l) => /CNPJ/i.test(l))
  if (cnpjLine) {
    header.cnpj = findCnpj(cnpjLine)
    const name = cnpjLine.replace(/CNPJ:?/i, '').replace(/[\d.\/-]{6,}/g, ' ').trim()
    if (name.replace(/[^A-Za-zÀ-ÿ]/g, '').length > 3) header.name = name
  }
  if (!header.name) {
    // o nome costuma cair na linha do CNPJ ou na seguinte, com muito ruído
    const idx = cnpjLine ? lines.indexOf(cnpjLine) : -1
    const cand = idx >= 0 ? lines[idx + 1] : null
    if (cand && /LTDA|ME|EIRELI|S\/A|SA\b|COMERCIO|MERCADO|SUPER/i.test(cand)) header.name = cand
  }

  // Chave de acesso: 44 dígitos em qualquer linha, com reparo de um dígito.
  let key = null
  let keyStatus = 'missing'
  for (const l of lines) {
    const d = l.replace(/\D/g, '')
    if (d.length < 44) continue
    for (let i = 0; i + 44 <= d.length; i++) {
      const c = d.slice(i, i + 44)
      if (plausibleAccessKey(c)) { key = c; keyStatus = 'valid'; break }
      const r = repairAccessKey(c)
      if (r) { key = r; keyStatus = 'repaired'; break }
    }
    if (key) break
  }

  if (!header.cnpj && key) header.cnpj = key.slice(6, 20)

  // O rodapé começa nos totais. Depois dele, "desconto" é desconto da nota inteira,
  // não da última linha de item, então o corpo é varrido só até ali.
  const anchor = lines.findIndex((l) => /valor\s*total|qtd.*total.*itens|forma\s*pagamento/i.test(l))
  const body = anchor >= 0 ? lines.slice(0, anchor) : lines
  const tail = anchor >= 0 ? lines.slice(anchor) : []

  const items = []
  let current = null
  const push = () => { if (current) items.push(current); current = null }

  for (const line of body) {
    if (isDiscountLine(line) && current) {
      const values = allMoney(line)
      if (values.length) current.discount = Math.min(...values)
      continue
    }

    const hasEan = !!findEan(line.replace(/\D/g, ''))
    if (looksLikeItemStart(line) || hasEan) {
      const noItemNo = line.replace(/^\s*[\dDOo]{3,4}[\s.]/, ' ')
      const digits = noItemNo.replace(/\D/g, '')
      const found = findEan(digits) || findEanStandalone(noItemNo)
      const desc = descriptionFrom(noItemNo)
      // Linha de item de verdade precisa de código ou de descrição com sentido.
      if (found || desc.length >= 4) {
        push()
        current = {
          ean: found?.ean || null,
          eanHow: found?.how || 'none',
          desc,
          size: sizeFrom(desc),
          qty: null,
          unit: null,
          unitPrice: null,
          total: null,
          discount: 0,
          raw: line,
        }
        // Algumas impressões põem preço na mesma linha do item.
        const values = allMoney(noItemNo)
        if (values.length >= 2) {
          current.unitPrice = values[values.length - 2]
          current.total = values[values.length - 1]
        } else if (values.length === 1) {
          current.total = values[0]
        }
        continue
      }
    }

    const q = line.match(QTY_RE)
    if (q && current) {
      current.qty = Number(q[1].replace(',', '.'))
      current.unit = /kg/i.test(q[2]) ? 'kg' : /^l$/i.test(q[2]) ? 'L' : 'un'
      const values = allMoney(line)
      if (values.length >= 2) {
        current.unitPrice = values[values.length - 2]
        current.total = values[values.length - 1]
      } else if (values.length === 1 && current.total == null) {
        current.total = values[0]
      }
    }
  }
  push()

  // Os totais ficam no rodapé. Antes da âncora, "desconto" é desconto de item.
  // Preenche o que dá para deduzir: total = qtd x unitário, e vice-versa.
  for (const i of items) {
    if (i.total == null && i.qty != null && i.unitPrice != null) {
      i.total = Math.round(i.qty * i.unitPrice * 100) / 100
    }
    if (i.qty == null && i.total != null && i.unitPrice) {
      const q = i.total / i.unitPrice
      if (q > 0 && q < 100) i.qty = Math.round(q * 1000) / 1000
    }
    if (i.qty == null) { i.qty = 1; i.qtyGuessed = true }
    if (!i.unit) i.unit = 'un'
  }

  const totals = {}
  for (const l of tail) {
    if (/valor\s*a\s*pagar/i.test(l)) totals.paid = money(l.replace(/valor\s*a\s*pagar/i, ''))
    else if (/valor\s*total/i.test(l)) totals.total = money(l.replace(/valor\s*total/i, ''))
    else if (/^desconto/i.test(l) && totals.discount == null) totals.discount = money(l.replace(/desconto/i, ''))
    else if (/qtd.*total.*itens/i.test(l)) {
      const n = l.replace(/\D/g, '')
      if (n) totals.count = Number(n)
    }
  }

  // Confiança da nota inteira: a soma dos itens bate com o total impresso?
  const sum = items.reduce((a, i) => a + (i.total || 0), 0)
  let sumCheck = 'unknown'
  if (totals.total != null && sum > 0) {
    sumCheck = Math.abs(sum - totals.total) < 0.05 ? 'match' : 'mismatch'
  }

  const withEan = items.filter((i) => i.ean).length
  const confidence =
    keyStatus === 'valid' && sumCheck === 'match' ? 'high'
      : sumCheck === 'match' || keyStatus === 'valid' || withEan / Math.max(1, items.length) >= 0.6 ? 'medium'
        : 'low'

  return {
    header,
    key,
    keyStatus,
    keyFields: key ? parseAccessKey(key) : null,
    items,
    totals,
    sum: Math.round(sum * 100) / 100,
    sumCheck,
    confidence,
  }
}
