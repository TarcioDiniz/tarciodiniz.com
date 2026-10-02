// Juá, modelo de loja: ficha com tamanho e medidas, sacola e pedido pelo WhatsApp.
// Os dados vêm dos cartões (data-*) e do bloco JSON "fichas" da página, então ela funciona sem este script.
(() => {
  "use strict";

  const { $, $$, brl, toast, openDialog, closeDialog, whatsappUrl } = window.Modelo;

  const STORAGE_KEY = "jua-sacola-v1";
  const INSTALLMENTS = 6;
  const PIX_DISCOUNT = 0.08;
  const LINEN_GROUP = "linho";
  const LINEN_PAIR_DISCOUNT = 0.1;
  const LINEN_PAIR_MIN = 2;
  const DELIVERY_FEE = 10;
  const FREE_DELIVERY_FROM = 350;
  const TRY_AT_HOME_TYPES = new Set(["roupa", "festa"]);

  // Medidas do corpo em centímetros (busto, cintura, quadril) para cada tamanho que a loja vende.
  const BODY_CM = {
    PP: [84, 66, 92], P: [88, 70, 96], M: [92, 74, 100], G: [98, 80, 106], GG: [104, 86, 112],
    36: [84, 66, 92], 38: [88, 70, 96], 40: [92, 74, 100], 42: [98, 80, 106], 44: [104, 86, 112], 46: [110, 92, 118],
  };
  const SIZE_LABEL = { roupa: "Tabela brasileira", camisa: "Tabela brasileira", festa: "Numeração 36 ao 46", chapeu: "Contorno da cabeça, em cm", calcado: "Numeração brasileira", unico: "Tamanho único" };

  const cents = (value) => Math.round(value * 100) / 100;

  const specs = JSON.parse($("#fichas").textContent);
  const catalog = new Map($$(".cartao").map((card) => [card.dataset.id, {
    id: card.dataset.id,
    name: card.dataset.nome,
    price: Number(card.dataset.preco),
    image: card.dataset.img,
    group: card.dataset.grupo,
    alt: $("img", card)?.alt ?? "",
    ...specs[card.dataset.id],
  }]));

  function loadBag() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((line) => catalog.has(line.id)) : [];
    } catch {
      return [];
    }
  }

  function saveBag() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bag)); } catch { /* a sacola só vive nesta aba */ }
  }

  let bag = loadBag();

  /* Atalhos e cartões de destaque acendem o filtro certo; o link já leva a página até a grade */
  $$("[data-filtrar]").forEach((link) => {
    link.addEventListener("click", () => {
      const chip = $(`[data-filtra="grade-itens"] [data-filtro="${link.dataset.filtrar}"]`);
      if (chip) chip.click();
    });
  });

  /* Ficha da peça */
  const sheet = $("#ficha");
  let sheetProduct = null;
  let chosenSize = "";

  const sizeLabel = (product, size) => {
    if (product.tipo === "unico") return "tamanho único";
    if (product.tipo === "chapeu") return `contorno ${size} cm`;
    if (product.tipo === "calcado") return `número ${size}`;
    return `tamanho ${size}`;
  };

  function priceBlock(product) {
    const installment = brl.format(product.price / INSTALLMENTS);
    const pix = brl.format(cents(product.price - cents(product.price * PIX_DISCOUNT)));
    return `${brl.format(product.price)}<small>${INSTALLMENTS}x de ${installment} sem juros</small><small class="pix-linha">${pix} no Pix</small>`;
  }

  function showMeasures(size) {
    const box = $("#ficha-medidas");
    const body = BODY_CM[size];
    if (!sheetProduct || !["roupa", "camisa", "festa"].includes(sheetProduct.tipo)) { box.textContent = ""; return; }
    box.textContent = body
      ? `Tamanho ${size} serve busto ${body[0]}, cintura ${body[1]} e quadril ${body[2]} cm.`
      : "Escolha o tamanho para ver as medidas do corpo.";
  }

  function chooseSize(size) {
    chosenSize = size;
    $$("#ficha-tamanhos button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.tamanho === size)));
    $("#ficha-aviso").textContent = "";
    showMeasures(size);
  }

  function renderSizes(product) {
    const box = $("#ficha-tamanhos");
    box.innerHTML = "";
    product.tamanhos.forEach((size) => {
      const button = document.createElement("button");
      const soldOut = product.esgotados.includes(size);
      button.type = "button";
      button.textContent = size;
      button.dataset.tamanho = size;
      button.disabled = soldOut;
      button.setAttribute("aria-pressed", "false");
      if (soldOut) button.setAttribute("aria-label", `${size}, esgotado`);
      button.addEventListener("click", () => chooseSize(size));
      box.appendChild(button);
    });
    const available = product.tamanhos.filter((size) => !product.esgotados.includes(size));
    if (available.length === 1) chooseSize(available[0]);
  }

  function openSheet(id) {
    const product = catalog.get(id);
    if (!product) return;
    sheetProduct = product;
    chosenSize = "";
    $("#ficha-img").src = product.image;
    $("#ficha-img").alt = product.alt;
    $("#ficha-marca").textContent = product.categoria;
    $("#ficha-nome").textContent = product.name;
    $("#ficha-preco").innerHTML = priceBlock(product);
    $("#ficha-desc").textContent = product.descricao;
    const soldOut = product.esgotados.length;
    const note = soldOut ? `${soldOut === 1 ? "1 esgotado" : `${soldOut} esgotados`}` : SIZE_LABEL[product.tipo];
    $("#ficha-forma").textContent = note;
    $("#ficha-aviso").textContent = "";
    renderSizes(product);
    showMeasures(chosenSize);
    openDialog(sheet);
  }

  function addToBag() {
    if (!sheetProduct) return;
    if (!chosenSize) {
      $("#ficha-aviso").textContent = "Escolha o tamanho antes de pôr na sacola.";
      return;
    }
    const line = bag.find((l) => l.id === sheetProduct.id && l.size === chosenSize);
    if (line) line.qty += 1;
    else bag.push({ id: sheetProduct.id, size: chosenSize, qty: 1 });
    saveBag();
    renderBag();
    closeDialog(sheet);
    toast(`${sheetProduct.name}, ${sizeLabel(sheetProduct, chosenSize)}, na sacola`);
  }

  $("#ficha-add").addEventListener("click", addToBag);
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-abrir]");
    if (trigger) openSheet(trigger.dataset.abrir);
  });

  /* Sacola e contas */
  const form = $("#escolha");

  function choices() {
    const data = new FormData(form);
    return {
      delivery: data.get("entrega"),
      payment: data.get("pagamento"),
      district: String(data.get("bairro") || "").trim(),
      tryAtHome: data.get("prova") === "on",
    };
  }

  const canTryAtHome = () => bag.some((line) => TRY_AT_HOME_TYPES.has(catalog.get(line.id).tipo));

  function totals() {
    const { delivery, payment, tryAtHome } = choices();
    const subtotal = bag.reduce((sum, line) => sum + catalog.get(line.id).price * line.qty, 0);
    const linenPrices = bag.flatMap((line) => {
      const product = catalog.get(line.id);
      return product.group === LINEN_GROUP ? Array(line.qty).fill(product.price) : [];
    });
    const pairDiscount = linenPrices.length >= LINEN_PAIR_MIN ? cents(Math.min(...linenPrices) * LINEN_PAIR_DISCOUNT) : 0;
    const pixDiscount = payment === "pix" ? cents((subtotal - pairDiscount) * PIX_DISCOUNT) : 0;
    const afterDiscounts = cents(subtotal - pairDiscount - pixDiscount);
    const fee = delivery === "entrega" && afterDiscounts < FREE_DELIVERY_FROM ? DELIVERY_FEE : 0;
    const home = delivery === "entrega" && tryAtHome && canTryAtHome();
    return { subtotal, pairDiscount, pixDiscount, fee, total: afterDiscounts + fee, delivery, payment, home };
  }

  function lineTemplate(line, index) {
    const product = catalog.get(line.id);
    const label = sizeLabel(product, line.size);
    return `
      <li class="item">
        <span class="item-foto"><img src="${product.image}" alt=""></span>
        <div>
          <p class="item-nome">${product.name}</p>
          <p class="item-det">${label.charAt(0).toUpperCase()}${label.slice(1)} · ${brl.format(product.price)}</p>
        </div>
        <div class="item-lado">
          <span class="item-preco">${brl.format(product.price * line.qty)}</span>
          <span class="qtd">
            <button type="button" data-menos="${index}" aria-label="${line.qty === 1 ? "Tirar" : "Diminuir"} ${product.name}"><svg class="ico" aria-hidden="true"><use href="#i-${line.qty === 1 ? "trash" : "minus"}"/></svg></button>
            <output aria-live="polite">${line.qty}</output>
            <button type="button" data-mais="${index}" aria-label="Aumentar ${product.name}"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></button>
          </span>
        </div>
      </li>`;
  }

  function sumsTemplate(t) {
    const rows = [["Peças", brl.format(t.subtotal), ""]];
    if (t.pairDiscount) rows.push(["Duas de linho, 10% na mais barata", `− ${brl.format(t.pairDiscount)}`, "desc"]);
    if (t.pixDiscount) rows.push(["8% no Pix", `− ${brl.format(t.pixDiscount)}`, "desc"]);
    if (t.delivery === "entrega") rows.push(["Motoboy", t.fee ? brl.format(t.fee) : "Grátis", t.fee ? "" : "desc"]);
    else rows.push(["Retirada na loja", "Grátis", "desc"]);
    rows.push([t.payment === "cartao" ? `Total (até ${INSTALLMENTS}x de ${brl.format(t.total / INSTALLMENTS)})` : "Total", brl.format(t.total), "total"]);
    return rows.map(([label, value, css]) => `<div class="${css}"><dt>${label}</dt><dd>${value}</dd></div>`).join("");
  }

  function orderMessage(t) {
    const { district } = choices();
    const lines = bag.map((line) => {
      const product = catalog.get(line.id);
      return `${line.qty}x ${product.name}, ${sizeLabel(product, line.size)}, ${brl.format(product.price * line.qty)}`;
    });
    const delivery = t.delivery === "entrega"
      ? `Entrega por motoboy${district ? ` no bairro ${district}` : ""} (${t.fee ? brl.format(t.fee) : "grátis"})`
      : "Vou retirar na loja";
    const home = t.home ? ["Quero provar em casa: levem também o tamanho acima de cada vestido. Confirmem se o meu bairro entra."] : [];
    const discount = [
      t.pairDiscount ? `Desconto de duas de linho: ${brl.format(t.pairDiscount)}` : "",
      t.pixDiscount ? `Desconto Pix: ${brl.format(t.pixDiscount)}` : "",
    ].filter(Boolean);
    return [
      "Olá, Juá! Quero fazer esta sacola:",
      "",
      ...lines,
      "",
      delivery,
      ...home,
      `Pagamento: ${t.payment === "pix" ? "Pix" : `cartão em até ${INSTALLMENTS}x`}`,
      ...discount,
      `Total: ${brl.format(t.total)}`,
      "",
      "Podem confirmar se tem no meu tamanho?",
    ].join("\n");
  }

  function renderBag() {
    const count = bag.reduce((sum, line) => sum + line.qty, 0);
    $$("[data-contador]").forEach((counter) => {
      counter.textContent = String(count);
      counter.toggleAttribute("data-zero", count === 0);
    });
    const label = count ? `Abrir sacola, ${count} ${count === 1 ? "peça" : "peças"}` : "Abrir sacola";
    $$("[data-sacola]").forEach((button) => button.setAttribute("aria-label", label));

    const empty = count === 0;
    $("#sacola-vazia").hidden = !empty;
    form.hidden = empty;
    $("#sacola-fim").hidden = empty;
    $("#itens-sacola").innerHTML = bag.map(lineTemplate).join("");
    if (empty) return;

    const { delivery } = choices();
    $("#campo-bairro").hidden = delivery !== "entrega";
    $("#campo-prova").hidden = delivery !== "entrega" || !canTryAtHome();
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
  renderBag();
})();
