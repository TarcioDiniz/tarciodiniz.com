// Brechó Varal: separar peças numa sacola com total e sinal, e copiar a chave Pix.
(() => {
  "use strict";
  const { $, toast, whatsappUrl } = window.Modelo;
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  // Sinal por peça, igual ao que a página promete nas regras de reserva
  const DEPOSIT_PER_PIECE = 15;

  const bag = $("#sacola");
  const separated = new Set();

  function readPiece(article) {
    return { name: article.dataset.nome, detail: article.dataset.detalhe, price: Number(article.dataset.preco) };
  }

  function message(pieces, total, deposit) {
    const lines = pieces.map((piece) => `- ${piece.name} (${piece.detail}), ${brl.format(piece.price)}`);
    return [
      "Oi! Vi o varal da semana e quero separar:",
      ...lines,
      `Total: ${brl.format(total)}. Sinal de ${brl.format(deposit)} no Pix.`,
      "Moro no bairro: ",
    ].join("\n");
  }

  function renderBag() {
    const pieces = [...separated].map(readPiece);
    bag.hidden = pieces.length === 0;
    document.body.classList.toggle("com-sacola", pieces.length > 0);
    if (!pieces.length) return;
    const total = pieces.reduce((sum, piece) => sum + piece.price, 0);
    const deposit = pieces.length * DEPOSIT_PER_PIECE;
    $("#sacola-qtd").textContent = pieces.length === 1 ? "1 peça separada" : `${pieces.length} peças separadas`;
    $("#sacola-total").textContent = `${brl.format(total)}, sinal de ${brl.format(deposit)}`;
    $("#sacola-link").href = whatsappUrl(message(pieces, total, deposit));
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-separar]");
    if (!button) return;
    const article = button.closest(".vr-peca");
    const on = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(on));
    button.textContent = on ? "Tirar da sacola" : "Separar";
    if (on) separated.add(article);
    else separated.delete(article);
    renderBag();
    toast(on ? "Peça separada" : "Peça tirada da sacola");
  });

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copiar]");
    if (!button) return;
    const source = document.getElementById(button.dataset.copiar);
    const ok = await copy(source.textContent.trim());
    if (ok) {
      toast("Chave Pix copiada");
      return;
    }
    // Sem permissão de cópia: seleciona o texto para a pessoa copiar na mão.
    const range = document.createRange();
    range.selectNodeContents(source);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    toast("Toque e segure para copiar");
  });

  renderBag();
})();
