# tarciodiniz.com

Meu site pessoal, no ar em [tarciodiniz.com](https://tarciodiniz.com). Sou desenvolvedor em
Campina Grande (PB) e faço sites para negócios de todo o Brasil: rápidos no celular, fáceis de achar no
Google e com o WhatsApp a um toque.

A página principal fala com o dono de negócio primeiro e traz, mais abaixo, a minha história e o
que eu faço como desenvolvedor. Em `demos/` ficam nove modelos de empresas fictícias, cada um com
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

## Como é feito

- HTML, CSS e JavaScript puros, sem etapa de build: cada página é um arquivo só.
- Animação com [GSAP](https://gsap.com) (ScrollTrigger e SplitText) e rolagem suave com
  [Lenis](https://lenis.darkroom.engineering), tudo desligado para quem pede menos movimento no
  sistema. Sem JavaScript, a página aparece inteira.
- Testado em 18 tamanhos de tela, do celular de 320 px ao monitor ultrawide: sem rolagem lateral,
  sem texto cortado, toque com pelo menos 44 px e o botão principal sempre na primeira tela.
- SEO local com dados estruturados `Person` e `ProfessionalService`, sitemap e imagem de
  compartilhamento. Os modelos têm `noindex`.
- A cor da barra do navegador (`theme-color`) acompanha o que está no topo da página ao rolar.

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

## Publicar

Hospedado no Cloudflare Pages, projeto `tarciodiniz`:

```sh
npx wrangler pages deploy <pasta> --project-name tarciodiniz --branch main
```

## Créditos

- Fontes do Google Fonts: Anton e Inter Tight no site; nos modelos, Anybody, Figtree e Martian Mono
  (Brasa Smash), Doto, Handjet e Onest (Rebuliço), Coustard e Be Vietnam Pro (Caneca Azul), Gabarito
  e Hanken Grotesk (Sálvia), Unbounded e Albert Sans (Vigília), Gloock e Work Sans (Aroá), Red Hat
  Display, Text e Mono (Algodão), Sofia Sans Extra Condensed e Libre Franklin (Sisal) e Archivo e
  Source Serif 4 (Braúna).
- Mapas: [Leaflet](https://leafletjs.com) com dados do [OpenStreetMap](https://www.openstreetmap.org/copyright).
- Ícones: [Simple Icons](https://simpleicons.org) (CC0) para as marcas e
  [Phosphor](https://phosphoricons.com) (MIT) para a interface.
- Fotos dos modelos: [Unsplash](https://unsplash.com) e [Pexels](https://www.pexels.com); vídeos das capas:
  [Pexels](https://www.pexels.com) e [Coverr](https://coverr.co). O autor de cada foto e vídeo está num
  comentário no topo do HTML do modelo. As fotos da Braúna foram geradas com IA no
  [Higgsfield](https://higgsfield.ai). As fotos em `assets/img/` são minhas.

As empresas, os preços e as avaliações dos modelos são fictícios.
