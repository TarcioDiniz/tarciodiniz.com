// Página de vendas: a barra de ação do celular aparece quando os botões da capa saem da tela
// e some de novo da faixa final para baixo, porque ela já tem o próprio botão.
(() => {
  "use strict";
  const bar = document.getElementById("barra");
  const heroButtons = document.querySelector(".v-botoes");
  const finalBand = document.querySelector(".v-final");
  if (!bar || !heroButtons || !("IntersectionObserver" in window)) return;

  let heroVisible = true;
  let finalVisible = false;
  const link = bar.querySelector("a");

  function update() {
    const show = !heroVisible && !finalVisible;
    bar.classList.toggle("mostra", show);
    bar.setAttribute("aria-hidden", String(!show));
    link.tabIndex = show ? 0 : -1;
  }

  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting || entry.boundingClientRect.top > 0;
    update();
  }).observe(heroButtons);

  if (finalBand) {
    new IntersectionObserver(([entry]) => {
      finalVisible = entry.isIntersecting || entry.boundingClientRect.top < 0;
      update();
    }, { rootMargin: "0px 0px -20% 0px" }).observe(finalBand);
  }
})();

// Onde dói: a região e o tempo de dor escolhidos viram a mensagem pronta do WhatsApp.
// O painel de cada região troca só com CSS; aqui só a mensagem e o link mudam.
(() => {
  "use strict";
  const { $, $$, whatsappUrl } = window.Modelo;
  const link = $("#doi-wa");
  const preview = $("#doi-msg");
  if (!link || !preview) return;

  const checkedText = (name) => {
    const input = $(`input[name="${name}"]:checked`);
    return input ? input.dataset.msg : "";
  };

  function update() {
    const text = `Olá! ${checkedText("regiao")}. ${checkedText("tempo")}. Quero marcar a avaliação.`;
    preview.textContent = text;
    link.href = whatsappUrl(text);
  }

  $$('input[name="regiao"], input[name="tempo"]').forEach((input) => input.addEventListener("change", update));
  update();
})();
