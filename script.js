// =============================================
// CONFIGURAÇÕES GLOBAIS
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
  emaShortPeriod: 21,
  emaLongPeriod: 50,
  minADX: 20,
  maxRSICall: 35,
  minRSIPut: 65,
  minVolume: 50,
  stopLossPercent: 1,
  takeProfitPercent: 2,
  maxDailyTrades: 10
};

let stats = {
  wins: 0,
  losses: 0,
  tradesToday: 0,
  lastTrade: null,
  activeTrade: null,
  tradeHistory: []
};

let marketData = {
  lastUpdate: '',
  lastPrice: 0,
  indicators: {}
};

// =============================================
// FUNÇÕES PRINCIPAIS
// =============================================

async function runBot() {
  try {
    // 1. Obter dados do mercado
    const candles = await fetchBinanceData();
    
    // 2. Calcular indicadores
    calculateIndicators(candles);
    
    // 3. Verificar operação ativa
    if (stats.activeTrade) {
      checkTradeExit();
      return;
    }
    
    // 4. Verificar novos sinais
    checkTradeSignals();
    
  } catch (error) {
    console.error('Erro no bot:', error);
    updateUI('status', 'ERRO');
  }
}

// =============================================
// FUNÇÕES DE DADOS
// =============================================

async function fetchBinanceData() {
  const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${config.symbol}&interval=${config.interval}&limit=100`);
  return await response.json();
}

// =============================================
// FUNÇÕES DE INDICADORES
// =============================================

function calculateIndicators(candles) {
  const closes = candles.map(c => parseFloat(c[4]));
  const highs = candles.map(c => parseFloat(c[2]));
  const lows = candles.map(c => parseFloat(c[3]));
  const volumes = candles.map(c => parseFloat(c[5]));
  
  // Atualiza o último preço
  marketData.lastPrice = closes[closes.length - 1];
  
  // Calcula indicadores
  marketData.indicators = {
    rsi: calculateRSI(closes, config.rsiPeriod),
    macd: calculateMACD(closes, config.macdFast, config.macdSlow, config.macdSignal),
    sma: calculateSMA(closes, config.smaPeriod),
    emaShort: calculateEMA(closes, config.emaShortPeriod),
    emaLong: calculateEMA(closes, config.emaLongPeriod),
    adx: calculateADX(highs, lows, closes, config.adxPeriod),
    volume: volumes[volumes.length - 1],
    avgVolume: calculateAverageVolume(volumes, 20),
    pattern: identifyCandlePattern(candles.slice(-3)),
    fractal: detectFractals(highs, lows, 5)
  };
  
  // Atualiza interface
  updateUI();
}

function calculateRSI(closes, period) {
  let gains = 0, losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i-1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(closes, fast, slow, signal) {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  const macdLine = emaFast - emaSlow;
  const signalLine = calculateEMA(closes.map((_, i) => i >= slow ? macdLine : 0), signal);
  
  return {
    line: macdLine,
    signal: signalLine,
    histogram: macdLine - signalLine
  };
}

function calculateSMA(data, period) {
  const slice = data.slice(-period);
  return slice.reduce((sum, val) => sum + val, 0) / period;
}

function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateADX(highs, lows, closes, period) {
  // Implementação simplificada - considere usar uma biblioteca para cálculo preciso
  const range = Math.max(...highs.slice(-period)) - Math.min(...lows.slice(-period));
  return (range / Math.max(1, Math.min(...closes.slice(-period)))) * 10;
}

function calculateAverageVolume(volumes, period) {
  const slice = volumes.slice(-period);
  return slice.reduce((sum, vol) => sum + vol, 0) / period;
}

function identifyCandlePattern(candles) {
  const [c1, c2, c3] = candles.map(c => ({
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4])
  }));
  
  // Padrões de reversão
  if (c3.close > c3.open && 
      (c3.high - c3.close) / (c3.close - c3.open) < 0.3 &&
      (c3.close - c3.low) > 2 * (c3.close - c3.open)) {
    return 'HAMMER';
  }
  
  if (c3.open > c3.close &&
      (c3.high - c3.open) > 2 * (c3.open - c3.close) &&
      (c3.close - c3.low) / (c3.open - c3.close) < 0.3) {
    return 'SHOOTING_STAR';
  }
  
  return null;
}

function detectFractals(highs, lows, period) {
  const fractals = [];
  
  for (let i = period; i < highs.length - period; i++) {
    if (highs[i] === Math.max(...highs.slice(i - period, i + period + 1))) {
      fractals.push({ type: 'TOP', index: i });
    } else if (lows[i] === Math.min(...lows.slice(i - period, i + period + 1))) {
      fractals.push({ type: 'BOTTOM', index: i });
    }
  }
  
  return fractals[fractals.length - 1]?.type || null;
}

// =============================================
// FUNÇÕES DE NEGOCIAÇÃO
// =============================================

function checkTradeSignals() {
  const { indicators } = marketData;
  let signal = 'WAIT';
  
  // Condição para CALL
  if (indicators.rsi < config.maxRSICall &&
      indicators.sma > indicators.emaShort &&
      indicators.emaShort > indicators.emaLong &&
      indicators.macd.histogram > 0 &&
      (indicators.fractal === 'BOTTOM' || indicators.pattern === 'HAMMER') &&
      indicators.adx > config.minADX &&
      indicators.volume > config.minVolume) {
    signal = 'CALL';
  }
  
  // Condição para PUT
  else if (indicators.rsi > config.minRSIPut &&
           indicators.sma < indicators.emaShort &&
           indicators.emaShort < indicators.emaLong &&
           indicators.macd.histogram < 0 &&
           (indicators.fractal === 'TOP' || indicators.pattern === 'SHOOTING_STAR') &&
           indicators.adx > config.minADX &&
           indicators.volume > config.minVolume) {
    signal = 'PUT';
  }
  
  if (signal !== 'WAIT' && stats.tradesToday < config.maxDailyTrades) {
    executeTrade(signal);
  }
  
  updateUI('signal', signal);
}

function executeTrade(type) {
  const trade = {
    type,
    entry: marketData.lastPrice,
    exit: null,
    timestamp: new Date().toLocaleString(),
    result: null,
    stopLoss: type === 'CALL' 
      ? marketData.lastPrice * (1 - config.stopLossPercent/100)
      : marketData.lastPrice * (1 + config.stopLossPercent/100),
    takeProfit: type === 'CALL'
      ? marketData.lastPrice * (1 + config.takeProfitPercent/100)
      : marketData.lastPrice * (1 - config.takeProfitPercent/100)
  };
  
  stats.activeTrade = trade;
  stats.tradesToday++;
  
  // Play sound
  playSound(type.toLowerCase());
  
  // Update UI
  updateUI();
}

function checkTradeExit() {
  const { activeTrade } = stats;
  const currentPrice = marketData.lastPrice;
  
  if (!activeTrade) return;
  
  // Verifica se atingiu SL ou TP
  if ((activeTrade.type === 'CALL' && (currentPrice <= activeTrade.stopLoss || currentPrice >= activeTrade.takeProfit)) ||
      (activeTrade.type === 'PUT' && (currentPrice >= activeTrade.stopLoss || currentPrice <= activeTrade.takeProfit))) {
    closeTrade(currentPrice);
  }
}

function closeTrade(exitPrice) {
  const trade = stats.activeTrade;
  trade.exit = exitPrice;
  
  const pnl = trade.type === 'CALL'
    ? (exitPrice - trade.entry) / trade.entry * 100
    : (trade.entry - exitPrice) / trade.entry * 100;
  
  trade.result = pnl > 0 ? 'WIN' : 'LOSS';
  
  if (pnl > 0) stats.wins++;
  else stats.losses++;
  
  stats.tradeHistory.unshift(trade);
  if (stats.tradeHistory.length > 100) stats.tradeHistory.pop();
  
  stats.activeTrade = null;
  
  updateUI();
}

// =============================================
// FUNÇÕES DE INTERFACE
// =============================================

function updateUI(elementId, value) {
  if (elementId && value) {
    // Atualização específica
    document.getElementById(elementId).textContent = value;
    return;
  }
  
  // Atualização completa da interface
  const now = new Date();
  marketData.lastUpdate = now.toLocaleTimeString();
  
  // Atualiza relógio
  document.getElementById('time').textContent = now.toLocaleTimeString();
  
  // Atualiza indicadores
  document.getElementById('price').textContent = marketData.lastPrice.toFixed(2);
  document.getElementById('rsi').textContent = marketData.indicators.rsi.toFixed(2);
  document.getElementById('adx').textContent = marketData.indicators.adx.toFixed(2);
  document.getElementById('macd').textContent = marketData.indicators.macd.histogram.toFixed(4);
  
  // Atualiza status
  if (stats.activeTrade) {
    document.getElementById('status').textContent = 
      `${stats.activeTrade.type} ATIVO | Entrada: ${stats.activeTrade.entry.toFixed(2)}`;
  } else {
    document.getElementById('status').textContent = 'AGUARDANDO SINAL';
  }
  
  // Atualiza histórico
  document.getElementById('stats').innerHTML = `
    <div>Wins: ${stats.wins}</div>
    <div>Losses: ${stats.losses}</div>
    <div>Trades hoje: ${stats.tradesToday}/${config.maxDailyTrades}</div>
  `;
}

function playSound(type) {
  const audio = new Audio(`${type}.mp3`);
  audio.play().catch(e => console.error('Erro ao reproduzir som:', e));
}

// =============================================
// INICIALIZAÇÃO
// =============================================

// Configura intervalos
function init() {
  // Atualiza a cada minuto
  setInterval(runBot, 60000);
  
  // Verifica saída a cada 15 segundos
  setInterval(() => {
    if (stats.activeTrade) checkTradeExit();
  }, 15000);
  
  // Primeira execução
  runBot();
}

// Inicia quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', init);
