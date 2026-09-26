# tarciodiniz.com

Site do Tarcio Diniz, desenvolvedor web em Campina Grande (PB), no ar em
[tarciodiniz.com](https://tarciodiniz.com). Faço sites para negócios de todo o Brasil: rápidos no
celular, preparados para o Google e com o WhatsApp a um toque.

A página principal fala com o dono de negócio primeiro e traz, mais abaixo, a minha história e o
que eu faço como desenvolvedor. Em `demos/` ficam dez modelos de empresas fictícias, cada um com
uma função de verdade:

| modelo | o que mostra |
|---|---|
| [Brasa Smash](https://tarciodiniz.com/demos/cardapio/) | cardápio que vira comanda e pedido no WhatsApp, com vídeo na capa |
| [Rebuliço](https://tarciodiniz.com/demos/bar/) | bar e pista: a noite de hoje na capa, nome na lista, camarote e aniversário pelo WhatsApp |
| [Caneca Azul](https://tarciodiniz.com/demos/cafe/) | café de bairro: comanda, encomenda de bolo e vídeo na capa |
| [Sálvia Fisioterapia](https://tarciodiniz.com/demos/fisioterapia/) | "Onde dói?", o tratamento passo a passo e agendamento com horários livres |
| [Vigília Veterinária](https://tarciodiniz.com/demos/veterinaria/) | cão ou gato muda a página, emergência a um toque e agendamento |
| [Pousada Aroá](https://tarciodiniz.com/demos/pousada/) | quartos com galeria, calendário de datas livres e pedido de reserva |
| [Algodão Hotel](https://tarciodiniz.com/demos/hotel/) | distância até o que o hóspede veio fazer, tarifa do dia e convênio para empresa |
| [Sisal Barbearia](https://tarciodiniz.com/demos/barbearia/) | horários livres na tela e a altura do degradê no pedido |
| [Braúna Marcenaria](https://tarciodiniz.com/demos/planejados/) | planejados: acabamento trocado na foto, orçamento por ambiente e pedido de visita pelo WhatsApp |
| [Carnaúba Estética Automotiva](https://tarciodiniz.com/demos/estetica-automotiva/) | estética automotiva: preço por porte e serviço, hora em que o carro fica pronto e pedido pelo WhatsApp |

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

Bateria de celular, dobra por dobra, em 6 tamanhos (320 a 430 px e celular deitado): texto na
borda, palavra sozinha no fim de título, texto pequeno, toques colados, contraste, foto distorcida,
ação principal fora da primeira tela, botão cortado pela dobra, vazios, fontes e barra fixa. Gera
uma folha de revisão com todas as dobras em `test-results/mobile/`.

```sh
npm install
npm run mobile                      # todas as páginas
npm run mobile -- /demos/pousada/   # uma página
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

- Fontes do Google Fonts: Anton e Inter Tight no site; nos modelos, Anybody, Figtree e Martian Mono
  (Brasa Smash), Doto, Handjet e Onest (Rebuliço), Coustard e Be Vietnam Pro (Caneca Azul), Gabarito
  e Hanken Grotesk (Sálvia), Unbounded e Albert Sans (Vigília), Gloock e Work Sans (Aroá), Red Hat
  Display, Text e Mono (Algodão), Sofia Sans Extra Condensed e Libre Franklin (Sisal), Archivo e
  Source Serif 4 (Braúna) e Funnel Display e Rethink Sans (Carnaúba).
- Mapas: [Leaflet](https://leafletjs.com) com dados do [OpenStreetMap](https://www.openstreetmap.org/copyright).
- Ícones: [Simple Icons](https://simpleicons.org) (CC0) para as marcas e
  [Phosphor](https://phosphoricons.com) (MIT) para a interface.
- Fotos dos modelos: [Unsplash](https://unsplash.com) e [Pexels](https://www.pexels.com); vídeos das capas:
  [Pexels](https://www.pexels.com) e [Coverr](https://coverr.co). O autor de cada foto e vídeo está num
  comentário no topo do HTML do modelo. As fotos da Braúna e da Carnaúba foram geradas com
  IA no [Higgsfield](https://higgsfield.ai). As fotos em `assets/img/` são minhas.

As empresas, os preços e as avaliações dos modelos são fictícios.
