# tarciodiniz.com

Meu site pessoal, no ar em [tarciodiniz.com](https://tarciodiniz.com). Sou desenvolvedor em
Campina Grande (PB) e faço sites para negócios de todo o Brasil: rápidos no celular, fáceis de achar no
Google e com o WhatsApp a um toque.

A página principal fala com o dono de negócio primeiro e traz, mais abaixo, a minha história e o
que eu faço como desenvolvedor. Em `demos/` ficam cinco modelos de empresas fictícias, cada um com
uma função de verdade:

| modelo | o que mostra |
|---|---|
| [Brasa Smash](https://tarciodiniz.com/demos/cardapio/) | cardápio com sacola que vira pedido no WhatsApp |
| [Sálvia Fisioterapia](https://tarciodiniz.com/demos/fisioterapia/) | "Onde dói?": a pessoa toca no corpo e já agenda pelo WhatsApp |
| [Vigília Veterinária](https://tarciodiniz.com/demos/veterinaria/) | botão de emergência sempre à vista no celular |
| [Pousada Aroá](https://tarciodiniz.com/demos/pousada/) | pedido de reserva com datas, hóspedes e quarto |
| [Sisal Barbearia](https://tarciodiniz.com/demos/barbearia/) | agendamento em três escolhas |

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

- Fontes do Google Fonts: Anton e Inter Tight no site; nos modelos, Bricolage Grotesque, Schibsted
  Grotesk, Big Shoulders Display, Rubik, Young Serif, Karla, Alfa Slab One e IBM Plex.
- Mapas: [Leaflet](https://leafletjs.com) com dados do [OpenStreetMap](https://www.openstreetmap.org/copyright).
- Ícones: [Simple Icons](https://simpleicons.org) (CC0) para as marcas e
  [Phosphor](https://phosphoricons.com) (MIT) para a interface.
- Fotos dos modelos: [Unsplash](https://unsplash.com). As fotos em `assets/img/` são minhas.

As empresas, os preços e as avaliações dos modelos são fictícios.
