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
  volumeAnterior: 0
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
    EMA_50: 50,
    EMA_LONGA: 200,
    MACD_RAPIDA: 6,
    MACD_LENTA: 13,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 7,
    DIVERGENCIA_LOOKBACK: 8,
    EXTREME_LOOKBACK: 2,
    BOLLINGER: 20,
    VOLUME_LOOKBACK: 10,
    VWAP: 20
  },
  LIMIARES: {
    SCORE_ALTO: 85,
    SCORE_MEDIO: 70,
    RSI_OVERBOUGHT: 78,
    RSI_OVERSOLD: 22,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    VARIACAO_LATERAL: 0.008,
    ATR_LIMIAR: 0.025,
    LATERALIDADE_LIMIAR: 0.008,
    VOLUME_ALERTA: 1.5,
    VOLUME_MINIMO: 10000
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
  }
};

// =============================================
// GERENCIADOR DE CHAVES API
// =============================================
const API_KEYS = [
  "0105e6681b894e0185704171c53f5075",
  "9cf795b2a4f14d43a049ca935d174ebb"
];
let currentKeyIndex = 0;
let errorCount = 0;

// =============================================
// SISTEMA DE TENDÊNCIA OTIMIZADO (COM EMA50)
// =============================================
function avaliarTendencia(ema5, ema13, ema50) {
  const diffCurta = ema5 - ema13;
  const diffLonga = ema13 - ema50;
  const forca = Math.min(100, (Math.abs(diffCurta) * 5000 + Math.abs(diffLonga) * 3000));
  
  if (forca > 80) {
    return diffCurta > 0 && diffLonga > 0 
      ? { tendencia: "FORTE_ALTA", forca }
      : diffCurta < 0 && diffLonga < 0 
        ? { tendencia: "FORTE_BAIXA", forca }
        : { tendencia: "NEUTRA", forca: 0 };
  }
  
  if (forca > 45) {
    return diffCurta > 0 
      ? { tendencia: "ALTA", forca } 
      : { tendencia: "BAIXA", forca };
  }
  
  return { tendencia: "NEUTRA", forca: 0 };
}

// =============================================
// DETECÇÃO DE LATERALIDADE (OTIMIZADA)
// =============================================
function detectarLateralidade(closes, periodo = CONFIG.PERIODOS.ANALISE_LATERAL, limiar = CONFIG.LIMIARES.LATERALIDADE_LIMIAR) {
  if (closes.length < periodo) return false;
  
  let countLaterais = 0;
  for (let i = closes.length - 1; i > closes.length - periodo; i--) {
    const variacao = Math.abs((closes[i] - closes[i-1]) / closes[i-1]);
    if (variacao < limiar) countLaterais++;
  }
  
  state.contadorLaterais = countLaterais;
  return countLaterais > periodo * 0.7;
}

// =============================================
// CÁLCULO DE SUPORTE/RESISTÊNCIA
// =============================================
function calcularZonasPreco(dados, periodo = 50) {
  if (dados.length < periodo) periodo = dados.length;
  const slice = dados.slice(-periodo);
  const highs = slice.map(v => v.high);
  const lows = slice.map(v => v.low);
  
  // Calcular pivot points
  const pivot = (Math.max(...highs) + Math.min(...lows) + dados[dados.length-1].close) / 3;
  
  return {
    resistencia: Math.max(...highs),
    suporte: Math.min(...lows),
    pivot: pivot,
    r1: (2 * pivot) - Math.min(...lows),
    s1: (2 * pivot) - Math.max(...highs)
  };
}

// =============================================
// NOVOS INDICADORES PARA CRIPTO (OTIMIZADOS)
// =============================================

// 1. Volume Relativo com suavização
function calcularVolumeRelativo(volumes, periodo = CONFIG.PERIODOS.VOLUME_LOOKBACK) {
  if (volumes.length < periodo) return 0;
  
  const slice = volumes.slice(-periodo);
  const mediaVolume = calcularMedia.simples(slice, periodo);
  const ultimoVolume = volumes[volumes.length - 1];
  
  // Suavização para evitar picos extremos
  return Math.min(3, ultimoVolume / mediaVolume);
}

// 2. On-Balance Volume (OBV) incremental
function atualizarOBV(closeAtual, closeAnterior, volumeAtual) {
  if (closeAtual > closeAnterior) {
    state.obv += volumeAtual;
  } else if (closeAtual < closeAnterior) {
    state.obv -= volumeAtual;
  }
  return state.obv;
}

// 3. Volume Weighted Average Price (VWAP) incremental
function atualizarVWAP(dados) {
  if (dados.length < 2) return 0;
  
  const ultimo = dados[dados.length - 1];
  const penultimo = dados[dados.length - 2];
  
  const tp = (ultimo.high + ultimo.low + ultimo.close) / 3;
  const volumeTP = tp * ultimo.volume;
  
  // Atualização incremental para performance
  if (state.vwap === 0) {
    state.vwap = tp;
  } else {
    state.vwap = ((state.vwap * state.volumeAnterior) + volumeTP) / (state.volumeAnterior + ultimo.volume);
  }
  
  state.volumeAnterior += ultimo.volume;
  return state.vwap;
}

// 4. Bandas de Bollinger com EMA
function calcularBandasBollinger(closes, periodo = CONFIG.PERIODOS.BOLLINGER, desvios = 2) {
  if (closes.length < periodo) return { superior: 0, inferior: 0, medio: 0 };
  
  const slice = closes.slice(-periodo);
  const media = calcularMedia.exponencialIncremental(slice, periodo, state.emaCache.bollinger);
  
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
// GERADOR DE SINAIS OTIMIZADO (COM NOVAS REGRAS)
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
    bandasBollinger,
    pivotPoints
  } = indicadores;

  // Filtro de volume mínimo
  if (indicadores.volumeAtual < CONFIG.LIMIARES.VOLUME_MINIMO) {
    return "ESPERAR";
  }

  // 1. Tendência forte com confirmação de volume e VWAP
  if (tendencia.forca > 80 && volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA) {
    if (tendencia.tendencia === "FORTE_ALTA" && 
        close > vwap && 
        close > bandasBollinger.medio &&
        close > pivotPoints.r1) {
      return "CALL";
    }
    if (tendencia.tendencia === "FORTE_BAIXA" && 
        close < vwap && 
        close < bandasBollinger.medio &&
        close < pivotPoints.s1) {
      return "PUT";
    }
  }

  // 2. Breakout com confirmação de volume e Bollinger
  const limiteBreakout = (bandasBollinger.superior - bandasBollinger.inferior) * 0.1;
  
  if (close > (bandasBollinger.superior + limiteBreakout) && 
      volumeRelativo > 1.8 &&
      macd.histograma > 0) {
    return "CALL";
  }
  
  if (close < (bandasBollinger.inferior - limiteBreakout) && 
      volumeRelativo > 1.8 &&
      macd.histograma < 0) {
    return "PUT";
  }

  // 3. Divergências com confirmação de OBV e pivot points
  if (divergencias.divergenciaRSI) {
    if (divergencias.tipoDivergencia === "ALTA" && 
        state.obv > 0 &&
        close > pivotPoints.pivot) {
      return "CALL";
    }
    
    if (divergencias.tipoDivergencia === "BAIXA" && 
        state.obv < 0 &&
        close < pivotPoints.pivot) {
      return "PUT";
    }
  }

  // 4. Reversão com múltiplas confirmações
  if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD && 
      stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && 
      close > vwap && 
      macd.histograma > 0 &&
      close > ema50) {
    return "CALL";
  }
  
  if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && 
      stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && 
      close < vwap && 
      macd.histograma < 0 &&
      close < ema50) {
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
    obv: (sinal === "CALL" && state.obv > 0) || (sinal === "PUT" && state.obv < 0) ? 7 : 0,
    pivot: sinal === "CALL" && indicadores.close > indicadores.pivotPoints.r1 ? 5 :
            sinal === "PUT" && indicadores.close < indicadores.pivotPoints.s1 ? 5 : 0
  };
  
  score += Object.values(fatores).reduce((sum, val) => sum + val, 0);
  
  // Penalizar lateralidade prolongada
  if (state.contadorLaterais > 5) score = Math.max(0, score - 15);
  
  // Penalizar volume baixo
  if (indicadores.volumeAtual < CONFIG.LIMIARES.VOLUME_MINIMO) score = Math.max(0, score - 20);
  
  return Math.min(100, Math.max(0, score));
}

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

function atualizarInterface(sinal, score, tendencia, forcaTendencia, dadosAdicionais) {
  if (!state.marketOpen) return;
  
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    if (sinal === "CALL") comandoElement.innerHTML = "CALL 📈";
    else if (sinal === "PUT") comandoElement.innerHTML = "PUT 📉";
    else if (sinal === "ESPERAR") comandoElement.innerHTML = "ESPERAR ✋";
    else if (sinal === "ERRO") comandoElement.innerHTML = "ERRO ⚠️";
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
  
  // Atualizar dados adicionais
  if (dadosAdicionais) {
    const dadosElement = document.getElementById("dados-adicionais");
    if (dadosElement) {
      dadosElement.innerHTML = `
        <div>💰 Preço: ${dadosAdicionais.close.toFixed(2)}</div>
        <div>📊 Volume: ${dadosAdicionais.volumeAtual.toLocaleString()}</div>
        <div>📈 Variação: ${dadosAdicionais.variacao.toFixed(2)}%</div>
      `;
    }
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
    let ema = calcularMedia.simples(dados.slice(0, periodo), periodo);
    const emaArray = [ema];
    
    for (let i = periodo; i < dados.length; i++) {
      ema = dados[i] * k + ema * (1 - k);
      emaArray.push(ema);
    }
    
    return emaArray;
  },
  
  exponencialIncremental: (dados, periodo, cache) => {
    if (!cache || cache.value === null || dados.length < periodo) {
      return calcularMedia.exponencial(dados, periodo).pop();
    }
    
    const ultimoValor = dados[dados.length - 1];
    const k = 2 / (periodo + 1);
    return ultimoValor * k + cache.value * (1 - k);
  }
};

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) return 50;
  
  if (!state.rsiCache.initialized) {
    let gains = 0, losses = 0;
    for (let i = 1; i <= periodo; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    
    state.rsiCache.avgGain = gains / periodo;
    state.rsiCache.avgLoss = losses / periodo;
    state.rsiCache.initialized = true;
    
    const rs = state.rsiCache.avgLoss === 0 ? Infinity : state.rsiCache.avgGain / state.rsiCache.avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  const diff = closes[closes.length - 1] - closes[closes.length - 2];
  
  if (diff > 0) {
    state.rsiCache.avgGain = ((state.rsiCache.avgGain * (periodo - 1)) + diff) / periodo;
    state.rsiCache.avgLoss = (state.rsiCache.avgLoss * (periodo - 1)) / periodo;
  } else {
    state.rsiCache.avgGain = (state.rsiCache.avgGain * (periodo - 1)) / periodo;
    state.rsiCache.avgLoss = ((state.rsiCache.avgLoss * (periodo - 1)) - diff) / periodo;
  }
  
  const rs = state.rsiCache.avgLoss === 0 ? Infinity : state.rsiCache.avgGain / state.rsiCache.avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, 
                          periodoK = CONFIG.PERIODOS.STOCH_K, 
                          periodoD = CONFIG.PERIODOS.STOCH_D) {
  try {
    if (closes.length < periodoK) return { k: 50, d: 50 };
    
    const kValues = [];
    for (let i = periodoK - 1; i < closes.length; i++) {
      const startIndex = Math.max(0, i - periodoK + 1);
      const sliceHigh = highs.slice(startIndex, i + 1);
      const sliceLow = lows.slice(startIndex, i + 1);
      
      if (sliceHigh.length === 0 || sliceLow.length === 0) {
        kValues.push(50);
        continue;
      }
      
      const highestHigh = Math.max(...sliceHigh);
      const lowestLow = Math.min(...sliceLow);
      const range = highestHigh - lowestLow;
      const k = range !== 0 ? ((closes[i] - lowestLow) / range) * 100 : 50;
      kValues.push(k);
    }
    
    const kSuavizado = [];
    for (let i = periodoD - 1; i < kValues.length; i++) {
      const startIndex = Math.max(0, i - periodoD + 1);
      const slice = kValues.slice(startIndex, i + 1);
      const mediaK = calcularMedia.simples(slice, periodoD) || 50;
      kSuavizado.push(mediaK);
    }
    
    const dValues = [];
    for (let i = periodoD - 1; i < kSuavizado.length; i++) {
      const startIndex = Math.max(0, i - periodoD + 1);
      const slice = kSuavizado.slice(startIndex, i + 1);
      dValues.push(calcularMedia.simples(slice, periodoD) || 50);
    }
    
    return {
      k: kSuavizado[kSuavizado.length - 1] || 50,
      d: dValues[dValues.length - 1] || 50
    };
  } catch (e) {
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, 
                    lenta = CONFIG.PERIODOS.MACD_LENTA, 
                    sinal = CONFIG.PERIODOS.MACD_SINAL) {
  try {
    // Se primeira execução ou dados insuficientes
    if (state.macdCache.emaRapida === null || state.macdCache.emaLenta === null || closes.length < lenta) {
      const emaRapida = calcularMedia.exponencial(closes, rapida);
      const emaLenta = calcularMedia.exponencial(closes, lenta);
      
      const startIdx = Math.max(0, lenta - rapida);
      const macdLinha = emaRapida.slice(startIdx).map((val, idx) => val - emaLenta[idx]);
      const sinalLinha = calcularMedia.exponencial(macdLinha, sinal);
      
      state.macdCache = {
        emaRapida: emaRapida[emaRapida.length - 1],
        emaLenta: emaLenta[emaLenta.length - 1],
        macdLine: macdLinha,
        signalLine: sinalLinha
      };
      
      return {
        histograma: macdLinha[macdLinha.length - 1] - sinalLinha[sinalLinha.length - 1],
        macdLinha: macdLinha[macdLinha.length - 1],
        sinalLinha: sinalLinha[sinalLinha.length - 1]
      };
    }
    
    // Atualização incremental
    const kRapida = 2 / (rapida + 1);
    const kLenta = 2 / (lenta + 1);
    const kSinal = 2 / (sinal + 1);
    
    const novoValor = closes[closes.length - 1];
    
    // Atualizar EMAs
    state.macdCache.emaRapida = novoValor * kRapida + state.macdCache.emaRapida * (1 - kRapida);
    state.macdCache.emaLenta = novoValor * kLenta + state.macdCache.emaLenta * (1 - kLenta);
    
    // Calcular nova linha MACD
    const novaMacdLinha = state.macdCache.emaRapida - state.macdCache.emaLenta;
    
    // Atualizar linha de sinal
    let novoSinal;
    if (state.macdCache.signalLine.length === 0) {
      novoSinal = novaMacdLinha;
    } else {
      const ultimoSinal = state.macdCache.signalLine[state.macdCache.signalLine.length - 1];
      novoSinal = novaMacdLinha * kSinal + ultimoSinal * (1 - kSinal);
    }
    
    // Atualizar estado
    state.macdCache.macdLine.push(novaMacdLinha);
    state.macdCache.signalLine.push(novoSinal);
    
    return {
      histograma: novaMacdLinha - novoSinal,
      macdLinha: novaMacdLinha,
      sinalLinha: novoSinal
    };
  } catch (e) {
    console.error("Erro no cálculo MACD:", e);
    return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  }
}

function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo + 1) return 0;
    
    const trValues = [];
    for (let i = 1; i < dados.length; i++) {
      const tr = Math.max(
        dados[i].high - dados[i].low,
        Math.abs(dados[i].high - dados[i-1].close),
        Math.abs(dados[i].low - dados[i-1].close)
      );
      trValues.push(tr);
    }
    
    return calcularMedia.simples(trValues.slice(-periodo), periodo);
  } catch (e) {
    console.error("Erro no cálculo ATR:", e);
    return 0;
  }
}

function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3) {
  try {
    if (dados.length < periodo) return { direcao: 0, valor: 0 };
    
    // Recalcular ATR a cada execução
    state.atrGlobal = calcularATR(dados, periodo);
    
    const current = dados[dados.length - 1];
    const hl2 = (current.high + current.low) / 2;
    const atr = state.atrGlobal;
    
    const upperBand = hl2 + (multiplicador * atr);
    const lowerBand = hl2 - (multiplicador * atr);
    
    let superTrend;
    let direcao;
    
    if (state.superTrendCache.length === 0) {
      superTrend = upperBand;
      direcao = 1;
    } else {
      const prev = dados[dados.length - 2];
      const prevSuperTrend = state.superTrendCache[state.superTrendCache.length - 1];
      
      if (prev.close > prevSuperTrend.valor) {
        direcao = 1;
        superTrend = Math.max(lowerBand, prevSuperTrend.valor);
      } else {
        direcao = -1;
        superTrend = Math.min(upperBand, prevSuperTrend.valor);
      }
    }
    
    state.superTrendCache.push({ direcao, valor: superTrend });
    return { direcao, valor: superTrend };
    
  } catch (e) {
    console.error("Erro no cálculo SuperTrend:", e);
    return { direcao: 0, valor: 0 };
  }
}

function detectarDivergencias(closes, rsis, highs, lows) {
  try {
    const lookback = CONFIG.PERIODOS.DIVERGENCIA_LOOKBACK;
    
    if (closes.length < lookback || rsis.length < lookback) {
      return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
    }
    
    // Encontrar máximos e mínimos nos preços
    const priceHighs = [];
    const priceLows = [];
    
    for (let i = closes.length - lookback; i < closes.length; i++) {
      if (i > 0 && i < closes.length - 1) {
        if (closes[i] > closes[i-1] && closes[i] > closes[i+1]) {
          priceHighs.push({index: i, value: closes[i]});
        }
        if (closes[i] < closes[i-1] && closes[i] < closes[i+1]) {
          priceLows.push({index: i, value: closes[i]});
        }
      }
    }
    
    // Encontrar máximos e mínimos no RSI
    const rsiHighs = [];
    const rsiLows = [];
    
    for (let i = rsis.length - lookback; i < rsis.length; i++) {
      if (i > 0 && i < rsis.length - 1) {
        if (rsis[i] > rsis[i-1] && rsis[i] > rsis[i+1]) {
          rsiHighs.push({index: i, value: rsis[i]});
        }
        if (rsis[i] < rsis[i-1] && rsis[i] < rsis[i+1]) {
          rsiLows.push({index: i, value: rsis[i]});
        }
      }
    }
    
    // Verificar divergências regulares
    let divergenciaAlta = false;
    let divergenciaBaixa = false;
    
    // Divergência de baixa (preço faz máximas mais altas, RSI máximas mais baixas)
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const ultimoPreco = priceHighs[priceHighs.length - 1];
      const penultimoPreco = priceHighs[priceHighs.length - 2];
      const ultimoRSI = rsiHighs[rsiHighs.length - 1];
      const penultimoRSI = rsiHighs[rsiHighs.length - 2];
      
      if (ultimoPreco.value > penultimoPreco.value && ultimoRSI.value < penultimoRSI.value) {
        divergenciaBaixa = true;
      }
    }
    
    // Divergência de alta (preço faz mínimas mais baixas, RSI mínimas mais altas)
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
      const ultimoPreco = priceLows[priceLows.length - 1];
      const penultimoPreco = priceLows[priceLows.length - 2];
      const ultimoRSI = rsiLows[rsiLows.length - 1];
      const penultimoRSI = rsiLows[rsiLows.length - 2];
      
      if (ultimoPreco.value < penultimoPreco.value && ultimoRSI.value > penultimoRSI.value) {
        divergenciaAlta = true;
      }
    }
    
    return {
      divergenciaRSI: divergenciaAlta || divergenciaBaixa,
      tipoDivergencia: divergenciaAlta ? "ALTA" : divergenciaBaixa ? "BAIXA" : "NENHUMA"
    };
  } catch (e) {
    console.error("Erro na detecção de divergências:", e);
    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
  }
}

// =============================================
// CORE DO SISTEMA (OTIMIZADO)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    state.dadosHistoricos = dados;
    
    if (dados.length < 30) {
      throw new Error(`Dados insuficientes (${dados.length} velas)`);
    }
    
    const velaAtual = dados[dados.length - 1];
    const velaAnterior = dados[dados.length - 2];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);
    
    // Calcular variação percentual
    const variacao = ((velaAtual.close - velaAnterior.close) / velaAnterior.close) * 100;

    // Calcular EMAs de forma incremental
    const ema5 = calcularMedia.exponencialIncremental(closes, CONFIG.PERIODOS.EMA_CURTA, state.emaCache.ema5);
    const ema13 = calcularMedia.exponencialIncremental(closes, CONFIG.PERIODOS.EMA_MEDIA, state.emaCache.ema13);
    const ema50 = calcularMedia.exponencialIncremental(closes, CONFIG.PERIODOS.EMA_50, state.emaCache.ema50);
    
    // Atualizar cache de EMAs
    state.emaCache = {
      ema5: { value: ema5 },
      ema13: { value: ema13 },
      ema50: { value: ema50 },
      ema200: state.emaCache.ema200,
      bollinger: state.emaCache.bollinger
    };

    // Calcular novos indicadores
    state.volumeRelativo = calcularVolumeRelativo(volumes);
    state.obv = atualizarOBV(velaAtual.close, velaAnterior.close, velaAtual.volume);
    state.vwap = atualizarVWAP(dados);
    state.bandasBollinger = calcularBandasBollinger(closes);
    const pivotPoints = calcularZonasPreco(dados);

    const superTrend = calcularSuperTrend(dados);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    
    // Preencher histórico de RSI
    if (state.rsiHistory.length === 0) {
      for (let i = CONFIG.PERIODOS.RSI; i < closes.length; i++) {
        state.rsiHistory.push(calcularRSI(closes.slice(0, i+1)));
      }
    } else {
      state.rsiHistory.push(calcularRSI(closes));
    }
    
    const divergencias = detectarDivergencias(closes, state.rsiHistory, highs, lows);
    const tendencia = avaliarTendencia(ema5, ema13, ema50);
    const lateral = detectarLateralidade(closes);

    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;
    state.resistenciaKey = pivotPoints.resistencia;
    state.suporteKey = pivotPoints.suporte;

    const indicadores = {
      rsi,
      stoch: stoch,
      macd,
      emaCurta: ema5,
      emaMedia: ema13,
      ema50,
      close: velaAtual.close,
      superTrend,
      tendencia,
      atr: state.atrGlobal,
      volumeRelativo: state.volumeRelativo,
      volumeAtual: velaAtual.volume,
      vwap: state.vwap,
      bandasBollinger: state.bandasBollinger,
      pivotPoints,
      variacao
    };

    let sinal = gerarSinal(indicadores, divergencias, lateral);
    
    // Aplicar cooldown
    if (sinal !== "ESPERAR" && state.cooldown <= 0) {
      state.cooldown = 3;
    } else if (state.cooldown > 0) {
      state.cooldown--;
      sinal = "ESPERAR";
    }

    const score = calcularScore(sinal, indicadores, divergencias);

    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia, {
      close: velaAtual.close,
      volumeAtual: velaAtual.volume,
      variacao
    });

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>📊 Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)</li>
        <li>💰 Preço: ${indicadores.close.toFixed(2)}</li>
        <li>📉 RSI: ${rsi.toFixed(2)} ${rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
        <li>📊 MACD: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(4)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(2)}/${stoch.d.toFixed(2)}</li>
        <li>📌 Médias: EMA5 ${ema5.toFixed(2)} | EMA13 ${ema13.toFixed(2)} | EMA50 ${ema50.toFixed(2)}</li>
        <li>📊 Suporte: ${state.suporteKey.toFixed(2)} | Resistência: ${state.resistenciaKey.toFixed(2)}</li>
        <li>📌 Pivot: ${pivotPoints.pivot.toFixed(2)} | R1: ${pivotPoints.r1.toFixed(2)} | S1: ${pivotPoints.s1.toFixed(2)}</li>
        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
        <li>🚦 SuperTrend: ${superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'} (${superTrend.valor.toFixed(2)})</li>
        <li>⚡ Volatilidade (ATR): ${state.atrGlobal.toFixed(4)}</li>
        <li>🔄 Lateral: ${lateral ? 'SIM' : 'NÃO'}</li>
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
// FUNÇÕES DE DADOS (TWELVE DATA API - OTIMIZADA)
// =============================================
async function obterDadosTwelveData() {
  try {
    const apiKey = API_KEYS[currentKeyIndex];
    const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1min&outputsize=100&apikey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Falha na API: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || `Erro Twelve Data: ${data.code}`);
    }
    
    const valores = data.values ? data.values.reverse() : [];
    
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
      console.log(`Alternando para chave API: ${currentKeyIndex}`);
    }
    
    throw e;
  }
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
// INICIALIZAÇÃO (INTERFACE MELHORADA)
// =============================================
function iniciarAplicativo() {
  // Criar interface
  const container = document.createElement('div');
  container.style = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
    max-width: 900px; 
    margin: 20px auto; 
    padding: 25px; 
    background: #1e1f29; 
    border-radius: 15px; 
    color: #f5f6fa; 
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    border: 1px solid #33344a;
  `;
  container.innerHTML = `
    <h1 style="text-align: center; color: #6c5ce7; margin-bottom: 25px; font-size: 28px; display: flex; align-items: center; justify-content: center;">
      <i class="fab fa-bitcoin" style="margin-right: 12px;"></i> 
      Robô de Trading CRYPTO IDX
      <i class="fas fa-robot" style="margin-left: 12px;"></i>
    </h1>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
      <div id="comando" style="
        font-size: 32px; 
        font-weight: 700; 
        padding: 25px; 
        border-radius: 12px; 
        text-align: center; 
        background: #2c2d3a; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        min-height: 120px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        border: 1px solid #3a3b4a;
      ">
        --
      </div>
      
      <div style="
        display: flex; 
        flex-direction: column; 
        justify-content: center; 
        background: #2c2d3a; 
        padding: 20px; 
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        border: 1px solid #3a3b4a;
      ">
        <div id="score" style="
          font-size: 22px; 
          font-weight: 600; 
          margin-bottom: 15px; 
          text-align: center;
        ">--</div>
        
        <div id="dados-adicionais" style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 15px;
          font-size: 14px;
        ">
          <div>💰 Preço: --</div>
          <div>📊 Volume: --</div>
          <div>📈 Variação: --</div>
        </div>
        
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
    
    <div style="
      background: #2c2d3a; 
      padding: 20px; 
      border-radius: 12px; 
      margin-bottom: 25px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      border: 1px solid #3a3b4a;
    ">
      <h3 style="
        margin-top: 0; 
        margin-bottom: 15px; 
        color: #6c5ce7; 
        display: flex; 
        align-items: center;
      ">
        <i class="fas fa-chart-line" style="margin-right: 8px;"></i> 
        Tendência: 
        <span id="tendencia" style="margin-left: 8px; font-weight: 600;">--</span> 
        <span id="forca-tendencia" style="margin-left: 5px; font-weight: 600;">--</span>%
      </h3>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div style="
          background: #3a3b4a; 
          padding: 15px; 
          border-radius: 8px;
          border: 1px solid #4a4b5a;
        ">
          <h4 style="
            margin-top: 0; 
            margin-bottom: 10px; 
            color: #a29bfe;
            display: flex;
            align-items: center;
          ">
            <i class="fas fa-history" style="margin-right: 8px;"></i>
            Últimos Sinais
          </h4>
          <ul id="ultimos" style="
            list-style: none; 
            padding: 0; 
            margin: 0; 
            max-height: 200px; 
            overflow-y: auto;
          "></ul>
        </div>
        
        <div style="
          background: #3a3b4a; 
          padding: 15px; 
          border-radius: 8px;
          border: 1px solid #4a4b5a;
        ">
          <h4 style="
            margin-top: 0; 
            margin-bottom: 10px; 
            color: #a29bfe;
            display: flex;
            align-items: center;
          ">
            <i class="fas fa-chart-bar" style="margin-right: 8px;"></i>
            Indicadores
          </h4>
          <ul id="criterios" style="
            list-style: none; 
            padding: 0; 
            margin: 0; 
            max-height: 200px; 
            overflow-y: auto;
          "></ul>
        </div>
      </div>
    </div>
    
    <div style="
      text-align: center; 
      font-size: 14px; 
      opacity: 0.7; 
      padding-top: 15px; 
      border-top: 1px solid #3a3b4a;
    ">
      <i class="fas fa-sync-alt" style="margin-right: 5px;"></i>
      CRYPTO IDX - Análise em tempo real | Atualizado: 
      <span id="ultima-atualizacao">${new Date().toLocaleTimeString()}</span>
    </div>
  `;
  document.body.appendChild(container);
  document.body.style.backgroundColor = "#13141a";
  document.body.style.margin = "0";
  document.body.style.padding = "20px";
  
  // Adicionar Font Awesome
  const fontAwesome = document.createElement('link');
  fontAwesome.rel = 'stylesheet';
  fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
  document.head.appendChild(fontAwesome);

  // Adicionar estilos dinâmicos
  const style = document.createElement('style');
  style.textContent = `
    .call { 
      background: linear-gradient(135deg, #00b894, #00cec9) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(0, 184, 148, 0.4) !important;
      border: 1px solid #00cec9 !important;
      animation: pulseCall 2s infinite;
    }
    .put { 
      background: linear-gradient(135deg, #ff7675, #d63031) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(255, 118, 117, 0.4) !important;
      border: 1px solid #ff7675 !important;
      animation: pulsePut 2s infinite;
    }
    .esperar { 
      background: linear-gradient(135deg, #0984e3, #6c5ce7) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(108, 92, 231, 0.4) !important;
      border: 1px solid #6c5ce7 !important;
    }
    .erro { 
      background: linear-gradient(135deg, #fdcb6e, #e17055) !important; 
      color: #2d3436 !important;
    }
    body {
      transition: background 0.5s ease;
    }
    #comando {
      transition: all 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);
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
    #ultimos::-webkit-scrollbar, #criterios::-webkit-scrollbar {
      width: 6px;
    }
    #ultimos::-webkit-scrollbar-track, #criterios::-webkit-scrollbar-track {
      background: #2c2d3a;
    }
    #ultimos::-webkit-scrollbar-thumb, #criterios::-webkit-scrollbar-thumb {
      background: #6c5ce7;
      border-radius: 3px;
    }
  `;
  document.head.appendChild(style);

  // Iniciar processos
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  
  // Primeira análise
  setTimeout(analisarMercado, 1000);
}

// Iniciar quando o documento estiver pronto
if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
