// Conferência Raiz: abas da programação por dia, escolha de ingresso, quantidade, oficina, nome,
// igreja e a mensagem pronta para o WhatsApp com o total. A cada 10 ingressos de inteira, um é
// cortesia do líder do grupo. A barra fixa do celular aparece depois da capa e some quando a
// inscrição está na tela. Os preços vêm dos atributos data-* dos ingressos, que já estão no HTML.
(() => {
  "use strict";
  const { $, $$, brl, toast, whatsappUrl } = window.Modelo;

  const EVENT = document.body.dataset.evento || "o evento";
  const LOT = "2º lote";
  const MAX_TICKETS = 40;
  const COURTESY_EVERY = 10;
  const HALF_PRICE = 0.5;

  /* Abas da programação: setas e Home/End trocam de dia, como no padrão de abas */
  const tabs = $$('[role="tab"]');
  function showDay(tab, focus) {
    tabs.forEach((other) => {
      const on = other === tab;
      other.setAttribute("aria-selected", String(on));
      other.tabIndex = on ? 0 : -1;
      document.getElementById(other.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showDay(tab, false));
    tab.addEventListener("keydown", (event) => {
      const last = tabs.length - 1;
      const target = { ArrowRight: tabs[index === last ? 0 : index + 1], ArrowLeft: tabs[index === 0 ? last : index - 1], Home: tabs[0], End: tabs[last] }[event.key];
      if (!target) return;
      event.preventDefault();
      showDay(target, true);
    });
  });

  /* Inscrição */
  const form = $("#form-ingresso");
  const counters = { qtd: 1, meia: 0 };

  const selected = () => $("input[name=tipo]:checked", form);
  const unitPrice = () => Number(selected().dataset.preco);
  // A cortesia só vale para inteira: meia-entrada não entra na conta do grupo.
  const courtesy = () => Math.min(Math.floor((counters.qtd - counters.meia) / COURTESY_EVERY), counters.qtd - counters.meia);
  const total = () => (counters.qtd - counters.meia - courtesy()) * unitPrice() + counters.meia * unitPrice() * HALF_PRICE;
  const name = () => form.elements.nome.value.trim();
  const church = () => form.elements.igreja.value.trim();

  function message() {
    const kind = selected().dataset.nome;
    const extras = [];
    if (counters.meia) extras.push(`${counters.meia} de meia-entrada`);
    if (courtesy()) extras.push(`${courtesy()} de cortesia do líder`);
    const half = extras.length ? ` (${extras.join(", ")})` : "";
    const workshop = counters.qtd > 1 ? `${form.elements.oficina.value} (a minha; as outras eu passo depois)` : form.elements.oficina.value;
    return [
      `Olá! Quero garantir ingresso na ${EVENT}.`,
      "",
      `Ingresso: ${kind}, ${LOT}`,
      `Quantidade: ${counters.qtd}${half}`,
      `Total: ${brl.format(total())}`,
      `Oficina de sábado: ${workshop}`,
      `Nome: ${name() || "(vou informar)"}`,
      `Igreja ou grupo: ${church() || "(não informei)"}`,
      "",
      "Pode me mandar o Pix?",
    ].join("\n");
  }

  function accountLines() {
    const price = unitPrice();
    const lines = [`<div><dt>${counters.qtd}x ${selected().dataset.nome}</dt><dd>${brl.format(counters.qtd * price)}</dd></div>`];
    if (counters.meia) lines.push(`<div class="desc"><dt>Meia-entrada (${counters.meia})</dt><dd>-${brl.format(counters.meia * price * HALF_PRICE)}</dd></div>`);
    if (courtesy()) lines.push(`<div class="desc"><dt>Cortesia do líder (${courtesy()})</dt><dd>-${brl.format(courtesy() * price)}</dd></div>`);
    lines.push(`<div class="total"><dt>Total</dt><dd>${brl.format(total())}</dd></div>`);
    return lines.join("");
  }

  function render() {
    counters.meia = Math.min(counters.meia, counters.qtd);
    $("#qtd").textContent = String(counters.qtd);
    $("#meia").textContent = String(counters.meia);
    $('[data-qtd="qtd"][data-delta="-1"]').disabled = counters.qtd <= 1;
    $('[data-qtd="qtd"][data-delta="1"]').disabled = counters.qtd >= MAX_TICKETS;
    $('[data-qtd="meia"][data-delta="-1"]').disabled = counters.meia <= 0;
    $('[data-qtd="meia"][data-delta="1"]').disabled = counters.meia >= counters.qtd;
    $("#contas").innerHTML = accountLines();
    $("#enviar").href = whatsappUrl(message());
  }

  form.addEventListener("click", (event) => {
    const button = event.target.closest("[data-qtd]");
    if (!button) return;
    counters[button.dataset.qtd] += Number(button.dataset.delta);
    counters.qtd = Math.min(Math.max(counters.qtd, 1), MAX_TICKETS);
    counters.meia = Math.max(counters.meia, 0);
    render();
  });
  form.addEventListener("input", () => { $("#erro-nome").textContent = ""; render(); });
  form.addEventListener("submit", (event) => event.preventDefault());

  // Sem nome a mensagem sairia incompleta: o toque avisa e leva o foco ao campo.
  $("#enviar").addEventListener("click", (event) => {
    if (name()) return;
    event.preventDefault();
    $("#erro-nome").textContent = "Escreva o seu nome para a mensagem sair completa.";
    form.elements.nome.focus();
  });

  /* Os botões do lote escolhem o tipo e levam à inscrição */
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-escolher]");
    if (!button) return;
    const radio = $(`input[name=tipo][value="${button.dataset.escolher}"]`, form);
    radio.checked = true;
    render();
    $("#inscricao").scrollIntoView({ block: "start" });
    toast(`Ingresso ${radio.dataset.nome} escolhido`);
  });

  /* Barra de preço do celular: depois da capa e fora da inscrição */
  const bar = $("#barra");
  const heroButtons = $(".e-capa-botoes");
  const signup = $("#inscricao");
  if (bar && heroButtons && signup && "IntersectionObserver" in window) {
    let heroVisible = true;
    let signupVisible = false;
    const link = $("a", bar);
    const update = () => {
      const show = !heroVisible && !signupVisible;
      bar.classList.toggle("mostra", show);
      bar.setAttribute("aria-hidden", String(!show));
      link.tabIndex = show ? 0 : -1;
    };
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting || entry.boundingClientRect.top > 0;
      update();
    }).observe(heroButtons);
    new IntersectionObserver(([entry]) => {
      signupVisible = entry.isIntersecting;
      update();
    }, { rootMargin: "0px 0px -15% 0px" }).observe(signup);
  }

  /* Mapa do Centro: Leaflet e os blocos só carregam quando a seção chega perto da tela.
     O endereço é fictício, então o mapa mostra a área aproximada do Centro e nunca uma porta. */
  const LEAFLET_URL = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js";
  const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  const MAP_CENTER = [-7.2181, -35.8832];
  const MAP_AREA_RADIUS_M = 300;
  const MAP_START_ZOOM = 16;
  const MAP_PADDING_PX = 28;
  const MAP_LOAD_MARGIN = "300px";
  const METERS_PER_DEGREE_LAT = 111320;
  const MAP_LANDMARKS = [
    { name: "Praça da Bandeira", at: [-7.2194, -35.8849], direction: "bottom" },
  ];
  const cssToken = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  function drawMap(container) {
    const accent = cssToken("--accent");
    // No toque o arrastar fica desligado, para o dedo no mapa continuar rolando a página.
    const map = window.L.map(container, { scrollWheelZoom: false, dragging: !window.L.Browser.mobile, tap: false }).setView(MAP_CENTER, MAP_START_ZOOM);
    window.L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);
    const area = window.L.circle(MAP_CENTER, { radius: MAP_AREA_RADIUS_M, color: accent, weight: 2, fillColor: accent, fillOpacity: 0.22 }).addTo(map);
    const northEdge = [MAP_CENTER[0] + MAP_AREA_RADIUS_M / METERS_PER_DEGREE_LAT, MAP_CENTER[1]];
    window.L.circleMarker(northEdge, { radius: 0, stroke: false, fill: false, interactive: false })
      .bindTooltip("Endereço fictício, no Centro", { permanent: true, direction: "top", offset: [0, -4], className: "mapa-rotulo" })
      .addTo(map);
    const bounds = area.getBounds();
    MAP_LANDMARKS.forEach(({ name, at, direction }) => {
      window.L.circleMarker(at, { radius: 6, color: cssToken("--ink"), weight: 2, fillColor: cssToken("--card"), fillOpacity: 1 })
        .bindTooltip(name, { permanent: true, direction, offset: [0, direction === "top" ? -6 : 6], className: "mapa-ref" })
        .addTo(map);
      bounds.extend(at);
    });
    // Folga maior embaixo para os rótulos não ficarem atrás do crédito do mapa.
    map.fitBounds(bounds, { paddingTopLeft: [MAP_PADDING_PX, MAP_PADDING_PX * 2], paddingBottomRight: [MAP_PADDING_PX, MAP_PADDING_PX * 2] });
    container.classList.add("pronto");
  }

  function watchMap() {
    const container = $("#mapa");
    if (!container || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      loadScript(LEAFLET_URL).then(() => drawMap(container)).catch(() => {
        $(".r-mapa-aviso", container).textContent = "O mapa não carregou. Use o botão Abrir no Google Maps.";
      });
    }, { rootMargin: MAP_LOAD_MARGIN });
    observer.observe(container);
  }

  render();
  watchMap();
})();
