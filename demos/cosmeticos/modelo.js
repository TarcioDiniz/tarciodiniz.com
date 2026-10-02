// Pitanga, modelo de loja de cosméticos: ficha com opção (cor, tom, tamanho), sacola com o kit de rosto
// que ganha desconto, entrega por bairro com horário de corte e pedido pelo WhatsApp.
// Usa window.Modelo da base; os dados dos produtos vêm dos atributos data-* dos cartões.
(() => {
  "use strict";

  const { $, $$, brl, toast, openDialog, closeDialog, whatsappUrl } = window.Modelo;

  const STORAGE_KEY = "pitanga-sacola-v1";
  const INSTALLMENTS = 3;
  const PIX_DISCOUNT = 0.05;
  const KIT_DISCOUNT = 0.1;
  const FREE_DELIVERY_FROM = 120;
  // Abaixo de R$ 40 a loja não parcela; a grade segue a mesma regra.
  const MIN_INSTALLMENT_PRICE = 40;
  const MINUTES_PER_HOUR = 60;

  // Horário da loja em minutos desde meia-noite. Domingo fechado.
  const WEEKDAY_HOURS = [[9 * 60, 12 * 60], [13 * 60 + 30, 19 * 60]];
  const SATURDAY_HOURS = [[9 * 60, 14 * 60]];
  const WEEKDAY_CUTOFF = 15 * 60;
  const SATURDAY_CUTOFF = 12 * 60;
  const SATURDAY = 6;
  const SUNDAY = 0;

  const DISTRICTS = [
    { name: "Catolé", fee: 6 },
    { name: "Alto Branco", fee: 8 },
    { name: "Prata", fee: 8 },
    { name: "Mirante", fee: 10 },
    { name: "Centro", fee: 10 },
    { name: "Outro bairro", fee: 14 },
  ];

  // Os três produtos que formam o kit de rosto, um de cada.
  const KIT_ROLES = [
    { id: "gel-limpeza", label: "Limpeza" },
    { id: "hidratante", label: "Hidratação" },
    { id: "protetor-solar", label: "Proteção" },
  ];

  const GROUP_LABELS = { rosto: "Rosto", maquiagem: "Maquiagem", perfumaria: "Perfumaria", corpo: "Corpo e presente" };

  // O que o cliente escolhe antes de pôr na sacola. "ask" completa o aviso de escolha; "price" troca o preço; "soldOut" trava o botão.
  const OPTIONS = {
    "gel-limpeza": { label: "Pele", ask: "o tipo de pele", choices: [{ name: "Oleosa ou mista" }, { name: "Normal ou seca" }] },
    "serum-vitamina-c": { label: "Concentração", ask: "a concentração", choices: [{ name: "10%" }, { name: "15%", price: 109.9, soldOut: true }] },
    hidratante: { label: "Pele", ask: "o tipo de pele", choices: [{ name: "Seca" }, { name: "Mista" }, { name: "Oleosa" }] },
    "protetor-solar": { label: "Cor", ask: "a cor", choices: [{ name: "Sem cor" }, { name: "Cor clara" }, { name: "Cor média" }, { name: "Cor escura", soldOut: true }] },
    "batom-cremoso": { label: "Cor", ask: "a cor", choices: [{ name: "Goiaba" }, { name: "Nude rosado" }, { name: "Coral" }, { name: "Terracota" }, { name: "Framboesa" }, { name: "Vinho", soldOut: true }] },
    "perfume-amadeirado": { label: "Tamanho", ask: "o tamanho", choices: [{ name: "50 ml" }, { name: "100 ml", price: 289.9 }] },
    "perfume-floral": { label: "Tamanho", ask: "o tamanho", choices: [{ name: "30 ml" }, { name: "50 ml", price: 219.9 }] },
    "creme-maos": { label: "Aroma", ask: "o aroma", choices: [{ name: "Cajá" }, { name: "Maracujá" }, { name: "Sem perfume" }] },
    "caixa-presente": { label: "Tema", ask: "o tema", choices: [{ name: "Rosto" }, { name: "Maquiagem" }, { name: "Banho" }] },
  };

  const USAGE = {
    "gel-limpeza": "Duas pumps na mão molhada, massagem de um minuto e enxágue. Serve de manhã e à noite.",
    "serum-vitamina-c": "De manhã, três gotas no rosto limpo, antes do hidratante e do protetor.",
    hidratante: "Uma porção do tamanho de uma ervilha para o rosto e o pescoço, de manhã e à noite.",
    "protetor-solar": "É o último passo da manhã. Passe de novo depois de quatro horas no sol.",
    "batom-cremoso": "Não resseca. Passado com o dedo, fica mais leve.",
    pinceis: "Cerdas sintéticas. Lave com sabonete neutro e seque deitado. Vem com estojo.",
    "po-solto": "Fixa a base e tira o brilho da testa e do nariz. Pouca quantidade, com o pincel grande.",
    "perfume-amadeirado": "Notas de cedro e baunilha. Borrife no pulso e atrás da orelha, a 15 cm de distância.",
    "perfume-floral": "Rosa e pêssego, com fundo de almíscar. Mais leve, bom para o dia.",
    "creme-maos": "Cabe na bolsa. Passe depois de lavar as mãos.",
    "oleo-corporal": "Passe na pele ainda úmida, logo depois do banho, e espere uns minutos antes de vestir a roupa.",
    "caixa-presente": "Você escolhe o tema, a gente monta, põe o laço e escreve o cartão que você mandar pelo WhatsApp.",
  };

  const cents = (value) => Math.round(value * 100) / 100;

  /* O relógio da loja: ?agora=2026-10-02T10:30 simula a hora, para testar o horário de corte */
  function currentTime() {
    const simulated = new URLSearchParams(location.search).get("agora");
    const date = simulated ? new Date(simulated) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  const minutesOf = (date) => date.getHours() * MINUTES_PER_HOUR + date.getMinutes();

  function hourLabel(minutes) {
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const rest = minutes % MINUTES_PER_HOUR;
    return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
  }

  function hoursOf(day) {
    if (day === SUNDAY) return [];
    return day === SATURDAY ? SATURDAY_HOURS : WEEKDAY_HOURS;
  }

  // Do sábado à tarde e do domingo, a próxima abertura é a segunda.
  function nextOpenLabel(day) {
    return day === SATURDAY ? "segunda" : "amanhã";
  }

  function storeStatus(date) {
    const ranges = hoursOf(date.getDay());
    const minutes = minutesOf(date);
    const open = ranges.find(([from, to]) => minutes >= from && minutes < to);
    if (open) return `Aberto até ${hourLabel(open[1])}`;
    const next = ranges.find(([from]) => minutes < from);
    if (next) return `Abre às ${hourLabel(next[0])}`;
    return `Abre ${nextOpenLabel(date.getDay())}, 9h`;
  }

  function deliveryPromise(date) {
    const day = date.getDay();
    const saturday = day === SATURDAY;
    const cutoff = saturday ? SATURDAY_CUTOFF : WEEKDAY_CUTOFF;
    if (day !== SUNDAY && minutesOf(date) < cutoff) {
      return { when: "hoje", text: saturday ? "Pedido até 12h chega hoje, entre 13h e 16h." : "Pedido até 15h chega hoje, entre 16h e 19h." };
    }
    const when = nextOpenLabel(day);
    return { when, text: `Já passou do horário de hoje. A moto sai ${when === "amanhã" ? "amanhã" : "na segunda"}.` };
  }

  /* Catálogo lido dos cartões que o montador já escreveu no HTML */
  function readCatalog() {
    const catalog = new Map();
    $$(".cartao").forEach((card) => {
      const d = card.dataset;
      const image = $("img", card);
      const detail = $(".cartao-det", card);
      catalog.set(d.id, {
        id: d.id,
        group: d.grupo,
        name: d.nome,
        price: Number(d.preco),
        image: d.img,
        alt: image ? image.alt : "",
        detail: detail ? detail.textContent : "",
      });
    });
    return catalog;
  }

  const catalog = readCatalog();
  const choiceOf = (id, optionName) => (OPTIONS[id] ? OPTIONS[id].choices.find((c) => c.name === optionName) : undefined);
  const unitPrice = (line) => {
    const choice = choiceOf(line.id, line.option);
    return choice && choice.price ? choice.price : catalog.get(line.id).price;
  };

  function isValidLine(line) {
    if (!catalog.has(line.id) || !(line.qty > 0)) return false;
    return OPTIONS[line.id] ? Boolean(choiceOf(line.id, line.option)) : !line.option;
  }

  function loadBag() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter(isValidLine) : [];
    } catch {
      return [];
    }
  }

  function saveBag() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bag)); } catch { /* a sacola só vive nesta aba */ }
  }

  let bag = loadBag();

  /* Ficha do produto */
  const sheet = $("#ficha");
  let sheetProduct = null;
  let chosenOption = "";

  function priceBlock(product, optionName) {
    const choice = choiceOf(product.id, optionName);
    const price = choice && choice.price ? choice.price : product.price;
    const pix = brl.format(cents(price - cents(price * PIX_DISCOUNT)));
    const installments = price >= MIN_INSTALLMENT_PRICE
      ? `<small>${INSTALLMENTS}x de ${brl.format(price / INSTALLMENTS)} sem juros</small>`
      : "";
    return `${brl.format(price)}${installments}<small class="pix-linha">${pix} no Pix</small>`;
  }

  function chooseOption(name) {
    chosenOption = name;
    $$("#ficha-opcoes button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.opcao === name)));
    $("#ficha-escolhida").textContent = name;
    $("#ficha-aviso").textContent = "";
    $("#ficha-preco").innerHTML = priceBlock(sheetProduct, name);
  }

  function renderOptions(product) {
    const options = OPTIONS[product.id];
    $("#ficha-opcao").hidden = !options;
    $("#ficha-escolhida").textContent = "";
    if (!options) return;
    $("#ficha-rotulo").textContent = options.label;
    const box = $("#ficha-opcoes");
    box.innerHTML = "";
    options.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.name;
      button.dataset.opcao = choice.name;
      button.disabled = Boolean(choice.soldOut);
      button.setAttribute("aria-pressed", "false");
      if (choice.soldOut) button.setAttribute("aria-label", `${choice.name}, esgotado`);
      button.addEventListener("click", () => chooseOption(choice.name));
      box.appendChild(button);
    });
  }

  function openSheet(id) {
    const product = catalog.get(id);
    if (!product) return;
    sheetProduct = product;
    chosenOption = "";
    $("#ficha-img").src = product.image;
    $("#ficha-img").alt = product.alt;
    $("#ficha-marca").textContent = GROUP_LABELS[product.group] || "";
    $("#ficha-nome").textContent = product.name;
    $("#ficha-preco").innerHTML = priceBlock(product, "");
    $("#ficha-det").textContent = `${product.detail}. ${USAGE[id] || ""}`.trim();
    $("#ficha-aviso").textContent = "";
    renderOptions(product);
    openDialog(sheet);
  }

  function addToBag() {
    if (!sheetProduct) return;
    const options = OPTIONS[sheetProduct.id];
    if (options && !chosenOption) {
      $("#ficha-aviso").textContent = `Escolha ${options.ask} antes de pôr na sacola.`;
      return;
    }
    const option = options ? chosenOption : "";
    const line = bag.find((l) => l.id === sheetProduct.id && l.option === option);
    if (line) line.qty += 1;
    else bag.push({ id: sheetProduct.id, option, qty: 1 });
    saveBag();
    renderBag();
    closeDialog(sheet);
    toast(`${sheetProduct.name}${option ? `, ${option}` : ""}, na sacola`);
  }

  $("#ficha-add").addEventListener("click", addToBag);
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-abrir]");
    if (!trigger) return;
    event.preventDefault();
    openSheet(trigger.dataset.abrir);
  });

  // Atalhos e blocos do mosaico acendem o filtro do tipo; o link ainda rola até a grade.
  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-filtro-atalho]");
    if (!link) return;
    const button = $(`.filtro button[data-filtro="${link.dataset.filtroAtalho}"]`);
    if (button) button.click();
  });
  // O atalho do kit abre a sacola pela base; aqui só impede o salto do link.
  $$("a[data-abrir-janela]").forEach((link) => link.addEventListener("click", (event) => event.preventDefault()));

  /* Sacola e contas */
  const form = $("#escolha");
  const districtSelect = $("#bairro");
  districtSelect.innerHTML = DISTRICTS.map((d, i) => `<option value="${i}">${d.name}, ${brl.format(d.fee)}</option>`).join("");

  function choices() {
    const data = new FormData(form);
    return {
      delivery: data.get("entrega"),
      payment: data.get("pagamento"),
      district: DISTRICTS[Number(data.get("bairro")) || 0],
    };
  }

  // O kit está completo quando há um gel, um hidratante e um protetor, de qualquer versão.
  function kitLines() {
    return KIT_ROLES.map((role) => bag.find((line) => line.id === role.id));
  }

  const kitComplete = () => kitLines().every(Boolean);

  function totals() {
    const { delivery, payment, district } = choices();
    const subtotal = cents(bag.reduce((sum, line) => sum + unitPrice(line) * line.qty, 0));
    const kitBase = kitComplete() ? kitLines().reduce((sum, line) => sum + unitPrice(line), 0) : 0;
    const kitDiscount = cents(kitBase * KIT_DISCOUNT);
    const pixDiscount = !kitDiscount && payment === "pix" ? cents(subtotal * PIX_DISCOUNT) : 0;
    const afterDiscounts = cents(subtotal - kitDiscount - pixDiscount);
    const fee = delivery === "entrega" && afterDiscounts < FREE_DELIVERY_FROM ? district.fee : 0;
    return { subtotal, kitDiscount, pixDiscount, fee, total: cents(afterDiscounts + fee), delivery, payment, district };
  }

  function lineTemplate(line, index) {
    const product = catalog.get(line.id);
    const option = line.option ? `${OPTIONS[line.id].label}: ${line.option} · ` : "";
    return `
      <li class="item">
        <span class="item-foto"><img src="${product.image}" alt=""></span>
        <div>
          <p class="item-nome">${product.name}</p>
          <p class="item-det">${option}${brl.format(unitPrice(line))}</p>
        </div>
        <div class="item-lado">
          <span class="item-preco">${brl.format(unitPrice(line) * line.qty)}</span>
          <span class="qtd">
            <button type="button" data-menos="${index}" aria-label="${line.qty === 1 ? "Tirar" : "Diminuir"} ${product.name}"><svg class="ico" aria-hidden="true"><use href="#i-${line.qty === 1 ? "trash" : "minus"}"/></svg></button>
            <output aria-live="polite">${line.qty}</output>
            <button type="button" data-mais="${index}" aria-label="Aumentar ${product.name}"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></button>
          </span>
        </div>
      </li>`;
  }

  function sumsTemplate(t) {
    const rows = [["Produtos", brl.format(t.subtotal), ""]];
    if (t.kitDiscount) rows.push(["Kit de rosto, 10%", `− ${brl.format(t.kitDiscount)}`, "desc"]);
    if (t.pixDiscount) rows.push(["5% no Pix", `− ${brl.format(t.pixDiscount)}`, "desc"]);
    if (t.delivery === "entrega") rows.push([`Moto, ${t.district.name}`, t.fee ? brl.format(t.fee) : "Grátis", t.fee ? "" : "desc"]);
    else rows.push(["Retirada na loja", "Grátis", "desc"]);
    const totalLabel = t.payment === "cartao" ? `Total (até ${INSTALLMENTS}x de ${brl.format(t.total / INSTALLMENTS)})` : "Total";
    rows.push([totalLabel, brl.format(t.total), "total"]);
    return rows.map(([label, value, css]) => `<div class="${css}"><dt>${label}</dt><dd>${value}</dd></div>`).join("");
  }

  function orderMessage(t) {
    const lines = bag.map((line) => {
      const product = catalog.get(line.id);
      const option = line.option ? `, ${line.option}` : "";
      return `${line.qty}x ${product.name}${option}, ${brl.format(unitPrice(line) * line.qty)}`;
    });
    const promise = deliveryPromise(currentTime());
    const delivery = t.delivery === "entrega"
      ? `Entrega ${promise.when} no bairro ${t.district.name} (${t.fee ? brl.format(t.fee) : "grátis"})`
      : "Vou retirar na loja";
    const discount = t.kitDiscount ? `Desconto do kit de rosto: ${brl.format(t.kitDiscount)}` : t.pixDiscount ? `Desconto Pix: ${brl.format(t.pixDiscount)}` : "";
    return [
      "Olá, Pitanga! Quero fazer este pedido:",
      "",
      ...lines,
      "",
      delivery,
      `Pagamento: ${t.payment === "pix" ? "Pix" : `cartão em até ${INSTALLMENTS}x`}`,
      discount,
      `Total: ${brl.format(t.total)}`,
      "",
      "Pode confirmar se tem tudo no estoque?",
    ].filter((row, i, all) => row !== "" || all[i - 1] !== "").join("\n");
  }

  function kitStepTemplate(role, line) {
    const product = catalog.get(role.id);
    const state = line
      ? `<span class="kit-ok">Na sacola</span>`
      : `<button class="btn btn-line btn-sm" type="button" data-abrir="${role.id}">Escolher</button>`;
    return `
      <li class="kit-passo${line ? " feito" : ""}">
        <span class="kit-ico"><svg class="ico" aria-hidden="true"><use href="#i-${line ? "check" : "plus"}"/></svg></span>
        <span class="kit-nome"><b>${role.label}</b><small>${product.name}, a partir de ${brl.format(product.price)}</small></span>
        ${state}
      </li>`;
  }

  function renderKit() {
    const lines = kitLines();
    const missing = lines.filter((line) => !line).length;
    $("#kit-passos").innerHTML = KIT_ROLES.map((role, i) => kitStepTemplate(role, lines[i])).join("");
    $("#kit-aviso").textContent = missing
      ? `${missing === 1 ? "Falta 1 produto" : `Faltam ${missing} produtos`} para ganhar 10% no kit.`
      : `Kit completo. O desconto de ${brl.format(totals().kitDiscount)} já está na conta.`;
  }

  function renderBag() {
    const count = bag.reduce((sum, line) => sum + line.qty, 0);
    $$("[data-contador]").forEach((counter) => {
      counter.textContent = String(count);
      counter.toggleAttribute("data-zero", count === 0);
    });
    const label = count ? `Abrir sacola, ${count} ${count === 1 ? "item" : "itens"}` : "Abrir sacola";
    $$('[data-abrir-janela="pedido"]').forEach((button) => {
      if (button.tagName === "BUTTON" && !button.classList.contains("btn")) button.setAttribute("aria-label", label);
    });

    const empty = count === 0;
    $("#pedido-vazio").hidden = !empty;
    form.hidden = empty;
    $("#pedido-fim").hidden = empty;
    $("#itens-sacola").innerHTML = bag.map(lineTemplate).join("");
    renderKit();
    if (empty) return;

    const { delivery } = choices();
    $("#campo-bairro").hidden = delivery !== "entrega";
    $("#entrega-prazo").textContent = `${deliveryPromise(currentTime()).text} Frete grátis acima de ${brl.format(FREE_DELIVERY_FROM).replace(",00", "")}.`;
    const t = totals();
    $("#contas").innerHTML = sumsTemplate(t);
    $("#enviar").href = whatsappUrl(orderMessage(t));
  }

  function changeQty(index, delta) {
    const line = bag[index];
    if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) bag.splice(index, 1);
    saveBag();
    renderBag();
  }

  $("#itens-sacola").addEventListener("click", (event) => {
    const less = event.target.closest("[data-menos]");
    const more = event.target.closest("[data-mais]");
    if (less) changeQty(Number(less.dataset.menos), -1);
    if (more) changeQty(Number(more.dataset.mais), 1);
  });
  form.addEventListener("input", renderBag);
  form.addEventListener("submit", (event) => event.preventDefault());

  /* Estado da loja no cabeçalho */
  $$("[data-status-loja]").forEach((chip) => { chip.textContent = storeStatus(currentTime()); });

  renderBag();
})();
