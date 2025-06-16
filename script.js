// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS 2025)
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
  websocket: null,
  apiKeys: [
    "demo", // Chave padrão
    "seu_outra_chave_1",
    "seu_outra_chave_2"
  ],
  currentApiKeyIndex: 0,
  marketOpen: true,
  activeMarkets: []
};

const CONFIG = {
  API_ENDPOINTS: [
    "https://api.twelvedata.com",
    "https://api.frankfurter.app",
    "https://api.exchangerate-api.com"
  ],
  WS_ENDPOINT: "wss://stream.twelvedata.com/v1/quotes/price",
  PARES: {
    EURUSD: "EUR/USD"
  },
  PERIODOS: {
    RSI: 14,
    STOCH: 14,
    WILLIAMS: 14,
    EMA_CURTA: 9,
    EMA_LONGA: 21,
    EMA_200: 200,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 30,
    VWAP: 20,
    ATR: 14,
    SUPERTREND: 10,
    SUPERTREND_MULTIPLIER: 3,
    WAVETREND: 9,
    ADX: 14,
    KALMAN_GAIN: 0.2
  },
  LIMIARES: {
    SCORE_ALTO: 82,
    SCORE_MEDIO: 68,
    RSI_OVERBOUGHT: 68,
    RSI_OVERSOLD: 32,
    STOCH_OVERBOUGHT: 82,
    STOCH_OVERSOLD: 18,
    WILLIAMS_OVERBOUGHT: -15,
    WILLIAMS_OVERSOLD: -85,
    VOLUME_ALTO: 1.5,
    VARIACAO_LATERAL: 0.5,
    VWAP_DESVIO: 0.0012,
    ATR_LIMIAR: 0.0008,
    ADX_FORTE: 25,
    SUPERTREND_CONFIRM: 2,
    EXAUSTAO_VOLUME: 2.8,
    EXAUSTAO_RSI: 75
  },
  PESOS: {
    RSI: 1.3,
    MACD: 1.8,
    TENDENCIA: 2.0,
    VOLUME: 1.0,
    STOCH: 1.1,
    WILLIAMS: 0.9,
    CONFIRMACAO: 1.2,
    LATERALIDADE: 1.5,
    VWAP: 1.4,
    VOLATILIDADE: 1.3,
    SUPERTREND: 1.7,
    WAVETREND: 1.6,
    ADX: 1.4,
    FRACTAL: 1.2
  },
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.015,
    R_R_MINIMO: 1.8,
    ATR_MULTIPLICADOR_SL: 1.8,
    ATR_MULTIPLICADOR_TP: 3.2
  },
  MARKET_HOURS: {
    LONDON_OPEN: 7,
    LONDON_CLOSE: 16,
    NY_OPEN: 13,
    NY_CLOSE: 22,
    TOKYO_OPEN: 0,
    TOKYO_CLOSE: 9,
    SYDNEY_OPEN: 22,
    SYDNEY_CLOSE: 7
  }
};

// =============================================
// FUNÇÕES UTILITÁRIAS (ATUALIZADAS)
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  const elementoMercados = document.getElementById("mercados-abertos");
  
  if (elementoHora) {
    const now = new Date();
    const gmtHours = now.getUTCHours();
    const gmtMinutes = now.getUTCMinutes();
    const timeStr = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    elementoHora.textContent = timeStr;
    state.ultimaAtualizacao = timeStr;
    
    // Verificar horários de mercado globais
    state.activeMarkets = [];
    const isLondonOpen = gmtHours >= CONFIG.MARKET_HOURS.LONDON_OPEN && gmtHours < CONFIG.MARKET_HOURS.LONDON_CLOSE;
    const isNYOpen = gmtHours >= CONFIG.MARKET_HOURS.NY_OPEN && gmtHours < CONFIG.MARKET_HOURS.NY_CLOSE;
    const isTokyoOpen = gmtHours >= CONFIG.MARKET_HOURS.TOKYO_OPEN || gmtHours < CONFIG.MARKET_HOURS.TOKYO_CLOSE;
    const isSydneyOpen = gmtHours >= CONFIG.MARKET_HOURS.SYDNEY_OPEN || gmtHours < CONFIG.MARKET_HOURS.SYDNEY_CLOSE;
    
    if (isLondonOpen) state.activeMarkets.push("LON");
    if (isNYOpen) state.activeMarkets.push("NY");
    if (isTokyoOpen) state.activeMarkets.push("TKY");
    if (isSydneyOpen) state.activeMarkets.push("SYD");
    
    state.marketOpen = isLondonOpen || isNYOpen;
    
    if (elementoMercados) {
      elementoMercados.innerHTML = state.activeMarkets.length > 0 
        ? `Mercados Abertos: ${state.activeMarkets.join(", ")}` 
        : "Mercados Fechados";
        
      elementoMercados.className = state.marketOpen ? "market-open" : "market-closed";
    }
    
    if (!state.marketOpen) {
      document.getElementById("comando").textContent = "MERCADO FECHADO";
      document.getElementById("comando").className = "esperar";
    }
  }
}

function atualizarInterface(sinal, score) {
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
}

function rotacionarApiKey() {
  state.currentApiKeyIndex = (state.currentApiKeyIndex + 1) % state.apiKeys.length;
  return state.apiKeys[state.currentApiKeyIndex];
}

// =============================================
// INDICADORES TÉCNICOS (ATUALIZADOS 2025)
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

  kalman: (dados, gain = CONFIG.PERIODOS.KALMAN_GAIN) => {
    if (!Array.isArray(dados) return [];
    
    let filtered = [dados[0]];
    for (let i = 1; i < dados.length; i++) {
      filtered.push(filtered[i-1] + gain * (dados[i] - filtered[i-1]));
    }
    
    return filtered;
  }
};

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (!Array.isArray(closes) || closes.length < periodo + 1) return 50;
  
  let gains = 0, losses = 0;
  
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / periodo;
  let avgLoss = Math.max(losses / periodo, 1e-8);

  for (let i = periodo + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    
    avgGain = (avgGain * (periodo - 1) + gain) / periodo;
    avgLoss = Math.max((avgLoss * (periodo - 1) + loss) / periodo, 1e-8);
  }

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, periodo = CONFIG.PERIODOS.STOCH) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo) return { k: 50, d: 50 };
    
    const kValues = [];
    for (let i = periodo-1; i < closes.length; i++) {
      const sliceHigh = highs.slice(i-periodo+1, i+1);
      const sliceLow = lows.slice(i-periodo+1, i+1);
      const highestHigh = Math.max(...sliceHigh);
      const lowestLow = Math.min(...sliceLow);
      const range = highestHigh - lowestLow;
      kValues.push(range > 0 ? ((closes[i] - lowestLow) / range) * 100 : 50);
    }
    
    const dValues = kValues.length >= 3 ? calcularMedia.simples(kValues.slice(-3), 3) : 50;
    return {
      k: kValues[kValues.length-1] || 50,
      d: dValues || 50
    };
  } catch (e) {
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularWilliams(highs, lows, closes, periodo = CONFIG.PERIODOS.WILLIAMS) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo) return 0;
    
    const sliceHigh = highs.slice(-periodo);
    const sliceLow = lows.slice(-periodo);
    const highestHigh = Math.max(...sliceHigh);
    const lowestLow = Math.min(...sliceLow);
    const range = highestHigh - lowestLow;
    
    return range > 0 ? ((highestHigh - closes[closes.length-1]) / range) * -100 : 0;
  } catch (e) {
    console.error("Erro no cálculo Williams:", e);
    return 0;
  }
}

function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, 
                    lenta = CONFIG.PERIODOS.MACD_LENTA, 
                    sinal = CONFIG.PERIODOS.MACD_SINAL) {
  try {
    if (!Array.isArray(closes) || closes.length < lenta + sinal) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }

    const emaRapida = calcularMedia.exponencial(closes, rapida);
    const emaLenta = calcularMedia.exponencial(closes, lenta);
    
    const startIdx = lenta - rapida;
    const macdLinha = emaRapida.slice(startIdx).map((val, idx) => val - emaLenta[idx]);
    const sinalLinha = calcularMedia.exponencial(macdLinha, sinal);
    
    const ultimoMACD = macdLinha[macdLinha.length - 1] || 0;
    const ultimoSinal = sinalLinha[sinalLinha.length - 1] || 0;
    
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

function calcularVWAP(dados, periodo = CONFIG.PERIODOS.VWAP) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo) return 0;
    
    const slice = dados.slice(-periodo);
    let typicalPriceSum = 0;
    let volumeSum = 0;
    
    for (const vela of slice) {
      const typicalPrice = (vela.high + vela.low + vela.close) / 3;
      typicalPriceSum += typicalPrice * vela.volume;
      volumeSum += vela.volume;
    }
    
    return volumeSum > 0 ? typicalPriceSum / volumeSum : 0;
  } catch (e) {
    console.error("Erro no cálculo VWAP:", e);
    return 0;
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

function calcularSupertrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplier = CONFIG.PERIODOS.SUPERTREND_MULTIPLIER) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo) return { direcao: 0, valor: 0 };
    
    const atr = calcularATR(dados, periodo);
    const basicUpper = (dados[dados.length-1].high + dados[dados.length-1].low) / 2 + (multiplier * atr);
    const basicLower = (dados[dados.length-1].high + dados[dados.length-1].low) / 2 - (multiplier * atr);
    
    let finalUpper = basicUpper;
    let finalLower = basicLower;
    let supertrend = basicUpper;
    let direcao = -1; // -1 = baixa, 1 = alta
    
    if (dados.length > periodo + 1) {
      const prevClose = dados[dados.length-2].close;
      
      if (prevClose > finalUpper) {
        direcao = 1;
        supertrend = basicLower;
      } else if (prevClose < finalLower) {
        direcao = -1;
        supertrend = basicUpper;
      } else {
        direcao = state.ultimoSinal === "CALL" ? 1 : -1;
        supertrend = direcao === 1 ? basicLower : basicUpper;
      }
    }
    
    return { direcao, valor: supertrend };
  } catch (e) {
    console.error("Erro no cálculo Supertrend:", e);
    return { direcao: 0, valor: 0 };
  }
}

function calcularWaveTrend(closes, periodo = CONFIG.PERIODOS.WAVETREND) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo * 2) return { wt1: 0, wt2: 0 };
    
    const ema1 = calcularMedia.exponencial(closes, periodo);
    const ema2 = calcularMedia.exponencial(ema1, periodo);
    
    const ap = closes.map((close, i) => close - ema2[i]);
    const esa = calcularMedia.exponencial(ap, periodo);
    const d = calcularMedia.exponencial(ap.map((val, i) => Math.abs(val - esa[i])), periodo);
    
    const ci = ap.map((val, i) => d[i] !== 0 ? val / (0.015 * d[i]) : 0);
    const wt1 = calcularMedia.exponencial(ci, periodo);
    const wt2 = calcularMedia.simples(wt1, 4);
    
    return {
      wt1: wt1[wt1.length-1] || 0,
      wt2: wt2 || 0
    };
  } catch (e) {
    console.error("Erro no cálculo WaveTrend:", e);
    return { wt1: 0, wt2: 0 };
  }
}

function calcularADX(dados, periodo = CONFIG.PERIODOS.ADX) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo * 2) return { adx: 0, pdi: 0, mdi: 0 };
    
    const trs = [];
    const pds = [];
    const mds = [];
    
    for (let i = 1; i < dados.length; i++) {
      const tr = Math.max(
        dados[i].high - dados[i].low,
        Math.abs(dados[i].high - dados[i-1].close),
        Math.abs(dados[i].low - dados[i-1].close)
      );
      
      const pd = dados[i].high - dados[i-1].high;
      const md = dados[i-1].low - dados[i].low;
      
      trs.push(tr);
      pds.push(pd > 0 && pd > md ? pd : 0);
      mds.push(md > 0 && md > pd ? md : 0);
    }
    
    const atr = calcularMedia.exponencial(trs, periodo);
    const pdi = calcularMedia.exponencial(pds, periodo).map((val, i) => atr[i] !== 0 ? (val / atr[i]) * 100 : 0);
    const mdi = calcularMedia.exponencial(mds, periodo).map((val, i) => atr[i] !== 0 ? (val / atr[i]) * 100 : 0);
    
    const dx = pdi.map((val, i) => {
      const sum = val + mdi[i];
      return sum !== 0 ? (Math.abs(val - mdi[i]) / sum) * 100 : 0;
    });
    
    const adx = calcularMedia.exponencial(dx, periodo);
    
    return {
      adx: adx[adx.length-1] || 0,
      pdi: pdi[pdi.length-1] || 0,
      mdi: mdi[mdi.length-1] || 0
    };
  } catch (e) {
    console.error("Erro no cálculo ADX:", e);
    return { adx: 0, pdi: 0, mdi: 0 };
  }
}

function detectarFractal(highs, lows, index) {
  if (index < 2 || index >= highs.length - 2) return false;
  
  // Fractal de alta: high maior que as 2 velas anteriores e posteriores
  const isHighFractal = highs[index] > highs[index-1] && 
                        highs[index] > highs[index-2] &&
                        highs[index] > highs[index+1] && 
                        highs[index] > highs[index+2];
  
  // Fractal de baixa: low menor que as 2 velas anteriores e posteriores
  const isLowFractal = lows[index] < lows[index-1] && 
                       lows[index] < lows[index-2] &&
                       lows[index] < lows[index+1] && 
                       lows[index] < lows[index+2];
  
  return isHighFractal || isLowFractal;
}

// =============================================
// SISTEMA DE DECISÃO (ATUALIZADO 2025)
// =============================================
function avaliarTendencia(closes, highs, lows, emaCurta, emaLonga, ema200, waveTrend, adx) {
  if (closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  if (detectarMercadoLateral(closes)) {
    state.contadorLaterais++;
    return "LATERAL";
  }
  
  state.contadorLaterais = 0;
  
  const ultimoClose = closes[closes.length - 1];
  const penultimoClose = closes[closes.length - 2];
  
  // Sistema híbrido de tendência (WaveTrend + ADX + EMA)
  const wtDirection = waveTrend.wt1 > waveTrend.wt2 ? 1 : -1;
  const adxDirection = adx.pdi > adx.mdi ? 1 : -1;
  const emaDirection = emaCurta > emaLonga ? 1 : -1;
  
  const tendenciaScore = wtDirection + adxDirection + emaDirection;
  
  // Verificação de força da tendência
  const isStrongTrend = adx.adx > CONFIG.LIMIARES.ADX_FORTE;
  const aboveEMA200 = ultimoClose > ema200;
  
  // Confirmação com fractais
  const lastFractal = detectarFractal(highs, lows, closes.length - 3);
  
  if (isStrongTrend) {
    if (tendenciaScore >= 2 && aboveEMA200 && lastFractal) return "FORTE_ALTA";
    if (tendenciaScore <= -2 && !aboveEMA200 && lastFractal) return "FORTE_BAIXA";
  }
  
  if (tendenciaScore >= 2 && aboveEMA200) return "ALTA";
  if (tendenciaScore <= -2 && !aboveEMA200) return "BAIXA";
  
  return "NEUTRA";
}

function detectarMercadoLateral(closes) {
  if (closes.length < CONFIG.PERIODOS.ANALISE_LATERAL) return false;
  
  const ultimosPrecos = closes.slice(-CONFIG.PERIODOS.ANALISE_LATERAL);
  const maximo = Math.max(...ultimosPrecos);
  const minimo = Math.min(...ultimosPrecos);
  const variacao = ((maximo - minimo) / minimo) * 100;
  
  return variacao < CONFIG.LIMIARES.VARIACAO_LATERAL;
}

function verificarExaustao(rsi, volume, volumeMedia) {
  const isOverboughtExhausted = rsi > CONFIG.LIMIARES.EXAUSTAO_RSI && 
                               volume > volumeMedia * CONFIG.LIMIARES.EXAUSTAO_VOLUME;
  
  const isOversoldExhausted = rsi < (100 - CONFIG.LIMIARES.EXAUSTAO_RSI) && 
                             volume > volumeMedia * CONFIG.LIMIARES.EXAUSTAO_VOLUME;
  
  return isOverboughtExhausted || isOversoldExhausted;
}

function calcularScore(indicadores) {
  let score = 50;

  // Análise de RSI com filtro de exaustão
  if (verificarExaustao(indicadores.rsi, indicadores.volume, indicadores.volumeMedia)) {
    score -= 20 * CONFIG.PESOS.RSI;
  } else if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) {
    score += 22 * CONFIG.PESOS.RSI;
    if (indicadores.tendencia.includes("BAIXA")) score -= 8;
  } else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) {
    score -= 22 * CONFIG.PESOS.RSI;
    if (indicadores.tendencia.includes("ALTA")) score += 8;
  } else if (indicadores.rsi < 45) score += 8 * CONFIG.PESOS.RSI;
  else if (indicadores.rsi > 55) score -= 8 * CONFIG.PESOS.RSI;

  // Análise MACD
  score += (Math.min(Math.max(indicadores.macd.histograma * 12, -15), 15) * CONFIG.PESOS.MACD);

  // Análise de Tendência (com WaveTrend e ADX)
  switch(indicadores.tendencia) {
    case "FORTE_ALTA": 
      score += 25 * CONFIG.PESOS.TENDENCIA; 
      if (indicadores.waveTrend.wt1 > indicadores.waveTrend.wt2) score += 5;
      if (indicadores.adx.adx > CONFIG.LIMIARES.ADX_FORTE) score += 5;
      break;
    case "ALTA": 
      score += 15 * CONFIG.PESOS.TENDENCIA; 
      if (indicadores.waveTrend.wt1 > indicadores.waveTrend.wt2) score += 3;
      break;
    case "FORTE_BAIXA": 
      score -= 25 * CONFIG.PESOS.TENDENCIA; 
      if (indicadores.waveTrend.wt1 < indicadores.waveTrend.wt2) score -= 5;
      if (indicadores.adx.adx > CONFIG.LIMIARES.ADX_FORTE) score -= 5;
      break;
    case "BAIXA": 
      score -= 15 * CONFIG.PESOS.TENDENCIA; 
      if (indicadores.waveTrend.wt1 < indicadores.waveTrend.wt2) score -= 3;
      break;
    case "LATERAL": 
      score -= Math.min(state.contadorLaterais, 10) * CONFIG.PESOS.LATERALIDADE; 
      break;
  }

  // Análise de Volume
  if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
    score += (indicadores.tendencia.includes("ALTA") ? 10 : -10) * CONFIG.PESOS.VOLUME;
  }

  // Análise Stochastic
  if (indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && 
      indicadores.stoch.d < CONFIG.LIMIARES.STOCH_OVERSOLD) {
    score += 10 * CONFIG.PESOS.STOCH;
  }
  if (indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && 
      indicadores.stoch.d > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
    score -= 10 * CONFIG.PESOS.STOCH;
  }

  // Análise Williams
  if (indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) {
    score += 8 * CONFIG.PESOS.WILLIAMS;
  }
  if (indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) {
    score -= 8 * CONFIG.PESOS.WILLIAMS;
  }

  // Análise VWAP
  const vwapDesvio = Math.abs(indicadores.close - indicadores.vwap) / indicadores.vwap;
  if (vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO) {
    score += (indicadores.close > indicadores.vwap ? 10 : -10) * CONFIG.PESOS.VWAP;
  }

  // Análise de Volatilidade (ATR)
  if (indicadores.atr > CONFIG.LIMIARES.ATR_LIMIAR) {
    score += 6 * CONFIG.PESOS.VOLATILIDADE;
  }

  // Supertrend
  if (indicadores.supertrend.direcao === 1) {
    score += 8 * CONFIG.PESOS.SUPERTREND;
  } else if (indicadores.supertrend.direcao === -1) {
    score -= 8 * CONFIG.PESOS.SUPERTREND;
  }

  // Confirmações
  const confirmacoes = [
    indicadores.rsi < 40 || indicadores.rsi > 60,
    Math.abs(indicadores.macd.histograma) > 0.05,
    indicadores.stoch.k < 30 || indicadores.stoch.k > 70,
    indicadores.williams < -70 || indicadores.williams > -30,
    indicadores.tendencia !== "LATERAL",
    vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO * 0.8,
    indicadores.supertrend.direcao !== 0,
    indicadores.adx.adx > 20
  ].filter(Boolean).length;

  score += confirmacoes * 3 * CONFIG.PESOS.CONFIRMACAO;

  // Fractais
  if (detectarFractal(indicadores.highs, indicadores.lows, indicadores.closes.length - 3)) {
    score += 5 * CONFIG.PESOS.FRACTAL;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia, supertrend) {
  if (tendencia === "LATERAL") {
    return score > 85 ? "CALL" : "ESPERAR";
  }
  
  // Confirmação com Supertrend
  if (supertrend.direcao === 1 && score >= CONFIG.LIMIARES.SCORE_ALTO) {
    return "CALL";
  }
  if (supertrend.direcao === -1 && score >= CONFIG.LIMIARES.SCORE_ALTO) {
    return "PUT";
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
    if (tendencia === "NEUTRA") return score > 78 ? "CALL" : "ESPERAR";
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// CORE DO SISTEMA (ATUALIZADO)
// =============================================
async function obterDadosForex() {
  for (const endpoint of CONFIG.API_ENDPOINTS) {
    try {
      let response, dados;
      if (endpoint.includes('twelvedata')) {
        const apiKey = rotacionarApiKey();
        response = await fetch(`${endpoint}/time_series?symbol=${CONFIG.PARES.EURUSD}&interval=1min&outputsize=200&apikey=${apiKey}`);
        if (!response.ok) continue;
        dados = await response.json();
        if (dados.values && Array.isArray(dados.values)) {
          return dados.values.map(v => ({
            time: v.datetime,
            open: parseFloat(v.open),
            high: parseFloat(v.high),
            low: parseFloat(v.low),
            close: parseFloat(v.close),
            volume: parseFloat(v.volume)
          })).reverse();
        }
      } else if (endpoint.includes('frankfurter')) {
        response = await fetch(`${endpoint}/latest?amount=1&from=EUR&to=USD`);
        if (!response.ok) continue;
        const current = await response.json();
        const close = parseFloat(current.rates.USD);
        return [{ time: new Date().toISOString(), open: close, high: close, low: close, close, volume: 0 }];
      } else {
        response = await fetch(`${endpoint}/latest/EUR`);
        if (!response.ok) continue;
        dados = await response.json();
        if (dados.rates && dados.rates.USD) {
          const close = parseFloat(dados.rates.USD);
          return [{ time: new Date().toISOString(), open: close, high: close, low: close, close, volume: 0 }];
        }
      }
    } catch (e) {
      console.error(`Erro no endpoint ${endpoint}:`, e);
    }
  }
  throw new Error("Todos os endpoints falharam");
}

async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosForex();
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Cálculo de médias com filtro Kalman
    const emaCurtaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const emaLongaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema200Array  = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200);
    const emaCurta = emaCurtaArray.slice(-1)[0] || 0;
    const emaLonga = emaLongaArray.slice(-1)[0] || 0;
    const ema200   = ema200Array.slice(-1)[0] || 0;

    // Indicadores avançados
    const waveTrend = calcularWaveTrend(closes);
    const adx = calcularADX(dados);
    const supertrend = calcularSupertrend(dados);

    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      emaCurta,
      emaLonga,
      ema200,
      volume: velaAtual.volume,
      volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME) || 1,
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      vwap: calcularVWAP(dados),
      atr: calcularATR(dados),
      waveTrend,
      adx,
      supertrend,
      close: velaAtual.close,
      highs,
      lows,
      closes,
      tendencia: avaliarTendencia(closes, highs, lows, emaCurta, emaLonga, ema200, waveTrend, adx)
    };

    const score = calcularScore(indicadores);
    const sinal = determinarSinal(score, indicadores.tendencia, supertrend);

    state.ultimoSinal = sinal !== "ESPERAR" ? sinal : state.ultimoSinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score);

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>📊 Tendência: ${indicadores.tendencia.replace('_',' ')} ${
          indicadores.tendencia.includes("ALTA") ? '🟢' :
          indicadores.tendencia.includes("BAIXA") ? '🔴' : '🟡'}</li>
        <li>📉 RSI: ${indicadores.rsi.toFixed(2)} ${
          indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : 
          indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
        <li>📊 MACD: ${indicadores.macd.histograma.toFixed(6)} ${
          indicadores.macd.histograma>0?'🟢':'🔴'}</li>
        <li>📈 Stochastic K/D: ${indicadores.stoch.k.toFixed(2)}/${indicadores.stoch.d.toFixed(2)}</li>
        <li>📊 Williams: ${indicadores.williams.toFixed(2)}</li>
        <li>📌 Supertrend: ${indicadores.supertrend.direcao === 1 ? '🟢 Alta' : indicadores.supertrend.direcao === -1 ? '🔴 Baixa' : '⚪ Neutro'}</li>
        <li>📶 ADX: ${indicadores.adx.adx.toFixed(2)} (${indicadores.adx.pdi.toFixed(2)}/${indicadores.adx.mdi.toFixed(2)})</li>
        <li>💰 Preço: €${indicadores.close.toFixed(5)} ${
          indicadores.close>emaCurta?'🟢':'🔴'}</li>
        <li>📶 Médias: EMA${CONFIG.PERIODOS.EMA_CURTA} ${indicadores.emaCurta.toFixed(5)} | EMA${CONFIG.PERIODOS.EMA_LONGA} ${indicadores.emaLonga.toFixed(5)} | EMA200 ${indicadores.ema200.toFixed(5)}</li>
        <li>💹 Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)}</li>
        <li>📌 VWAP: ${indicadores.vwap.toFixed(5)} | ATR: ${indicadores.atr.toFixed(6)}</li>
        <li>🌊 WaveTrend: ${indicadores.waveTrend.wt1.toFixed(2)}/${indicadores.waveTrend.wt2.toFixed(2)}</li>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%) ${sinal==="CALL"?"📈":sinal==="PUT"?"📉":"✋"}`);
    if (state.ultimos.length>10) state.ultimos.pop();
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) ultimosElement.innerHTML = state.ultimos.map(i=>`<li>${i}</li>`).join("");

    state.tentativasErro = 0;
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0);
    if (++state.tentativasErro>3) setTimeout(()=>location.reload(),10000);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO (MANTIDO)
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  const agora = Date.now();
  const delayProximaVela = 60000 - (agora % 60000);
  state.timer = Math.max(1, Math.floor(delayProximaVela/1000));
  const elementoTimer = document.getElementById("timer");
  if (elementoTimer) {
    elementoTimer.textContent = formatarTimer(state.timer);
    elementoTimer.style.color = state.timer<=5?'red':'';
  }
  state.intervaloAtual = setInterval(()=>{
    state.timer--;
    if (elementoTimer) {
      elementoTimer.textContent = formatarTimer(state.timer);
      elementoTimer.style.color = state.timer<=5?'red':'';
    }
    if (state.timer<=0) {
      clearInterval(state.intervaloAtual);
      analisarMercado().finally(sincronizarTimer);
    }
  },1000);
}

// =============================================
// INICIALIZAÇÃO (ATUALIZADA)
// =============================================
function iniciarAplicativo() {
  const ids=['comando','score','hora','timer','criterios','ultimos','mercados-abertos'];
  const falt = ids.filter(id=>!document.getElementById(id));
  if (falt.length>0) { console.error("Faltam:",falt); return; }
  
  setInterval(atualizarRelogio,1000);
  sincronizarTimer();
  analisarMercado();
  
  // Estilo adicional para o display de mercados
  const style = document.createElement('style');
  style.textContent = `
    #mercados-abertos {
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 5px 10px;
      border-radius: 5px;
      font-weight: bold;
      z-index: 1000;
    }
    .market-open {
      background-color: #4CAF50;
      color: white;
    }
    .market-closed {
      background-color: #F44336;
      color: white;
    }
  `;
  document.head.appendChild(style);
}

if(document.readyState==="complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
