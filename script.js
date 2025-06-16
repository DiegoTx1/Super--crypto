// =============================================
// CONFIGURAÇÕES GLOBAIS PARA FOREX (EUR/USD)
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
  atr: 0,
  adx: 0
};

const CONFIG = {
  BROKER_API: "SUA_API_FOREX_AQUI", // Ex: 'https://api-fxtrade.oanda.com/v3'
  ACCOUNT_ID: "SUA_CONTA_AQUI",
  ACCESS_TOKEN: "SEU_TOKEN_AQUI",
  
  PERIODOS: {
    RSI: 14,
    STOCH: 14,
    WILLIAMS: 14,
    EMA_CURTA: 21,
    EMA_LONGA: 50,
    EMA_200: 200,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 30,
    ATR: 14,
    ADX: 14
  },
  
  LIMIARES: {
    SCORE_ALTO: 72,
    SCORE_MEDIO: 62,
    RSI_OVERBOUGHT: 65,
    RSI_OVERSOLD: 35,
    STOCH_OVERBOUGHT: 75,
    STOCH_OVERSOLD: 25,
    WILLIAMS_OVERBOUGHT: -15,
    WILLIAMS_OVERSOLD: -85,
    VOLUME_ALTO: 1.3,
    VARIACAO_LATERAL: 0.8,
    ATR_MINIMO: 0.0005, // Ajustado para Forex
    ADX_FORTE: 25
  },
  
  PESOS: {
    RSI: 1.8,
    MACD: 1.8,
    TENDENCIA: 1.6,
    VOLUME: 0.5,
    STOCH: 1.2,
    WILLIAMS: 1.0,
    CONFIRMACAO: 0.8,
    LATERALIDADE: 1.8,
    ATR: 0.7,
    ADX: 1.2
  }
};

// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================
function formatarTimer(segundos) {
  const mins = Math.floor(segundos / 60);
  const segs = segundos % 60;
  return `${mins}:${segs.toString().padStart(2, '0')}`;
}

function atualizarInterface(sinal, score) {
  console.log(`Sinal: ${sinal} | Confiança: ${score}% | Atualizado em: ${state.ultimaAtualizacao}`);
}

// =============================================
// INDICADORES TÉCNICOS
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
  let avgLoss = losses / periodo || 0.001;

  for (let i = periodo + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    
    avgGain = (avgGain * (periodo - 1) + gain) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
  }

  if (avgLoss <= 0) return 100;
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

function calcularATR(highs, lows, closes, periodo = CONFIG.PERIODOS.ATR) {
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i-1]),
      Math.abs(lows[i] - closes[i-1])
    );
    trs.push(tr);
  }
  return calcularMedia.exponencial(trs, periodo).pop() || 0;
}

function calcularADX(highs, lows, closes, periodo = CONFIG.PERIODOS.ADX) {
  if (closes.length < periodo * 2) return 0;
  
  const trs = [], plusDMs = [], minusDMs = [];
  
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i-1]),
      Math.abs(lows[i] - closes[i-1])
    );
    const plusDM = highs[i] - highs[i-1] > lows[i-1] - lows[i] 
      ? Math.max(highs[i] - highs[i-1], 0) : 0;
    const minusDM = lows[i-1] - lows[i] > highs[i] - highs[i-1] 
      ? Math.max(lows[i-1] - lows[i], 0) : 0;
    
    trs.push(tr);
    plusDMs.push(plusDM);
    minusDMs.push(minusDM);
  }

  const atr = calcularMedia.exponencial(trs, periodo);
  const plusDI = calcularMedia.exponencial(plusDMs, periodo).map((val, i) => 
    (val / atr[i]) * 100);
  const minusDI = calcularMedia.exponencial(minusDMs, periodo).map((val, i) => 
    (val / atr[i]) * 100);
  
  const dxs = plusDI.map((pdi, i) => {
    const mdi = minusDI[i];
    return (Math.abs(pdi - mdi) / (pdi + mdi)) * 100;
  });
  
  return calcularMedia.exponencial(dxs, periodo).pop() || 0;
}

function calcularSuporteResistencia(closes, periodo = 20) {
  const slice = closes.slice(-periodo);
  const max = Math.max(...slice);
  const min = Math.min(...slice);
  const pivot = (max + min + closes[closes.length-1]) / 3;
  return {
    resistencia: pivot + (max - min) * 0.382,
    suporte: pivot - (max - min) * 0.382
  };
}

// =============================================
// SISTEMA DE DECISÃO
// =============================================
function verificarHorarioNegociacao() {
  const horaUTC = new Date().getUTCHours();
  // Horário de maior liquidez no Forex (Londres/NY)
  return (horaUTC >= 7 && horaUTC < 17); // 8AM-5PM GMT
}

function avaliarTendencia(closes, ema21, ema50, ema200) {
  if (closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  if (detectarMercadoLateral(closes)) {
    state.contadorLaterais++;
    return "LATERAL";
  }
  
  state.contadorLaterais = 0;
  
  if (ema21 > ema50 && ema50 > ema200) return "FORTE_ALTA";
  if (ema21 < ema50 && ema50 < ema200) return "FORTE_BAIXA";
  if (closes[closes.length-1] > ema21 && ema21 > ema50) return "ALTA";
  if (closes[closes.length-1] < ema21 && ema21 < ema50) return "BAIXA";
  
  return "NEUTRA";
}

function detectarMercadoLateral(closes) {
  if (closes.length < CONFIG.PERIODOS.ANALISE_LATERAL) return false;
  const ultimosPrecos = closes.slice(-CONFIG.PERIODOS.ANALISE_LATERAL);
  const variacao = (Math.max(...ultimosPrecos) - Math.min(...ultimosPrecos)) / Math.min(...ultimosPrecos) * 100;
  return variacao < CONFIG.LIMIARES.VARIACAO_LATERAL;
}

function calcularScore(indicadores) {
  let score = 50;
  const closes = indicadores.closes;

  // RSI + Williams (confirmação)
  if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD && indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) {
    score += 20 * CONFIG.PESOS.RSI;
  } else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) {
    score -= 20 * CONFIG.PESOS.RSI;
  }

  // MACD com confirmação de vela
  if (indicadores.macd.histograma > 0 && indicadores.close > closes[closes.length-2]) {
    score += 15 * CONFIG.PESOS.MACD;
  } else if (indicadores.macd.histograma < 0 && indicadores.close < closes[closes.length-2]) {
    score -= 15 * CONFIG.PESOS.MACD;
  }

  // Tendência + ADX
  if (indicadores.adx > CONFIG.LIMIARES.ADX_FORTE) {
    switch(indicadores.tendencia) {
      case "FORTE_ALTA": score += 20 * CONFIG.PESOS.TENDENCIA; break;
      case "FORTE_BAIXA": score -= 20 * CONFIG.PESOS.TENDENCIA; break;
    }
  }

  // ATR (volatilidade)
  if (indicadores.atr > CONFIG.LIMIARES.ATR_MINIMO) {
    score += 10 * CONFIG.PESOS.ATR;
  }

  // Volume (menos importante no Forex)
  if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
    score += (indicadores.tendencia.includes("ALTA") ? 5 : -5) * CONFIG.PESOS.VOLUME;
  }

  // Estocástico
  if (indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && 
      indicadores.stoch.d < CONFIG.LIMIARES.STOCH_OVERSOLD) {
    score += 12 * CONFIG.PESOS.STOCH;
  }
  if (indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && 
      indicadores.stoch.d > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
    score -= 12 * CONFIG.PESOS.STOCH;
  }

  // Confirmações
  const confirmacoes = [
    indicadores.rsi < 40 || indicadores.rsi > 60,
    Math.abs(indicadores.macd.histograma) > 0.1,
    indicadores.stoch.k < 30 || indicadores.stoch.k > 70,
    indicadores.williams < -70 || indicadores.williams > -30
  ].filter(Boolean).length;

  score += confirmacoes * 4 * CONFIG.PESOS.CONFIRMACAO;

  // Evitar repetição
  if (state.ultimoSinal) {
    score += (state.ultimoSinal === "CALL" ? -5 : 5);
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia, atr, adx) {
  if (!verificarHorarioNegociacao()) return "FORA DO HORÁRIO";
  if (atr < CONFIG.LIMIARES.ATR_MINIMO) return "VOLATILIDADE BAIXA";
  if (adx < CONFIG.LIMIARES.ADX_FORTE && tendencia !== "LATERAL") return "TENDÊNCIA FRACA";

  if (tendencia === "LATERAL") {
    return score > 80 ? "CALL" : score < 20 ? "PUT" : "ESPERAR";
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// CORE DO SISTEMA (FOREX)
// =============================================
async function obterDadosForex() {
  try {
    // Substitua por chamada real à API do seu broker
    const response = await fetch(`${CONFIG.BROKER_API}/instruments/EUR_USD/candles?price=M&granularity=M1&count=150`, {
      headers: {
        'Authorization': `Bearer ${CONFIG.ACCESS_TOKEN}`,
        'Accept-Datetime-Format': 'RFC3339'
      }
    });
    
    if (!response.ok) throw new Error("Erro na API");
    const dados = await response.json();
    
    if (!dados.candles || dados.candles.length < 50) {
      throw new Error("Dados insuficientes");
    }
    
    // Processar candles no formato do broker
    const processed = dados.candles.map(c => ({
      time: c.time,
      open: parseFloat(c.mid.o),
      high: parseFloat(c.mid.h),
      low: parseFloat(c.mid.l),
      close: parseFloat(c.mid.c),
      volume: parseFloat(c.volume)
    }));
    
    return processed;
  } catch (e) {
    console.error("Erro ao obter dados Forex:", e);
    throw e;
  }
}

async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;

  try {
    const dados = await obterDadosForex();
    
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    const ema21 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).pop();
    const ema50 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA).pop();
    const ema200 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200).pop();
    const atr = calcularATR(highs, lows, closes);
    const adx = calcularADX(highs, lows, closes);
    const sr = calcularSuporteResistencia(closes);

    const indicadores = {
      closes,
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      ema21, ema50, ema200,
      volume: dados[dados.length-1].volume,
      volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME),
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      close: dados[dados.length-1].close,
      tendencia: avaliarTendencia(closes, ema21, ema50, ema200),
      atr, adx,
      suporte: sr.suporte,
      resistencia: sr.resistencia
    };

    const score = calcularScore(indicadores);
    const sinal = determinarSinal(score, indicadores.tendencia, atr, adx);
    
    state.ultimoSinal = ["CALL", "PUT"].includes(sinal) ? sinal : state.ultimoSinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    state.atr = atr;
    state.adx = adx;

    atualizarInterface(sinal, score);

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 10) state.ultimos.pop();
    
    state.tentativasErro = 0;
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0);
    
    if (++state.tentativasErro > 3) {
      console.error("Muitos erros consecutivos, reiniciando...");
      setTimeout(() => process.exit(1), 10000);
    }
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
  state.timer = Math.max(1, Math.floor(delayProximaVela / 1000));

  state.intervaloAtual = setInterval(() => {
    state.timer--;
    
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado().finally(sincronizarTimer);
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function iniciarAplicativo() {
  console.log("Iniciando análise técnica para EUR/USD...");
  sincronizarTimer();
  analisarMercado();
}

// Iniciar o aplicativo
iniciarAplicativo();
