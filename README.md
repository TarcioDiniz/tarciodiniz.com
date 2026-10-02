# tarciodiniz.com

Site do Tarcio Diniz, desenvolvedor web em Campina Grande (PB), no ar em
[tarciodiniz.com](https://tarciodiniz.com). Faço sites para negócios de todo o Brasil: rápidos no
celular, preparados para o Google e com o WhatsApp a um toque.

A página principal fala com o dono de negócio primeiro e traz, mais abaixo, a minha história e o
que eu faço como desenvolvedor. Em `demos/` ficam 24 modelos de empresas fictícias, cada um com
uma função de verdade, e a página [/modelos/](https://tarciodiniz.com/modelos/) junta todos, com
busca e filtro por ramo e por tipo de site. Cada modelo é um esqueleto (o que o cliente faz no site)
vestido com um estilo visual; o código de origem fica fora deste repositório.

| modelo | ramo | tipo de site | o que mostra |
|---|---|---|---|
| [Passada](https://tarciodiniz.com/demos/loja-de-tenis/) | Loja de tênis | Loja | Tênis e streetwear com sacola e pedido no WhatsApp. |
| [Juá](https://tarciodiniz.com/demos/moda-feminina/) | Moda feminina | Loja | Vestidos de linho, peças de festa e acessórios, com tamanho na ficha e pedido no WhatsApp. |
| [Pitanga](https://tarciodiniz.com/demos/cosmeticos/) | Cosméticos e skincare | Loja | Skincare, maquiagem e perfumaria, com kit montado na sacola e entrega no mesmo dia. |
| [Brasa Smash](https://tarciodiniz.com/demos/cardapio/) | Hamburgueria | Cardápio | Cardápio de smash burger que vira pedido no WhatsApp, com entrega por bairro. |
| [Caneca Azul](https://tarciodiniz.com/demos/cafe/) | Café de bairro | Cardápio | Cuscuz, tapioca e café coado, com comanda no WhatsApp e bolo por encomenda. |
| [Tigela Açaí](https://tarciodiniz.com/demos/acai/) | Açaí e sorvetes | Cardápio | Açaí montado do jeito do cliente, com adicionais e pedido no WhatsApp. |
| [Sisal Barbearia](https://tarciodiniz.com/demos/barbearia/) | Barbearia | Agenda | Horário marcado com o barbeiro, sem fila, confirmado no WhatsApp. |
| [Bromélia Salão](https://tarciodiniz.com/demos/salao/) | Salão de beleza | Agenda | Corte, escova, coloração e unhas com horário marcado. |
| [Carnaúba](https://tarciodiniz.com/demos/estetica-automotiva/) | Estética automotiva | Agenda | Lavagem detalhada, polimento e higienização com hora marcada e leva e traz. |
| [Braúna](https://tarciodiniz.com/demos/planejados/) | Marcenaria de planejados | Orçamento | Móveis planejados com orçamento por ambiente e visita de medição. |
| [Lume Solar](https://tarciodiniz.com/demos/energia-solar/) | Energia solar | Orçamento | Energia solar para casa e comércio, com estimativa de economia e visita técnica. |
| [Prumo Reformas](https://tarciodiniz.com/demos/reforma/) | Reforma e pintura | Orçamento | Reforma, pintura e acabamento com orçamento em 24 horas e prazo por escrito. |
| [Sálvia Fisio](https://tarciodiniz.com/demos/fisioterapia/) | Fisioterapia | Página de vendas | Tratamento de dor com plano por escrito, do primeiro dia até a alta. |
| [Renata Lins](https://tarciodiniz.com/demos/psicologa/) | Psicóloga | Página de vendas | Psicoterapia para adultos, presencial e online, com primeira conversa sem custo. |
| [Pulso Estúdio](https://tarciodiniz.com/demos/personal/) | Treino funcional e personal | Página de vendas | Treino funcional em turmas pequenas e personal, com aula experimental. |
| [Forno da Clara](https://tarciodiniz.com/demos/confeitaria/) | Bolos e doces por encomenda | Página de links | Página de links com cardápio de bolos, Pix do sinal e encomenda no WhatsApp. |
| [Lia Nails](https://tarciodiniz.com/demos/unhas/) | Designer de unhas | Página de links | Página de links com tabela, horários e agendamento pelo WhatsApp. |
| [Brechó Varal](https://tarciodiniz.com/demos/brecho/) | Brechó no Instagram | Página de links | Página de links com as peças da semana, regras de reserva e entrega. |
| [Marina Duarte](https://tarciodiniz.com/demos/fotografa/) | Fotógrafa | Portfólio | Casamentos, ensaios e eventos, com pacotes e consulta de data. |
| [Bruna Rocha](https://tarciodiniz.com/demos/maquiadora/) | Maquiadora | Portfólio | Maquiagem para noivas, formandas e festas, com pacotes e consulta de data. |
| [DJ Ravi](https://tarciodiniz.com/demos/dj/) | DJ | Portfólio | Som e luz para casamento, formatura e festa, com pacotes e consulta de data. |
| [Camarote Pé de Serra](https://tarciodiniz.com/demos/sao-joao/) | Camarote de São João | Evento | Camarote de São João com open bar, forró pé de serra e ingresso por noite. |
| [Fórum Borborema](https://tarciodiniz.com/demos/congresso/) | Congresso de negócios | Evento | Dois dias de palestras e oficinas para pequenos empresários, com lotes de ingresso. |
| [Conferência Raiz](https://tarciodiniz.com/demos/conferencia/) | Conferência de jovens | Evento | Conferência de jovens com louvor, palavra e oficinas, com inscrição por lote. |

Quatro modelos mais antigos saíram da vitrine e continuam no ar pelo endereço: Rebuliço
(`demos/bar/`), Vigília Veterinária (`demos/veterinaria/`), Pousada Aroá (`demos/pousada/`) e Algodão
Hotel (`demos/hotel/`).

## Como é feito

- HTML, CSS e JavaScript puros, sem etapa de build: cada página é um arquivo só.
- Animação com [GSAP](https://gsap.com) (ScrollTrigger e SplitText) e rolagem suave com
  [Lenis](https://lenis.darkroom.engineering), tudo desligado para quem pede menos movimento no
  sistema. Sem JavaScript, a página aparece inteira.
- Testado em 18 tamanhos de tela, do celular de 320 px ao monitor ultrawide: sem rolagem lateral,
  sem texto cortado, toque com pelo menos 44 px e o botão principal sempre na primeira tela.
- SEO local com dados estruturados `Person`, `ProfessionalService`, `FAQPage` e `Article`, sitemap,
  `llms.txt` e imagem de compartilhamento. Os modelos têm `noindex`.
- `404.html` na raiz: sem ele, o Cloudflare Pages devolve a página inicial com status 200 para
  qualquer endereço que não existe.
- `functions/_middleware.js` redireciona `www.tarciodiniz.com` e `tarciodiniz.pages.dev` para
  `tarciodiniz.com` com 301. As prévias por ramo não são redirecionadas.
- A cor da barra do navegador (`theme-color`) acompanha o que está no topo da página ao rolar.
- Nada de fora bloqueia a primeira pintura. As fontes são servidas do próprio site, em
  `assets/fonts/`, com as mesmas regras do Google Fonts. Página nova ou fonte nova passa por
  `scripts/fontes-locais.py`, que baixa os arquivos e troca o `<link>` pelo bloco `<style id="fontes">`.
  GSAP e Lenis ficam em `assets/vendor/` e o CSS do Leaflet carrega sem bloquear.
- Nas páginas do site, a fonte de reserva tem a largura da Anton e da Inter Tight (`size-adjust`),
  para o título não pular quando a fonte chega.
- Fotos com `srcset` e `sizes` medidos no CSS de cada página. As capturas dos modelos e as minhas
  fotos têm versões menores (`-480`, `-640`, `-800` etc.) ao lado do arquivo original.
- `_headers` guarda fontes e scripts por um ano no navegador. Pode, porque a fonte leva um código
  no nome do arquivo e o script leva a versão no nome da pasta: mudou, muda o endereço.

## Rodar local

```sh
python3 -m http.server 8811 --bind 127.0.0.1
```

e abrir `http://127.0.0.1:8811/`. As capturas dos modelos usadas na página principal são geradas
por `scripts/capturas.sh`, com o servidor local no ar.

## Testes

Bateria de celular, dobra por dobra, em dois motores: o Chrome, em 6 tamanhos (320 a 430 px e
celular deitado), e o WebKit, que é o motor do Safari, com 4 perfis de iPhone (SE, 13, 16 Pro Max e
13 deitado). Confere texto na borda, palavra sozinha no fim de título, texto pequeno, toques
colados, contraste, foto distorcida, ação principal fora da primeira tela, botão cortado pela
dobra, vazios, fontes, barra fixa e elemento fixo aparecendo pela metade na borda da tela. Gera
uma folha de revisão com todas as dobras em `test-results/mobile/`.

Nos tamanhos de 390 e 430 px, o Chrome simula os 34 px que o iPhone com Face ID reserva embaixo
para a barra de início (`env(safe-area-inset-bottom)`). Sem isso ele usa 0 e o WebKit do Playwright
também, e foi assim que um botão escondido pela metade chegou ao iPhone. O WebKit do Playwright não
é o Safari (fica uma versão atrás e não tem os ajustes da Apple): pega o que é do motor, não
substitui abrir no iPhone.

```sh
npm install
npx playwright-core install webkit   # uma vez, baixa o WebKit da versão do playwright-core
npm run mobile                       # todas as páginas, nos dois motores
npm run mobile -- /demos/pousada/    # uma página
npm run mobile -- --engine webkit    # um motor só
```

Os ícones de cada página saem de `scripts/icon-sprite.py` (Simple Icons e Phosphor, versões fixas).

Bateria Lighthouse, página por página, uma de cada vez para a nota não oscilar por disputa de CPU:
desempenho, acessibilidade, práticas recomendadas, SEO e navegação agêntica, no celular e no
computador. Contra um servidor local a nota de desempenho, LCP e TBT só avisam, porque o servidor
não comprime como a produção. Gera o JSON de cada página e um `resumo.md` em
`test-results/lighthouse/`.

```sh
npm run lighthouse                                    # todas as páginas, celular e computador
npm run lighthouse -- --form mobile /privacidade/     # uma página, só celular
npm run lighthouse -- --base https://tarciodiniz.com  # contra a produção
```

## Publicar

Hospedado no Cloudflare Pages, projeto `tarciodiniz`. O script publica o último commit, nunca a
pasta de trabalho, então arquivo sem commit não vai para o ar:

```sh
scripts/publicar.sh <ramo>        # main é a produção; qualquer outro nome vira prévia
scripts/publicar.sh <ramo> --dry  # só monta a pasta e mostra onde ficou
```

Depois de publicar na produção, avise o Bing das páginas que mudaram pelo IndexNow (a chave é o
arquivo `.txt` de nome hexadecimal na raiz).

## Créditos

- Fontes do Google Fonts: Anton e Inter Tight no site; nos modelos, Archivo, Schibsted Grotesk,
  Nunito, Gilda Display e Hanken Grotesk, servidas pela própria página. Os quatro modelos antigos que
  saíram da vitrine usam Doto, Handjet e Onest (Rebuliço), Unbounded e Albert Sans (Vigília), Gloock e
  Work Sans (Aroá) e Red Hat Display, Text e Mono (Algodão).
- Mapas: [Leaflet](https://leafletjs.com) com dados do [OpenStreetMap](https://www.openstreetmap.org/copyright).
- Ícones: [Simple Icons](https://simpleicons.org) (CC0) para as marcas e
  [Phosphor](https://phosphoricons.com) (MIT) para a interface.
- Fotos dos modelos: [Unsplash](https://unsplash.com) e [Pexels](https://www.pexels.com); vídeos das capas
  dos modelos antigos: [Pexels](https://www.pexels.com) e [Coverr](https://coverr.co). O autor de cada foto e vídeo está num
  comentário no topo do HTML do modelo. Nos modelos atuais, todas as fotos são reais, do
  Unsplash. As fotos em `assets/img/` são minhas.

As empresas, os preços e as avaliações dos modelos são fictícios.
