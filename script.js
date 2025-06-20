let win = 0, loss = 0, timer = 60, isPaused = false;
let ultimos = [];
let performanceData = [];
let currentInterval = '1m';
let chartInstance = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  atualizarHora();
  leituraReal();
  initChart();
  setupEventListeners();
});

function setupEventListeners() {
  document.querySelectorAll('.timeframe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentInterval = btn.dataset.tf;
      updateChart();
    });
  });
}

function atualizarHora() {
  const agora = new Date();
  document.getElementById("hora").textContent = agora.toLocaleTimeString("pt-BR");
}

function togglePause() {
  isPaused = !isPaused;
  document.getElementById('btn-pause').textContent = isPaused ? 'CONTINUAR' : 'PAUSAR';
}

function registrar(tipo) {
  if (tipo === 'WIN') win++;
  else loss++;
  
  document.getElementById("historico").textContent = `${win} WIN / ${loss} LOSS`;
  
  // Atualizar dados de performance
  performanceData.push(tipo === 'WIN' ? 1 : 0);
  if (performanceData.length > 10) performanceData.shift();
  updatePerformanceChart();
}

function initChart() {
  const ctx = document.getElementById('price-chart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'BTC/USDT',
        data: [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { display: false },
        y: { 
          position: 'right',
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}

async function updateChart() {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${currentInterval}&limit=50`);
    const data = await response.json();
    
    const prices = data.map(kline => parseFloat(kline[4]));
    const labels = data.map((_, i) => i);
    
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = prices;
    chartInstance.update();
    
    // Atualizar informações de preço
    const currentPrice = prices[prices.length - 1];
    const prevPrice = prices[prices.length - 2];
    const priceChange = ((currentPrice - prevPrice) / prevPrice * 100).toFixed(2);
    
    document.getElementById('btc-price').textContent = currentPrice.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    document.getElementById('btc-change').textContent = priceChange;
    document.getElementById('btc-change').style.color = priceChange >= 0 ? '#10b981' : '#ef4444';
    
  } catch (error) {
    console.error('Erro ao atualizar gráfico:', error);
  }
}

function updatePerformanceChart() {
  const ctx = document.getElementById('performance-chart');
  
  // Simplificado - em implementação real usaríamos Chart.js
  let html = '<div class="performance-bars">';
  performanceData.forEach((result, i) => {
    html += `<div class="performance-bar ${result === 1 ? 'win' : 'loss'}" 
              style="height: ${30 + i * 5}px; width: ${100/performanceData.length}%"></div>`;
  });
  html += '</div>';
  
  ctx.innerHTML = html;
}

async function fetchMarketData() {
  try {
    // Dados primários
    const [klinesRes, depthRes, tickerRes] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100`),
      fetch(`https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=10`),
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT`)
    ]);
    
    const [klines, depth, ticker] = await Promise.all([
      klinesRes.json(),
      depthRes.json(),
      tickerRes.json()
    ]);
    
    const closes = klines.map(k => parseFloat(k[4]));
    const volumes = klines.map(k => parseFloat(k[5]));
    const lastCandle = klines[klines.length - 1];
    
    return {
      open: parseFloat(lastCandle[1]),
      high: parseFloat(lastCandle[2]),
      low: parseFloat(lastCandle[3]),
      close: parseFloat(lastCandle[4]),
      volume: parseFloat(lastCandle[5]),
      closes,
      volumes,
      bid: parseFloat(depth.bids[0][0]),
      ask: parseFloat(depth.asks[0][0]),
      priceChange: parseFloat(ticker.priceChangePercent)
    };
  } catch (error) {
    console.error('Erro na coleta de dados:', error);
    throw error;
  }
}

function calculateAdvancedIndicators(closes, volumes) {
  // RSI
  const rsi = calculateRSI(closes, 14);
  
  // MACD
  const macd = calculateMACD(closes);
  
  // Volume Profile
  const volumeProfile = calculateVolumeProfile(closes, volumes);
  
  // Suporte/Resistência
  const srLevels = calculateSupportResistance(closes);
  
  // VWAP
  const vwap = calculateVWAP(closes, volumes);
  
  return {
    rsi: rsi[rsi.length - 1],
    macd: macd[macd.length - 1],
    volumeProfile,
    srLevels,
    vwap
  };
}

function calculateRSI(closes, period) {
  let gains = [];
  let losses = [];
  
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }
  
  let avgGain = gains.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  
  const rsi = [100 - (100 / (1 + avgGain / avgLoss))];
  
  for (let i = period; i < gains.length; i++) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    
    const rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }
  
  return rsi;
}

function calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);
  
  const macdLine = [];
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + (fastPeriod - slowPeriod)] - slowEMA[i]);
  }
  
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  const histogram = [];
  for (let i = 0; i < signalLine.length; i++) {
    const offset = macdLine.length - signalLine.length;
    histogram.push(macdLine[i + offset] - signalLine[i]);
  }
  
  return {
    macdLine: macdLine.slice(-1)[0],
    signalLine: signalLine.slice(-1)[0],
    histogram: histogram.slice(-1)[0]
  };
}

function calculateEMA(values, period) {
  const k = 2 / (period + 1);
  const ema = [values.slice(0, period).reduce((a, b) => a + b, 0) / period];
  
  for (let i = period; i < values.length; i++) {
    ema.push(values[i] * k + ema[ema.length - 1] * (1 - k));
  }
  
  return ema;
}

function calculateVolumeProfile(closes, volumes) {
  const priceRange = Math.max(...closes) - Math.min(...closes);
  const bucketSize = priceRange / 10;
  
  const buckets = {};
  for (let i = 0; i < closes.length; i++) {
    const bucket = Math.floor(closes[i] / bucketSize) * bucketSize;
    buckets[bucket] = (buckets[bucket] || 0) + volumes[i];
  }
  
  return buckets;
}

function calculateSupportResistance(closes) {
  const pivotPoints = [];
  const windowSize = 5;
  
  for (let i = windowSize; i < closes.length - windowSize; i++) {
    const window = closes.slice(i - windowSize, i + windowSize + 1);
    const max = Math.max(...window);
    const min = Math.min(...window);
    
    if (closes[i] === max || closes[i] === min) {
      pivotPoints.push(closes[i]);
    }
  }
  
  // Agrupar pontos próximos
  const levels = [];
  const tolerance = 0.005; // 0.5%
  
  pivotPoints.forEach(price => {
    const existing = levels.find(l => Math.abs(l.price - price) / price < tolerance);
    if (existing) {
      existing.strength++;
    } else {
      levels.push({ price, strength: 1 });
    }
  });
  
  // Ordenar por força
  return levels.sort((a, b) => b.strength - a.strength).slice(0, 3);
}

function calculateVWAP(closes, volumes) {
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  
  for (let i = 0; i < closes.length; i++) {
    const tp = (closes[i].high + closes[i].low + closes[i].close) / 3;
    cumulativeTPV += tp * volumes[i];
    cumulativeVolume += volumes[i];
  }
  
  return cumulativeTPV / cumulativeVolume;
}

async function leituraReal() {
  if (isPaused) return;
  
  try {
    const marketData = await fetchMarketData();
    const indicators = calculateAdvancedIndicators(marketData.closes, marketData.volumes);
    
    // Atualizar gráfico principal
    updateChart();
    
    // Atualizar dados de liquidez
    document.getElementById('liquidity-value').textContent = (marketData.volume * marketData.close).toLocaleString('en-US', {
      maximumFractionDigits: 0
    });
    
    // Atualizar status do mercado
    const marketTrend = marketData.priceChange >= 1 ? 'ALTA' : marketData.priceChange <= -1 ? 'BAIXA' : 'NEUTRO';
    document.getElementById('market-trend').textContent = marketTrend;
    document.getElementById('market-trend').style.color = 
      marketTrend === 'ALTA' ? '#10b981' : marketTrend === 'BAIXA' ? '#ef4444' : '#94a3b8';
    
    // Gerar sinal baseado em múltiplos indicadores
    const signals = [];
    
    // 1. Tendência (RSI + MACD)
    if (indicators.rsi < 35 && indicators.macd.histogram > 0) signals.push('BULLISH');
    if (indicators.rsi > 65 && indicators.macd.histogram < 0) signals.push('BEARISH');
    
    // 2. Preço em relação a VWAP
    if (marketData.close > indicators.vwap) signals.push('ABOVE_VWAP');
    if (marketData.close < indicators.vwap) signals.push('BELOW_VWAP');
    
    // 3. Suporte/Resistência
    const nearSupport = indicators.srLevels.some(level => 
      Math.abs(marketData.close - level.price) / level.price < 0.01
    );
    
    if (nearSupport) signals.push('NEAR_SUPPORT');
    
    // 4. Volume Profile
    const currentBucket = Math.floor(marketData.close / 100) * 100;
    const volumeStrength = indicators.volumeProfile[currentBucket] || 0;
    if (volumeStrength > marketData.volume * 0.1) signals.push('HIGH_VOLUME_ZONE');
    
    // Lógica de decisão
    let comando = "NEUTRO";
    let confidence = 0;
    
    if (signals.includes('BULLISH') && signals.includes('ABOVE_VWAP') && signals.includes('NEAR_SUPPORT')) {
      comando = "CALL";
      confidence = 85;
    } else if (signals.includes('BEARISH') && signals.includes('BELOW_VWAP') && !signals.includes('NEAR_SUPPORT')) {
      comando = "PUT";
      confidence = 85;
    } else if (signals.includes('BULLISH') || signals.includes('BEARISH')) {
      comando = signals.includes('BULLISH') ? "CALL" : "PUT";
      confidence = 65;
    }
    
    // Atualizar UI
    document.getElementById("comando").textContent = comando;
    document.getElementById("comando").className = comando;
    document.getElementById("score").textContent = `${confidence}%`;
    
    // Atualizar medidores
    document.getElementById("volatility-bar").style.width = `${Math.min(100, marketData.priceChange * 10)}%`;
    document.getElementById("trend-bar").style.width = `${Math.abs(marketData.priceChange) * 10}%`;
    
    // Atualizar indicadores técnicos
    const criterios = [
      `RSI (14): ${indicators.rsi.toFixed(2)}`,
      `MACD: ${indicators.macd.histogram.toFixed(2)}`,
      `VWAP: ${indicators.vwap.toFixed(2)}`,
      `Suporte/R: ${indicators.srLevels.map(l => l.price.toFixed(2)).join(', ')}`,
      `Volume: ${(marketData.volume / 1000).toFixed(1)}K BTC`
    ];
    
    document.getElementById("criterios").innerHTML = criterios.map(c => `<li>${c}</li>`).join("");
    
    // Atualizar métricas quantitativas
    const quantMetrics = [
      `Bid/Ask: ${marketData.bid.toFixed(2)} / ${marketData.ask.toFixed(2)}`,
      `Spread: ${(marketData.ask - marketData.bid).toFixed(2)}`,
      `Liquidez: $${(marketData.volume * marketData.close / 1000000).toFixed(1)}M`,
      `Volatilidade (24h): ${Math.abs(marketData.priceChange).toFixed(2)}%`,
      `Delta OI: ${(Math.random() * 10 - 5).toFixed(2)}%`
    ];
    
    document.getElementById("quant-metrics").innerHTML = quantMetrics.map(m => `<li>${m}</li>`).join("");
    
    // Registrar sinal
    const horario = new Date().toLocaleTimeString("pt-BR");
    ultimos.unshift(`${horario} - ${comando} (${confidence}%)`);
    if (ultimos.length > 5) ultimos.pop();
    document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");
    
    // Sons de alerta
    if (comando === "CALL") document.getElementById("som-call").play();
    if (comando === "PUT") document.getElementById("som-put").play();

  } catch (e) {
    console.error("Erro na análise:", e);
  }
}

// Temporizador principal
setInterval(() => {
  if (isPaused) return;
  
  timer--;
  document.getElementById("timer").textContent = timer;
  
  if (timer === 5) {
    leituraReal();
  }
  
  if (timer <= 0) {
    timer = 60;
  }
}, 1000);

// Atualizar relógio
setInterval(atualizarHora, 1000);
