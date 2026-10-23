const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const NIVEIS = ["Nulo", "Iniciante", "Intermediário", "Avançado"];
const HABILIDADES = ["Listening", "Reading", "Writing", "Speaking"];

let diasEscolhidos = [];
let nivelEscolhido = "";

const $ = id => document.getElementById(id);

function ir(tela) {
  document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
  $(tela).classList.add("ativa");
}

async function api(url, dados) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  return { ok: r.ok, dados: await r.json() };
}

// ----- cadastro e login -----
function continuarCadastro() {
  if (!$("c-nome").value.trim() || !$("c-email").value.trim()) {
    $("c1-erro").textContent = "Preencha nome e e-mail.";
    return;
  }
  $("c1-erro").textContent = "";
  ir("cad2");
}

async function cadastrar() {
  const r = await api("/api/cadastro", {
    nome: $("c-nome").value,
    email: $("c-email").value,
    ano: $("c-ano").value,
    senha: $("c-senha").value,
    confirma: $("c-confirma").value,
  });
  if (!r.ok) { $("c-erro").textContent = r.dados.erro; return; }
  ir("dias");
}

async function entrar() {
  const r = await api("/api/login", {
    email: $("l-email").value,
    senha: $("l-senha").value,
  });
  if (!r.ok) { $("l-erro").textContent = r.dados.erro; return; }
  // TODO: buscar dias/nível já salvos e ir direto ao monitoramento
  ir("dias");
}

// ----- dias e nível (opções clicáveis) -----
function montarOpcoes(idLista, itens, multiplo, aoMudar) {
  const lista = $(idLista);
  itens.forEach(nome => {
    const div = document.createElement("div");
    div.className = "opcao";
    div.innerHTML = `<span>${nome}</span><i></i>`;
    div.onclick = () => {
      if (!multiplo) {
        lista.querySelectorAll(".opcao").forEach(o => o.classList.remove("marcada"));
      }
      div.classList.toggle("marcada");
      const marcados = lista.querySelectorAll(".marcada span");
      aoMudar([...marcados].map(s => s.textContent));
    };
    lista.appendChild(div);
  });
}

montarOpcoes("lista-dias", DIAS, true, v => { diasEscolhidos = v; });
montarOpcoes("lista-niveis", NIVEIS, false, v => { nivelEscolhido = v[0] || ""; });

function confirmarDias() {
  if (diasEscolhidos.length === 0) { alert("Escolha pelo menos um dia."); return; }
  // TODO: enviar os dias ao servidor (/api/configuracao)
  ir("nivel");
}

function confirmarNivel() {
  if (!nivelEscolhido) { alert("Escolha um nível."); return; }
  // TODO: enviar o nível ao servidor
  desenharCronograma();
  ir("cronograma");
}

// ----- cronograma (calculado só no navegador, por enquanto) -----
function desenharCronograma() {
  const ordenados = DIAS.filter(d => diasEscolhidos.includes(d));
  const habilidadeDoDia = {};
  ordenados.forEach((d, i) => { habilidadeDoDia[d] = HABILIDADES[i % HABILIDADES.length]; });
  $("tabela-cron").innerHTML = DIAS.map(d =>
    `<tr><td>${d}</td><td class="hab">${habilidadeDoDia[d] || ""}</td></tr>`
  ).join("");
}

// ----- TODO -----
function abrirMonitoramento() { console.log("TODO: tela de monitoramento"); }
function enviarExercicio() { console.log("TODO: corrigir exercício no servidor"); }
function aba(qual) { console.log("TODO: abas do monitoramento:", qual); }