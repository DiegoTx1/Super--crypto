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
  apiKeys: ["demo"],
  currentApiKeyIndex: 0,
  marketOpen: true,
  sentimentData: null // Novo estado para dados de sentimento
};

const CONFIG = {
  API_ENDPOINTS: ["https://api.twelvedata.com", "https://api.binance.com"],
  WS_ENDPOINT: "wss://stream.binance.com:9443/ws",
  PARES: {
    BTCUSDT: "BTC/USDT",
    ETHUSDT: "ETH/USDT"
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
    MACD_LONGA: 26,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 30,
    VWAP: 20,
    ATR: 14,
    SUPERTREND: 10,
    SUPERTREND_MULTIPLIER: 3,
    ICHIMOKU_TENKAN: 9,
    ICHIMOKU_KIJUN: 26,
    ICHIMOKU_SENKOU: 52,
    // Novos períodos adicionados
    VW_MACD_RAPIDA: 12,
    VW_MACD_LONGA: 26,
    VW_MACD_SINAL: 9,
    LZI_WINDOW: 14,
    FRACTAL_DEPTH: 3,
    SENTIMENT_WINDOW: 6
  },
  LIMIARES: {
    SCORE_ALTO: 80,
    SCORE_MEDIO: 65,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    WILLIAMS_OVERBOUGHT: -15,
    WILLIAMS_OVERSOLD: -85,
    VOLUME_ALTO: 1.5,
    VARIACAO_LATERAL: 2.5,
    VWAP_DESVIO: 0.003,
    ATR_LIMIAR: 0.0050,
    MIN_INCLINACAO_EMA: 0.5,
    // Novos limiares adicionados
    LZI_THRESHOLD: 0.85,
    FRACTAL_CONFIRMATION: 2,
    VW_MACD_SIGNAL: 0.1,
    SENTIMENT_THRESHOLD: 0.7
  },
  PESOS: {
    RSI: 1.5,
    MACD: 2.0,
    TENDENCIA: 2.5,
    VOLUME: 1.2,
    STOCH: 1.0,
    WILLIAMS: 1.0,
    CONFIRMACAO: 1.0,
    LATERALIDADE: 1.0,
    VWAP: 1.2,
    VOLATILIDADE: 1.5,
    SUPERTREND: 2.5,
    ICHIMOKU: 2.0,
    // Novos pesos adicionados
    VW_MACD: 2.0,
    LZI: 1.5,
    FRACTAL: 1.3,
    SENTIMENT: 1.2
  },
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.01,
    R_R_MINIMO: 2.0,
    ATR_MULTIPLICADOR_SL: 2,
    ATR_MULTIPLICADOR_TP: 4
  }
};

// =============================================
// FUNÇÕES UTILITÁRIAS (MANTIDAS)
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
    state.marketOpen = true;
  }
}

function atualizarInterface(sinal, score) {
  if (!state.marketOpen && sinal !== "ERRO") return;
  
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
  
  document.getElementById("hora").textContent = state.ultimaAtualizacao;
}

function rotacionarApiKey() {
  state.currentApiKeyIndex = (state.currentApiKeyIndex + 1) % state.apiKeys.length;
  return state.apiKeys[state.currentApiKeyIndex];
}

// =============================================
// INDICADORES TÉCNICOS (ATUALIZADOS)
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

  // Nova função para EMA ponderada por volume
  volumeWeighted: (dados, volumes, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return [];
    
    let vwma = [];
    for (let i = periodo - 1; i < dados.length; i++) {
      let sumProd = 0;
      let sumVol = 0;
      for (let j = 0; j < periodo; j++) {
        const idx = i - (periodo - 1) + j;
        sumProd += dados[idx] * volumes[idx];
        sumVol += volumes[idx];
      }
      vwma.push(sumVol > 0 ? sumProd / sumVol : 0);
    }
    return vwma;
  }
};

// Função RSI mantida (já está bem otimizada)
function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  // ... (mantido igual)
}

// Função Stochastic mantida
function calcularStochastic(highs, lows, closes, periodo = CONFIG.PERIODOS.STOCH) {
  // ... (mantido igual)
}

// Função Williams %R mantida
function calcularWilliams(highs, lows, closes, periodo = CONFIG.PERIODOS.WILLIAMS) {
  // ... (mantido igual)
}

// MACD tradicional mantido
function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, 
                    lenta = CONFIG.PERIODOS.MACD_LONGA, 
                    sinal = CONFIG.PERIODOS.MACD_SINAL) {
  // ... (mantido igual)
}

// Novo: Volume-Weighted MACD
function calcularVWMACD(closes, volumes, 
                       rapida = CONFIG.PERIODOS.VW_MACD_RAPIDA,
                       lenta = CONFIG.PERIODOS.VW_MACD_LONGA,
                       sinal = CONFIG.PERIODOS.VW_MACD_SINAL) {
  try {
    if (!Array.isArray(closes) || closes.length < lenta + sinal) {
      return { histograma: 0, vwmacdLinha: 0, sinalLinha: 0 };
    }

    // Calcula EMAs ponderadas por volume
    const vwemaRapida = calcularMedia.volumeWeighted(closes, volumes, rapida);
    const vwemaLenta = calcularMedia.volumeWeighted(closes, volumes, lenta);
    
    // Calcula linha VW-MACD
    const vwmacdLinha = vwemaRapida.map((val, idx) => val - vwemaLenta[idx]);
    
    // Calcula linha de sinal (EMA do VW-MACD)
    const sinalLinha = calcularMedia.exponencial(vwmacdLinha, sinal);
    
    const ultimoVWMACD = vwmacdLinha[vwmacdLinha.length - 1] || 0;
    const ultimoSinal = sinalLinha[sinalLinha.length - 1] || 0;
    
    return {
      histograma: ultimoVWMACD - ultimoSinal,
      vwmacdLinha: ultimoVWMACD,
      sinalLinha: ultimoSinal
    };
  } catch (e) {
    console.error("Erro no cálculo VW-MACD:", e);
    return { histograma: 0, vwmacdLinha: 0, sinalLinha: 0 };
  }
}

// Novo: Liquidity Zone Indicator
function calcularLiquidityZones(closes, volumes, window = CONFIG.PERIODOS.LZI_WINDOW) {
  try {
    if (!Array.isArray(closes) || closes.length < window) return { zona: null, forca: 0 };
    
    // Calcula clusters de preço com volume significativo
    const priceClusters = {};
    for (let i = Math.max(0, closes.length - window); i < closes.length; i++) {
      const priceLevel = parseFloat(closes[i].toFixed(2));
      priceClusters[priceLevel] = (priceClusters[priceLevel] || 0) + volumes[i];
    }
    
    // Ordena por volume
    const sortedClusters = Object.entries(priceClusters).sort((a, b) => b[1] - a[1]);
    
    if (sortedClusters.length < 2) return { zona: null, forca: 0 };
    
    const currentPrice = closes[closes.length - 1];
    const [dominantLevel, dominantVolume] = sortedClusters[0];
    const [secondaryLevel, secondaryVolume] = sortedClusters[1];
    
    const volumeRatio = dominantVolume / (dominantVolume + secondaryVolume);
    const isSupport = dominantLevel < currentPrice;
    
    return {
      zona: volumeRatio > CONFIG.LIMIARES.LZI_THRESHOLD ? 
           (isSupport ? 'compra' : 'venda') : null,
      forca: volumeRatio,
      nivel: parseFloat(dominantLevel)
    };
  } catch (e) {
    console.error("Erro no cálculo LZI:", e);
    return { zona: null, forca: 0 };
  }
}

// Novo: Advanced Fractal Detection
function detectarFractaisAvancados(highs, lows, depth = CONFIG.PERIODOS.FRACTAL_DEPTH) {
  try {
    if (!Array.isArray(highs) || highs.length < depth * 2 + 1) return { sinal: null, confirmacoes: 0 };
    
    let bullishConfirmations = 0;
    let bearishConfirmations = 0;
    const currentIdx = highs.length - 1;
    
    // Verifica fractais em múltiplos níveis
    for (let d = 1; d <= depth; d++) {
      // Bullish fractal (vale com dois picos laterais)
      const lowIdx = currentIdx - d;
      if (lowIdx >= depth && lowIdx < lows.length - depth) {
        let isBullish = true;
        for (let i = 1; i <= depth; i++) {
          if (lows[lowIdx] >= lows[lowIdx - i] || lows[lowIdx] >= lows[lowIdx + i]) {
            isBullish = false;
            break;
          }
        }
        if (isBullish) bullishConfirmations++;
      }
      
      // Bearish fractal (pico com dois vales laterais)
      const highIdx = currentIdx - d;
      if (highIdx >= depth && highIdx < highs.length - depth) {
        let isBearish = true;
        for (let i = 1; i <= depth; i++) {
          if (highs[highIdx] <= highs[highIdx - i] || highs[highIdx] <= highs[highIdx + i]) {
            isBearish = false;
            break;
          }
        }
        if (isBearish) bearishConfirmations++;
      }
    }
    
    return {
      sinal: bullishConfirmations > bearishConfirmations ? 'alta' : 
            bearishConfirmations > bullishConfirmations ? 'baixa' : null,
      confirmacoes: Math.max(bullishConfirmations, bearishConfirmations)
    };
  } catch (e) {
    console.error("Erro no cálculo Fractais:", e);
    return { sinal: null, confirmacoes: 0 };
  }
}

// Funções existentes mantidas (VWAP, ATR, Supertrend, Ichimoku)
// ... (mantidas iguais)

// =============================================
// SISTEMA DE DECISÃO (ATUALIZADO)
// =============================================
function detectarMercadoLateral(closes) {
  // ... (mantido igual)
}

function avaliarTendencia(closes, emaCurta, emaLonga, ema200, supertrend, ichimoku) {
  // ... (mantido igual)
}

function calcularScore(indicadores) {
  let score = 50;

  // RSI (mantido)
  if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) {
    score += 25 * CONFIG.PESOS.RSI;
    if (indicadores.tendencia.includes("BAIXA")) score -= 10;
  }
  else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) {
    score -= 25 * CONFIG.PESOS.RSI;
    if (indicadores.tendencia.includes("ALTA")) score += 10;
  }
  else if (indicadores.rsi < 40) score += 10 * CONFIG.PESOS.RSI;
  else if (indicadores.rsi > 60) score -= 10 * CONFIG.PESOS.RSI;

  // MACD tradicional (mantido)
  score += (Math.min(Math.max(indicadores.macd.histograma * 100, -15), 15)) * CONFIG.PESOS.MACD;

  // VW-MACD (novo)
  score += (Math.min(Math.max(indicadores.vwmacd.histograma * 100, -15), 15)) * CONFIG.PESOS.VW_MACD;

  // Tendência (mantido)
  switch(indicadores.tendencia) {
    case "FORTE_ALTA": 
      score += 30 * CONFIG.PESOS.TENDENCIA;
      if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.5) score += 10;
      break;
    case "ALTA": score += 20 * CONFIG.PESOS.TENDENCIA; break;
    case "FORTE_BAIXA": 
      score -= 30 * CONFIG.PESOS.TENDENCIA;
      if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.5) score -= 10;
      break;
    case "BAIXA": score -= 20 * CONFIG.PESOS.TENDENCIA; break;
    case "LATERAL": 
      score -= Math.min(state.contadorLaterais, 10) * CONFIG.PESOS.LATERALIDADE;
      break;
  }

  // Volume (mantido)
  if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
    score += (indicadores.tendencia.includes("ALTA") ? 12 : -12) * CONFIG.PESOS.VOLUME;
  }

  // Stochastic (mantido)
  if (indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && 
      indicadores.stoch.d < CONFIG.LIMIARES.STOCH_OVERSOLD) {
    score += 15 * CONFIG.PESOS.STOCH;
  }
  if (indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && 
      indicadores.stoch.d > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
    score -= 15 * CONFIG.PESOS.STOCH;
  }

  // Williams (mantido)
  if (indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) {
    score += 12 * CONFIG.PESOS.WILLIAMS;
  }
  if (indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) {
    score -= 12 * CONFIG.PESOS.WILLIAMS;
  }

  // VWAP (mantido)
  const vwapDesvio = Math.abs(indicadores.close - indicadores.vwap) / Math.max(indicadores.vwap, 0.000001);
  if (vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO) {
    score += (indicadores.close > indicadores.vwap ? 12 : -12) * CONFIG.PESOS.VWAP;
  }

  // ATR (mantido)
  if (indicadores.atr > CONFIG.LIMIARES.ATR_LIMIAR) {
    score += 10 * CONFIG.PESOS.VOLATILIDADE;
  }

  // Supertrend (mantido)
  if (indicadores.supertrend.direcao === 'up') {
    score += 18 * CONFIG.PESOS.SUPERTREND;
  } else if (indicadores.supertrend.direcao === 'down') {
    score -= 18 * CONFIG.PESOS.SUPERTREND;
  }

  // Ichimoku (mantido)
  if (indicadores.ichimoku) {
    if (indicadores.ichimoku.acimaDaNuvem && indicadores.ichimoku.tendencia === 'alta') {
      score += 15 * CONFIG.PESOS.ICHIMOKU;
    } else if (indicadores.ichimoku.abaixoDaNuvem && indicadores.ichimoku.tendencia === 'baixa') {
      score -= 15 * CONFIG.PESOS.ICHIMOKU;
    }
  }

  // LZI (novo)
  if (indicadores.lzi.zona === 'compra') {
    score += 15 * CONFIG.PESOS.LZI;
  } else if (indicadores.lzi.zona === 'venda') {
    score -= 15 * CONFIG.PESOS.LZI;
  }

  // Fractais (novo)
  if (indicadores.fractais.sinal === 'alta' && 
      indicadores.fractais.confirmacoes >= CONFIG.LIMIARES.FRACTAL_CONFIRMATION) {
    score += 12 * CONFIG.PESOS.FRACTAL;
  } else if (indicadores.fractais.sinal === 'baixa' && 
             indicadores.fractais.confirmacoes >= CONFIG.LIMIARES.FRACTAL_CONFIRMATION) {
    score -= 12 * CONFIG.PESOS.FRACTAL;
  }

  // Confirmações (atualizado)
  const confirmacoes = [
    indicadores.rsi < 35 || indicadores.rsi > 65,
    Math.abs(indicadores.macd.histograma) > 0.1,
    Math.abs(indicadores.vwmacd.histograma) > CONFIG.LIMIARES.VW_MACD_SIGNAL,
    indicadores.stoch.k < 20 || indicadores.stoch.k > 80,
    indicadores.williams < -80 || indicadores.williams > -20,
    indicadores.tendencia !== "LATERAL",
    vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO * 0.8,
    indicadores.supertrend.direcao !== null,
    indicadores.ichimoku && (indicadores.ichimoku.acimaDaNuvem || indicadores.ichimoku.abaixoDaNuvem),
    indicadores.lzi.zona !== null,
    indicadores.fractais.confirmacoes >= CONFIG.LIMIARES.FRACTAL_CONFIRMATION
  ].filter(Boolean).length;

  score += confirmacoes * 5 * CONFIG.PESOS.CONFIRMACAO;

  if (state.ultimoSinal) {
    score += (state.ultimoSinal === "CALL" ? -10 : 10);
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia) {
  // ... (mantido igual)
}

// =============================================
// CORE DO SISTEMA (ATUALIZADO)
// =============================================
async function obterDadosCripto() {
  // ... (mantido igual)
}

async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosCripto();
    if (!dados || dados.length === 0) throw new Error("Dados vazios");
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Cálculos mantidos
    const emaCurtaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const emaLongaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema200Array  = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200);
    
    const emaCurta = emaCurtaArray[emaCurtaArray.length - 1] || 0;
    const emaLonga = emaLongaArray[emaLongaArray.length - 1] || 0;
    const ema200   = ema200Array[ema200Array.length - 1] || 0;

    const supertrend = calcularSupertrend(highs, lows, closes);
    const ichimoku = calcularIchimoku(highs, lows, closes);

    // Novos cálculos adicionados
    const vwmacd = calcularVWMACD(closes, volumes);
    const lzi = calcularLiquidityZones(closes, volumes);
    const fractais = detectarFractaisAvancados(highs, lows);

    const indicadores = {
      // Indicadores existentes mantidos
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      sma9: calcularMedia.simples(closes, 9),
      emaCurta,
      emaLonga,
      ema200,
      volume: velaAtual.volume > 0 ? velaAtual.volume : 0.001,
      volumeMedia: Math.max(calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME), 0.001) || 0.001,
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      vwap: calcularVWAP(dados),
      atr: calcularATR(dados),
      supertrend,
      ichimoku,
      close: velaAtual.close,
      tendencia: avaliarTendencia(closes, emaCurta, emaLonga, ema200, supertrend, ichimoku),
      
      // Novos indicadores adicionados
      vwmacd,
      lzi,
      fractais
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
          indicadores.macd.histograma>0?'🟢':'🔴'}</li>
        <li>📊 VW-MACD: ${indicadores.vwmacd.histograma.toFixed(6)} ${
          indicadores.vwmacd.histograma>0?'🟢':'🔴'}</li>
        <li>📈 Stochastic K/D: ${indicadores.stoch.k.toFixed(2)}/${indicadores.stoch.d.toFixed(2)}</li>
        <li>📊 Williams: ${indicadores.williams.toFixed(2)}</li>
        <li>💰 Preço: $${indicadores.close.toFixed(2)} ${
          indicadores.close>emaCurta?'🟢':'🔴'}</li>
        <li>📶 Médias: EMA${CONFIG.PERIODOS.EMA_CURTA} ${indicadores.emaCurta.toFixed(2)} | EMA${CONFIG.PERIODOS.EMA_LONGA} ${indicadores.emaLonga.toFixed(2)} | EMA200 ${indicadores.ema200.toFixed(2)}</li>
        <li>💹 Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)} ${
          indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO ? '🔊' : ''}</li>
        <li>📌 VWAP: ${indicadores.vwap.toFixed(2)} | ATR: ${indicadores.atr.toFixed(4)}</li>
        <li>🌀 Supertrend: ${indicadores.supertrend.direcao || 'N/A'} ${
          indicadores.supertrend.direcao === 'up' ? '🟢' : 
          indicadores.supertrend.direcao === 'down' ? '🔴' : '⚪'}</li>
        <li>🏦 LZI: ${indicadores.lzi.zona || 'N/A'} ${
          indicadores.lzi.zona === 'compra' ? '🟢' : 
          indicadores.lzi.zona === 'venda' ? '🔴' : '⚪'} (${(indicadores.lzi.forca*100).toFixed(1)}%)</li>
        <li>🔷 Fractais: ${indicadores.fractais.sinal || 'N/A'} ${
          indicadores.fractais.sinal === 'alta' ? '🟢' : 
          indicadores.fractais.sinal === 'baixa' ? '🔴' : '⚪'} (${indicadores.fractais.confirmacoes}x)</li>
        ${indicadores.ichimoku ? `
        <li>☁️ Ichimoku: ${indicadores.ichimoku.tendencia} ${
          indicadores.ichimoku.acimaDaNuvem ? '☀️' : 
          indicadores.ichimoku.abaixoDaNuvem ? '🌧️' : '⛅'}</li>
        ` : ''}
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
  // ... (mantido igual)
}

// =============================================
// INICIALIZAÇÃO (MANTIDA)
// =============================================
function iniciarAplicativo() {
  // ... (mantido igual)
}

function iniciarWebSocket() {
  // ... (mantido igual)
}

if(document.readyState==="complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
