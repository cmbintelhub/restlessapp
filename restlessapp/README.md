# restless

Protótipo funcional do app de redução de desperdício alimentar. Web app mobile first, sem backend, publicado no GitHub Pages e instalável no iPhone e no Android direto pelo navegador.

**App:** https://valentinpvlc-blip.github.io/CSMAPP/
**Página de instalação:** https://valentinpvlc-blip.github.io/CSMAPP/baixar/

## Publicar no GitHub Pages

O repositório publica sozinho. A cada push na branch `main`, o workflow `.github/workflows/deploy.yml` instala as dependências, roda os testes de lógica, de nota fiscal e do assistente, gera o `dist` e publica.

Configuração, feita uma vez só:

1. Suba o conteúdo desta pasta para a raiz do repositório `valentinpvlc-blip/CSMAPP`, na branch `main`
2. No repositório, abra **Settings**, depois **Pages**
3. Em **Build and deployment**, na opção **Source**, escolha **GitHub Actions**
4. Abra a aba **Actions** e acompanhe o workflow "Deploy no GitHub Pages". Leva cerca de um minuto

Se o primeiro workflow rodou antes do passo 3, ele falha na publicação. Depois de ajustar o Source, abra o workflow em Actions e use **Re-run all jobs**.

Pontos que fazem o app funcionar numa subpasta (`/restlessapp/`):

- `vite.config.js` usa `base: './'`, então todos os caminhos do build são relativos
- `manifest.webmanifest` usa `start_url` e `scope` relativos, e o service worker registra dentro da subpasta
- `public/.nojekyll` impede o GitHub Pages de ignorar arquivos que começam com ponto ou sublinhado

Se o repositório mudar de nome ou de dono, atualize a URL em quatro lugares: metatags `og:image`, `twitter:image` e `og:url` do `index.html`, e o endereço e o QR code de `public/baixar/index.html`.

## Rodar em desenvolvimento

```bash
npm install
npm run dev         # servidor local
npm run build       # gera dist/
npm run test:unit   # lógica, nota fiscal e assistente (é o que roda no GitHub)
npm test            # tudo, incluindo os testes de navegador
```

Os testes de navegador usam Playwright e esperam o `dist` servido por um servidor estático. Para reproduzir a subpasta do GitHub Pages, sirva uma pasta que contenha `dist` copiado como `restlessapp` e rode com `BASE=http://127.0.0.1:8081/restlessapp/index.html`.

Contagem da última execução: 778 verificações de lógica, 96 de nota fiscal, 209 do assistente, 37 de métricas de sucesso do cliente, 75 de interface e 13 do OCR de ponta a ponta.

## Roteiro de demonstração (5 minutos)

O app abre no onboarding. Se precisar voltar ao início durante a apresentação, use a engrenagem no topo, seção Protótipo, "Reiniciar o protótipo".

1. **Onboarding.** Mostre o passo 3: arraste os quatro pilares para outra ordem. Diga que a home vai seguir essa ordem. Mantenha o CPF na nota ligado.
2. **Home.** A prateleira mostra a despensa já abastecida pelas notas capturadas. Aponte o alerta vermelho do item que vence e o card do pilar que ficou em primeiro no ranking.
3. **Lista.** Abra o item Tomate e toque na embalagem de 5 kg. O app acusa "Waste risk: 400% more than your household eats in a week" e mostra quantos quilos a redução tira do lixo. Volte para 1 kg.
4. **Despensa.** Mostre a faixa de cor por validade e o "acaba por volta de", que vem do ritmo de consumo da casa, não de uma data fixa.
5. **Radar.** Alterne para Mapa. Os pins mostram o desconto máximo por loja. Volte para Lista, abra uma oferta, reserve e pague com Pix. O item entra na despensa e o impacto sobe.
6. **Vizinhos.** Reivindique um excedente de um vizinho. Depois abra o ícone do frasco no topo e use "Um vizinho pega a sua doação". Mostre também as "Dicas da vizinhança" mais abaixo: publique uma dica e curta uma já existente — co-criação de conteúdo pelos próprios vizinhos, não pelo app.
7. **Conta.** Mostre a aba dividida em duas visões: "Meu progresso", o que o cliente vê (pilares, pontos, divisão por origem), e "Account Insights", separada e claramente marcada como visão interna da equipe, com o Customer Health Score, o uso real da casa (sessões, sequência de dias, tempo até o primeiro valor, adoção dos pilares) e, marcados como simulados, os benchmarks entre usuários (DAU/WAU/MAU, coortes de retenção, NPS).
8. **Assistente.** Toque no balão no topo. Use a sugestão "O que vence essa semana?" e mostre que a resposta lê a despensa real. Depois digite algo fora do roteiro, como "quero pedir uma pizza", e mostre a transferência para atendente. Troque para a aba "Sugestões" ao lado do chat: vote em uma ideia de outro usuário e publique a sua própria — outra frente de co-criação, desta vez sobre o próprio app.
9. **Frasco (controles de demonstração).** "Avançar 3 dias" envelhece a despensa na frente da banca e dispara os alertas.
10. **Idioma.** Engrenagem, Idioma, Português. A interface inteira troca. Mostre também "Seu time de conta" na engrenagem: o contato do Customer Success Manager (nome, e-mail e telefone) para quando o autoatendimento e o assistente não bastam.

## Distribuir para a turma

A página `/baixar/` é a rota de distribuição. Ela traz um QR code que aponta para ela mesma, então basta projetar a página no telão e a sala aponta a câmera. O QR é conferido nos testes: o SVG é rasterizado e decodificado de verdade.

Não existe arquivo para baixar. O app se instala pelo navegador nos dois sistemas:

- **iPhone:** abrir o link no Safari, tocar em Compartilhar, depois em Adicionar à Tela de Início, depois em Adicionar
- **Android:** abrir o link no Chrome e tocar em Instalar quando o aviso aparecer, ou abrir o menu de três pontos e tocar em Adicionar à tela inicial

Mensagem pronta para mandar no grupo:

> Oi! Estamos testando uma versão inicial do restless, o app de redução de desperdício alimentar do nosso trabalho, e queremos a sua ajuda por alguns dias.
>
> Teste aqui: https://valentinpvlc-blip.github.io/CSMAPP/
>
> Como instalar:
> 📱 No iPhone: abra o link no Safari, toque em Compartilhar, toque em "Adicionar à Tela de Início" e depois em Adicionar
> 🤖 No Android: abra o link no Chrome e toque em "Instalar" quando aparecer, ou abra o menu e toque em "Adicionar à tela inicial"
>
> Cada pessoa tem a sua própria cópia, com os próprios dados, então configure do jeito que fizer sentido para você.

Antes da apresentação, peça para a turma abrir o app uma vez. O service worker guarda os arquivos no aparelho e o app continua funcionando se a rede da sala cair.

## O assistente

O balão no topo abre um chatbot simulado. Ele não usa modelo de linguagem: responde por palavras-chave programadas, em português e em inglês, e quando não encontra resposta transfere para um atendente humano, também simulado, com fila e tempo estimado.

**Como ele decide.** A mensagem é normalizada (minúsculas, sem acento, sem pontuação) e pontuada contra cada intenção de `src/data/chatbot.js`. Uma expressão de várias palavras encontrada vale 2. Cada palavra da mensagem vale no máximo 1, pela melhor palavra-chave que casar com ela, então "oferta" e "ofertas" não somam duas vezes. Palavras parecidas também contam, por similaridade de bigramas, o que faz "despenssa" cair em despensa. Abaixo de 1 ponto, a resposta é a transferência para atendente. Em empate vence a intenção que aparece antes na lista, que é ordenada da mais específica para a mais genérica.

**Respostas fixas:** como funciona, quantidade e alerta de desperdício, nota fiscal, Pix, privacidade, idioma, reiniciar, instalação, alertas, controles de demonstração, saudação, agradecimento e despedida.

**Respostas contextuais**, que leem o estado do app na hora da pergunta: o que vence nos próximos dias (separando o que já passou da data), o que tem na despensa, o que está na lista, ofertas abertas e a maior delas, doações de vizinhos, impacto acumulado e pessoas da casa. Perguntar de novo depois de reservar uma oferta devolve números atualizados, no mesmo formato da aba Impacto.

**Para adicionar uma pergunta**, crie uma entrada em `src/data/chatbot.js` com `id`, `ask` (a pergunta de exemplo), `keywords` em PT e EN e `answer`. O teste `tests/chatbot.mjs` exige que a pergunta de exemplo de cada intenção caia nela mesma nos dois idiomas; se uma palavra-chave nova roubar a pergunta de outra intenção, o teste acusa.

A conversa fica guardada enquanto o app está aberto e recomeça ao recarregar a página ou reiniciar o protótipo.

## Como o código está organizado

```
src/
  store.jsx             estado único, reducer e persistência
  data/seed.js          catálogo de alimentos, lojas, ofertas, notas, vizinhos
  lib/logic.js          motor de cálculo: necessidade da casa, quantidade, validade, distância
  lib/i18n.js           dicionário EN/PT completo
  lib/nfce.js           parser de NFC-e, chave de acesso, EAN e CNPJ com dígito verificador
  lib/matcher.js        glossário, similaridade e classificador de sobra
  lib/ocr.js            pré-processamento em canvas, jsQR e Tesseract sob demanda
  lib/chatbot.js        motor do assistente: normalização, pontuação, fallback e fatos do app
  lib/metrics.js        Customer Health Score, streak, tempo até o primeiro valor, adoção, churn, tendência de valor, CSQL
  data/chatbot.js       intenções do assistente em PT e EN, fixas e contextuais
  data/catalog.js       209 alimentos e bebidas
  data/population.js    população simulada e determinística para os benchmarks entre usuários (DAU/WAU/MAU, coortes, NPS)
  components/ui.jsx     primitivos de UI e ícones
  components/HouseholdEditor.jsx   ficha por pessoa: apetite, altura, peso, IMC
  components/Tour.jsx   tour guiado pós-onboarding: um destaque por pilar, na ordem escolhida, e um passo final sobre o assistente
  screens/              Onboarding, Home, Planner, Radar, Community, Account, Settings, Chat
  App.jsx               moldura mobile, navegação, toasts, notificações, painel de demonstração
tests/
  run.mjs               testes do motor de cálculo e de todos os caminhos do reducer
  nfce.mjs              parser e matcher contra o OCR real de uma nota fotografada
  ui.mjs                fluxo completo no navegador, com screenshots e teste de regressão
  scan.mjs              pipeline de OCR de ponta a ponta no navegador, com a foto real
  chatbot.mjs           roteamento, erros de digitação, fallback e respostas contextuais
  metrics.mjs           Customer Health Score, métricas de uso reais e a população simulada
.github/workflows/
  deploy.yml            testes, build e publicação no GitHub Pages a cada push na main
```

### O motor de quantidade

Cada pessoa da casa tem altura, peso e apetite próprios. `personFactor` converte isso em uma porção relativa, onde 1,0 é o adulto de referência de 70 kg e 1,70 m. A base é a energia de repouso pela fórmula de Mifflin-St Jeor sem os termos de idade e sexo, que o app não pergunta, multiplicada pelo fator de apetite.

O IMC não é multiplicado por cima disso, porque ele é derivado das mesmas duas medidas e seria contagem dupla. Ele entra só na correção que a prática clínica aplica acima de IMC 27, onde a necessidade de energia cresce mais devagar que a massa corporal porque o excesso é majoritariamente gordura e não tecido magro. Nesse caso o cálculo usa o peso ajustado, `peso ideal + 0,25 × (peso real − peso ideal)`.

`eaters` soma as porções de todas as pessoas, e `weeklyNeed` multiplica esse total pelo consumo por adulto do produto e pelas restrições de dieta da casa. `suggestQuantity` pega o que falta depois de descontar a despensa e escolhe uma embalagem real do produto, arredondando conforme a preferência: conservador nunca deixa faltar, agressivo nunca deixa sobrar. `oversizePct` compara a quantidade escolhida com uma semana de consumo e dispara o alerta de desperdício acima de 40%.

### A camada de dados compartilhada

Os quatro pilares leem e escrevem o mesmo objeto de estado. Reservar uma oferta no Radar coloca o alimento na despensa. Reivindicar de um vizinho também. Reduzir uma quantidade na lista credita quilos evitados. Todo evento entra no mesmo registro de impacto, que é o que a aba Conta mostra dividido por origem. O Customer Health Score e as demais métricas de sucesso do cliente ficam separados, em "Account Insights" dentro da mesma aba: uma visão interna da equipe, não do cliente.

### O tour guiado

Assim que o onboarding termina, um tour curto abre sozinho por cima da tela inicial: um cartão de boas-vindas, depois um destaque por pilar, na mesma ordem que a pessoa acabou de definir no passo 3, entrando em cada tela real e apontando para os elementos e mensagens que ela usa no dia a dia (por exemplo, "Waste risk" na Lista ou "Already at home" no Radar), um destaque na aba Conta, que é onde os quatro pilares se encontram, e por fim um passo sobre o assistente, lembrando que ele existe para tirar dúvidas e que, quando não encontra uma resposta, transfere para o atendimento. Cada passo já troca de aba de verdade, então quem está vendo o tour está olhando para a tela real, não para uma captura de tela. Dá para pular a qualquer momento com "Skip tour", ou assistir de novo pela engrenagem, seção Protótipo, "Ver o tour de novo".

## Leitura de nota fiscal real

O botão "Importar nota" abre o scanner. Ele lê a foto inteiramente no aparelho: os binários do Tesseract e o modelo de português são servidos pelo próprio site, em `public/tesseract/`, sem chamada a CDN e sem enviar a imagem para lugar nenhum. São cerca de 15 MB baixados uma vez só, sob demanda, quando o usuário abre o scanner pela primeira vez.

O caminho é duplo:

1. **QR code**, lido ao vivo pela câmera com jsQR. A chave de acesso de 44 dígitos dá UF, data, CNPJ, modelo, série e número com precisão total.
2. **OCR** do corpo da nota, que extrai os itens.

### As três verificações que não dependem do OCR

Medimos numa nota real de São Paulo que o OCR erra, e o parser usa as validações embutidas no próprio cupom para saber onde confiar:

- **EAN-13, módulo 10.** Cada código de barras valida a si mesmo. Quando falha, o parser tenta reparo de um dígito e só aceita se exatamente um candidato passar.
- **Chave de acesso, módulo 11**, mais plausibilidade de UF, mês, modelo e dígito verificador do CNPJ. Dígito trocado é recuperável; dígito faltando não é, e medimos por quê: numa chave real com um zero comido pelo OCR sobraram 17 candidatos plausíveis, sem critério para escolher. Nesse caso o app diz que a chave está ilegível em vez de inventar.
- **Soma dos itens contra o total impresso.** Se bater, a nota inteira ganha confiança alta. Se não bater, o app avisa que alguma linha escapou.

### O matcher

Quatro camadas, nesta ordem:

1. **EAN aprendido.** Toda correção feita na revisão grava o código de barras apontando para o produto. A segunda nota da mesma loja fica visivelmente melhor.
2. **Glossário** de marcas e abreviações do varejo brasileiro, com segunda passada tolerante a letra trocada. É o que faz `REFRIG FARTA UVA` virar refrigerante de uva e `SCHWEPRES` virar água tônica.
3. **Similaridade** por bigramas contra as 209 entradas do catálogo, com limiares que separam provável de incerto.
4. **Classificador de sobra**, que marca o que não é alimento e adivinha a categoria pelo contexto.

Nada entra na despensa sem passar pela tela de revisão, com o grau de confiança visível em cada linha.

### Precisão medida

Na foto real fornecida, fotografada de lado, com papel amassado e o QR cortado fora do quadro:

| Canal | Resultado |
|---|---|
| EAN-13 recuperado | 8 de 12 linhas |
| Descrição reconhecível | 10 de 12 |
| Linhas casadas com o catálogo | 10 de 11 |
| Itens não alimentares identificados | 1 de 1 |
| Total, desconto e valor pago | corretos |

O ponto fraco continua sendo o enquadramento: se o QR estiver cortado, como estava nessa foto, loja e data se perdem. Por isso a câmera tem moldura guia e aviso ao vivo de QR encontrado.

## O que é simulado

O protótipo é honesto sobre o que ainda não existe, e isso está escrito nas próprias telas:

- A consulta à SEFAZ pela chave de acesso ainda não existe. O caminho está preparado: a chave é extraída e validada, e falta só a função de proxy que busca os itens oficiais. As notas preparadas continuam disponíveis como rota de demonstração
- O pagamento por Pix mostra um código gerado e não cobra nada
- As ofertas do Radar e os vizinhos são dados semeados, não um feed de parceiros
- O assistente responde por palavras-chave, e o atendente humano é uma fila fictícia
- O painel do frasco faz o papel do backend: passagem do tempo, chegada de ofertas e ações de outros usuários

O mapa é real: OpenStreetMap com as coordenadas das lojas e a distância calculada por haversine a partir do endereço de referência em Pinheiros.

## Preview em redes sociais

O `index.html` traz as metatags Open Graph e Twitter apontando para o `preview.png` com URL absoluta do GitHub Pages, que é o formato que WhatsApp, LinkedIn e Facebook exigem. A arte é mantida em SVG como fonte, em `public/preview.svg`, e exportada para PNG.

Para regenerar o PNG depois de editar o SVG:

```bash
node -e "require('sharp')('public/preview.svg').resize(1200,630).png().toFile('public/preview.png')"
```

O favicon é `public/favicon.svg`, com `icon-192.png` como alternativa para navegadores antigos e como ícone da tela de início no iPhone.

## Limitações conhecidas

- Sem login e sem sincronização entre dispositivos. Cada navegador tem o seu estado.
- Fontes e tiles do mapa vêm da internet. Offline, o app abre com fontes de sistema e o mapa fica cinza. O resto funciona.
- Limpar os dados do navegador zera o protótipo.
- As lojas do Rest-Radar são fictícias, com coordenadas escolhidas à mão em Pinheiros. O mapa e as distâncias são reais, os estabelecimentos e os preços não.
