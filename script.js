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
  apiKeys: ["demo"],
  currentApiKeyIndex: 0,
  marketOpen: true,
  correlationData: {}, // Novo: Dados de correlação
  mlModel: null // Novo: Modelo de machine learning
};

const CONFIG = {
  API_ENDPOINTS: ["https://api.twelvedata.com"],
  WS_ENDPOINT: "wss://stream.twelvedata.com/v1/quotes/price",
  PARES: {
    EURUSD: "EUR/USD",
    CORRELATION_PAIRS: ["USD/CHF", "GBP/USD", "USD/JPY", "XAU/USD"] // Novos pares para correlação
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
    ORDER_FLOW: 50, // Novo: período para análise de order flow
    VOLUME_PROFILE: 100 // Novo: período para volume profile
  },
  LIMIARES: {
    SCORE_ALTO: 75,
    SCORE_MEDIO: 65,
    RSI_OVERBOUGHT: 65,
    RSI_OVERSOLD: 35,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    WILLIAMS_OVERBOUGHT: -20,
    WILLIAMS_OVERSOLD: -80,
    VOLUME_ALTO: 1.3,
    VARIACAO_LATERAL: 0.8,
    VWAP_DESVIO: 0.0015,
    ATR_LIMIAR: 0.0010,
    CORRELATION_THRESHOLD: 0.7, // Novo: limiar de correlação
    ORDER_FLOW_RATIO: 1.5 // Novo: razão compra/venda
  },
  PESOS: {
    RSI: 1.5,
    MACD: 2.0,
    TENDENCIA: 1.5,
    VOLUME: 0.8,
    STOCH: 1.2,
    WILLIAMS: 1.0,
    CONFIRMACAO: 1.0,
    LATERALIDADE: 1.8,
    VWAP: 1.3,
    VOLATILIDADE: 1.2,
    CORRELACAO: 1.4, // Novo: peso para correlação
    ORDER_FLOW: 1.6, // Novo: peso para order flow
    VOLUME_PROFILE: 1.3, // Novo: peso para volume profile
    ML_CONFIDENCE: 1.7 // Novo: peso para confiança do ML
  },
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.02,
    R_R_MINIMO: 1.5,
    ATR_MULTIPLICADOR_SL: 1.5,
    ATR_MULTIPLICADOR_TP: 3,
    VOLATILITY_ADJUSTMENT: 0.5 // Novo: ajuste baseado em volatilidade
  },
  MARKET_HOURS: {
    LONDON_OPEN: 7,
    LONDON_CLOSE: 16,
    NY_OPEN: 13,
    NY_CLOSE: 22
  }
};

// =============================================
// NOVAS FUNÇÕES PARA MELHORIAS (2025)
// =============================================

// 1. Análise de Correlação
async function obterDadosCorrelacao() {
  try {
    const correlationResults = {};
    const apiKey = rotacionarApiKey();
    
    for (const par of CONFIG.PARES.CORRELATION_PAIRS) {
      const response = await fetch(`https://api.twelvedata.com/time_series?symbol=${par}&interval=15min&outputsize=50&apikey=${apiKey}`);
      if (response.ok) {
        const dados = await response.json();
        if (dados.values) {
          correlationResults[par] = dados.values.map(v => parseFloat(v.close)).filter(v => !isNaN(v));
        }
      }
    }
    
    return correlationResults;
  } catch (e) {
    console.error("Erro ao obter dados de correlação:", e);
    return {};
  }
}

function calcularCorrelacao(eurusdData, correlationData) {
  const correlations = {};
  const eurusdCloses = eurusdData.map(v => v.close);
  
  for (const [par, dados] of Object.entries(correlationData)) {
    if (dados.length === eurusdCloses.length) {
      const meanX = eurusdCloses.reduce((a, b) => a + b, 0) / eurusdCloses.length;
      const meanY = dados.reduce((a, b) => a + b, 0) / dados.length;
      
      let numerator = 0;
      let denomX = 0;
      let denomY = 0;
      
      for (let i = 0; i < eurusdCloses.length; i++) {
        numerator += (eurusdCloses[i] - meanX) * (dados[i] - meanY);
        denomX += Math.pow(eurusdCloses[i] - meanX, 2);
        denomY += Math.pow(dados[i] - meanY, 2);
      }
      
      correlations[par] = numerator / Math.sqrt(denomX * denomY);
    }
  }
  
  return correlations;
}

// 2. Order Flow Analysis (simplificado)
function analisarOrderFlow(dados) {
  if (!Array.isArray(dados) || dados.length < CONFIG.PERIODOS.ORDER_FLOW) return { buyRatio: 1, pressure: 0 };
  
  const slice = dados.slice(-CONFIG.PERIODOS.ORDER_FLOW);
  let buyVolume = 0;
  let sellVolume = 0;
  
  for (let i = 1; i < slice.length; i++) {
    if (slice[i].close > slice[i-1].close) {
      buyVolume += slice[i].volume;
    } else if (slice[i].close < slice[i-1].close) {
      sellVolume += slice[i].volume;
    }
  }
  
  const totalVolume = buyVolume + sellVolume;
  return {
    buyRatio: totalVolume > 0 ? buyVolume / totalVolume : 0.5,
    pressure: totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0
  };
}

// 3. Volume Profile Analysis
function calcularVolumeProfile(dados) {
  if (!Array.isArray(dados) || dados.length < CONFIG.PERIODOS.VOLUME_PROFILE) return { poc: 0, vaHigh: 0, vaLow: 0 };
  
  const slice = dados.slice(-CONFIG.PERIODOS.VOLUME_PROFILE);
  const priceLevels = {};
  
  // Criar buckets de preço
  const minPrice = Math.min(...slice.map(v => v.low));
  const maxPrice = Math.max(...slice.map(v => v.high));
  const range = maxPrice - minPrice;
  const bucketSize = range / 20;
  
  // Agregar volume por nível de preço
  for (const vela of slice) {
    const typicalPrice = (vela.high + vela.low + vela.close) / 3;
    const bucket = Math.floor((typicalPrice - minPrice) / bucketSize);
    const priceLevel = minPrice + (bucket * bucketSize);
    
    if (!priceLevels[priceLevel]) {
      priceLevels[priceLevel] = 0;
    }
    priceLevels[priceLevel] += vela.volume;
  }
  
  // Encontrar POC (Point of Control)
  let poc = 0;
  let maxVolume = 0;
  for (const [price, volume] of Object.entries(priceLevels)) {
    if (volume > maxVolume) {
      maxVolume = volume;
      poc = parseFloat(price);
    }
  }
  
  // Calcular Value Area (simplificado)
  const sortedLevels = Object.entries(priceLevels)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.floor(Object.keys(priceLevels).length * 0.7));
  
  const pricesInVA = sortedLevels.map(v => parseFloat(v[0]));
  const vaHigh = Math.max(...pricesInVA);
  const vaLow = Math.min(...pricesInVA);
  
  return { poc, vaHigh, vaLow };
}

// 4. Modelo de Machine Learning Simplificado
function preverComML(indicadores) {
  // Simulação de um modelo de ML - na prática você integraria um modelo real
  const features = [
    indicadores.rsi / 100,
    indicadores.macd.histograma * 10,
    indicadores.stoch.k / 100,
    indicadores.williams / -100,
    indicadores.close > indicadores.emaCurta ? 1 : 0,
    indicadores.volume / indicadores.volumeMedia,
    indicadores.atr * 1000
  ];
  
  // Pesos "aprendidos" - simulação
  const weights = [0.15, 0.25, 0.12, 0.1, 0.18, 0.1, 0.1];
  let prediction = 0;
  
  for (let i = 0; i < features.length; i++) {
    prediction += features[i] * weights[i];
  }
  
  // Retorna confiança e direção
  return {
    confidence: Math.min(1, Math.max(0, Math.abs(prediction))),
    direction: prediction > 0 ? 'CALL' : 'PUT'
  };
}

// =============================================
// ATUALIZAÇÃO DA FUNÇÃO calcularScore (2025)
// =============================================
function calcularScore(indicadores) {
  let score = 50;

  // Análise de RSI
  if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) {
    score += 25 * CONFIG.PESOS.RSI;
    if (indicadores.tendencia.includes("BAIXA")) score -= 10;
  }
  else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) {
    score -= 25 * CONFIG.PESOS.RSI;
    if (indicadores.tendencia.includes("ALTA")) score += 10;
  }
  else if (indicadores.rsi < 45) score += 10 * CONFIG.PESOS.RSI;
  else if (indicadores.rsi > 55) score -= 10 * CONFIG.PESOS.RSI;

  // Análise MACD
  score += (Math.min(Math.max(indicadores.macd.histograma * 10, -15), 15) * CONFIG.PESOS.MACD);

  // Análise de Tendência
  switch(indicadores.tendencia) {
    case "FORTE_ALTA": 
      score += 20 * CONFIG.PESOS.TENDENCIA; 
      if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.2) score += 5;
      break;
    case "ALTA": score += 12 * CONFIG.PESOS.TENDENCIA; break;
    case "FORTE_BAIXA": 
      score -= 20 * CONFIG.PESOS.TENDENCIA; 
      if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.2) score -= 5;
      break;
    case "BAIXA": score -= 12 * CONFIG.PESOS.TENDENCIA; break;
    case "LATERAL": 
      score -= Math.min(state.contadorLaterais, 12) * CONFIG.PESOS.LATERALIDADE; 
      break;
  }

  // Análise de Volume
  if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
    score += (indicadores.tendencia.includes("ALTA") ? 8 : -8) * CONFIG.PESOS.VOLUME;
  }

  // Análise Stochastic
  if (indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && 
      indicadores.stoch.d < CONFIG.LIMIARES.STOCH_OVERSOLD) {
    score += 12 * CONFIG.PESOS.STOCH;
    if (indicadores.tendencia.includes("ALTA")) score -= 5;
  }
  if (indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && 
      indicadores.stoch.d > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
    score -= 12 * CONFIG.PESOS.STOCH;
    if (indicadores.tendencia.includes("BAIXA")) score += 5;
  }

  // Análise Williams
  if (indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) {
    score += 10 * CONFIG.PESOS.WILLIAMS; 
    if (indicadores.rsi < 40) score += 3;
  }
  if (indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) {
    score -= 10 * CONFIG.PESOS.WILLIAMS; 
    if (indicadores.rsi > 60) score -= 3;
  }

  // Análise VWAP
  const vwapDesvio = Math.abs(indicadores.close - indicadores.vwap) / Math.max(indicadores.vwap, 0.000001);
  if (vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO) {
    score += (indicadores.close > indicadores.vwap ? 8 : -8) * CONFIG.PESOS.VWAP;
  }

  // Análise de Volatilidade (ATR)
  if (indicadores.atr > CONFIG.LIMIARES.ATR_LIMIAR) {
    score += 5 * CONFIG.PESOS.VOLATILIDADE;
  }

  // =============================================
  // NOVOS COMPONENTES DO SCORE (2025)
  // =============================================
  
  // 1. Análise de Correlação
  if (indicadores.correlacao) {
    for (const [par, valor] of Object.entries(indicadores.correlacao)) {
      if (Math.abs(valor) > CONFIG.LIMIARES.CORRELATION_THRESHOLD) {
        score += (valor > 0 ? 5 : -5) * CONFIG.PESOS.CORRELACAO;
      }
    }
  }

  // 2. Order Flow Analysis
  if (indicadores.orderFlow) {
    if (indicadores.orderFlow.buyRatio > 0.6) {
      score += 8 * CONFIG.PESOS.ORDER_FLOW;
    } else if (indicadores.orderFlow.buyRatio < 0.4) {
      score -= 8 * CONFIG.PESOS.ORDER_FLOW;
    }
    
    if (Math.abs(indicadores.orderFlow.pressure) > 0.3) {
      score += indicadores.orderFlow.pressure > 0 ? 
        5 * CONFIG.PESOS.ORDER_FLOW : 
        -5 * CONFIG.PESOS.ORDER_FLOW;
    }
  }

  // 3. Volume Profile Analysis
  if (indicadores.volumeProfile) {
    const { poc, vaHigh, vaLow } = indicadores.volumeProfile;
    const price = indicadores.close;
    
    if (price > vaHigh) {
      score += 5 * CONFIG.PESOS.VOLUME_PROFILE;
    } else if (price < vaLow) {
      score -= 5 * CONFIG.PESOS.VOLUME_PROFILE;
    } else if (Math.abs(price - poc) < (vaHigh - vaLow) * 0.1) {
      score -= 3 * CONFIG.PESOS.VOLUME_PROFILE; // Perto do POC pode indicar indecisão
    }
  }

  // 4. Machine Learning Prediction
  if (indicadores.mlPrediction) {
    score += indicadores.mlPrediction.confidence * 
      (indicadores.mlPrediction.direction === 'CALL' ? 10 : -10) * 
      CONFIG.PESOS.ML_CONFIDENCE;
  }

  // Confirmações
  const confirmacoes = [
    indicadores.rsi < 40 || indicadores.rsi > 60,
    Math.abs(indicadores.macd.histograma) > 0.05,
    indicadores.stoch.k < 30 || indicadores.stoch.k > 70,
    indicadores.williams < -70 || indicadores.williams > -30,
    indicadores.tendencia !== "LATERAL",
    vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO * 0.8,
    indicadores.orderFlow?.buyRatio > 0.55 || indicadores.orderFlow?.buyRatio < 0.45,
    indicadores.volumeProfile ? (indicadores.close > indicadores.volumeProfile.vaHigh || 
                               indicadores.close < indicadores.volumeProfile.vaLow) : false
  ].filter(Boolean).length;

  score += confirmacoes * 4 * CONFIG.PESOS.CONFIRMACAO;

  if (state.ultimoSinal) {
    score += (state.ultimoSinal === "CALL" ? -10 : 10);
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

// =============================================
// ATUALIZAÇÃO DA FUNÇÃO analisarMercado (2025)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    // Obter dados principais
    const dados = await obterDadosForex();
    if (!dados || dados.length === 0) throw new Error("Dados vazios");
    
    // Obter dados de correlação em paralelo
    const correlationPromise = obterDadosCorrelacao();
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    const emaCurtaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const emaLongaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema200Array  = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200);
    
    const emaCurta = emaCurtaArray[emaCurtaArray.length - 1] || 0;
    const emaLonga = emaLongaArray[emaLongaArray.length - 1] || 0;
    const ema200   = ema200Array[ema200Array.length - 1] || 0;

    // Calcular correlações
    const correlationData = await correlationPromise;
    const correlacoes = calcularCorrelacao(dados, correlationData);

    // Novo: Criar objeto de indicadores com todos os dados
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
      close: velaAtual.close,
      tendencia: avaliarTendencia(closes, emaCurta, emaLonga, ema200),
      correlacao: correlacoes, // Novo: Dados de correlação
      orderFlow: analisarOrderFlow(dados), // Novo: Análise de order flow
      volumeProfile: calcularVolumeProfile(dados), // Novo: Volume profile
      mlPrediction: preverComML({ // Novo: Predição de ML
        rsi: calcularRSI(closes),
        macd: calcularMACD(closes),
        stoch: calcularStochastic(highs, lows, closes),
        williams: calcularWilliams(highs, lows, closes),
        close: velaAtual.close,
        emaCurta,
        volume: velaAtual.volume,
        volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME) || 1,
        atr: calcularATR(dados)
      })
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
          indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : ''}</li>
        <li>📊 MACD: ${indicadores.macd.histograma.toFixed(6)} ${
          indicadores.macd.histograma>0?'🟢':'🔴'}</li>
        <li>📈 Stochastic K/D: ${indicadores.stoch.k.toFixed(2)}/${indicadores.stoch.d.toFixed(2)}</li>
        <li>📊 Williams: ${indicadores.williams.toFixed(2)}</li>
        <li>💰 Preço: €${indicadores.close.toFixed(5)} ${
          indicadores.close>emaCurta?'🟢':'🔴'}</li>
        <li>📶 Médias: EMA${CONFIG.PERIODOS.EMA_CURTA} ${indicadores.emaCurta.toFixed(5)} | EMA${CONFIG.PERIODOS.EMA_LONGA} ${indicadores.emaLonga.toFixed(5)} | EMA200 ${indicadores.ema200.toFixed(5)}</li>
        <li>💹 Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)}</li>
        <li>📌 VWAP: ${indicadores.vwap.toFixed(5)} | ATR: ${indicadores.atr.toFixed(6)}</li>
        ${indicadores.correlacao ? `<li>🔗 Correlações: ${Object.entries(indicadores.correlacao)
          .map(([k,v]) => `${k}: ${v.toFixed(2)}`)
          .join(', ')}</li>` : ''}
        ${indicadores.orderFlow ? `<li>🔄 Order Flow: ${(indicadores.orderFlow.buyRatio*100).toFixed(1)}% compras (${indicadores.orderFlow.pressure>0?'+':''}${indicadores.orderFlow.pressure.toFixed(2)})</li>` : ''}
        ${indicadores.volumeProfile ? `<li>🏦 Volume Profile: POC ${indicadores.volumeProfile.poc.toFixed(5)} | VA ${indicadores.volumeProfile.vaLow.toFixed(5)}-${indicadores.volumeProfile.vaHigh.toFixed(5)}</li>` : ''}
        ${indicadores.mlPrediction ? `<li>🤖 ML: ${indicadores.mlPrediction.direction} (${(indicadores.mlPrediction.confidence*100).toFixed(1)}% conf.)</li>` : ''}
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
// RESTANTE DO CÓDIGO PERMANECE IGUAL
// =============================================
// [Todas as outras funções permanecem exatamente como estão no código original]
// =============================================

// Função de inicialização (com pequena melhoria)
function iniciarAplicativo() {
  const ids=['comando','score','hora','timer','criterios','ultimos'];
  const falt = ids.filter(id=>!document.getElementById(id));
  if (falt.length>0) {
    console.error("Elementos faltando:", falt);
    return;
  }
  
  // Inicializar modelo de ML (simulado)
  state.mlModel = { ready: true }; // Na prática, carregaria um modelo real
  
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  analisarMercado();
}

if(document.readyState==="complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
