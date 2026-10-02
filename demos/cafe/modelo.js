// Caneca Azul: cardápio simples com comanda no WhatsApp e bolo por encomenda.
// O + põe o item na comanda, a barra de baixo mostra quantos e quanto, e o painel manda tudo pronto
// para o WhatsApp. A comanda é para retirar no balcão ou comer aqui (a casa não entrega). O bolo por
// encomenda é montado pelo sabor e pelo tamanho, pede dia e turno de retirada e cobra sinal de metade.
// Os itens vêm dos atributos data-* das linhas, que já estão no HTML.
(() => {
  "use strict";
  const { $, $$, brl, toast, whatsappUrl } = window.Modelo;

  const STORE = document.body.dataset.loja || "a casa";
  const STORAGE_KEY = `pedido:${location.pathname}`;
  const CATEGORY_LINE = 0.3;
  const CAKE_NOTICE_DAYS = 2;
  const DEPOSIT_SHARE = 0.5;
  const SUNDAY = 0;
  const MONDAY = 1;
  const MINUTES_PER_HOUR = 60;
  const HOURS_BY_WEEKDAY = {
    // [abre, fecha] em minutos desde a meia-noite; segunda não tem linha porque a casa fecha
    0: [7 * MINUTES_PER_HOUR, 12 * MINUTES_PER_HOUR],
    2: [6.5 * MINUTES_PER_HOUR, 19 * MINUTES_PER_HOUR],
    3: [6.5 * MINUTES_PER_HOUR, 19 * MINUTES_PER_HOUR],
    4: [6.5 * MINUTES_PER_HOUR, 19 * MINUTES_PER_HOUR],
    5: [6.5 * MINUTES_PER_HOUR, 19 * MINUTES_PER_HOUR],
    6: [7 * MINUTES_PER_HOUR, 19 * MINUTES_PER_HOUR],
  };
  const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

  /** Relógio da página; ?agora=2026-10-02T10:30 simula a hora, para conferir aberto e fechado. */
  function now() {
    const forced = new URLSearchParams(location.search).get("agora");
    const date = forced ? new Date(forced) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  /** @type {Map<string, { name: string, price: number, image: string, cake: boolean }>} */
  const menu = new Map();
  $$("[data-id][data-preco]").forEach((el) => {
    const known = menu.get(el.dataset.id);
    const image = el.querySelector("img")?.getAttribute("src") || known?.image || "";
    menu.set(el.dataset.id, { name: el.dataset.nome, price: Number(el.dataset.preco), image, cake: false });
  });

  /* Bolo por encomenda: uma entrada no cardápio para cada par sabor e tamanho */
  const cakeForm = $("#encomenda");
  const cakeImage = $(".c-enc-foto img", cakeForm)?.getAttribute("src") || "";
  const flavors = $$("input[name=sabor]", cakeForm);
  const sizes = $$("input[name=tamanho]", cakeForm);
  const cakeId = (flavor, size) => `bolo:${flavor.value}:${size.value}`;
  const cakePrice = (flavor, size) => Number(flavor.dataset.precos.split(",")[Number(size.value)]);
  flavors.forEach((flavor) => sizes.forEach((size) => {
    menu.set(cakeId(flavor, size), { name: `${flavor.dataset.nome}, ${size.dataset.nome}`, price: cakePrice(flavor, size), image: cakeImage, cake: true });
  }));

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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch { /* aba anônima: a comanda vale só nesta visita */ }
  }

  function add(id) {
    const line = order.find((l) => l.id === id);
    if (line) line.qty += 1;
    else order.push({ id, qty: 1 });
    save();
    render();
    toast(`${menu.get(id).name} na comanda`);
  }

  function changeQty(index, delta) {
    order[index].qty += delta;
    if (order[index].qty <= 0) order.splice(index, 1);
    save();
    render();
  }

  const linesOf = (cake) => order.filter((l) => menu.get(l.id).cake === cake);
  const total = (lines) => lines.reduce((sum, l) => sum + menu.get(l.id).price * l.qty, 0);
  const count = () => order.reduce((sum, l) => sum + l.qty, 0);

  const form = $("#escolha");

  function choices() {
    const data = new FormData(form);
    return {
      mode: String(data.get("modo") || "retirada"),
      time: String(data.get("hora") || ""),
      guests: String(data.get("pessoas") || "1"),
      day: String(data.get("dia") || ""),
      shift: String(data.get("turno") || ""),
      name: String(data.get("nome") || "").trim(),
      notes: String(data.get("obs") || "").trim(),
    };
  }

  /* Dia do bolo: dois dias de antecedência, sem segunda, e domingo só de manhã */
  const pad = (n) => String(n).padStart(2, "0");
  const isoDay = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parseDay = (iso) => new Date(`${iso}T12:00:00`);

  function earliestCakeDay() {
    const date = now();
    date.setDate(date.getDate() + CAKE_NOTICE_DAYS);
    if (date.getDay() === MONDAY) date.setDate(date.getDate() + 1);
    return date;
  }

  function cakeProblem(c) {
    if (!c.day) return "Escolha o dia da retirada do bolo.";
    const day = parseDay(c.day);
    if (Number.isNaN(day.getTime())) return "Escolha o dia da retirada do bolo.";
    if (c.day < isoDay(earliestCakeDay())) return "O bolo precisa de dois dias de antecedência. Escolha uma data mais à frente.";
    if (day.getDay() === MONDAY) return "Segunda a casa fecha. Escolha outro dia.";
    if (day.getDay() === SUNDAY && c.shift.startsWith("à tarde")) return "No domingo a retirada é só de manhã.";
    return "";
  }

  function formatTime(value) {
    const [hours, minutes] = value.split(":");
    return minutes === "00" ? `${Number(hours)}h` : `${Number(hours)}h${minutes}`;
  }

  function formatDay(iso) {
    const day = parseDay(iso);
    return `${WEEKDAY_NAMES[day.getDay()]}, ${pad(day.getDate())}/${pad(day.getMonth() + 1)}`;
  }

  const lineText = (l) => { const item = menu.get(l.id); return `${l.qty}x ${item.name} (${brl.format(item.price * l.qty)})`; };

  function message() {
    const c = choices();
    const food = linesOf(false);
    const cakes = linesOf(true);
    const parts = [`Olá, ${STORE}! ${food.length ? "Quero fazer uma comanda:" : "Quero encomendar um bolo:"}`, ""];
    if (food.length) {
      parts.push(...food.map(lineText), "", `Total da comanda: ${brl.format(total(food))}`);
      parts.push(c.mode === "mesa" ? `Quero comer aí: mesa para ${c.guests} ${c.guests === "1" ? "pessoa" : "pessoas"}` : `Retiro no balcão${c.time ? ` às ${formatTime(c.time)}` : ""}`);
    }
    if (cakes.length) {
      if (food.length) parts.push("", "Bolo por encomenda:");
      parts.push(...cakes.map(lineText), `Retirada: ${c.day ? formatDay(c.day) : "(vou combinar)"}, ${c.shift}`);
      parts.push(`Sinal de metade no Pix: ${brl.format(total(cakes) * DEPOSIT_SHARE)}`);
    }
    if (c.name) parts.push("", `Nome: ${c.name}`);
    if (c.notes) parts.push(`Observação: ${c.notes}`);
    return parts.join("\n");
  }

  function lineTemplate(line, index) {
    const item = menu.get(line.id);
    const detail = item.cake ? `${brl.format(item.price)} cada, por encomenda` : `${brl.format(item.price)} cada`;
    return `<li class="item">
      <div class="item-foto">${item.image ? `<img src="${item.image}" alt="">` : '<span class="item-sem-foto" aria-hidden="true">C</span>'}</div>
      <div><p class="item-nome">${item.name}</p><p class="item-det">${detail}</p></div>
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

  function summaryRows(food, cakes) {
    const sum = (label, value, cls = "") => `<div class="${cls}"><dt>${label}</dt><dd>${brl.format(value)}</dd></div>`;
    const rows = [];
    if (food.length && cakes.length) rows.push(sum("Comanda de hoje", total(food)));
    if (cakes.length) rows.push(sum("Bolo por encomenda", total(cakes)), sum("Sinal do bolo no Pix", total(cakes) * DEPOSIT_SHARE, "sinal"));
    rows.push(sum("Total", total(order), "total"));
    return rows.join("");
  }

  const earliest = earliestCakeDay();
  const dayField = $("#campo-dia");
  dayField.min = isoDay(earliest);
  dayField.value = isoDay(earliest);

  function render() {
    const empty = order.length === 0;
    const food = linesOf(false);
    const cakes = linesOf(true);
    const c = choices();
    $("#pedido-vazio").hidden = !empty;
    form.hidden = empty;
    $("#pedido-fim").hidden = empty;
    $("#itens").innerHTML = order.map(lineTemplate).join("");
    $("#bloco-balcao").hidden = food.length === 0;
    $("#bloco-bolo").hidden = cakes.length === 0;
    $("#campo-hora").hidden = c.mode === "mesa";
    $("#campo-mesa").hidden = c.mode !== "mesa";
    $("#aviso-bolo").textContent = cakes.length ? cakeProblem(c) : "";
    $("#contas").innerHTML = summaryRows(food, cakes);
    $("#enviar").href = whatsappUrl(message());

    const bar = $("#barra");
    $("#barra-qtd").textContent = String(count());
    $("#barra-total").textContent = brl.format(total(order));
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

  /* Enviar só com o dia do bolo válido: o aviso já está na tela, então basta levar o olho até ele */
  $("#enviar").addEventListener("click", (event) => {
    if (linesOf(true).length === 0 || !cakeProblem(choices())) return;
    event.preventDefault();
    $("#aviso-bolo").scrollIntoView({ block: "center", behavior: "smooth" });
    dayField.focus({ preventScroll: true });
  });

  /* Montador do bolo: o preço acompanha as duas escolhas */
  const selected = (inputs) => inputs.find((input) => input.checked);
  function updateCakePrice() {
    $("#enc-preco").textContent = brl.format(cakePrice(selected(flavors), selected(sizes)));
  }
  cakeForm.addEventListener("input", updateCakePrice);
  cakeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    add(cakeId(selected(flavors), selected(sizes)));
  });
  updateCakePrice();

  /* Aberto agora, pela hora da página */
  function renderStatus() {
    const date = now();
    const minutes = date.getHours() * MINUTES_PER_HOUR + date.getMinutes();
    const today = HOURS_BY_WEEKDAY[date.getDay()];
    const clock = (m) => { const h = Math.floor(m / MINUTES_PER_HOUR); const r = m % MINUTES_PER_HOUR; return r ? `${h}h${pad(r)}` : `${h}h`; };
    const open = today && minutes >= today[0] && minutes < today[1];
    const dot = $("#status-ponto");
    dot.classList.toggle("fechado", !open);
    $("#status-texto").textContent = open ? "Aberto agora" : "Fechado agora";
    if (open) {
      $("#status-det").textContent = `fecha às ${clock(today[1])}`;
      return;
    }
    const next = [0, 1, 2, 3, 4, 5, 6, 7].map((ahead) => {
      const day = (date.getDay() + ahead) % 7;
      return { ahead, day, hours: HOURS_BY_WEEKDAY[day] };
    }).find((slot) => slot.hours && (slot.ahead > 0 || minutes < slot.hours[0]));
    const when = next.ahead === 0 ? "hoje" : next.ahead === 1 ? "amanhã" : WEEKDAY_NAMES[next.day];
    $("#status-det").textContent = `abre ${when} às ${clock(next.hours[0])}`;
  }
  renderStatus();

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

  /* Busca pelo nome e pela descrição, sem acento; a seção do bolo e a do alpendre entram pelo texto delas */
  const plain = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  $("#busca").addEventListener("input", (event) => {
    const term = plain(event.target.value.trim());
    let found = 0;
    $$(".c-sec[data-cat]").forEach((section) => {
      if (section.id === "info") return;
      const items = $$(".c-item, .c-mini", section);
      let visible = 0;
      if (items.length) {
        items.forEach((item) => {
          const show = !term || plain(item.textContent).includes(term);
          item.hidden = !show;
          if (show) visible += 1;
        });
      } else if (!term || plain(section.textContent).includes(term)) {
        visible = 1;
      }
      section.hidden = visible === 0;
      found += visible;
    });
    $("#busca-vazio").hidden = found > 0;
  });

  render();
  syncCategory();
})();
