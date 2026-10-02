// Brasa Smash: o + põe o item no pedido, a barra de baixo mostra quantos e quanto, e o painel manda
// tudo pronto para o WhatsApp, com taxa por bairro, mínimo de entrega, pagamento e troco. O status
// "aberto agora" sai da tabela de horários (?agora=2026-10-02T20:30 simula a hora).
// Os itens vêm dos atributos data-* das linhas, que já estão no HTML.
(() => {
  "use strict";
  const { $, $$, brl, toast, whatsappUrl } = window.Modelo;

  const STORE = document.body.dataset.loja || "a casa";
  const STORAGE_KEY = `pedido:${location.pathname}`;
  const CATEGORY_LINE = 0.3;
  const DELIVERY_MINIMUM = 20;
  const OPENING_LAST_ORDER_MIN = 30;
  const DAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  /** Hora de abrir e de fechar por dia da semana (0 = domingo); null é dia fechado. */
  const HOURS = [[17, 22], null, [18, 23], [18, 23], [18, 23], [18, 24], [18, 24]];

  /** @type {Map<string, { name: string, price: number, image: string }>} */
  const menu = new Map();
  $$("[data-id][data-preco]").forEach((el) => {
    const known = menu.get(el.dataset.id);
    const image = el.querySelector("img")?.getAttribute("src") || known?.image || "";
    menu.set(el.dataset.id, { name: el.dataset.nome, price: Number(el.dataset.preco), image });
  });

  /** @type {{ id: string, qty: number }[]} */
  let order = load();

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return saved.filter((line) => menu.has(line.id) && line.qty > 0);
    } catch {
      return [];
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch { /* aba anônima: o pedido vale só nesta visita */ }
  }

  function add(id) {
    const line = order.find((l) => l.id === id);
    if (line) line.qty += 1;
    else order.push({ id, qty: 1 });
    save();
    render();
    toast(`${menu.get(id).name} no pedido`);
  }

  function changeQty(index, delta) {
    order[index].qty += delta;
    if (order[index].qty <= 0) order.splice(index, 1);
    save();
    render();
  }

  const subtotal = () => order.reduce((sum, l) => sum + menu.get(l.id).price * l.qty, 0);
  const count = () => order.reduce((sum, l) => sum + l.qty, 0);

  const form = $("#escolha");
  const bairroField = $("#campo-bairro");

  const bairroSelect = form.elements.bairro;
  const payment = form.elements.pagamento;
  const changeField = $("#campo-troco");
  const notes = form.elements.obs;

  function choices() {
    const data = new FormData(form);
    const option = bairroSelect.selectedOptions[0];
    const fee = option && option.dataset.taxa !== undefined && option.dataset.taxa !== "" ? Number(option.dataset.taxa) : null;
    return {
      delivery: data.get("entrega") === "entrega",
      bairro: String(data.get("bairro") || ""),
      fee,
      payment: String(data.get("pagamento") || ""),
      change: String(data.get("troco") || "").trim(),
      obs: String(data.get("obs") || "").trim(),
    };
  }

  /** Taxa que entra na conta: só em entrega e só com bairro de taxa conhecida. */
  const feeToCharge = (c) => (c.delivery && c.fee !== null ? c.fee : 0);
  const total = (c) => subtotal() + feeToCharge(c);

  /** O que falta para o pedido poder sair, ou "" quando está tudo certo. */
  function blocker(c) {
    if (!c.delivery) return "";
    if (!c.bairro) return "Escolha o bairro para ver a taxa.";
    if (subtotal() < DELIVERY_MINIMUM) return `Faltam ${brl.format(DELIVERY_MINIMUM - subtotal())} para o mínimo de entrega (${brl.format(DELIVERY_MINIMUM)}).`;
    const change = Number(c.change.replace(",", "."));
    if (c.payment === "Dinheiro" && c.change && (!Number.isFinite(change) || change < total(c))) return `O troco precisa ser para um valor maior que o total (${brl.format(total(c))}).`;
    return "";
  }

  function message() {
    const c = choices();
    const lines = order.map((l) => { const item = menu.get(l.id); return `${l.qty}x ${item.name} (${brl.format(item.price * l.qty)})`; });
    const parts = [`Olá, ${STORE}! Quero fazer um pedido:`, "", ...lines, "", `Subtotal: ${brl.format(subtotal())}`];
    if (!c.delivery) parts.push("Vou retirar no balcão");
    else if (c.fee === null) parts.push(`Entrega no bairro: ${c.bairro} (confirmem a taxa, por favor)`);
    else parts.push(`Entrega no bairro: ${c.bairro} (taxa ${brl.format(c.fee)})`);
    parts.push(`Total: ${brl.format(total(c))}${c.delivery && c.fee === null ? " mais a taxa" : ""}`);
    parts.push(c.payment === "Dinheiro" ? `Pagamento: dinheiro${c.change ? `, troco para R$ ${c.change}` : ", sem troco"}` : `Pagamento: ${c.payment}`);
    if (c.obs) parts.push(`Observação: ${c.obs}`);
    if (!isOpen(now())) parts.push("(Sei que estão fechados agora, podem responder quando abrir.)");
    return parts.join("\n");
  }

  function lineTemplate(line, index) {
    const item = menu.get(line.id);
    return `<li class="item">
      <div class="item-foto">${item.image ? `<img src="${item.image}" alt="">` : '<span class="item-sem-foto" aria-hidden="true">B</span>'}</div>
      <div><p class="item-nome">${item.name}</p><p class="item-det">${brl.format(item.price)} cada</p></div>
      <div class="item-lado">
        <span class="item-preco">${brl.format(item.price * line.qty)}</span>
        <span class="qtd">
          <button type="button" data-qtd="${index}" data-delta="-1" aria-label="Tirar um"><svg class="ico" aria-hidden="true"><use href="#i-minus"/></svg></button>
          <output>${line.qty}</output>
          <button type="button" data-qtd="${index}" data-delta="1" aria-label="Pôr mais um"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></button>
        </span>
      </div>
    </li>`;
  }

  function render() {
    const empty = order.length === 0;
    $("#pedido-vazio").hidden = !empty;
    form.hidden = empty;
    $("#pedido-fim").hidden = empty;
    $("#itens").innerHTML = order.map(lineTemplate).join("");
    const c = choices();
    bairroField.hidden = !c.delivery;
    changeField.hidden = c.payment !== "Dinheiro";
    const fee = feeToCharge(c);
    const feeLine = !c.delivery ? "" : c.fee === null && c.bairro ? '<div class="taxa"><dt>Taxa de entrega</dt><dd>a confirmar</dd></div>' : fee ? `<div class="taxa"><dt>Taxa de entrega</dt><dd>${brl.format(fee)}</dd></div>` : "";
    $("#contas").innerHTML = `<div><dt>Subtotal</dt><dd>${brl.format(subtotal())}</dd></div>${feeLine}<div class="total"><dt>Total</dt><dd>${brl.format(total(c))}</dd></div>`;
    const stop = blocker(c);
    const send = $("#enviar");
    $("#aviso").textContent = stop;
    send.setAttribute("aria-disabled", stop ? "true" : "false");
    send.tabIndex = stop ? -1 : 0;
    send.href = stop ? "#" : whatsappUrl(message());
    $("#pedido-nota").textContent = isOpen(now())
      ? "O pedido abre pronto no WhatsApp. A casa confirma a taxa e o tempo."
      : "A casa está fechada agora. Pode mandar assim mesmo: respondem quando abrir.";

    const bar = $("#barra");
    $("#barra-qtd").textContent = String(count());
    $("#barra-total").textContent = brl.format(subtotal());
    if (empty) bar.setAttribute("data-vazio", ""); else bar.removeAttribute("data-vazio");
    bar.tabIndex = empty ? -1 : 0;
    $$("[data-por]").forEach((button) => button.classList.toggle("adicionado", order.some((l) => l.id === button.dataset.por)));
  }

  document.addEventListener("click", (event) => {
    const plus = event.target.closest("[data-por]");
    if (plus) add(plus.dataset.por);
    const qty = event.target.closest("[data-qtd]");
    if (qty) changeQty(Number(qty.dataset.qtd), Number(qty.dataset.delta));
  });
  form.addEventListener("input", render);
  form.addEventListener("submit", (event) => event.preventDefault());
  $("#enviar").addEventListener("click", (event) => { if (event.currentTarget.getAttribute("aria-disabled") === "true") event.preventDefault(); });

  /* Ajustes rápidos: cada toque liga ou desliga uma frase na observação */
  $$("[data-ajuste]").forEach((chip) => chip.setAttribute("aria-pressed", "false"));
  $$("[data-ajuste]").forEach((chip) => chip.addEventListener("click", () => {
    const phrase = chip.dataset.ajuste;
    const parts = notes.value.split(/;\s*/).map((part) => part.trim()).filter(Boolean);
    const at = parts.indexOf(phrase);
    if (at >= 0) parts.splice(at, 1); else parts.push(phrase);
    notes.value = parts.join("; ");
    chip.setAttribute("aria-pressed", String(at < 0));
    render();
  }));
  notes.addEventListener("input", () => {
    $$("[data-ajuste]").forEach((chip) => chip.setAttribute("aria-pressed", String(notes.value.includes(chip.dataset.ajuste))));
  });

  /* Aberto agora, pela tabela de horários */
  function now() {
    const forced = new URLSearchParams(location.search).get("agora");
    const date = forced ? new Date(forced) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  const hourLabel = (hour) => (hour === 24 ? "meia-noite" : `${hour}h`);

  function isOpen(date) {
    const today = HOURS[date.getDay()];
    return Boolean(today) && date.getHours() >= today[0] && date.getHours() < today[1];
  }

  function nextOpening(date) {
    const today = HOURS[date.getDay()];
    if (today && date.getHours() < today[0]) return { label: "hoje", hour: today[0] };
    for (let ahead = 1; ahead <= 7; ahead += 1) {
      const day = (date.getDay() + ahead) % 7;
      if (HOURS[day]) return { label: ahead === 1 ? "amanhã" : DAY_NAMES[day], hour: HOURS[day][0] };
    }
    return { label: "em breve", hour: 18 };
  }

  function renderStatus() {
    const date = now();
    const box = $("#status");
    const text = $("#status-texto");
    const detail = $("#status-detalhe");
    if (isOpen(date)) {
      const closing = HOURS[date.getDay()][1];
      const lastOrder = closing * 60 - OPENING_LAST_ORDER_MIN;
      const minutes = date.getHours() * 60 + date.getMinutes();
      box.classList.remove("fechado");
      text.textContent = "Aberto agora";
      detail.textContent = minutes >= lastOrder ? "último pedido já passou" : `fecha ${closing === 24 ? "à" : "às"} ${hourLabel(closing)}`;
    } else {
      const next = nextOpening(date);
      box.classList.add("fechado");
      text.textContent = "Fechado";
      detail.textContent = `abre ${next.label} às ${next.hour}h`;
    }
  }

  /* Categoria visível acesa no topo, e o atalho dela rola para dentro da faixa */
  const links = $$(".c-cats a");
  const sections = $$("[data-cat]");
  function syncCategory() {
    const line = window.scrollY + window.innerHeight * CATEGORY_LINE;
    let current = sections[0];
    sections.forEach((section) => { if (!section.hidden && section.offsetTop <= line) current = section; });
    links.forEach((link) => {
      const on = link.getAttribute("href") === `#${current.id}`;
      if (on && link.getAttribute("aria-current") !== "true") link.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      if (on) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current");
    });
  }
  window.addEventListener("scroll", syncCategory, { passive: true });

  /* Busca pelo nome e pela descrição, sem acento */
  const plain = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  $("#busca").addEventListener("input", (event) => {
    const term = plain(event.target.value.trim());
    let found = 0;
    $$(".c-sec[data-cat]").forEach((section) => {
      if ("fixa" in section.dataset) return;
      let visible = 0;
      $$(".c-item, .c-mini", section).forEach((item) => {
        const show = !term || plain(item.textContent).includes(term);
        item.hidden = !show;
        if (show) visible += 1;
      });
      section.hidden = visible === 0;
      found += visible;
    });
    $("#busca-vazio").hidden = found > 0;
  });

  render();
  renderStatus();
  syncCategory();
})();
