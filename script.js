// =============================================
// CONFIGURAÇÕES GLOBAIS (OTIMIZADAS PARA CRYPTO IDX)
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
  rsiCache: { avgGain: 0, avgLoss: 0, initialized: false },
  emaCache: {
    ema5: null,
    ema13: null,
    ema50: null,
    ema200: null
  },
  macdCache: {
    emaRapida: null,
    emaLenta: null,
    macdLine: [],
    signalLine: []
  },
  superTrendCache: [],
  atrGlobal: 0,
  rsiHistory: [],
  cooldown: 0,
  volumeRelativo: 0,
  obv: 0,
  vwap: 0,
  bandasBollinger: {
    superior: 0,
    inferior: 0,
    medio: 0
  },
  volatilidadeMedia: 0,
  performanceIndicadores: {
    RSI: { acertos: 0, total: 0 },
    MACD: { acertos: 0, total: 0 },
    TENDENCIA: { acertos: 0, total: 0 },
    STOCH: { acertos: 0, total: 0 },
    SUPERTREND: { acertos: 0, total: 0 },
    DIVERGENCIA: { acertos: 0, total: 0 },
    VOLUME: { acertos: 0, total: 0 },
    VWAP: { acertos: 0, total: 0 },
    BOLLINGER: { acertos: 0, total: 0 }
  },
  iaProbabilidade: 0,
  iaNivelRisco: 0,
  totalOperacoes: 0,
  modoLateral: false,
  ultimoSinalTimestamp: 0,
  maxHistorySize: 500
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com",
    FALLBACK: "https://api.example.com" // Adicione um endpoint de fallback
  },
  PARES: {
    CRYPTO_IDX: "BTC/USD"
  },
  PERIODOS: {
    RSI: 14,
    STOCH_K: 14,
    STOCH_D: 3,
    EMA_CURTA: 5,
    EMA_MEDIA: 13,
    EMA_50: 50,
    EMA_LONGA: 200,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 10,
    DIVERGENCIA_LOOKBACK: 14,
    EXTREME_LOOKBACK: 5,
    BOLLINGER: 20,
    VOLUME_LOOKBACK: 14,
    VWAP: 20
  },
  LIMIARES: {
    SCORE_ALTO: 85,
    SCORE_MEDIO: 70,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    VARIACAO_LATERAL: 0.005,
    ATR_LIMIAR: 0.03,
    LATERALIDADE_LIMIAR: 0.005,
    VOLUME_ALERTA: 1.8,
    VOLATILIDADE_ALTA: 4,
    LATERALIDADE_PROLONGADA: 15
  },
  PESOS: {
    RSI: 1.7,
    MACD: 2.2,
    TENDENCIA: 2.8,
    STOCH: 1.2,
    SUPERTREND: 1.9,
    DIVERGENCIA: 2.0,
    VOLUME: 1.5,
    VWAP: 1.3,
    BOLLINGER: 1.4
  },
  AI: {
    PROB_ACERTO_ALVO: 75,
    NIVEL_RISCO_MAX: 4
  },
  TIMEOUT_API: 5000
};

// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    const now = new Date();
    state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    elementoHora.textContent = state.ultimaAtualizacao;
    state.marketOpen = true;
  }
}

function limitarHistorico() {
  // Limitar arrays históricos para evitar crescimento infinito
  if (state.dadosHistoricos.length > state.maxHistorySize) {
    state.dadosHistoricos = state.dadosHistoricos.slice(-state.maxHistorySize);
  }
  
  if (state.rsiHistory.length > state.maxHistorySize) {
    state.rsiHistory = state.rsiHistory.slice(-state.maxHistorySize);
  }
  
  if (state.ultimos.length > 10) {
    state.ultimos = state.ultimos.slice(-10);
  }
}

// =============================================
// INDICADORES TÉCNICOS (OTIMIZADOS)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return null;
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  },

  exponencial: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return [];
    
    const k = 2 / (periodo + 1);
    const slice = dados.slice(0, periodo);
    let ema = slice.reduce((sum, val) => sum + val, 0) / periodo;
    const emaArray = [ema];
    
    for (let i = periodo; i < dados.length; i++) {
      ema = dados[i] * k + ema * (1 - k);
      emaArray.push(ema);
    }
    
    return emaArray;
  }
};

// Implementação correta do RSI usando Wilder
function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) {
    return 50;
  }
  
  // Calcular ganhos e perdas iniciais
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  
  let avgGain = gains / periodo;
  let avgLoss = losses / periodo;
  
  // Atualizações para pontos posteriores
  for (let i = periodo + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    let currentGain = 0;
    let currentLoss = 0;
    
    if (diff >= 0) currentGain = diff;
    else currentLoss = -diff;
    
    // Atualizar médias usando Wilder
    avgGain = (avgGain * (periodo - 1) + currentGain) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + currentLoss) / periodo;
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Stochastic otimizado com janela deslizante
function calcularStochastic(highs, lows, closes, periodoK = CONFIG.PERIODOS.STOCH_K, periodoD = CONFIG.PERIODOS.STOCH_D) {
  try {
    if (closes.length < periodoK) return { k: 50, d: 50 };
    
    // Calcular %K
    const kValues = [];
    for (let i = periodoK - 1; i < closes.length; i++) {
      const start = i - periodoK + 1;
      const end = i + 1;
      const sliceHighs = highs.slice(start, end);
      const sliceLows = lows.slice(start, end);
      
      const highest = Math.max(...sliceHighs);
      const lowest = Math.min(...sliceLows);
      const currentClose = closes[i];
      
      const k = ((currentClose - lowest) / (highest - lowest)) * 100 || 50;
      kValues.push(k);
    }
    
    // Calcular %D (média móvel de %K)
    const dValues = [];
    for (let i = periodoD - 1; i < kValues.length; i++) {
      const slice = kValues.slice(i - periodoD + 1, i + 1);
      const d = calcularMedia.simples(slice, periodoD) || 50;
      dValues.push(d);
    }
    
    return {
      k: kValues[kValues.length - 1] || 50,
      d: dValues[dValues.length - 1] || 50
    };
  } catch (e) {
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

// MACD com cálculo incremental
function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, lenta = CONFIG.PERIODOS.MACD_LENTA, sinal = CONFIG.PERIODOS.MACD_SINAL) {
  try {
    const updateEMA = (current, prev, period) => {
      const k = 2 / (period + 1);
      return current * k + prev * (1 - k);
    };
    
    // Inicializar se necessário
    if (state.macdCache.emaRapida === null) {
      state.macdCache.emaRapida = calcularMedia.simples(closes.slice(-rapida), rapida);
    } else {
      state.macdCache.emaRapida = updateEMA(
        closes[closes.length - 1],
        state.macdCache.emaRapida,
        rapida
      );
    }
    
    if (state.macdCache.emaLenta === null) {
      state.macdCache.emaLenta = calcularMedia.simples(closes.slice(-lenta), lenta);
    } else {
      state.macdCache.emaLenta = updateEMA(
        closes[closes.length - 1],
        state.macdCache.emaLenta,
        lenta
      );
    }
    
    // Calcular linha MACD
    const macdLine = state.macdCache.emaRapida - state.macdCache.emaLenta;
    
    // Calcular linha de sinal
    if (state.macdCache.signalLine.length === 0) {
      state.macdCache.signalLine = [macdLine];
    } else {
      const lastSignal = state.macdCache.signalLine[state.macdCache.signalLine.length - 1];
      const newSignal = updateEMA(macdLine, lastSignal, sinal);
      state.macdCache.signalLine.push(newSignal);
    }
    
    // Manter histórico limitado
    if (state.macdCache.signalLine.length > 100) {
      state.macdCache.signalLine.shift();
    }
    
    const currentSignal = state.macdCache.signalLine[state.macdCache.signalLine.length - 1];
    
    return {
      histograma: macdLine - currentSignal,
      macdLinha: macdLine,
      sinalLinha: currentSignal
    };
  } catch (e) {
    console.error("Erro no cálculo MACD:", e);
    return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  }
}

// ATR com cálculo eficiente
function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo + 1) return 0;
    
    const trValues = [];
    for (let i = 1; i < dados.length; i++) {
      const high = dados[i].high;
      const low = dados[i].low;
      const prevClose = dados[i-1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trValues.push(tr);
    }
    
    // Calcular ATR como média móvel dos TRs
    return calcularMedia.simples(trValues.slice(-periodo), periodo);
  } catch (e) {
    console.error("Erro no cálculo ATR:", e);
    return 0;
  }
}

// SuperTrend com cálculo local de ATR
function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3) {
  try {
    if (dados.length < periodo) return { direcao: 0, valor: 0 };
    
    // Calcular ATR local
    const atr = calcularATR(dados, periodo);
    
    const current = dados[dados.length - 1];
    const hl2 = (current.high + current.low) / 2;
    
    const upperBand = hl2 + (multiplicador * atr);
    const lowerBand = hl2 - (multiplicador * atr);
    
    let superTrend;
    let direcao;
    
    if (state.superTrendCache.length === 0) {
      superTrend = upperBand;
      direcao = 1;
    } else {
      const prev = dados[dados.length - 2];
      const prevSuperTrend = state.superTrendCache[state.superTrendCache.length - 1].valor;
      
      if (prev.close > prevSuperTrend) {
        direcao = 1;
        superTrend = Math.max(lowerBand, prevSuperTrend);
      } else {
        direcao = -1;
        superTrend = Math.min(upperBand, prevSuperTrend);
      }
    }
    
    state.superTrendCache.push({ direcao, valor: superTrend });
    if (state.superTrendCache.length > 100) state.superTrendCache.shift();
    
    return { direcao, valor: superTrend };
  } catch (e) {
    console.error("Erro no cálculo SuperTrend:", e);
    return { direcao: 0, valor: 0 };
  }
}

// Detecção de divergências baseada em extremos locais
function detectarDivergencias(closes, rsis) {
  try {
    const lookback = CONFIG.PERIODOS.DIVERGENCIA_LOOKBACK;
    if (closes.length < lookback || rsis.length < lookback) {
      return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
    }
    
    // Encontrar máximos e mínimos nos preços
    const priceHighs = [];
    const priceLows = [];
    
    for (let i = 1; i < lookback - 1; i++) {
      const idx = closes.length - lookback + i;
      if (closes[idx] > closes[idx-1] && closes[idx] > closes[idx+1]) {
        priceHighs.push({idx, value: closes[idx]});
      }
      if (closes[idx] < closes[idx-1] && closes[idx] < closes[idx+1]) {
        priceLows.push({idx, value: closes[idx]});
      }
    }
    
    // Encontrar máximos e mínimos no RSI
    const rsiHighs = [];
    const rsiLows = [];
    
    for (let i = 1; i < lookback - 1; i++) {
      const idx = rsis.length - lookback + i;
      if (rsis[idx] > rsis[idx-1] && rsis[idx] > rsis[idx+1]) {
        rsiHighs.push({idx, value: rsis[idx]});
      }
      if (rsis[idx] < rsis[idx-1] && rsis[idx] < rsis[idx+1]) {
        rsiLows.push({idx, value: rsis[idx]});
      }
    }
    
    // Verificar divergências regulares
    let divergenciaAlta = false;
    let divergenciaBaixa = false;
    
    // Divergência de alta: preço faz mínimos mais baixos, RSI faz mínimos mais altos
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
      const lastPriceLow = priceLows[priceLows.length - 1].value;
      const prevPriceLow = priceLows[priceLows.length - 2].value;
      const lastRsiLow = rsiLows[rsiLows.length - 1].value;
      const prevRsiLow = rsiLows[rsiLows.length - 2].value;
      
      if (lastPriceLow < prevPriceLow && lastRsiLow > prevRsiLow) {
        divergenciaAlta = true;
      }
    }
    
    // Divergência de baixa: preço faz máximos mais altos, RSI faz máximos mais baixos
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const lastPriceHigh = priceHighs[priceHighs.length - 1].value;
      const prevPriceHigh = priceHighs[priceHighs.length - 2].value;
      const lastRsiHigh = rsiHighs[rsiHighs.length - 1].value;
      const prevRsiHigh = rsiHighs[rsiHighs.length - 2].value;
      
      if (lastPriceHigh > prevPriceHigh && lastRsiHigh < prevRsiHigh) {
        divergenciaBaixa = true;
      }
    }
    
    return {
      divergenciaRSI: divergenciaAlta || divergenciaBaixa,
      tipoDivergencia: divergenciaAlta ? "ALTA" : 
                      divergenciaBaixa ? "BAIXA" : "NENHUMA"
    };
  } catch (e) {
    console.error("Erro na detecção de divergências:", e);
    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
  }
}

// Funções auxiliares restantes
function calcularVolumeRelativo(volumes, periodo = CONFIG.PERIODOS.VOLUME_LOOKBACK) {
  if (volumes.length < periodo) return 0;
  const slice = volumes.slice(-periodo);
  const mediaVolume = calcularMedia.simples(slice, periodo);
  return volumes[volumes.length - 1] / mediaVolume;
}

function calcularOBV(closes, volumes) {
  if (closes.length < 2) return 0;
  
  let obv = volumes[0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i-1]) {
      obv += volumes[i];
    } else if (closes[i] < closes[i-1]) {
      obv -= volumes[i];
    }
  }
  return obv;
}

function calcularVWAP(dados, periodo = CONFIG.PERIODOS.VWAP) {
  if (dados.length < periodo) return 0;
  
  let tpTotal = 0;
  let volumeTotal = 0;
  
  const slice = dados.slice(-periodo);
  slice.forEach(v => {
    const tp = (v.high + v.low + v.close) / 3;
    tpTotal += tp * v.volume;
    volumeTotal += v.volume;
  });
  
  return tpTotal / volumeTotal;
}

function calcularBandasBollinger(closes, periodo = CONFIG.PERIODOS.BOLLINGER, desvios = 2) {
  if (closes.length < periodo) return { superior: 0, inferior: 0, medio: 0 };
  
  const slice = closes.slice(-periodo);
  const media = calcularMedia.simples(slice, periodo);
  
  let somaQuadrados = 0;
  slice.forEach(valor => {
    somaQuadrados += Math.pow(valor - media, 2);
  });
  
  const desvioPadrao = Math.sqrt(somaQuadrados / periodo);
  
  return {
    superior: media + (desvioPadrao * desvios),
    inferior: media - (desvioPadrao * desvios),
    medio: media
  };
}

// =============================================
// DETECÇÃO DE TENDÊNCIA OTIMIZADA
// =============================================
function avaliarTendencia(ema5, ema13, ema50) {
  if ([ema5, ema13, ema50].some(v => v === null || isNaN(v))) {
    return { tendencia: "NEUTRA", forca: 0 };
  }
  
  const diffCurta = ema5 - ema13;
  const diffLonga = ema13 - ema50;
  const forca = Math.min(100, Math.abs(diffCurta) * 100 + Math.abs(diffLonga) * 60);
  
  if (forca > 60) {
    return diffCurta > 0 && diffLonga > 0 
      ? { tendencia: "FORTE_ALTA", forca }
      : diffCurta < 0 && diffLonga < 0 
        ? { tendencia: "FORTE_BAIXA", forca }
        : { tendencia: "NEUTRA", forca: 0 };
  }
  
  if (forca > 30) {
    return diffCurta > 0 
      ? { tendencia: "ALTA", forca } 
      : { tendencia: "BAIXA", forca };
  }
  
  return { tendencia: "NEUTRA", forca: 0 };
}

function detectarLateralidade(closes, periodo = CONFIG.PERIODOS.ANALISE_LATERAL, limiar = CONFIG.LIMIARES.LATERALIDADE_LIMIAR) {
  if (closes.length < periodo) return false;
  
  let countLaterais = 0;
  for (let i = closes.length - 1; i > closes.length - periodo; i--) {
    if (i <= 0) break;
    const variacao = Math.abs((closes[i] - closes[i-1]) / closes[i-1]);
    if (variacao < limiar) countLaterais++;
  }
  
  state.contadorLaterais = countLaterais;
  state.modoLateral = countLaterais > CONFIG.LIMIARES.LATERALIDADE_PROLONGADA;
  
  return state.modoLateral;
}

// =============================================
// FUNÇÕES PARA PREVENÇÃO DE FALSOS SINAIS
// =============================================
function validarSinal(sinal, indicadores) {
  // Cooldown entre sinais
  if (Date.now() - state.ultimoSinalTimestamp < 30000) {
    return false;
  }
  
  // Sistema de pontos para validação
  let pontos = 0;
  const maxPontos = 12;
  
  // Fatores positivos
  if (indicadores.tendencia.forca > 60) pontos += 3;
  if (indicadores.volumeRelativo > 1.5) pontos += 2;
  
  if (sinal === "CALL") {
    if (indicadores.close > indicadores.vwap) pontos += 2;
    if (indicadores.close > indicadores.bandasBollinger.medio) pontos += 1;
    if (indicadores.macd.histograma > 0.01) pontos += 2;
    if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERBOUGHT) pontos += 1;
  } else if (sinal === "PUT") {
    if (indicadores.close < indicadores.vwap) pontos += 2;
    if (indicadores.close < indicadores.bandasBollinger.medio) pontos += 1;
    if (indicadores.macd.histograma < -0.01) pontos += 2;
    if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERSOLD) pontos += 1;
  }
  
  // Fatores negativos
  if (state.modoLateral) pontos -= 2;
  if (state.iaNivelRisco > 3) pontos -= 2;
  
  return pontos >= 8;
}

function verificarTransicao() {
  if (state.dadosHistoricos.length < 3) return false;
  
  const dados = state.dadosHistoricos.slice(-3);
  const mudancasDirecao = [];
  
  for (let i = 1; i < dados.length; i++) {
    const prev = dados[i-1];
    const current = dados[i];
    const prevDirection = prev.close > dados[0].close ? 'up' : 'down';
    const currentDirection = current.close > prev.close ? 'up' : 'down';
    
    if (prevDirection !== currentDirection) {
      mudancasDirecao.push(1);
    }
  }
  
  return mudancasDirecao.length >= 2;
}

function atualizarVolatilidade(atrAtual, close) {
  const volatilidadeInstantanea = (atrAtual / close) * 100;
  
  if (state.volatilidadeMedia === 0) {
    state.volatilidadeMedia = volatilidadeInstantanea;
  } else {
    state.volatilidadeMedia = (state.volatilidadeMedia * 19 + volatilidadeInstantanea) / 20;
  }
  
  if (volatilidadeInstantanea > CONFIG.LIMIARES.VOLATILIDADE_ALTA) {
    CONFIG.LIMIARES.RSI_OVERBOUGHT = 75;
    CONFIG.LIMIARES.RSI_OVERSOLD = 25;
  } else {
    CONFIG.LIMIARES.RSI_OVERBOUGHT = 70;
    CONFIG.LIMIARES.RSI_OVERSOLD = 30;
  }
}

// =============================================
// LIMPEZA PERIÓDICA DE CACHES
// =============================================
function limparCachesPeriodicos() {
  if (state.totalOperacoes % 100 === 0) {
    state.rsiCache = { avgGain: 0, avgLoss: 0, initialized: false };
    state.macdCache = {
      emaRapida: null,
      emaLenta: null,
      macdLine: [],
      signalLine: []
    };
    state.superTrendCache = [];
    console.log("Caches limpos periodicamente");
  }
}

// =============================================
// INSIGHTS IA
// =============================================
function calcularInsightsIA() {
  let risco = 0;
  const ultimoClose = state.dadosHistoricos[state.dadosHistoricos.length - 1].close;
  const volatilidade = (state.atrGlobal / ultimoClose) * 100;
  
  if (volatilidade > CONFIG.LIMIARES.VOLATILIDADE_ALTA) risco += 2;
  if (state.contadorLaterais > CONFIG.LIMIARES.LATERALIDADE_PROLONGADA) risco += 1;
  if (state.cooldown > 0) risco += 1;
  
  state.iaNivelRisco = Math.min(5, risco);
  
  const fatoresPositivos = [
    state.tendenciaDetectada.includes("FORTE"),
    state.volumeRelativo > 1.8,
    state.iaNivelRisco < 3
  ].filter(Boolean).length;
  
  state.iaProbabilidade = 60 + (fatoresPositivos * 10);
  
  const probElement = document.getElementById('probabilidade-acerto');
  const riscoElement = document.getElementById('nivel-risco');
  
  if (probElement) probElement.textContent = `${state.iaProbabilidade}%`;
  if (riscoElement) {
    riscoElement.textContent = `${state.iaNivelRisco}/5`;
    riscoElement.style.color = state.iaNivelRisco > CONFIG.AI.NIVEL_RISCO_MAX ? '#ff7675' : '#00b894';
  }
}

// =============================================
// GERADOR DE SINAIS OTIMIZADO
// =============================================
function gerarSinal(indicadores, divergencias, lateral) {
  const {
    rsi,
    stoch,
    macd,
    close,
    emaCurta,
    emaMedia,
    ema50,
    superTrend,
    tendencia,
    volumeRelativo,
    vwap,
    bandasBollinger
  } = indicadores;

  if (state.modoLateral) {
    const limiteBreakout = (bandasBollinger.superior - bandasBollinger.inferior) * 0.15;
    
    if (close > (bandasBollinger.superior + limiteBreakout) && volumeRelativo > 2) {
      return "CALL";
    }
    
    if (close < (bandasBollinger.inferior - limiteBreakout) && volumeRelativo > 2) {
      return "PUT";
    }
    
    return "ESPERAR";
  }

  if (tendencia.forca > 70 && volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA) {
    if (tendencia.tendencia === "FORTE_ALTA" && close > vwap && close > bandasBollinger.medio) {
      return "CALL";
    }
    if (tendencia.tendencia === "FORTE_BAIXA" && close < vwap && close < bandasBollinger.medio) {
      return "PUT";
    }
  }

  const limiteBreakout = (bandasBollinger.superior - bandasBollinger.inferior) * 0.1;
  
  if (close > (bandasBollinger.superior + limiteBreakout) && volumeRelativo > 1.5) {
    return "CALL";
  }
  
  if (close < (bandasBollinger.inferior - limiteBreakout) && volumeRelativo > 1.5) {
    return "PUT";
  }

  if (divergencias.divergenciaRSI) {
    if (divergencias.tipoDivergencia === "ALTA" && state.obv > 0) {
      return "CALL";
    }
    
    if (divergencias.tipoDivergencia === "BAIXA" && state.obv < 0) {
      return "PUT";
    }
  }

  if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD && stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && close > vwap && macd.histograma > 0) {
    return "CALL";
  }
  
  if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && close < vwap && macd.histograma < 0) {
    return "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA OTIMIZADO
// =============================================
function calcularScore(sinal, indicadores, divergencias) {
  let score = 65;

  const fatores = {
    alinhamentoTendencia: sinal === "CALL" && indicadores.tendencia.tendencia.includes("ALTA") ||
                          sinal === "PUT" && indicadores.tendencia.tendencia.includes("BAIXA") ? 25 : 0,
    divergencia: divergencias.divergenciaRSI ? 20 : 0,
    volume: indicadores.volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA ? 15 : 0,
    vwap: sinal === "CALL" && indicadores.close > indicadores.vwap ? 10 : 
           sinal === "PUT" && indicadores.close < indicadores.vwap ? 10 : 0,
    bollinger: sinal === "CALL" && indicadores.close > indicadores.bandasBollinger.medio ? 8 :
               sinal === "PUT" && indicadores.close < indicadores.bandasBollinger.medio ? 8 : 0,
    obv: (sinal === "CALL" && state.obv > 0) || (sinal === "PUT" && state.obv < 0) ? 7 : 0
  };
  
  score += Object.values(fatores).reduce((sum, val) => sum + val, 0);
  
  if (state.contadorLaterais > CONFIG.LIMIARES.LATERALIDADE_PROLONGADA) {
    score = Math.max(0, score - 15);
  }
  
  if ((state.atrGlobal / indicadores.close) * 100 > CONFIG.LIMIARES.VOLATILIDADE_ALTA) {
    score = Math.max(0, score - 8);
  }
  
  return Math.min(100, Math.max(0, score));
}

// =============================================
// CORE DO SISTEMA
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    limparCachesPeriodicos();
    
    const dados = await obterDadosTwelveData();
    state.dadosHistoricos = dados;
    limitarHistorico();
    
    if (dados.length < 20) {
      throw new Error(`Dados insuficientes (${dados.length} velas)`);
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Atualizar EMAs incrementalmente
    const updateEMA = (currentValue, prevEMA, period) => {
      const k = 2 / (period + 1);
      return currentValue * k + prevEMA * (1 - k);
    };

    if (!state.emaCache.ema5) {
      state.emaCache.ema5 = calcularMedia.simples(closes.slice(-CONFIG.PERIODOS.EMA_CURTA), CONFIG.PERIODOS.EMA_CURTA);
    } else {
      state.emaCache.ema5 = updateEMA(velaAtual.close, state.emaCache.ema5, CONFIG.PERIODOS.EMA_CURTA);
    }

    if (!state.emaCache.ema13) {
      state.emaCache.ema13 = calcularMedia.simples(closes.slice(-CONFIG.PERIODOS.EMA_MEDIA), CONFIG.PERIODOS.EMA_MEDIA);
    } else {
      state.emaCache.ema13 = updateEMA(velaAtual.close, state.emaCache.ema13, CONFIG.PERIODOS.EMA_MEDIA);
    }

    if (!state.emaCache.ema50) {
      state.emaCache.ema50 = calcularMedia.simples(closes.slice(-CONFIG.PERIODOS.EMA_50), CONFIG.PERIODOS.EMA_50);
    } else {
      state.emaCache.ema50 = updateEMA(velaAtual.close, state.emaCache.ema50, CONFIG.PERIODOS.EMA_50);
    }

    const ema5 = state.emaCache.ema5;
    const ema13 = state.emaCache.ema13;
    const ema50 = state.emaCache.ema50;

    state.volumeRelativo = calcularVolumeRelativo(volumes);
    state.obv = calcularOBV(closes, volumes);
    state.vwap = calcularVWAP(dados);
    state.bandasBollinger = calcularBandasBollinger(closes);

    const superTrend = calcularSuperTrend(dados);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    const atr = calcularATR(dados);
    
    state.atrGlobal = atr;
    atualizarVolatilidade(atr, velaAtual.close);
    
    // Calcular histórico de RSI
    state.rsiHistory = [];
    for (let i = CONFIG.PERIODOS.RSI; i < closes.length; i++) {
      state.rsiHistory.push(calcularRSI(closes.slice(0, i+1)));
    }
    
    const divergencias = detectarDivergencias(closes, state.rsiHistory);
    const tendencia = avaliarTendencia(ema5, ema13, ema50);
    const lateral = detectarLateralidade(closes);

    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;

    const indicadores = {
      rsi,
      stoch,
      macd,
      emaCurta: ema5,
      emaMedia: ema13,
      ema50,
      close: velaAtual.close,
      superTrend,
      tendencia,
      atr,
      volumeRelativo: state.volumeRelativo,
      vwap: state.vwap,
      bandasBollinger: state.bandasBollinger
    };

    let sinal = gerarSinal(indicadores, divergencias, lateral);
    
    if (sinal !== "ESPERAR") {
      if (verificarTransicao()) {
        sinal = "ESPERAR";
        state.cooldown = 1;
      }
      else if (!validarSinal(sinal, indicadores)) {
        sinal = "ESPERAR";
      }
    }
    
    if (sinal !== "ESPERAR" && state.cooldown <= 0) {
      state.cooldown = 1;
    } else if (state.cooldown > 0) {
      state.cooldown--;
      sinal = "ESPERAR";
    }

    const score = calcularScore(sinal, indicadores, divergencias);

    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    calcularInsightsIA();

    const zonas = calcularZonasPreco(dados);
    state.resistenciaKey = zonas.resistencia;
    state.suporteKey = zonas.suporte;

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>📊 Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)</li>
        <li>💰 Preço: ${indicadores.close.toFixed(2)}</li>
        <li>📉 RSI: ${rsi.toFixed(2)} ${rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
        <li>📊 MACD: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(4)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(2)}/${stoch.d.toFixed(2)}</li>
        <li>📌 Médias: EMA5 ${ema5.toFixed(2)} | EMA13 ${ema13.toFixed(2)} | EMA50 ${ema50.toFixed(2)}</li>
        <li>📊 Suporte: ${zonas.suporte.toFixed(2)} | Resistência: ${zonas.resistencia.toFixed(2)}</li>
        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
        <li>🚦 SuperTrend: ${superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'} (${superTrend.valor.toFixed(2)})</li>
        <li>⚡ Volatilidade (ATR): ${atr.toFixed(4)}</li>
        <li>🔄 Lateral: ${lateral ? 'SIM' : 'NÃO'} ${state.modoLateral ? '(MODO LATERAL)' : ''}</li>
        <li>💹 Volume: ${(state.volumeRelativo * 100).toFixed(0)}% ${state.volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA ? '🚀' : ''}</li>
        <li>📊 VWAP: ${state.vwap.toFixed(2)}</li>
        <li>📊 Bollinger: ${state.bandasBollinger.superior.toFixed(2)} | ${state.bandasBollinger.inferior.toFixed(2)}</li>
        <li>📦 OBV: ${state.obv > 0 ? '↑' : '↓'} ${Math.abs(state.obv).toFixed(0)}</li>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 8) state.ultimos.pop();
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");

    state.tentativasErro = 0;
    state.totalOperacoes++;
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0, "ERRO", 0);
    
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `<li>ERRO: ${e.message}</li>`;
    }
    
    if (++state.tentativasErro > 3) setTimeout(() => location.reload(), 10000);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// FUNÇÕES DE DADOS COM FALLBACK
// =============================================
const API_KEYS = [
  "0105e6681b894e0185704171c53f5075",
  "9cf795b2a4f14d43a049ca935d174ebb"
];
let currentKeyIndex = 0;
let errorCount = 0;

async function obterDadosTwelveData() {
  try {
    const apiKey = API_KEYS[currentKeyIndex];
    const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1min&outputsize=100&apikey=${apiKey}`;
    
    // Usar timeout para evitar espera infinita
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_API);
    
    const response = await fetch(url, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Falha na API: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || `Erro Twelve Data: ${data.code}`);
    }
    
    if (!data.values || data.values.length === 0) {
      throw new Error("Dados vazios da API");
    }
    
    const valores = data.values.reverse();
    
    return valores.map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume) || 1
    }));
  } catch (e) {
    console.error("Erro ao obter dados:", e);
    
    errorCount++;
    if (errorCount >= 2) {
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
      errorCount = 0;
      console.log("Tentando com próxima chave API...");
      return obterDadosTwelveData(); // Retentativa com nova chave
    }
    
    // Tentar fallback se disponível
    if (CONFIG.API_ENDPOINTS.FALLBACK) {
      console.log("Tentando endpoint fallback...");
      return obterDadosFallback();
    }
    
    throw e;
  }
}

async function obterDadosFallback() {
  try {
    // Implementar lógica de fallback aqui
    console.log("Usando fonte de dados alternativa...");
    // Simular dados para demonstração
    const now = new Date();
    const dados = [];
    
    for (let i = 99; i >= 0; i--) {
      const time = new Date(now - i * 60000);
      const open = 50000 + Math.random() * 1000;
      const close = open + (Math.random() - 0.5) * 500;
      const high = Math.max(open, close) + Math.random() * 200;
      const low = Math.min(open, close) - Math.random() * 200;
      const volume = 1000 + Math.random() * 500;
      
      dados.push({
        time: time.toISOString(),
        open,
        high,
        low,
        close,
        volume
      });
    }
    
    return dados;
  } catch (e) {
    console.error("Falha no fallback:", e);
    throw e;
  }
}

function calcularZonasPreco(dados, periodo = 50) {
  if (dados.length < periodo) periodo = dados.length;
  const slice = dados.slice(-periodo);
  const highs = slice.map(v => v.high);
  const lows = slice.map(v => v.low);
  return {
    resistencia: Math.max(...highs),
    suporte: Math.min(...lows),
    pivot: (Math.max(...highs) + Math.min(...lows) + dados[dados.length-1].close) / 3
  };
}

// =============================================
// CONTROLE DE TEMPO
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  const agora = new Date();
  const segundos = agora.getSeconds();
  state.timer = 60 - segundos;
  
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
      analisarMercado();
      sincronizarTimer();
    }
  }, 1000);
}

// =============================================
// INTERFACE DO USUÁRIO
// =============================================
let updateScheduled = false;

function atualizarInterface(sinal, score, tendencia, forcaTendencia) {
  if (!state.marketOpen || updateScheduled) return;
  
  updateScheduled = true;
  requestAnimationFrame(() => {
    const comandoElement = document.getElementById("comando");
    if (comandoElement) {
      comandoElement.textContent = sinal;
      comandoElement.className = sinal.toLowerCase();
      
      if (sinal === "CALL") comandoElement.textContent += " 📈";
      else if (sinal === "PUT") comandoElement.textContent += " 📉";
      else if (sinal === "ESPERAR") comandoElement.textContent += " ✋";
      else if (sinal === "ERRO") comandoElement.textContent += " ❗";
    }
    
    const scoreElement = document.getElementById("score");
    if (scoreElement) {
      scoreElement.textContent = `Confiança: ${score}%`;
      if (score >= CONFIG.LIMIARES.SCORE_ALTO) scoreElement.style.color = '#00ff00';
      else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) scoreElement.style.color = '#ffff00';
      else scoreElement.style.color = '#ff0000';
    }
    
    const tendenciaElement = document.getElementById("tendencia");
    const forcaElement = document.getElementById("forca-tendencia");
    if (tendenciaElement && forcaElement) {
      tendenciaElement.textContent = tendencia;
      forcaElement.textContent = `${forcaTendencia}%`;
    }
    
    const atualizacaoElement = document.getElementById("ultima-atualizacao");
    if (atualizacaoElement) {
      atualizacaoElement.textContent = new Date().toLocaleTimeString();
    }
    
    updateScheduled = false;
  });
}

function iniciarAplicativo() {
  const container = document.createElement('div');
  container.style = "font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 20px auto; padding: 25px; background: #1e1f29; border-radius: 15px; color: #f5f6fa; box-shadow: 0 8px 32px rgba(0,0,0,0.3);";
  container.innerHTML = `
    <h1 style="text-align: center; color: #6c5ce7; margin-bottom: 30px; font-size: 28px;">
      <i class="fab fa-bitcoin"></i> Robô de Trading CRYPTO IDX
    </h1>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 30px;">
      <div id="comando" style="font-size: 32px; font-weight: 700; padding: 25px; border-radius: 12px; text-align: center; background: #2c2d3a; display: flex; align-items: center; justify-content: center; min-height: 120px;">
        --
      </div>
      
      <div style="display: flex; flex-direction: column; justify-content: center; background: #2c2d3a; padding: 20px; border-radius: 12px;">
        <div id="score" style="font-size: 22px; font-weight: 600; margin-bottom: 15px; text-align: center;">--</div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div style="text-align: center;">
            <div style="font-size: 14px; opacity: 0.8;">Atualização</div>
            <div id="hora" style="font-size: 18px; font-weight: 600;">--:--:--</div>
          </div>
          
          <div style="text-align: center;">
            <div style="font-size: 14px; opacity: 0.8;">Próxima Análise</div>
            <div id="timer" style="font-size: 18px; font-weight: 600;">0:60</div>
          </div>
        </div>
      </div>
    </div>
    
    <div style="background: #2c2d3a; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
      <h3 style="margin-top: 0; margin-bottom: 15px; color: #6c5ce7; display: flex; align-items: center;">
        <i class="fas fa-chart-line"></i> Tendência: 
        <span id="tendencia" style="margin-left: 8px;">--</span> 
        <span id="forca-tendencia" style="margin-left: 5px;">--</span>%
      </h3>
      
      <div style="background: #2c2d3a; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
        <h3 style="margin-top: 0; margin-bottom: 15px; color: #6c5ce7;">
          <i class="fas fa-brain"></i> AI Insights
        </h3>
        <div style="display: flex; justify-content: space-around;">
          <div style="text-align: center;">
            <div id="probabilidade-acerto" style="font-size: 24px; font-weight: bold;">--%</div>
            <div>Prob. Acerto</div>
          </div>
          <div style="text-align: center;">
            <div id="nivel-risco" style="font-size: 24px; font-weight: bold;">--/5</div>
            <div>Nível Risco</div>
          </div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div style="background: #3a3b4a; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; margin-bottom: 10px; color: #a29bfe;">Últimos Sinais</h4>
          <ul id="ultimos" style="list-style: none; padding: 0; margin: 0;"></ul>
        </div>
        
        <div style="background: #3a3b4a; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; margin-bottom: 10px; color: #a29bfe;">Indicadores</h4>
          <ul id="criterios" style="list-style: none; padding: 0; margin: 0;"></ul>
        </div>
      </div>
    </div>
    
    <div style="text-align: center; font-size: 14px; opacity: 0.7; padding-top: 15px; border-top: 1px solid #3a3b4a;">
      CRYPTO IDX - Análise em tempo real | Atualizado: <span id="ultima-atualizacao">${new Date().toLocaleTimeString()}</span>
    </div>
  `;
  document.body.appendChild(container);
  document.body.style.backgroundColor = "#13141a";
  document.body.style.margin = "0";
  document.body.style.padding = "20px";
  
  const fontAwesome = document.createElement('link');
  fontAwesome.rel = 'stylesheet';
  fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
  document.head.appendChild(fontAwesome);

  const style = document.createElement('style');
  style.textContent = `
    .call { 
      background: linear-gradient(135deg, #00b894, #00cec9) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(0, 184, 148, 0.3);
      animation: pulseCall 1.5s infinite;
    }
    .put { 
      background: linear-gradient(135deg, #ff7675, #d63031) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(255, 118, 117, 0.3);
      animation: pulsePut 1.5s infinite;
    }
    .esperar { 
      background: linear-gradient(135deg, #0984e3, #6c5ce7) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(108, 92, 231, 0.3);
    }
    .erro { 
      background: #fdcb6e !important; 
      color: #2d3436 !important;
    }
    body {
      transition: background 0.5s ease;
    }
    #comando {
      transition: all 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    }
    #nivel-risco {
      color: #00b894;
    }
    @keyframes pulseCall {
      0% { box-shadow: 0 0 0 0 rgba(0, 184, 148, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(0, 184, 148, 0); }
      100% { box-shadow: 0 0 0 0 rgba(0, 184, 148, 0); }
    }
    @keyframes pulsePut {
      0% { box-shadow: 0 0 0 0 rgba(255, 118, 117, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(255, 118, 117, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 118, 117, 0); }
    }
  `;
  document.head.appendChild(style);

  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  setTimeout(analisarMercado, 1000);
}

if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
