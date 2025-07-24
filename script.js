// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
const state = {
  ultimos: [],
  timer: 60,
  ultimaAtualizacao: "",
  leituraEmAndamento: false,
  intervaloAtual: null,
  tentativasErro: 0,
  ultimoSinal: null,
  ultimoScore: 0,
  contadorLaterais: 0,
  marketOpen: true,
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  dadosHistoricos: [],
  resistenciaKey: 0,
  suporteKey: 0,
  rsiCache: { avgGain: 0, avgLoss: 0, lastPrice: null, initialized: false },
  emaCache: {
    ema5: null,
    ema13: null,
    lastValues: []
  },
  macdCache: {
    emaRapida: null,
    emaLenta: null,
    macdLine: [],
    signalLine: [],
    histogram: []
  },
  superTrendCache: [],
  atrGlobal: 0,
  rsiHistory: [],
  cooldown: 0,
  confirmacoes: []
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com"
  },
  PARES: {
    CRYPTO_IDX: "BTC/USD"
  },
  PERIODOS: {
    RSI: 9,
    STOCH_K: 14,
    STOCH_D: 3,
    EMA_CURTA: 5,
    EMA_MEDIA: 13,
    MACD_RAPIDA: 6,
    MACD_LENTA: 13,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 7,
    DIVERGENCIA_LOOKBACK: 8,
    EXTREME_LOOKBACK: 2,
    COOLDOWN: 3
  },
  LIMIARES: {
    SCORE_ALTO: 85,
    SCORE_MEDIO: 70,
    RSI_OVERBOUGHT: 75,
    RSI_OVERSOLD: 25,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    VARIACAO_LATERAL: 0.005,
    ATR_LIMIAR: 0.015,
    LATERALIDADE_LIMIAR: 0.005,
    VOLATILIDADE_MINIMA: 0.008
  },
  PESOS: {
    RSI: 1.7,
    MACD: 2.2,
    TENDENCIA: 2.8,
    STOCH: 1.2,
    SUPERTREND: 1.9,
    DIVERGENCIA: 2.0,
    VOLATILIDADE: 1.5,
    SUPORTE_RESISTENCIA: 1.8
  }
};

// =============================================
// FUNÇÕES DE INDICADORES (OTIMIZADAS)
// =============================================

function calcularEMAIncremental(currentValue, periodo, tipo) {
  if (!state.emaCache[tipo] || state.emaCache.lastValues.length < periodo) {
    if (!state.emaCache.lastValues) state.emaCache.lastValues = [];
    
    state.emaCache.lastValues.push(currentValue);
    
    if (state.emaCache.lastValues.length === periodo) {
      const initialEMA = state.emaCache.lastValues.reduce((a, b) => a + b, 0) / periodo;
      state.emaCache[tipo] = initialEMA;
    }
    return null;
  }

  const k = 2 / (periodo + 1);
  state.emaCache[tipo] = currentValue * k + state.emaCache[tipo] * (1 - k);
  return state.emaCache[tipo];
}

function calcularRSIIncremental(currentClose) {
  if (!state.rsiCache.initialized) {
    state.rsiCache.lastPrice = currentClose;
    state.rsiCache.initialized = true;
    return 50;
  }

  const change = currentClose - state.rsiCache.lastPrice;
  const gain = change > 0 ? change : 0;
  const loss = change < 0 ? -change : 0;

  state.rsiCache.avgGain = ((CONFIG.PERIODOS.RSI - 1) * state.rsiCache.avgGain + gain) / CONFIG.PERIODOS.RSI;
  state.rsiCache.avgLoss = ((CONFIG.PERIODOS.RSI - 1) * state.rsiCache.avgLoss + loss) / CONFIG.PERIODOS.RSI;

  state.rsiCache.lastPrice = currentClose;

  if (state.rsiCache.avgLoss === 0) return 100;
  const rs = state.rsiCache.avgGain / state.rsiCache.avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  state.rsiHistory.push(rsi);
  if (state.rsiHistory.length > 100) state.rsiHistory.shift();
  
  return rsi;
}

function calcularStochastic(highs, lows, closes) {
  const periodoK = CONFIG.PERIODOS.STOCH_K;
  const periodoD = CONFIG.PERIODOS.STOCH_D;
  
  if (closes.length < periodoK + periodoD) return { k: 50, d: 50 };

  const currentClose = closes[closes.length - 1];
  const lowestLow = Math.min(...lows.slice(-periodoK));
  const highestHigh = Math.max(...highs.slice(-periodoK));
  
  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  
  let d;
  if (closes.length >= periodoK + periodoD) {
    const kValues = [];
    for (let i = periodoK; i > 0; i--) {
      const start = closes.length - i;
      const end = start + periodoK;
      if (end > closes.length) break;
      
      const sliceCloses = closes.slice(start, end);
      const sliceHighs = highs.slice(start, end);
      const sliceLows = lows.slice(start, end);
      
      const currentK = ((sliceCloses[sliceCloses.length - 1] - Math.min(...sliceLows)) / 
                      (Math.max(...sliceHighs) - Math.min(...sliceLows))) * 100;
      kValues.push(currentK);
    }
    d = kValues.reduce((a, b) => a + b, 0) / kValues.length;
  } else {
    d = k;
  }
  
  return { k, d };
}

function calcularMACDIncremental(currentClose) {
  const emaRapida = calcularEMAIncremental(currentClose, CONFIG.PERIODOS.MACD_RAPIDA, 'emaRapida');
  const emaLenta = calcularEMAIncremental(currentClose, CONFIG.PERIODOS.MACD_LENTA, 'emaLenta');
  
  if (!emaRapida || !emaLenta) return { macd: 0, signal: 0, histogram: 0 };
  
  const macdLine = emaRapida - emaLenta;
  state.macdCache.macdLine.push(macdLine);
  
  let signalLine;
  if (state.macdCache.macdLine.length >= CONFIG.PERIODOS.MACD_SINAL) {
    const macdValues = state.macdCache.macdLine.slice(-CONFIG.PERIODOS.MACD_SINAL);
    signalLine = calcularMediaSimples(macdValues, CONFIG.PERIODOS.MACD_SINAL);
  } else {
    signalLine = macdLine;
  }
  
  const histogram = macdLine - signalLine;
  
  if (state.macdCache.macdLine.length > 50) {
    state.macdCache.macdLine.shift();
  }
  
  return { macd: macdLine, signal: signalLine, histogram };
}

function calcularMediaSimples(dados, periodo) {
  if (!Array.isArray(dados) || dados.length < periodo) return null;
  const slice = dados.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

function calcularATR(dados) {
  if (dados.length < 2) return 0;
  
  const current = dados[dados.length - 1];
  const previous = dados[dados.length - 2];
  
  const tr = Math.max(
    current.high - current.low,
    Math.abs(current.high - previous.close),
    Math.abs(current.low - previous.close)
  );
  
  state.atrGlobal = (state.atrGlobal * (CONFIG.PERIODOS.ATR - 1) + tr) / CONFIG.PERIODOS.ATR;
  return state.atrGlobal;
}

function calcularSuperTrend(dados) {
  if (dados.length < 2) return { direcao: 0, valor: 0 };
  
  const current = dados[dados.length - 1];
  const previous = dados[dados.length - 2];
  
  const basicUpper = (current.high + current.low) / 2 + 3 * state.atrGlobal;
  const basicLower = (current.high + current.low) / 2 - 3 * state.atrGlobal;
  
  let direcao;
  if (current.close > basicUpper) direcao = 1;
  else if (current.close < basicLower) direcao = -1;
  else direcao = previous.superTrend?.direcao || 0;
  
  return { 
    direcao,
    valor: direcao === 1 ? basicLower : basicUpper
  };
}

// =============================================
// FUNÇÕES DE ANÁLISE (APRIMORADAS)
// =============================================

function detectarDivergencias(closes, rsis) {
  if (closes.length < CONFIG.PERIODOS.DIVERGENCIA_LOOKBACK || rsis.length < CONFIG.PERIODOS.DIVERGENCIA_LOOKBACK) {
    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
  }

  const lookback = CONFIG.PERIODOS.DIVERGENCIA_LOOKBACK;
  const sliceCloses = closes.slice(-lookback);
  const sliceRsis = rsis.slice(-lookback);
  
  const minClose = Math.min(...sliceCloses);
  const maxClose = Math.max(...sliceCloses);
  const minRsi = Math.min(...sliceRsis);
  const maxRsi = Math.max(...sliceRsis);
  
  const idxMinClose = sliceCloses.indexOf(minClose);
  const idxMaxClose = sliceCloses.indexOf(maxClose);
  const idxMinRsi = sliceRsis.indexOf(minRsi);
  const idxMaxRsi = sliceRsis.indexOf(maxRsi);
  
  if (idxMinClose > idxMinRsi && minClose < sliceCloses[0] && minRsi > sliceRsis[0]) {
    return { divergenciaRSI: true, tipoDivergencia: "ALTA" };
  }
  
  if (idxMaxClose > idxMaxRsi && maxClose > sliceCloses[0] && maxRsi < sliceRsis[0]) {
    return { divergenciaRSI: true, tipoDivergencia: "BAIXA" };
  }
  
  return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
}

function verificarRompimento(price, volume) {
  if (state.dadosHistoricos.length < 20) return "NENHUM";
  
  const volumeMedio = calcularMediaSimples(
    state.dadosHistoricos.slice(-20).map(d => d.volume), 
    20
  );
  
  if (price > state.resistenciaKey && volume > volumeMedio * 1.2) {
    return "RESISTENCIA_ROMPIDA";
  }
  
  if (price < state.suporteKey && volume > volumeMedio * 1.2) {
    return "SUPORTE_ROMPIDO";
  }
  
  return "NENHUM";
}

function detectarLateralidade(closes) {
  if (closes.length < CONFIG.PERIODOS.ANALISE_LATERAL) return false;
  
  const min = Math.min(...closes.slice(-CONFIG.PERIODOS.ANALISE_LATERAL));
  const max = Math.max(...closes.slice(-CONFIG.PERIODOS.ANALISE_LATERAL));
  const range = max - min;
  const avgPrice = closes.slice(-CONFIG.PERIODOS.ANALISE_LATERAL).reduce((a, b) => a + b, 0) / CONFIG.PERIODOS.ANALISE_LATERAL;
  
  return (range / avgPrice) < CONFIG.LIMIARES.LATERALIDADE_LIMIAR;
}

function calcularScore(indicadores, sinal) {
  let score = 50;
  
  if ((sinal === "CALL" && indicadores.tendencia.includes("ALTA")) ||
      (sinal === "PUT" && indicadores.tendencia.includes("BAIXA"))) {
    score += 20;
  }
  
  if (indicadores.divergencias.divergenciaRSI) {
    score += 15;
  }
  
  if (state.atrGlobal > CONFIG.LIMIARES.VOLATILIDADE_MINIMA) {
    score += 10;
  }
  
  const rompimento = verificarRompimento(
    indicadores.velaAtual.close, 
    indicadores.velaAtual.volume
  );
  
  if ((sinal === "CALL" && rompimento === "RESISTENCIA_ROMPIDA") ||
      (sinal === "PUT" && rompimento === "SUPORTE_ROMPIDO")) {
    score += 15;
  }
  
  if (state.confirmacoes.filter(c => c === sinal).length >= 2) {
    score += 10;
  }
  
  if (sinal === "CALL" && indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD) {
    score += 5;
  } else if (sinal === "PUT" && indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
    score += 5;
  }
  
  if (indicadores.superTrend.direcao === (sinal === "CALL" ? 1 : -1)) {
    score += 5;
  }
  
  return Math.min(100, Math.max(0, score));
}

// =============================================
// CORE DO SISTEMA (REFATORADO)
// =============================================

async function analisarMercado() {
  if (state.leituraEmAndamento || state.cooldown > 0) {
    if (state.cooldown > 0) state.cooldown--;
    return;
  }
  
  state.leituraEmAndamento = true;
  
  try {
    const dados = simularDados();
    state.dadosHistoricos = dados;
    const velaAtual = dados[dados.length - 1];
    
    const indicadores = {
      ema5: calcularEMAIncremental(velaAtual.close, CONFIG.PERIODOS.EMA_CURTA, 'ema5'),
      ema13: calcularEMAIncremental(velaAtual.close, CONFIG.PERIODOS.EMA_MEDIA, 'ema13'),
      rsi: calcularRSIIncremental(velaAtual.close),
      stoch: calcularStochastic(
        dados.map(d => d.high),
        dados.map(d => d.low),
        dados.map(d => d.close)
      ),
      macd: calcularMACDIncremental(velaAtual.close),
      atr: calcularATR(dados),
      superTrend: calcularSuperTrend(dados),
      velaAtual
    };
    
    const divergencias = detectarDivergencias(
      dados.map(d => d.close), 
      state.rsiHistory
    );
    
    const lateral = detectarLateralidade(dados.map(d => d.close));
    const rompimento = verificarRompimento(velaAtual.close, velaAtual.volume);
    
    const diff = indicadores.ema5 - indicadores.ema13;
    const forcaTendencia = Math.min(100, Math.abs(diff * 10000));
    let tendencia;
    
    if (forcaTendencia > 75) {
      tendencia = diff > 0 ? "FORTE_ALTA" : "FORTE_BAIXA";
    } else if (forcaTendencia > 40) {
      tendencia = diff > 0 ? "ALTA" : "BAIXA";
    } else {
      tendencia = "NEUTRA";
    }

    let sinal = "ESPERAR";
    const conditions = {
      call: 
        (tendencia === "FORTE_ALTA" && velaAtual.close > indicadores.ema5 && indicadores.macd.histogram > 0) ||
        (divergencias.tipoDivergencia === "ALTA") ||
        (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD && velaAtual.close > indicadores.ema13) ||
        (rompimento === "RESISTENCIA_ROMPIDA"),
      
      put:
        (tendencia === "FORTE_BAIXA" && velaAtual.close < indicadores.ema5 && indicadores.macd.histogram < 0) ||
        (divergencias.tipoDivergencia === "BAIXA") ||
        (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && velaAtual.close < indicadores.ema13) ||
        (rompimento === "SUPORTE_ROMPIDO")
    };

    if (conditions.call) sinal = "CALL";
    else if (conditions.put) sinal = "PUT";
    
    state.confirmacoes.push(sinal);
    if (state.confirmacoes.length > CONFIG.PERIODOS.VELAS_CONFIRMACAO) {
      state.confirmacoes.shift();
    }
    
    const confirmCount = state.confirmacoes.filter(c => c === sinal).length;
    if (confirmCount < 2) sinal = "ESPERAR";
    
    const score = sinal !== "ESPERAR" 
      ? calcularScore({ ...indicadores, divergencias, tendencia, rompimento }, sinal)
      : 0;
    
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.tendenciaDetectada = tendencia;
    state.forcaTendencia = forcaTendencia;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    
    if (sinal !== "ESPERAR") {
      state.cooldown = CONFIG.PERIODOS.COOLDOWN;
    }
    
    atualizarInterface(sinal, score, tendencia, forcaTendencia);

  } catch (e) {
    console.error("Erro na análise:", e);
    const comandoElement = document.getElementById("comando");
    if (comandoElement) {
      comandoElement.textContent = "ERRO";
      comandoElement.className = "signal-box erro";
    }
    state.tentativasErro++;
  } finally {
    state.leituraEmAndamento = false;
  }
}

function atualizarInterface(sinal, score, tendencia, forcaTendencia) {
  const comandoElement = document.getElementById("comando");
  const scoreElement = document.getElementById("score");
  const tendenciaElement = document.getElementById("tendencia");
  const forcaElement = document.getElementById("forca-tendencia");
  const timerElement = document.getElementById("timer");
  const horaElement = document.getElementById("hora");
  const suporteElement = document.getElementById("suporte");
  const resistenciaElement = document.getElementById("resistencia");
  
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = `signal-box ${sinal.toLowerCase()}`;
  }
  
  if (scoreElement) {
    scoreElement.textContent = `${score}%`;
    scoreElement.className = score > CONFIG.LIMIARES.SCORE_ALTO 
      ? "signal-high" 
      : score > CONFIG.LIMIARES.SCORE_MEDIO 
        ? "signal-medium" 
        : "signal-low";
  }
  
  if (tendenciaElement) tendenciaElement.textContent = tendencia;
  if (forcaElement) forcaElement.textContent = `${forcaTendencia}%`;
  if (timerElement) timerElement.textContent = formatarTimer(state.timer);
  if (horaElement) horaElement.textContent = state.ultimaAtualizacao;
  
  const prices = state.dadosHistoricos.slice(-50).map(d => d.close);
  if (prices.length > 0) {
    state.suporteKey = Math.min(...prices);
    state.resistenciaKey = Math.max(...prices);
  }
  
  if (suporteElement) suporteElement.textContent = state.suporteKey.toFixed(2);
  if (resistenciaElement) resistenciaElement.textContent = state.resistenciaKey.toFixed(2);

  state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
  if (state.ultimos.length > 5) state.ultimos.pop();
  
  const ultimosElement = document.getElementById("ultimos");
  if (ultimosElement) {
    ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
  }
}

// =============================================
// FUNÇÕES DE TEMPO E INICIALIZAÇÃO
// =============================================
function formatarTimer(segundos) {
  const min = Math.floor(segundos / 60);
  const sec = segundos % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  
  const agora = new Date();
  const segundos = agora.getSeconds();
  state.timer = 60 - segundos;
  
  const timerElement = document.getElementById("timer");
  if (timerElement) timerElement.textContent = formatarTimer(state.timer);
  
  state.intervaloAtual = setInterval(() => {
    state.timer--;
    
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado();
      sincronizarTimer();
    } else {
      if (timerElement) timerElement.textContent = formatarTimer(state.timer);
    }
  }, 1000);
}

function simularDados() {
  const dados = state.dadosHistoricos.length > 0 ? [...state.dadosHistoricos] : [];
  let preco = dados.length > 0 ? dados[dados.length - 1].close : 50000;
  
  if (dados.length > 1000) {
    dados.splice(0, dados.length - 1000);
  }
  
  const now = Date.now();
  const lastTime = dados.length > 0 ? new Date(dados[dados.length - 1].time).getTime() : now - 60000;
  const numNewCandles = Math.floor((now - lastTime) / 60000);
  
  for (let i = 0; i < numNewCandles; i++) {
    const variacao = (Math.random() - 0.5) * 1000;
    preco += variacao;
    
    dados.push({
      time: new Date(lastTime + (i + 1) * 60000).toISOString(),
      open: preco - variacao,
      close: preco,
      high: preco + Math.random() * 500,
      low: preco - Math.random() * 500,
      volume: 1000000 + Math.random() * 500000
    });
  }
  
  return dados;
}

function iniciarAplicativo() {
  if (!document.getElementById("comando")) {
    const appContainer = document.createElement("div");
    appContainer.id = "trading-app";
    appContainer.innerHTML = `
      <div class="header">
        <h2>Analisador Cripto</h2>
        <div class="time-info">
          <span id="hora">00:00:00</span> | 
          <span id="timer">1:00</span>
        </div>
      </div>
      
      <div class="main-signal">
        <div id="comando" class="signal-box esperar">---</div>
        <div id="score" class="signal-medium">0%</div>
      </div>
      
      <div class="tendency-info">
        <div>Tendência: <span id="tendencia">NEUTRA</span></div>
        <div>Força: <span id="forca-tendencia">0%</span></div>
      </div>
      
      <div class="levels">
        <div>Suporte: <span id="suporte">0</span></div>
        <div>Resistência: <span id="resistencia">0</span></div>
      </div>
      
      <div class="history">
        <h3>Últimos Sinais</h3>
        <ul id="ultimos"></ul>
      </div>
    `;
    document.body.appendChild(appContainer);
    
    const style = document.createElement("style");
    style.textContent = `
      #trading-app {
        font-family: Arial, sans-serif;
        max-width: 400px;
        margin: 20px auto;
        padding: 20px;
        border: 1px solid #ccc;
        border-radius: 10px;
        background-color: #f9f9f9;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      .header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 15px;
        align-items: center;
      }
      .header h2 {
        margin: 0;
        font-size: 1.2em;
      }
      .time-info {
        font-size: 0.9em;
        color: #666;
      }
      .main-signal {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
      }
      .signal-box {
        padding: 20px;
        border-radius: 8px;
        font-weight: bold;
        font-size: 24px;
        min-width: 100px;
        text-align: center;
        flex: 1;
      }
      .esperar { background-color: #e0e0e0; color: #333; }
      .call { background-color: #4CAF50; color: white; }
      .put { background-color: #F44336; color: white; }
      .erro { background-color: #FF9800; color: white; }
      #score {
        padding: 20px;
        border-radius: 8px;
        font-size: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 80px;
        flex: 1;
      }
      .signal-high { background-color: #4CAF50; color: white; }
      .signal-medium { background-color: #FFC107; color: black; }
      .signal-low { background-color: #F44336; color: white; }
      .tendency-info, .levels {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        padding: 8px;
        background-color: #f0f0f0;
        border-radius: 4px;
      }
      .history {
        margin-top: 20px;
      }
      .history h3 {
        margin-bottom: 10px;
        font-size: 1em;
        color: #333;
      }
      .history ul {
        list-style: none;
        padding: 0;
        margin: 0;
        border: 1px solid #eee;
        border-radius: 4px;
        max-height: 150px;
        overflow-y: auto;
      }
      .history li {
        padding: 8px;
        border-bottom: 1px solid #eee;
        font-size: 0.9em;
      }
      .history li:last-child {
        border-bottom: none;
      }
    `;
    document.head.appendChild(style);
  }
  
  setInterval(() => {
    const agora = new Date();
    const hora = agora.toLocaleTimeString("pt-BR");
    const horaElement = document.getElementById("hora");
    if (horaElement) horaElement.textContent = hora;
  }, 1000);
  
  sincronizarTimer();
  setTimeout(analisarMercado, 1000);
}

if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
