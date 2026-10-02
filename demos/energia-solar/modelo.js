// Catingueira Solar: o pedido em etapas (o que instalar, tamanho, bairro e prazo, nome), o resumo com a faixa de
// preço do sistema, a economia por mês e o retorno em anos, e a mensagem pronta no WhatsApp. Também troca
// o cliente do antes e depois, move a barra do comparador e mostra o botão fixo do celular.
// Tudo por serviço vem dos data-* no HTML (números de exemplo): preço por unidade (data-min e data-max),
// limites e passo do tamanho, fração da conta que some (data-economia) e arredondamento.
(() => {
  "use strict";
  const { $, $$, whatsappUrl } = window.Modelo;

  const COMPANY = document.body.dataset.empresa || "equipe";
  const STEPS = 4;
  const SUMMARY = STEPS + 1;
  const MIN_TEXT = 2;
  const MEDIUM_SIZE = 1;
  const MONTHS = 12;

  const dialog = $("#orcamento");
  if (!dialog) return;
  const form = $("#orc-form");
  const qtyInput = $("#qtd");
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const plainMoney = (value) => money.format(value).replace(/\u00a0/g, " ");

  let step = 1;

  /* Leitura do que a pessoa respondeu */
  const service = () => form.querySelector('input[name="servico"]:checked');
  const text = (id) => $(id).value.trim();
  const chosenTerm = () => {
    const checked = form.querySelector('input[name="prazo"]:checked');
    return checked ? checked.value : "";
  };
  const quantity = () => Number.parseInt(qtyInput.value, 10);
  const limit = (name) => Number(service().dataset[name]);
  const minQty = () => limit("qmin");
  const maxQty = () => limit("qmax");
  const stepSize = () => limit("passo");
  const validQuantity = () => Number.isInteger(quantity()) && quantity() >= minQty() && quantity() <= maxQty();

  function unitLabel(option, qty) {
    const [one, many] = option.dataset.unidade.split("|");
    return qty === 1 ? one : many;
  }

  function sizes(option) {
    return option.dataset.tamanhos.split(",").map(Number);
  }

  /* Estimativa: tamanho vezes o valor por unidade, arredondada. Serviço sem valor de tabela não tem faixa.
     Com data-economia, a conta de luz (o tamanho) vezes essa fração vira a economia mensal, e o retorno
     sai do preço dividido pela economia de um ano. */
  function estimate(option, qty) {
    const low = Number(option.dataset.min);
    const high = Number(option.dataset.max);
    if (!low || !high) return null;
    const roundTo = Number(option.dataset.arredonda);
    const round = (value) => Math.round(value / roundTo) * roundTo;
    const range = { low: round(low * qty), high: round(high * qty), monthly: 0 };
    const saved = Number(option.dataset.economia);
    if (saved) range.monthly = Math.round(qty * saved);
    return range;
  }

  const years = (price, monthly) => (price / (monthly * MONTHS)).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const sizeText = (option) => option.dataset.moeda
    ? `${plainMoney(quantity())} por mês`
    : `${quantity()} ${unitLabel(option, quantity())}`;
  const estimateText = (range) => `de ${plainMoney(range.low)} a ${plainMoney(range.high)}`;
  // Na tela, cada valor fica colado ao "de" e ao "a", para a quebra de linha cair entre os dois
  const estimateDisplay = (range) => `de\u00a0${money.format(range.low)} a\u00a0${money.format(range.high)}`;
  const paybackText = (range) => `${years(range.low, range.monthly)} a ${years(range.high, range.monthly)} anos`;

  function message() {
    const option = service();
    const range = estimate(option, quantity());
    const lines = [
      `Olá, ${COMPANY}! Quero uma estimativa de energia solar.`,
      "",
      `Serviço: ${option.dataset.nome}`,
      `${option.dataset.rotulo}: ${sizeText(option)}`,
      `Bairro: ${text("#bairro")}`,
      `Prazo desejado: ${chosenTerm()}`,
    ];
    if (range) lines.push(`Estimativa do site: ${estimateText(range)} (só uma estimativa, sem compromisso)`);
    if (range && range.monthly) lines.push(`Economia estimada: cerca de ${plainMoney(range.monthly)} por mês, retorno em ${paybackText(range)}`);
    if (text("#obs")) lines.push(`Detalhe: ${text("#obs")}`);
    lines.push(`Meu nome: ${text("#nome")}`, "", "Vou mandar uma foto da conta de luz e do telhado por aqui.");
    return lines.join("\n");
  }

  /* Tamanho: unidade, atalhos e dica mudam com o serviço */
  function syncSize() {
    const option = service();
    if (!option) return;
    const chips = option.dataset.chips.split("|");
    $("#p2-titulo").textContent = option.dataset.pergunta;
    $("#tam-dica").textContent = option.dataset.dica;
    qtyInput.min = option.dataset.qmin;
    qtyInput.max = option.dataset.qmax;
    qtyInput.step = option.dataset.passo;
    qtyInput.value = String(sizes(option)[MEDIUM_SIZE]);
    $$(".o-tams button").forEach((button, index) => {
      button.dataset.valor = String(sizes(option)[index]);
      button.textContent = chips[index];
    });
    syncUnit();
  }

  function syncUnit() {
    const option = service();
    if (option && validQuantity()) $("#qtd-un").textContent = unitLabel(option, quantity());
    $$(".o-tams button").forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.valor) === quantity())));
  }

  function setQuantity(value) {
    qtyInput.value = String(Math.min(maxQty(), Math.max(minQty(), value)));
    syncUnit();
  }

  /* Validação: devolve o texto do erro e o campo que merece o foco */
  function check(current) {
    if (current === 1) return service() ? null : { text: "Escolha o tipo de instalação para continuar.", field: form.querySelector('input[name="servico"]') };
    if (current === 2) return validQuantity() ? null : { text: `Digite um valor de ${minQty()} a ${maxQty()}.`, field: qtyInput };
    if (current === 3) {
      if (text("#bairro").length < MIN_TEXT) return { text: "Diga em que bairro fica o local.", field: $("#bairro") };
      if (!chosenTerm()) return { text: "Escolha para quando você quer.", field: form.querySelector('input[name="prazo"]') };
    }
    if (current === 4 && text("#nome").length < MIN_TEXT) return { text: "Diga como podemos te chamar.", field: $("#nome") };
    return null;
  }

  function showError(current, problem) {
    const box = $(`#erro-${current}`);
    $$("[aria-invalid]", form).forEach((field) => field.removeAttribute("aria-invalid"));
    if (!problem) { box.hidden = true; return; }
    box.textContent = problem.text;
    box.hidden = false;
    if (problem.field.type !== "radio") problem.field.setAttribute("aria-invalid", "true");
    problem.field.focus();
  }

  /* Resumo */
  function summaryRow(label, value, target) {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    const edit = document.createElement("button");
    term.textContent = label;
    detail.textContent = value;
    edit.type = "button";
    edit.className = "o-alterar";
    edit.dataset.ir = String(target);
    edit.textContent = "Alterar";
    edit.setAttribute("aria-label", `Alterar ${label.toLowerCase()}`);
    row.append(term, detail, edit);
    return row;
  }

  function renderSummary() {
    const option = service();
    const rows = [
      summaryRow("Serviço", option.dataset.nome, 1),
      summaryRow(option.dataset.rotulo, sizeText(option), 2),
      summaryRow("Bairro", text("#bairro"), 3),
      summaryRow("Prazo desejado", chosenTerm(), 3),
      summaryRow("Nome", text("#nome"), 4),
    ];
    if (text("#obs")) rows.push(summaryRow("Detalhe", text("#obs"), 4));
    $("#resumo").replaceChildren(...rows);

    const range = estimate(option, quantity());
    $("#est-valor").textContent = range ? estimateDisplay(range) : "Valor só depois da visita";
    const hasSaving = Boolean(range && range.monthly);
    $("#est-econ").hidden = !hasSaving;
    if (hasSaving) {
      $("#econ-mes").textContent = plainMoney(range.monthly);
      $("#econ-anos").textContent = paybackText(range);
    }
    $("#est-nota").textContent = range
      ? "É só uma estimativa pelo valor da conta. O valor fechado sai depois da visita técnica, sem custo."
      : "Esse tipo de projeto precisa de visita para ter valor. A visita é sem custo.";
    $("#orc-enviar").href = whatsappUrl(message());
  }

  /* Etapas */
  function show(next, { focus = true } = {}) {
    step = next;
    if (step === SUMMARY) renderSummary();
    $$(".orc-passo", form).forEach((panel) => { panel.hidden = Number(panel.dataset.passo) !== step; });
    $("#orc-etapa").textContent = step === SUMMARY ? "Resumo" : `Etapa ${step} de ${STEPS}`;
    $$(".orc-progresso i").forEach((bar, index) => bar.classList.toggle("feito", index < step));
    $("#orc-voltar").hidden = step === 1;
    $("#orc-continuar").hidden = step === SUMMARY;
    $("#orc-enviar").hidden = step !== SUMMARY;
    $("#orc-continuar").textContent = step === STEPS ? "Ver resumo" : "Continuar";
    form.scrollTop = 0;
    if (focus) $(`.orc-passo[data-passo="${step}"] h3`, form).focus({ preventScroll: true });
  }

  function advance() {
    const problem = check(step);
    showError(step, problem);
    if (!problem) show(step + 1);
  }

  form.addEventListener("submit", (event) => { event.preventDefault(); advance(); });
  $("#orc-voltar").addEventListener("click", () => show(step - 1));
  $("#orc-recomecar").addEventListener("click", () => { form.reset(); showError(1, null); show(1); });
  form.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-ir]");
    if (edit) show(Number(edit.dataset.ir));
  });

  form.addEventListener("change", (event) => {
    if (event.target.name === "servico") syncSize();
    showError(step, null);
  });
  qtyInput.addEventListener("input", syncUnit);
  /* Os botões de mais e menos andam o passo do serviço (R$ 50 na conta, 1 painel) */
  const nudge = (direction) => {
    if (!service()) return;
    const base = validQuantity() ? quantity() : minQty();
    setQuantity(base + direction * stepSize());
  };
  $("#qtd-menos").addEventListener("click", () => nudge(-1));
  $("#qtd-mais").addEventListener("click", () => nudge(1));
  $$(".o-tams button").forEach((button) => button.addEventListener("click", () => { if (service()) setQuantity(Number(button.dataset.valor)); }));

  /* Quem abriu a janela por um cartão de serviço já escolhe o tipo e cai no tamanho.
     O base.js abre a janela antes deste ouvinte rodar (os scripts rodam nessa ordem). */
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest('[data-abrir-janela="orcamento"]');
    if (!trigger) return;
    const wanted = trigger.dataset.servico;
    if (wanted) {
      const radio = form.querySelector(`input[name="servico"][value="${wanted}"]`);
      if (radio && !radio.checked) { radio.checked = true; syncSize(); }
      show(2);
    } else {
      show(step);
    }
  });

  /* Trabalhos: um comparador por vez, escolhido nos botões */
  $$("[data-trab]", $("#trab-botoes")).forEach((button) => {
    button.addEventListener("click", () => {
      $$("[data-trab]", $("#trab-botoes")).forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
      $$("figure.o-comp").forEach((figure) => { figure.hidden = figure.dataset.trab !== button.dataset.trab; });
    });
  });

  $$(".o-comp-range").forEach((range) => {
    const area = range.closest(".o-comp-area");
    const move = () => {
      area.style.setProperty("--p", String(Number(range.value) / 100));
      range.setAttribute("aria-valuetext", `${range.value}% do antes visível`);
    };
    range.addEventListener("input", move);
    move();
  });

  /* Botão fixo do celular: aparece quando os botões da capa saem da tela e some na chamada final */
  const bar = $("#barra");
  const heroButtons = $(".o-botoes");
  const finalBand = $(".o-final");
  if (bar && heroButtons && "IntersectionObserver" in window) {
    let heroVisible = true;
    let finalVisible = false;
    const button = $("button", bar);
    const update = () => {
      const show = !heroVisible && !finalVisible;
      bar.classList.toggle("mostra", show);
      bar.setAttribute("aria-hidden", String(!show));
      button.tabIndex = show ? 0 : -1;
    };
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting || entry.boundingClientRect.top > 0;
      update();
    }).observe(heroButtons);
    if (finalBand) {
      new IntersectionObserver(([entry]) => {
        finalVisible = entry.isIntersecting || entry.boundingClientRect.top < 0;
        update();
      }, { rootMargin: "0px 0px -20% 0px" }).observe(finalBand);
    }
  }

  show(1, { focus: false });
})();
