// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
let win = 0, loss = 0;
let ultimos = [];
let timer = 60;
let ultimaAtualizacao = "";
let leituraEmAndamento = false;
let intervaloAtual = null;

const API_ENDPOINTS = [
  "https://api.binance.com/api/v3",
  "https://api1.binance.com/api/v3",
  "https://api2.binance.com/api/v3",
  "https://api3.binance.com/api/v3"
];

// =============================================
// FUNÇÕES BÁSICAS
// =============================================
function atualizarRelogio() {
  const agora = new Date();
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    elementoHora.textContent = agora.toLocaleTimeString();
  }
}

async function fetchComFallback(path) {
  for (let endpoint of API_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}${path}`);
      if (response.ok) return await response.json();
    } catch (e) {
      console.warn(`Erro com endpoint ${endpoint}:`, e);
    }
  }
  throw new Error("Todos os endpoints da Binance falharam.");
}

// =============================================
// INDICADORES
// =============================================
function calcularRSI(closes, period = 14) {
  let ganhos = 0, perdas = 0;
  for (let i = closes.length - period; i < closes.length - 1; i++) {
    const diferenca = closes[i + 1] - closes[i];
    if (diferenca > 0) ganhos += diferenca;
    else perdas -= diferenca;
  }
  const rs = ganhos / (perdas || 1);
  return 100 - (100 / (1 + rs));
}

function calcularMACD(closes, curto = 12, longo = 26, sinal = 9) {
  const emaCurto = calcularSerieEMA(closes, curto);
  const emaLongo = calcularSerieEMA(closes, longo);
  const macdLinha = emaCurto.map((v, i) => v - emaLongo[i]);
  const sinalLinha = calcularSerieEMA(macdLinha.slice(macdLinha.length - sinal), sinal);
  const ultimoMACD = macdLinha.length ? macdLinha.pop() : 0;
  const ultimoSinal = sinalLinha.length ? sinalLinha.pop() : 0;
  return ultimoMACD - ultimoSinal;
}

function calcularStochastic(closes, low, high, period = 14) {
  const recenteClose = closes[closes.length - 1];
  const recenteLow = Math.min(...low.slice(-period));
  const recenteHigh = Math.max(...high.slice(-period));
  return ((recenteClose - recenteLow) / (recenteHigh - recenteLow)) * 100;
}

function calcularWilliamsR(closes, low, high, period = 14) {
  const recenteClose = closes[closes.length - 1];
  const recenteLow = Math.min(...low.slice(-period));
  const recenteHigh = Math.max(...high.slice(-period));
  return ((recenteHigh - recenteClose) / (recenteHigh - recenteLow)) * -100;
}

function calcularSerieEMA(valores, periodo) {
  const k = 2 / (periodo + 1);
  let emaAnterior = valores.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
  const resultados = [emaAnterior];

  for (let i = periodo; i < valores.length; i++) {
    const ema = valores[i] * k + emaAnterior * (1 - k);
    resultados.push(ema);
    emaAnterior = ema;
  }

  return resultados;
}

// =============================================
// LÓGICA DE SINAIS
// =============================================
function calcularScoreConfianca(pontos) {
  const maxPontos = 6;
  return Math.min(100, Math.round((pontos / maxPontos) * 100));
}

function analisarIndicadores(dados) {
  if (!Array.isArray(dados) || dados.length < 50) return { score: 0, comando: "ESPERAR" };

  const closes = dados.map(c => parseFloat(c[4]));
  const highs = dados.map(c => parseFloat(c[2]));
  const lows = dados.map(c => parseFloat(c[3]));
  const volumes = dados.map(c => parseFloat(c[5]));

  let pontosCALL = 0, pontosPUT = 0;

  const rsi = calcularRSI(closes);
  if (rsi < 30) pontosCALL++;
  else if (rsi > 70) pontosPUT++;

  const macd = calcularMACD(closes);
  if (macd > 0) pontosCALL++;
  else if (macd < 0) pontosPUT++;

  const stochastic = calcularStochastic(closes, lows, highs);
  if (stochastic < 20) pontosCALL++;
  else if (stochastic > 80) pontosPUT++;

  const williams = calcularWilliamsR(closes, lows, highs);
  if (williams < -80) pontosCALL++;
  else if (williams > -20) pontosPUT++;

  const ema21 = calcularSerieEMA(closes, 21).pop();
  const ema50 = calcularSerieEMA(closes, 50).pop();
  if (ema21 > ema50) pontosCALL++;
  else if (ema21 < ema50) pontosPUT++;

  const volumeAtual = volumes[volumes.length - 1];
  const volumeAnterior = volumes[volumes.length - 2];
  if (volumeAtual > volumeAnterior) pontosCALL++;
  else pontosPUT++;

  const scoreConfianca = calcularScoreConfianca(Math.max(pontosCALL, pontosPUT));
  let comando = "ESPERAR";

  if (pontosCALL >= 2.5 && pontosPUT >= 2.5) {
    comando = pontosCALL > pontosPUT ? "CALL" : "PUT";
  } else if (pontosCALL >= 2.5 && scoreConfianca >= 50) {
    comando = "CALL";
  } else if (pontosPUT >= 2.5 && scoreConfianca >= 50) {
    comando = "PUT";
  }

  return {
    score: scoreConfianca,
    comando,
    indicadores: {
      RSI: rsi.toFixed(2),
      MACD: macd.toFixed(2),
      Stochastic: stochastic.toFixed(2),
      Williams: williams.toFixed(2),
      EMA21: ema21.toFixed(2),
      EMA50: ema50.toFixed(2),
      Volume: volumeAtual.toFixed(2)
    }
  };
}

// =============================================
// FUNÇÃO PRINCIPAL DE LEITURA
// =============================================
async function fazerLeitura() {
  if (leituraEmAndamento) return;
  leituraEmAndamento = true;

  try {
    const dados = await fetchComFallback(`/klines?symbol=BTCUSDT&interval=1m&limit=150`);
    const { score, comando, indicadores } = analisarIndicadores(dados);

    const agora = new Date();
    ultimaAtualizacao = agora.toLocaleTimeString();

    if (comando !== "ESPERAR") {
      ultimos.unshift({ horario: ultimaAtualizacao, direcao: comando, score });
      if (ultimos.length > 10) ultimos.pop();
    }

    atualizarInterface(comando, score, indicadores);
  } catch (error) {
    console.error("Erro ao obter ou processar dados:", error);
  }

  leituraEmAndamento = false;
}

// =============================================
// INTERFACE E TIMER
// =============================================
function atualizarInterface(comando, score, indicadores = {}) {
  const direcaoEl = document.getElementById("direcao");
  const scoreEl = document.getElementById("score");
  const historicoEl = document.getElementById("historico");
  const criteriosEl = document.getElementById("criterios");

  if (direcaoEl) direcaoEl.textContent = `Comando Atual: ${comando}`;
  if (scoreEl) scoreEl.textContent = `Score de Confiança: Confiança: ${score}%`;
  if (historicoEl) {
    historicoEl.innerHTML = ultimos.map(sinal =>
      `<li>• ${sinal.horario} - ${sinal.direcao} – ${sinal.score}%</li>`
    ).join("");
  }
  if (criteriosEl) {
    criteriosEl.innerHTML = `
      RSI: ${indicadores.RSI} <br>
      MACD: ${indicadores.MACD} <br>
      Stochastic: ${indicadores.Stochastic} <br>
      Williams: ${indicadores.Williams} <br>
      EMA21: ${indicadores.EMA21} | EMA50: ${indicadores.EMA50} <br>
      Volume: ${indicadores.Volume}
    `;
  }

  const atualizacaoEl = document.getElementById("ultimaAtualizacao");
  if (atualizacaoEl) {
    atualizacaoEl.textContent = `Última Análise: ${ultimaAtualizacao}`;
  }
}

function iniciarContagem() {
  if (intervaloAtual) clearInterval(intervaloAtual);
  timer = 60;

  intervaloAtual = setInterval(() => {
    atualizarRelogio();
    timer--;

    const contagemEl = document.getElementById("contagem");
    if (contagemEl) contagemEl.textContent = `Próxima Leitura em: ${timer}s`;

    if (timer <= 0) {
      fazerLeitura();
      timer = 60;
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO
// =============================================
document.addEventListener("DOMContentLoaded", () => {
  atualizarRelogio();
  iniciarContagem();
  fazerLeitura();
});
