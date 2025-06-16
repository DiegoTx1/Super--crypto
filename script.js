// CONFIGURAÇÕES GLOBAIS (OTIMIZADAS)
const state = {
  ultimos: [],
  timer: 60,
  ultimaAtualizacao: "",
  leituraEmAndamento: false,
  intervaloAtual: null,
  marketOpen: true,
  activeMarkets: []
};

const CONFIG = {
  API_ENDPOINT: "https://api.twelvedata.com",
  WS_ENDPOINT: "wss://stream.twelvedata.com/v1/quotes/price",
  PAR: "EUR/USD",
  PERIODOS: {
    EMA_CURTA: 9,
    EMA_LONGA: 21,
    EMA_200: 200,
    RSI: 14,
    STOCH: 14,
    ATR: 14,
    SUPERTREND: 10,
    SUPERTREND_MULT: 3
  },
  LIMIARES: {
    SCORE_ALTO: 75,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30
  },
  MARKET_HOURS: {
    LONDON_OPEN: 7,
    LONDON_CLOSE: 16,
    NY_OPEN: 13,
    NY_CLOSE: 22
  }
};

// FUNÇÕES UTILITÁRIAS (OTIMIZADAS)
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const now = new Date();
  const gmtHours = now.getUTCHours();
  
  state.marketOpen = (gmtHours >= CONFIG.MARKET_HOURS.LONDON_OPEN && gmtHours < CONFIG.MARKET_HOURS.LONDON_CLOSE) || 
                    (gmtHours >= CONFIG.MARKET_HOURS.NY_OPEN && gmtHours < CONFIG.MARKET_HOURS.NY_CLOSE);
  
  document.getElementById("hora").textContent = now.toLocaleTimeString("pt-BR");
  
  if (!state.marketOpen) {
    document.getElementById("comando").textContent = "MERCADO FECHADO";
    document.getElementById("comando").className = "esperar";
  }
}

function atualizarInterface(sinal, score) {
  if (!state.marketOpen) return;
  
  const comando = document.getElementById("comando");
  comando.textContent = sinal;
  comando.className = sinal.toLowerCase();
  
  if (sinal === "CALL") comando.textContent += " 📈";
  else if (sinal === "PUT") comando.textContent += " 📉";
  
  const scoreElement = document.getElementById("score");
  scoreElement.textContent = `Confiança: ${score}%`;
  scoreElement.style.color = score >= CONFIG.LIMIARES.SCORE_ALTO ? '#00ff00' : 
                           score >= 60 ? '#ffff00' : '#ff0000';
}

// INDICADORES ESSENCIAIS (OTIMIZADOS)
function calcularEMA(dados, periodo) {
  if (dados.length < periodo) return 0;
  
  const k = 2 / (periodo + 1);
  let ema = dados.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
  
  for (let i = periodo; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
  }
  
  return ema;
}

function calcularRSI(closes) {
  if (closes.length < CONFIG.PERIODOS.RSI + 1) return 50;
  
  let gains = 0, losses = 0;
  
  for (let i = 1; i <= CONFIG.PERIODOS.RSI; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / CONFIG.PERIODOS.RSI;
  const avgLoss = Math.max(losses / CONFIG.PERIODOS.RSI, 0.00001);
  const rs = avgGain / avgLoss;
  
  return 100 - (100 / (1 + rs));
}

function calcularSupertrend(dados) {
  const atr = calcularATR(dados);
  const medio = (dados[dados.length-1].high + dados[dados.length-1].low) / 2;
  
  const upper = medio + CONFIG.PERIODOS.SUPERTREND_MULT * atr;
  const lower = medio - CONFIG.PERIODOS.SUPERTREND_MULT * atr;
  
  return {
    upper,
    lower,
    direcao: dados[dados.length-1].close > upper ? 1 : 
             dados[dados.length-1].close < lower ? -1 : 0
  };
}

function calcularATR(dados) {
  if (dados.length < CONFIG.PERIODOS.ATR + 1) return 0;
  
  let trSum = 0;
  for (let i = 1; i <= CONFIG.PERIODOS.ATR; i++) {
    const tr = Math.max(
      dados[i].high - dados[i].low,
      Math.abs(dados[i].high - dados[i-1].close),
      Math.abs(dados[i].low - dados[i-1].close)
    );
    trSum += tr;
  }
  
  return trSum / CONFIG.PERIODOS.ATR;
}

// CORE DO SISTEMA (OTIMIZADO)
async function obterDados() {
  try {
    const response = await fetch(`${CONFIG.API_ENDPOINT}/time_series?symbol=${CONFIG.PAR}&interval=1min&outputsize=100&apikey=demo`);
    const data = await response.json();
    
    return data.values.map(v => ({
      time: v.datetime,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close)
    })).reverse();
  } catch (e) {
    console.error("Erro ao obter dados:", e);
    return [];
  }
}

async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDados();
    if (dados.length === 0) return;
    
    const closes = dados.map(v => v.close);
    const ema9 = calcularEMA(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema21 = calcularEMA(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema200 = calcularEMA(closes, CONFIG.PERIODOS.EMA_200);
    const rsi = calcularRSI(closes);
    const supertrend = calcularSupertrend(dados);
    
    // Lógica simplificada de decisão
    let score = 50;
    
    if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD) score += 25;
    else if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) score -= 25;
    
    if (supertrend.direcao === 1) score += 20;
    else if (supertrend.direcao === -1) score -= 20;
    
    if (closes[closes.length-1] > ema9 && ema9 > ema21) score += 15;
    else if (closes[closes.length-1] < ema9 && ema9 < ema21) score -= 15;
    
    score = Math.max(0, Math.min(100, score));
    
    const sinal = score >= CONFIG.LIMIARES.SCORE_ALTO ? 
                 (supertrend.direcao === 1 ? "CALL" : "PUT") : 
                 "ESPERAR";
    
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    atualizarInterface(sinal, score);
    
  } catch (e) {
    console.error("Erro na análise:", e);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// CONTROLE DE TEMPO
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  
  const agora = Date.now();
  const delay = 60000 - (agora % 60000);
  state.timer = Math.floor(delay/1000);
  
  const timerElement = document.getElementById("timer");
  timerElement.textContent = formatarTimer(state.timer);
  
  state.intervaloAtual = setInterval(() => {
    state.timer--;
    timerElement.textContent = formatarTimer(state.timer);
    
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado().finally(sincronizarTimer);
    }
  }, 1000);
}

// INICIALIZAÇÃO
function iniciar() {
  if (!document.getElementById("comando")) {
    setTimeout(iniciar, 100);
    return;
  }
  
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  analisarMercado();
}

document.addEventListener("DOMContentLoaded", iniciar);
