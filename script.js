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
  apiKeys: [
    "demo", // Chave padrão
    "seu_outra_chave_1", // Adicione suas chaves aqui
    "seu_outra_chave_2"
  ],
  currentApiKeyIndex: 0,
  marketOpen: true,
  activeMarkets: []
};

const CONFIG = {
  API_ENDPOINTS: [
    "https://api.twelvedata.com",
    "https://api.frankfurter.app",
    "https://api.exchangerate-api.com"
  ],
  WS_ENDPOINT: "wss://stream.twelvedata.com/v1/quotes/price",
  PARES: {
    EURUSD: "EUR/USD"
  },
  PERIODOS: {
    // Atualizado para estratégias 2025
    RSI: 14,
    STOCH: 11,  // Reduzido para maior sensibilidade
    WILLIAMS: 14,
    EMA_CURTA: 8,   // Ajustado para capturar movimentos rápidos
    EMA_LONGA: 34,  // Fibonacci number for better trend following
    EMA_200: 200,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 8,   // Ajustado para 2025
    MACD_LENTA: 21,   // Média de Fibonacci
    MACD_SINAL: 5,    // Mais sensível
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 50,  // Período maior para evitar falsos laterais
    VWAP: 20,
    ATR: 14,
    HMA: 9            // Nova média Hull para tendência
  },
  LIMIARES: {
    SCORE_ALTO: 82,  // Aumentado para reduzir falsos sinais
    SCORE_MEDIO: 68,
    RSI_OVERBOUGHT: 70,  // Ajustado para EURUSD
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    WILLIAMS_OVERBOUGHT: -15,
    WILLIAMS_OVERSOLD: -85,
    VOLUME_ALTO: 1.5,
    VARIACAO_LATERAL: 0.5,  // Mais restritivo
    VWAP_DESVIO: 0.0020,    // Aumentado para EURUSD
    ATR_LIMIAR: 0.0008,
    HMA_SLOPE_THRESHOLD: 0.0003  // Novo limiar para inclinação HMA
  },
  PESOS: {
    // Rebalanceado para 2025
    RSI: 1.3,
    MACD: 2.2,
    TENDENCIA: 2.0,  // Maior peso para tendência
    VOLUME: 0.9,
    STOCH: 1.0,
    WILLIAMS: 0.9,
    CONFIRMACAO: 1.2,
    LATERALIDADE: 2.0,  // Mais importante em 2025
    VWAP: 1.5,         // Mais relevante agora
    VOLATILIDADE: 1.3,
    HMA: 1.7           // Novo peso para HMA
  },
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.02,
    R_R_MINIMO: 1.8,    // Aumentado
    ATR_MULTIPLICADOR_SL: 1.8,
    ATR_MULTIPLICADOR_TP: 3.2
  },
  MARKET_HOURS: {
    LONDON_OPEN: 7,
    LONDON_CLOSE: 16,
    NY_OPEN: 13,
    NY_CLOSE: 22,
    TOKYO_OPEN: 0,
    TOKYO_CLOSE: 9,
    SYDNEY_OPEN: 22,
    SYDNEY_CLOSE: 7
  }
};

// =============================================
// FUNÇÕES UTILITÁRIAS (ATUALIZADAS)
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    const now = new Date();
    const gmtHours = now.getUTCHours();
    const gmtMinutes = now.getUTCMinutes();
    const timeString = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    elementoHora.textContent = timeString;
    state.ultimaAtualizacao = timeString;

    // Verificar horário de mercado (atualizado para 2025)
    const isLondonOpen = gmtHours >= CONFIG.MARKET_HOURS.LONDON_OPEN && gmtHours < CONFIG.MARKET_HOURS.LONDON_CLOSE;
    const isNYOpen = gmtHours >= CONFIG.MARKET_HOURS.NY_OPEN && gmtHours < CONFIG.MARKET_HOURS.NY_CLOSE;
    const isTokyoOpen = gmtHours >= CONFIG.MARKET_HOURS.TOKYO_OPEN && gmtHours < CONFIG.MARKET_HOURS.TOKYO_CLOSE;
    const isSydneyOpen = (gmtHours >= CONFIG.MARKET_HOURS.SYDNEY_OPEN || gmtHours < CONFIG.MARKET_HOURS.SYDNEY_CLOSE);
    
    state.activeMarkets = [];
    if (isLondonOpen) state.activeMarkets.push("Londres");
    if (isNYOpen) state.activeMarkets.push("Nova York");
    if (isTokyoOpen) state.activeMarkets.push("Tóquio");
    if (isSydneyOpen) state.activeMarkets.push("Sydney");
    
    state.marketOpen = isLondonOpen || isNYOpen || isTokyoOpen || isSydneyOpen;
    
    // Atualizar display de mercados abertos
    const marketStatusElement = document.getElementById("marketStatus");
    if (marketStatusElement) {
      if (state.activeMarkets.length > 0) {
        marketStatusElement.textContent = `Mercados abertos: ${state.activeMarkets.join(', ')}`;
        marketStatusElement.style.color = '#00ff00';
      } else {
        marketStatusElement.textContent = "MERCADO FECHADO";
        marketStatusElement.style.color = '#ff0000';
      }
    }
    
    if (!state.marketOpen) {
      document.getElementById("comando").textContent = "MERCADO FECHADO";
      document.getElementById("comando").className = "esperar";
    }
  }
}

// Restante das funções utilitárias mantidas igual...

// =============================================
// INDICADORES TÉCNICOS (ATUALIZADOS PARA 2025)
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

  // Nova função para Média Móvel de Hull (HMA) - Mais precisa para tendências
  hull: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < Math.sqrt(periodo)) return [];
    
    const wmaHalf = dados.map((_, i, arr) => {
      const slice = arr.slice(Math.max(0, i - Math.floor(periodo/2) + 1), i + 1);
      return calcularMedia.ponderada(slice, slice.length);
    });
    
    const wmaFull = dados.map((_, i, arr) => {
      const slice = arr.slice(Math.max(0, i - periodo + 1), i + 1);
      return calcularMedia.ponderada(slice, slice.length);
    });
    
    const hmaRaw = wmaHalf.map((val, i) => 2 * val - (wmaFull[i] || val));
    const hma = hmaRaw.map((_, i, arr) => {
      const slice = arr.slice(Math.max(0, i - Math.floor(Math.sqrt(periodo)) + 1), i + 1);
      return calcularMedia.ponderada(slice, slice.length);
    });
    
    return hma;
  },
  
  ponderada: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length === 0) return 0;
    let sum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < dados.length; i++) {
      const weight = (i + 1);
      sum += dados[i] * weight;
      weightSum += weight;
    }
    
    return sum / weightSum;
  }
};

// Função para calcular inclinação da média (nova)
function calcularInclinacaoMedia(mediaArray) {
  if (!Array.isArray(mediaArray) || mediaArray.length < 2) return 0;
  
  const ultimo = mediaArray[mediaArray.length - 1];
  const anterior = mediaArray[mediaArray.length - 2];
  return ultimo - anterior;
}

// Restante dos indicadores técnicos atualizados...

function avaliarTendencia(closes, emaCurta, emaLonga, ema200) {
  if (closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  // Cálculo da HMA para tendência mais precisa
  const hmaArray = calcularMedia.hull(closes, CONFIG.PERIODOS.HMA);
  const hma = hmaArray.slice(-1)[0] || 0;
  const hmaSlope = calcularInclinacaoMedia(hmaArray);
  
  if (detectarMercadoLateral(closes)) {
    state.contadorLaterais++;
    return "LATERAL";
  }
  
  state.contadorLaterais = 0;
  
  const ultimoClose = closes[closes.length - 1];
  const penultimoClose = closes[closes.length - 2];
  
  // Análise de tendência com HMA (mais precisa)
  const hmaUp = hmaSlope > CONFIG.LIMIARES.HMA_SLOPE_THRESHOLD;
  const hmaDown = hmaSlope < -CONFIG.LIMIARES.HMA_SLOPE_THRESHOLD;
  
  if (ultimoClose > hma && hmaUp && emaCurta > emaLonga && emaLonga > ema200) {
    return "FORTE_ALTA";
  }
  
  if (ultimoClose < hma && hmaDown && emaCurta < emaLonga && emaLonga < ema200) {
    return "FORTE_BAIXA";
  }
  
  if (ultimoClose > hma && hmaUp) {
    return "ALTA";
  }
  
  if (ultimoClose < hma && hmaDown) {
    return "BAIXA";
  }
  
  return "NEUTRA";
}

// Atualização da função calcularScore para incluir HMA
function calcularScore(indicadores) {
  let score = 50;

  // Adicionando análise HMA
  const hmaSlope = calcularInclinacaoMedia(indicadores.hmaArray || []);
  if (hmaSlope > CONFIG.LIMIARES.HMA_SLOPE_THRESHOLD) {
    score += 15 * CONFIG.PESOS.HMA;
  } else if (hmaSlope < -CONFIG.LIMIARES.HMA_SLOPE_THRESHOLD) {
    score -= 15 * CONFIG.PESOS.HMA;
  }

  // Restante da função mantida com ajustes nos pesos...
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

// =============================================
// SISTEMA DE DECISÃO (ATUALIZADO PARA 2025)
// =============================================
function determinarSinal(score, tendencia) {
  if (tendencia === "LATERAL") {
    // Em mercados laterais, só operar com confirmação forte
    return score > 85 ? "CALL" : "ESPERAR";
  }
  
  // Só operar quando o score for alto e a tendência clara
  if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
    return tendencia.includes("ALTA") ? "CALL" : 
           tendencia.includes("BAIXA") ? "PUT" : "ESPERAR";
  }
  
  // Operações medianas só com tendência forte
  if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
    return tendencia === "FORTE_ALTA" ? "CALL" :
           tendencia === "FORTE_BAIXA" ? "PUT" : "ESPERAR";
  }
  
  return "ESPERAR";
}

// =============================================
// CORE DO SISTEMA (ATUALIZADO)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  try {
    const dados = await obterDadosForex();
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Cálculos de médias atualizados
    const emaCurtaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const emaLongaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema200Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200);
    const hmaArray = calcularMedia.hull(closes, CONFIG.PERIODOS.HMA);
    
    const emaCurta = emaCurtaArray.slice(-1)[0] || 0;
    const emaLonga = emaLongaArray.slice(-1)[0] || 0;
    const ema200 = ema200Array.slice(-1)[0] || 0;
    const hma = hmaArray.slice(-1)[0] || 0;

    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      emaCurta,
      emaLonga,
      ema200,
      hma,
      hmaArray, // Adicionado para cálculo de inclinação
      volume: velaAtual.volume,
      volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME) || 1,
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      vwap: calcularVWAP(dados),
      atr: calcularATR(dados),
      close: velaAtual.close,
      tendencia: avaliarTendencia(closes, emaCurta, emaLonga, ema200)
    };

    const score = calcularScore(indicadores);
    const sinal = determinarSinal(score, indicadores.tendencia);

    // Restante da função mantido...
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0);
    if (++state.tentativasErro > 3) setTimeout(() => location.reload(), 10000);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// INICIALIZAÇÃO (ATUALIZADA COM NOVOS ELEMENTOS)
// =============================================
function iniciarAplicativo() {
  const ids = ['comando', 'score', 'hora', 'timer', 'criterios', 'ultimos'];
  const falt = ids.filter(id => !document.getElementById(id));
  if (falt.length > 0) { console.error("Faltam:", falt); return; }
  
  // Adicionar elemento de status do mercado se não existir
  if (!document.getElementById("marketStatus")) {
    const marketStatus = document.createElement("div");
    marketStatus.id = "marketStatus";
    marketStatus.style.position = "fixed";
    marketStatus.style.top = "10px";
    marketStatus.style.right = "10px";
    marketStatus.style.backgroundColor = "#333";
    marketStatus.style.padding = "5px 10px";
    marketStatus.style.borderRadius = "5px";
    marketStatus.style.zIndex = "1000";
    document.body.appendChild(marketStatus);
  }
  
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  iniciarWebSocket();
  analisarMercado();
  
  // Restante da função mantido...
}
