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


// Primeira conversa: acha o próximo horário livre da semana da Renata e o põe na capa e na mensagem
// do WhatsApp. Os horários são de exemplo; ?agora=2026-10-05T10:30 simula a hora, como na agenda.
(() => {
  "use strict";
  const { $, $$, whatsappUrl } = window.Modelo;
  const LEAD_HOURS = 2;
  const SEARCH_DAYS = 8;
  const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  // dia da semana (0 = domingo) para as horas livres da primeira conversa
  const OPEN_HOURS = { 1: [10, 16], 2: [9, 14, 18], 3: [10, 16], 4: [9, 14, 18], 5: [9, 11] };

  function now() {
    const simulated = new URLSearchParams(location.search).get("agora");
    const date = simulated ? new Date(simulated) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function nextSlot(from) {
    const earliest = from.getTime() + LEAD_HOURS * 3600 * 1000;
    for (let offset = 0; offset < SEARCH_DAYS; offset += 1) {
      const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
      for (const hour of OPEN_HOURS[day.getDay()] || []) {
        const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
        if (slot.getTime() >= earliest) return { date: slot, offset };
      }
    }
    return null;
  }

  function label({ date, offset }) {
    const when = offset === 0 ? "hoje" : offset === 1 ? "amanhã" : WEEKDAY_NAMES[date.getDay()];
    return `${when}, ${date.getHours()}h`;
  }

  const slot = nextSlot(now());
  if (!slot) return;
  const text = label(slot);
  const chip = $("#proximo-horario");
  if (chip) chip.textContent = `Próxima conversa livre: ${text}`;
  const message = `Olá, Renata! Quero marcar a primeira conversa. Pode ser ${text}?`;
  $$("a[data-primeira]").forEach((link) => { link.href = whatsappUrl(message); });
})();
