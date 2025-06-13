// =============================================
// CONFIGURAÇÕES GLOBAIS ATUALIZADAS
// =============================================
const config = {
  symbol: 'BTCUSDT',
  interval: '1m',
  rsiPeriod: 14,
  adxPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  smaPeriod: 9,
  emaShort: 21,
  emaLong: 50,
  minADX: 25,
  maxRSICall: 30,
  minRSIPut: 70,
  fractalPeriod: 5
};

let state = {
  wins: 0,
  losses: 0,
  lastUpdates: [],
  timer: 60,
  lastAnalysis: '',
  currentSignal: 'ESPERAR'
};

// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================
function formatTime(seconds) {
  return `0:${seconds.toString().padStart(2, '0')}`;
}

function updateClock() {
  const now = new Date();
  document.getElementById("hora").textContent = now.toLocaleTimeString("pt-BR", {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function registerResult(result) {
  result === 'WIN' ? state.wins++ : state.losses++;
  document.getElementById("historico").textContent = `${state.wins} WIN / ${state.losses} LOSS`;
}

// =============================================
// FUNÇÕES DE ANÁLISE TÉCNICA CORRIGIDAS
// =============================================
async function fetchMarketData() {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${config.symbol}&interval=${config.interval}&limit=100`);
    return await response.json();
  } catch (error) {
    console.error("Erro ao buscar dados:", error);
    return null;
  }
}

function calculateRSI(closes, period) {
  let gains = 0, losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i-1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  
  // Correção: Evitar divisão por zero
  const rs = losses === 0 ? Infinity : gains / losses;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(closes, fastPeriod, slowPeriod, signalPeriod) {
  // Correção: Cálculo mais preciso das EMAs
  function calcEMA(values, period) {
    const k = 2 / (period + 1);
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
    }
    return ema;
  }

  const emaFast = calcEMA(closes.slice(-fastPeriod * 3), fastPeriod);
  const emaSlow = calcEMA(closes.slice(-slowPeriod * 3), slowPeriod);
  const macdLine = emaFast - emaSlow;
  
  // Correção: Cálculo da linha de sinal como EMA do MACD
  const signalLine = calcEMA(closes.map((_, i) => 
    i >= slowPeriod ? macdLine : null
  ).filter(v => v !== null), signalPeriod);

  return {
    line: macdLine,
    signal: signalLine,
    histogram: macdLine - signalLine
  };
}

function detectFractals(highs, lows, period) {
  const fractals = [];
  for (let i = period; i < highs.length - period; i++) {
    // Correção: Verificação mais rigorosa de fractais
    const currentHigh = highs[i];
    const currentLow = lows[i];
    const highWindow = highs.slice(i - period, i + period + 1);
    const lowWindow = lows.slice(i - period, i + period + 1);
    
    if (currentHigh === Math.max(...highWindow)) {
      fractals.push({ type: "TOPO", index: i });
    } 
    if (currentLow === Math.min(...lowWindow)) {
      fractals.push({ type: "FUNDO", index: i });
    }
  }
  return fractals.length > 0 ? fractals[fractals.length - 1] : null;
}

// =============================================
// LÓGICA PRINCIPAL ATUALIZADA
// =============================================
async function analyzeMarket() {
  const rawData = await fetchMarketData();
  if (!rawData) return;

  const closes = rawData.map(c => parseFloat(c[4]));
  const highs = rawData.map(c => parseFloat(c[2]));
  const lows = rawData.map(c => parseFloat(c[3]));
  const currentPrice = closes[closes.length - 1];

  // Cálculo dos indicadores
  const rsi = calculateRSI(closes, config.rsiPeriod);
  const macd = calculateMACD(closes, config.macdFast, config.macdSlow, config.macdSignal);
  const sma = closes.slice(-config.smaPeriod).reduce((a, b) => a + b, 0) / config.smaPeriod;
  const emaShort = calculateEMA(closes, config.emaShort);
  const emaLong = calculateEMA(closes, config.emaLong);
  const lastFractal = detectFractals(highs, lows, config.fractalPeriod);

  // Lógica de decisão corrigida
  let signal = 'ESPERAR';
  
  // Condição CALL melhorada
  if (rsi < config.maxRSICall && 
      sma > emaShort && 
      emaShort > emaLong && 
      macd.histogram > 0 && 
      lastFractal?.type === "FUNDO") {
    signal = 'CALL';
  } 
  // Condição PUT melhorada
  else if (rsi > config.minRSIPut && 
           sma < emaShort && 
           emaShort < emaLong && 
           macd.histogram < 0 && 
           lastFractal?.type === "TOPO") {
    signal = 'PUT';
  }

  // Atualização do estado
  state.currentSignal = signal;
  state.lastAnalysis = new Date().toLocaleTimeString("pt-BR");

  // Atualização da interface
  updateInterface({
    price: currentPrice,
    rsi,
    macd: macd.histogram,
    sma,
    emaShort,
    emaLong,
    fractal: lastFractal?.type || 'Nenhum',
    signal
  });
}

function updateInterface(data) {
  // Atualiza os elementos da UI
  document.getElementById("comando").textContent = data.signal;
  document.getElementById("score").textContent = `RSI: ${data.rsi.toFixed(2)} | MACD: ${data.macd.toFixed(4)}`;
  
  document.getElementById("criterios").innerHTML = `
    <li>RSI: ${data.rsi.toFixed(2)} ${data.rsi < 30 ? "↓" : data.rsi > 70 ? "↑" : "-"}</li>
    <li>MACD: ${data.macd.toFixed(4)}</li>
    <li>Preço: $${data.price.toFixed(2)}</li>
    <li>Médias: ${data.sma.toFixed(2)} > ${data.emaShort.toFixed(2)} > ${data.emaLong.toFixed(2)}</li>
    <li>Fractal: ${data.fractal}</li>
  `;

  // Atualiza histórico
  state.lastUpdates.unshift(`${state.lastAnalysis} - ${data.signal} ($${data.price.toFixed(2)})`);
  if (state.lastUpdates.length > 5) state.lastUpdates.pop();
  
  document.getElementById("ultimos").innerHTML = 
    state.lastUpdates.map(item => `<li>${item}</li>`).join('');

  // Alertas sonoros
  if (data.signal === 'CALL') new Audio('call.mp3').play().catch(e => console.log("Erro no áudio:", e));
  if (data.signal === 'PUT') new Audio('put.mp3').play().catch(e => console.log("Erro no áudio:", e));
}

// =============================================
// INICIALIZAÇÃO DO SISTEMA
// =============================================
function init() {
  // Configura os intervalos
  setInterval(() => {
    state.timer--;
    document.getElementById("timer").textContent = formatTime(state.timer);
    if (state.timer <= 0) {
      analyzeMarket();
      state.timer = 60;
    }
  }, 1000);

  setInterval(updateClock, 1000);

  // Atualização rápida de preço
  setInterval(async () => {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${config.symbol}`);
      const data = await response.json();
      const priceElement = document.querySelector("#criterios li:nth-child(3)");
      if (priceElement) {
        priceElement.textContent = `Preço: $${parseFloat(data.lastPrice).toFixed(2)}`;
      }
    } catch (e) {
      console.log("Erro na atualização rápida:", e);
    }
  }, 5000);

  // Primeira execução
  updateClock();
  analyzeMarket();
}

// Inicia quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);
