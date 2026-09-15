// Testes do chatbot simulado: node tests/chatbot.mjs
// Transpila o store.jsx (mesmo truque do run.mjs) para exercitar as respostas contextuais
// contra estados reais produzidos pelo reducer.
import { build } from 'esbuild'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const shim = path.join(root, 'src', '__store.chat.test.mjs')
await build({
  entryPoints: [path.join(root, 'src', 'store.jsx')],
  outfile: shim, format: 'esm', bundle: false,
  loader: { '.jsx': 'jsx' }, jsx: 'automatic', logLevel: 'silent',
})
const store = await import(shim)
fs.unlinkSync(shim)
const bot = await import(path.join(root, 'src', 'lib', 'chatbot.js'))
const { i18n } = { i18n: await import(path.join(root, 'src', 'lib', 'i18n.js')) }

const { reducer, initialState } = store
const { classify, reply, normalize, INTENTS, STARTERS, FALLBACK, chatFacts, joinNames } = bot

let pass = 0
const fails = []
const check = (name, cond, detail) => (cond ? pass++ : fails.push(`${name}${detail ? ' — ' + detail : ''}`))
const routes = (msg) => classify(msg).intent?.id ?? null

// ---- estrutura da base ----
const ids = INTENTS.map((i) => i.id)
check('ids de intenção são únicos', new Set(ids).size === ids.length)
for (const it of INTENTS) {
  check(`${it.id}: tem keywords em PT`, it.keywords.pt.length > 0)
  check(`${it.id}: tem keywords em EN`, it.keywords.en.length > 0)
  check(`${it.id}: tem pergunta de exemplo nos dois idiomas`, !!it.ask?.pt && !!it.ask?.en)
  for (const n of it.next || []) check(`${it.id}: sugestão "${n}" existe`, ids.includes(n))
}
for (const s of STARTERS) check(`sugestão inicial "${s}" existe`, ids.includes(s))

// Regressão central: tocar num chip manda a pergunta de exemplo, que precisa cair na própria intenção.
for (const it of INTENTS) {
  for (const lang of ['pt', 'en']) {
    const got = routes(it.ask[lang])
    check(`chip ${lang} de "${it.id}" cai na própria intenção`, got === it.id, `"${it.ask[lang]}" -> ${got}`)
  }
}

// ---- normalização ----
check('normaliza acento e caixa', normalize('  Ó Promoção!! ') === 'o promocao')
check('mensagem vazia não casa', classify('   ').intent === null)

// ---- roteamento com frases livres ----
const cases = [
  ['quais produtos estão vencendo na geladeira?', 'expiring'],
  ['o que vence', 'expiring'],
  ['tem alguma promoção boa hoje', 'deals'],
  ['where are the deals', 'deals'],
  ['como funciona o pix', 'pix'],
  ['posso doar pra vizinha?', 'neighbors'],
  ['quanto eu já economizei', 'impact'],
  ['how much did I save', 'impact'],
  ['alerta de desperdício', 'quantity'],
  ['quero falar com um humano', 'human'],
  ['como instalo no iphone', 'install'],
  ['bom dia', 'greeting'],
  ['valeu!', 'thanks'],
  ['me ajuda', 'howItWorks'],
  ['oi, tem oferta?', 'deals'],
]
for (const [msg, want] of cases) {
  const got = routes(msg)
  check(`"${msg}" -> ${want}`, got === want, `veio ${got}`)
}

// ---- erros de digitação ----
check('"despenssa" ainda é despensa', routes('despenssa') === 'pantry', routes('despenssa'))
check('"ofertaz" ainda é oferta', routes('ofertaz') === 'deals', routes('ofertaz'))
check('"validadi" ainda é validade', routes('validadi') === 'expiring', routes('validadi'))

// ---- fallback: nada programado responde ----
const unknown = ['quero pedir uma pizza', 'qual a capital da frança', 'vai chover amanhã?', 'asdf qwer', 'como compro ingressos']
for (const msg of unknown) check(`"${msg}" cai no fallback`, routes(msg) === null, routes(msg))

const s0 = initialState()
const fb = reply('quero pedir uma pizza', { ...s0, lang: 'pt' })
check('fallback marca transferência', fb.handoff === true && fb.intentId === null)
check('fallback PT fala em atendente humano', /atendente humano/.test(fb.text), fb.text)
check('fallback EN fala em human agent', /human agent/.test(reply('pizza please', s0).text))
check('pedido explícito de humano também transfere', reply('quero um atendente', { ...s0, lang: 'pt' }).handoff === true)
check('pergunta programada não transfere', reply('o que vence', { ...s0, lang: 'pt' }).handoff === false)

// ---- respostas contextuais contra estados reais ----
let st = { ...initialState(), lang: 'pt' }
check('despensa vazia é dita como vazia', /vazia/.test(reply('o que vence', st).text))
check('lista vazia é dita como vazia', /vazia/.test(reply('minha lista', st).text))
check('sem impacto ainda, a resposta orienta', /ainda não registrou/.test(reply('quanto economizei', st).text))

st = reducer(st, { type: 'finishOnboarding' })
const facts = chatFacts(st)
check('fatos contam a despensa do onboarding', facts.pantryCount === st.pantry.length && facts.pantryCount > 0)
const pantryAns = reply('o que tenho na despensa', st).text
check('resposta da despensa traz o número real', pantryAns.includes(`${st.pantry.length} itens`), pantryAns)
check('resposta da despensa usa nome em português', facts.pantrySample.every((n) => pantryAns.includes(n)))

const dealsAns = reply('tem oferta?', st).text
const open = st.deals.filter((d) => d.status === 'open').length
check('resposta de ofertas traz a contagem real', dealsAns.includes(`${open} ofertas`), dealsAns)
check('resposta de ofertas cita a maior', dealsAns.includes(`${facts.bestDeal.pct}%`) && dealsAns.includes(facts.bestDeal.store))

// avança o relógio até algo ficar perto da data
let aged = st
for (let i = 0; i < 4 && !chatFacts(aged).expiring.length; i++) aged = reducer(aged, { type: 'advance', n: 3, expiryText: '{n}' })
const exp = chatFacts(aged).expiring
check('depois de avançar o tempo há itens perto da data', exp.length > 0)
const expAns = reply('o que vence', aged).text
check('resposta de validade lista o item mais urgente', expAns.includes(exp[0].name), expAns)
const expNames = chatFacts(aged).expiring.map((e) => e.name)
check('um produto com vários lotes aparece uma vez só', new Set(expNames).size === expNames.length, expNames.join(','))
// Regressão: itens vencidos apareciam junto dos que vencem, com sugestão de doar.
check('itens vencidos não entram na lista de "vencem em breve"', chatFacts(aged).expiring.every((e) => e.left >= 0))
let old = aged
for (let i = 0; i < 6; i++) old = reducer(old, { type: 'advance', n: 5, expiryText: '{n}' })
const oldFacts = chatFacts(old)
check('com tudo vencido há itens na lista de vencidos', oldFacts.expired.length > 0 && oldFacts.expiring.length === 0)
const oldAns = reply('o que vence', old).text
check('só vencidos: a resposta avisa que passaram da data', /passaram da data/.test(oldAns), oldAns)
check('só vencidos: a resposta não sugere doar', !/doar/.test(oldAns), oldAns)
check('itens urgentes vêm ordenados do mais urgente', exp.every((e, i) => i === 0 || exp[i - 1].left <= e.left))

const reserved = reducer(st, { type: 'reserveDeal', id: st.deals[0].id, label: 'x' })
const impAns = reply('quanto economizei', reserved).text
check('reservar uma oferta muda a resposta de impacto', /tirou .* kg/.test(impAns), impAns)
check('kg em PT usa vírgula', !/\d\.\d/.test(impAns.split('kg')[0]), impAns)
check('reservar diminui as ofertas abertas na resposta',
  reply('ofertas', reserved).text.includes(`${open - 1} ofertas`))

const en = { ...reserved, lang: 'en' }
// Regressão: o chat escrevia "2.2 kg" em inglês enquanto a aba Impacto mostra "2,2".
const logic = await import(path.join(root, 'src', 'lib', 'logic.js'))
const shownOnImpactTab = logic.qty(reserved.impact.kg)
check('kg do chat usa o mesmo formato da aba Impacto (EN)', reply('how much did I save', en).text.includes(`${shownOnImpactTab} kg`), shownOnImpactTab)
check('kg do chat usa o mesmo formato da aba Impacto (PT)', impAns.includes(`${shownOnImpactTab} kg`))
check('resposta contextual respeita o inglês', /kept .* kg/.test(reply('how much did I save', en).text))
check('nomes em inglês quando lang é en', chatFacts({ ...st, lang: 'en' }).pantrySample.every((n) => !/[ãçõé]/.test(n)))

check('household conta as pessoas', reply('pessoas da casa', st).text.includes(`${st.household.people.length} pessoas`))

// ---- helpers e texto ----
check('joinNames PT', joinNames(['a', 'b', 'c'], 'pt') === 'a, b e c')
check('joinNames EN', joinNames(['a', 'b'], 'en') === 'a and b')
check('joinNames um item', joinNames(['a'], 'pt') === 'a')

const allText = [
  ...Object.values(FALLBACK),
  ...INTENTS.flatMap((it) => typeof it.answer === 'function'
    ? ['pt', 'en'].map((l) => it.answer(chatFacts({ ...aged, lang: l }), l))
    : Object.values(it.answer)),
]
check('nenhuma resposta usa travessão', allText.every((t) => !t.includes('—')))
check('nenhuma resposta menciona Netlify', allText.every((t) => !/netlify/i.test(t)))

for (const k of ['chat.title', 'chat.placeholder', 'chat.send', 'chat.queue', 'chat.queueNote', 'chat.connecting', 'chat.back']) {
  check(`i18n PT tem ${k}`, !!i18n.DICT.pt[k])
  check(`i18n EN tem ${k}`, !!i18n.DICT.en[k])
}

console.log(`\n${pass} chatbot checks passed, ${fails.length} failed`)
if (fails.length) {
  console.log('\nFAILED:')
  for (const f of fails) console.log('  x ' + f)
  process.exit(1)
}
