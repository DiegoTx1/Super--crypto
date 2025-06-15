// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
const LIMIAR_DECISAO = 2.5;
const CONFIANCA_MINIMA = 50;

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
// FUNÇÕES AUXILIARES
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  document.getElementById("hora").textContent = new Date().toLocaleTimeString("pt-BR");
}

// =============================================
// INDICADORES TÉCNICOS (CORRIGIDOS)
// =============================================
function calcularMedia(dados, periodo, tipo = 'SMA') {
  if (!Array.isArray(dados)) return null;
  
  if (tipo === 'SMA') {
    if (dados.length < periodo) return null;
    return dados.slice(-periodo).reduce((a, b) => a + b, 0) / periodo;
  } 
  else if (tipo === 'EMA') {
    const k = 2 / (periodo + 1);
    let ema = dados.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
    
    for (let i = periodo; i < dados.length; i++) {
      ema = dados[i] * k + ema * (1 - k);
    }
    return ema;
  }
  return null;
}

function calcularRSI(closes, periodo = 14) {
  if (closes.length < periodo + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const rs = (gains / periodo) / (losses / periodo || 0.001);
  return 100 - (100 / (1 + rs));
}

function calcularMACD(closes, rapida = 12, lenta = 26, sinal = 9) {
  if (closes.length < lenta + sinal) return { histograma: 0, macdLinha: 0, sinalLinha: 0 };

  const emaRapida = calcularMedia(closes, rapida, 'EMA');
  const emaLenta = calcularMedia(closes, lenta, 'EMA');
  const macdLinha = emaRapida - emaLenta;
  const sinalLinha = calcularMedia(closes.slice(-sinal), sinal, 'EMA');

  return {
    histograma: macdLinha - sinalLinha,
    macdLinha,
    sinalLinha
  };
}

function calcularScoreConfianca(indicadores) {
  let score = 50;
  const { rsi, macd, volume, volumeMedia } = indicadores;

  // RSI (0-20 pontos)
  if (rsi < 30 || rsi > 70) score += 20;
  else if (rsi < 40 || rsi > 60) score += 10;

  // MACD (0-30 pontos)
  score += Math.abs(macd.histograma) * 10;

  // Volume (0-10 pontos)
  if (volume > volumeMedia * 1.2) score += 10;

  return Math.min(100, Math.max(0, score));
}

// =============================================
// LÓGICA PRINCIPAL (FUNCIONAL)
// =============================================
async function leituraReal() {
  if (leituraEmAndamento) return;
  leituraEmAndamento = true;

  try {
    const endpoint = API_ENDPOINTS[0]; // Usa primeiro endpoint (simplificado)
    const response = await fetch(`${endpoint}/klines?symbol=BTCUSDT&interval=1m&limit=150`);
    const dados = await response.json();

    const velaAtual = dados[dados.length - 1];
    const close = parseFloat(velaAtual[4]);
    const volume = parseFloat(velaAtual[5]);

    const closes = dados.map(v => parseFloat(v[4]));
    const volumes = dados.map(v => parseFloat(v[5]));

    // Calcula indicadores
    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    const ema21 = calcularMedia(closes, 21, 'EMA');
    const ema50 = calcularMedia(closes, 50, 'EMA');
    const volumeMedia = calcularMedia(volumes, 20);

    // Score e decisão
    const score = calcularScoreConfianca({ rsi, macd, close, ema21, ema50, volume, volumeMedia });
    let comando = "ESPERAR";
    if (score >= CONFIANCA_MINIMA) {
      comando = macd.histograma > 0 ? "CALL" : "PUT";
    }

    // Atualiza UI
    document.getElementById("comando").textContent = comando;
    document.getElementById("score").textContent = `Confiança: ${score}%`;
    ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

  } catch (e) {
    console.error("Erro na leitura:", e);
    document.getElementById("comando").textContent = "ERRO";
  } finally {
    leituraEmAndamento = false;
  }
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function iniciarTimer() {
  clearInterval(intervaloAtual);
  timer = 60;

  intervaloAtual = setInterval(() => {
    timer--;
    document.getElementById("timer").textContent = formatarTimer(timer);
    
    if (timer <= 0) {
      clearInterval(intervaloAtual);
      leituraReal().finally(iniciarTimer);
    }
  }, 1000);
}

function iniciarAplicativo() {
  setInterval(atualizarRelogio, 1000);
  iniciarTimer();
  leituraReal();
}

// Inicia quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarAplicativo);
} else {
  iniciarAplicativo();
}
