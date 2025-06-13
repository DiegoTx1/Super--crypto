// =============================================
// CÓDIGO CORRIGIDO - TX1 LITE PRO (EMISSÃO DE SINAIS)
// =============================================

const config = {
  symbol: 'BTCUSDT',
  interval: '1m',
  rsiPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  smaPeriod: 9,
  emaShortPeriod: 21,
  emaLongPeriod: 50,
  minADX: 25,
  rsiOverbought: 70,
  rsiOversold: 30,
  fractalPeriod: 5
};

let state = {
  wins: 0,
  losses: 0,
  lastSignals: [],
  currentSignal: 'AGUARDANDO',
  lastPrice: 0
};

// =============================================
// FUNÇÕES PRINCIPAIS CORRIGIDAS
// =============================================

async function fetchMarketData() {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${config.symbol}&interval=${config.interval}&limit=100`);
    const data = await response.json();
    return {
      closes: data.map(c => parseFloat(c[4])),
      highs: data.map(c => parseFloat(c[2])),
      lows: data.map(c => parseFloat(c[3]))
    };
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
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
  
  const relativeStrength = losses === 0 ? Infinity : gains / losses;
  return 100 - (100 / (1 + relativeStrength));
}

function calculateEMA(values, period) {
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateMACD(closes) {
  const ema12 = calculateEMA(closes.slice(-50), config.macdFast);
  const ema26 = calculateEMA(closes.slice(-100), config.macdSlow);
  const macdLine = ema12 - ema26;
  const signalLine = calculateEMA(closes.slice(-100).map((_, i) => 
    i >= config.macdSlow ? macdLine : null
  ).filter(v => v !== null), config.macdSignal);
  
  return {
    line: macdLine,
    signal: signalLine,
    histogram: macdLine - signalLine
  };
}

function detectFractal(highs, lows, period) {
  const lastIndex = highs.length - 1;
  const start = Math.max(0, lastIndex - period);
  const end = Math.min(highs.length - 1, lastIndex + period);
  
  const currentHigh = highs[lastIndex];
  const currentLow = lows[lastIndex];
  
  const isTop = currentHigh === Math.max(...highs.slice(start, end + 1));
  const isBottom = currentLow === Math.min(...lows.slice(start, end + 1));
  
  return isTop ? 'TOPO' : isBottom ? 'FUNDO' : null;
}

async function checkForSignals() {
  const marketData = await fetchMarketData();
  if (!marketData) return;
  
  const { closes, highs, lows } = marketData;
  state.lastPrice = closes[closes.length - 1];
  
  // Cálculo dos indicadores
  const rsi = calculateRSI(closes, config.rsiPeriod);
  const macd = calculateMACD(closes);
  const sma = calculateEMA(closes.slice(-config.smaPeriod * 3), config.smaPeriod);
  const emaShort = calculateEMA(closes.slice(-config.emaShortPeriod * 3), config.emaShortPeriod);
  const emaLong = calculateEMA(closes.slice(-config.emaLongPeriod * 3), config.emaLongPeriod);
  const fractal = detectFractal(highs, lows, config.fractalPeriod);
  
  // Lógica de decisão simplificada e corrigida
  let signal = 'AGUARDANDO';
  
  // Condição para CALL
  if (rsi < config.rsiOversold && 
      macd.histogram > 0 && 
      sma > emaShort && 
      emaShort > emaLong) {
    signal = 'CALL';
  } 
  // Condição para PUT
  else if (rsi > config.rsiOverbought && 
           macd.histogram < 0 && 
           sma < emaShort && 
           emaShort < emaLong) {
    signal = 'PUT';
  }
  
  // Atualiza estado e interface
  state.currentSignal = signal;
  updateInterface({
    signal,
    price: state.lastPrice,
    rsi,
    macd: macd.histogram,
    sma,
    emaShort,
    emaLong,
    fractal
  });
  
  // Registra sinal válido
  if (signal !== 'AGUARDANDO') {
    registerSignal(signal, state.lastPrice);
  }
}

function registerSignal(type, price) {
  state.lastSignals.unshift({
    type,
    price,
    time: new Date().toLocaleTimeString()
  });
  
  if (state.lastSignals.length > 5) {
    state.lastSignals.pop();
  }
  
  // Play sound
  playSound(type.toLowerCase());
}

function playSound(type) {
  try {
    const audio = new Audio(`${type}.mp3`);
    audio.play().catch(e => console.log('Erro no áudio:', e));
  } catch (e) {
    console.log('Erro ao reproduzir som:', e);
  }
}

function updateInterface(data) {
  // Atualiza os elementos principais
  document.getElementById('signal').textContent = data.signal;
  document.getElementById('price').textContent = data.price.toFixed(2);
  document.getElementById('rsi-value').textContent = data.rsi.toFixed(2);
  document.getElementById('macd-value').textContent = data.macd.toFixed(4);
  
  // Atualiza histórico
  const signalsHtml = state.lastSignals.map(s => 
    `<li>${s.time} - ${s.type} @ ${s.price.toFixed(2)}</li>`
  ).join('');
  
  document.getElementById('signal-history').innerHTML = signalsHtml || '<li>Nenhum sinal recente</li>';
  
  // Destaque visual
  if (data.signal === 'CALL') {
    document.getElementById('signal').style.color = 'green';
  } else if (data.signal === 'PUT') {
    document.getElementById('signal').style.color = 'red';
  } else {
    document.getElementById('signal').style.color = 'gray';
  }
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function init() {
  // Verifica sinais a cada minuto
  setInterval(checkForSignals, 60000);
  
  // Atualização rápida de preço a cada 15 segundos
  setInterval(async () => {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${config.symbol}`);
      const data = await response.json();
      state.lastPrice = parseFloat(data.price);
      document.getElementById('price').textContent = state.lastPrice.toFixed(2);
    } catch (e) {
      console.log('Erro na atualização de preço:', e);
    }
  }, 15000);
  
  // Primeira execução
  checkForSignals();
}

document.addEventListener('DOMContentLoaded', init);
