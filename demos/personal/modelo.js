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

// Grade de turmas do Pulso: escolher a turma monta a mensagem do WhatsApp, e a capa mostra a próxima turma
// com vaga. ?agora=2026-10-02T17:00 simula a hora, para testar e fotografar.
(() => {
  "use strict";
  const { $, $$, whatsappUrl } = window.Modelo;
  const LOOKAHEAD_DAYS = 8;
  const WEEKDAY_NAME = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

  const rows = $$(".t-turma");
  const summary = $("#t-escolhida");
  const send = $("#t-enviar");
  const notice = $("#t-aviso");
  const nameInput = $("#t-nome");
  if (!rows.length || !summary || !send) return;

  function readNow() {
    const fake = new URLSearchParams(location.search).get("agora");
    const parsed = fake ? new Date(fake) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  }

  const clock = (time) => {
    const [h, m] = time.split(":").map(Number);
    return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  };
  const plural = (n) => `${n} ${n === 1 ? "vaga" : "vagas"}`;

  /* Capa: próxima turma com vaga, contando a partir de agora */
  function showNext() {
    const title = $("#proxima-titulo");
    const detail = $("#proxima-detalhe");
    if (!title || !detail) return;
    const now = readNow();
    let best = null;
    for (let offset = 0; offset < LOOKAHEAD_DAYS && !best; offset += 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      rows.forEach((row) => {
        const vagas = Number(row.dataset.vagas);
        if (!vagas || !row.dataset.dias.split(",").map(Number).includes(day.getDay())) return;
        const [h, m] = row.dataset.hora.split(":").map(Number);
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
        if (start > now && (!best || start < best.start)) best = { start, offset, day, row, vagas };
      });
    }
    if (!best) return;
    const when = best.offset === 0 ? "hoje" : best.offset === 1 ? "amanhã" : WEEKDAY_NAME[best.day.getDay()];
    title.textContent = `Próxima turma com vaga: ${when}, ${clock(best.row.dataset.hora)}`;
    detail.textContent = `${plural(best.vagas)}. Primeira aula sem custo`;
  }

  /* Escolha da turma */
  let chosen = null;

  function message() {
    const name = nameInput.value.trim();
    const goal = document.querySelector('input[name="objetivo"]:checked');
    const full = Number(chosen.dataset.vagas) === 0;
    const where = `na turma de ${chosen.dataset.nome}, ${clock(chosen.dataset.hora)}`;
    const intro = name ? `Olá! Sou ${name}. ` : "Olá! ";
    const ask = full ? `Quero entrar na lista de espera ${where}.` : `Quero marcar a aula experimental ${where}.`;
    return `${intro}${ask}${goal ? ` Meu objetivo: ${goal.value}.` : ""}`;
  }

  function refresh() {
    if (!chosen) return;
    const full = Number(chosen.dataset.vagas) === 0;
    summary.textContent = `${chosen.dataset.nome}, ${clock(chosen.dataset.hora)}. ${full ? "Turma lotada, você entra na lista de espera." : "Aula experimental sem custo."}`;
    send.href = whatsappUrl(message());
    send.target = "_blank";
    send.rel = "noopener";
    send.removeAttribute("aria-disabled");
    notice.textContent = "";
  }

  rows.forEach((row) => {
    row.addEventListener("click", () => {
      chosen = row;
      rows.forEach((r) => r.setAttribute("aria-checked", String(r === row)));
      refresh();
      const form = $("#t-resumo");
      const box = form.getBoundingClientRect();
      if (box.top > window.innerHeight - 160 || box.bottom < 0) form.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  // Setas trocam de turma, como em qualquer grupo de opções
  $(".t-lista").addEventListener("keydown", (event) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = rows.indexOf(document.activeElement);
    const next = rows[(index + step + rows.length) % rows.length];
    next.focus();
    next.click();
  });

  nameInput.addEventListener("input", refresh);
  $$('input[name="objetivo"]').forEach((input) => input.addEventListener("change", refresh));
  $("#t-resumo").addEventListener("submit", (event) => event.preventDefault());

  send.addEventListener("click", (event) => {
    if (chosen) return;
    event.preventDefault();
    notice.textContent = "Escolha uma turma na lista primeiro.";
  });

  showNext();
})();
