// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
const LIMIAR_DECISAO = 2.5;  // Ponto mínimo para CALL/PUT
const CONFIANCA_MINIMA = 50;  // Score mínimo para operar

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
// INDICADORES TÉCNICOS (OTIMIZADOS)
// =============================================
function calcularMedia(dados, periodo, tipo = 'SMA') {
  if (!Array.isArray(dados) return null;
  
  if (tipo === 'SMA') {
    if (dados.length < periodo) return null;
    return dados.slice(-periodo).reduce((a, b) => a + b, 0) / periodo;
  } 
  else if (tipo === 'EMA') {
    const k = 2 / (periodo + 1);
    const ema = [dados.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo];
    
    for (let i = periodo; i < dados.length; i++) {
      ema.push(dados[i] * k + ema[i - periodo] * (1 - k));
    }
    return ema.pop();
  }
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

// =============================================
// LÓGICA PRINCIPAL (SIMPLIFICADA)
// =============================================
async function leituraReal() {
  if (leituraEmAndamento) return;
  leituraEmAndamento = true;

  try {
    const endpoint = API_ENDPOINTS.find(url => fetch(url).then(res => res.ok).catch(() => false));
    const response = await fetch(`${endpoint}/klines?symbol=BTCUSDT&interval=1m&limit=150`);
    const dados = await response.json();

    const velaAtual = dados[dados.length - 1];
    const close = parseFloat(velaAtual[4]);
    const volume = parseFloat(velaAtual[5]);

    const closes = dados.map(v => parseFloat(v[4]));
    const volumes = dados.map(v => parseFloat(v[5]));

    // Indicadores
    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    const ema21 = calcularMedia(closes, 21, 'EMA');
    const ema50 = calcularMedia(closes, 50, 'EMA');
    const volumeMedia = calcularMedia(volumes, 20);

    // Score de Confiança
    const score = calcularScoreConfianca({ rsi, macd, close, ema21, ema50, volume, volumeMedia });

    // Decisão
    let comando = "ESPERAR";
    if (score >= CONFIANCA_MINIMA) {
      comando = macd.histograma > 0 ? "CALL" : "PUT";
    }

    // UI
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

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarAplicativo);
} else {
  iniciarAplicativo();
}
