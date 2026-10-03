// Clube e aulas: o pedido de aula experimental (ou de matrícula) fica aberto na página, na faixa
// escura. Programas e turmas vêm do acordeão (.cl-prog[data-programa] e [data-turma]), níveis de
// [data-nivel] (o campo é opcional: sem ele, o nível não é pedido) e planos dos cartões
// (.cl-plano[data-plano]): quem monta o modelo mexe só no HTML. Um plano com data-sem-turma (só a
// planilha, sem treino em grupo) não pede turma na matrícula.
// Escolher um plano, um programa ou uma turma em qualquer lugar da página preenche o pedido e leva
// até ele; a mensagem sai pronta no WhatsApp pelo whatsappUrl() da base.
(() => {
  "use strict";
  const { $, $$, brl, toast, whatsappUrl } = window.Modelo;

  const STORE = document.body.dataset.loja || "a escola";
  const GIANT_MAX_PX = 240;
  const GIANT_PROBE_PX = 100;
  // O pedido conta como "na tela" quando o topo dele passa desta fração da altura da janela.
  const BAR_FORM_LINE = 0.85;
  const INTENT = { trial: "experimental", enroll: "matricula" };
  // Nome do campo de programa na mensagem: escola de dança chama de "Modalidade" (data-rotulo na lista)
  const PROGRAM_LABEL = document.querySelector("[data-lista-programas]")?.dataset.rotulo || "Programa";

  const escapeHtml = (text) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const price = (value) => brl.format(value).replace(",00", "");
  const seatsLabel = (seats) => (seats === 0 ? "lotada" : seats === 1 ? "1 vaga" : `${seats} vagas`);
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Dados lidos do HTML */
  /** @type {Map<string, { id: string, name: string, classes: { key: string, days: string, time: string, seats: number }[] }>} */
  const programs = new Map();
  $$(".cl-prog[data-programa]").forEach((details) => {
    const id = details.dataset.programa;
    const classes = $$("[data-turma]", details).map((button, index) => {
      const key = `${id}-${index}`;
      const seats = Number(button.dataset.vagas);
      button.dataset.turmaKey = key;
      button.disabled = seats === 0;
      return { key, days: button.dataset.dias, time: button.dataset.hora, seats };
    });
    programs.set(id, { id, name: details.dataset.nome, classes });
  });

  /** @type {Map<string, { id: string, name: string }>} */
  const levels = new Map($$("[data-nivel]").map((el) => [el.dataset.nivel, { id: el.dataset.nivel, name: el.dataset.nome }]));
  const asksLevel = levels.size > 0;

  /** @type {Map<string, { id: string, name: string, price: number, classless: boolean }>} */
  const plans = new Map($$(".cl-plano[data-plano]").map((el) => [el.dataset.plano, {
    id: el.dataset.plano, name: el.dataset.nome, price: Number(el.dataset.preco), classless: el.hasAttribute("data-sem-turma"),
  }]));
  const groupPlan = [...plans.values()].find((p) => !p.classless) ?? null;
  const CLASSLESS_LINE = "Treino: pela planilha, no meu horário";

  const findClass = (key) => {
    for (const program of programs.values()) {
      const hit = program.classes.find((c) => c.key === key);
      if (hit) return { program, cls: hit };
    }
    return null;
  };

  /* Estado: o primeiro programa já vem escolhido; turma, nível e nome ficam com o cliente */
  const state = { intent: INTENT.trial, program: [...programs.keys()][0], classKey: null, level: null, plan: null, name: "", tried: false };

  const currentClass = () => (state.classKey ? findClass(state.classKey)?.cls ?? null : null);
  // Só a matrícula num plano sem treino em grupo dispensa a turma; a aula experimental é sempre com a turma.
  const needsClass = () => !(state.intent === INTENT.enroll && plans.get(state.plan)?.classless);

  function missing() {
    const list = [];
    if (state.intent === INTENT.enroll && !state.plan) list.push("o plano");
    if (needsClass() && !state.classKey) list.push("a turma");
    if (asksLevel && !state.level) list.push("o nível");
    return { choices: list, name: !state.name.trim() };
  }

  const joinPt = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`);

  function missingText() {
    const { choices, name } = missing();
    if (!choices.length && !name) return "Abre o WhatsApp com a mensagem pronta. É só enviar.";
    if (!choices.length) return "Falta escrever seu nome.";
    if (!name) return `Falta escolher ${joinPt(choices)}.`;
    return `Falta escolher ${choices.join(", ")} e escrever seu nome.`;
  }

  function message() {
    const program = programs.get(state.program);
    const cls = currentClass();
    const plan = plans.get(state.plan);
    const enroll = state.intent === INTENT.enroll;
    const lines = [enroll ? `Olá, ${STORE}! Quero fazer a matrícula.` : `Olá, ${STORE}! Quero marcar uma aula experimental.`, ""];
    if (enroll && plan) lines.push(`Plano: ${plan.name} (${price(plan.price)} por mês)`);
    lines.push(`${PROGRAM_LABEL}: ${program.name}`);
    lines.push(needsClass() ? `Turma: ${cls.days}, ${cls.time}` : CLASSLESS_LINE);
    if (asksLevel) lines.push(`Nível: ${levels.get(state.level).name}`);
    lines.push(
      `Nome: ${state.name.trim()}`,
      "",
      enroll ? "Como faço para fechar?" : "Pode confirmar minha vaga?",
    );
    return lines.join("\n");
  }

  /* Desenho do pedido */
  function paintIntent() {
    $$("[data-intencao]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.intencao === state.intent)));
    $("#pedido-plano").hidden = state.intent !== INTENT.enroll;
    $("#pedido-turma").hidden = !needsClass();
    $("[data-enviar-texto]").textContent = state.intent === INTENT.enroll ? "Pedir matrícula pelo WhatsApp" : "Marcar pelo WhatsApp";
  }

  function paintPrograms() {
    $("[data-lista-programas]").innerHTML = [...programs.values()].map((p) =>
      `<button class="cl-chip" type="button" data-key="p-${p.id}" data-escolhe-programa="${p.id}" aria-pressed="${p.id === state.program}">${escapeHtml(p.name)}</button>`).join("");
  }

  function paintClasses() {
    const program = programs.get(state.program);
    $("[data-lista-turmas]").innerHTML = program.classes.map((c) => {
      const pressed = c.key === state.classKey;
      const off = c.seats === 0;
      return `<button class="cl-turma" type="button" data-key="t-${c.key}" data-escolhe-turma="${c.key}" aria-pressed="${pressed}" ${off ? `disabled aria-label="${escapeHtml(`${c.days}, ${c.time}, lotada`)}"` : ""}><b>${escapeHtml(c.time)}</b><small>${seatsLabel(c.seats)}</small><span>${escapeHtml(c.days)}</span></button>`;
    }).join("");
    // A turma escolhida também acende no acordeão
    $$(".cl-prog [data-turma-key]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.turmaKey === state.classKey)));
  }

  function paintLevels() {
    $$("[data-nivel]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.nivel === state.level)));
  }

  function paintPlans() {
    $("[data-lista-planos]").innerHTML = [...plans.values()].map((p) =>
      `<button class="cl-opcao" type="button" data-key="pl-${p.id}" data-escolhe-plano="${p.id}" aria-pressed="${p.id === state.plan}"><b>${escapeHtml(p.name)}</b><span>${price(p.price)} por mês</span></button>`).join("");
    $$(".cl-plano[data-plano]").forEach((card) => card.toggleAttribute("data-escolhido", state.intent === INTENT.enroll && card.dataset.plano === state.plan));
  }

  function paintSend() {
    const { choices, name } = missing();
    const ready = !choices.length && !name;
    const link = $(".cl-enviar");
    if (ready) {
      link.href = whatsappUrl(message());
      link.target = "_blank";
      link.rel = "noopener";
      link.removeAttribute("aria-disabled");
    } else {
      link.href = "#marcar";
      link.removeAttribute("target");
      link.removeAttribute("rel");
      link.setAttribute("aria-disabled", "true");
    }
    $("[data-falta]").textContent = missingText();
    $("#pedido-nome").setAttribute("aria-invalid", String(state.tried && name));
  }

  function render() {
    paintIntent();
    paintPrograms();
    paintClasses();
    paintLevels();
    paintPlans();
    paintSend();
  }

  /** Redesenha sem tirar o foco de quem usa o teclado. */
  function renderKeepingFocus() {
    const key = document.activeElement?.dataset?.key;
    render();
    if (key) $(`[data-key="${key}"]`)?.focus();
  }

  function goToForm() {
    $("#marcar").scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }

  function focusFirstMissing() {
    const { choices, name } = missing();
    const target = choices.includes("o plano") ? $("#pedido-plano")
      : choices.includes("a turma") ? $("#pedido-turma")
        : choices.includes("o nível") ? $("#pedido-nivel")
          : name ? $("#pedido-nome") : null;
    if (!target) return;
    target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
    target.focus({ preventScroll: true });
  }

  /* Cliques */
  document.addEventListener("click", (event) => {
    const target = event.target;
    const intent = target.closest("[data-intencao]");
    const programChip = target.closest("[data-escolhe-programa]");
    const classChip = target.closest("[data-escolhe-turma]");
    const level = target.closest("[data-nivel]");
    const planChip = target.closest("[data-escolhe-plano]");
    const planCard = target.closest("[data-quero-plano]");
    const accordionClass = target.closest(".cl-prog [data-turma-key]");
    const programButton = target.closest("[data-marcar]");
    const send = target.closest(".cl-enviar");

    if (intent) { state.intent = intent.dataset.intencao; renderKeepingFocus(); return; }
    if (programChip) {
      if (programChip.dataset.escolhePrograma !== state.program) state.classKey = null;
      state.program = programChip.dataset.escolhePrograma;
      renderKeepingFocus();
      return;
    }
    if (classChip) { state.classKey = classChip.dataset.escolheTurma; renderKeepingFocus(); return; }
    if (level) { state.level = level.dataset.nivel; renderKeepingFocus(); return; }
    if (planChip) { state.plan = planChip.dataset.escolhePlano; renderKeepingFocus(); return; }
    if (planCard) {
      state.intent = INTENT.enroll;
      state.plan = planCard.dataset.queroPlano;
      render();
      goToForm();
      toast(`Plano ${plans.get(state.plan).name} escolhido`);
      return;
    }
    if (accordionClass && !accordionClass.disabled) {
      const hit = findClass(accordionClass.dataset.turmaKey);
      state.program = hit.program.id;
      state.classKey = hit.cls.key;
      // Quem escolhe uma turma quer treinar em grupo: a matrícula só na planilha passa para o plano com grupo
      if (!needsClass()) state.plan = groupPlan?.id ?? null;
      render();
      goToForm();
      toast(`${hit.program.name}, ${hit.cls.days.toLowerCase()}, ${hit.cls.time}`);
      return;
    }
    if (programButton) {
      if (programButton.dataset.marcar !== state.program) state.classKey = null;
      state.program = programButton.dataset.marcar;
      state.intent = INTENT.trial;
      render();
      return;
    }
    if (send) {
      if (send.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        state.tried = true;
        paintSend();
        toast(missingText());
        focusFirstMissing();
        return;
      }
      toast("Abrindo o WhatsApp com o pedido pronto");
    }
  });

  // O nome só muda o texto da mensagem: nada mais se redesenha enquanto a pessoa digita.
  $("#pedido-nome").addEventListener("input", (event) => {
    state.name = event.target.value;
    paintSend();
  });

  /* Acordeão: um aberto por vez também onde o navegador ainda não entende details[name] */
  const accordion = $$(".cl-prog");
  accordion.forEach((details) => details.addEventListener("toggle", () => {
    if (details.open) accordion.forEach((other) => { if (other !== details) other.open = false; });
  }));

  /* Barra do celular: aparece quando o botão da capa sai da tela e some quando o pedido entra.
     Conta pela posição a cada rolagem, porque um salto por âncora (do rodapé para os programas)
     passa por cima do pedido sem o IntersectionObserver avisar. */
  const bar = $("#barra");
  const heroButton = $(".cl-capa-texto .btn");
  const form = $("#marcar");
  if (bar && heroButton && form) {
    let queued = false;
    const update = () => {
      queued = false;
      const heroGone = heroButton.getBoundingClientRect().bottom <= 0;
      const formReached = form.getBoundingClientRect().top < window.innerHeight * BAR_FORM_LINE;
      const show = heroGone && !formReached;
      bar.classList.toggle("mostra", show);
      bar.inert = !show;
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    update();
  }

  /* Nome enorme do rodapé: mede o nome e acerta o tamanho para ocupar a largura do cartão */
  const giant = $(".cl-gigante");
  const giantText = giant ? $("span", giant) : null;
  function fitGiant() {
    if (!giant || !giantText) return;
    giant.classList.add("ajustado");
    giant.style.fontSize = `${GIANT_PROBE_PX}px`;
    const textWidth = giantText.getBoundingClientRect().width;
    const room = giant.clientWidth;
    if (!textWidth || !room) return;
    giant.style.fontSize = `${Math.min(GIANT_MAX_PX, Math.floor((GIANT_PROBE_PX * room) / textWidth))}px`;
  }
  if (giant) {
    document.fonts.ready.then(fitGiant);
    if ("ResizeObserver" in window) new ResizeObserver(fitGiant).observe(giant);
  }

  /* Movimento: a capa entra subindo e os blocos aparecem ao rolar. ?estatico desliga, para capturas. */
  const still = new URLSearchParams(location.search).has("estatico");
  function animate() {
    if (still || document.visibilityState !== "visible" || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".cl-capa .cl-display", { yPercent: 14, opacity: 0, duration: 0.9, ease: "power3.out" });
      gsap.from(".cl-capa-foto", { y: 56, opacity: 0, duration: 1.1, ease: "power3.out", delay: 0.12 });
      gsap.from(".cl-capa-texto > *, .cl-capa-nota", { y: 18, opacity: 0, duration: 0.7, stagger: 0.08, ease: "power3.out", delay: 0.25 });
      const reveal = (selector, trigger, y, stagger, start = "top 88%") => {
        const items = $$(selector);
        if (!items.length) return;
        gsap.from(items, { y, opacity: 0, duration: 0.75, stagger, ease: "power3.out", scrollTrigger: { trigger, start, once: true } });
      };
      reveal(".cl-plano", ".cl-planos", 28, 0.1);
      reveal(".cl-prog", ".cl-progs", 20, 0.06);
      reveal(".cl-faixa-foto, .cl-pedido", ".cl-faixa", 36, 0.12);
      // O nome é o último bloco da página: medido por ele mesmo, o gatilho pode nunca chegar no fim da
      // rolagem e o nome ficaria invisível. Quem dispara é o cartão do rodapé.
      reveal(".cl-gigante", ".cl-rodape-cartao", 48, 0, "top 70%");
    });
  }

  render();
  // DOMContentLoaded vem depois de todos os scripts com defer, então o GSAP já está na página.
  document.addEventListener("DOMContentLoaded", animate);
})();
