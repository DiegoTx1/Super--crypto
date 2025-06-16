// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS PARA EUR/USD)
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
  API_ENDPOINTS: [
    "https://api.binance.com/api/v3",
    "https://api1.binance.com/api/v3", 
    "https://api2.binance.com/api/v3",
    "https://api3.binance.com/api/v3"
  ],
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
    ATR_MINIMO: 0.0005,
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
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    elementoHora.textContent = new Date().toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

function atualizarInterface(sinal, score) {
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) scoreElement.textContent = `Confiança: ${score}%`;
  
  const horaElement = document.getElementById("hora");
  if (horaElement) horaElement.textContent = state.ultimaAtualizacao;
}

// =============================================
// INDICADORES TÉCNICOS (CORRIGIDOS)
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
  return calcularMedia.simples(trs.slice(-periodo), periodo) || 0;
}

function calcularADX(highs, lows, closes, periodo = CONFIG.PERIODOS.ADX) {
  if (closes.length < periodo * 2) return 0;
  
  let sumPositiveDM = 0;
  let sumNegativeDM = 0;
  let sumTR = 0;
  
  for (let i = 1; i <= periodo; i++) {
    const highDiff = highs[i] - highs[i-1];
    const lowDiff = lows[i-1] - lows[i];
    
    sumPositiveDM += highDiff > lowDiff ? Math.max(highDiff, 0) : 0;
    sumNegativeDM += lowDiff > highDiff ? Math.max(lowDiff, 0) : 0;
    sumTR += Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i-1]),
      Math.abs(lows[i] - closes[i-1])
    );
  }
  
  const plusDI = (sumPositiveDM / sumTR) * 100;
  const minusDI = (sumNegativeDM / sumTR) * 100;
  const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
  
  return dx || 0;
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
// SISTEMA DE DECISÃO (ATUALIZADO)
// =============================================
function verificarHorarioNegociacao() {
  const horaUTC = new Date().getUTCHours();
  return (horaUTC >= 8 && horaUTC < 17) || (horaUTC >= 13 && horaUTC < 22);
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

  // Volume
  if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
    score += (indicadores.tendencia.includes("ALTA") ? 8 : -8) * CONFIG.PESOS.VOLUME;
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
// CORE DO SISTEMA (ATUALIZADO)
// =============================================
async function obterDadosBinance() {
  for (const endpoint of CONFIG.API_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}/klines?symbol=EURUSDT&interval=1m&limit=150`);
      if (!response.ok) continue;
      const dados = await response.json();
      if (Array.isArray(dados) && dados.length > 50) {
        return dados.filter(v => Array.isArray(v) && v.length >= 6);
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
    const dados = await obterDadosBinance();
    const velaAtual = dados[dados.length - 1];
    
    const closes = dados.map(v => parseFloat(v[4]));
    const highs = dados.map(v => parseFloat(v[2]));
    const lows = dados.map(v => parseFloat(v[3]));
    const volumes = dados.map(v => parseFloat(v[5]));

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
      volume: parseFloat(velaAtual[5]),
      volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME),
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      close: parseFloat(velaAtual[4]),
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

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>Tendência: <strong>${indicadores.tendencia.replace('_', ' ')}</strong> ${
          indicadores.tendencia.includes("ALTA") ? '📈' : 
          indicadores.tendencia.includes("BAIXA") ? '📉' : '➖'
        } <small>(ADX: ${indicadores.adx.toFixed(2)} ${
          indicadores.adx > CONFIG.LIMIARES.ADX_FORTE ? '✅' : '⚠️'
        })</small></li>
        
        <li>RSI: <strong>${indicadores.rsi.toFixed(2)}</strong> ${
          indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : 
          indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''
        } | Williams: <strong>${indicadores.williams.toFixed(2)}</strong> ${
          indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD ? '🔻' : 
          indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT ? '🔺' : ''
        }</li>
        
        <li>MACD: <strong>${indicadores.macd.histograma.toFixed(5)}</strong> ${
          indicadores.macd.histograma > 0 ? '🟢' : '🔴'
        }</li>
        
        <li>Stochastic: K <strong>${indicadores.stoch.k.toFixed(2)}</strong> ${
          indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD ? '🔻' : 
          indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT ? '🔺' : ''
        } / D <strong>${indicadores.stoch.d.toFixed(2)}</strong></li>
        
        <li>Preço: <strong>$${indicadores.close.toFixed(5)}</strong> (ATR: ${indicadores.atr.toFixed(5)}) ${
          indicadores.atr > CONFIG.LIMIARES.ATR_MINIMO ? '🌊' : '💤'
        }</li>
        
        <li>Suporte: <strong>${indicadores.suporte.toFixed(5)}</strong> 🛑 | Resistência: <strong>${indicadores.resistencia.toFixed(5)}</strong> 🎯</li>
        
        <li>Médias: EMA21 <strong>${indicadores.ema21.toFixed(5)}</strong> ${
          indicadores.close > indicadores.ema21 ? '🟢' : '🔴'
        } | EMA50 <strong>${indicadores.ema50.toFixed(5)}</strong> ${
          indicadores.close > indicadores.ema50 ? '🟢' : '🔴'
        } | EMA200 <strong>${indicadores.ema200.toFixed(5)}</strong></li>
        
        <li>Volume: <strong>${indicadores.volume.toFixed(2)}</strong> vs Média ${indicadores.volumeMedia.toFixed(2)} ${
          indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO ? '🔊' : '🔉'
        }</li>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 10) state.ultimos.pop();
    
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) {
      ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
    }

    state.tentativasErro = 0;
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0);
    
    if (++state.tentativasErro > 3) {
      console.error("Muitos erros consecutivos, reiniciando...");
      setTimeout(() => location.reload(), 10000);
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
      analisarMercado().finally(sincronizarTimer);
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function iniciarAplicativo() {
  const elementosNecessarios = ['comando', 'score', 'hora', 'timer', 'criterios', 'ultimos'];
  const elementosFaltantes = elementosNecessarios.filter(id => !document.getElementById(id));
  
  if (elementosFaltantes.length > 0) {
    console.error("Elementos da interface não encontrados:", elementosFaltantes);
    return;
  }

  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  analisarMercado();

  setInterval(async () => {
    try {
      const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=EURUSDT");
      if (!response.ok) return;
      const dados = await response.json();
      const precoElement = document.querySelector("#criterios li:nth-child(5)");
      if (precoElement && dados.lastPrice) {
        precoElement.innerHTML = `Preço: <strong>$${parseFloat(dados.lastPrice).toFixed(5)}</strong> (ATR: ${state.atr.toFixed(5)}) ${
          state.atr > CONFIG.LIMIARES.ATR_MINIMO ? '🌊' : '💤'
        }`;
      }
    } catch (e) {
      console.error("Erro ao atualizar preço:", e);
    }
  }, 5000);
}

if (document.readyState === 'complete') {
  iniciarAplicativo();
} else {
  document.addEventListener('DOMContentLoaded', iniciarAplicativo);
}
