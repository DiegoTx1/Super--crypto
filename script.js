// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS PARA CRYPTO IDX)
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
  cooldown: 0
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
    EMA_LONGA: 200,
    MACD_RAPIDA: 6,
    MACD_LENTA: 13,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 7,
    DIVERGENCIA_LOOKBACK: 8,
    EXTREME_LOOKBACK: 2
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
    BREAKOUT_THRESHOLD: 0.03
  },
  PESOS: {
    RSI: 1.7,
    MACD: 2.2,
    TENDENCIA: 2.8,
    STOCH: 1.2,
    SUPERTREND: 1.9,
    DIVERGENCIA: 2.0,
    VOLATILIDADE: 1.5
  }
};

// =============================================
// GERENCIADOR DE CHAVES API
// =============================================
const API_KEYS = [
  "9cf795b2a4f14d43a049ca935d174ebb",
  "0105e6681b894e0185704171c53f5075"
];
let currentKeyIndex = 0;
let errorCount = 0;

// =============================================
// SISTEMA DE TENDÊNCIA OTIMIZADO PARA CRIPTO
// =============================================
function avaliarTendencia(ema5, ema13) {
  if (ema5 === null || ema13 === null) {
    return { tendencia: "NEUTRA", forca: 0 };
  }
  
  const diff = ema5 - ema13;
  const forca = Math.min(100, Math.abs(diff * 10000));
  
  if (forca > 75) {
    return diff > 0 
      ? { tendencia: "FORTE_ALTA", forca }
      : { tendencia: "FORTE_BAIXA", forca };
  }
  
  if (forca > 40) {
    return diff > 0 
      ? { tendencia: "ALTA", forca } 
      : { tendencia: "BAIXA", forca };
  }
  
  return { tendencia: "NEUTRA", forca: 0 };
}

// =============================================
// DETECÇÃO DE LATERALIDADE (AJUSTADO PARA CRIPTO)
// =============================================
function detectarLateralidade(closes, periodo = CONFIG.PERIODOS.ANALISE_LATERAL, limiar = CONFIG.LIMIARES.LATERALIDADE_LIMIAR) {
  if (closes.length < periodo) return false;
  
  const variacoes = [];
  const startIndex = Math.max(0, closes.length - periodo);
  
  for (let i = startIndex + 1; i < closes.length; i++) {
    const variacao = Math.abs((closes[i] - closes[i - 1]) / closes[i - 1]);
    variacoes.push(variacao);
  }
  
  const mediaVariacao = variacoes.reduce((sum, val) => sum + val, 0) / variacoes.length;
  return mediaVariacao < limiar;
}

// =============================================
// CÁLCULO DE SUPORTE/RESISTÊNCIA PARA CRIPTO
// =============================================
function calcularZonasPreco(dados, periodo = 50) {
  if (dados.length < 2) return { resistencia: 0, suporte: 0, pivot: 0 };
  
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
// GERADOR DE SINAIS OTIMIZADO PARA CRIPTO
// =============================================
function gerarSinal(indicadores, divergencias, lateral) {
  const {
    rsi,
    stoch,
    macd,
    close,
    emaCurta,
    emaMedia,
    superTrend,
    tendencia,
    atr
  } = indicadores;
  
  // Cálculo de suporte/resistência
  const zonas = calcularZonasPreco(state.dadosHistoricos);
  state.suporteKey = zonas.suporte;
  state.resistenciaKey = zonas.resistencia;
  
  // Priorizar tendência forte em cripto
  if (tendencia.forca > 80) {
    if (tendencia.tendencia.includes("ALTA") && 
        close > emaCurta && 
        macd.histograma > 0 &&
        superTrend.direcao > 0) {
      return "CALL";
    }
    if (tendencia.tendencia.includes("BAIXA") && 
        close < emaCurta && 
        macd.histograma < 0 &&
        superTrend.direcao < 0) {
      return "PUT";
    }
  }

  // Breakout em criptomoedas
  const variacao = state.resistenciaKey - state.suporteKey;
  const limiteBreakout = variacao * CONFIG.LIMIARES.BREAKOUT_THRESHOLD;
  
  if (close > (state.resistenciaKey + limiteBreakout)) {
    return "CALL";
  }
  
  if (close < (state.suporteKey - limiteBreakout)) {
    return "PUT";
  }
  
  // Divergências em RSI (muito importantes em cripto)
  if (divergencias.divergenciaRSI) {
    if (divergencias.tipoDivergencia === "ALTA" && 
        close > state.suporteKey &&
        stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD) {
      return "CALL";
    }
    
    if (divergencias.tipoDivergencia === "BAIXA" && 
        close < state.resistenciaKey &&
        stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
      return "PUT";
    }
  }
  
  // Condições específicas para cripto
  if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD && 
      close > emaMedia && 
      superTrend.direcao > 0) {
    return "CALL";
  }
  
  if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && 
      close < emaMedia && 
      superTrend.direcao < 0) {
    return "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA PARA CRIPTO
// =============================================
function calcularScore(sinal, indicadores, divergencias) {
  let score = 65;

  const fatores = {
    alinhamentoTendencia: sinal === "CALL" && indicadores.tendencia.tendencia.includes("ALTA") ||
                          sinal === "PUT" && indicadores.tendencia.tendencia.includes("BAIXA") ? 25 : 0,
    divergencia: divergencias.divergenciaRSI ? 20 : 0,
    posicaoMedia: sinal === "CALL" && indicadores.close > indicadores.emaMedia ? 15 : 
                  sinal === "PUT" && indicadores.close < indicadores.emaMedia ? 15 : 0,
    superTrend: sinal === "CALL" && indicadores.close > indicadores.superTrend.valor ? 10 :
                sinal === "PUT" && indicadores.close < indicadores.superTrend.valor ? 10 : 0,
    volatilidade: (indicadores.atr / indicadores.close) > 0.02 ? 15 : 5
  };
  
  score += Object.values(fatores).reduce((sum, val) => sum + val, 0);
  
  // Penalizar lateralidade
  if (state.contadorLaterais > 10) {
    score = Math.max(0, score - 20);
  }
  
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

function atualizarInterface(sinal, score, tendencia, forcaTendencia) {
  if (!state.marketOpen) return;
  
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    if (sinal === "CALL") comandoElement.textContent += " 📈";
    else if (sinal === "PUT") comandoElement.textContent += " 📉";
    else if (sinal === "ESPERAR") comandoElement.textContent += " ✋";
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
}

// =============================================
// INDICADORES TÉCNICOS (OTIMIZADOS PARA CRIPTO)
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
  }
  
  const diff = closes[closes.length - 1] - closes[closes.length - 2];
  const gain = Math.max(0, diff);
  const loss = Math.max(0, -diff);
  
  state.rsiCache.avgGain = ((state.rsiCache.avgGain * (periodo - 1)) + gain) / periodo;
  state.rsiCache.avgLoss = ((state.rsiCache.avgLoss * (periodo - 1)) + loss) / periodo;
  
  const rs = state.rsiCache.avgLoss === 0 ? 
    (state.rsiCache.avgGain > 0 ? Infinity : 1) : 
    state.rsiCache.avgGain / state.rsiCache.avgLoss;
    
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, 
                          periodoK = CONFIG.PERIODOS.STOCH_K, 
                          periodoD = CONFIG.PERIODOS.STOCH_D) {
  try {
    if (closes.length < periodoK) return { k: 50, d: 50 };
    
    const i = closes.length - 1;
    const startIndex = Math.max(0, i - periodoK + 1);
    const sliceHigh = highs.slice(startIndex, i + 1);
    const sliceLow = lows.slice(startIndex, i + 1);
    
    const highestHigh = Math.max(...sliceHigh);
    const lowestLow = Math.min(...sliceLow);
    const range = highestHigh - lowestLow;
    const k = range !== 0 ? ((closes[i] - lowestLow) / range) * 100 : 50;
    
    // Calcular média móvel simples para %D
    const kValues = state.stochCache?.kValues || [];
    kValues.push(k);
    if (kValues.length > periodoD) kValues.shift();
    
    const d = calcularMedia.simples(kValues, Math.min(kValues.length, periodoD)) || 50;
    
    return { k, d };
  } catch (e) {
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, 
                    lenta = CONFIG.PERIODOS.MACD_LENTA, 
                    sinal = CONFIG.PERIODOS.MACD_SINAL) {
  try {
    if (closes.length < lenta) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }

    // Calcular EMAs se necessário
    if (state.macdCache.emaRapida === null || state.macdCache.emaLenta === null) {
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
    }
    
    // Atualizar EMAs com novo valor
    const novoValor = closes[closes.length - 1];
    const kRapida = 2 / (rapida + 1);
    const kLenta = 2 / (lenta + 1);
    
    state.macdCache.emaRapida = novoValor * kRapida + state.macdCache.emaRapida * (1 - kRapida);
    state.macdCache.emaLenta = novoValor * kLenta + state.macdCache.emaLenta * (1 - kLenta);
    
    // Calcular linha MACD
    const novaMacdLinha = state.macdCache.emaRapida - state.macdCache.emaLenta;
    state.macdCache.macdLine.push(novaMacdLinha);
    
    // Calcular linha de sinal
    if (state.macdCache.signalLine.length === 0) {
      state.macdCache.signalLine.push(novaMacdLinha);
    } else {
      const kSinal = 2 / (sinal + 1);
      const ultimoSinal = state.macdCache.signalLine[state.macdCache.signalLine.length - 1];
      const novoSignal = novaMacdLinha * kSinal + ultimoSinal * (1 - kSinal);
      state.macdCache.signalLine.push(novoSignal);
    }
    
    // Manter tamanhos controlados
    if (state.macdCache.macdLine.length > 100) state.macdCache.macdLine.shift();
    if (state.macdCache.signalLine.length > 100) state.macdCache.signalLine.shift();
    
    const ultimoMACD = novaMacdLinha;
    const ultimoSinal = state.macdCache.signalLine[state.macdCache.signalLine.length - 1];
    
    return {
      histograma: ultimoMACD - ultimoSinal,
      macdLinha: ultimoMACD,
      sinalLinha: ultimoSinal
    };
  } catch (e) {
    console.error("Erro no cálculo MACD:", e);
    return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  }
}

function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo + 1) return 0;
    
    // Calcular True Ranges
    const trValues = [];
    for (let i = 1; i < dados.length; i++) {
      const tr = Math.max(
        dados[i].high - dados[i].low,
        Math.abs(dados[i].high - dados[i-1].close),
        Math.abs(dados[i].low - dados[i-1].close)
      );
      trValues.push(tr);
    }
    
    // Calcular ATR
    if (state.atrGlobal === 0) {
      state.atrGlobal = calcularMedia.simples(trValues.slice(-periodo), periodo);
    } else {
      // Atualizar com método exponencial para eficiência
      state.atrGlobal = (state.atrGlobal * (periodo - 1) + trValues[trValues.length - 1]) / periodo;
    }
    
    return state.atrGlobal;
  } catch (e) {
    console.error("Erro no cálculo ATR:", e);
    return 0;
  }
}

function calcularSuperTrend(dados, atr, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3) {
  try {
    if (dados.length < 2) return { direcao: 0, valor: 0 };
    
    const current = dados[dados.length - 1];
    const prev = dados.length > 1 ? dados[dados.length - 2] : current;
    const hl2 = (current.high + current.low) / 2;
    
    const upperBand = hl2 + (multiplicador * atr);
    const lowerBand = hl2 - (multiplicador * atr);
    
    let superTrend;
    let direcao;
    
    if (state.superTrendCache.length === 0) {
      superTrend = upperBand;
      direcao = 1;
    } else {
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
    if (state.superTrendCache.length > 50) state.superTrendCache.shift();
    
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
    
    // Encontrar máximos e mínimos
    const findExtremes = (data, isHigh) => {
      const extremes = [];
      for (let i = 3; i < data.length - 3; i++) {
        if (isHigh) {
          if (data[i] > data[i-1] && data[i] > data[i-2] && 
              data[i] > data[i+1] && data[i] > data[i+2]) {
            extremes.push({ index: i, value: data[i] });
          }
        } else {
          if (data[i] < data[i-1] && data[i] < data[i-2] && 
              data[i] < data[i+1] && data[i] < data[i+2]) {
            extremes.push({ index: i, value: data[i] });
          }
        }
      }
      return extremes;
    };
    
    const priceHighs = findExtremes(closes, true);
    const priceLows = findExtremes(closes, false);
    const rsiHighs = findExtremes(rsis, true);
    const rsiLows = findExtremes(rsis, false);
    
    // Verificar divergências regulares
    let divergenciaRegularAlta = false;
    let divergenciaRegularBaixa = false;
    
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const lastPriceHigh = priceHighs[priceHighs.length - 1];
      const prevPriceHigh = priceHighs[priceHighs.length - 2];
      const lastRsiHigh = rsiHighs[rsiHighs.length - 1];
      const prevRsiHigh = rsiHighs[rsiHighs.length - 2];
      
      if (lastPriceHigh.value > prevPriceHigh.value && 
          lastRsiHigh.value < prevRsiHigh.value) {
        divergenciaRegularBaixa = true;
      }
    }
    
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
      const lastPriceLow = priceLows[priceLows.length - 1];
      const prevPriceLow = priceLows[priceLows.length - 2];
      const lastRsiLow = rsiLows[rsiLows.length - 1];
      const prevRsiLow = rsiLows[rsiLows.length - 2];
      
      if (lastPriceLow.value < prevPriceLow.value && 
          lastRsiLow.value > prevRsiLow.value) {
        divergenciaRegularAlta = true;
      }
    }
    
    return {
      divergenciaRSI: divergenciaRegularAlta || divergenciaRegularBaixa,
      tipoDivergencia: divergenciaRegularAlta ? "ALTA" : 
                      divergenciaRegularBaixa ? "BAIXA" : "NENHUMA"
    };
  } catch (e) {
    console.error("Erro na detecção de divergências:", e);
    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
  }
}

// =============================================
// CORE DO SISTEMA (ATUALIZADO PARA CRYPTO IDX)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    state.dadosHistoricos = dados;
    
    if (dados.length < 20) {
      throw new Error(`Dados insuficientes (${dados.length} velas)`);
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);

    // Calcular EMAs
    const calcularEMA = (dados, periodo) => {
      const emaArray = calcularMedia.exponencial(dados, periodo);
      return emaArray[emaArray.length - 1];
    };

    const ema5 = calcularEMA(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema13 = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA);

    // Calcular ATR primeiro para usar em outros indicadores
    const atr = calcularATR(dados);
    const superTrend = calcularSuperTrend(dados, atr);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    
    // Preencher histórico de RSI
    if (state.rsiHistory.length === 0) {
      state.rsiHistory = Array(CONFIG.PERIODOS.RSI).fill(50);
    }
    state.rsiHistory.push(rsi);
    if (state.rsiHistory.length > 100) state.rsiHistory.shift();
    
    const divergencias = detectarDivergencias(closes, state.rsiHistory, highs, lows);
    const tendencia = avaliarTendencia(ema5, ema13);
    const lateral = detectarLateralidade(closes);

    // Atualizar contador de lateralidade
    if (lateral) state.contadorLaterais++;
    else state.contadorLaterais = Math.max(0, state.contadorLaterais - 1);

    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;

    const indicadores = {
      rsi,
      stoch,
      macd,
      emaCurta: ema5,
      emaMedia: ema13,
      close: velaAtual.close,
      superTrend,
      tendencia,
      atr
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

    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>📊 Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)</li>
        <li>💰 Preço: ${indicadores.close.toFixed(2)}</li>
        <li>📉 RSI: ${rsi.toFixed(2)} ${rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
        <li>📊 MACD: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(4)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(2)}/${stoch.d.toFixed(2)}</li>
        <li>📌 Médias: EMA5 ${ema5.toFixed(2)} | EMA13 ${ema13.toFixed(2)}</li>
        <li>📊 Suporte: ${state.suporteKey.toFixed(2)} | Resistência: ${state.resistenciaKey.toFixed(2)}</li>
        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
        <li>🚦 SuperTrend: ${superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'} (${superTrend.valor.toFixed(2)})</li>
        <li>⚡ Volatilidade (ATR): ${atr.toFixed(4)}</li>
        <li>🔄 Lateral: ${lateral ? 'SIM' : 'NÃO'}</li>
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
// FUNÇÕES DE DADOS (TWELVE DATA API)
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
      console.log(`Alternando para API key: ${currentKeyIndex}`);
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
// INICIALIZAÇÃO
// =============================================
function iniciarAplicativo() {
  // Criar interface
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
      box-shadow: 0 4px 20px rgba(0, 184, 148, 0.3);
      animation: pulseCall 2s infinite;
    }
    .put { 
      background: linear-gradient(135deg, #ff7675, #d63031) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(255, 118, 117, 0.3);
      animation: pulsePut 2s infinite;
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
    @keyframes pulseCall {
      0% { box-shadow: 0 0 0 0 rgba(0, 184, 148, 0.5); }
      70% { box-shadow: 0 0 0 10px rgba(0, 184, 148, 0); }
      100% { box-shadow: 0 0 0 0 rgba(0, 184, 148, 0); }
    }
    @keyframes pulsePut {
      0% { box-shadow: 0 0 0 0 rgba(255, 118, 117, 0.5); }
      70% { box-shadow: 0 0 0 10px rgba(255, 118, 117, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 118, 117, 0); }
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
