// Tigela Açaí: o + de um item pronto põe no pedido; o + de uma tigela abre a janela de montar
// (base, acompanhamentos e caprichos) e põe a tigela já montada. A barra de baixo mostra quantos e
// quanto, e o painel manda tudo pronto para o WhatsApp. Também acende a categoria visível, mostra
// se a casa está aberta e filtra pela busca. Os itens vêm dos atributos data-* das linhas.
(() => {
  "use strict";
  const { $, $$, brl, toast, whatsappUrl, openDialog, closeDialog } = window.Modelo;

  const STORE = document.body.dataset.loja || "a casa";
  const STORAGE_KEY = `pedido:${location.pathname}`;
  const CATEGORY_LINE = 0.3;
  const MIN_DELIVERY_ORDER = 15;
  const EXTRA_TOPPING = 2;
  const PREMIUM_TOPPING = 4;
  /** Acompanhamentos inclusos em cada tamanho; o id é o do item no cardápio. */
  const FREE_TOPPINGS = { "tigela-300": 2, "tigela-500": 3, "tigela-700": 4, "pote-1l": 5 };
  /** Horário de funcionamento por dia da semana (0 = domingo), em horas decimais. */
  const HOURS = { 0: [14, 22], 1: [13, 22], 2: [13, 22], 3: [13, 22], 4: [13, 22], 5: [12, 23.5], 6: [12, 23.5] };

  /** @type {Map<string, { name: string, price: number, image: string }>} */
  const menu = new Map();
  $$("[data-id][data-preco]").forEach((el) => {
    const known = menu.get(el.dataset.id);
    const image = el.querySelector("img")?.getAttribute("src") || known?.image || "";
    menu.set(el.dataset.id, { name: el.dataset.nome, price: Number(el.dataset.preco), image });
  });

  /** @type {{ id: string, key: string, qty: number, unit: number, parts: string[] }[]} */
  let order = load();

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return saved
        .filter((line) => menu.has(line.id) && line.qty > 0 && line.key && line.unit > 0 && Array.isArray(line.parts))
        .map((line) => ({ id: line.id, key: line.key, qty: line.qty, unit: line.unit, parts: line.parts }));
    } catch {
      return [];
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch { /* aba anônima: o pedido vale só nesta visita */ }
  }

  function add(id, key = id, unit = menu.get(id).price, parts = []) {
    const line = order.find((l) => l.key === key);
    if (line) line.qty += 1;
    else order.push({ id, key, qty: 1, unit, parts });
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

  const subtotal = () => order.reduce((sum, l) => sum + l.unit * l.qty, 0);
  const count = () => order.reduce((sum, l) => sum + l.qty, 0);

  const form = $("#escolha");
  const bairroField = $("#campo-bairro");
  const addressField = $("#campo-endereco");

  function choices() {
    const data = new FormData(form);
    return {
      delivery: data.get("entrega") === "entrega",
      bairro: String(data.get("bairro") || "").trim(),
      address: String(data.get("endereco") || "").trim(),
      obs: String(data.get("obs") || "").trim(),
    };
  }

  function message() {
    const c = choices();
    const lines = order.flatMap((l) => [`${l.qty}x ${menu.get(l.id).name} (${brl.format(l.unit * l.qty)})`, ...l.parts.map((part) => `   ${part}`)]);
    const parts = [`Olá, ${STORE}! Quero fazer um pedido:`, "", ...lines, "", `Subtotal: ${brl.format(subtotal())}`];
    if (c.delivery) {
      parts.push(`Entrega no bairro: ${c.bairro || "(vou informar)"}`);
      parts.push(`Endereço: ${c.address || "(vou informar)"}`);
    } else {
      parts.push("Vou retirar no balcão");
    }
    if (c.obs) parts.push(`Observação: ${c.obs}`);
    return parts.join("\n");
  }

  function lineTemplate(line, index) {
    const item = menu.get(line.id);
    return `<li class="item">
      <div class="item-foto">${item.image ? `<img src="${item.image}" alt="">` : '<span class="item-sem-foto" aria-hidden="true">T</span>'}</div>
      <div><p class="item-nome">${item.name}</p><p class="item-det">${line.parts.length ? `${line.parts.join(". ")}. ` : ""}${brl.format(line.unit)} cada</p></div>
      <div class="item-lado">
        <span class="item-preco">${brl.format(line.unit * line.qty)}</span>
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
    const delivery = choices().delivery;
    bairroField.hidden = !delivery;
    addressField.hidden = !delivery;
    $("#contas").innerHTML = `<div class="total"><dt>Subtotal</dt><dd>${brl.format(subtotal())}</dd></div>`;
    $("#enviar").href = whatsappUrl(message());
    renderMinimum(delivery);

    const bar = $("#barra");
    $("#barra-qtd").textContent = String(count());
    $("#barra-total").textContent = brl.format(subtotal());
    if (empty) bar.setAttribute("data-vazio", ""); else bar.removeAttribute("data-vazio");
    bar.tabIndex = empty ? -1 : 0;
    $$("[data-por]").forEach((button) => button.classList.toggle("adicionado", order.some((l) => l.id === button.dataset.por)));
  }

  /* Pedido mínimo vale só para entrega: abaixo dele o botão do WhatsApp fica desligado */
  function renderMinimum(delivery) {
    const missing = MIN_DELIVERY_ORDER - subtotal();
    const blocked = delivery && missing > 0;
    const notice = $("#aviso-minimo");
    notice.hidden = !blocked;
    if (blocked) notice.textContent = `Pedido mínimo para entrega: ${brl.format(MIN_DELIVERY_ORDER)}. Faltam ${brl.format(missing)}, ou escolha retirar no balcão.`;
    const send = $("#enviar");
    if (blocked) { send.setAttribute("aria-disabled", "true"); send.tabIndex = -1; }
    else { send.removeAttribute("aria-disabled"); send.removeAttribute("tabindex"); }
  }

  /* Janela de montar a tigela */
  const builder = $("#monte");
  const builderForm = $("#monte-form");
  let bowlId = "";

  const picked = (name) => $$(`input[name="${name}"]:checked`, builderForm).map((input) => input.value);

  function bowl() {
    const free = FREE_TOPPINGS[bowlId];
    const base = $('input[name="base"]:checked', builderForm);
    const toppings = picked("acomp");
    const premium = picked("capricho");
    const paidToppings = Math.max(0, toppings.length - free);
    const baseExtra = Number(base.dataset.extra || 0);
    const unit = menu.get(bowlId).price + baseExtra + paidToppings * EXTRA_TOPPING + premium.length * PREMIUM_TOPPING;
    return { free, base: base.value, baseExtra, toppings, premium, paidToppings, unit };
  }

  function renderBowl() {
    const b = bowl();
    const left = Math.max(0, b.free - b.toppings.length);
    $("#monte-gratis").textContent = b.paidToppings > 0
      ? `${b.free} de graça, mais ${b.paidToppings} a ${brl.format(EXTRA_TOPPING)} cada`
      : `${b.free} de graça${left < b.free ? `, ainda cabem ${left}` : ""}`;
    const extras = [];
    if (b.baseExtra) extras.push(`cupuaçu ${brl.format(b.baseExtra)}`);
    if (b.paidToppings) extras.push(`${b.paidToppings} acompanhamento${b.paidToppings > 1 ? "s" : ""} a mais ${brl.format(b.paidToppings * EXTRA_TOPPING)}`);
    if (b.premium.length) extras.push(`${b.premium.length} capricho${b.premium.length > 1 ? "s" : ""} ${brl.format(b.premium.length * PREMIUM_TOPPING)}`);
    const note = $("#monte-extras");
    note.hidden = extras.length === 0;
    note.textContent = `${brl.format(menu.get(bowlId).price)} da tigela, mais ${extras.join(", ")}.`;
    $("#monte-contas").innerHTML = `<div class="total"><dt>Esta tigela</dt><dd>${brl.format(b.unit)}</dd></div>`;
    $("#monte-ok").textContent = `Pôr no pedido · ${brl.format(b.unit)}`;
  }

  function openBuilder(id) {
    bowlId = id;
    builderForm.reset();
    $("#monte-resumo").textContent = `${menu.get(id).name} por ${brl.format(menu.get(id).price)}, com ${FREE_TOPPINGS[id]} acompanhamentos inclusos.`;
    renderBowl();
    openDialog(builder);
  }

  function addBowl() {
    const b = bowl();
    const parts = [`Base: ${b.base}`];
    if (b.toppings.length) parts.push(`Acompanhamentos: ${b.toppings.join(", ")}`);
    if (b.premium.length) parts.push(`Caprichos: ${b.premium.join(", ")}`);
    const key = [bowlId, b.base, [...b.toppings].sort().join("+"), [...b.premium].sort().join("+")].join("|");
    add(bowlId, key, b.unit, parts);
    closeDialog(builder);
  }

  builderForm.addEventListener("input", renderBowl);
  builderForm.addEventListener("submit", (event) => event.preventDefault());
  $("#monte-ok").addEventListener("click", addBowl);

  document.addEventListener("click", (event) => {
    const plus = event.target.closest("[data-por]");
    if (plus) {
      if (FREE_TOPPINGS[plus.dataset.por]) openBuilder(plus.dataset.por);
      else add(plus.dataset.por);
    }
    const qty = event.target.closest("[data-qtd]");
    if (qty) changeQty(Number(qty.dataset.qtd), Number(qty.dataset.delta));
  });
  form.addEventListener("input", render);
  $("#enviar").addEventListener("click", (event) => { if (event.currentTarget.getAttribute("aria-disabled") === "true") event.preventDefault(); });
  form.addEventListener("submit", (event) => event.preventDefault());

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
      if (section.id === "info") return;
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

  /* Aberto agora ou não, pelo horário da tabela. ?agora=2026-10-02T10:30 simula a hora. */
  const clock = (hours) => `${Math.floor(hours)}h${hours % 1 ? String(Math.round((hours % 1) * 60)).padStart(2, "0") : ""}`;
  function renderStatus() {
    const simulated = new URLSearchParams(location.search).get("agora");
    const now = simulated ? new Date(simulated) : new Date();
    const [open, close] = HOURS[now.getDay()];
    const hour = now.getHours() + now.getMinutes() / 60;
    const isOpen = hour >= open && hour < close;
    $("#status").toggleAttribute("data-fechado", !isOpen);
    $("#status-texto").textContent = isOpen ? "Aberto agora" : "Fechado agora";
    if (isOpen) {
      $("#status-hora").textContent = `fecha às ${clock(close)}`;
    } else if (hour < open) {
      $("#status-hora").textContent = `abre hoje às ${clock(open)}`;
    } else {
      $("#status-hora").textContent = `abre amanhã às ${clock(HOURS[(now.getDay() + 1) % 7][0])}`;
    }
  }

  renderStatus();
  render();
  syncCategory();
})();
