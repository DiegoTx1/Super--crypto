// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
const config = {
  symbol: 'BTCUSDT',
  interval: '1m',
  limit: 100,
  rsiPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  smaPeriod: 9,
  ema21Period: 21,
  ema50Period: 50,
  ema200Period: 200,
  adxPeriod: 14,
  fractalPeriod: 2,
  atrPeriod: 14,
  minADX: 20,
  maxRSI: 70,
  minRSI: 30,
  scoreThreshold: 0.7,
  updateInterval: 60000, // 1 minuto
  priceRefresh: 5000 // 5 segundos
};

let state = {
  win: 0,
  loss: 0,
  lastTrades: [],
  timer: 60,
  lastUpdate: "",
  lastPrice: 0,
  lastSignal: "NONE",
  indicatorsCache: {},
  isAnalyzing: false
};

// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================
function formatTime(date = new Date()) {
  return date.toLocaleTimeString("pt-BR", {
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit'
  });
}

function formatTimer(seconds) {
  return `0:${seconds.toString().padStart(2, '0')}`;
}

function registerTrade(outcome) {
  if (outcome === 'WIN') state.win++;
  else state.loss++;
  
  updateUI();
}

async function fetchData() {
  try {
    const [klinesResponse, tickerResponse] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/klines?symbol=${config.symbol}&interval=${config.interval}&limit=${config.limit}`),
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${config.symbol}`)
    ]);
    
    const [klines, ticker] = await Promise.all([
      klinesResponse.json(),
      tickerResponse.json()
    ]);
    
    return {
      klines,
      lastPrice: parseFloat(ticker.lastPrice),
      highPrice: parseFloat(ticker.highPrice),
      lowPrice: parseFloat(ticker.lowPrice),
      volume: parseFloat(ticker.volume)
    };
  } catch (error) {
    console.error("Erro ao buscar dados:", error);
    throw error;
  }
}

// =============================================
// INDICADORES TÉCNICOS OTIMIZADOS
// =============================================

function calculateEMA(data, period, previousEMA = null) {
  if (data.length < period) return null;
  
  const k = 2 / (period + 1);
  
  if (previousEMA !== null) {
    return data[data.length - 1] * k + previousEMA * (1 - k);
  }
  
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) {
    sum += data[i];
  }
  
  const initialEMA = sum / period;
  
  let ema = initialEMA;
  for (let i = data.length - period + 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  
  return ema;
}

function calculateRSI(closes, period = config.rsiPeriod) {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period || 1; // Evita divisão por zero

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(closes, fast = config.macdFast, slow = config.macdSlow, signal = config.macdSignal) {
  const fastEMA = calculateEMA(closes, fast);
  const slowEMA = calculateEMA(closes, slow);
  
  if (fastEMA === null || slowEMA === null) return { histogram: 0 };
  
  const macdLine = fastEMA - slowEMA;
  const signalLine = calculateEMA(closes.slice(-(slow + signal)), signal);
  const histogram = macdLine - signalLine;
  
  return { histogram };
}

function calculateADX(highs, lows, closes, period = config.adxPeriod) {
  if (highs.length < period * 2) return 0;

  const trs = [];
  const plusDMs = [];
  const minusDMs = [];

  for (let i = 1; i < highs.length; i++) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];
    
    plusDMs.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDMs.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
    
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }

  const smoothTR = calculateEMA(trs, period);
  const smoothPlusDM = calculateEMA(plusDMs, period);
  const smoothMinusDM = calculateEMA(minusDMs, period);

  const plusDI = 100 * (smoothPlusDM / smoothTR);
  const minusDI = 100 * (smoothMinusDM / smoothTR);

  const dx = 100 * Math.abs(plusDI - minusDI) / (plusDI + minusDI);
  const adx = calculateEMA(Array(period).fill(dx), period);

  return adx || 0;
}

function detectFractals(highs, lows, period = config.fractalPeriod) {
  if (highs.length < period * 2 + 1) return { top: false, bottom: false };

  const currentHigh = highs[highs.length - period - 1];
  const currentLow = lows[lows.length - period - 1];
  
  const highWindow = highs.slice(-period * 2 - 1);
  const lowWindow = lows.slice(-period * 2 - 1);
  
  const isTop = currentHigh === Math.max(...highWindow);
  const isBottom = currentLow === Math.min(...lowWindow);
  
  return { top: isTop, bottom: isBottom };
}

function calculateATR(highs, lows, closes, period = config.atrPeriod) {
  const trs = [];
  
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  
  return calculateEMA(trs, period) || 0;
}

// =============================================
// LÓGICA DE DECISÃO
// =============================================

function analyzeMarket(data) {
  const closes = data.klines.map(v => parseFloat(v[4]));
  const highs = data.klines.map(v => parseFloat(v[2]));
  const lows = data.klines.map(v => parseFloat(v[3]));
  
  // Calcular indicadores
  const rsi = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const sma9 = calculateEMA(closes, config.smaPeriod);
  const ema21 = calculateEMA(closes, config.ema21Period);
  const ema50 = calculateEMA(closes, config.ema50Period);
  const ema200 = calculateEMA(closes, config.ema200Period);
  const adx = calculateADX(highs, lows, closes);
  const fractals = detectFractals(highs, lows);
  const atr = calculateATR(highs, lows, closes);
  
  // Salvar para exibição
  state.indicatorsCache = {
    rsi, macd, sma9, ema21, ema50, ema200, adx, fractals, atr,
    price: data.lastPrice,
    volume: data.volume
  };
  
  // Sistema de pontuação
  let callScore = 0;
  let putScore = 0;
  const totalConditions = 7;
  
  // 1. Tendência geral (EMA200)
  const isUptrend = ema21 > ema200;
  const isDowntrend = ema21 < ema200;
  
  // 2. Condições para CALL
  if (rsi < config.maxRSI) callScore += 0.2;
  if (sma9 > ema21 && ema21 > ema50) callScore += 0.2;
  if (macd.histogram > 0) callScore += 0.1;
  if (fractals.bottom) callScore += 0.1;
  if (adx > config.minADX) callScore += 0.2;
  if (isUptrend) callScore += 0.1;
  if (data.volume > data.klines.slice(-24).reduce((a, v) => a + parseFloat(v[5]), 0) / 24) callScore += 0.1;
  
  // 3. Condições para PUT
  if (rsi > config.minRSI) putScore += 0.2;
  if (sma9 < ema21 && ema21 < ema50) putScore += 0.2;
  if (macd.histogram < 0) putScore += 0.1;
  if (fractals.top) putScore += 0.1;
  if (adx > config.minADX) putScore += 0.2;
  if (isDowntrend) putScore += 0.1;
  if (data.volume > data.klines.slice(-24).reduce((a, v) => a + parseFloat(v[5]), 0) / 24) putScore += 0.1;
  
  // Determinar sinal
  let signal = "NONE";
  if (callScore >= config.scoreThreshold && callScore > putScore) {
    signal = "CALL";
  } else if (putScore >= config.scoreThreshold && putScore > callScore) {
    signal = "PUT";
  }
  
  return signal;
}

// =============================================
// INTERFACE E CONTROLE
// =============================================

function updateUI() {
  document.getElementById("historico").textContent = `${state.win} WIN / ${state.loss} LOSS`;
  document.getElementById("hora").textContent = state.lastUpdate;
  document.getElementById("timer").textContent = formatTimer(state.timer);
  document.getElementById("comando").textContent = state.lastSignal;
  
  const { indicatorsCache } = state;
  document.getElementById("criterios").innerHTML = `
    <li>Preço: $${indicatorsCache.price?.toFixed(2) || '0.00'}</li>
    <li>Volume: ${(indicatorsCache.volume || 0).toFixed(2)}</li>
    <li>RSI: ${(indicatorsCache.rsi || 0).toFixed(2)}</li>
    <li>ADX: ${(indicatorsCache.adx || 0).toFixed(2)}</li>
    <li>MACD: ${(indicatorsCache.macd?.histogram.toFixed(4) || '0.0000'}</li>
    <li>Médias: ${(indicatorsCache.sma9 || 0).toFixed(2)} / ${(indicatorsCache.ema21 || 0).toFixed(2)} / ${(indicatorsCache.ema50 || 0).toFixed(2)}</li>
    <li>Fractal: ${indicatorsCache.fractals?.top ? 'TOPO' : indicatorsCache.fractals?.bottom ? 'FUNDO' : 'NENHUM'}</li>
    <li>ATR: ${(indicatorsCache.atr || 0).toFixed(2)}</li>
  `;
  
  if (state.lastTrades.length > 0) {
    document.getElementById("ultimos").innerHTML = 
      state.lastTrades.map(trade => `<li>${trade}</li>`).join('');
  }
}

async function performAnalysis() {
  if (state.isAnalyzing) return;
  
  state.isAnalyzing = true;
  state.lastUpdate = formatTime();
  
  try {
    const marketData = await fetchData();
    state.lastPrice = marketData.lastPrice;
    
    const signal = analyzeMarket(marketData);
    state.lastSignal = signal;
    
    if (signal !== "NONE") {
      state.lastTrades.unshift(`${state.lastUpdate} - ${signal} ($${marketData.lastPrice.toFixed(2)})`);
      if (state.lastTrades.length > 5) state.lastTrades.pop();
      
      try {
        const audioElement = document.getElementById(`som-${signal.toLowerCase()}`);
        if (audioElement) await audioElement.play();
      } catch (e) {
        console.warn("Erro ao reproduzir som:", e);
      }
    }
    
    updateUI();
  } catch (error) {
    console.error("Erro na análise:", error);
    document.getElementById("comando").textContent = "ERRO";
  } finally {
    state.isAnalyzing = false;
  }
}

function startTimer() {
  state.timer = 60;
  
  const timerInterval = setInterval(() => {
    state.timer--;
    document.getElementById("timer").textContent = formatTimer(state.timer);
    
    if (state.timer <= 0) {
      performAnalysis();
      state.timer = 60;
    }
  }, 1000);
  
  return timerInterval;
}

// =============================================
// INICIALIZAÇÃO
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  // Iniciar relógio
  setInterval(() => {
    document.getElementById("hora").textContent = formatTime();
  }, 1000);
  
  // Iniciar timer de análise
  startTimer();
  
  // Atualização rápida de preço
  setInterval(async () => {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${config.symbol}`);
      const data = await response.json();
      state.lastPrice = parseFloat(data.lastPrice);
      
      // Atualizar apenas o preço na UI sem refazer toda a análise
      const priceElement = document.getElementById("criterios").querySelector("li:nth-child(1)");
      if (priceElement) {
        priceElement.textContent = `Preço: $${state.lastPrice.toFixed(2)}`;
      }
    } catch (e) {
      console.error("Erro ao atualizar preço:", e);
    }
  }, config.priceRefresh);
  
  // Primeira análise
  performAnalysis();
});
