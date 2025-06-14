// =============================================
// MÓDULOS PRINCIPAIS
// =============================================

class TechnicalIndicators {
  static rsi(closes, periodo = 14) {
    if (!Array.isArray(closes) return 50;
    if (closes.length < periodo + 1) return 50;

    let gains = 0, losses = 0;
    for (let i = 1; i <= periodo; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }

    let avgGain = gains / periodo;
    let avgLoss = losses / periodo || 0.001;

    for (let i = periodo + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * (periodo - 1) + gain) / periodo;
      avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
    }

    if (avgLoss <= 0.001) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  static ema(values, periodo, smoothing = 2) {
    if (!Array.isArray(values) return [];
    if (values.length < periodo) return [];

    const k = smoothing / (periodo + 1);
    const ema = [values.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo];

    for (let i = periodo; i < values.length; i++) {
      ema.push(values[i] * k + ema[ema.length - 1] * (1 - k));
    }

    return ema;
  }

  static macd(closes, rapida = 12, lenta = 26, sinal = 9) {
    try {
      if (!Array.isArray(closes) return { histograma: 0, macd: 0, signal: 0 };
      if (closes.length < lenta + sinal) return { histograma: 0, macd: 0, signal: 0 };

      const ema12 = this.ema(closes, rapida);
      const ema26 = this.ema(closes, lenta);
      
      if (!ema12 || !ema26) return { histograma: 0, macd: 0, signal: 0 };

      const macdLine = [];
      const start = Math.max(rapida, lenta);

      for (let i = start; i < closes.length; i++) {
        macdLine.push(ema12[i] - ema26[i]);
      }

      const signalLine = this.ema(macdLine, sinal);
      
      const lastMACD = macdLine[macdLine.length - 1] || 0;
      const lastSignal = signalLine[signalLine.length - 1] || 0;
      
      return {
        histograma: lastMACD - lastSignal,
        macd: lastMACD,
        signal: lastSignal
      };
    } catch (e) {
      console.error("MACD calculation error:", e);
      return { histograma: 0, macd: 0, signal: 0 };
    }
  }

  static sma(values, periodo) {
    if (!Array.isArray(values)) return null;
    if (values.length < periodo) return null;
    return values.slice(-periodo).reduce((a, b) => a + b, 0) / periodo;
  }

  static adx(highs, lows, closes, periodo = 14) {
    try {
      if (!Array.isArray(highs) || highs.length < periodo * 2) return 0;

      const trs = [], plusDMs = [], minusDMs = [];
      for (let i = 1; i < highs.length; i++) {
        const tr = Math.max(
          highs[i] - lows[i],
          Math.abs(highs[i] - closes[i - 1]),
          Math.abs(lows[i] - closes[i - 1])
        );
        trs.push(tr);

        const highDiff = highs[i] - highs[i - 1];
        const lowDiff = lows[i - 1] - lows[i];
        plusDMs.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
        minusDMs.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
      }

      const atr = this.ema(trs, periodo);
      const plusDI = this.ema(plusDMs, periodo).map((val, i) => 100 * val / (atr[i] || 1));
      const minusDI = this.ema(minusDMs, periodo).map((val, i) => 100 * val / (atr[i] || 1));

      const dx = plusDI.map((val, i) => {
        const sum = val + minusDI[i];
        return sum ? 100 * Math.abs(val - minusDI[i]) / sum : 0;
      });

      return this.ema(dx, periodo).pop() || 0;
    } catch (e) {
      console.error("ADX calculation error:", e);
      return 0;
    }
  }

  static fractal(highs, lows, periodo = 3) {
    try {
      if (!Array.isArray(highs) return null;
      if (highs.length < periodo * 2 + 1) return null;

      for (let i = periodo; i < highs.length - periodo; i++) {
        const highWindow = highs.slice(i - periodo, i + periodo + 1);
        const lowWindow = lows.slice(i - periodo, i + periodo + 1);
        
        if (highs[i] === Math.max(...highWindow)) {
          return { type: "TOP", index: i, confirmed: i <= highs.length - 2 };
        }
        if (lows[i] === Math.min(...lowWindow)) {
          return { type: "BOTTOM", index: i, confirmed: i <= highs.length - 2 };
        }
      }
      return null;
    } catch (e) {
      console.error("Fractal detection error:", e);
      return null;
    }
  }

  static atr(highs, lows, closes, periodo = 14) {
    try {
      if (!Array.isArray(highs)) return 0;
      
      const trs = [];
      for (let i = 1; i < highs.length; i++) {
        trs.push(Math.max(
          highs[i] - lows[i],
          Math.abs(highs[i] - closes[i - 1]),
          Math.abs(lows[i] - closes[i - 1])
        ));
      }
      
      return this.sma(trs, periodo) || 0;
    } catch (e) {
      console.error("ATR calculation error:", e);
      return 0;
    }
  }
}

class TradingEngine {
  constructor() {
    this.wins = 0;
    this.losses = 0;
    this.history = [];
    this.lastUpdate = "";
    this.isProcessing = false;
    this.currentInterval = null;
    this.timer = 60;
    this.apiRetryCount = 0;
    this.maxRetries = 5;
  }

  async fetchMarketData() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100", {
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      this.apiRetryCount = 0;

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid response format");

      return data
        .filter(item => Array.isArray(item) && item.length >= 6)
        .map(item => ({
          time: item[0],
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5])
        }));
    } catch (error) {
      console.error("API Error:", error);
      this.apiRetryCount++;
      
      if (this.apiRetryCount <= this.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, this.apiRetryCount), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchMarketData();
      }
      
      throw new Error("Max retries reached");
    } finally {
      this.isProcessing = false;
    }
  }

  analyzeData(data) {
    if (!data || data.length < 50) return null;

    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);
    const currentPrice = closes[closes.length - 1];

    // Calcula indicadores
    const rsi = TechnicalIndicators.rsi(closes);
    const macd = TechnicalIndicators.macd(closes);
    const sma9 = TechnicalIndicators.sma(closes, 9);
    const ema21 = TechnicalIndicators.ema(closes, 21).pop() || 0;
    const ema50 = TechnicalIndicators.ema(closes, 50).pop() || 0;
    const adx = TechnicalIndicators.adx(highs, lows, closes);
    const fractal = TechnicalIndicators.fractal(highs, lows);
    const avgVolume = TechnicalIndicators.sma(volumes, 20) || 0;
    const atr = TechnicalIndicators.atr(highs, lows, closes);

    // Sistema de pontuação
    let callScore = 0;
    let putScore = 0;

    // Regras de tendência
    const trendUp = ema21 > ema50 && currentPrice > ema21;
    const trendDown = ema21 < ema50 && currentPrice < ema21;

    // Regras de entrada
    if (rsi < 30 && trendUp) callScore += 2;
    if (rsi > 70 && trendDown) putScore += 2;

    if (macd.histograma > 0 && macd.macd > macd.signal) callScore += 2;
    if (macd.histograma < 0 && macd.macd < macd.signal) putScore += 2;

    if (sma9 > ema21 && trendUp) callScore += 1;
    if (sma9 < ema21 && trendDown) putScore += 1;

    if (fractal?.type === "BOTTOM" && volumes[volumes.length - 1] > avgVolume * 1.2) callScore += 1;
    if (fractal?.type === "TOP" && volumes[volumes.length - 1] > avgVolume * 1.2) putScore += 1;

    if (adx > 25) {
      if (macd.macd > macd.signal) callScore += 1;
      else putScore += 1;
    }

    // Filtro de volatilidade
    const minATR = currentPrice * 0.002; // 0.2% do preço
    if (atr < minATR) {
      callScore = 0;
      putScore = 0;
    }

    // Tomada de decisão
    let signal = "WAIT";
    if (callScore >= 5 && callScore >= putScore + 2) signal = "CALL";
    else if (putScore >= 5 && putScore >= callScore + 2) signal = "PUT";

    return {
      signal,
      indicators: {
        price: currentPrice,
        rsi,
        macd,
        sma9,
        ema21,
        ema50,
        adx,
        fractal,
        volume: volumes[volumes.length - 1],
        avgVolume,
        atr
      },
      scores: {
        call: callScore,
        put: putScore
      }
    };
  }

  updateHistory(analysis) {
    const now = new Date();
    const timeString = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    this.lastUpdate = timeString;
    this.history.unshift({
      time: timeString,
      signal: analysis.signal,
      price: analysis.indicators.price,
      indicators: analysis.indicators
    });

    if (this.history.length > 5) {
      this.history.pop();
    }
  }

  startTimer() {
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
    }

    const now = Date.now();
    const nextMinute = Math.ceil(now / 60000) * 60000;
    const delay = nextMinute - now;
    this.timer = Math.floor(delay / 1000);

    this.currentInterval = setInterval(() => {
      this.timer = Math.max(0, this.timer - 1);
      
      if (this.timer <= 0) {
        clearInterval(this.currentInterval);
        this.runAnalysis();
      }
    }, 1000);
  }

  async runAnalysis() {
    try {
      const data = await this.fetchMarketData();
      const analysis = this.analyzeData(data);
      
      if (analysis) {
        this.updateHistory(analysis);
        this.updateUI(analysis);
        this.playSignalSound(analysis.signal);
      }
      
      this.startTimer();
    } catch (error) {
      console.error("Analysis error:", error);
      setTimeout(() => this.runAnalysis(), 10000);
    }
  }

  playSignalSound(signal) {
    try {
      if (signal === "CALL") {
        const sound = document.getElementById("sound-call");
        if (sound) sound.play().catch(e => console.warn("Sound error:", e));
      } else if (signal === "PUT") {
        const sound = document.getElementById("sound-put");
        if (sound) sound.play().catch(e => console.warn("Sound error:", e));
      }
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  updateUI(analysis) {
    // Atualiza elementos da interface
    const formatPrice = (price) => price.toFixed(2);
    const formatIndicator = (value) => typeof value === 'number' ? value.toFixed(2) : 'N/A';

    // Atualiza o relógio
    const clockElement = document.getElementById("clock");
    if (clockElement) clockElement.textContent = this.lastUpdate;

    // Atualiza o histórico
    const historyElement = document.getElementById("history");
    if (historyElement) {
      historyElement.textContent = `${this.wins} WIN / ${this.losses} LOSS`;
    }

    // Atualiza o sinal atual
    const signalElement = document.getElementById("signal");
    if (signalElement) {
      signalElement.textContent = analysis.signal;
      signalElement.className = analysis.signal.toLowerCase();
    }

    // Atualiza os indicadores
    const indicatorsElement = document.getElementById("indicators");
    if (indicatorsElement) {
      indicatorsElement.innerHTML = `
        <li>Price: $${formatPrice(analysis.indicators.price)}</li>
        <li>RSI: ${formatIndicator(analysis.indicators.rsi)} 
            ${analysis.indicators.rsi < 30 ? '↓' : analysis.indicators.rsi > 70 ? '↑' : '•'}</li>
        <li>MACD: ${formatIndicator(analysis.indicators.macd.histograma)} 
            ${analysis.indicators.macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>ADX: ${formatIndicator(analysis.indicators.adx)} 
            ${analysis.indicators.adx > 25 ? '📈' : ''}</li>
        <li>EMA(21): ${formatIndicator(analysis.indicators.ema21)}</li>
        <li>ATR: ${formatIndicator(analysis.indicators.atr)}</li>
        <li>Volume: ${formatIndicator(analysis.indicators.volume)} 
            (Avg: ${formatIndicator(analysis.indicators.avgVolume)})</li>
        <li>Fractal: ${analysis.indicators.fractal?.type || "—"} 
            ${analysis.indicators.fractal?.confirmed ? '✅' : ''}</li>
      `;
    }

    // Atualiza o histórico de sinais
    const lastSignalsElement = document.getElementById("last-signals");
    if (lastSignalsElement) {
      lastSignalsElement.innerHTML = this.history
        .map(item => `<li>${item.time} - ${item.signal} ($${formatPrice(item.price)})</li>`)
        .join("");
    }

    // Atualiza o timer
    const timerElement = document.getElementById("timer");
    if (timerElement) {
      timerElement.textContent = `0:${this.timer.toString().padStart(2, '0')}`;
      timerElement.style.color = this.timer <= 5 ? 'red' : '';
    }
  }
}

// =============================================
// INICIALIZAÇÃO DA APLICAÇÃO
// =============================================

class TradingApp {
  constructor() {
    this.engine = new TradingEngine();
    this.priceUpdateInterval = null;
  }

  initialize() {
    this.setupUI();
    this.startClock();
    this.startPriceUpdates();
    this.engine.runAnalysis();
  }

  setupUI() {
    // Configura eventos de UI
    const manualRefresh = document.getElementById("manual-refresh");
    if (manualRefresh) {
      manualRefresh.addEventListener("click", () => {
        this.engine.runAnalysis();
      });
    }
  }

  startClock() {
    setInterval(() => {
      const now = new Date();
      const clockElement = document.getElementById("clock");
      if (clockElement) {
        clockElement.textContent = now.toLocaleTimeString("pt-BR", {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
    }, 1000);
  }

  async startPriceUpdates() {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
    }

    const updatePrice = async () => {
      try {
        const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
        if (!response.ok) return;
        
        const data = await response.json();
        if (!data?.lastPrice) return;

        const priceElement = document.getElementById("current-price");
        if (priceElement) {
          priceElement.textContent = `$${parseFloat(data.lastPrice).toFixed(2)}`;
        }
      } catch (error) {
        console.error("Price update error:", error);
      }
    };

    await updatePrice();
    this.priceUpdateInterval = setInterval(updatePrice, 5000);
  }
}

// Inicializa a aplicação quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  try {
    const app = new TradingApp();
    app.initialize();
  } catch (error) {
    console.error("Application failed to start:", error);
    const errorElement = document.getElementById("error-message");
    if (errorElement) {
      errorElement.textContent = "Failed to initialize application. Please try again later.";
      errorElement.style.display = "block";
    }
  }
});
