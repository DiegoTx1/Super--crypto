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
    "demo",
    "seu_outra_chave_1",
    "seu_outra_chave_2"
  ],
  currentApiKeyIndex: 0,
  marketOpen: true,
  activeMarkets: [],
  winLossStats: { wins: 0, losses: 0, winRate: 0 } // Novo histórico Win/Loss
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
    // Atualizados para estratégias 2025
    RSI: 11, // Otimizado para EURUSD
    STOCH: 11,
    WILLIAMS: 11,
    EMA_CURTA: 7,  // EMA mais sensível
    EMA_LONGA: 19, // Melhor combinação com EMA7
    EMA_200: 200,
    SMA_VOLUME: 14,
    MACD_RAPIDA: 10, // Ajustes para melhor timing
    MACD_LENTA: 22,
    MACD_SINAL: 7,
    VELAS_CONFIRMACAO: 2, // Confirmação mais rápida
    ANALISE_LATERAL: 28,
    VWAP: 14,
    ATR: 11,
    SUPER_TREND: 10, // Novo indicador adicionado
    SUPER_TREND_MULTIPLIER: 3.2
  },
  LIMIARES: {
    SCORE_ALTO: 78,  // Mais exigente
    SCORE_MEDIO: 68,
    RSI_OVERBOUGHT: 68, // Ajustados para 2025
    RSI_OVERSOLD: 32,
    STOCH_OVERBOUGHT: 82,
    STOCH_OVERSOLD: 18,
    WILLIAMS_OVERBOUGHT: -18,
    WILLIAMS_OVERSOLD: -82,
    VOLUME_ALTO: 1.4,
    VARIACAO_LATERAL: 0.7,
    VWAP_DESVIO: 0.0012,
    ATR_LIMIAR: 0.0009,
    SUPER_TREND_CONFIRM: 1.5 // Novo limiar
  },
  PESOS: {
    // Rebalanceados para 2025
    RSI: 1.4,
    MACD: 1.8,
    TENDENCIA: 1.7,
    VOLUME: 0.9,
    STOCH: 1.1,
    WILLIAMS: 0.9,
    CONFIRMACAO: 1.2,
    LATERALIDADE: 1.9,
    VWAP: 1.4,
    VOLATILIDADE: 1.3,
    SUPER_TREND: 1.6 // Novo peso
  },
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.02,
    R_R_MINIMO: 1.7, // Aumentado para 2025
    ATR_MULTIPLICADOR_SL: 1.7,
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
    elementoHora.textContent = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    // Verificar horário de mercado (atualizado para 2025)
    const gmtHours = now.getUTCHours();
    const isLondonOpen = gmtHours >= CONFIG.MARKET_HOURS.LONDON_OPEN && gmtHours < CONFIG.MARKET_HOURS.LONDON_CLOSE;
    const isNYOpen = gmtHours >= CONFIG.MARKET_HOURS.NY_OPEN && gmtHours < CONFIG.MARKET_HOURS.NY_CLOSE;
    const isTokyoOpen = gmtHours >= CONFIG.MARKET_HOURS.TOKYO_OPEN && gmtHours < CONFIG.MARKET_HOURS.TOKYO_CLOSE;
    const isSydneyOpen = (gmtHours >= CONFIG.MARKET_HOURS.SYDNEY_OPEN || gmtHours < CONFIG.MARKET_HOURS.SYDNEY_CLOSE);
    
    state.activeMarkets = [];
    if (isLondonOpen) state.activeMarkets.push("LON");
    if (isNYOpen) state.activeMarkets.push("NY");
    if (isTokyoOpen) state.activeMarkets.push("TKY");
    if (isSydneyOpen) state.activeMarkets.push("SYD");
    
    state.marketOpen = isLondonOpen || isNYOpen || isTokyoOpen || isSydneyOpen;
    
    const marketStatusElement = document.getElementById("market-status");
    if (marketStatusElement) {
      marketStatusElement.innerHTML = state.marketOpen 
        ? `Mercado Aberto (${state.activeMarkets.join(", ")}) <span class="market-open">🟢</span>`
        : `Mercado Fechado <span class="market-closed">🔴</span>`;
    }
    
    if (!state.marketOpen) {
      document.getElementById("comando").textContent = "MERCADO FECHADO";
      document.getElementById("comando").className = "esperar";
    }
  }
}

function atualizarWinLossStats(resultado) {
  if (resultado === 'win') {
    state.winLossStats.wins++;
  } else if (resultado === 'loss') {
    state.winLossStats.losses++;
  }
  
  const total = state.winLossStats.wins + state.winLossStats.losses;
  state.winLossStats.winRate = total > 0 ? (state.winLossStats.wins / total * 100) : 0;
  
  const winLossElement = document.getElementById("win-loss-stats");
  if (winLossElement) {
    winLossElement.innerHTML = `
      <div>Vitórias: <span class="win">${state.winLossStats.wins}</span></div>
      <div>Derrotas: <span class="loss">${state.winLossStats.losses}</span></div>
      <div>Taxa Acerto: <span class="rate">${state.winLossStats.winRate.toFixed(1)}%</span></div>
    `;
  }
}

function atualizarInterface(sinal, score) {
  if (!state.marketOpen) return;
  
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
  
  const horaElement = document.getElementById("hora");
  if (horaElement) horaElement.textContent = state.ultimaAtualizacao;
}

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
  }
};

// Novo indicador SuperTrend para 2025
function calcularSuperTrend(highs, lows, closes, periodo = CONFIG.PERIODOS.SUPER_TREND, multiplier = CONFIG.PERIODOS.SUPER_TREND_MULTIPLIER) {
  if (!Array.isArray(closes) || closes.length < periodo) return { trend: 0, direction: 'neutral' };
  
  const atrValues = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i-1]),
      Math.abs(lows[i] - closes[i-1])
    );
    atrValues.push(tr);
  }
  
  const atr = calcularMedia.simples(atrValues.slice(-periodo), periodo);
  const basicUpper = (highs[highs.length-1] + lows[lows.length-1]) / 2 + multiplier * atr;
  const basicLower = (highs[highs.length-1] + lows[lows.length-1]) / 2 - multiplier * atr;
  
  // Lógica simplificada para determinação de tendência
  const close = closes[closes.length-1];
  let direction = 'neutral';
  
  if (close > basicUpper) direction = 'up';
  else if (close < basicLower) direction = 'down';
  
  return {
    upper: basicUpper,
    lower: basicLower,
    atr: atr,
    direction: direction
  };
}

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (!Array.isArray(closes) || closes.length < periodo + 1) return 50;
  
  let gains = 0, losses = 0;
  
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / periodo;
  let avgLoss = Math.max(losses / periodo, 1e-8);

  for (let i = periodo + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    
    avgGain = (avgGain * (periodo - 1) + gain) / periodo;
    avgLoss = Math.max((avgLoss * (periodo - 1) + loss) / periodo, 1e-8);
  }

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// =============================================
// SISTEMA DE DECISÃO (ATUALIZADO PARA 2025)
// =============================================
function avaliarTendencia(closes, emaCurta, emaLonga, ema200, superTrend) {
  if (closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  if (detectarMercadoLateral(closes)) {
    state.contadorLaterais++;
    return "LATERAL";
  }
  
  state.contadorLaterais = 0;
  
  const ultimoClose = closes[closes.length - 1];
  const penultimoClose = closes[closes.length - 2];
  
  // Nova lógica de tendência com SuperTrend
  const superTrendDirection = superTrend.direction;
  const emaDirection = emaCurta > emaLonga ? 'up' : 'down';
  
  // Confirmação de tendência com múltiplos indicadores
  let trendStrength = 0;
  if (superTrendDirection === 'up') trendStrength++;
  if (emaDirection === 'up') trendStrength++;
  if (ultimoClose > ema200) trendStrength++;
  
  if (trendStrength >= 2) {
    // Tendência de alta confirmada
    if (ultimoClose > emaCurta && emaCurta > emaLonga && superTrendDirection === 'up') {
      return "FORTE_ALTA";
    }
    return "ALTA";
  }
  
  trendStrength = 0;
  if (superTrendDirection === 'down') trendStrength++;
  if (emaDirection === 'down') trendStrength++;
  if (ultimoClose < ema200) trendStrength++;
  
  if (trendStrength >= 2) {
    // Tendência de baixa confirmada
    if (ultimoClose < emaCurta && emaCurta < emaLonga && superTrendDirection === 'down') {
      return "FORTE_BAIXA";
    }
    return "BAIXA";
  }
  
  return "NEUTRA";
}

function calcularScore(indicadores) {
  let score = 50;

  // Análise de RSI (atualizada para 2025)
  if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) {
    score += 25 * CONFIG.PESOS.RSI;
    if (indicadores.tendencia.includes("BAIXA")) score -= 12; // Penalidade maior
  }
  else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) {
    score -= 25 * CONFIG.PESOS.RSI;
    if (indicadores.tendencia.includes("ALTA")) score += 12;
  }

  // Análise MACD (com filtro de ruído)
  const macdNoiseFilter = Math.abs(indicadores.macd.histograma) > 0.03 ? 1 : 0.5;
  score += (Math.min(Math.max(indicadores.macd.histograma * 10, -15), 15) * CONFIG.PESOS.MACD * macdNoiseFilter);

  // Análise de Tendência com SuperTrend
  switch(indicadores.tendencia) {
    case "FORTE_ALTA": 
      score += 22 * CONFIG.PESOS.TENDENCIA;
      if (indicadores.superTrend.direction === 'up') score += 8;
      break;
    case "ALTA": score += 14 * CONFIG.PESOS.TENDENCIA; break;
    case "FORTE_BAIXA": 
      score -= 22 * CONFIG.PESOS.TENDENCIA;
      if (indicadores.superTrend.direction === 'down') score -= 8;
      break;
    case "BAIXA": score -= 14 * CONFIG.PESOS.TENDENCIA; break;
    case "LATERAL": 
      score -= Math.min(state.contadorLaterais, 15) * CONFIG.PESOS.LATERALIDADE;
      break;
  }

  // Nova lógica de exaustão para evitar sinais contra tendência
  if (indicadores.tendencia.includes("ALTA") && 
      indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT &&
      indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
    score -= 20; // Penalidade forte para operações contra tendência
  }
  
  if (indicadores.tendencia.includes("BAIXA") && 
      indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD &&
      indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD) {
    score += 20;
  }

  // Restante da função mantido com pequenos ajustes...
  
  return Math.min(100, Math.max(0, Math.round(score)));
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

    const emaCurtaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const emaLongaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema200Array  = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200);
    const emaCurta = emaCurtaArray.slice(-1)[0] || 0;
    const emaLonga = emaLongaArray.slice(-1)[0] || 0;
    const ema200   = ema200Array.slice(-1)[0] || 0;
    
    // Novo cálculo SuperTrend
    const superTrend = calcularSuperTrend(highs, lows, closes);

    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      emaCurta,
      emaLonga,
      ema200,
      volume: velaAtual.volume,
      volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME) || 1,
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      vwap: calcularVWAP(dados),
      atr: calcularATR(dados),
      superTrend, // Novo indicador
      close: velaAtual.close,
      tendencia: avaliarTendencia(closes, emaCurta, emaLonga, ema200, superTrend)
    };

    const score = calcularScore(indicadores);
    const sinal = determinarSinal(score, indicadores.tendencia);

    // Atualizar histórico Win/Loss
    if (state.ultimoSinal && sinal !== "ESPERAR" && state.ultimoSinal !== sinal) {
      const resultado = (state.ultimoSinal === "CALL" && indicadores.close > state.ultimoPreco) ||
                       (state.ultimoSinal === "PUT" && indicadores.close < state.ultimoPreco) ? 'win' : 'loss';
      atualizarWinLossStats(resultado);
    }

    state.ultimoSinal = sinal !== "ESPERAR" ? sinal : state.ultimoSinal;
    state.ultimoScore = score;
    state.ultimoPreco = indicadores.close;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score);

    // Restante da função mantido...
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// INICIALIZAÇÃO (ATUALIZADA)
// =============================================
function iniciarAplicativo() {
  const ids=['comando','score','hora','timer','criterios','ultimos','market-status','win-loss-stats'];
  const falt = ids.filter(id=>!document.getElementById(id));
  if (falt.length>0) { console.error("Faltam elementos:",falt); return; }
  
  setInterval(atualizarRelogio,1000);
  sincronizarTimer();
  iniciarWebSocket();
  analisarMercado();
  
  // Inicializar Win/Loss Stats
  atualizarWinLossStats();
}
