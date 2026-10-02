// Portfólio: filtro da galeria, foto em tela cheia, pacotes que escolhem o tipo no formulário,
// formulário que vira mensagem de WhatsApp e o botão fixo do celular depois da capa.
(() => {
  "use strict";

  const { $, $$, toast, openDialog, closeDialog, whatsappUrl } = window.Modelo;

  const DRAG_INTENT_PX = 10;
  const SWIPE_CLOSE_PX = 90;
  const SWIPE_NEXT_PX = 60;
  const DEFAULT_RATIO = "1";
  const STILL = new URLSearchParams(location.search).has("estatico");

  const WORK_TYPES = {
    casamento: { label: "Casamento", phrase: "um casamento", fromPrice: 4350 },
    ensaio: { label: "Ensaio", phrase: "um ensaio", fromPrice: 790 },
    eventos: { label: "Evento", phrase: "um evento", fromPrice: 1350 },
    outro: { label: "Outro", phrase: "um trabalho", fromPrice: 0 },
  };
  const CATEGORY_LABELS = { casamento: "Casamento", ensaio: "Ensaio", eventos: "Eventos" };
  const FIELD_ERRORS = {
    tipo: "Escolha o tipo de trabalho.",
    data: "Escolha a data do trabalho.",
    cidade: "Diga em que cidade será.",
    nome: "Diga seu nome.",
  };
  const FIELD_ORDER = ["tipo", "data", "cidade", "nome"];

  /* Galeria: filtro por categoria */
  const gallery = $("#galeria");
  const photos = $$(".p-foto", gallery);
  const status = $("#galeria-status");
  const visiblePhotos = () => photos.filter((photo) => !photo.hidden);

  /* Cada foto vai para a coluna mais curta e, se faltar pouco, as fotos das colunas mais curtas
     crescem um pouco (o recorte é do object-fit) para todas terminarem na mesma linha. As colunas do
     CSS ficam só para quem está sem JavaScript: com foto que não quebra, elas deixavam uma coluna até
     631 px mais curta (WebKit no iPhone e Chrome no computador, medido em 01/10/2026). */
  const MAX_STRETCH = 1.3;
  let arrangedWidth = -1;
  function arrangeGallery() {
    const style = getComputedStyle(gallery);
    const columns = Number.parseInt(style.columnCount, 10) || 1;
    const gap = Number.parseFloat(style.columnGap) || 0;
    arrangedWidth = gallery.clientWidth;
    const columnWidth = (arrangedWidth - gap * (columns - 1)) / columns;
    const stacks = Array.from({ length: columns }, () => ({ items: [], bottom: 0 }));
    visiblePhotos().forEach((photo) => {
      const ratio = Number.parseFloat(photo.style.getPropertyValue("--r")) || Number(DEFAULT_RATIO);
      const stack = stacks.reduce((lowest, candidate) => (candidate.bottom < lowest.bottom ? candidate : lowest));
      stack.items.push({ photo, height: columnWidth / ratio });
      stack.bottom += columnWidth / ratio + gap;
    });
    const tallest = Math.max(...stacks.map((stack) => stack.bottom));
    gallery.classList.add("em-grade");
    stacks.forEach((stack, column) => {
      const content = stack.items.reduce((sum, item) => sum + item.height, 0);
      const stretch = content > 0 ? (content + tallest - stack.bottom) / content : 1;
      const factor = stretch <= MAX_STRETCH ? stretch : 1;
      let top = 0;
      stack.items.forEach(({ photo, height }) => {
        photo.style.left = `${column * (columnWidth + gap)}px`;
        photo.style.top = `${top}px`;
        photo.style.width = `${columnWidth}px`;
        photo.style.height = `${height * factor}px`;
        top += height * factor + gap;
      });
    });
    gallery.style.height = `${Math.max(0, tallest - gap)}px`;
  }

  function applyFilter(category) {
    photos.forEach((photo) => {
      photo.hidden = category !== "todos" && photo.dataset.cat !== category;
      photo.classList.remove("entra");
    });
    arrangeGallery();
    const shown = visiblePhotos();
    if (!STILL) requestAnimationFrame(() => shown.forEach((photo) => photo.classList.add("entra")));
    const label = CATEGORY_LABELS[category];
    status.textContent = `${shown.length} fotos${label ? ` de ${label.toLowerCase()}` : ""}`;
  }

  const filterBar = $("[data-galeria-filtro]");
  $$("button[data-cat]", filterBar).forEach((button) => {
    button.addEventListener("click", () => {
      $$("button[data-cat]", filterBar).forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
      applyFilter(button.dataset.cat);
    });
  });

  arrangeGallery();
  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      if (gallery.clientWidth !== arrangedWidth) arrangeGallery();
    }).observe(gallery);
  }

  /* Foto em tela cheia: anterior, próxima, Esc, toque fora e arrastar */
  const lightbox = $("#lb");
  const stage = $("#lb-palco");
  const frame = $("#lb-quadro");
  const counter = $("#lb-contador");
  const caption = $("#lb-legenda");
  let sequence = [];
  let current = 0;

  function buildMedia(photo) {
    const media = $("img, .foto-vazia", photo).cloneNode(true);
    if (media.matches("img")) {
      media.removeAttribute("loading");
      media.alt = photo.dataset.legenda;
      if (photo.dataset.grande) media.src = photo.dataset.grande;
    }
    return media;
  }

  function buildCaption(photo) {
    const title = document.createElement("span");
    title.textContent = photo.dataset.legenda;
    const category = document.createElement("span");
    category.className = "lb-cat";
    category.textContent = CATEGORY_LABELS[photo.dataset.cat] || "";
    caption.replaceChildren(title, category);
  }

  function show(index, animate) {
    current = (index + sequence.length) % sequence.length;
    const photo = sequence[current];
    frame.style.setProperty("--r", photo.style.getPropertyValue("--r") || DEFAULT_RATIO);
    frame.replaceChildren(buildMedia(photo));
    buildCaption(photo);
    counter.textContent = `${current + 1} de ${sequence.length}`;
    if (animate && !STILL) {
      frame.classList.remove("troca");
      requestAnimationFrame(() => frame.classList.add("troca"));
    }
  }

  const step = (direction) => show(current + direction, true);

  gallery.addEventListener("click", (event) => {
    const photo = event.target.closest(".p-foto");
    if (!photo) return;
    sequence = visiblePhotos();
    show(sequence.indexOf(photo), false);
    openDialog(lightbox);
  });

  $("#lb-anterior").addEventListener("click", () => step(-1));
  $("#lb-proxima").addEventListener("click", () => step(1));
  document.addEventListener("keydown", (event) => {
    if (!lightbox.open) return;
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  });
  lightbox.addEventListener("close", () => frame.replaceChildren());

  // Arrastar: para baixo fecha, para os lados passa a foto. Toque fora da foto também fecha.
  let drag = null;
  function resetFrame() {
    frame.style.transition = "";
    frame.style.transform = "";
    frame.style.opacity = "";
  }

  stage.addEventListener("pointerdown", (event) => {
    drag = { x: event.clientX, y: event.clientY, dx: 0, dy: 0, axis: "", onFrame: Boolean(event.target.closest(".lb-quadro")) };
  });
  stage.addEventListener("pointermove", (event) => {
    if (!drag) return;
    drag.dx = event.clientX - drag.x;
    drag.dy = event.clientY - drag.y;
    if (!drag.axis && Math.hypot(drag.dx, drag.dy) > DRAG_INTENT_PX) drag.axis = Math.abs(drag.dy) > Math.abs(drag.dx) ? "y" : "x";
    if (!drag.axis) return;
    frame.style.transition = "none";
    if (drag.axis === "y") {
      const down = Math.max(0, drag.dy);
      frame.style.transform = `translateY(${down}px)`;
      frame.style.opacity = String(Math.max(0.35, 1 - down / (SWIPE_CLOSE_PX * 3)));
    } else {
      frame.style.transform = `translateX(${drag.dx}px)`;
    }
  });
  function endDrag(event) {
    if (!drag) return;
    const { axis, dx, dy, onFrame } = drag;
    drag = null;
    resetFrame();
    if (axis === "y" && dy > SWIPE_CLOSE_PX) closeDialog(lightbox);
    else if (axis === "x" && Math.abs(dx) > SWIPE_NEXT_PX) step(dx < 0 ? 1 : -1);
    else if (!axis && !onFrame && event.type === "pointerup") closeDialog(lightbox);
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("pointerleave", endDrag);

  /* Formulário de consulta: vira a mensagem pronta do WhatsApp */
  const form = $("#form-consulta");
  const errorBox = $("#form-erro");
  const preview = $("#form-previa");
  const PREVIEW_EMPTY = preview.textContent;
  const fields = Object.fromEntries(FIELD_ORDER.map((name) => [name, form.elements[name]]));

  function localToday() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
  fields.data.min = localToday();

  function formatDate(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(year, month - 1, day)));
  }

  function readValues() {
    return Object.fromEntries(FIELD_ORDER.map((name) => [name, fields[name].value.trim()]));
  }

  function missingField(values) {
    const missing = FIELD_ORDER.find((name) => !values[name]);
    if (missing) return { name: missing, text: FIELD_ERRORS[missing] };
    if (values.data < fields.data.min) return { name: "data", text: "Escolha uma data a partir de hoje." };
    return null;
  }

  function buildMessage(values) {
    const type = WORK_TYPES[values.tipo];
    const price = type.fromPrice ? ` Vi que o pacote começa em R$ ${type.fromPrice.toLocaleString("pt-BR")}.` : "";
    return `Olá, Marina! Aqui é ${values.nome}. Quero consultar a data de ${formatDate(values.data)} para ${type.phrase} em ${values.cidade}.${price} Você tem essa data livre? Pode me passar um orçamento?`;
  }

  function refreshPreview() {
    const values = readValues();
    preview.textContent = missingField(values) ? PREVIEW_EMPTY : buildMessage(values);
  }

  function clearErrors() {
    errorBox.textContent = "";
    FIELD_ORDER.forEach((name) => fields[name].removeAttribute("aria-invalid"));
  }

  form.addEventListener("input", () => {
    clearErrors();
    refreshPreview();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearErrors();
    const values = readValues();
    const problem = missingField(values);
    if (problem) {
      const field = fields[problem.name];
      field.setAttribute("aria-invalid", "true");
      errorBox.textContent = problem.text;
      field.focus();
      return;
    }
    const url = whatsappUrl(buildMessage(values));
    form.dataset.url = url;
    const opened = window.open(url, "_blank");
    if (opened) opened.opener = null;
    else location.href = url;
    toast("Abrindo o WhatsApp com a mensagem pronta");
  });

  // Os botões dos pacotes só escolhem o tipo; a rolagem até o formulário é o próprio link.
  $$(".p-escolher").forEach((button) => {
    button.addEventListener("click", () => {
      fields.tipo.value = button.dataset.tipo;
      clearErrors();
      refreshPreview();
    });
  });

  /* Botão fixo do celular: aparece quando os botões da capa saem da tela e some quando o
     formulário chega, porque ele já é a ação. */
  const bar = $("#barra");
  const heroButtons = $("#capa-botoes");
  const consult = $("#consultar");
  if (bar && heroButtons && consult && "IntersectionObserver" in window) {
    let heroVisible = true;
    let consultVisible = false;
    const link = $("a", bar);

    const update = () => {
      const show = !heroVisible && !consultVisible;
      bar.classList.toggle("mostra", show);
      bar.setAttribute("aria-hidden", String(!show));
      link.tabIndex = show ? 0 : -1;
    };

    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting || entry.boundingClientRect.top > 0;
      update();
    }).observe(heroButtons);

    new IntersectionObserver(([entry]) => {
      consultVisible = entry.isIntersecting || entry.boundingClientRect.top < 0;
      update();
    }, { rootMargin: "0px 0px -20% 0px" }).observe(consult);
  }
})();
