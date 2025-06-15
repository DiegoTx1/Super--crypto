// =============================================
// CONFIGURAÇÕES GLOBAIS (ENCAPSULADAS)
// =============================================
const state = {
  win: 0,
  loss: 0,
  ultimos: [],
  timer: 60,
  ultimaAtualizacao: "",
  leituraEmAndamento: false,
  intervaloAtual: null,
  tentativasErro: 0,
  dadosHistoricos: []
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
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9
  },
  PESOS: {
    RSI: 1.2,
    MACD: 1.5,
    EMA: 0.8,
    VOLUME: 1.0,
    STOCH: 1.0,
    WILLIAMS: 0.8
  }
};

// =============================================
// FUNÇÕES UTILITÁRIAS (OTIMIZADAS)
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

// =============================================
// INDICADORES TÉCNICOS (COM CACHE)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) return null;
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  },

  exponencial: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return [];
    
    const k = 2 / (periodo + 1);
    const emaArray = [calcularMedia.simples(dados.slice(0, periodo), periodo)];
    
    for (let i = periodo; i < dados.length; i++) {
      emaArray.push(dados[i] * k + emaArray[i - periodo] * (1 - k));
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

  const avgGain = gains / periodo;
  const avgLoss = losses / periodo || 0.001;
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
      kValues.push(((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100);
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
    
    return ((highestHigh - closes[closes.length-1]) / (highestHigh - lowestLow)) * -100;
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
    
    const macdLinha = emaRapida.map((val, idx) => val - emaLenta[idx]).slice(lenta - rapida);
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

// =============================================
// SISTEMA DE DECISÃO (APRIMORADO)
// =============================================
function avaliarTendencia(closes, emaCurta, emaLonga) {
  if (closes.length < 3) return "NEUTRA";
  
  const ultimoClose = closes[closes.length - 1];
  const penultimoClose = closes[closes.length - 2];
  
  if (ultimoClose > emaCurta && emaCurta > emaLonga && ultimoClose > penultimoClose) {
    return "FORTE_ALTA";
  }
  if (ultimoClose < emaCurta && emaCurta < emaLonga && ultimoClose < penultimoClose) {
    return "FORTE_BAIXA";
  }
  if (ultimoClose > emaCurta && emaCurta > emaLonga) {
    return "ALTA";
  }
  if (ultimoClose < emaCurta && emaCurta < emaLonga) {
    return "BAIXA";
  }
  return "NEUTRA";
}

function calcularScore(indicadores) {
  let score = 50;

  // RSI
  if (indicadores.rsi < 30) score += CONFIG.PESOS.RSI * 1.5;
  else if (indicadores.rsi > 70) score -= CONFIG.PESOS.RSI * 1.5;
  else if (indicadores.rsi < 40) score += CONFIG.PESOS.RSI;
  else if (indicadores.rsi > 60) score -= CONFIG.PESOS.RSI;

  // MACD
  if (indicadores.macd.histograma > 0.2) score += CONFIG.PESOS.MACD;
  else if (indicadores.macd.histograma < -0.2) score -= CONFIG.PESOS.MACD;
  else if (indicadores.macd.histograma > 0.1) score += CONFIG.PESOS.MACD * 0.5;
  else if (indicadores.macd.histograma < -0.1) score -= CONFIG.PESOS.MACD * 0.5;

  // Tendência
  if (indicadores.tendencia.includes("FORTE")) {
    score += indicadores.tendencia.includes("ALTA") ? 10 : -10;
  }

  // Volume
  if (indicadores.volume > indicadores.volumeMedia * 1.5) {
    score += (indicadores.tendencia.includes("ALTA") ? 1 : -1) * CONFIG.PESOS.VOLUME;
  }

  // Estocástico
  if (indicadores.stoch.k < 20 && indicadores.stoch.d < 20) score += CONFIG.PESOS.STOCH;
  if (indicadores.stoch.k > 80 && indicadores.stoch.d > 80) score -= CONFIG.PESOS.STOCH;

  // Williams
  if (indicadores.williams < -80) score += CONFIG.PESOS.WILLIAMS;
  if (indicadores.williams > -20) score -= CONFIG.PESOS.WILLIAMS;

  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia) {
  if (score >= 60) {
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  if (score >= 55) {
    if (tendencia === "NEUTRA") return "CALL"; // Tendência neutra favorece CALL
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  return "ESPERAR";
}

// =============================================
// CORE DO SISTEMA (OTIMIZADO)
// =============================================
async function obterDadosBinance() {
  for (const endpoint of CONFIG.API_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}/klines?symbol=BTCUSDT&interval=1m&limit=150`);
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
    state.dadosHistoricos = dados;

    const velaAtual = dados[dados.length - 1];
    const close = parseFloat(velaAtual[4]);
    const high = parseFloat(velaAtual[2]);
    const low = parseFloat(velaAtual[3]);
    const volume = parseFloat(velaAtual[5]);

    const closes = dados.map(v => parseFloat(v[4]));
    const highs = dados.map(v => parseFloat(v[2]));
    const lows = dados.map(v => parseFloat(v[3]));
    const volumes = dados.map(v => parseFloat(v[5]));

    // Calcula indicadores
    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      sma9: calcularMedia.simples(closes, 9),
      ema21: calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).slice(-1)[0],
      ema50: calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA).slice(-1)[0],
      volume,
      volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME),
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      close,
      tendencia: avaliarTendencia(closes, 
        calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).slice(-1)[0],
        calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA).slice(-1)[0])
    };

    const score = calcularScore(indicadores);
    const sinal = determinarSinal(score, indicadores.tendencia);

    // Atualiza interface
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    document.getElementById("comando").textContent = sinal;
    document.getElementById("score").textContent = `Confiança: ${score}%`;
    document.getElementById("hora").textContent = state.ultimaAtualizacao;

    document.getElementById("criterios").innerHTML = `
      <li>Tendência: ${indicadores.tendencia.replace('_', ' ')}</li>
      <li>RSI: ${indicadores.rsi.toFixed(2)} ${indicadores.rsi < 40 ? '🔻' : indicadores.rsi > 60 ? '🔺' : ''}</li>
      <li>MACD: ${indicadores.macd.histograma.toFixed(4)} ${indicadores.macd.histograma > 0 ? '🟢' : '🔴'}</li>
      <li>Stochastic: K ${indicadores.stoch.k.toFixed(2)} / D ${indicadores.stoch.d.toFixed(2)}</li>
      <li>Williams: ${indicadores.williams.toFixed(2)}</li>
      <li>Preço: $${indicadores.close.toFixed(2)}</li>
      <li>Médias: SMA9 ${indicadores.sma9?.toFixed(2) || 'N/A'} | EMA21 ${indicadores.ema21.toFixed(2)} | EMA50 ${indicadores.ema50.toFixed(2)}</li>
      <li>Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)}</li>
    `;

    // Histórico
    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 5) state.ultimos.pop();
    document.getElementById("ultimos").innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");

    state.tentativasErro = 0;
  } catch (e) {
    console.error("Erro na análise:", e);
    document.getElementById("comando").textContent = "ERRO";
    document.getElementById("score").textContent = "Confiança: 0%";
    
    if (++state.tentativasErro > 3) {
      console.error("Muitos erros consecutivos, reiniciando...");
      setTimeout(() => location.reload(), 10000);
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO (MELHORADO)
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
// INICIALIZAÇÃO (MANTIDA)
// =============================================
function iniciarAplicativo() {
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  analisarMercado();

  // Atualização de preço em tempo real
  setInterval(async () => {
    try {
      const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
      if (!response.ok) return;
      const dados = await response.json();
      const precoElement = document.querySelector("#criterios li:nth-child(6)");
      if (precoElement && dados.lastPrice) {
        precoElement.textContent = `Preço: $${parseFloat(dados.lastPrice).toFixed(2)}`;
      }
    } catch (e) {
      console.error("Erro ao atualizar preço:", e);
    }
  }, 5000);
}

document.addEventListener('DOMContentLoaded', iniciarAplicativo);
