// Vitrine de produto (esqueleto marca) da Umbu Sorveteria: o botão redondo de cada produto põe no
// pedido, a barra de baixo mostra quantos e quanto, e o painel manda tudo pronto para o WhatsApp,
// com retirada ou entrega e, na encomenda, a data e o horário. Da sorveteria: casquinha, pote e
// caixa pedem os sabores (o limite vem do bloco #regras e cresce com a quantidade), a caixa de
// festa só sai por encomenda e a entrega tem pedido mínimo. Também troca os depoimentos e encaixa
// o nome do rodapé na largura do cartão. Os produtos vêm dos atributos data-* do HTML.
(() => {
  "use strict";
  const { $, $$, brl, toast, whatsappUrl } = window.Modelo;

  const STORE = document.body.dataset.loja || "a casa";
  const LEAD_DAYS = Number(document.body.dataset.antecedencia || 0);
  const MIN_DELIVERY = Number(document.body.dataset.minimoEntrega || 0);
  const STORAGE_KEY = `pedido:${location.pathname}`;
  const NAME_MAX_RATIO = 0.4;
  const still = new URLSearchParams(location.search).has("estatico");
  if (still) document.documentElement.classList.add("estatico");

  /** @type {Map<string, { name: string, price: number, image: string, badge: string }>} */
  const catalog = new Map();
  $$("[data-id][data-preco]").forEach((el) => {
    const known = catalog.get(el.dataset.id);
    const image = el.querySelector("img")?.getAttribute("src") || known?.image || "";
    // Produto sem foto (a caixa de festa) leva para a folha o selo do cartão de cor, em vez de um quadro vazio
    const badge = el.dataset.selo || known?.badge || "";
    catalog.set(el.dataset.id, { name: el.dataset.nome, price: Number(el.dataset.preco), image, badge });
  });

  /** @type {{ sabores: string[], porUnidade: Record<string, number>, soEncomenda: string[] }} */
  const rules = readRules();

  function readRules() {
    try {
      return JSON.parse($("#regras").textContent);
    } catch {
      return { sabores: [], porUnidade: {}, soEncomenda: [] };
    }
  }

  /** @type {{ id: string, qty: number, flavors: string[] }[]} */
  let order = load();

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return saved
        .filter((line) => catalog.has(line.id) && line.qty > 0)
        .map((line) => trimFlavors({ id: line.id, qty: line.qty, flavors: Array.isArray(line.flavors) ? line.flavors : [] }));
    } catch {
      return [];
    }
  }

  /** Quantos sabores a linha aceita: o limite de cada unidade vezes a quantidade. */
  function flavorLimit(line) {
    return (rules.porUnidade[line.id] || 0) * line.qty;
  }

  function trimFlavors(line) {
    line.flavors = line.flavors.filter((flavor) => rules.sabores.includes(flavor)).slice(0, flavorLimit(line));
    return line;
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch { /* aba anônima: o pedido vale só nesta visita */ }
  }

  function add(id) {
    const line = order.find((l) => l.id === id);
    if (line) line.qty += 1;
    else order.push({ id, qty: 1, flavors: [] });
    if (rules.soEncomenda.includes(id)) form.elements.quando.value = "encomenda";
    save();
    render();
    toast(`${catalog.get(id).name} no pedido`);
  }

  function changeQty(index, delta) {
    order[index].qty += delta;
    if (order[index].qty <= 0) order.splice(index, 1);
    else trimFlavors(order[index]);
    save();
    render();
  }

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

  /** Motivo para não mandar ainda e o campo que resolve, ou null quando está tudo certo. */
  function problem() {
    const c = choices();
    const bare = order.findIndex((line) => flavorLimit(line) > 0 && line.flavors.length === 0);
    if (bare >= 0) {
      return { text: `Escolha pelo menos um sabor: ${catalog.get(order[bare].id).name}.`, target: $(`.m-sabores[data-linha="${bare}"] input`) };
    }
    if (!c.preorder && order.some((line) => rules.soEncomenda.includes(line.id))) {
      return { text: "A caixa de festa só sai por encomenda. Marque Encomenda e escolha a data.", target: form.querySelector('input[name="quando"][value="encomenda"]') };
    }
    if (c.preorder && !c.date) return { text: "Escolha a data da encomenda.", target: dateField };
    if (c.preorder && fromIso(c.date) < firstOrderDate()) {
      const lead = LEAD_DAYS === 1 ? "1 dia" : `${LEAD_DAYS} dias`;
      return { text: `A casa pede ${lead} de antecedência: a partir de ${longDate.format(firstOrderDate())}.`, target: dateField };
    }
    if (c.delivery && subtotal() < MIN_DELIVERY) {
      return { text: `Entrega a partir de ${brl.format(MIN_DELIVERY)} em pedido. Retire no balcão ou ponha mais um item.`, target: form.querySelector('input[name="entrega"][value="retirada"]') };
    }
    return null;
  }

  function message() {
    const c = choices();
    const lines = order.flatMap((l) => {
      const item = catalog.get(l.id);
      const head = `${l.qty}x ${item.name} (${brl.format(item.price * l.qty)})`;
      return l.flavors.length ? [head, `Sabores: ${l.flavors.join(", ")}`] : [head];
    });
    const opening = c.preorder ? "Quero fazer uma encomenda:" : "Quero fazer um pedido:";
    const parts = [`Olá, ${STORE}! ${opening}`, "", ...lines, "", `Subtotal: ${brl.format(subtotal())}`];
    if (c.preorder && c.date) parts.push(`Para ${longDate.format(fromIso(c.date))}, ${c.slot}`);
    parts.push(c.delivery ? `Entrega no bairro: ${c.bairro || "(vou informar)"}` : "Vou retirar no balcão");
    if (c.name) parts.push(`Nome: ${c.name}`);
    if (c.obs) parts.push(`Observação: ${c.obs}`);
    return parts.join("\n");
  }

  function lineThumb(item) {
    if (item.image) return `<img src="${item.image}" alt="">`;
    if (item.badge) return `<span class="m-selo" aria-hidden="true">${item.badge}</span>`;
    return '<span class="foto-vazia"></span>';
  }

  function lineTemplate(line, index) {
    const item = catalog.get(line.id);
    return `<li class="item">
      <div class="item-foto">${lineThumb(item)}</div>
      <div><p class="item-nome">${item.name}</p><p class="item-det">${brl.format(item.price)} cada</p></div>
      <div class="item-lado">
        <span class="item-preco">${brl.format(item.price * line.qty)}</span>
        <span class="qtd">
          <button type="button" data-qtd="${index}" data-delta="-1" aria-label="Tirar um ${item.name}"><svg class="ico" aria-hidden="true"><use href="#i-minus"/></svg></button>
          <output aria-label="Quantidade">${line.qty}</output>
          <button type="button" data-qtd="${index}" data-delta="1" aria-label="Pôr mais um ${item.name}"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></button>
        </span>
      </div>
      ${flavorsTemplate(line, index)}
    </li>`;
  }

  // Com o limite cheio, a lista recolhe e fica só com os sabores escolhidos: com casquinha, pote e caixa
  // no mesmo pedido, as três listas de 15 empurravam o "Para quando" para a quarta tela do celular.
  // Desmarcar um escolhido devolve a lista inteira.
  const flavorsLegend = (limit, full) => (full ? "Sabores escolhidos. Para trocar, toque num deles." : `Sabores: escolha até ${limit}`);

  function flavorsTemplate(line, index) {
    const limit = flavorLimit(line);
    if (!limit) return "";
    const full = line.flavors.length >= limit;
    const chips = rules.sabores.map((flavor) => {
      const checked = line.flavors.includes(flavor);
      const locked = full && !checked;
      return `<label class="m-sabor"${locked ? " hidden" : ""}><input type="checkbox" value="${flavor}"${checked ? " checked" : ""}${locked ? " disabled" : ""}><span>${flavor}</span></label>`;
    }).join("");
    return `<fieldset class="m-sabores" data-linha="${index}"><legend>${flavorsLegend(limit, full)}</legend>${chips}</fieldset>`;
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
    const total = brl.format(subtotal());
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
    $("#contas").innerHTML = `<div class="total"><dt>Subtotal</dt><dd>${brl.format(subtotal())}</dd></div>`;
    updateSend();
    renderButtons();
    renderBar(empty);
  }

  /** Link e aviso do botão de mandar; roda também quando só os sabores mudam, sem redesenhar a lista. */
  function updateSend() {
    const label = choices().preorder ? "Mandar encomenda no WhatsApp" : "Mandar pedido no WhatsApp";
    $("#enviar").href = whatsappUrl(message());
    if ($("#enviar-rotulo").textContent !== label) $("#enviar-rotulo").textContent = label;
    if (warning.textContent && !problem()) warning.textContent = "";
  }

  // Sabores: o campo marcado fica onde está (sem redesenhar, o foco não se perde); quando o limite chega,
  // os outros travam e saem da vista.
  $("#itens").addEventListener("change", (event) => {
    const box = event.target.closest(".m-sabores input");
    if (!box) return;
    const group = box.closest(".m-sabores");
    const line = order[Number(group.dataset.linha)];
    line.flavors = [...group.querySelectorAll("input:checked")].map((input) => input.value);
    const limit = flavorLimit(line);
    const full = line.flavors.length >= limit;
    group.querySelectorAll("input").forEach((input) => {
      const locked = full && !input.checked;
      input.disabled = locked;
      input.closest(".m-sabor").hidden = locked;
    });
    group.querySelector("legend").textContent = flavorsLegend(limit, full);
    save();
    updateSend();
  });

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

  // Pedido com algo faltando (sabor, data, caixa sem encomenda, entrega abaixo do mínimo) não sai: avisa e leva ao campo.
  $("#enviar").addEventListener("click", (event) => {
    const reason = problem();
    if (!reason) return;
    event.preventDefault();
    warning.textContent = reason.text;
    reason.target?.focus();
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

  if (order.some((line) => rules.soEncomenda.includes(line.id))) form.elements.quando.value = "encomenda";
  render();
})();
