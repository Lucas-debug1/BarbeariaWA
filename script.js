(function () {
  "use strict";

  var KEY = "bwa:cliente:v1";
  var INSTAGRAM = "https://www.instagram.com/barbearia_wa__/";
  var MAPS = "https://www.google.com/maps/search/?api=1&query=Rua+Santa+Maria+da+Boa+Vista+146+Caruaru+PE";
  var ADDRESS = "Rua Santa Maria da Boa Vista, 146, Loja E, Caruaru, PE";
  var OPEN_MIN = 8 * 60;
  var CLOSE_MIN = 18 * 60 + 30;

  function $(id) { return document.getElementById(id); }
  function norm(t) { return String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function brl(n) { return "R$ " + n; }

  function recifeNow() {
    var o = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Recife", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23"
    }).formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
    var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { dow: days[o.weekday], min: (Number(o.hour) % 24) * 60 + Number(o.minute) };
  }

  function statusInfo() {
    var n = recifeNow();
    var openDay = n.dow >= 1 && n.dow <= 6;
    if (openDay && n.min >= OPEN_MIN && n.min < CLOSE_MIN) {
      return { open: true, text: "Aberto agora · fecha às 18h30", short: "Agora estamos abertos e fechamos às 18h30." };
    }
    if (openDay && n.min < OPEN_MIN) {
      return { open: false, text: "Fechado · abre hoje às 8h", short: "Agora estamos fechados, abrimos hoje às 8h." };
    }
    var tomorrow = (n.dow + 1) % 7;
    var next = tomorrow === 0 ? 1 : tomorrow;
    var when = next === tomorrow ? "amanhã" : "segunda";
    return { open: false, text: "Fechado · abre " + when + " às 8h", short: "Agora estamos fechados, abrimos " + when + " às 8h." };
  }

  function paintStatus() {
    var s = statusInfo();
    $("status").classList.toggle("open", s.open);
    $("status-text").textContent = s.text;
    var dow = String(recifeNow().dow);
    [].forEach.call(document.querySelectorAll("[data-days]"), function (row) {
      var on = row.getAttribute("data-days").split(",").indexOf(dow) > -1;
      row.classList.toggle("is-today", on);
      var pill = row.querySelector(".today-pill");
      if (pill) pill.hidden = !on;
    });
  }
  paintStatus();
  setInterval(paintStatus, 60000);

  (function () {
    var btn = $("copiar");
    var el = $("endereco");
    function selecionar() {
      var r = document.createRange();
      r.selectNodeContents(el);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
    btn.addEventListener("click", function () {
      function ok() {
        btn.textContent = "Endereço copiado";
        setTimeout(function () { btn.textContent = "Copiar endereço"; }, 2000);
      }
      try {
        navigator.clipboard.writeText(ADDRESS).then(ok, selecionar);
      } catch (e) { selecionar(); }
    });
  })();

  var canStore = (function () {
    try { localStorage.setItem(KEY + ":t", "1"); localStorage.removeItem(KEY + ":t"); return true; }
    catch (e) { return false; }
  })();

  function loadProfile() {
    try {
      var raw = localStorage.getItem(KEY);
      var p = raw ? JSON.parse(raw) : null;
      return p && typeof p === "object" && p.nome ? p : null;
    } catch (e) { return null; }
  }
  function persist() {
    if (!profile) return false;
    try { localStorage.setItem(KEY, JSON.stringify(profile)); return true; }
    catch (e) { return false; }
  }

  var profile = loadProfile();
  if (profile) {
    profile.visitas = (profile.visitas || 1) + 1;
    profile.ultimaVisita = Date.now();
    persist();
  }

  function services() {
    return [].map.call(document.querySelectorAll("[data-service]"), function (el) {
      return {
        nome: el.getAttribute("data-service"),
        preco: Number(el.getAttribute("data-price")),
        grupo: el.getAttribute("data-group"),
        re: new RegExp(el.getAttribute("data-match"), "i"),
        cede: el.getAttribute("data-yields")
      };
    });
  }
  function matchServices(t) {
    var hit = services().filter(function (s) { return s.re.test(t); });
    return hit.filter(function (s) {
      return !(s.cede && hit.some(function (o) { return o.nome === s.cede; }));
    });
  }
  function priceList() {
    var by = {}, order = [];
    services().forEach(function (s) {
      if (!by[s.grupo]) { by[s.grupo] = []; order.push(s.grupo); }
      by[s.grupo].push(s.nome + " " + brl(s.preco));
    });
    return order.map(function (g) { return g + ": " + by[g].join(", ") + "."; }).join("\n");
  }

  var MAIN_CHIPS = [
    { label: "Preços", ask: "Quais os preços?" },
    { label: "Horário", ask: "Qual o horário?" },
    { label: "Endereço", ask: "Onde fica?" },
    { label: "Ordem de chegada", ask: "Como funciona a fila?" }
  ];

  function answerLocal(raw) {
    var t = norm(raw);
    var hits = matchServices(t);
    if (hits.length) {
      return { text: hits.map(function (s) { return s.nome + ": " + brl(s.preco) + "."; }).join("\n") };
    }
    if (/(trocar|mudar|atualizar|corrigir).*(contato|numero|telefone|whats)/.test(t)) return { action: "contato" };
    if (/(trocar|mudar|atualizar|corrigir).*(nome)/.test(t)) return { action: "nome" };
    if (/\b(preco|precos|valor|valores|tabela|quanto|custa|cobra|cobram)\b/.test(t)) {
      return { text: priceList() };
    }
    if (/(fila|agend|marcar|reserv|ordem|chegada|esperar|espera|encaixe)/.test(t)) {
      return { text: "Não precisa agendar. O atendimento é por ordem de chegada: você chega, entra na fila e é atendido na sua vez." };
    }
    if (/(horario|\bhoras?\b|abre|abrem|fecha|fecham|funciona|aberto|domingo|sabado|segunda|feriado)/.test(t)) {
      var extra = "";
      if (/domingo/.test(t)) extra = " Aos domingos a barbearia fica fechada.";
      else if (/feriado/.test(t)) extra = " Em feriado, é melhor confirmar pelo Instagram @barbearia_wa__.";
      return { text: "Atendemos de segunda a sábado, das 8h às 18h30. " + statusInfo().short + extra };
    }
    if (/(\bonde\b|endereco|localizacao|\blocal\b|\brua\b|chegar|\bfica\b|\bmapa\b|\bloja\b)/.test(t)) {
      return { text: "Rua Santa Maria da Boa Vista, 146, Loja E, em Caruaru.", extra: [{ label: "Abrir no mapa", href: MAPS }] };
    }
    if (/(instagram|insta\b|foto|fotos|trabalhos|portfolio)/.test(t)) {
      return { text: "Os trabalhos estão no Instagram @barbearia_wa__.", extra: [{ label: "Abrir Instagram", href: INSTAGRAM }] };
    }
    if (/^(oi|ola|opa|e ai|eai|bom dia|boa tarde|boa noite|salve|fala)\b/.test(t)) {
      return { text: (profile ? "Oi, " + profile.nome + "! " : "Oi! ") + "Do que você precisa?" };
    }
    if (/(obrigad|valeu|brigad)/.test(t)) return { text: "Por nada! Se precisar de mais alguma coisa, é só chamar." };
    return null;
  }

  function looksLikeQuestion(raw) {
    var t = norm(raw);
    return /\?/.test(raw) || /^(quanto|qual|quais|onde|como|quando|tem |voces|vcs|posso|pode)/.test(t) || answerLocal(raw) !== null;
  }

  function cap(w, i) {
    var low = w.toLowerCase();
    if (i > 0 && /^(da|de|do|das|dos|e)$/.test(low)) return low;
    return low.charAt(0).toUpperCase() + low.slice(1);
  }
  function parseNome(raw) {
    var s = raw.trim().replace(/[.!,;:]+$/, "");
    s = s.replace(/^(oi|ola|olá|opa|e ai|bom dia|boa tarde|boa noite)[,!\s]+/i, "");
    s = s.replace(/^(meu nome (é|e)|me chamo|eu me chamo|sou (o|a)?|pode me chamar de|aqui (é|e) (o|a)?)\s+/i, "").trim();
    if (!/^[A-Za-zÀ-ÿ'’\- ]{2,40}$/.test(s)) return null;
    if (/^(sim|nao|não|ok|oi|ola|olá|opa|beleza|blz)$/i.test(s)) return null;
    var words = s.split(/\s+/);
    if (words.length > 3) return null;
    return words.map(cap).join(" ");
  }
  function parsePhone(raw) {
    var d = raw.replace(/\D/g, "");
    if (d.length >= 12 && d.indexOf("55") === 0) d = d.slice(2);
    if (d.length === 10 || (d.length === 11 && d.charAt(2) === "9")) return d;
    return null;
  }
  function fmtPhone(d) {
    return d.length === 11
      ? "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7)
      : "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
  }
  var sample = null;
  try {
    if (window.claude && typeof window.claude.use === "function") {
      window.claude.use("sample").then(function (s) { sample = s || null; }, function () { sample = null; });
    }
  } catch (e) { sample = null; }

  var convo = [];
  function remember(userText, botText) {
    convo.push({ role: "user", content: userText });
    convo.push({ role: "assistant", content: botText });
    if (convo.length > 12) convo = convo.slice(-12);
  }

  async function askClaude(text) {
    if (!sample) return null;
    var instr = [
      "Você é o assistente virtual da Barbearia WA, em Caruaru (PE). Responda em português do Brasil, em no máximo 3 frases curtas, de forma simpática e direta, sem listas e sem emojis.",
      "Use apenas os dados abaixo. Não invente serviços, preços, telefone, promoções nem horários.",
      "Atendimento: por ordem de chegada, sem agendamento. Não reserve vaga e não prometa horário.",
      "Horário: segunda a sábado, das 8h às 18h30. Domingo fechado. Para feriados, sugira confirmar pelo Instagram.",
      "Endereço: " + ADDRESS + ".",
      "Instagram: @barbearia_wa__.",
      "Preços:\n" + priceList(),
      "Se não souber a resposta, diga isso e sugira o Instagram ou passar na loja.",
      profile && profile.nome ? "Nome do cliente: " + profile.nome + "." : ""
    ].filter(Boolean).join("\n");

    var input = convo.concat([{ role: "user", content: instr + "\n\nMensagem do cliente: " + text }]);
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 30000);
    try {
      var r = await sample(input, { cache: false, modelTier: "quick", signal: ctrl.signal });
      var out = (r && r.text ? String(r.text) : "").replace(/\*\*/g, "").trim();
      return out || null;
    } catch (e) {
      if (e && e.code === "not_granted") sample = null;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  var panel = $("chat-panel");
  var launcher = $("chat-launcher");
  var log = $("chat-log");
  var chipsEl = $("chips");
  var input = $("chat-input");
  var sendBtn = $("chat-send");
  var form = $("chat-form");

  var stage = "nome"; // nome | contato | livre
  var started = false;
  var busy = false;

  function scrollDown() { log.scrollTop = log.scrollHeight; }

  function addMsg(role, text) {
    var el = document.createElement("div");
    el.className = "msg " + role;
    el.textContent = text;
    log.appendChild(el);
    scrollDown();
    return el;
  }
  function typing() {
    var el = document.createElement("div");
    el.className = "msg bot";
    el.setAttribute("aria-label", "Digitando");
    el.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    log.appendChild(el);
    scrollDown();
    return el;
  }
  function setChips(list) {
    chipsEl.innerHTML = "";
    (list || []).forEach(function (c) {
      var el;
      if (c.href) {
        el = document.createElement("a");
        el.href = c.href;
        el.target = "_blank";
        el.rel = "noopener";
      } else {
        el = document.createElement("button");
        el.type = "button";
        el.addEventListener("click", function () { submit(c.label, c.ask || c.label); });
      }
      el.className = "chip";
      el.textContent = c.label;
      chipsEl.appendChild(el);
    });
  }
  async function botSay(text, chips) {
    var t = typing();
    await sleep(Math.min(900, 350 + text.length * 10));
    t.remove();
    addMsg("bot", text);
    if (chips !== undefined) setChips(chips);
  }

  var PULAR = [{ label: "Pular", ask: "pular" }];

  function refreshChrome() {
    $("launcher-label").textContent = profile ? "Oi, " + profile.nome : "Fale com a gente";
    $("foot-actions").hidden = !profile;
    $("foot-note").textContent = canStore
      ? "Assistente virtual automático. Seus dados ficam salvos só neste aparelho."
      : "Assistente virtual automático. Este navegador não permite salvar seus dados.";
  }
  async function handleNome(text) {
    var t = norm(text);
    if (/^(oi|ola|opa|e ai|eai|bom dia|boa tarde|boa noite|salve|fala)[!. ]*$/.test(t)) {
      return botSay("Oi! Como posso te chamar?");
    }
    var nome = parseNome(text);
    if (!nome) {
      var a = answerLocal(text);
      if (a && a.text) {
        await botSay(a.text);
        return botSay("Antes, como posso te chamar?");
      }
      if (looksLikeQuestion(text)) return botSay("Já te ajudo com isso. Antes, como posso te chamar?");
      return botSay("Não consegui entender o nome. Pode escrever só o primeiro nome?");
    }
    var existing = !!profile;
    profile = profile || { contato: null, pulouContato: false, visitas: 1, criadoEm: Date.now() };
    profile.nome = nome;
    persist();
    refreshChrome();
    if (existing && (profile.contato || profile.pulouContato)) {
      stage = "livre";
      return botSay("Combinado, vou te chamar de " + nome + ". Do que você precisa?", MAIN_CHIPS);
    }
    stage = "contato";
    return botSay("Prazer, " + nome + "! Quer deixar um WhatsApp ou telefone? Fica salvo aqui e você não precisa digitar de novo.", PULAR);
  }

  async function handleContato(text) {
    var t = norm(text);
    if (/^(pular|nao|depois|agora nao|prefiro nao|deixa|cancelar)\b/.test(t)) {
      if (!profile.contato) profile.pulouContato = true;
      persist();
      stage = "livre";
      return botSay("Tudo bem, " + profile.nome + ". Do que você precisa?", MAIN_CHIPS);
    }
    var phone = parsePhone(text);
    if (!phone) {
      var a = answerLocal(text);
      if (a && a.text) {
        await botSay(a.text);
        return botSay("Quando quiser, me passe o WhatsApp com DDD, ou toque em Pular.", PULAR);
      }
      return botSay("Esse número não parece completo. Preciso do DDD, por exemplo (81) 99999-9999. Ou toque em Pular.", PULAR);
    }
    profile.contato = phone;
    profile.pulouContato = false;
    var ok = persist();
    stage = "livre";
    await botSay(ok
      ? "Salvei " + fmtPhone(phone) + ". Da próxima vez que você voltar por aqui, já estou com seus dados."
      : "Anotei " + fmtPhone(phone) + ", mas este navegador não deixou salvar. Vou lembrar só enquanto esta página estiver aberta.");
    return botSay("Do que você precisa?", MAIN_CHIPS);
  }

  async function handleLivre(text) {
    var a = answerLocal(text);
    if (a && a.action === "contato") {
      stage = "contato";
      return botSay("Claro. Me passe o novo WhatsApp ou telefone.", PULAR);
    }
    if (a && a.action === "nome") {
      stage = "nome";
      return botSay("Claro. Como você prefere ser chamado?", []);
    }
    if (a) {
      remember(text, a.text);
      return botSay(a.text, (a.extra || []).concat(MAIN_CHIPS));
    }
    var t = typing();
    var reply = await askClaude(text);
    t.remove();
    if (reply) {
      remember(text, reply);
      addMsg("bot", reply);
      return setChips(MAIN_CHIPS);
    }
    addMsg("bot", "Essa informação eu não tenho aqui. O melhor é chamar no Instagram @barbearia_wa__ ou passar na loja.");
    return setChips([{ label: "Abrir Instagram", href: INSTAGRAM }].concat(MAIN_CHIPS));
  }

  async function route(text) {
    if (stage === "nome") return handleNome(text);
    if (stage === "contato") return handleContato(text);
    return handleLivre(text);
  }

  async function submit(label, ask) {
    if (busy) return;
    busy = true;
    sendBtn.disabled = true;
    setChips([]);
    try {
      addMsg("user", label);
      await route(ask);
    } finally {
      busy = false;
      sendBtn.disabled = false;
    }
  }

  async function begin() {
    busy = true;
    sendBtn.disabled = true;
    try {
      if (!profile) {
        stage = "nome";
        await botSay("Oi! Eu sou o assistente virtual da Barbearia WA. Aqui o atendimento é por ordem de chegada, sem agendamento.");
        await botSay("Como você se chama?");
      } else if (!profile.contato && !profile.pulouContato) {
        stage = "contato";
        await botSay("Fala de novo, " + profile.nome + "! Quer deixar um WhatsApp ou telefone para ficar salvo aqui?", PULAR);
      } else {
        stage = "livre";
        await botSay("Fala de novo, " + profile.nome + "! Do que você precisa hoje?", MAIN_CHIPS);
      }
    } finally {
      busy = false;
      sendBtn.disabled = false;
    }
  }
  function openChat(focus) {
    panel.hidden = false;
    launcher.hidden = true;
    launcher.setAttribute("aria-expanded", "true");
    if (!started) { started = true; begin(); }
    if (focus) setTimeout(function () { input.focus({ preventScroll: true }); }, 60);
  }
  function closeChat() {
    panel.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute("aria-expanded", "false");
  }

  async function apagar() {
    if (busy) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* sem armazenamento */ }
    profile = null;
    convo = [];
    log.innerHTML = "";
    setChips([]);
    stage = "nome";
    refreshChrome();
    busy = true;
    sendBtn.disabled = true;
    try {
      await botSay("Apaguei seus dados deste aparelho. Quando quiser conversar de novo, me diga seu nome.");
    } finally {
      busy = false;
      sendBtn.disabled = false;
    }
  }
  launcher.addEventListener("click", function () { openChat(true); });
  $("chat-close").addEventListener("click", closeChat);
  [].forEach.call(document.querySelectorAll("[data-open-chat]"), function (b) {
    b.addEventListener("click", function () { openChat(true); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) closeChat();
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = input.value.trim();
    if (!v || busy) return;
    input.value = "";
    submit(v, v);
  });
  $("act-contato").addEventListener("click", function () {
    if (busy || !profile) return;
    stage = "contato";
    addMsg("user", "Trocar contato");
    botSay("Claro. Me passe o novo WhatsApp ou telefone.", PULAR);
  });
  $("act-apagar").addEventListener("click", apagar);

  refreshChrome();

  /* Primeira visita: o assistente abre sozinho. Quem já voltou vê o nome no botão. */
  if (!profile) {
    setTimeout(function () { if (!started) openChat(false); }, 1200);
  }
})();
