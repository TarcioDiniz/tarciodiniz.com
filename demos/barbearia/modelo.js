// Agenda aberta na página: o cliente escolhe serviço, com quem, dia e horário, e o resumo vai
// pronto para o WhatsApp. Serviços, equipe e horário de funcionamento são lidos do HTML. Os
// horários ocupados são fictícios e determinísticos: dependem só do dia e do profissional, então a
// página mostra a mesma agenda a cada visita. Num cliente real, busyBlocks() troca pelo que o dono
// mandar (planilha, Google Agenda). ?agora=2026-10-02T10:30 simula a hora, para testar e fotografar.
(() => {
  "use strict";
  const { $, $$, brl, toast, whatsappUrl, openDialog, PHONE_QUERY } = window.Modelo;

  const STORE = document.body.dataset.loja || "a casa";
  const DEFAULT_FADE = "médio";
  const SLOT_MIN = 30;
  const LEAD_MIN = 30;
  const DAYS_AHEAD = 7;
  const MAX_BLOCK_SLOTS = 3;
  const HERO_SLOTS = 5;
  // Chance de um horário livre virar atendimento marcado, por dia da semana (domingo é 0).
  const BOOKING_CHANCE = [0, 20, 22, 22, 24, 32, 38];
  const WEEKDAY = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

  /* Hora de agora (simulável) */
  function readNow() {
    const fake = new URLSearchParams(location.search).get("agora");
    const parsed = fake ? new Date(fake) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  }
  const NOW = readNow();
  const NOW_MIN = NOW.getHours() * 60 + NOW.getMinutes();

  const pad = (n) => String(n).padStart(2, "0");
  const clock = (min) => `${Math.floor(min / 60)}h${min % 60 ? pad(min % 60) : ""}`;
  const toMinutes = (text) => { const [h, m] = text.split(":").map(Number); return h * 60 + (m || 0); };
  const escapeHtml = (text) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const duration = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? pad(min % 60) : ""}` : `${min} min`);
  const isPhone = () => matchMedia(PHONE_QUERY).matches;

  function hash(text) {
    let value = 2166136261;
    for (const char of text) { value ^= char.codePointAt(0); value = Math.imul(value, 16777619); }
    return value >>> 0;
  }

  /* Dados lidos do HTML */
  /** @type {Map<string, { id: string, name: string, minutes: number, price: number, fade: boolean }>} */
  const services = new Map();
  $$(".ag-serv[data-servico]").forEach((el) => {
    services.set(el.dataset.servico, { id: el.dataset.servico, name: el.dataset.nome, minutes: Number(el.dataset.min), price: Number(el.dataset.preco), fade: el.dataset.degrade === "1" });
  });

  /** @type {Map<string, { id: string, name: string, services: string[], daysOff: number[] }>} */
  const pros = new Map();
  $$("[data-prof][data-servicos]").forEach((el) => {
    const daysOff = (el.dataset.folga || "").split(",").filter(Boolean).map(Number);
    pros.set(el.dataset.prof, { id: el.dataset.prof, name: el.dataset.nome, services: el.dataset.servicos.split(/\s+/), daysOff });
  });

  const hoursBox = $("[data-horario]");
  const pause = (hoursBox?.dataset.pausa || "").split("-");
  const breakStart = pause[0] ? toMinutes(pause[0]) : -1;
  const breakEnd = pause[1] ? toMinutes(pause[1]) : -1;
  /** @type {Map<number, { open: number, close: number } | null>} */
  const weekHours = new Map();
  $$("[data-dias]", hoursBox || document).forEach((row) => {
    const hours = row.dataset.abre ? { open: toMinutes(row.dataset.abre), close: toMinutes(row.dataset.fecha) } : null;
    row.dataset.dias.split(",").forEach((d) => weekHours.set(Number(d), hours));
  });

  /* Os próximos 7 dias */
  function slotsOf(weekday) {
    const hours = weekHours.get(weekday);
    if (!hours) return [];
    const list = [];
    for (let t = hours.open; t + SLOT_MIN <= hours.close; t += SLOT_MIN) {
      if (!(t >= breakStart && t < breakEnd)) list.push(t);
    }
    return list;
  }

  const days = Array.from({ length: DAYS_AHEAD }, (_, index) => {
    const date = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + index);
    const slots = slotsOf(date.getDay());
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    // Hoje, horário que já passou (ou começa em menos de 30 min) nem aparece.
    const visible = slots.filter((t) => index > 0 || t >= NOW_MIN + LEAD_MIN);
    return { index, date, key, weekday: date.getDay(), slots, slotSet: new Set(slots), visible };
  });

  const shortLabel = (day) => (day.index === 0 ? "Hoje" : day.index === 1 ? "Amanhã" : WEEKDAY_SHORT[day.weekday]);
  const spoken = (day) => (day.index === 0 ? "hoje" : day.index === 1 ? "amanhã" : WEEKDAY[day.weekday].replace("-feira", ""));
  const fullDate = (day) => `${WEEKDAY[day.weekday]}, ${pad(day.date.getDate())}/${pad(day.date.getMonth() + 1)}`;
  const shortDate = (day) => (day.index < 2 ? spoken(day) : `${WEEKDAY_SHORT[day.weekday]} ${pad(day.date.getDate())}/${pad(day.date.getMonth() + 1)}`);

  /* Agenda fictícia: blocos de 1 a 3 horários ocupados, sorteados por dia e profissional */
  const busyCache = new Map();
  function busyBlocks(day, proId) {
    const key = `${day.key}|${proId}`;
    if (busyCache.has(key)) return busyCache.get(key);
    const busy = new Set();
    let i = 0;
    while (i < day.slots.length) {
      const roll = hash(`${key}|${day.slots[i]}`);
      if (roll % 100 < BOOKING_CHANCE[day.weekday]) {
        const length = 1 + ((roll >>> 8) % MAX_BLOCK_SLOTS);
        for (let k = 0; k < length && i + k < day.slots.length; k += 1) busy.add(day.slots[i + k]);
        i += length;
      } else {
        i += 1;
      }
    }
    busyCache.set(key, busy);
    return busy;
  }

  function proIsFree(day, proId, start, minutes) {
    if (pros.get(proId).daysOff.includes(day.weekday)) return false;
    const busy = busyBlocks(day, proId);
    const needed = Math.ceil(minutes / SLOT_MIN);
    for (let i = 0; i < needed; i += 1) {
      const t = start + i * SLOT_MIN;
      if (!day.slotSet.has(t) || busy.has(t)) return false;
    }
    return true;
  }

  const eligibleFor = (serviceId) => [...pros.values()].filter((p) => p.services.includes(serviceId));
  const candidates = (serviceId, proChoice) => (proChoice === "any" ? eligibleFor(serviceId) : [pros.get(proChoice)]);

  /** Horários de um dia com a resposta de cada um: livre (e com quem) ou ocupado. */
  function daySlots(day, serviceId, proChoice) {
    const minutes = services.get(serviceId).minutes;
    const people = candidates(serviceId, proChoice);
    return day.visible.map((start) => {
      const who = people.find((p) => proIsFree(day, p.id, start, minutes));
      return { start, free: Boolean(who), proId: who ? who.id : null };
    });
  }

  function nextFree(serviceId, proChoice) {
    for (const day of days) {
      const hit = daySlots(day, serviceId, proChoice).find((s) => s.free);
      if (hit) return { day, start: hit.start, proId: hit.proId };
    }
    return null;
  }

  const hasRoom = (day) => daySlots(day, state.service, state.pro).some((s) => s.free);

  /* Estado: o primeiro serviço já vem escolhido, com "tanto faz", para o cliente só achar o horário */
  const state = { service: [...services.keys()][0], pro: "any", dayIndex: 0, start: null, name: "", fade: DEFAULT_FADE };

  function slotStillFree() {
    if (state.start === null) return true;
    const hit = daySlots(days[state.dayIndex], state.service, state.pro).find((s) => s.start === state.start);
    return Boolean(hit && hit.free);
  }

  function dropSlotIfTaken(reason) {
    if (slotStillFree()) return;
    state.start = null;
    toast(reason);
  }

  function pickService(id) {
    state.service = id;
    const service = services.get(id);
    if (state.pro !== "any" && !pros.get(state.pro).services.includes(id)) {
      state.pro = "any";
      toast(`Quem estiver livre faz ${service.name.toLowerCase()}`);
    }
    dropSlotIfTaken(`${service.name} leva ${duration(service.minutes)} e não cabe nesse horário`);
  }

  function pickPro(id) {
    state.pro = id;
    if (id !== "any" && !pros.get(id).services.includes(state.service)) {
      state.service = pros.get(id).services[0];
    }
    dropSlotIfTaken(id === "any" ? "Escolha o horário de novo" : `${pros.get(id).name} não está livre nesse horário`);
  }

  function pickDay(index) {
    state.dayIndex = index;
    state.start = null;
  }

  function ensureDay() {
    if (hasRoom(days[state.dayIndex])) return;
    const day = days.find(hasRoom);
    state.dayIndex = day ? day.index : 0;
    state.start = null;
  }

  /* Desenho: serviços, profissionais, dias, horários, resumo, capa e barra */
  function paintServices() {
    $$(".ag-serv").forEach((el) => el.setAttribute("aria-pressed", String(el.dataset.servico === state.service)));
    paintFade();
  }

  /** A altura do degradê só aparece quando o serviço escolhido é o degradê. */
  function paintFade() {
    const box = $("[data-degrade-box]");
    if (!box) return;
    box.hidden = !services.get(state.service).fade;
    $$("[data-altura]", box).forEach((button) => {
      const on = button.dataset.altura === state.fade;
      button.setAttribute("aria-pressed", String(on));
      if (on) $("[data-degrade-nota]", box).textContent = button.dataset.nota;
    });
  }

  function paintPros() {
    const service = services.get(state.service);
    $$(".ag-pro").forEach((button) => {
      const id = button.dataset.escolheProf;
      const note = $("small", button);
      button.setAttribute("aria-pressed", String(id === state.pro));
      if (id === "any") {
        const hit = nextFree(state.service, "any");
        note.textContent = hit ? `primeiro: ${spoken(hit.day)}, ${clock(hit.start)}` : "sem horário";
        return;
      }
      const does = pros.get(id).services.includes(state.service);
      button.disabled = !does;
      if (!does) { note.textContent = `não faz ${service.name.toLowerCase()}`; return; }
      const hit = nextFree(state.service, id);
      note.textContent = hit ? `${spoken(hit.day)}, ${clock(hit.start)}` : "sem horário";
    });
  }

  function paintDays() {
    $("[data-dias-lista]").innerHTML = days.map((day) => {
      const free = daySlots(day, state.service, state.pro).filter((s) => s.free).length;
      const dayOff = state.pro !== "any" && pros.get(state.pro).daysOff.includes(day.weekday);
      const note = !day.slots.length ? "Fechado" : !day.visible.length ? "Encerrado" : dayOff ? "Folga" : free ? `${free} livre${free > 1 ? "s" : ""}` : "Lotado";
      return `<button class="ag-dia" type="button" data-key="d-${day.index}" data-escolhe-dia="${day.index}" aria-pressed="${state.dayIndex === day.index}" ${free ? "" : "disabled"}><span>${shortLabel(day)}</span><b>${day.date.getDate()}</b><small>${note}</small></button>`;
    }).join("");
  }

  function paintSlots() {
    const day = days[state.dayIndex];
    const slots = daySlots(day, state.service, state.pro);
    const groups = [["Manhã", slots.filter((s) => s.start < 12 * 60)], ["Tarde", slots.filter((s) => s.start >= 12 * 60)]];
    const grid = groups.filter(([, list]) => list.length).map(([label, list]) => `
      <p class="ag-periodo">${label}, ${fullDate(day)}</p>
      <div class="ag-horarios" role="group" aria-label="${label}, ${fullDate(day)}">
        ${list.map((s) => `<button type="button" data-key="t-${s.start}" data-escolhe-horario="${s.start}" aria-pressed="${state.start === s.start}" ${s.free ? "" : `disabled aria-label="${clock(s.start)}, ocupado"`}>${clock(s.start)}</button>`).join("")}
      </div>`).join("");
    const empty = days.some(hasRoom) ? "" : `<p class="ag-vazio">Sem horário livre nos próximos ${DAYS_AHEAD} dias para este serviço. Chame no WhatsApp que a gente encaixa.</p>`;
    $("[data-horarios]").innerHTML = empty + grid;
  }

  const proLabel = () => (state.pro === "any" ? "Tanto faz" : pros.get(state.pro).name);
  const endOfService = () => state.start + services.get(state.service).minutes;

  function message() {
    const s = services.get(state.service);
    const day = days[state.dayIndex];
    const lines = [
      `Olá, ${STORE}! Quero marcar um horário:`,
      "",
      `Serviço: ${s.name} (${duration(s.minutes)}, ${brl.format(s.price)})`,
      ...(s.fade ? [`Degradê: ${state.fade}`] : []),
      `Com quem: ${state.pro === "any" ? "tanto faz" : pros.get(state.pro).name}`,
      `Dia: ${fullDate(day)}`,
      `Horário: ${clock(state.start)} às ${clock(endOfService())}`,
    ];
    if (state.name.trim()) lines.push("", `Meu nome é ${state.name.trim()}.`);
    lines.push("", "Pode confirmar?");
    return lines.join("\n");
  }

  function summaryHtml(idSuffix) {
    const s = services.get(state.service);
    const day = days[state.dayIndex];
    const when = state.start === null
      ? `<span class="falta">escolha o horário</span>`
      : `${fullDate(day)}<small>${clock(state.start)} às ${clock(endOfService())}</small>`;
    const ready = state.start !== null;
    return `
      <h3>Seu horário</h3>
      <dl class="ag-resumo">
        <div><dt>Serviço</dt><dd>${escapeHtml(s.name)}<small>${duration(s.minutes)}${s.fade ? `, degradê ${state.fade}` : ""}</small></dd></div>
        <div><dt>Com quem</dt><dd>${escapeHtml(proLabel())}</dd></div>
        <div><dt>Quando</dt><dd>${when}</dd></div>
        <div class="ag-total"><dt>Total</dt><dd>${brl.format(s.price)}<small>pago no local</small></dd></div>
      </dl>
      <label class="campo-nome" for="nome-${idSuffix}">Seu nome (opcional)<input id="nome-${idSuffix}" type="text" data-nome autocomplete="given-name" enterkeyhint="done" placeholder="Como a gente te chama" value="${escapeHtml(state.name)}"></label>
      <a class="btn btn-ink ag-enviar" href="${ready ? whatsappUrl(message()) : "#ag-quando"}" ${ready ? 'target="_blank" rel="noopener"' : 'aria-disabled="true"'}><svg class="ico wa-ico" aria-hidden="true"><use href="#i-whatsapp"/></svg>Confirmar pelo WhatsApp</a>
      <ul class="ag-regras">
        <li><svg class="ico" aria-hidden="true"><use href="#i-arrows-clockwise"/></svg>Remarque até 2 horas antes, sem custo</li>
        <li><svg class="ico" aria-hidden="true"><use href="#i-clock"/></svg>Tolerância de 15 minutos de atraso</li>
        <li><svg class="ico" aria-hidden="true"><use href="#i-credit-card"/></svg>Pix, cartão ou dinheiro, no local</li>
      </ul>`;
  }

  function paintSummary() {
    $("[data-resumo-cartao]").innerHTML = summaryHtml("lado");
    $("[data-resumo-janela]").innerHTML = `<div class="ag-resumo-cartao">${summaryHtml("janela")}</div>`;
  }

  function paintBar() {
    const s = services.get(state.service);
    const day = days[state.dayIndex];
    const ready = state.start !== null;
    $("[data-barra-titulo]").textContent = ready ? `${s.name} · ${shortDate(day)}, ${clock(state.start)}` : s.name;
    $("[data-barra-sub]").textContent = ready ? `${brl.format(s.price)} · ${duration(s.minutes)} · ${proLabel()}` : `${brl.format(s.price)} · ${duration(s.minutes)} · escolha o horário`;
    $("[data-barra-acao]").textContent = ready ? "Confirmar" : "Ver horários";
  }

  function paintHero() {
    const service = services.get(state.service);
    const day = days.find((d) => daySlots(d, state.service, "any").some((s) => s.free));
    const box = $("[data-livres]");
    if (!day) {
      $("[data-livres-dia]").textContent = "Sem horário livre";
      box.innerHTML = "";
      return;
    }
    const free = daySlots(day, state.service, "any").filter((s) => s.free);
    $("[data-livres-dia]").textContent = day.index === 0 ? "Livres hoje" : `Livres ${spoken(day)}`;
    $("[data-livres-servico]").textContent = service.name.toLowerCase();
    const chips = free.slice(0, HERO_SLOTS).map((s) => `<button class="ag-livre" type="button" data-livre="${day.index}|${s.start}" aria-label="Marcar ${service.name}, ${spoken(day)}, ${clock(s.start)}">${clock(s.start)}</button>`).join("");
    const more = free.length > HERO_SLOTS ? `<a class="ag-livre ag-livre-mais" href="#ag-quando" aria-label="Ver os outros ${free.length - HERO_SLOTS} horários">+${free.length - HERO_SLOTS}</a>` : "";
    box.innerHTML = chips + more;
  }

  function render() {
    ensureDay();
    paintServices();
    paintPros();
    paintDays();
    paintSlots();
    paintSummary();
    paintBar();
  }

  /** Redesenha sem tirar o foco de quem usa o teclado. */
  function renderKeepingFocus() {
    const key = document.activeElement?.dataset?.key;
    render();
    if (key) $(`[data-key="${key}"]`)?.focus();
  }

  const goTo = (selector) => $(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });

  /* Cliques */
  document.addEventListener("click", (event) => {
    const target = event.target;
    const heroSlot = target.closest("[data-livre]");
    const filter = target.closest(".ag-filtro button");
    const service = target.closest(".ag-serv");
    const fade = target.closest("[data-altura]");
    const pro = target.closest(".ag-pro");
    const day = target.closest("[data-escolhe-dia]");
    const slot = target.closest("[data-escolhe-horario]");
    const withPro = target.closest("[data-agendar-com]");
    const barAction = target.closest("[data-barra-acao]");
    const send = target.closest(".ag-enviar");

    if (heroSlot) {
      const [dayIndex, start] = heroSlot.dataset.livre.split("|").map(Number);
      state.pro = "any";
      state.dayIndex = dayIndex;
      state.start = start;
      render();
      if (isPhone()) openDialog($("#confirmar")); else goTo("#agenda");
      return;
    }
    if (filter) {
      const kind = filter.dataset.tipo;
      $$(".ag-filtro button").forEach((b) => b.setAttribute("aria-pressed", String(b === filter)));
      $$(".ag-serv").forEach((el) => { el.hidden = kind !== "todos" && el.dataset.tipo !== kind; });
      return;
    }
    if (fade) { state.fade = fade.dataset.altura; renderKeepingFocus(); return; }
    if (service) { pickService(service.dataset.servico); renderKeepingFocus(); paintHero(); return; }
    if (pro && !pro.disabled) { pickPro(pro.dataset.escolheProf); renderKeepingFocus(); paintHero(); return; }
    if (day) { pickDay(Number(day.dataset.escolheDia)); renderKeepingFocus(); return; }
    if (slot) {
      state.start = Number(slot.dataset.escolheHorario);
      renderKeepingFocus();
      if (isPhone()) toast(`${clock(state.start)} escolhido`);
      return;
    }
    if (withPro) { pickPro(withPro.dataset.agendarCom); render(); paintHero(); goTo("#agenda"); return; }
    if (barAction) {
      if (state.start === null) goTo("#ag-quando"); else openDialog($("#confirmar"));
      return;
    }
    if (send) {
      if (send.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        toast("Escolha um horário primeiro");
        goTo("#ag-quando");
        return;
      }
      toast("Abrindo o WhatsApp com o pedido pronto");
    }
  });

  // O nome não redesenha nada: só atualiza o texto que vai para o WhatsApp.
  document.addEventListener("input", (event) => {
    if (!event.target.matches("[data-nome]")) return;
    state.name = event.target.value;
    $$("[data-nome]").forEach((input) => { if (input !== event.target) input.value = state.name; });
    if (state.start !== null) $$(".ag-enviar").forEach((link) => { link.href = whatsappUrl(message()); });
  });

  /* Pedaços vivos da página: status, próximo horário de cada pessoa e o dia de hoje */
  function statusText() {
    const today = weekHours.get(days[0].weekday);
    if (today && NOW_MIN >= today.open && NOW_MIN < today.close) {
      return NOW_MIN >= breakStart && NOW_MIN < breakEnd ? `Volta às ${clock(breakEnd)}` : `Aberto até ${clock(today.close)}`;
    }
    if (today && NOW_MIN < today.open) return `Abre hoje às ${clock(today.open)}`;
    const next = days.slice(1).find((d) => d.slots.length);
    return next ? `Abre ${spoken(next)}, ${clock(next.slots[0])}` : "Fechado";
  }

  function paintLive() {
    $("[data-status]").textContent = statusText();
    $$("[data-pessoa-livre]").forEach((el) => {
      const person = pros.get(el.dataset.pessoaLivre);
      const hit = person ? nextFree(person.services[0], person.id) : null;
      el.textContent = hit ? `Próximo horário: ${spoken(hit.day)}, ${clock(hit.start)}` : "Sem horário esta semana";
    });
    const today = days[0];
    $$("[data-dias]", hoursBox || document).forEach((row) => {
      if (row.dataset.dias.split(",").map(Number).includes(today.weekday)) row.setAttribute("aria-current", "date");
    });
  }

  /* Barra do celular: aparece quando os botões da capa saem da tela */
  const bar = $("#barra");
  const heroButtons = $(".ag-capa-botoes");
  if (bar && heroButtons && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      const show = !(entry.isIntersecting || entry.boundingClientRect.top > 0);
      bar.classList.toggle("mostra", show);
      bar.inert = !show;
    }).observe(heroButtons);
  }

  /* Mapa do bairro: Leaflet e os blocos só carregam quando a seção chega perto da tela.
     O endereço é fictício, então o mapa mostra a área aproximada do Prata e nunca uma porta. */
  const LEAFLET_URL = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js";
  const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  const MAP_CENTER = [-7.2201, -35.894];
  const MAP_AREA_RADIUS_M = 400;
  const MAP_START_ZOOM = 15;
  const MAP_PADDING_PX = 28;
  const MAP_LOAD_MARGIN = "300px";
  const METERS_PER_DEGREE_LAT = 111320;
  const MAP_LANDMARKS = [
    { name: "Feira Central", at: [-7.2194, -35.8783], direction: "top" },
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
      .bindTooltip("Endereço fictício, no Prata", { permanent: true, direction: "bottom", offset: [0, 4], className: "mapa-rotulo" })
      .addTo(map);
    const bounds = area.getBounds();
    MAP_LANDMARKS.forEach(({ name, at, direction }) => {
      window.L.circleMarker(at, { radius: 6, color: cssToken("--ink"), weight: 2, fillColor: cssToken("--card"), fillOpacity: 1 })
        .bindTooltip(name, { permanent: true, direction, offset: [0, direction === "top" ? -6 : 6], className: "mapa-ref" })
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
        $(".ag-mapa-aviso", container).textContent = "O mapa não carregou. Use o botão Abrir no Google Maps.";
      });
    }, { rootMargin: MAP_LOAD_MARGIN });
    observer.observe(container);
  }

  render();
  paintHero();
  paintLive();
  watchMap();
})();
