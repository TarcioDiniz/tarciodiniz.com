// Camarote de São João: abas da programação por noite, escolha da noite e do tipo de ingresso,
// quantidade, nome e a mensagem pronta para o WhatsApp com o total. O preço de uma pessoa é o da
// noite mais o extra do tipo (Mesa). A barra fixa do celular aparece depois da capa e some quando a
// inscrição está na tela. Os preços vêm dos atributos data-* que já estão no HTML.
(() => {
  "use strict";
  const { $, $$, brl, toast, whatsappUrl } = window.Modelo;

  const EVENT = document.body.dataset.evento || "o evento";
  const LOT = "2º lote";
  const MAX_TICKETS = 8;
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
  const night = () => $("input[name=noite]:checked", form);
  const unitPrice = () => Number(night().dataset.preco) + Number(selected().dataset.extra);
  const total = () => (counters.qtd - counters.meia) * unitPrice() + counters.meia * unitPrice() * HALF_PRICE;
  const name = () => form.elements.nome.value.trim();

  function message() {
    const kind = selected().dataset.nome;
    const half = counters.meia ? ` (${counters.meia} de meia-entrada)` : "";
    return [
      `Olá! Quero garantir ingresso no ${EVENT}.`,
      "",
      `Noite: ${night().dataset.nome}`,
      `Ingresso: ${kind}, ${LOT}`,
      `Quantidade: ${counters.qtd}${half}`,
      `Total: ${brl.format(total())}`,
      `Nome: ${name() || "(vou informar)"}`,
      "",
      "Pode me mandar o Pix?",
    ].join("\n");
  }

  function accountLines() {
    const price = unitPrice();
    const lines = [`<div><dt>${counters.qtd}x ${selected().dataset.nome}, ${night().dataset.nome}</dt><dd>${brl.format(counters.qtd * price)}</dd></div>`];
    if (counters.meia) lines.push(`<div class="desc"><dt>Meia-entrada (${counters.meia})</dt><dd>-${brl.format(counters.meia * price * HALF_PRICE)}</dd></div>`);
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

  /* Os botões do lote escolhem o tipo e os botões de cada noite escolhem a noite; os dois levam à inscrição */
  function goToSignup(message) {
    render();
    $("#inscricao").scrollIntoView({ block: "start" });
    toast(message);
  }
  document.addEventListener("click", (event) => {
    const kindButton = event.target.closest("[data-escolher]");
    if (kindButton) {
      const radio = $(`input[name=tipo][value="${kindButton.dataset.escolher}"]`, form);
      radio.checked = true;
      goToSignup(`Ingresso ${radio.dataset.nome} escolhido`);
      return;
    }
    const nightButton = event.target.closest("[data-escolher-noite]");
    if (!nightButton) return;
    const radio = $(`input[name=noite][value="${nightButton.dataset.escolherNoite}"]`, form);
    radio.checked = true;
    goToSignup(`Noite de ${radio.dataset.nome} escolhida`);
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


  /* Mapa do bairro: Leaflet e os blocos só carregam quando a seção chega perto da tela.
     O endereço é fictício, então o mapa mostra a área aproximada ao lado do Parque do Povo e nunca uma porta. */
  const LEAFLET_URL = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js";
  const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  const MAP_CENTER = [-7.2236, -35.886];
  const MAP_AREA_RADIUS_M = 300;
  const MAP_START_ZOOM = 15;
  const MAP_PADDING_PX = 28;
  const MAP_LOAD_MARGIN = "300px";
  const METERS_PER_DEGREE_LAT = 111320;
  const MAP_LANDMARKS = [
    { name: "Parque do Povo", at: [-7.224, -35.8875], direction: "top" },
    { name: "Açude Velho", at: [-7.2254, -35.8796], direction: "top" },
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
    const southEdge = [MAP_CENTER[0] - MAP_AREA_RADIUS_M / METERS_PER_DEGREE_LAT, MAP_CENTER[1]];
    window.L.circleMarker(southEdge, { radius: 0, stroke: false, fill: false, interactive: false })
      .bindTooltip("Endereço fictício, ao lado do parque", { permanent: true, direction: "bottom", offset: [0, 4], className: "mapa-rotulo" })
      .addTo(map);
    const bounds = area.getBounds();
    MAP_LANDMARKS.forEach(({ name, at, direction }) => {
      const offset = [0, -6];
      window.L.circleMarker(at, { radius: 6, color: cssToken("--ink"), weight: 2, fillColor: cssToken("--card"), fillOpacity: 1 })
        .bindTooltip(name, { permanent: true, direction, offset, className: "mapa-ref" })
        .addTo(map);
      bounds.extend(at);
    });
    // Folga maior embaixo para os rótulos não ficarem atrás do crédito do mapa.
    map.fitBounds(bounds, { paddingTopLeft: [MAP_PADDING_PX, MAP_PADDING_PX], paddingBottomRight: [MAP_PADDING_PX, MAP_PADDING_PX * 2] });
    container.classList.add("pronto");
  }

  function watchMap() {
    const container = $("#mapa");
    if (!container || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      loadScript(LEAFLET_URL).then(() => drawMap(container)).catch(() => {
        $(".e-mapa-aviso", container).textContent = "O mapa não carregou. Use o botão Abrir no Google Maps.";
      });
    }, { rootMargin: MAP_LOAD_MARGIN });
    observer.observe(container);
  }

  render();
  watchMap();
})();
