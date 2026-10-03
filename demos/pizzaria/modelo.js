// Vitrine de produto (esqueleto marca): o botão redondo de cada produto põe no pedido, a barra de
// baixo mostra quantos e quanto, e o painel manda tudo pronto para o WhatsApp, com retirada ou
// entrega e, na encomenda, a data e o horário. Também troca os depoimentos e encaixa o nome do
// rodapé na largura do cartão. Os produtos vêm dos atributos data-* que já estão no HTML.
// Da Chaminé Pizzaria: o meia a meia cria uma linha de pedido na hora (preço do sabor mais caro,
// por tamanho), os cartões são sempre a pizza grande, a casa fecha na segunda e fatia sozinha não
// sai para entrega. Pizza inteira tem um id só, "pizza:<sabor>:<g|m>", venha do cartão, da lista
// ou do montador com o mesmo sabor nas duas metades, para cair na mesma linha do pedido.
(() => {
  "use strict";
  const { $, $$, brl, toast, whatsappUrl } = window.Modelo;

  const STORE = document.body.dataset.loja || "a casa";
  const LEAD_DAYS = Number(document.body.dataset.antecedencia || 0);
  const STORAGE_KEY = `pedido:${location.pathname}`;
  const NAME_MAX_RATIO = 0.4;
  const still = new URLSearchParams(location.search).has("estatico");
  if (still) document.documentElement.classList.add("estatico");

  const MONDAY = 1;
  const WHOLE_SIZE_LABEL = " grande";
  const HALF_PREFIX = "meia:";
  const WHOLE_PREFIX = "pizza:";
  const SIZES = { g: { label: "grande", key: "g" }, m: { label: "média", key: "m" } };

  // Preço redondo sem centavos (R$ 54), como no cardápio; centavos só quando existem (R$ 8,50)
  const wholeBrl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const money = (value) => (Number.isInteger(value) ? wholeBrl : brl).format(value);

  /** @type {Map<string, { name: string, price: number, image: string }>} */
  const catalog = new Map();
  $$("[data-id][data-preco]").forEach((el) => {
    const known = catalog.get(el.dataset.id);
    const image = el.querySelector("img")?.getAttribute("src") || known?.image || "";
    // Os cartões do cardápio são sempre a pizza grande: o tamanho vai no nome do pedido
    const name = el.dataset.nome + (el.closest(".m-cartoes") ? WHOLE_SIZE_LABEL : "");
    catalog.set(el.dataset.id, { name, price: Number(el.dataset.preco), image, counterOnly: "balcao" in el.dataset || Boolean(known?.counterOnly) });
  });

  // O meia a meia não tem foto própria: a linha dele mostra o ícone de pizza
  const halfImage = "";

  /** Linhas do meia a meia levam nome e preço junto, porque não existem no HTML. */
  /** @type {{ id: string, qty: number, name?: string, price?: number }[]} */
  let order = load();

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return saved.filter((line) => {
        if (!(line.qty > 0)) return false;
        if (line.id.startsWith(HALF_PREFIX)) {
          if (typeof line.name !== "string" || !(line.price > 0)) return false;
          catalog.set(line.id, { name: line.name, price: line.price, image: halfImage });
          return true;
        }
        return catalog.has(line.id);
      });
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
    toast(`${catalog.get(id).name} no pedido`);
  }

  function changeQty(index, delta) {
    order[index].qty += delta;
    if (order[index].qty <= 0) order.splice(index, 1);
    save();
    render();
  }

  /* Meia a meia: duas metades, e vale o preço do sabor mais caro no tamanho escolhido */
  const halfForm = $("#meia");
  const halfPrice = $("#meia-preco");

  function flavorOf(select) {
    const option = select.selectedOptions[0];
    return { id: option.value, name: option.textContent.trim(), prices: { g: Number(option.dataset.g), m: Number(option.dataset.m) } };
  }

  function halfChoice() {
    const [first, second] = [flavorOf(halfForm.elements.a), flavorOf(halfForm.elements.b)].sort((x, y) => x.id.localeCompare(y.id));
    const size = SIZES[halfForm.elements.tam.value];
    const price = Math.max(first.prices[size.key], second.prices[size.key]);
    if (first.id === second.id) return { id: `${WHOLE_PREFIX}${first.id}:${size.key}`, name: `${first.name} ${size.label}`, price };
    return { id: `${HALF_PREFIX}${first.id}+${second.id}:${size.key}`, name: `Meia a meia ${size.label}: ${first.name} e ${second.name}`, price };
  }

  function addHalf() {
    const { id, name, price } = halfChoice();
    if (!catalog.has(id)) catalog.set(id, { name, price, image: halfImage });
    const line = order.find((l) => l.id === id);
    if (line) line.qty += 1;
    else order.push({ id, qty: 1, name, price });
    save();
    render();
    toast(`${name} no pedido`);
  }

  const showHalfPrice = () => { halfPrice.textContent = money(halfChoice().price); };
  halfForm.addEventListener("input", showHalfPrice);
  halfForm.addEventListener("submit", (event) => event.preventDefault());
  $("#meia-por").addEventListener("click", addHalf);
  showHalfPrice();

  const subtotal = () => order.reduce((sum, l) => sum + catalog.get(l.id).price * l.qty, 0);
  const count = () => order.reduce((sum, l) => sum + l.qty, 0);
  const qtyOf = (id) => order.find((l) => l.id === id)?.qty || 0;

  /* Datas da encomenda: no fuso do aparelho, a partir de hoje mais a antecedência da casa */
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const fromIso = (value) => { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d); };
  const longDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });

  function firstOrderDate() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + LEAD_DAYS);
    return date;
  }

  const form = $("#escolha");
  const dateField = $("#campo-data");
  const warning = $("#aviso-pedido");
  dateField.min = isoDate(firstOrderDate());

  function choices() {
    const data = new FormData(form);
    const text = (name) => String(data.get(name) || "").trim();
    return {
      delivery: data.get("entrega") === "entrega",
      preorder: data.get("quando") === "encomenda",
      date: text("data"),
      slot: text("turno"),
      bairro: text("bairro"),
      name: text("nome"),
      obs: text("obs"),
    };
  }

  /** Motivo para não mandar ainda, ou "" quando está tudo certo. */
  function problem() {
    const c = choices();
    if (c.delivery && order.length > 0 && order.every((line) => catalog.get(line.id).counterOnly)) return "Fatia sozinha sai só no balcão. Para entrega, ponha uma pizza junto ou escolha Retirar no balcão.";
    if (!c.preorder) return new Date().getDay() === MONDAY ? "Hoje é segunda e a casa fecha. Escolha Encomenda para outro dia." : "";
    if (!c.date) return "Escolha a data da encomenda.";
    const date = fromIso(c.date);
    if (date < firstOrderDate()) return `A casa pede ${LEAD_DAYS} ${LEAD_DAYS === 1 ? "dia" : "dias"} de antecedência: a partir de ${longDate.format(firstOrderDate())}.`;
    if (date.getDay() === MONDAY) return "A casa fecha na segunda. Escolha outro dia.";
    return "";
  }

  function message() {
    const c = choices();
    const lines = order.map((l) => { const item = catalog.get(l.id); return `${l.qty}x ${item.name} (${money(item.price * l.qty)})`; });
    const opening = c.preorder ? "Quero fazer uma encomenda:" : "Quero fazer um pedido:";
    const parts = [`Olá, ${STORE}! ${opening}`, "", ...lines, "", `Subtotal: ${money(subtotal())}`];
    if (c.preorder && c.date) parts.push(`Para ${longDate.format(fromIso(c.date))}, ${c.slot}`);
    parts.push(c.delivery ? `Entrega no bairro: ${c.bairro || "(vou informar)"}` : "Vou retirar no balcão");
    if (c.name) parts.push(`Nome: ${c.name}`);
    if (c.obs) parts.push(`Observação: ${c.obs}`);
    return parts.join("\n");
  }

  function lineTemplate(line, index) {
    const item = catalog.get(line.id);
    return `<li class="item">
      <div class="item-foto">${item.image ? `<img src="${item.image}" alt="">` : '<svg class="ico" aria-hidden="true"><use href="#i-pizza"/></svg>'}</div>
      <div><p class="item-nome">${item.name}</p><p class="item-det">${money(item.price)} cada</p></div>
      <div class="item-lado">
        <span class="item-preco">${money(item.price * line.qty)}</span>
        <span class="qtd">
          <button type="button" data-qtd="${index}" data-delta="-1" aria-label="Tirar um ${item.name}"><svg class="ico" aria-hidden="true"><use href="#i-minus"/></svg></button>
          <output aria-label="Quantidade">${line.qty}</output>
          <button type="button" data-qtd="${index}" data-delta="1" aria-label="Pôr mais um ${item.name}"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></button>
        </span>
      </div>
    </li>`;
  }

  function renderButtons() {
    $$("[data-por]").forEach((button) => {
      const qty = qtyOf(button.dataset.por);
      button.classList.toggle("adicionado", qty > 0);
      if (qty > 0) button.dataset.noPedido = String(qty);
      else delete button.dataset.noPedido;
    });
  }

  function renderBar(empty) {
    const bar = $("#barra");
    const total = money(subtotal());
    $("#barra-qtd").textContent = String(count());
    $("#barra-total").textContent = total;
    bar.setAttribute("aria-label", `Ver pedido: ${count()} ${count() === 1 ? "item" : "itens"}, ${total}`);
    if (empty) bar.setAttribute("data-vazio", ""); else bar.removeAttribute("data-vazio");
    bar.tabIndex = empty ? -1 : 0;
    $$("[data-contador]").forEach((badge) => {
      badge.textContent = String(count());
      if (empty) badge.setAttribute("data-zero", ""); else badge.removeAttribute("data-zero");
    });
  }

  function render() {
    const empty = order.length === 0;
    const c = choices();
    $("#pedido-vazio").hidden = !empty;
    form.hidden = empty;
    $("#pedido-fim").hidden = empty;
    $("#itens").innerHTML = order.map(lineTemplate).join("");
    $("#campo-bairro").hidden = !c.delivery;
    $("#encomenda").hidden = !c.preorder;
    dateField.required = c.preorder;
    $("#contas").innerHTML = `<div class="total"><dt>Subtotal</dt><dd>${money(subtotal())}</dd></div>`;
    $("#enviar").href = whatsappUrl(message());
    const label = c.preorder ? "Mandar encomenda no WhatsApp" : "Mandar pedido no WhatsApp";
    if ($("#enviar-rotulo").textContent !== label) $("#enviar-rotulo").textContent = label;
    if (warning.textContent && !problem()) warning.textContent = "";
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

  // Encomenda sem data (ou antes da antecedência) não sai: avisa e leva ao campo.
  $("#enviar").addEventListener("click", (event) => {
    const reason = problem();
    if (!reason) return;
    event.preventDefault();
    warning.textContent = reason;
    if (choices().preorder) dateField.focus();
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
      reveal(".m-cartoes .c-item", ".m-cartoes", { y: 36, duration: 0.7, stagger: 0.07 });
      reveal(".m-da-casa", ".m-da-casa", { y: 30, duration: 0.8, stagger: 0 });
      reveal(".m-depo-caixa", ".m-depo", { y: 30, duration: 0.8, stagger: 0 });
      reveal(".m-rodape-cartao", ".m-rodape", { y: 30, duration: 0.8, stagger: 0 });
    });
  });

  render();
})();
