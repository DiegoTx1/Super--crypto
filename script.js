// =============================================
// CONFIGURAÇÕES GLOBAIS (COM SUA INTERFACE ORIGINAL)
// =============================================
const state = {
  win: 0,
  loss: 0,
  ultimos: [],
  timer: 60,
  ultimaAtualizacao: "",
  leituraEmAndamento: false,
  intervaloAtual: null,
  tentativasErro: 0
};

const CONFIG = {
  API_ENDPOINTS: [
    "https://api.binance.com/api/v3",
    "https://api1.binance.com/api/v3", 
    "https://api2.binance.com/api/v3",
    "https://api3.binance.com/api/v3"
  ],
  PERIODOS: {
    RSI: 14,
    STOCH: 14,
    WILLIAMS: 14,
    EMA_CURTA: 21,
    EMA_LONGA: 50,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9
  }
};

// =============================================
// FUNÇÕES BÁSICAS (MANTIDAS DA SUA INTERFACE ORIGINAL)
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    elementoHora.textContent = new Date().toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

// =============================================
// INDICADORES TÉCNICOS (VERSÃO ORIGINAL CORRIGIDA)
// =============================================
function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (!Array.isArray(closes) || closes.length < periodo + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / periodo;
  let avgLoss = losses / periodo || 0.001;
  const rs = avgGain / avgLoss;
  
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, periodo = CONFIG.PERIODOS.STOCH) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo) return { k: 50, d: 50 };
    
    const kValues = [];
    for (let i = periodo-1; i < closes.length; i++) {
      const highestHigh = Math.max(...highs.slice(i-periodo+1, i+1));
      const lowestLow = Math.min(...lows.slice(i-periodo+1, i+1));
      kValues.push(((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100);
    }
    
    const dValues = kValues.length >= 3 ? 
      calcularMedia.simples(kValues.slice(-3), 3) : 
      50;
    
    return {
      k: kValues[kValues.length-1] || 50,
      d: dValues || 50
    };
  } catch (e) {
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return null;
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  },

  exponencial: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return [];
    
    const k = 2 / (periodo + 1);
    const emaArray = [calcularMedia.simples(dados.slice(0, periodo), periodo)];
    
    for (let i = periodo; i < dados.length; i++) {
      emaArray.push(dados[i] * k + emaArray[i - periodo] * (1 - k));
    }
    
    return emaArray;
  }
};

// =============================================
// CORE DO SISTEMA (VERSÃO ORIGINAL FUNCIONAL)
// =============================================
async function obterDadosBinance() {
  for (const endpoint of CONFIG.API_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}/klines?symbol=BTCUSDT&interval=1m&limit=150`);
      if (!response.ok) continue;
      const dados = await response.json();
      if (Array.isArray(dados) && dados.length > 50) {
        return dados.filter(v => Array.isArray(v) && v.length >= 6);
      }
    } catch (e) {
      console.error(`Erro no endpoint ${endpoint}:`, e);
    }
  }
  throw new Error("Todos os endpoints falharam");
}

async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;

  try {
    const dados = await obterDadosBinance();
    const velaAtual = dados[dados.length - 1];
    
    const closes = dados.map(v => parseFloat(v[4]));
    const highs = dados.map(v => parseFloat(v[2]));
    const lows = dados.map(v => parseFloat(v[3]));
    const volumes = dados.map(v => parseFloat(v[5]));

    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      sma9: calcularMedia.simples(closes, 9),
      ema21: calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).slice(-1)[0],
      ema50: calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA).slice(-1)[0],
      volume: parseFloat(velaAtual[5]),
      volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME),
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      close: parseFloat(velaAtual[4]),
      tendencia: avaliarTendencia(closes, 
        calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).slice(-1)[0],
        calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA).slice(-1)[0])
    };

    const score = calcularScoreConfianca(indicadores);
    const sinal = determinarSinal(score, indicadores.tendencia);

    // ATUALIZAÇÃO DA INTERFACE (IGUAL À SUA VERSÃO)
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    document.getElementById("comando").textContent = sinal;
    document.getElementById("score").textContent = `Confiança: ${score}%`;
    document.getElementById("hora").textContent = state.ultimaAtualizacao;

    document.getElementById("criterios").innerHTML = `
      <li>Tendência: ${indicadores.tendencia}</li>
      <li>RSI: ${indicadores.rsi.toFixed(2)}</li>
      <li>MACD: ${indicadores.macd.histograma.toFixed(4)}</li>
      <li>Stochastic: K ${indicadores.stoch.k.toFixed(2)} / D ${indicadores.stoch.d.toFixed(2)}</li>
      <li>Williams: ${indicadores.williams.toFixed(2)}</li>
      <li>Preço: $${indicadores.close.toFixed(2)}</li>
      <li>Médias: SMA9 ${indicadores.sma9?.toFixed(2) || 'N/A'} | EMA21 ${indicadores.ema21.toFixed(2)} | EMA50 ${indicadores.ema50.toFixed(2)}</li>
      <li>Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)}</li>
    `;

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 5) state.ultimos.pop();
    document.getElementById("ultimos").innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");

  } catch (e) {
    console.error("Erro na análise:", e);
    document.getElementById("comando").textContent = "ERRO";
    document.getElementById("score").textContent = "Confiança: 0%";
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO (VERSÃO ORIGINAL)
// =============================================
function iniciarTimer() {
  clearInterval(state.intervaloAtual);

  const agora = Date.now();
  const delayProximaVela = 60000 - (agora % 60000);
  state.timer = Math.max(1, Math.floor(delayProximaVela / 1000));

  const elementoTimer = document.getElementById("timer");
  if (elementoTimer) {
    elementoTimer.textContent = formatarTimer(state.timer);
    elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
  }

  state.intervaloAtual = setInterval(() => {
    state.timer--;
    if (elementoTimer) {
      elementoTimer.textContent = formatarTimer(state.timer);
      elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
    }
    
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado().finally(iniciarTimer);
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO (VERSÃO ORIGINAL)
// =============================================
function iniciarAplicativo() {
  setInterval(atualizarRelogio, 1000);
  iniciarTimer();
  analisarMercado();

  // Atualização de preço em tempo real
  setInterval(async () => {
    try {
      const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
      if (!response.ok) return;
      const dados = await response.json();
      const precoElement = document.querySelector("#criterios li:nth-child(6)");
      if (precoElement && dados.lastPrice) {
        precoElement.textContent = `Preço: $${parseFloat(dados.lastPrice).toFixed(2)}`;
      }
    } catch (e) {
      console.error("Erro ao atualizar preço:", e);
    }
  }, 5000);
}

document.addEventListener('DOMContentLoaded', iniciarAplicativo);
