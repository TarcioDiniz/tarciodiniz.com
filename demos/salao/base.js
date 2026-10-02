// Base dos modelos do tarciodiniz.com, extraída da Passada em 01/10/2026.
// Só o que não depende do ramo: janelas que sobem de baixo, abas do celular, cabeçalho,
// filtro, aviso curto, dinheiro, link do WhatsApp e movimento. O que é do ramo (sacola,
// comanda, agenda) fica no modelo.js de cada modelo, que usa window.Modelo.
(() => {
  "use strict";

  const TOAST_MS = 2600;
  const SWIPE_CLOSE_PX = 90;
  const PHONE_QUERY = "(max-width: 899px)";
  const TAB_LINE = 0.35;

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  /* Aviso curto no pé da tela */
  let toastTimer = 0;
  function toast(text) {
    const box = $("#toast");
    if (!box) return;
    $("#toast-texto", box).textContent = text;
    box.classList.add("mostra");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("mostra"), TOAST_MS);
  }

  /* Janelas: ficha do item, pedido, busca */
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

  // Qualquer botão com data-abrir="id-da-janela" abre a janela; o modelo pode preencher antes.
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-abrir-janela]");
    if (!trigger) return;
    const dialog = document.getElementById(trigger.dataset.abrirJanela);
    if (dialog) openDialog(dialog);
  });

  /* Arrastar para baixo fecha a janela no celular */
  function enableSwipeToClose(dialog) {
    let startY = 0;
    let offset = 0;
    let dragging = false;
    $$("[data-arrastar]", dialog).forEach((zone) => {
      zone.addEventListener("touchstart", (event) => {
        if (!matchMedia(PHONE_QUERY).matches || event.target.closest("input, button, select, textarea")) return;
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

  /* Abas do celular: data-aba="nome" na aba e data-secao-aba="nome" na seção que ela acende.
     Uma janela aberta com data-aba-janela="nome" acende a aba dela. */
  const tabs = $$(".aba[data-aba]");
  const tabSections = $$("[data-secao-aba]");

  function tabForPage() {
    const line = window.scrollY + window.innerHeight * TAB_LINE;
    let current = tabs.length ? tabs[0].dataset.aba : "";
    tabSections.forEach((section) => {
      if (section.offsetTop <= line) current = section.dataset.secaoAba;
    });
    return current;
  }

  function lightTab(name) {
    tabs.forEach((tab) => {
      if (tab.dataset.aba === name) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
  }

  function syncTabs() {
    const open = $$("dialog").find((d) => d.open && d.dataset.abaJanela);
    lightTab(open ? open.dataset.abaJanela : tabForPage());
  }

  if (tabs.length) {
    window.addEventListener("scroll", syncTabs, { passive: true });
    $$("dialog").forEach((dialog) => {
      dialog.addEventListener("close", syncTabs);
      new MutationObserver(syncTabs).observe(dialog, { attributes: true, attributeFilter: ["open"] });
    });
    syncTabs();
  }

  /* Filtro: botões com data-filtro dentro de [data-filtra="id-da-grade"], cartões com data-grupo */
  $$("[data-filtra]").forEach((bar) => {
    const grid = document.getElementById(bar.dataset.filtra);
    if (!grid) return;
    $$("button[data-filtro]", bar).forEach((button) => {
      button.addEventListener("click", () => {
        const group = button.dataset.filtro;
        $$("button[data-filtro]", bar).forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        $$(".cartao", grid).forEach((card) => { card.hidden = group !== "todos" && card.dataset.grupo !== group; });
      });
    });
  });

  /* Borda do cabeçalho depois de rolar */
  const header = $(".topo");
  if (header) {
    const onScroll = () => header.classList.toggle("rolou", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* WhatsApp: sem número no espaço de trabalho. No site, o publicar-modelos.py põe window.DEMO_WA
     na página e toda mensagem vai para o Tarcio com um oi antes, para ele saber qual modelo a pessoa
     testou (decisão dele de 30/09/2026). O cliente real troca pelo número dele. */
  function whatsappUrl(text) {
    const demo = window.DEMO_WA;
    if (demo) return `https://wa.me/${demo.numero}?text=${encodeURIComponent(demo.intro + text)}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  /* Movimento: a capa já vem pintada; o resto entra ao rolar. ?estatico desliga, para capturas. */
  const still = new URLSearchParams(location.search).has("estatico");
  function animate() {
    // Aba de fundo não roda animação: o conteúdo ficaria parado no quadro inicial, invisível.
    if (still || document.visibilityState !== "visible" || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    const reveal = (selector, trigger, from) => {
      const items = $$(selector);
      if (!items.length) return;
      gsap.from(items, { y: from.y, opacity: 0, duration: from.duration, stagger: from.stagger, ease: "power3.out", scrollTrigger: { trigger, start: "top 90%", once: true } });
    };
    gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
      if ($(".capa-foto")) gsap.from(".capa-foto", { scale: 1.06, duration: 1.6, ease: "power2.out" });
      if ($(".capa-texto")) gsap.from(".capa-texto > :not(.h1)", { y: 20, opacity: 0, duration: 0.7, stagger: 0.08, ease: "power3.out", delay: 0.15 });
      $$(".h2").forEach((title) => {
        gsap.from(title, { y: 30, opacity: 0, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: title, start: "top 90%", once: true } });
      });
      $$(".grade").forEach((grid) => {
        gsap.from($$(".cartao", grid), { y: 36, opacity: 0, duration: 0.7, stagger: 0.06, ease: "power3.out", scrollTrigger: { trigger: grid, start: "top 88%", once: true } });
      });
      reveal(".destaque", ".destaques", { y: 30, duration: 0.7, stagger: 0.1 });
      reveal(".atalho", ".atalhos", { y: 16, duration: 0.5, stagger: 0.05 });
      reveal(".tile", ".mosaico", { y: 30, duration: 0.8, stagger: 0.08 });
      reveal(".passo", ".passos", { y: 24, duration: 0.6, stagger: 0.08 });
      reveal(".avaliacao", ".avaliacoes", { y: 24, duration: 0.6, stagger: 0.08 });
    });
  }

  window.Modelo = { $, $$, brl, toast, openDialog, closeDialog, whatsappUrl, syncTabs, PHONE_QUERY };
  // DOMContentLoaded só dispara depois de todos os scripts com defer, então o modelo.js já
  // montou o conteúdo dele quando a animação começa.
  document.addEventListener("DOMContentLoaded", animate);
})();
