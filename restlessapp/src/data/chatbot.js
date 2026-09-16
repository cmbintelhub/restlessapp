/**
 * Intenções do chatbot simulado.
 *
 * Ordem importa: em empate de pontuação vence a que aparece antes, então as mais
 * específicas ficam no topo e as genéricas (saudação, "como funciona") no fim.
 *
 *   id        identificador estável, usado nos testes
 *   ask       pergunta de exemplo mostrada como sugestão; precisa cair nesta intenção
 *   keywords  palavras e expressões em PT e EN, comparadas sem acento e sem caixa
 *   weight    multiplicador opcional para intenções genéricas que não devem ganhar sozinhas
 *   answer    { pt, en } fixo, ou função (facts, lang) para respostas que leem o app
 *   next      ids de intenções sugeridas depois da resposta
 *   handoff   true quando a resposta é a transferência para atendente
 */

const L = (lang, pt, en) => (lang === 'pt' ? pt : en)

const days = (n, lang) =>
  n < 0 ? L(lang, 'já passou da data', 'past its date')
    : n === 0 ? L(lang, 'vence hoje', 'expires today')
      : n === 1 ? L(lang, 'vence amanhã', 'expires tomorrow')
        : L(lang, `vence em ${n} dias`, `expires in ${n} days`)

/** Junta nomes numa lista natural: "a", "a e b", "a, b e c". */
export function joinNames(items, lang) {
  const and = lang === 'pt' ? ' e ' : ' and '
  if (items.length <= 1) return items.join('')
  return items.slice(0, -1).join(', ') + and + items[items.length - 1]
}

export const INTENTS = [
  {
    id: 'human',
    handoff: true,
    ask: { pt: 'Quero falar com um atendente', en: 'I want to talk to an agent' },
    keywords: {
      pt: ['atendente', 'humano', 'pessoa real', 'falar com alguem', 'suporte', 'reclamacao', 'sac'],
      en: ['agent', 'human', 'real person', 'talk to someone', 'support', 'complaint'],
    },
    answer: {
      pt: 'Claro. Estou te transferindo para um atendente humano.',
      en: "Sure. I'm transferring you to a human agent.",
    },
  },
  {
    id: 'expiring',
    ask: { pt: 'O que vence essa semana?', en: 'What expires this week?' },
    keywords: {
      pt: ['vence', 'vencendo', 'vencer', 'validade', 'estragar', 'estraga', 'estragando', 'perto da data', 'prazo'],
      en: ['expire', 'expires', 'expiring', 'expiry', 'go bad', 'spoil', 'use by', 'best before'],
    },
    answer: (f, lang) => {
      if (!f.pantryCount) {
        return L(lang,
          'Sua despensa ainda está vazia, então nada está perto da data. Importe uma nota ou reserve uma oferta para começar.',
          'Your pantry is empty, so nothing is close to its date. Import a receipt or reserve a deal to get started.')
      }
      if (!f.expiring.length && !f.expired.length) {
        return L(lang,
          `Nenhum dos ${f.pantryCount} itens da despensa vence nos próximos 3 dias. Tudo sob controle.`,
          `None of the ${f.pantryCount} pantry items expire in the next 3 days. All good.`)
      }
      const parts = []
      if (f.expiring.length) {
        const lines = f.expiring.slice(0, 5).map((e) => `${e.name}: ${days(e.left, lang)}`).join('\n')
        const more = f.expiring.length > 5 ? L(lang, `\ne mais ${f.expiring.length - 5}.`, `\nand ${f.expiring.length - 5} more.`) : ''
        parts.push(L(lang, `Vencem em breve:\n${lines}${more}`, `Expiring soon:\n${lines}${more}`))
      }
      if (f.expired.length) {
        const names = joinNames(f.expired.slice(0, 5), lang)
        parts.push(L(lang,
          `Já passaram da data: ${names}. Confira antes de consumir e retire da despensa o que não servir mais.`,
          `Already past their date: ${names}. Check them before eating and remove what is no longer good.`))
      }
      // Doar só faz sentido para o que ainda está dentro da data.
      if (f.expiring.length) {
        parts.push(L(lang,
          'Se não for usar a tempo, você pode doar para um vizinho pela aba Vizinhos.',
          "If you won't use them in time, share them with a neighbor from the Neighbors tab."))
      }
      return parts.join('\n\n')
    },
    next: ['neighbors', 'pantry'],
  },
  {
    id: 'quantity',
    ask: { pt: 'Como o app calcula a quantidade?', en: 'How does the app work out quantities?' },
    keywords: {
      pt: ['quantidade', 'quanto comprar', 'embalagem', 'risco de desperdicio', 'alerta de desperdicio', 'porcao', 'tamanho certo', 'calcula'],
      en: ['quantity', 'quantities', 'how much to buy', 'pack size', 'waste risk', 'portion', 'right size', 'calculate'],
    },
    answer: {
      pt: 'A quantidade sugerida vem do consumo semanal da sua casa. Cada pessoa tem altura, peso e apetite, e o app desconta o que já está na despensa. Se você escolher uma embalagem mais de 40% acima de uma semana de consumo, aparece o alerta de risco de desperdício.',
      en: 'The suggested amount comes from what your household eats in a week. Each person has height, weight and appetite, and the app subtracts what is already in the pantry. Pick a pack more than 40% above a week of consumption and the waste risk flag shows up.',
    },
    next: ['household', 'list'],
  },
  {
    id: 'receipt',
    ask: { pt: 'Como importo uma nota fiscal?', en: 'How do I import a receipt?' },
    keywords: {
      pt: ['nota fiscal', 'nota', 'cupom', 'escanear', 'scanner', 'qr code', 'cpf na nota', 'importar', 'foto da nota'],
      en: ['receipt', 'scan', 'scanner', 'invoice', 'qr code', 'import'],
    },
    answer: {
      pt: 'Na aba Lista, toque em Importar nota. A câmera lê o QR code e o texto da nota direto no aparelho, sem enviar a foto para lugar nenhum. Antes de entrar na despensa, cada item passa por uma tela de revisão.',
      en: 'On the Planner tab, tap Import receipt. The camera reads the QR code and the receipt text on the device, without sending the photo anywhere. Every item goes through a review screen before reaching the pantry.',
    },
    next: ['pantry', 'privacy'],
  },
  {
    id: 'pix',
    ask: { pt: 'Como funciona o pagamento por Pix?', en: 'How does Pix payment work?' },
    keywords: {
      pt: ['pix', 'pagamento', 'pagar', 'paguei', 'cobranca', 'cobrado', 'reembolso', 'estorno'],
      en: ['pay', 'payment', 'paid', 'charge', 'charged', 'refund'],
    },
    answer: {
      pt: 'Ao reservar uma oferta no Radar, o app gera um código Pix para você pagar e retirar na loja. Neste protótipo o pagamento é simulado: nenhum valor é cobrado.',
      en: 'When you reserve a deal on the Radar, the app generates a Pix code to pay and pick up in store. In this prototype the payment is simulated and nothing is charged.',
    },
    next: ['deals'],
  },
  {
    id: 'deals',
    ask: { pt: 'Tem oferta perto de mim?', en: 'Any deals near me?' },
    keywords: {
      pt: ['oferta', 'ofertas', 'desconto', 'descontos', 'promocao', 'promocoes', 'radar', 'barato', 'mais barato', 'loja', 'lojas'],
      en: ['deal', 'deals', 'discount', 'discounts', 'sale', 'markdown', 'cheap', 'store', 'stores', 'radar'],
    },
    answer: (f, lang) => {
      if (!f.dealsOpen) {
        return L(lang,
          'Não há ofertas abertas no momento. Novas aparecem quando uma loja parceira marca produtos perto da data.',
          'There are no open deals right now. New ones show up when a partner store marks down food close to its date.')
      }
      const best = f.bestDeal
        ? L(lang, ` A maior é ${f.bestDeal.item} com ${f.bestDeal.pct}% de desconto no ${f.bestDeal.store}.`,
          ` The best is ${f.bestDeal.item} at ${f.bestDeal.pct}% off at ${f.bestDeal.store}.`)
        : ''
      const match = f.dealsMatching
        ? L(lang, ` ${f.dealsMatching} combinam com a sua lista de compras.`, ` ${f.dealsMatching} match your shopping list.`)
        : ''
      return L(lang,
        `Há ${f.dealsOpen} ofertas abertas no Radar.${best}${match} Abra a aba Radar para ver no mapa.`,
        `There are ${f.dealsOpen} open deals on the Radar.${best}${match} Open the Radar tab to see them on the map.`)
    },
    next: ['pix', 'impact'],
  },
  {
    id: 'neighbors',
    ask: { pt: 'Como doo comida para um vizinho?', en: 'How do I share food with a neighbor?' },
    keywords: {
      pt: ['vizinho', 'vizinhos', 'doacao', 'doar', 'doo', 'excedente', 'sobra', 'sobrou', 'compartilhar'],
      en: ['neighbor', 'neighbors', 'neighbour', 'donate', 'share', 'giveaway', 'leftover', 'leftovers'],
    },
    answer: (f, lang) => {
      const avail = f.postsOpen
        ? L(lang, `Agora há ${f.postsOpen} doações de vizinhos disponíveis para pegar.`, `Right now ${f.postsOpen} neighbor posts are available to claim.`)
        : L(lang, 'Agora não há doações de vizinhos abertas.', 'There are no open neighbor posts right now.')
      const mine = f.myPostsOpen
        ? L(lang, ` Você tem ${f.myPostsOpen} doação esperando alguém.`, ` You have ${f.myPostsOpen} post waiting for someone.`)
        : ''
      return L(lang,
        `Na despensa, toque num item e escolha Doar. Ele aparece para os vizinhos próximos, que combinam a retirada com você. ${avail}${mine}`,
        `In the pantry, tap an item and choose Share. It shows up for nearby neighbors, who arrange the pickup with you. ${avail}${mine}`)
    },
    next: ['expiring', 'impact'],
  },
  {
    id: 'impact',
    ask: { pt: 'Quanto eu já economizei?', en: 'How much have I saved?' },
    keywords: {
      pt: ['impacto', 'economizei', 'economia', 'economizar', 'quilos', 'kg', 'pontos', 'resgatar', 'credito', 'lixo'],
      en: ['impact', 'saved', 'savings', 'save', 'kilos', 'kg', 'points', 'redeem', 'credit'],
    },
    answer: (f, lang) => {
      if (!f.kg && !f.moneyValue && !f.points) {
        return L(lang,
          'Você ainda não registrou impacto. Reservar uma oferta, pegar uma doação ou reduzir uma quantidade na lista já começa a contar.',
          "You haven't logged any impact yet. Reserving a deal, claiming a neighbor post or cutting a quantity on your list all start the count.")
      }
      return L(lang,
        `Até agora você tirou ${f.kgText} kg de comida do lixo e economizou ${f.money}. Você tem ${f.points} pontos; a cada 100 dá para trocar por R$ 5 de crédito na aba Conta.`,
        `So far you've kept ${f.kgText} kg of food out of the bin and saved ${f.money}. You have ${f.points} points; every 100 can be swapped for R$ 5 of credit on the Account tab.`)
    },
    next: ['deals', 'neighbors'],
  },
  {
    id: 'list',
    ask: { pt: 'O que tem na minha lista?', en: "What's on my list?" },
    keywords: {
      pt: ['minha lista', 'lista de compras', 'lista', 'comprar', 'mercado'],
      en: ['my list', 'shopping list', 'list', 'buy', 'groceries'],
    },
    answer: (f, lang) => {
      if (!f.listCount) {
        return L(lang,
          'Sua lista de compras está vazia. Na aba Lista, adicione itens e o app sugere a quantidade certa para a sua casa.',
          'Your shopping list is empty. On the Planner tab, add items and the app suggests the right amount for your household.')
      }
      const names = joinNames(f.listSample, lang)
      const more = f.listCount > f.listSample.length ? L(lang, ` e mais ${f.listCount - f.listSample.length}`, ` and ${f.listCount - f.listSample.length} more`) : ''
      return L(lang,
        `Sua lista tem ${f.listCount} ${f.listCount === 1 ? 'item' : 'itens'}: ${names}${more}.`,
        `Your list has ${f.listCount} ${f.listCount === 1 ? 'item' : 'items'}: ${names}${more}.`)
    },
    next: ['quantity', 'deals'],
  },
  {
    id: 'pantry',
    ask: { pt: 'O que eu tenho na despensa?', en: 'What do I have in the pantry?' },
    keywords: {
      pt: ['despensa', 'geladeira', 'o que tenho', 'o que eu tenho', 'estoque', 'tenho em casa'],
      en: ['pantry', 'fridge', 'what do i have', 'stock', 'at home'],
    },
    answer: (f, lang) => {
      if (!f.pantryCount) {
        return L(lang,
          'Sua despensa está vazia. Ela se abastece com notas fiscais importadas, ofertas reservadas e doações de vizinhos.',
          'Your pantry is empty. It fills up from imported receipts, reserved deals and neighbor posts.')
      }
      const names = joinNames(f.pantrySample, lang)
      const alert = f.expiring.length
        ? L(lang, ` ${f.expiring.length} deles vencem em até 3 dias.`, ` ${f.expiring.length} of them expire within 3 days.`)
        : ''
      return L(lang,
        `Você tem ${f.pantryCount} itens na despensa, entre eles ${names}.${alert} A faixa de cor em cada item mostra a validade.`,
        `You have ${f.pantryCount} items in the pantry, including ${names}.${alert} The color band on each item shows its date.`)
    },
    next: ['expiring', 'receipt'],
  },
  {
    id: 'household',
    ask: { pt: 'Como mudo as pessoas da casa?', en: 'How do I change my household?' },
    keywords: {
      pt: ['minha casa', 'pessoas', 'familia', 'moradores', 'apetite', 'altura', 'peso', 'imc', 'dieta'],
      en: ['household', 'family', 'people', 'appetite', 'height', 'weight', 'bmi', 'diet'],
    },
    answer: (f, lang) => L(lang,
      `Sua casa está com ${f.people} ${f.people === 1 ? 'pessoa' : 'pessoas'}. Para mudar, abra a engrenagem no topo. Cada pessoa tem altura, peso e apetite próprios, e isso ajusta todas as quantidades sugeridas.`,
      `Your household has ${f.people} ${f.people === 1 ? 'person' : 'people'}. To change it, open the gear at the top. Each person has their own height, weight and appetite, which adjusts every suggested amount.`),
    next: ['quantity'],
  },
  {
    id: 'privacy',
    ask: { pt: 'Meus dados ficam seguros?', en: 'Is my data safe?' },
    keywords: {
      pt: ['dados', 'privacidade', 'lgpd', 'seguro', 'segura', 'servidor', 'conta', 'login', 'senha'],
      en: ['data', 'privacy', 'safe', 'secure', 'account', 'login', 'password'],
    },
    answer: {
      pt: 'Tudo fica só no seu aparelho. O protótipo não tem conta, login nem servidor, e as fotos de nota são lidas localmente. Cada pessoa que abre o link tem a sua própria cópia dos dados.',
      en: 'Everything stays on your device. The prototype has no account, login or server, and receipt photos are read locally. Everyone who opens the link gets their own copy of the data.',
    },
    next: ['reset'],
  },
  {
    id: 'language',
    ask: { pt: 'Como troco o idioma?', en: 'How do I change the language?' },
    keywords: {
      pt: ['idioma', 'lingua', 'ingles', 'portugues', 'traduzir'],
      en: ['language', 'english', 'portuguese', 'translate'],
    },
    answer: {
      pt: 'Abra a engrenagem no topo e escolha o idioma. O app tem português e inglês, e a interface inteira troca na hora.',
      en: 'Open the gear at the top and pick a language. The app speaks English and Portuguese, and the whole interface switches instantly.',
    },
  },
  {
    id: 'reset',
    ask: { pt: 'Como começo do zero?', en: 'How do I start over?' },
    keywords: {
      pt: ['reiniciar', 'resetar', 'reset', 'apagar', 'comecar de novo', 'do zero', 'zerar', 'limpar'],
      en: ['reset', 'start over', 'restart', 'delete', 'erase', 'clear'],
    },
    answer: {
      pt: 'Abra a engrenagem no topo, vá até a seção Protótipo e toque em Reiniciar o protótipo. Isso apaga os dados deste aparelho e volta para o onboarding.',
      en: 'Open the gear at the top, go to the Prototype section and tap Reset the prototype. It wipes the data on this device and goes back to onboarding.',
    },
  },
  {
    id: 'install',
    ask: { pt: 'Como instalo o app no celular?', en: 'How do I install the app?' },
    keywords: {
      pt: ['instalar', 'instalo', 'baixar', 'tela de inicio', 'iphone', 'android', 'celular', 'atalho'],
      en: ['install', 'download', 'home screen', 'iphone', 'android', 'phone', 'shortcut'],
    },
    answer: {
      pt: 'No iPhone, abra o link no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início. No Android, abra no Chrome e toque em Instalar quando aparecer, ou no menu de três pontos escolha Adicionar à tela inicial.',
      en: 'On iPhone, open the link in Safari, tap Share and then Add to Home Screen. On Android, open it in Chrome and tap Install when it pops up, or use the three-dot menu and choose Add to Home screen.',
    },
  },
  {
    id: 'notifications',
    ask: { pt: 'Quando recebo alertas?', en: 'When do I get alerts?' },
    keywords: {
      pt: ['notificacao', 'notificacoes', 'alerta', 'alertas', 'aviso', 'avisos', 'sino'],
      en: ['notification', 'notifications', 'alert', 'alerts', 'bell'],
    },
    answer: {
      pt: 'O sino no topo reúne os alertas: item da despensa perto da data, oferta nova que combina com a sua lista e vizinho que pegou a sua doação. O horário silencioso fica na engrenagem.',
      en: 'The bell at the top collects alerts: a pantry item close to its date, a new deal matching your list and a neighbor claiming your post. Quiet hours are in the gear menu.',
    },
    next: ['expiring'],
  },
  {
    id: 'demo',
    ask: { pt: 'Para que serve o frasco no topo?', en: 'What is the flask at the top for?' },
    keywords: {
      pt: ['frasco', 'frasco no topo', 'simular', 'simulacao', 'demonstracao', 'avancar dias', 'passar o tempo'],
      en: ['flask', 'simulate', 'simulation', 'demo', 'move days forward'],
    },
    answer: {
      pt: 'O frasco abre os controles de demonstração. Ele faz o papel do backend: avança o tempo, cria ofertas novas e simula ações de outros usuários, para mostrar o app de ponta a ponta.',
      en: 'The flask opens the demo controls. It stands in for the backend: it moves time forward, drops new deals and simulates what other users do, so the app can be shown end to end.',
    },
  },
  {
    id: 'thanks',
    ask: { pt: 'Obrigado!', en: 'Thanks!' },
    keywords: {
      pt: ['obrigado', 'obrigada', 'valeu', 'agradeco', 'brigado'],
      en: ['thanks', 'thank you', 'thx', 'cheers'],
    },
    answer: {
      pt: 'Por nada. Se precisar de mais alguma coisa, é só perguntar.',
      en: "You're welcome. Ask me anything else whenever you need.",
    },
  },
  {
    id: 'bye',
    ask: { pt: 'Tchau', en: 'Bye' },
    keywords: {
      pt: ['tchau', 'ate mais', 'ate logo', 'falou'],
      en: ['bye', 'goodbye', 'see you'],
    },
    answer: {
      pt: 'Até mais. Boa compra e menos desperdício.',
      en: 'See you. Happy shopping, less waste.',
    },
  },
  {
    id: 'howItWorks',
    weight: 0.5,
    ask: { pt: 'Como funciona o restless?', en: 'How does restless work?' },
    keywords: {
      pt: ['como funciona', 'restless', 'aplicativo', 'app', 'pilares', 'para que serve', 'ajuda', 'me ajuda'],
      en: ['how does it work', 'how does restless work', 'how it works', 'restless', 'app', 'pillars', 'what is this', 'help'],
    },
    answer: {
      pt: 'O restless ataca o desperdício em quatro frentes: uma lista que conhece a sua despensa, a quantidade certa para a sua casa, ofertas de comida perto da data no Radar e doação entre vizinhos. Tudo soma no mesmo número da aba Conta.',
      en: 'restless tackles waste on four fronts: a list that knows your pantry, the right amount for your household, markdowns on food near its date on the Radar, and sharing with neighbors. It all adds up to one number on the Account tab.',
    },
    next: ['expiring', 'deals', 'impact'],
  },
  {
    id: 'greeting',
    ask: { pt: 'Oi', en: 'Hi' },
    keywords: {
      pt: ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'eai', 'opa', 'tudo bem'],
      en: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'],
    },
    answer: {
      pt: 'Oi! Sou o assistente do restless. Posso ver o que vence na sua despensa, as ofertas por perto e quanto você já economizou.',
      en: "Hi! I'm the restless assistant. I can check what's expiring in your pantry, the deals nearby and how much you've saved.",
    },
    next: ['expiring', 'deals', 'impact'],
  },
]

/** Sugestões mostradas quando a conversa abre. */
export const STARTERS = ['expiring', 'deals', 'impact', 'howItWorks']
