// =============================================
// CONFIGURAÇÕES GLOBAIS (AJUSTADAS PARA CRIPTO)
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
  marketOpen: true
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
    ICHIMOKU_SENKOU: 52
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
    MIN_INCLINACAO_EMA: 0.5
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
    ICHIMOKU: 2.0
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
// INDICADORES TÉCNICOS (MANTIDOS)
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
                    lenta = CONFIG.PERIODOS.MACD_LONGA, 
                    sinal = CONFIG.PERIODOS.MACD_SINAL) {
  try {
    if (!Array.isArray(closes) || closes.length < lenta + sinal) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }

    const emaRapida = calcularMedia.exponencial(closes, rapida);
    const emaLenta = calcularMedia.exponencial(closes, lenta);
    
    if (emaRapida.length < lenta || emaLenta.length < lenta) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }
    
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

function calcularSupertrend(highs, lows, closes, periodo = CONFIG.PERIODOS.SUPERTREND, multiplier = CONFIG.PERIODOS.SUPERTREND_MULTIPLIER) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo) return { direcao: null, valor: null };
    
    const atrValues = [];
    const supertrendValues = [];
    let direcaoAtual = null;
    
    for (let i = periodo; i < closes.length; i++) {
      const sliceHigh = highs.slice(i-periodo, i);
      const sliceLow = lows.slice(i-periodo, i);
      const atr = calcularATR({ high: sliceHigh, low: sliceLow, close: closes.slice(i-periodo, i)}, periodo);
      atrValues.push(atr);
      
      const basicUpper = (Math.max(...sliceHigh) + Math.min(...sliceLow)) / 2 + multiplier * atr;
      const basicLower = (Math.max(...sliceHigh) + Math.min(...sliceLow)) / 2 - multiplier * atr;
      
      let upperBand = basicUpper;
      let lowerBand = basicLower;
      
      if (i > periodo) {
        if (closes[i-1] > supertrendValues[i-periodo-1].valor) {
          lowerBand = Math.max(lowerBand, supertrendValues[i-periodo-1].valor);
        } else {
          upperBand = Math.min(upperBand, supertrendValues[i-periodo-1].valor);
        }
      }
      
      let direcao;
      let valor;
      
      if (i === periodo) {
        direcao = closes[i] <= basicUpper ? 'up' : 'down';
        valor = direcao === 'up' ? basicUpper : basicLower;
      } else {
        if (supertrendValues[i-periodo-1].direcao === 'up' && closes[i] > upperBand) {
          direcao = 'up';
          valor = upperBand;
        } else if (supertrendValues[i-periodo-1].direcao === 'up' && closes[i] <= upperBand) {
          direcao = 'down';
          valor = lowerBand;
        } else if (supertrendValues[i-periodo-1].direcao === 'down' && closes[i] < lowerBand) {
          direcao = 'down';
          valor = lowerBand;
        } else if (supertrendValues[i-periodo-1].direcao === 'down' && closes[i] >= lowerBand) {
          direcao = 'up';
          valor = upperBand;
        }
      }
      
      supertrendValues.push({ direcao, valor });
      direcaoAtual = direcao;
    }
    
    return {
      direcao: direcaoAtual,
      valor: supertrendValues[supertrendValues.length-1]?.valor || null
    };
  } catch (e) {
    console.error("Erro no cálculo Supertrend:", e);
    return { direcao: null, valor: null };
  }
}

function calcularIchimoku(highs, lows, closes, tenkan = CONFIG.PERIODOS.ICHIMOKU_TENKAN, 
                         kijun = CONFIG.PERIODOS.ICHIMOKU_KIJUN, senkou = CONFIG.PERIODOS.ICHIMOKU_SENKOU) {
  try {
    if (!Array.isArray(closes) || closes.length < senkou + kijun) return null;
    
    const highestHighTenkan = Math.max(...highs.slice(-tenkan));
    const lowestLowTenkan = Math.min(...lows.slice(-tenkan));
    const tenkanSen = (highestHighTenkan + lowestLowTenkan) / 2;
    
    const highestHighKijun = Math.max(...highs.slice(-kijun));
    const lowestLowKijun = Math.min(...lows.slice(-kijun));
    const kijunSen = (highestHighKijun + lowestLowKijun) / 2;
    
    const senkouA = (tenkanSen + kijunSen) / 2;
    
    const highestHighSenkou = Math.max(...highs.slice(-senkou));
    const lowestLowSenkou = Math.min(...lows.slice(-senkou));
    const senkouB = (highestHighSenkou + lowestLowSenkou) / 2;
    
    const chikouSpan = closes[closes.length - 26] || null;
    
    return {
      tenkanSen,
      kijunSen,
      senkouA,
      senkouB,
      chikouSpan,
      nuvemAlta: Math.max(senkouA, senkouB),
      nuvemBaixa: Math.min(senkouA, senkouB),
      acimaDaNuvem: closes[closes.length-1] > Math.max(senkouA, senkouB),
      abaixoDaNuvem: closes[closes.length-1] < Math.min(senkouA, senkouB),
      tendencia: tenkanSen > kijunSen ? 'alta' : 'baixa'
    };
  } catch (e) {
    console.error("Erro no cálculo Ichimoku:", e);
    return null;
  }
}

// =============================================
// SISTEMA DE DECISÃO (ATUALIZADO)
// =============================================
function detectarMercadoLateral(closes) {
  if (!Array.isArray(closes) || closes.length < CONFIG.PERIODOS.ANALISE_LATERAL) return false;
  
  const ultimosPrecos = closes.slice(-CONFIG.PERIODOS.ANALISE_LATERAL);
  const maximo = Math.max(...ultimosPrecos);
  const minimo = Math.min(...ultimosPrecos);
  const variacao = ((maximo - minimo) / minimo) * 100;
  
  const emaCurta = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).pop();
  const emaLonga = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA).pop();
  const inclinacao = Math.abs((emaCurta - emaLonga) / emaLonga * 100);
  
  return variacao < CONFIG.LIMIARES.VARIACAO_LATERAL && inclinacao < CONFIG.LIMIARES.MIN_INCLINACAO_EMA;
}

function avaliarTendencia(closes, emaCurta, emaLonga, ema200, supertrend, ichimoku) {
  if (!Array.isArray(closes) || closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  // 1. Verificar primeiro os indicadores de tendência forte
  if (supertrend.direcao === 'down') {
    if (ichimoku && ichimoku.abaixoDaNuvem) {
      return "FORTE_BAIXA";
    }
    return "BAIXA";
  }
  
  if (supertrend.direcao === 'up') {
    if (ichimoku && ichimoku.acimaDaNuvem) {
      return "FORTE_ALTA";
    }
    return "ALTA";
  }

  // 2. Só então verificar lateralidade
  if (detectarMercadoLateral(closes)) {
    // Verificar se não há sinais contrários fortes
    const rsi = calcularRSI(closes);
    const williams = calcularWilliams(closes.map(c => c.high), closes.map(c => c.low), closes);
    
    // Se houver sinais fortes de sobrevenda, não considerar lateral
    if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD || williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) {
      return "BAIXA";
    }
    
    state.contadorLaterais++;
    return "LATERAL";
  }
  
  state.contadorLaterais = 0;
  
  // 3. Tendência por EMAs e preço
  const ultimoClose = closes[closes.length - 1];
  const penultimoClose = closes[closes.length - 2];
  const diffEMAs = emaCurta - emaLonga;
  const threshold = 0.005;
  
  if (ultimoClose > emaCurta && diffEMAs > threshold && ultimoClose > penultimoClose) {
    return "ALTA";
  }
  if (ultimoClose < emaCurta && diffEMAs < -threshold && ultimoClose < penultimoClose) {
    return "BAIXA";
  }
  
  return "NEUTRA";
}

function calcularScore(indicadores) {
  let score = 50;

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

  score += (Math.min(Math.max(indicadores.macd.histograma * 100, -15), 15)) * CONFIG.PESOS.MACD;

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

  if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
    score += (indicadores.tendencia.includes("ALTA") ? 12 : -12) * CONFIG.PESOS.VOLUME;
  }

  if (indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && 
      indicadores.stoch.d < CONFIG.LIMIARES.STOCH_OVERSOLD) {
    score += 15 * CONFIG.PESOS.STOCH;
  }
  if (indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && 
      indicadores.stoch.d > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
    score -= 15 * CONFIG.PESOS.STOCH;
  }

  if (indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) {
    score += 12 * CONFIG.PESOS.WILLIAMS;
  }
  if (indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) {
    score -= 12 * CONFIG.PESOS.WILLIAMS;
  }

  const vwapDesvio = Math.abs(indicadores.close - indicadores.vwap) / Math.max(indicadores.vwap, 0.000001);
  if (vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO) {
    score += (indicadores.close > indicadores.vwap ? 12 : -12) * CONFIG.PESOS.VWAP;
  }

  if (indicadores.atr > CONFIG.LIMIARES.ATR_LIMIAR) {
    score += 10 * CONFIG.PESOS.VOLATILIDADE;
  }

  if (indicadores.supertrend.direcao === 'up') {
    score += 18 * CONFIG.PESOS.SUPERTREND;
  } else if (indicadores.supertrend.direcao === 'down') {
    score -= 18 * CONFIG.PESOS.SUPERTREND;
  }

  if (indicadores.ichimoku) {
    if (indicadores.ichimoku.acimaDaNuvem && indicadores.ichimoku.tendencia === 'alta') {
      score += 15 * CONFIG.PESOS.ICHIMOKU;
    } else if (indicadores.ichimoku.abaixoDaNuvem && indicadores.ichimoku.tendencia === 'baixa') {
      score -= 15 * CONFIG.PESOS.ICHIMOKU;
    }
  }

  const confirmacoes = [
    indicadores.rsi < 35 || indicadores.rsi > 65,
    Math.abs(indicadores.macd.histograma) > 0.1,
    indicadores.stoch.k < 20 || indicadores.stoch.k > 80,
    indicadores.williams < -80 || indicadores.williams > -20,
    indicadores.tendencia !== "LATERAL",
    vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO * 0.8,
    indicadores.supertrend.direcao !== null,
    indicadores.ichimoku && (indicadores.ichimoku.acimaDaNuvem || indicadores.ichimoku.abaixoDaNuvem)
  ].filter(Boolean).length;

  score += confirmacoes * 5 * CONFIG.PESOS.CONFIRMACAO;

  if (state.ultimoSinal) {
    score += (state.ultimoSinal === "CALL" ? -10 : 10);
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia) {
  if (tendencia === "LATERAL") {
    return score > 85 ? "CALL" : "ESPERAR";
  }
  if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
    if (tendencia === "NEUTRA") return score > 80 ? "CALL" : "ESPERAR";
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  return "ESPERAR";
}

// =============================================
// CORE DO SISTEMA (MANTIDO)
// =============================================
async function obterDadosCripto() {
  for (const endpoint of CONFIG.API_ENDPOINTS) {
    try {
      let response, dados;
      if (endpoint.includes('twelvedata')) {
        const apiKey = rotacionarApiKey();
        response = await fetch(`${endpoint}/time_series?symbol=${CONFIG.PARES.BTCUSDT}&interval=1min&outputsize=200&apikey=${apiKey}`);
        if (!response.ok) continue;
        dados = await response.json();
        if (dados.values && Array.isArray(dados.values)) {
          return dados.values.map(v => ({
            time: v.datetime,
            open: parseFloat(v.open) || 0,
            high: parseFloat(v.high) || 0,
            low: parseFloat(v.low) || 0,
            close: parseFloat(v.close) || 0,
            volume: parseFloat(v.volume) || 0
          })).reverse();
        }
      } else if (endpoint.includes('binance')) {
        response = await fetch(`${endpoint}/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=200`);
        if (!response.ok) continue;
        dados = await response.json();
        if (Array.isArray(dados)) {
          return dados.map(v => ({
            time: new Date(v[0]).toISOString(),
            open: parseFloat(v[1]) || 0,
            high: parseFloat(v[2]) || 0,
            low: parseFloat(v[3]) || 0,
            close: parseFloat(v[4]) || 0,
            volume: parseFloat(v[5]) || 0
          }));
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
    const dados = await obterDadosCripto();
    if (!dados || dados.length === 0) throw new Error("Dados vazios");
    
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

    const supertrend = calcularSupertrend(highs, lows, closes);
    const ichimoku = calcularIchimoku(highs, lows, closes);

    const indicadores = {
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
      tendencia: avaliarTendencia(closes, emaCurta, emaLonga, ema200, supertrend, ichimoku)
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
// INICIALIZAÇÃO (MANTIDA)
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
  analisarMercado();
  
  // Iniciar WebSocket para atualizações em tempo real
  iniciarWebSocket();
}

function iniciarWebSocket() {
  if (state.websocket) state.websocket.close();
  
  state.websocket = new WebSocket(CONFIG.WS_ENDPOINT);
  
  state.websocket.onopen = () => {
    console.log("Conexão WebSocket estabelecida");
    // Subscrever ao par BTCUSDT
    state.websocket.send(JSON.stringify({
      method: "SUBSCRIBE",
      params: ["btcusdt@kline_1m"],
      id: 1
    }));
  };
  
  state.websocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.k && data.k.x) { // Se for uma vela completa
      analisarMercado();
    }
  };
  
  state.websocket.onerror = (error) => {
    console.error("Erro WebSocket:", error);
  };
  
  state.websocket.onclose = () => {
    console.log("Conexão WebSocket fechada. Reconectando...");
    setTimeout(iniciarWebSocket, 5000);
  };
}

if(document.readyState==="complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
