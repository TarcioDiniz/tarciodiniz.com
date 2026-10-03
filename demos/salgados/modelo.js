// Cento Salgados (esqueleto marca ajustado a quem vende por cento): o botão redondo de cada
// salgado põe 1 cento no pedido, o painel soma de meio em meio cento e exige 1 cento no total.
// Pronta entrega só até um limite de centos e só no horário da casa; encomenda pede data, horário e
// antecedência.
// O cliente escolhe frito ou congelado (o congelado desconta um valor por cento) e a mensagem sai
// pronta no WhatsApp. Também troca os depoimentos e encaixa o nome do rodapé na largura do cartão.
// Os produtos vêm dos atributos data-* que já estão no HTML; as regras da casa, dos data-* do body.
(() => {
  "use strict";
  const { $, $$, brl, toast, whatsappUrl } = window.Modelo;

  const STORE = document.body.dataset.loja || "a casa";
  const LEAD_DAYS = Number(document.body.dataset.antecedencia || 0);
  const FROZEN_DISCOUNT = Number(document.body.dataset.congelado || 0);
  const MIN_CENTOS = Number(document.body.dataset.minimo || 1);
  const SAME_DAY_MAX = Number(document.body.dataset.hojeMax || Infinity);
  // Dias pelo número do Date (0 é domingo). Sem o atributo, a regra não vale (-1 nunca casa).
  const weekdayRule = (value) => (value === undefined || value === "" ? -1 : Number(value));
  const CLOSED_DAY = weekdayRule(document.body.dataset.diaFechado);
  const PICKUP_ONLY_DAY = weekdayRule(document.body.dataset.diaSoRetirada);
  const PICKUP_ONLY_HOURS = document.body.dataset.horarioSoRetirada || "";
  // Horário da casa em minutos do dia ("8:00" vira 480). Sem o atributo, a regra não vale (NaN nunca casa).
  const minutesOf = (value) => { if (!value) return NaN; const [h, m = "0"] = value.split(":"); return Number(h) * 60 + Number(m); };
  const OPENS = minutesOf(document.body.dataset.abre);
  const CLOSES = minutesOf(document.body.dataset.fecha);
  const [PAUSE_START, PAUSE_END] = (document.body.dataset.pausa || "").split("-").map(minutesOf);
  const SAME_DAY_PREP = Number(document.body.dataset.preparoHoje || 0);
  const PIECES_PER_CENTO = 100;
  const HALF = 0.5;
  const ADD_STEP = 1;
  const STORAGE_KEY = `pedido:${location.pathname}`;
  const NAME_MAX_RATIO = 0.4;
  const still = new URLSearchParams(location.search).has("estatico");
  if (still) document.documentElement.classList.add("estatico");

  /** @type {Map<string, { name: string, price: number, image: string, framed: boolean }>} */
  const catalog = new Map();
  // A foto do cartão vale para o painel, cortada no quadro: assim as miniaturas saem todas iguais. O
  // produto que não está nos cartões (o croquete do destaque) usa a recortada, inteira no creme.
  $$("[data-id][data-preco]").forEach((el) => {
    const image = el.querySelector("img")?.getAttribute("src") || "";
    const fromCard = el.matches(".c-item") && Boolean(image);
    if (catalog.get(el.dataset.id)?.image && !fromCard) return;
    catalog.set(el.dataset.id, { name: el.dataset.nome, price: Number(el.dataset.preco), image, framed: fromCard });
  });

  /** @type {{ id: string, qty: number }[]} */
  let order = load();

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return saved.filter((line) => catalog.has(line.id) && line.qty > 0);
    } catch {
      return [];
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch { /* aba anônima: o pedido vale só nesta visita */ }
  }

  /** "meio cento", "1 cento", "1 cento e meio", "2 centos". */
  function centosText(qty) {
    const whole = Math.trunc(qty);
    const hasHalf = qty - whole === HALF;
    if (whole === 0) return "meio cento";
    const base = whole === 1 ? "1 cento" : `${whole} centos`;
    return hasHalf ? `${base} e meio` : base;
  }

  /** Forma curta para o botão e a barra: "½", "1", "1½". */
  function centosShort(qty) {
    const whole = Math.trunc(qty);
    const hasHalf = qty - whole === HALF;
    if (whole === 0) return "½";
    return hasHalf ? `${whole}½` : String(whole);
  }

  function add(id) {
    const line = order.find((l) => l.id === id);
    if (line) line.qty += ADD_STEP;
    else order.push({ id, qty: ADD_STEP });
    save();
    render();
    toast(`${catalog.get(id).name}: ${centosText(qtyOf(id))} no pedido`);
  }

  /** O painel anda de meio em meio cento; zerar tira a linha. */
  function changeQty(index, direction) {
    order[index].qty += direction * HALF;
    if (order[index].qty <= 0) order.splice(index, 1);
    save();
    render();
  }

  const subtotal = () => order.reduce((sum, l) => sum + catalog.get(l.id).price * l.qty, 0);
  const count = () => order.reduce((sum, l) => sum + l.qty, 0);
  const qtyOf = (id) => order.find((l) => l.id === id)?.qty || 0;
  const frozenDiscount = () => (choices().frozen ? FROZEN_DISCOUNT * count() : 0);
  const total = () => subtotal() - frozenDiscount();

  /* Datas da encomenda: no fuso do aparelho, a partir de hoje mais a antecedência da casa */
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const fromIso = (value) => { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d); };
  const longDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const weekdayName = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });

  /** "No domingo", "Na segunda-feira": sábado e domingo pedem o artigo masculino. */
  const onDayOf = (date) => `${date.getDay() === 0 || date.getDay() === 6 ? "No" : "Na"} ${weekdayName.format(date)}`;

  /** "8h", "16h30". */
  const clockText = (minutes) => `${Math.floor(minutes / 60)}h${minutes % 60 ? pad(minutes % 60) : ""}`;

  /** Por que a pronta entrega não vale agora (dia fechado, domingo, fora do horário), ou "". */
  function sameDayProblem(now = new Date()) {
    const day = now.getDay();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const lastCall = CLOSES - SAME_DAY_PREP;
    if (day === CLOSED_DAY) return `${onDayOf(now)} a casa não abre.`;
    if (day === PICKUP_ONLY_DAY) return `${onDayOf(now)} é só retirada de encomenda, ${PICKUP_ONLY_HOURS}.`;
    if (minutes < OPENS) return `A pronta entrega começa às ${clockText(OPENS)}.`;
    if (minutes >= PAUSE_START && minutes < PAUSE_END) return `Pausa do almoço até as ${clockText(PAUSE_END)}.`;
    if (minutes > lastCall) return `Pronta entrega só até as ${clockText(lastCall)}, para sair antes das ${clockText(CLOSES)}.`;
    return "";
  }

  function firstOrderDate() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + LEAD_DAYS);
    return date;
  }

  let liveWarning = "";
  const form = $("#escolha");
  const dateField = $("#campo-data");
  const warning = $("#aviso-pedido");
  dateField.min = isoDate(firstOrderDate());

  function choices() {
    const data = new FormData(form);
    const text = (name) => String(data.get(name) || "").trim();
    return {
      delivery: data.get("entrega") === "entrega",
      frozen: data.get("preparo") === "congelado",
      preorder: data.get("quando") === "encomenda",
      date: text("data"),
      slot: text("turno"),
      bairro: text("bairro"),
      name: text("nome"),
      obs: text("obs"),
    };
  }

  /* Fora do horário a opção "Hoje" fica desligada, com o motivo no lugar da regra, e o pedido vai
     para a encomenda. Confere de novo a cada redesenho, porque a página pode ficar aberta de uma
     hora para outra. */
  const sameDayInput = $('input[name="quando"][value="hoje"]');
  const sameDayRule = $("#hoje-regra");
  const SAME_DAY_TEXT = sameDayRule.textContent;
  function syncSameDay() {
    const reason = sameDayProblem();
    sameDayInput.disabled = Boolean(reason);
    $("#opcao-hoje").classList.toggle("indisponivel", Boolean(reason));
    const text = reason || SAME_DAY_TEXT;
    if (sameDayRule.textContent !== text) sameDayRule.textContent = text;
    if (reason && sameDayInput.checked) $('input[name="quando"][value="encomenda"]').checked = true;
  }

  /** Quantidade fora da regra da casa: aparece na hora, sem esperar o toque em mandar. */
  function quantityProblem() {
    if (order.length === 0) return "";
    if (count() < MIN_CENTOS) return `Pedido mínimo de ${centosText(MIN_CENTOS)} no total. Falta ${centosText(MIN_CENTOS - count())}.`;
    if (!choices().preorder && count() > SAME_DAY_MAX) return `Para hoje, até ${centosText(SAME_DAY_MAX)}. Para mais que isso, escolha encomenda.`;
    return "";
  }

  /** Dia em que a casa não abre, ou domingo com entrega: aparece assim que a data é escolhida. */
  function dayProblem() {
    const c = choices();
    if (!c.preorder || !c.date) return "";
    const date = fromIso(c.date);
    const day = date.getDay();
    const onDay = onDayOf(date);
    if (day === CLOSED_DAY) return `${onDay} a casa não abre. Escolha outro dia.`;
    if (day === PICKUP_ONLY_DAY && c.delivery) return `${onDay} é só retirada no balcão, ${PICKUP_ONLY_HOURS}. Marque retirar ou escolha outro dia.`;
    return "";
  }

  function dateProblem() {
    const c = choices();
    if (!c.preorder) return "";
    if (!c.date) return "Escolha a data da encomenda.";
    if (fromIso(c.date) < firstOrderDate()) return `A casa pede ${LEAD_DAYS} dias de antecedência: a partir de ${longDate.format(firstOrderDate())}.`;
    return dayProblem();
  }

  /* Horários da encomenda: no dia só de retirada, a lista troca pelas faixas da manhã do
     <template id="turnos-retirada">; nos outros dias volta a lista que veio no HTML. */
  const slotField = $("#campo-turno");
  const weekSlots = [...slotField.options].map((option) => option.cloneNode(true));
  const pickupSlots = [...($("#turnos-retirada")?.content.querySelectorAll("option") || [])];
  function syncSlots() {
    const c = choices();
    const pickupDay = c.preorder && c.date && fromIso(c.date).getDay() === PICKUP_ONLY_DAY && pickupSlots.length > 0;
    const wanted = pickupDay ? pickupSlots : weekSlots;
    if (slotField.options[0]?.value === wanted[0].value) return;
    const previous = slotField.value;
    slotField.replaceChildren(...wanted.map((option) => option.cloneNode(true)));
    if ([...slotField.options].some((option) => option.value === previous)) slotField.value = previous;
  }

  /** Motivo para não mandar ainda, ou "" quando está tudo certo. */
  const problem = () => (!choices().preorder && sameDayProblem()) || quantityProblem() || dateProblem();

  function message() {
    const c = choices();
    const lines = order.map((l) => { const item = catalog.get(l.id); return `${centosText(l.qty)} de ${item.name} (${brl.format(item.price * l.qty)})`; });
    const opening = c.preorder ? "Quero fazer uma encomenda para festa:" : "Quero fazer um pedido para hoje:";
    const parts = [`Olá, ${STORE}! ${opening}`, "", ...lines, "", `Total: ${count() * PIECES_PER_CENTO} salgados, ${brl.format(total())}`];
    parts.push(c.frozen ? `Congelados, vou fritar em casa (desconto de ${brl.format(FROZEN_DISCOUNT)} por cento)` : "Fritos, saindo quentes");
    if (c.preorder && c.date) parts.push(`Para ${longDate.format(fromIso(c.date))}, ${c.slot}`);
    parts.push(c.delivery ? `Entrega no bairro: ${c.bairro || "(vou informar)"}` : "Vou retirar no balcão");
    if (c.name) parts.push(`Nome: ${c.name}`);
    if (c.obs) parts.push(`Observação: ${c.obs}`);
    return parts.join("\n");
  }

  function lineTemplate(line, index) {
    const item = catalog.get(line.id);
    return `<li class="item">
      <div class="item-foto${item.framed ? " item-foto-inteira" : ""}">${item.image ? `<img src="${item.image}" alt="">` : '<span class="foto-vazia"></span>'}</div>
      <div><p class="item-nome">${item.name}</p><p class="item-det">${brl.format(item.price)} o cento</p></div>
      <div class="item-lado">
        <span class="item-preco">${brl.format(item.price * line.qty)}</span>
        <span class="qtd">
          <button type="button" data-qtd="${index}" data-delta="-1" aria-label="Tirar meio cento de ${item.name}"><svg class="ico" aria-hidden="true"><use href="#i-minus"/></svg></button>
          <output aria-label="Centos de ${item.name}">${centosShort(line.qty)}</output>
          <button type="button" data-qtd="${index}" data-delta="1" aria-label="Pôr mais meio cento de ${item.name}"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></button>
        </span>
      </div>
    </li>`;
  }

  function renderButtons() {
    $$("[data-por]").forEach((button) => {
      const qty = qtyOf(button.dataset.por);
      button.classList.toggle("adicionado", qty > 0);
      if (qty > 0) button.dataset.noPedido = centosShort(qty);
      else delete button.dataset.noPedido;
    });
  }

  function renderBar(empty) {
    const bar = $("#barra");
    const totalText = brl.format(total());
    $("#barra-qtd").textContent = centosShort(count());
    $("#barra-total").textContent = totalText;
    bar.setAttribute("aria-label", `Ver pedido: ${centosText(count())}, ${totalText}`);
    if (empty) bar.setAttribute("data-vazio", ""); else bar.removeAttribute("data-vazio");
    bar.tabIndex = empty ? -1 : 0;
    $$("[data-contador]").forEach((badge) => {
      badge.textContent = centosShort(count());
      if (empty) badge.setAttribute("data-zero", ""); else badge.removeAttribute("data-zero");
    });
  }

  function render() {
    syncSameDay();
    syncSlots();
    const empty = order.length === 0;
    const c = choices();
    $("#pedido-vazio").hidden = !empty;
    form.hidden = empty;
    $("#pedido-fim").hidden = empty;
    $("#itens").innerHTML = order.map(lineTemplate).join("");
    $("#campo-bairro").hidden = !c.delivery;
    $("#encomenda").hidden = !c.preorder;
    dateField.required = c.preorder;
    const discount = frozenDiscount();
    $("#contas").innerHTML = [
      `<div><dt>Salgados</dt><dd>${count() * PIECES_PER_CENTO}</dd></div>`,
      `<div><dt>Subtotal</dt><dd>${brl.format(subtotal())}</dd></div>`,
      discount ? `<div class="desc"><dt>Congelados</dt><dd>-${brl.format(discount)}</dd></div>` : "",
      `<div class="total"><dt>Total</dt><dd>${brl.format(total())}</dd></div>`,
    ].join("");
    $("#enviar").href = whatsappUrl(message());
    const label = c.preorder ? "Mandar encomenda no WhatsApp" : "Mandar pedido no WhatsApp";
    if ($("#enviar-rotulo").textContent !== label) $("#enviar-rotulo").textContent = label;
    $("#pedido-nota").textContent = c.preorder
      ? "A casa confirma a data, a taxa e manda a chave Pix do sinal de 30%."
      : "O pedido abre pronto no WhatsApp. A casa confirma a taxa e o tempo de preparo.";
    const live = quantityProblem() || dayProblem();
    if (live) {
      if (warning.textContent !== live) warning.textContent = live;
      liveWarning = live;
    } else if (liveWarning) {
      // O aviso da quantidade ou do dia se resolveu: sai, mesmo que a data ainda falte.
      warning.textContent = "";
      liveWarning = "";
    } else if (warning.textContent && !problem()) {
      warning.textContent = "";
    }
    renderButtons();
    renderBar(empty);
  }

  document.addEventListener("click", (event) => {
    const plus = event.target.closest("[data-por]");
    if (plus) add(plus.dataset.por);
    const qty = event.target.closest("[data-qtd][data-delta]");
    if (qty) changeQty(Number(qty.dataset.qtd), Number(qty.dataset.delta));
  });
  // Só "input": o "change" do campo de texto dispara no meio do toque no botão de mandar e o
  // redesenho engolia o clique no WebKit.
  form.addEventListener("input", render);
  form.addEventListener("submit", (event) => event.preventDefault());

  // Pedido abaixo do mínimo, pronta entrega acima do limite ou fora do horário, ou encomenda sem data
  // ou antes da antecedência: não sai, avisa e leva o foco ao que precisa mudar.
  $("#enviar").addEventListener("click", (event) => {
    const reason = problem();
    if (!reason) return;
    event.preventDefault();
    warning.textContent = reason;
    const lateForToday = !choices().preorder && sameDayProblem();
    (lateForToday ? $('input[name="quando"][value="encomenda"]') : dateProblem() ? dateField : $("[data-qtd][data-delta=\"1\"]")).focus();
  });

  /* Depoimentos: um por vez, setas e teclado */
  const reviews = $$(".m-depo-item");
  const dots = $$(".m-depo-pontos i");
  let current = 0;
  function showReview(index) {
    current = (index + reviews.length) % reviews.length;
    reviews.forEach((review, i) => { review.hidden = i !== current; });
    dots.forEach((dot, i) => dot.classList.toggle("ativo", i === current));
  }
  $$("[data-depo]").forEach((button) => button.addEventListener("click", () => showReview(current + Number(button.dataset.depo))));

  /* Nome do rodapé ocupando a largura do cartão, sem passar de uma altura razoável */
  function fitNames() {
    $$("[data-encaixar]").forEach((name) => {
      const holder = name.parentElement;
      holder.classList.remove("encaixado");
      name.style.fontSize = "";
      holder.classList.add("encaixado");
      const width = holder.clientWidth;
      const natural = name.getBoundingClientRect().width;
      if (!width || !natural) return;
      const size = parseFloat(getComputedStyle(name).fontSize);
      name.style.fontSize = `${Math.min(size * (width / natural), width * NAME_MAX_RATIO).toFixed(2)}px`;
    });
  }
  let fitFrame = 0;
  const refit = () => { cancelAnimationFrame(fitFrame); fitFrame = requestAnimationFrame(fitNames); };
  window.addEventListener("resize", refit);
  // A fonte de um estilo pode chegar depois do fonts.ready (o WebKit só pede quando precisa).
  document.fonts.addEventListener("loadingdone", refit);
  window.addEventListener("load", refit);
  document.fonts.ready.then(refit);
  fitNames();

  /* Movimento próprio do esqueleto; o da base cuida dos títulos. ?estatico desliga. */
  document.addEventListener("DOMContentLoaded", () => {
    if (still || document.visibilityState !== "visible" || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".m-capa-produto > .m-recortada", { y: 40, opacity: 0, duration: 1.1, ease: "power3.out", delay: 0.1 });
      gsap.from(".m-nota", { x: 16, opacity: 0, duration: 0.8, ease: "power3.out", delay: 0.45 });
      const reveal = (selector, trigger, from) => {
        const items = $$(selector);
        if (!items.length) return;
        gsap.from(items, { y: from.y, opacity: 0, duration: from.duration, stagger: from.stagger, ease: "power3.out", scrollTrigger: { trigger, start: "top 88%", once: true } });
      };
      reveal(".m-solta", ".m-casa", { y: 30, duration: 0.8, stagger: 0.15 });
      reveal(".m-destaque-foto", ".m-destaque", { y: 36, duration: 0.9, stagger: 0 });
      reveal(".m-cartoes .c-item", ".m-cartoes", { y: 36, duration: 0.7, stagger: 0.07 });
      reveal(".m-depo-caixa", ".m-depo", { y: 30, duration: 0.8, stagger: 0 });
      reveal(".m-rodape-cartao", ".m-rodape", { y: 30, duration: 0.8, stagger: 0 });
    });
  });

  render();
})();
