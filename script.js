// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS PARA 2025)
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
    "seu_outra_chave_1", // Adicione suas chaves aqui
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
    EMA_CURTA: 7,  // Atualizado para melhor resposta em 2025
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
    ICHIMOKU_TENKAN: 9,
    ICHIMOKU_KIJUN: 26,
    ICHIMOKU_SENKOU: 52
  },
  LIMIARES: {
    SCORE_ALTO: 82,  // Aumentado para reduzir falsos sinais
    SCORE_MEDIO: 68,
    RSI_OVERBOUGHT: 70,  // Ajustado para EUR/USD em 2025
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    WILLIAMS_OVERBOUGHT: -15,
    WILLIAMS_OVERSOLD: -85,
    VOLUME_ALTO: 1.5,
    VARIACAO_LATERAL: 0.5,  // Reduzido para detectar melhor lateralidade
    VWAP_DESVIO: 0.0012,
    ATR_LIMIAR: 0.0008,
    ICHIMOKU_CLOUD_THICKNESS: 0.0020
  },
  PESOS: {
    RSI: 1.3,
    MACD: 1.8,
    TENDENCIA: 1.7,
    VOLUME: 1.0,
    STOCH: 1.1,
    WILLIAMS: 0.9,
    CONFIRMACAO: 1.2,
    LATERALIDADE: 2.0,
    VWAP: 1.4,
    VOLATILIDADE: 1.3,
    ICHIMOKU: 2.2  // Novo peso para Ichimoku
  },
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.02,
    R_R_MINIMO: 1.8,
    ATR_MULTIPLICADOR_SL: 1.8,
    ATR_MULTIPLICADOR_TP: 3.2
  },
  MARKET_HOURS: {
    LONDON_OPEN: 7,  // 7:00 GMT
    LONDON_CLOSE: 16, // 16:00 GMT
    NY_OPEN: 13,     // 13:00 GMT
    NY_CLOSE: 22,    // 22:00 GMT
    TOKYO_OPEN: 0,   // 00:00 GMT
    TOKYO_CLOSE: 9,  // 09:00 GMT
    SYDNEY_OPEN: 22, // 22:00 GMT (dia anterior)
    SYDNEY_CLOSE: 7  // 07:00 GMT
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
  if (elementoHora) {
    const now = new Date();
    elementoHora.textContent = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    // Verificar horário de mercado global
    const gmtHours = now.getUTCHours();
    const gmtDay = now.getUTCDay(); // 0 = Domingo, 6 = Sábado
    
    // Verificar se é dia de semana (segunda a sexta)
    const isWeekday = gmtDay >= 1 && gmtDay <= 5;
    
    // Determinar mercados abertos
    state.activeMarkets = [];
    if (isWeekday) {
      if (gmtHours >= CONFIG.MARKET_HOURS.SYDNEY_OPEN || gmtHours < CONFIG.MARKET_HOURS.SYDNEY_CLOSE) {
        state.activeMarkets.push("Sydney");
      }
      if (gmtHours >= CONFIG.MARKET_HOURS.TOKYO_OPEN && gmtHours < CONFIG.MARKET_HOURS.TOKYO_CLOSE) {
        state.activeMarkets.push("Tóquio");
      }
      if (gmtHours >= CONFIG.MARKET_HOURS.LONDON_OPEN && gmtHours < CONFIG.MARKET_HOURS.LONDON_CLOSE) {
        state.activeMarkets.push("Londres");
      }
      if (gmtHours >= CONFIG.MARKET_HOURS.NY_OPEN && gmtHours < CONFIG.MARKET_HOURS.NY_CLOSE) {
        state.activeMarkets.push("Nova York");
      }
    }
    
    // Atualizar status do mercado
    state.marketOpen = isWeekday && state.activeMarkets.length > 0;
    
    // Atualizar display de mercados abertos
    const mercadoElement = document.getElementById("mercado-status");
    if (mercadoElement) {
      if (state.marketOpen) {
        mercadoElement.innerHTML = `MERCADO ABERTO (${state.activeMarkets.join(", ")}) <span class="market-open">●</span>`;
        mercadoElement.className = "market-open";
      } else {
        mercadoElement.innerHTML = "MERCADO FECHADO <span class="market-closed">●</span>";
        mercadoElement.className = "market-closed";
      }
    }
    
    if (!state.marketOpen) {
      document.getElementById("comando").textContent = "MERCADO FECHADO";
      document.getElementById("comando").className = "esperar";
    }
  }
}

function atualizarInterface(sinal, score) {
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
  
  const horaElement = document.getElementById("hora");
  if (horaElement) horaElement.textContent = state.ultimaAtualizacao;
}

function rotacionarApiKey() {
  state.currentApiKeyIndex = (state.currentApiKeyIndex + 1) % state.apiKeys.length;
  return state.apiKeys[state.currentApiKeyIndex];
}

// =============================================
// INDICADORES TÉCNICOS (ATUALIZADOS PARA 2025)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return null;
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  },

  exponencial: (dados, periodo, smoothing = 2) => {
    if (!Array.isArray(dados) || dados.length < periodo) return [];
    
    const k = smoothing / (periodo + 1);
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
      d: dValues || 50,
      momentum: kValues.length > 1 ? kValues[kValues.length-1] - kValues[kValues.length-2] : 0
    };
  } catch (e) {
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50, momentum: 0 };
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
      return { histograma: 0, macdLinha: 0, sinalLinha: 0, divergencia: 0 };
    }

    const emaRapida = calcularMedia.exponencial(closes, rapida);
    const emaLenta = calcularMedia.exponencial(closes, lenta);
    
    const startIdx = lenta - rapida;
    const macdLinha = emaRapida.slice(startIdx).map((val, idx) => val - emaLenta[idx]);
    const sinalLinha = calcularMedia.exponencial(macdLinha, sinal);
    
    const ultimoMACD = macdLinha[macdLinha.length - 1] || 0;
    const ultimoSinal = sinalLinha[sinalLinha.length - 1] || 0;
    
    // Detecção de divergência
    let divergencia = 0;
    if (macdLinha.length >= 5) {
      const macdTrend = macdLinha[macdLinha.length-1] - macdLinha[macdLinha.length-5];
      const priceTrend = closes[closes.length-1] - closes[closes.length-5];
      
      if (macdTrend > 0 && priceTrend < 0) divergencia = 1;  // Divergência positiva
      else if (macdTrend < 0 && priceTrend > 0) divergencia = -1;  // Divergência negativa
    }
    
    return {
      histograma: ultimoMACD - ultimoSinal,
      macdLinha: ultimoMACD,
      sinalLinha: ultimoSinal,
      divergencia
    };
  } catch (e) {
    console.error("Erro no cálculo MACD:", e);
    return { histograma: 0, macdLinha: 0, sinalLinha: 0, divergencia: 0 };
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

function calcularIchimoku(dados) {
  try {
    if (!Array.isArray(dados) || dados.length < CONFIG.PERIODOS.ICHIMOKU_SENKOU) return null;
    
    // Tenkan-sen (Conversion Line)
    const periodHigh = Math.max(...dados.slice(-CONFIG.PERIODOS.ICHIMOKU_TENKAN).map(v => v.high));
    const periodLow = Math.min(...dados.slice(-CONFIG.PERIODOS.ICHIMOKU_TENKAN).map(v => v.low));
    const tenkanSen = (periodHigh + periodLow) / 2;
    
    // Kijun-sen (Base Line)
    const kijunPeriodHigh = Math.max(...dados.slice(-CONFIG.PERIODOS.ICHIMOKU_KIJUN).map(v => v.high));
    const kijunPeriodLow = Math.min(...dados.slice(-CONFIG.PERIODOS.ICHIMOKU_KIJUN).map(v => v.low));
    const kijunSen = (kijunPeriodHigh + kijunPeriodLow) / 2;
    
    // Senkou Span A (Leading Span A)
    const senkouA = ((tenkanSen + kijunSen) / 2);
    
    // Senkou Span B (Leading Span B)
    const senkouBPeriodHigh = Math.max(...dados.slice(-CONFIG.PERIODOS.ICHIMOKU_SENKOU).map(v => v.high));
    const senkouBPeriodLow = Math.min(...dados.slice(-CONFIG.PERIODOS.ICHIMOKU_SENKOU).map(v => v.low));
    const senkouB = (senkouBPeriodHigh + senkouBPeriodLow) / 2;
    
    // Cloud thickness
    const cloudThickness = Math.abs(senkouA - senkouB);
    
    return {
      tenkanSen,
      kijunSen,
      senkouA,
      senkouB,
      cloudThickness,
      priceAboveCloud: dados[dados.length-1].close > Math.max(senkouA, senkouB),
      priceBelowCloud: dados[dados.length-1].close < Math.min(senkouA, senkouB),
      cloudBullish: senkouA > senkouB,
      cloudBearish: senkouA < senkouB
    };
  } catch (e) {
    console.error("Erro no cálculo Ichimoku:", e);
    return null;
  }
}

// =============================================
// SISTEMA DE DECISÃO (ATUALIZADO PARA 2025)
// =============================================
function avaliarTendencia(closes, emaCurta, emaLonga, ema200, ichimoku) {
  if (closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  if (detectarMercadoLateral(closes)) {
    state.contadorLaterais++;
    return "LATERAL";
  }
  
  state.contadorLaterais = 0;
  
  const ultimoClose = closes[closes.length - 1];
  const penultimoClose = closes[closes.length - 2];
  
  // Análise Ichimoku (prioridade alta)
  if (ichimoku) {
    if (ichimoku.priceAboveCloud && ichimoku.cloudBullish && ultimoClose > ichimoku.tenkanSen && ichimoku.tenkanSen > ichimoku.kijunSen) {
      return "FORTE_ALTA";
    }
    if (ichimoku.priceBelowCloud && ichimoku.cloudBearish && ultimoClose < ichimoku.tenkanSen && ichimoku.tenkanSen < ichimoku.kijunSen) {
      return "FORTE_BAIXA";
    }
    if (ichimoku.cloudThickness > CONFIG.LIMIARES.ICHIMOKU_CLOUD_THICKNESS) {
      if (ichimoku.priceAboveCloud && ichimoku.cloudBullish) return "ALTA";
      if (ichimoku.priceBelowCloud && ichimoku.cloudBearish) return "BAIXA";
    }
  }
  
  // Análise EMAs (confirmadora)
  const diffEMAs = emaCurta - emaLonga;
  const threshold = 0.0005;
  
  if (ultimoClose > emaCurta && diffEMAs > threshold && ultimoClose > penultimoClose) {
    return ichimoku && ichimoku.priceAboveCloud ? "FORTE_ALTA" : "ALTA";
  }
  if (ultimoClose < emaCurta && diffEMAs < -threshold && ultimoClose < penultimoClose) {
    return ichimoku && ichimoku.priceBelowCloud ? "FORTE_BAIXA" : "BAIXA";
  }
  if (ultimoClose > emaCurta && diffEMAs > threshold/2) {
    return "ALTA";
  }
  if (ultimoClose < emaCurta && diffEMAs < -threshold/2) {
    return "BAIXA";
  }
  
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

function calcularScore(indicadores) {
  let score = 50;

  // Análise de RSI (ponderada por volatilidade)
  const rsiWeight = CONFIG.PESOS.RSI * (1 + (indicadores.atr / CONFIG.LIMIARES.ATR_LIMIAR));
  if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) {
    score += 25 * rsiWeight;
    if (indicadores.tendencia.includes("BAIXA")) score -= 10;
  }
  else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) {
    score -= 25 * rsiWeight;
    if (indicadores.tendencia.includes("ALTA")) score += 10;
  }
  else if (indicadores.rsi < 45) score += 10 * rsiWeight;
  else if (indicadores.rsi > 55) score -= 10 * rsiWeight;

  // Análise MACD (com divergência)
  score += (Math.min(Math.max(indicadores.macd.histograma * 10, -15), 15) * CONFIG.PESOS.MACD);
  if (indicadores.macd.divergencia > 0) score += 12;
  if (indicadores.macd.divergencia < 0) score -= 12;

  // Análise de Tendência (com Ichimoku)
  switch(indicadores.tendencia) {
    case "FORTE_ALTA": 
      score += 25 * CONFIG.PESOS.TENDENCIA; 
      if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.2) score += 8;
      if (indicadores.ichimoku?.priceAboveCloud && indicadores.ichimoku.cloudBullish) score += 15;
      break;
    case "ALTA": 
      score += 15 * CONFIG.PESOS.TENDENCIA; 
      if (indicadores.ichimoku?.priceAboveCloud) score += 8;
      break;
    case "FORTE_BAIXA": 
      score -= 25 * CONFIG.PESOS.TENDENCIA; 
      if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.2) score -= 8;
      if (indicadores.ichimoku?.priceBelowCloud && indicadores.ichimoku.cloudBearish) score -= 15;
      break;
    case "BAIXA": 
      score -= 15 * CONFIG.PESOS.TENDENCIA; 
      if (indicadores.ichimoku?.priceBelowCloud) score -= 8;
      break;
    case "LATERAL": 
      score -= Math.min(state.contadorLaterais * 2, 15) * CONFIG.PESOS.LATERALIDADE; 
      break;
  }

  // Análise de Volume (ponderada por horário de mercado)
  const volumeWeight = state.activeMarkets.includes("Londres") || state.activeMarkets.includes("Nova York") ? 1.2 : 0.8;
  if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
    score += (indicadores.tendencia.includes("ALTA") ? 10 : -10) * CONFIG.PESOS.VOLUME * volumeWeight;
  }

  // Análise Stochastic (com momentum)
  if (indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && 
      indicadores.stoch.d < CONFIG.LIMIARES.STOCH_OVERSOLD) {
    score += 15 * CONFIG.PESOS.STOCH;
    if (indicadores.stoch.momentum > 5) score += 5;
    if (indicadores.tendencia.includes("ALTA")) score -= 8;
  }
  if (indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && 
      indicadores.stoch.d > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
    score -= 15 * CONFIG.PESOS.STOCH;
    if (indicadores.stoch.momentum < -5) score -= 5;
    if (indicadores.tendencia.includes("BAIXA")) score += 8;
  }

  // Análise Williams
  if (indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) {
    score += 12 * CONFIG.PESOS.WILLIAMS; 
    if (indicadores.rsi < 40) score += 5;
  }
  if (indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) {
    score -= 12 * CONFIG.PESOS.WILLIAMS; 
    if (indicadores.rsi > 60) score -= 5;
  }

  // Análise VWAP (com desvio percentual)
  const vwapDesvio = Math.abs(indicadores.close - indicadores.vwap) / indicadores.vwap;
  if (vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO) {
    score += (indicadores.close > indicadores.vwap ? 10 : -10) * CONFIG.PESOS.VWAP;
  }

  // Análise de Volatilidade (ATR)
  if (indicadores.atr > CONFIG.LIMIARES.ATR_LIMIAR) {
    score += 8 * CONFIG.PESOS.VOLATILIDADE;
  }

  // Confirmações (incluindo Ichimoku)
  const confirmacoes = [
    indicadores.rsi < 40 || indicadores.rsi > 60,
    Math.abs(indicadores.macd.histograma) > 0.05,
    indicadores.stoch.k < 30 || indicadores.stoch.k > 70,
    indicadores.williams < -70 || indicadores.williams > -30,
    indicadores.tendencia !== "LATERAL",
    vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO * 0.8,
    indicadores.ichimoku?.priceAboveCloud || indicadores.ichimoku?.priceBelowCloud,
    indicadores.ichimoku?.cloudThickness > CONFIG.LIMIARES.ICHIMOKU_CLOUD_THICKNESS * 0.5
  ].filter(Boolean).length;

  score += confirmacoes * 5 * CONFIG.PESOS.CONFIRMACAO;

  // Filtro de reversão (evitar sinais contra a tendência principal)
  if (state.ultimoSinal) {
    const lastSignalWasBuy = state.ultimoSinal === "CALL";
    const currentTrendIsUp = indicadores.tendencia.includes("ALTA");
    
    if (lastSignalWasBuy && !currentTrendIsUp) score -= 15;
    if (!lastSignalWasBuy && currentTrendIsUp) score += 15;
  }

  // Ajuste final baseado no horário do mercado
  if (state.activeMarkets.includes("Londres") || state.activeMarkets.includes("Nova York")) {
    score = Math.min(100, score * 1.1);
  } else if (state.activeMarkets.length === 0) {
    score = Math.max(0, score * 0.7);
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia) {
  if (!state.marketOpen) return "ESPERAR";
  
  if (tendencia === "LATERAL") {
    return score > 85 ? "CALL" : "ESPERAR";
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
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  try {
    const dados = await obterDadosForex();
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    const emaCurtaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const emaLongaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema200Array  = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200);
    const emaCurta = emaCurtaArray.slice(-1)[0] || 0;
    const emaLonga = emaLongaArray.slice(-1)[0] || 0;
    const ema200   = ema200Array.slice(-1)[0] || 0;

    const ichimoku = calcularIchimoku(dados);

    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      sma9: calcularMedia.simples(closes, 9),
      emaCurta,
      emaLonga,
      ema200,
      volume: velaAtual.volume,
      volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME) || 1,
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      vwap: calcularVWAP(dados),
      atr: calcularATR(dados),
      ichimoku,
      close: velaAtual.close,
      tendencia: avaliarTendencia(closes, emaCurta, emaLonga, ema200, ichimoku)
    };

    const score = calcularScore(indicadores);
    const sinal = determinarSinal(score, indicadores.tendencia);

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
          indicadores.macd.histograma>0?'🟢':'🔴'} ${
          indicadores.macd.divergencia>0?'↑':indicadores.macd.divergencia<0?'↓':''}</li>
        <li>📈 Stochastic K/D: ${indicadores.stoch.k.toFixed(2)}/${indicadores.stoch.d.toFixed(2)} ${
          indicadores.stoch.momentum>2?'↗':indicadores.stoch.momentum<-2?'↘':''}</li>
        <li>📊 Williams: ${indicadores.williams.toFixed(2)}</li>
        <li>💰 Preço: €${indicadores.close.toFixed(5)} ${
          indicadores.close>emaCurta?'🟢':'🔴'}</li>
        <li>📶 Médias: EMA${CONFIG.PERIODOS.EMA_CURTA} ${indicadores.emaCurta.toFixed(5)} | EMA${CONFIG.PERIODOS.EMA_LONGA} ${indicadores.emaLonga.toFixed(5)} | EMA200 ${indicadores.ema200.toFixed(5)}</li>
        <li>💹 Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)} ${
          indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO ? '🔊' : ''}</li>
        <li>📌 VWAP: ${indicadores.vwap.toFixed(5)} | ATR: ${indicadores.atr.toFixed(6)}</li>
        ${ichimoku ? `<li>☁️ Ichimoku: ${ichimoku.priceAboveCloud ? 'Acima' : ichimoku.priceBelowCloud ? 'Abaixo' : 'Dentro'} da Nuvem | ${
          ichimoku.cloudBullish ? 'Bullish' : 'Bearish'}</li>` : ''}
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
// WEBSOCKET (MANTIDO)
// =============================================
function iniciarWebSocket() {
  if (state.websocket) state.websocket.close();
  
  state.websocket = new WebSocket(`${CONFIG.WS_ENDPOINT}?symbol=${CONFIG.PARES.EURUSD}&apikey=${rotacionarApiKey()}`);
  
  state.websocket.onopen = () => {
    console.log("WebSocket conectado para atualizações em tempo real");
  };
  
  state.websocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.event === "price") {
      const now = new Date();
      const horaFormatada = now.toLocaleTimeString("pt-BR");
      document.getElementById("hora").textContent = horaFormatada;
      
      // Atualizar apenas o preço sem disparar análise completa
      const priceElement = document.querySelector("#criterios li:nth-child(6)");
      if (priceElement) {
        priceElement.textContent = `💰 Preço: €${parseFloat(data.price).toFixed(5)}`;
      }
    }
  };
  
  state.websocket.onerror = (error) => {
    console.error("Erro WebSocket:", error);
  };
  
  state.websocket.onclose = () => {
    console.log("WebSocket desconectado, tentando reconectar...");
    setTimeout(iniciarWebSocket, 5000);
  };
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
  const ids=['comando','score','hora','timer','criterios','ultimos','mercado-status'];
  const falt = ids.filter(id=>!document.getElementById(id));
  if (falt.length>0) { console.error("Elementos faltando:",falt); return; }
  
  setInterval(atualizarRelogio,1000);
  sincronizarTimer();
  iniciarWebSocket();
  analisarMercado();
  
  // Adiciona botão para backtesting (não altera a interface existente)
  const backtestBtn = document.createElement('button');
  backtestBtn.textContent = 'Executar Backtest (5 dias)';
  backtestBtn.style.position = 'fixed';
  backtestBtn.style.bottom = '10px';
  backtestBtn.style.right = '10px';
  backtestBtn.style.zIndex = '1000';
  backtestBtn.style.padding = '8px 16px';
  backtestBtn.style.backgroundColor = '#2c3e50';
  backtestBtn.style.color = 'white';
  backtestBtn.style.border = 'none';
  backtestBtn.style.borderRadius = '4px';
  backtestBtn.style.cursor = 'pointer';
  
  backtestBtn.onclick = () => {
    backtestBtn.textContent = 'Calculando...';
    backtestBtn.disabled = true;
    backtestSimples().then(() => {
      backtestBtn.textContent = 'Backtest Completo (ver console)';
      setTimeout(() => {
        backtestBtn.textContent = 'Executar Backtest (5 dias)';
        backtestBtn.disabled = false;
      }, 3000);
    });
  };
  document.body.appendChild(backtestBtn);
}

if(document.readyState==="complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
