// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADO 2024)
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
  apiKeys: ["9cf795b2a4f14d43a049ca935d174ebb"], // SUA CHAVE AQUI
  currentApiKeyIndex: 0,
  marketOpen: true,
  lastEMAs: { curta: null, longa: null, _200: null }
};

const CONFIG = {
  API_ENDPOINTS: [
    "https://api.twelvedata.com/time_series?symbol=EUR/USD&interval=1min&apikey=9cf795b2a4f14d43a049ca935d174ebb", // Dados históricos
    "wss://ws.twelvedata.com/v1/quotes?apikey=9cf795b2a4f14d43a049ca935d174ebb&symbol=EUR/USD" // WebSocket (tempo real)
  ],
  PARES: { EURUSD: "EUR/USD" },
  PERIODOS: {
    RSI: 14,
    STOCH: 14,
    WILLIAMS: 14,
    EMA_CURTA: 8,
    EMA_LONGA: 34,
    EMA_200: 200,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 30,
    VWAP: 20,
    ATR: 14
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
    ATR_LIMIAR: 0.0010
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
    VOLATILIDADE: 1.2
  },
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.02,
    R_R_MINIMO: 1.5,
    ATR_MULTIPLICADOR_SL: 1.5,
    ATR_MULTIPLICADOR_TP: 3
  },
  MARKET_HOURS: {
    LONDON_OPEN: 7,
    LONDON_CLOSE: 16,
    NY_OPEN: 13,
    NY_CLOSE: 22
  }
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
    elementoHora.textContent = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const gmtHours = now.getUTCHours();
    const isLondonOpen = gmtHours >= CONFIG.MARKET_HOURS.LONDON_OPEN && gmtHours < CONFIG.MARKET_HOURS.LONDON_CLOSE;
    const isNYOpen = gmtHours >= CONFIG.MARKET_HOURS.NY_OPEN && gmtHours < CONFIG.MARKET_HOURS.NY_CLOSE;
    state.marketOpen = isLondonOpen || isNYOpen;
    
    if (!state.marketOpen) {
      document.getElementById("comando").textContent = "MERCADO FECHADO";
      document.getElementById("comando").className = "esperar";
    }
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
// INDICADORES TÉCNICOS (OTIMIZADOS)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return null;
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  },

  exponencial: (dados, periodo, previousEMA = null) => {
    if (!Array.isArray(dados) || dados.length === 0) return null;
    
    const k = 2 / (periodo + 1);
    
    if (previousEMA !== null) {
      if (dados.length === 0) return previousEMA;
      return dados[dados.length - 1] * k + previousEMA * (1 - k);
    }
    
    if (dados.length < periodo) return null;
    
    let ema = calcularMedia.simples(dados.slice(0, periodo), periodo);
    for (let i = periodo; i < dados.length; i++) {
      ema = dados[i] * k + ema * (1 - k);
    }
    
    return ema;
  },

  volumeNormalizado: (volumes) => {
    if (!volumes.length) return [1];
    const avg = calcularMedia.simples(volumes, volumes.length);
    return volumes.map(v => v / avg);
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
  let avgLoss = Math.max(losses / periodo, 0.000001);

  for (let i = periodo + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    
    avgGain = (avgGain * (periodo - 1) + gain) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
  }

  const rs = avgGain / Math.max(avgLoss, 0.000001);
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, periodo = CONFIG.PERIODOS.STOCH) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo) return { k: 50, d: 50 };
    
    const kValues = [];
    for (let i = periodo-1; i < closes.length; i++) {
      const sliceHigh = highs.slice(Math.max(0, i-periodo+1), i+1);
      const sliceLow = lows.slice(Math.max(0, i-periodo+1), i+1);
      const highestHigh = Math.max(...sliceHigh);
      const lowestLow = Math.min(...sliceLow);
      const range = highestHigh - lowestLow;
      kValues.push(range > 0 ? ((closes[i] - lowestLow) / range) * 100 : 50);
    }
    
    const dValues = kValues.length >= 3 ? 
      calcularMedia.simples(kValues.slice(-3), 3) : 
      50;
    
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

    // Calcular EMAs rápidas e lentas
    const emaRapida = [];
    const emaLenta = [];
    
    for (let i = rapida; i <= closes.length; i++) {
      emaRapida.push(calcularMedia.exponencial(closes.slice(0, i), rapida));
    }
    
    for (let i = lenta; i <= closes.length; i++) {
      emaLenta.push(calcularMedia.exponencial(closes.slice(0, i), lenta));
    }
    
    // Calcular linha MACD (diferença entre EMAs)
    const macdLinha = [];
    const startIdx = lenta - rapida;
    
    for (let i = 0; i < emaRapida.length; i++) {
      if (i >= startIdx) {
        macdLinha.push(emaRapida[i] - emaLenta[i-startIdx]);
      }
    }
    
    // Calcular linha de sinal (EMA da linha MACD)
    const sinalLinha = [];
    for (let i = sinal; i <= macdLinha.length; i++) {
      sinalLinha.push(calcularMedia.exponencial(macdLinha.slice(0, i), sinal));
    }
    
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
      if (!vela.volume || isNaN(vela.volume)) continue;
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

// =============================================
// SISTEMA DE DECISÃO (ATUALIZADO)
// =============================================
function avaliarTendencia(closes, emaCurta, emaLonga, ema200) {
  if (!Array.isArray(closes) || closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  if (detectarMercadoLateral(closes)) {
    state.contadorLaterais++;
    return "LATERAL";
  }
  
  state.contadorLaterais = 0;
  
  const ultimoClose = closes[closes.length - 1];
  const penultimoClose = closes[closes.length - 2];
  
  if ((ultimoClose > ema200 && emaCurta < emaLonga) ||
      (ultimoClose < ema200 && emaCurta > emaLonga)) {
    return "NEUTRA";
  }
  
  const diffEMAs = emaCurta - emaLonga;
  const threshold = 0.0003;
  
  if (ultimoClose > emaCurta && diffEMAs > threshold && ultimoClose > penultimoClose) {
    return "FORTE_ALTA";
  }
  if (ultimoClose < emaCurta && diffEMAs < -threshold && ultimoClose < penultimoClose) {
    return "FORTE_BAIXA";
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
  if (!Array.isArray(closes) || closes.length < CONFIG.PERIODOS.ANALISE_LATERAL) return false;
  
  const ultimosPrecos = closes.slice(-CONFIG.PERIODOS.ANALISE_LATERAL);
  const maximo = Math.max(...ultimosPrecos);
  const minimo = Math.min(...ultimosPrecos);
  const variacao = ((maximo - minimo) / minimo) * 100;
  
  return variacao < CONFIG.LIMIARES.VARIACAO_LATERAL;
}

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

  // Confirmações
  const confirmacoes = [
    indicadores.rsi < 40 || indicadores.rsi > 60,
    Math.abs(indicadores.macd.histograma) > 0.05,
    indicadores.stoch.k < 30 || indicadores.stoch.k > 70,
    indicadores.williams < -70 || indicadores.williams > -30,
    indicadores.tendencia !== "LATERAL",
    vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO * 0.8
  ].filter(Boolean).length;

  score += confirmacoes * 4 * CONFIG.PESOS.CONFIRMACAO;

  if (state.ultimoSinal) {
    score += (state.ultimoSinal === "CALL" ? -10 : 10);
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia) {
  if (tendencia === "LATERAL") {
    return score > 80 ? "CALL" : "ESPERAR";
  }
  if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
    if (tendencia === "NEUTRA") return score > 75 ? "CALL" : "ESPERAR";
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  return "ESPERAR";
}

// =============================================
// CORE DO SISTEMA (INTEGRAÇÃO COM API TWELVE DATA)
// =============================================
async function obterDadosForex() {
  try {
    const response = await fetch(CONFIG.API_ENDPOINTS[0]);
    if (!response.ok) throw new Error("Erro na API");
    
    const data = await response.json();
    if (data.status === "error") throw new Error(data.message);
    
    // Formata os dados para candles
    const candles = data.values.map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume || 0)
    }));
    
    return candles;

  } catch (e) {
    console.error("Erro ao obter dados:", e);
    throw e;
  }
}

function conectarWebSocket() {
  if (state.websocket) state.websocket.close();
  
  state.websocket = new WebSocket(CONFIG.API_ENDPOINTS[1]);
  
  state.websocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.event === "price") {
      console.log("Preço em tempo real:", data.price);
      // Atualiza a análise com o último preço
      atualizarInterface("ATUALIZANDO...", state.ultimoScore);
    }
  };
  
  state.websocket.onerror = (error) => {
    console.error("Erro no WebSocket:", error);
  };
}

async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosForex();
    if (!dados || dados.length === 0) throw new Error("Dados vazios");
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);
    const volumesNorm = calcularMedia.volumeNormalizado(volumes);

    // Cálculo das EMAs
    const ema8 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA, state.lastEMAs.curta);
    const ema34 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA, state.lastEMAs.longa);
    const ema200 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200, state.lastEMAs._200);
    
    // Atualiza cache
    state.lastEMAs = { curta: ema8, longa: ema34, _200: ema200 };

    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      sma9: calcularMedia.simples(closes, 9),
      emaCurta: ema8,
      emaLonga: ema34,
      ema200,
      volume: volumesNorm[volumesNorm.length - 1] || 1,
      volumeMedia: 1,
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      vwap: calcularVWAP(dados),
      atr: calcularATR(dados),
      close: velaAtual.close,
      tendencia: avaliarTendencia(closes, ema8, ema34, ema200)
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
          indicadores.close>ema8?'🟢':'🔴'}</li>
        <li>📶 Médias: EMA${CONFIG.PERIODOS.EMA_CURTA} ${indicadores.emaCurta.toFixed(5)} | EMA${CONFIG.PERIODOS.EMA_LONGA} ${indicadores.emaLonga.toFixed(5)} | EMA200 ${indicadores.ema200.toFixed(5)}</li>
        <li>💹 Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)}</li>
        <li>📌 VWAP: ${indicadores.vwap.toFixed(5)} | ATR: ${indicadores.atr.toFixed(6)}</li>
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
// CONTROLE DE TEMPO
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
// INICIALIZAÇÃO
// =============================================
function iniciarAplicativo() {
  const ids=['comando','score','hora','timer','criterios','ultimos'];
  const falt = ids.filter(id=>!document.getElementById(id));
  if (falt.length>0) {
    console.error("Elementos faltando:", falt);
    return;
  }
  
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  conectarWebSocket(); // Inicia WebSocket para dados em tempo real
  analisarMercado();
}

if(document.readyState==="complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
