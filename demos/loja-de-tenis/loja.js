// Passada, demo de loja: ficha do produto, sacola e pedido pelo WhatsApp.
// Toda mensagem da demo abre com um oi para o Tarcio, para ele saber qual modelo a pessoa testou.
const DEMO_WA_INTRO = "Oi, Tarcio! Me interessei por esse site, o modelo da Passada (loja de tênis).\n\nO site montou esta mensagem:\n";
// Os dados vêm dos atributos data-* dos cartões, que já estão no HTML.
(() => {
  "use strict";

  const STORAGE_KEY = "passada-sacola-v1";
  const INSTALLMENTS = 10;
  const PIX_DISCOUNT = 0.05;
  const PAIR_DISCOUNT = 0.15;
  const DELIVERY_FEE = 12;
  const FREE_DELIVERY_FROM = 299;
  const HOUSE_BRAND = "passada";
  const TOAST_MS = 2600;
  const SWIPE_CLOSE_PX = 90;
  const PHONE_QUERY = "(max-width: 899px)";

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const cents = (value) => Math.round(value * 100) / 100;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  /** @typedef {{ id: string, brand: string, brandName: string, name: string, price: number, image: string, category: string, sizes: string[], soldOut: Set<string> }} Product */
  /** @typedef {{ id: string, size: string, qty: number }} BagLine */

  /** @returns {Map<string, Product>} */
  function readCatalog() {
    const catalog = new Map();
    $$(".produto").forEach((card) => {
      const d = card.dataset;
      catalog.set(d.id, {
        id: d.id,
        brand: d.marca,
        brandName: d.marcaNome,
        name: d.nome,
        price: Number(d.preco),
        image: d.img,
        category: d.cat,
        sizes: d.tamanhos.split("|"),
        soldOut: new Set(d.esgotados ? d.esgotados.split(",") : []),
      });
    });
    return catalog;
  }

  const catalog = readCatalog();

  /** @returns {BagLine[]} */
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

  /* Mensagem curta no rodapé da tela */
  let toastTimer = 0;
  function toast(text) {
    $("#toast-texto").textContent = text;
    $("#toast").classList.add("mostra");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("#toast").classList.remove("mostra"), TOAST_MS);
  }

  /* Janelas (ficha e sacola) */
  function openDialog(dialog) {
    document.documentElement.classList.add("travado");
    dialog.showModal();
  }

  function closeDialog(dialog) {
    dialog.close();
  }

  $$("dialog").forEach((dialog) => {
    dialog.addEventListener("close", () => {
      if (!$$("dialog").some((d) => d.open)) document.documentElement.classList.remove("travado");
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
    $$("[data-fechar]", dialog).forEach((button) => button.addEventListener("click", () => closeDialog(dialog)));
  });

  /* Ficha do produto */
  const sheet = $("#ficha");
  let sheetProduct = null;
  let chosenSize = "";

  function isShoe(product) {
    return product.brand !== HOUSE_BRAND;
  }

  function priceBlock(product) {
    const installment = brl.format(product.price / INSTALLMENTS);
    const pix = brl.format(cents(product.price - cents(product.price * PIX_DISCOUNT)));
    return `${brl.format(product.price)}<small>${INSTALLMENTS}x de ${installment} sem juros</small><small class="pix-linha">${pix} no Pix</small>`;
  }

  function renderSizes(product) {
    const box = $("#ficha-tamanhos");
    box.innerHTML = "";
    product.sizes.forEach((size) => {
      const button = document.createElement("button");
      const soldOut = product.soldOut.has(size);
      button.type = "button";
      button.textContent = size;
      button.disabled = soldOut;
      button.setAttribute("aria-pressed", "false");
      if (soldOut) button.setAttribute("aria-label", `${size}, esgotado`);
      button.addEventListener("click", () => chooseSize(size));
      box.appendChild(button);
    });
    const available = product.sizes.filter((size) => !product.soldOut.has(size));
    if (available.length === 1) chooseSize(available[0]);
  }

  function chooseSize(size) {
    chosenSize = size;
    $$("#ficha-tamanhos button").forEach((button) => button.setAttribute("aria-pressed", String(button.textContent === size)));
    $("#ficha-aviso").textContent = "";
  }

  function openSheet(id) {
    const product = catalog.get(id);
    if (!product) return;
    sheetProduct = product;
    chosenSize = "";
    $("#ficha-img").src = product.image;
    $("#ficha-img").alt = $(`.produto[data-id="${id}"] img`).alt;
    $("#ficha-marca").textContent = `${product.brandName} · ${product.category}`;
    $("#ficha-nome").textContent = product.name;
    $("#ficha-preco").innerHTML = priceBlock(product);
    const soldOutCount = product.soldOut.size;
    $("#ficha-forma").textContent = isShoe(product)
      ? (soldOutCount ? `${soldOutCount === 1 ? "1 número esgotado" : `${soldOutCount} números esgotados`}` : "Numeração brasileira")
      : "";
    $("#ficha-aviso").textContent = "";
    renderSizes(product);
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
    toast(`${sheetProduct.name}, tamanho ${chosenSize}, na sacola`);
  }

  $("#ficha-add").addEventListener("click", addToBag);
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-abrir]");
    if (!trigger) return;
    const search = trigger.closest("#busca");
    if (search) closeDialog(search);
    openSheet(trigger.dataset.abrir);
  });

  /* Sacola e contas */
  const bagDialog = $("#sacola");
  const form = $("#escolha");

  function choices() {
    const data = new FormData(form);
    return {
      delivery: data.get("entrega"),
      payment: data.get("pagamento"),
      district: String(data.get("bairro") || "").trim(),
    };
  }

  function totals() {
    const { delivery, payment } = choices();
    const subtotal = bag.reduce((sum, line) => sum + catalog.get(line.id).price * line.qty, 0);
    const pairPrices = bag.flatMap((line) => {
      const product = catalog.get(line.id);
      return isShoe(product) ? Array(line.qty).fill(product.price) : [];
    });
    const pairDiscount = pairPrices.length >= 2 ? cents(Math.min(...pairPrices) * PAIR_DISCOUNT) : 0;
    const pixDiscount = !pairDiscount && payment === "pix" ? cents(subtotal * PIX_DISCOUNT) : 0;
    const afterDiscounts = cents(subtotal - pairDiscount - pixDiscount);
    const fee = delivery === "entrega" && afterDiscounts < FREE_DELIVERY_FROM ? DELIVERY_FEE : 0;
    return { subtotal, pairDiscount, pixDiscount, fee, total: afterDiscounts + fee, delivery, payment };
  }

  function lineTemplate(line, index) {
    const product = catalog.get(line.id);
    const sizeLabel = product.sizes.length === 1 ? "Tamanho único" : `Tamanho ${line.size}`;
    return `
      <li class="item">
        <span class="item-foto"><img src="${product.image}" alt=""></span>
        <div>
          <p class="item-nome">${product.name}</p>
          <p class="item-det">${sizeLabel} · ${brl.format(product.price)}</p>
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
    const rows = [["Produtos", brl.format(t.subtotal), ""]];
    if (t.pairDiscount) rows.push(["Leve 2, 15% no par mais barato", `− ${brl.format(t.pairDiscount)}`, "desc"]);
    if (t.pixDiscount) rows.push(["5% no Pix", `− ${brl.format(t.pixDiscount)}`, "desc"]);
    if (t.delivery === "entrega") rows.push(["Entrega hoje", t.fee ? brl.format(t.fee) : "Grátis", t.fee ? "" : "desc"]);
    else rows.push(["Retirada na loja", "Grátis", "desc"]);
    rows.push([t.payment === "cartao" ? `Total (até ${INSTALLMENTS}x de ${brl.format(t.total / INSTALLMENTS)})` : "Total", brl.format(t.total), "total"]);
    return rows.map(([label, value, css]) => `<div class="${css}"><dt>${label}</dt><dd>${value}</dd></div>`).join("");
  }

  function orderMessage(t) {
    const { district } = choices();
    const lines = bag.map((line) => {
      const product = catalog.get(line.id);
      const size = product.sizes.length === 1 ? "tamanho único" : `número ${line.size}`;
      return `${line.qty}x ${product.name}, ${size}, ${brl.format(product.price * line.qty)}`;
    });
    const delivery = t.delivery === "entrega"
      ? `Entrega hoje${district ? ` no bairro ${district}` : ""} (${t.fee ? brl.format(t.fee) : "grátis"})`
      : "Vou retirar na loja";
    const discount = t.pairDiscount ? `Desconto Leve 2: ${brl.format(t.pairDiscount)}` : t.pixDiscount ? `Desconto Pix: ${brl.format(t.pixDiscount)}` : "";
    return [
      "Olá, Passada! Quero fazer este pedido:",
      "",
      ...lines,
      "",
      delivery,
      `Pagamento: ${t.payment === "pix" ? "Pix" : `cartão em até ${INSTALLMENTS}x`}`,
      discount,
      `Total: ${brl.format(t.total)}`,
      "",
      "Pode confirmar se tem o número?",
    ].filter((row, i, all) => row !== "" || all[i - 1] !== "").join("\n");
  }

  function renderBag() {
    const count = bag.reduce((sum, line) => sum + line.qty, 0);
    $$("[data-contador]").forEach((counter) => {
      counter.textContent = String(count);
      counter.toggleAttribute("data-zero", count === 0);
    });
    const bagLabel = count ? `Abrir sacola, ${count} ${count === 1 ? "item" : "itens"}` : "Abrir sacola";
    $("#abrir-sacola").setAttribute("aria-label", bagLabel);
    $("#abrir-sacola-aba").setAttribute("aria-label", bagLabel);

    const empty = count === 0;
    $("#sacola-vazia").hidden = !empty;
    form.hidden = empty;
    $("#sacola-fim").hidden = empty;
    $("#itens").innerHTML = bag.map(lineTemplate).join("");
    if (empty) return;

    const { delivery } = choices();
    $("#campo-bairro").hidden = delivery !== "entrega";
    const t = totals();
    $("#contas").innerHTML = sumsTemplate(t);
    $("#enviar").href = `https://wa.me/5583991931035?text=${encodeURIComponent(DEMO_WA_INTRO + (orderMessage(t)))}`;
  }

  function changeQty(index, delta) {
    const line = bag[index];
    if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) bag.splice(index, 1);
    saveBag();
    renderBag();
  }

  $("#itens").addEventListener("click", (event) => {
    const less = event.target.closest("[data-menos]");
    const more = event.target.closest("[data-mais]");
    if (less) changeQty(Number(less.dataset.menos), -1);
    if (more) changeQty(Number(more.dataset.mais), 1);
  });
  form.addEventListener("input", renderBag);
  form.addEventListener("submit", (event) => event.preventDefault());
  $("#abrir-sacola").addEventListener("click", () => openDialog(bagDialog));
  $("#abrir-sacola-aba").addEventListener("click", () => openDialog(bagDialog));
  renderBag();

  /* Busca no catálogo */
  const searchDialog = $("#busca");
  const searchInput = $("#busca-termo");
  const plain = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const searchIndex = Array.from(catalog.values()).map((product) => ({
    product,
    text: plain(`${product.name} ${product.brandName} ${product.category}`),
  }));

  function resultTemplate(product) {
    return `<li><button type="button" data-abrir="${product.id}"><span class="item-foto"><img src="${product.image}" alt="" loading="lazy"></span><span><b>${product.name}</b><small>${product.brandName} · ${product.category}</small></span><span class="preco">${brl.format(product.price)}</span></button></li>`;
  }

  function renderSearch() {
    const words = plain(searchInput.value).split(/\s+/).filter(Boolean);
    const found = searchIndex.filter(({ text }) => words.every((word) => text.includes(word))).map(({ product }) => product);
    $("#busca-lista").innerHTML = found.map(resultTemplate).join("");
    $("#busca-vazio").hidden = found.length > 0;
    $("#busca-conta").textContent = words.length
      ? `${found.length} ${found.length === 1 ? "resultado" : "resultados"}`
      : "Tudo o que tem na loja agora";
  }

  searchInput.addEventListener("input", renderSearch);
  $("#busca-atalhos").addEventListener("click", (event) => {
    const chip = event.target.closest("button");
    if (!chip) return;
    searchInput.value = chip.textContent;
    renderSearch();
  });
  $("#abrir-busca").addEventListener("click", () => {
    renderSearch();
    openDialog(searchDialog);
  });

  /* Abas do celular: a aba acesa acompanha a janela aberta ou o trecho da página */
  const tabs = $$(".aba[data-aba]");
  const vitrine = $("#lancamentos");
  const styles = $("#estilos");

  function tabForPage() {
    const y = window.scrollY + window.innerHeight * 0.35;
    return y >= vitrine.offsetTop && y < styles.offsetTop ? "vitrine" : "inicio";
  }

  function lightTab(name) {
    tabs.forEach((tab) => {
      if (tab.dataset.aba === name) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
  }

  const dialogTab = { busca: "busca", sacola: "sacola" };
  function syncTabs() {
    const open = $$("dialog").find((d) => d.open);
    lightTab(open && dialogTab[open.id] ? dialogTab[open.id] : tabForPage());
  }

  window.addEventListener("scroll", syncTabs, { passive: true });
  $$("dialog").forEach((dialog) => dialog.addEventListener("close", syncTabs));
  [searchDialog, bagDialog].forEach((dialog) => new MutationObserver(syncTabs).observe(dialog, { attributes: true, attributeFilter: ["open"] }));
  syncTabs();

  /* Arrastar para baixo fecha a janela no celular */
  function enableSwipeToClose(dialog) {
    let startY = 0;
    let offset = 0;
    let dragging = false;
    $$("[data-arrastar]", dialog).forEach((zone) => {
      zone.addEventListener("touchstart", (event) => {
        if (!matchMedia(PHONE_QUERY).matches || event.target.closest("input, button")) return;
        dragging = true;
        startY = event.touches[0].clientY;
        offset = 0;
        dialog.style.transition = "none";
      }, { passive: true });
    });
    dialog.addEventListener("touchmove", (event) => {
      if (!dragging) return;
      offset = Math.max(0, event.touches[0].clientY - startY);
      dialog.style.transform = `translateY(${offset}px)`;
    }, { passive: true });
    const release = () => {
      if (!dragging) return;
      dragging = false;
      dialog.style.transition = "";
      dialog.style.transform = "";
      if (offset > SWIPE_CLOSE_PX) closeDialog(dialog);
    };
    dialog.addEventListener("touchend", release);
    dialog.addEventListener("touchcancel", release);
  }
  $$("dialog.folha").forEach(enableSwipeToClose);

  /* Filtro por marca */
  $$(".filtro button").forEach((button) => {
    button.addEventListener("click", () => {
      const brand = button.dataset.marca;
      $$(".filtro button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      $$("#grade-tenis .produto").forEach((card) => { card.hidden = brand !== "todas" && card.dataset.marca !== brand; });
    });
  });

  /* Borda do cabeçalho depois de rolar */
  const header = $("#topo");
  const onScroll = () => header.classList.toggle("rolou", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Movimento: a foto da capa já vem pintada; só o resto entra ao rolar */
  const still = new URLSearchParams(location.search).has("estatico");
  function animate() {
    // Aba de fundo não roda animação: o conteúdo ficaria parado no quadro inicial, invisível.
    if (still || document.visibilityState !== "visible" || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".capa-foto", { scale: 1.06, duration: 1.6, ease: "power2.out" });
      gsap.from(".capa-texto > :not(.h1)", { y: 20, opacity: 0, duration: 0.7, stagger: 0.08, ease: "power3.out", delay: 0.15 });
      gsap.from(".selo", { y: 12, opacity: 0, duration: 0.5, stagger: 0.08, ease: "power2.out", delay: 0.5 });
      $$(".h2").forEach((title) => {
        gsap.from(title, { y: 30, opacity: 0, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: title, start: "top 90%", once: true } });
      });
      $$(".grade").forEach((grid) => {
        gsap.from($$(".produto", grid), { y: 36, opacity: 0, duration: 0.7, stagger: 0.06, ease: "power3.out", scrollTrigger: { trigger: grid, start: "top 88%", once: true } });
      });
      gsap.from(".destaque", { y: 30, opacity: 0, duration: 0.7, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: ".destaques", start: "top 92%", once: true } });
      gsap.from(".tile", { y: 30, opacity: 0, duration: 0.8, stagger: 0.08, ease: "power3.out", scrollTrigger: { trigger: ".mosaico", start: "top 88%", once: true } });
      gsap.from(".passo", { y: 24, opacity: 0, duration: 0.6, stagger: 0.08, ease: "power2.out", scrollTrigger: { trigger: ".passos", start: "top 90%", once: true } });
    });
  }
  animate();
})();
