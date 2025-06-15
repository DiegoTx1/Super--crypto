// =============================================
// CONFIGURAÇÕES GLOBAIS (COM AJUSTES PARA CRYPTO IDX)
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
  fatorCorrecao: 1.002, // Fator de ajuste para o Crypto IDX (ajuste conforme necessário)
  spreadAtual: 0
};

const CONFIG = {
  API_ENDPOINTS: [
    "https://api.binance.com/api/v3",
    "https://api1.binance.com/api/v3", 
    "https://api2.binance.com/api/v3",
    "https://api3.binance.com/api/v3"
  ],
  PERIODOS: {
    RSI: 12, // Período reduzido para crypto
    STOCH: 11,
    WILLIAMS: 14,
    EMA_CURTA: 18, // Médias mais curtas para acompanhar a volatilidade
    EMA_LONGA: 36,
    SMA_VOLUME: 15,
    MACD_RAPIDA: 10,
    MACD_LENTA: 22,
    MACD_SINAL: 7,
    VELAS_CONFIRMACAO: 2 // Confirmação mais rápida
  },
  LIMIARES: {
    SCORE_ALTO: 70, // Limiares aumentados para maior confiabilidade
    SCORE_MEDIO: 60,
    RSI_OVERBOUGHT: 68, // Bandas mais estreitas
    RSI_OVERSOLD: 32,
    STOCH_OVERBOUGHT: 78,
    STOCH_OVERSOLD: 22,
    WILLIAMS_OVERBOUGHT: -18,
    WILLIAMS_OVERSOLD: -78,
    VOLUME_ALTO: 1.8,
    SPREAD_MAXIMO: 0.002 // 0.2% de spread máximo
  },
  PESOS: {
    RSI: 1.7,
    MACD: 2.3, // Peso maior no MACD para crypto
    EMA: 0.9,
    VOLUME: 1.2,
    STOCH: 1.1,
    WILLIAMS: 1.0,
    SPREAD: 1.8 // Peso alto no spread
  }
};

// =============================================
// FUNÇÕES BÁSICAS (MANTIDAS DA SUA INTERFACE)
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
// INDICADORES TÉCNICOS (AJUSTADOS PARA CRYPTO)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados)) return null;
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

// =============================================
// SISTEMA DE DECISÃO (AJUSTADO PARA CRYPTO IDX)
// =============================================
function avaliarTendencia(closes, emaCurta, emaLonga) {
  if (closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  // Verificação de lateralidade
  const variacao = (Math.max(...closes.slice(-10)) - Math.min(...closes.slice(-10))) / closes[closes.length-1];
  if (variacao < 0.008) return "LATERAL";
  
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

  // Ajuste para spread alto
  if (indicadores.spread > CONFIG.LIMIARES.SPREAD_MAXIMO) {
    score -= 25 * CONFIG.PESOS.SPREAD;
  }

  // RSI
  if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) score += 20 * CONFIG.PESOS.RSI;
  else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) score -= 20 * CONFIG.PESOS.RSI;
  else if (indicadores.rsi < 40) score += 10 * CONFIG.PESOS.RSI;
  else if (indicadores.rsi > 60) score -= 10 * CONFIG.PESOS.RSI;

  // MACD
  if (indicadores.macd.histograma > 0.15) score += 15 * CONFIG.PESOS.MACD;
  else if (indicadores.macd.histograma < -0.15) score -= 15 * CONFIG.PESOS.MACD;
  else if (indicadores.macd.histograma > 0.05) score += 8 * CONFIG.PESOS.MACD;
  else if (indicadores.macd.histograma < -0.05) score -= 8 * CONFIG.PESOS.MACD;

  // Tendência
  if (indicadores.tendencia === "FORTE_ALTA") score += 18 * CONFIG.PESOS.EMA;
  else if (indicadores.tendencia === "ALTA") score += 10 * CONFIG.PESOS.EMA;
  else if (indicadores.tendencia === "FORTE_BAIXA") score -= 18 * CONFIG.PESOS.EMA;
  else if (indicadores.tendencia === "BAIXA") score -= 10 * CONFIG.PESOS.EMA;
  else if (indicadores.tendencia === "LATERAL") score -= 12; // Penaliza lateralidade

  // Volume
  if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
    score += (indicadores.tendencia.includes("ALTA") ? 12 : -12) * CONFIG.PESOS.VOLUME;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia) {
  if (tendencia === "LATERAL") {
    return "ESPERAR (LATERAL)";
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
    if (tendencia === "NEUTRA") return score > 65 ? "CALL" : "ESPERAR";
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// CORE DO SISTEMA (COM AJUSTES PARA CRYPTO IDX)
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
    const velaAtual = dados[dados.length - 1];
    
    // Aplica fator de correção para o Crypto IDX
    const close = parseFloat(velaAtual[4]) * state.fatorCorrecao;
    const high = parseFloat(velaAtual[2]) * state.fatorCorrecao;
    const low = parseFloat(velaAtual[3]) * state.fatorCorrecao;
    const volume = parseFloat(velaAtual[5]);

    const closes = dados.map(v => parseFloat(v[4]) * state.fatorCorrecao);
    const highs = dados.map(v => parseFloat(v[2]) * state.fatorCorrecao);
    const lows = dados.map(v => parseFloat(v[3]) * state.fatorCorrecao);
    const volumes = dados.map(v => parseFloat(v[5]));

    // Calcula spread atual
    state.spreadAtual = (high - low) / close;

    // Calcula indicadores
    const ema21Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema50Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema21 = ema21Array[ema21Array.length - 1] || 0;
    const ema50 = ema50Array[ema50Array.length - 1] || 0;

    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      sma9: calcularMedia.simples(closes, 9),
      ema21,
      ema50,
      volume,
      volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME),
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      close,
      spread: state.spreadAtual,
      tendencia: avaliarTendencia(closes, ema21, ema50)
    };

    const score = calcularScore(indicadores);
    const sinal = determinarSinal(score, indicadores.tendencia);

    // Atualiza interface (MANTIDA DA SUA VERSÃO ORIGINAL)
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
      <li>Spread: ${(indicadores.spread * 100).toFixed(2)}%</li>
      <li>Médias: SMA9 ${indicadores.sma9?.toFixed(2) || 'N/A'} | EMA21 ${indicadores.ema21.toFixed(2)} | EMA50 ${indicadores.ema50.toFixed(2)}</li>
      <li>Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)}</li>
    `;

    // Histórico (MANTIDO DA SUA VERSÃO)
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
// CONTROLE DE TEMPO (MANTIDO DA SUA VERSÃO)
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
// INICIALIZAÇÃO (MANTIDO DA SUA VERSÃO)
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
        const precoAjustado = parseFloat(dados.lastPrice) * state.fatorCorrecao;
        precoElement.textContent = `Preço: $${precoAjustado.toFixed(2)}`;
      }
    } catch (e) {
      console.error("Erro ao atualizar preço:", e);
    }
  }, 5000);
}

document.addEventListener('DOMContentLoaded', iniciarAplicativo);
