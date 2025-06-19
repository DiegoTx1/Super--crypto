// =============================================
// CONFIGURAÇÕES GLOBAIS (MANTIDAS)
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
  sentimentData: null
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
// FUNÇÕES UTILITÁRIAS (CORRIGIDAS)
// =============================================
function formatarTimer(segundos) {
  const mins = Math.floor(segundos / 60);
  const secs = segundos % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const now = new Date();
  state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR");
  const elementoHora = document.getElementById("hora");
  if (elementoHora) elementoHora.textContent = state.ultimaAtualizacao;
}

function atualizarInterface(sinal, score) {
  // Atualiza o comando principal
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    if (sinal === "CALL") comandoElement.textContent += " 📈";
    else if (sinal === "PUT") comandoElement.textContent += " 📉";
    else if (sinal === "ESPERAR") comandoElement.textContent += " ✋";
  }

  // Atualiza o score
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Confiança: ${score}%`;
    if (score >= CONFIG.LIMIARES.SCORE_ALTO) scoreElement.style.color = '#00ff00';
    else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) scoreElement.style.color = '#ffff00';
    else scoreElement.style.color = '#ff0000';
  }

  // Atualiza o histórico
  const ultimosElement = document.getElementById("ultimos");
  if (ultimosElement && sinal !== "ERRO") {
    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 10) state.ultimos.pop();
    ultimosElement.innerHTML = state.ultimos.map(item => `<li>${item}</li>`).join('');
  }
}

// =============================================
// INDICADORES TÉCNICOS (MANTIDOS)
// =============================================
function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) return 50;
  
  let ganhos = 0;
  let perdas = 0;
  
  for (let i = 1; i <= periodo; i++) {
    const diferenca = closes[i] - closes[i - 1];
    if (diferenca >= 0) ganhos += diferenca;
    else perdas += Math.abs(diferenca);
  }
  
  let RS = perdas === 0 ? Infinity : ganhos / perdas;
  return 100 - (100 / (1 + RS));
}

// ... (outros indicadores mantidos conforme seu código original)

// =============================================
// CORE DO SISTEMA (CORRIGIDO)
// =============================================
async function obterDadosCripto() {
  try {
    const response = await fetch(`${CONFIG.API_ENDPOINTS[0]}/time_series?symbol=BTC/USDT&interval=1min&apikey=demo`);
    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.error("Erro ao obter dados:", error);
    return null;
  }
}

async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;

  try {
    const dados = await obterDadosCripto();
    if (!dados || dados.length === 0) throw new Error("Dados inválidos");

    const closes = dados.map(item => parseFloat(item.close));
    const highs = dados.map(item => parseFloat(item.high));
    const lows = dados.map(item => parseFloat(item.low));
    const volumes = dados.map(item => parseFloat(item.volume));

    // Cálculos dos indicadores
    const rsi = calcularRSI(closes);
    // ... (cálculos dos outros indicadores)

    const score = calcularScore({
      rsi,
      // ... (outros indicadores)
    });

    const sinal = determinarSinal(score, avaliarTendencia(closes));
    
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    atualizarRelogio();
    atualizarInterface(sinal, score);

  } catch (error) {
    console.error("Erro na análise:", error);
    atualizarInterface("ERRO", 0);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO (CORRIGIDO)
// =============================================
function sincronizarTimer() {
  const timerElement = document.getElementById("timer");
  if (!timerElement) return;

  if (state.timer > 0) {
    state.timer--;
    timerElement.textContent = formatarTimer(state.timer);
  } else {
    state.timer = 60;
    analisarMercado();
  }
}

// =============================================
// INICIALIZAÇÃO (MANTIDA)
// =============================================
function iniciarAplicativo() {
  // Configura timer
  state.intervaloAtual = setInterval(sincronizarTimer, 1000);
  
  // Primeira execução
  analisarMercado();
  atualizarRelogio();
}

// Inicia quando o DOM estiver pronto
if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
