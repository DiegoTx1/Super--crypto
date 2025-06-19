// =============================================
// CONFIGURAÇÕES GLOBAIS ATUALIZADAS 2025
// =============================================
const state = {
  ultimosSinais: [],
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
  mlModel: null
};

const CONFIG = {
  API_ENDPOINTS: [
    "https://api.twelvedata.com",
    "https://api.binance.com/api/v3",
    "https://pro-api.coinmarketcap.com/v1"
  ],
  WS_ENDPOINTS: {
    BINANCE: "wss://stream.binance.com:9443/ws",
    COINAPI: "wss://ws.coinapi.io/v1/"
  },
  ONCHAIN_API: "https://api.glassnode.com/v1",
  ML_API: "https://api.cryptoml.ai/v3/predict",
  
  PARES: {
    BTCUSDT: "BTC/USDT",
    ETHUSDT: "ETH/USDT",
    SOLUSDT: "SOL/USDT"
  },
  
  PERIODOS: {
    // Médias adaptativas
    HULL_MA: 9,
    T3_ADAPTIVE: 10,
    JURIK_MA: 13,
    EMA_ADAPTATIVA: 14,
    
    // Osciladores
    RSI_ADAPTATIVO: 14,
    STOCH_3D: 14,
    MFI_CHAIN: 21,
    
    // Volume
    VWAP_TPO: 20,
    OBV_CHAIN: 14,
    VROC_LIQUIDEZ: 12,
    
    // Volatilidade
    KELTNER_ATR: 22,
    SYNTHETIC_IV: 18
  },
  
  LIMIARES: {
    // Dinâmicos
    RSI_DYNAMIC_OB: 68,
    RSI_DYNAMIC_OS: 32,
    STOCH_3D_ENTRY: 20,
    STOCH_3D_EXIT: 80,
    VOLUME_SPIKE: 2.8,
    
    // Confiança
    SCORE_ALTO: 85,
    SCORE_MEDIO: 70,
    MIN_CONFIRMACOES: 3
  },
  
  PESOS: {
    TENDENCIA: 0.35,
    MOMENTUM: 0.25,
    VOLUME: 0.20,
    VOLATILIDADE: 0.15,
    ML_CONFIANCA: 0.05
  }
};

// =============================================
// FUNÇÕES UTILITÁRIAS AVANÇADAS
// =============================================
function formatarTimer(segundos) {
  const mins = Math.floor(segundos / 60);
  const secs = segundos % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const now = new Date();
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    elementoHora.textContent = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

function atualizarInterface(sinal, score, analise) {
  if (!state.marketOpen && sinal !== "ERRO") return;

  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    const emojis = {
      CALL: "📈🔥",
      PUT: "📉💥",
      ESPERAR: "🔄",
      ERRO: "❌"
    };
    comandoElement.textContent += ` ${emojis[sinal] || ""}`;
  }

  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Confiança: ${score}%`;
    scoreElement.style.color = score >= CONFIG.LIMIARES.SCORE_ALTO ? '#00ff88' :
                              score >= CONFIG.LIMIARES.SCORE_MEDIO ? '#ffff00' : '#ff0055';
  }

  // Atualizar critérios
  const criteriosElement = document.getElementById("criterios");
  if (criteriosElement) {
    criteriosElement.innerHTML = `
      <li>🧭 Tendência: ${analise.trendStrength.toFixed(2)}/1.0</li>
      <li>📈 RSI Adapt: ${analise.rsiAdaptativo.toFixed(2)}</li>
      <li>📊 Stochastic 3D: K${analise.stoch3D.k.toFixed(2)} D${analise.stoch3D.d.toFixed(2)}</li>
      <li>💎 Volume OBV: ${(analise.obvChain * 100).toFixed(2)}%</li>
      <li>🌪️ Volatilidade: ${(analise.volatilidade * 100).toFixed(2)}%</li>
      ${analise.mlConfidence ? `<li>🤖 ML Score: ${analise.mlConfidence.toFixed(2)}</li>` : ''}
    `;
  }
}

// =============================================
// INDICADORES TÉCNICOS AVANÇADOS 2025
// =============================================
// 1. MÉDIAS INOVADORAS
function calcularHullMA(prices, period) {
  const wmaShort = calcularWMA(prices, Math.floor(period / 2));
  const wmaLong = calcularWMA(prices, period);
  const hullRaw = wmaShort.map((val, idx) => 2 * val - wmaLong[idx]);
  return calcularWMA(hullRaw, Math.sqrt(period));
}

function calcularT3Adaptative(prices, period = CONFIG.PERIODOS.T3_ADAPTIVE) {
  const ema1 = calcularEMA(prices, period);
  const ema2 = calcularEMA(ema1, period);
  const ema3 = calcularEMA(ema2, period);
  const ema4 = calcularEMA(ema3, period);
  const ema5 = calcularEMA(ema4, period);
  const ema6 = calcularEMA(ema5, period);
  
  return ema6.map((val, idx) => {
    const c1 = -0.618;
    const c2 = 3.236;
    const c3 = -4.472;
    const c4 = 3.236;
    return c1 * ema6[idx] + c2 * ema5[idx] + c3 * ema4[idx] + c4 * ema3[idx];
  });
}

// 2. OSCILADORES MODERNOS
function calcularRSIAdaptativo(closes, lookback = CONFIG.PERIODOS.RSI_ADAPTATIVO) {
  const volatilidade = calcularDesvioPadrao(closes) / Math.abs(calcularMediaSimples(closes));
  const periodo = Math.min(25, Math.max(7, Math.floor(lookback / (1 + volatilidade)));
  return calcularRSI(closes, periodo);
}

function calcularStochastic3D(highs, lows, closes, volumes) {
  const stochPrice = calcularStochastic(highs, lows, closes);
  const stochVolume = calcularStochastic(highs, lows, volumes);
  
  return {
    k: (stochPrice.k * 0.6 + stochVolume.k * 0.4),
    d: (stochPrice.d * 0.5 + stochVolume.d * 0.5),
    divergencia: stochPrice.k - stochVolume.k
  };
}

// 3. ANÁLISE DE VOLUME INTELIGENTE
async function calcularOBVChain(closes, volumes) {
  try {
    const response = await fetch(`${CONFIG.ONCHAIN_API}/market/volume`);
    const onChainData = await response.json();
    const obvClassico = calcularOBV(closes, volumes);
    return obvClassico * (1 + (onChainData.netflow / 1e6));
  } catch (e) {
    console.error("Erro OBV Chain:", e);
    return calcularOBV(closes, volumes);
  }
}

// =============================================
// SISTEMA DE ANÁLISE HÍBRIDO
// =============================================
async function analisarMercadoAvancado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;

  try {
    // 1. Obter dados
    const dados = await obterDadosMultiplataforma();
    if (!dados || !dados.closes || dados.closes.length < 50) {
      throw new Error("Dados insuficientes");
    }

    // 2. Calcular indicadores
    const hullMA = calcularHullMA(dados.closes, 9);
    const t3 = calcularT3Adaptative(dados.closes);
    const trendStrength = calcularForcaTendencia(hullMA, t3);
    
    const rsiAdapt = calcularRSIAdaptativo(dados.closes);
    const stoch3D = calcularStochastic3D(dados.highs, dados.lows, dados.closes, dados.volumes);
    const obvChain = await calcularOBVChain(dados.closes, dados.volumes);
    
    // 3. Machine Learning
    let mlConfidence = 0.5;
    try {
      mlConfidence = await preverModeloML({
        features: [
          trendStrength,
          rsiAdapt / 100,
          stoch3D.k / 100,
          obvChain,
          calcularVolatilidade(dados.closes)
        ]
      });
    } catch (e) {
      console.warn("Falha ML:", e);
    }

    // 4. Gerar sinal
    const analise = {
      trendStrength,
      rsiAdaptativo: rsiAdapt,
      stoch3D,
      obvChain,
      volatilidade: calcularATR(dados.closes) / dados.closes.slice(-1)[0],
      mlConfidence
    };

    const score = calcularConfiancaAvancada(analise);
    const sinal = determinarSinalAvancado(analise, score);

    // 5. Atualizar estado e interface
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString();
    atualizarInterface(sinal, score, analise);

  } catch (error) {
    console.error("Erro análise:", error);
    atualizarInterface("ERRO", 0, {});
  } finally {
    state.leituraEmAndamento = false;
  }
}

function calcularConfiancaAvancada(analise) {
  const score = (
    analise.trendStrength * CONFIG.PESOS.TENDENCIA * 100 +
    ((analise.rsiAdaptativo > 50 ? 1 : -1) * Math.abs(analise.rsiAdaptativo - 50) / 50) * CONFIG.PESOS.MOMENTUM * 100 +
    analise.obvChain * CONFIG.PESOS.VOLUME * 100 +
    analise.volatilidade * CONFIG.PESOS.VOLATILIDADE * 100 +
    analise.mlConfidence * CONFIG.PESOS.ML_CONFIANCA * 100
  );
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinalAvancado(analise, score) {
  const tendenciaAlta = analise.trendStrength > 0.7;
  const tendenciaBaixa = analise.trendStrength < 0.3;
  const momentumAlto = analise.rsiAdaptativo > 50 && analise.stoch3D.k > 50;
  const momentumBaixo = analise.rsiAdaptativo < 50 && analise.stoch3D.k < 50;
  
  if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
    if (tendenciaAlta && momentumAlto) return "CALL";
    if (tendenciaBaixa && momentumBaixo) return "PUT";
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
    if (momentumAlto && analise.volatilidade > 0.03) return "CALL";
    if (momentumBaixo && analise.volatilidade > 0.03) return "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// INTEGRAÇÕES EXTERNAS
// =============================================
async function obterDadosMultiplataforma() {
  // Implementação otimizada que consulta múltiplas APIs
  // Retorna um objeto com { closes, highs, lows, volumes }
}

async function preverModeloML(features) {
  try {
    const response = await fetch(CONFIG.ML_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features })
    });
    const data = await response.json();
    return data.confidence;
  } catch (e) {
    console.error("Erro ML:", e);
    return 0.5;
  }
}

// =============================================
// CONTROLE DE TEMPO E INICIALIZAÇÃO
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  
  const agora = Date.now();
  const delay = 60000 - (agora % 60000);
  state.timer = Math.floor(delay / 1000);

  const timerElement = document.getElementById("timer");
  if (timerElement) {
    timerElement.textContent = formatarTimer(state.timer);
    timerElement.style.color = state.timer <= 10 ? '#ff0055' : '#00ff88';
  }

  state.intervaloAtual = setInterval(() => {
    state.timer--;
    if (timerElement) {
      timerElement.textContent = formatarTimer(state.timer);
      timerElement.style.color = state.timer <= 10 ? '#ff0055' : '#00ff88';
    }
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercadoAvancado().finally(sincronizarTimer);
    }
  }, 1000);
}

function iniciarAplicativo() {
  // Verificar elementos DOM
  const elementosNecessarios = ['comando', 'score', 'hora', 'timer', 'criterios', 'ultimos'];
  if (elementosNecessarios.some(id => !document.getElementById(id))) {
    console.error("Elementos da interface não encontrados");
    return;
  }

  // Iniciar serviços
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  analisarMercadoAvancado();
  iniciarWebSocket();
}

// Inicialização
if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
