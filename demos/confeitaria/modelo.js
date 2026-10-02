// Forno da Clara: copia a chave Pix e calcula o sinal da encomenda, com a mensagem pronta no WhatsApp.
(() => {
  "use strict";
  const { $, brl, toast, whatsappUrl } = window.Modelo;

  const SIGNAL_RATE = 0.3;
  const SIGNAL_MIN = 30;
  const LEAD_DAYS = 3;
  const MS_PER_DAY = 86_400_000;

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

  const form = $("#sinal");
  if (!form) return;

  const select = $("#sinal-item");
  const quantity = $("#sinal-qtd");
  const minus = $("#sinal-menos");
  const plus = $("#sinal-mais");
  const rule = $("#sinal-regra");
  const dateInput = $("#sinal-data");
  const dateNotice = $("#sinal-aviso");
  const totalOutput = $("#sinal-total");
  const signalOutput = $("#sinal-valor");
  const orderLink = $("#sinal-pedir");

  const state = { amount: 1 };

  function currentItem() {
    const option = select.selectedOptions[0];
    return {
      price: Number(option.dataset.preco),
      approximate: option.dataset.aprox === "1",
      one: option.dataset.um,
      many: option.dataset.varios,
      min: Number(option.dataset.min),
      step: Number(option.dataset.passo),
    };
  }

  function toIsoDate(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function earliestDate() {
    return toIsoDate(new Date(Date.now() + LEAD_DAYS * MS_PER_DAY));
  }

  function formatDay(iso) {
    const [, month, day] = iso.split("-");
    return `${day}/${month}`;
  }

  function signalFor(total) {
    const raw = Math.round(total * SIGNAL_RATE * 100) / 100;
    return Math.min(total, Math.max(SIGNAL_MIN, raw));
  }

  function message(item, total, signal) {
    const noun = state.amount === 1 ? item.one : item.many;
    const day = dateInput.value ? `o dia ${formatDay(dateInput.value)}` : "uma data que ainda vou combinar";
    const prefix = item.approximate ? "a partir de " : "";
    const signalText = item.approximate ? `com sinal a partir de ${brl.format(signal)}` : `com sinal de ${brl.format(signal)}`;
    return `Olá, Clara! Quero encomendar ${state.amount} ${noun}, para ${day}. `
      + `Pela página fica ${prefix}${brl.format(total)}, ${signalText} no Pix.`;
  }

  function render() {
    const item = currentItem();
    const total = item.price * state.amount;
    const signal = signalFor(total);
    const prefix = item.approximate ? "a partir de " : "";

    quantity.textContent = String(state.amount);
    minus.disabled = state.amount <= item.min;
    rule.textContent = item.step === 1 && item.min === 1
      ? "Mínimo de 1"
      : `Mínimo de ${item.min}, de ${item.step} em ${item.step}`;
    totalOutput.textContent = prefix + brl.format(total);
    signalOutput.textContent = prefix + brl.format(signal);
    dateNotice.hidden = !(dateInput.value && dateInput.value < earliestDate());
    orderLink.href = whatsappUrl(message(item, total, signal));
  }

  select.addEventListener("change", () => {
    state.amount = currentItem().min;
    render();
  });
  minus.addEventListener("click", () => {
    const item = currentItem();
    state.amount = Math.max(item.min, state.amount - item.step);
    render();
  });
  plus.addEventListener("click", () => {
    state.amount += currentItem().step;
    render();
  });
  dateInput.addEventListener("change", render);
  form.addEventListener("submit", (event) => event.preventDefault());

  dateInput.min = earliestDate();
  render();
})();
