// Página de links da Lia Nails: a tabela de preços monta a mensagem do WhatsApp e o botão "Copiar" põe o Pix.
(() => {
  "use strict";
  const { $, $$, toast, whatsappUrl } = window.Modelo;

  const MONEY = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const GENERIC_MESSAGE = "Olá, Lia! Vi sua página e quero agendar. Pode me passar os horários livres desta semana?";

  const list = $("#servicos");
  const summary = $("#resumo");
  const bookLink = $("#agendar");
  const bookText = $("#agendar-texto");

  function chosen() {
    return $$("[data-servico][aria-pressed='true']", list);
  }

  function totalOf(buttons) {
    const total = buttons.reduce((sum, button) => sum + Number(button.dataset.preco), 0);
    const open = buttons.some((button) => button.dataset.aberto === "true");
    return { total, open };
  }

  function pluralize(count) {
    return count === 1 ? "1 serviço" : `${count} serviços`;
  }

  function joinNames(names) {
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  }

  function messageFor(buttons, { total, open }) {
    const names = joinNames(buttons.map((button) => button.dataset.servico));
    const estimate = `${open ? "a partir de " : ""}${MONEY.format(total)}`;
    return `Olá, Lia! Vi sua página e quero agendar: ${names}. Pela tabela, fica ${estimate}. Quais dias você tem livre?`;
  }

  function render() {
    const buttons = chosen();
    if (!buttons.length) {
      summary.textContent = "Nenhum serviço escolhido ainda.";
      bookText.textContent = "Agendar pelo WhatsApp";
      bookLink.href = whatsappUrl(GENERIC_MESSAGE);
      return;
    }
    const sum = totalOf(buttons);
    summary.innerHTML = `<b>${pluralize(buttons.length)}</b>, ${sum.open ? "a partir de " : ""}${MONEY.format(sum.total)}`;
    bookText.textContent = "Agendar estes serviços";
    bookLink.href = whatsappUrl(messageFor(buttons, sum));
  }

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-servico]");
    if (!button) return;
    const pressed = button.getAttribute("aria-pressed") === "true";
    button.setAttribute("aria-pressed", String(!pressed));
    render();
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
})();
