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
  winLossHistory: [],
  lastTradeResult: null
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
    RSI: 14,
    STOCH: 11,
    WILLIAMS: 14,
    EMA_CURTA: 8,
    EMA_LONGA: 34,
    EMA_200: 200,
    SMA_VOLUME: 14,
    MACD_RAPIDA: 8,
    MACD_LENTA: 21,
    MACD_SINAL: 8,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 34,
    VWAP: 20,
    ATR: 14,
    SUPERTREND: 10,
    SUPERTREND_MULTIPLIER: 3.0
  },
  LIMIARES: {
    SCORE_ALTO: 78,
    SCORE_MEDIO: 65,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    WILLIAMS_OVERBOUGHT: -15,
    WILLIAMS_OVERSOLD: -85,
    VOLUME_ALTO: 1.5,
    VARIACAO_LATERAL: 0.5,
    VWAP_DESVIO: 0.0020,
    ATR_LIMIAR: 0.0012,
    EXAUSTAO_COMPRA: 0.85,
    EXAUSTAO_VENDA: 0.85
  },
  PESOS: {
    RSI: 1.3,
    MACD: 1.8,
    TENDENCIA: 2.0,
    VOLUME: 1.0,
    STOCH: 1.0,
    WILLIAMS: 0.9,
    CONFIRMACAO: 1.2,
    LATERALIDADE: 1.5,
    VWAP: 1.2,
    VOLATILIDADE: 1.3,
    SUPERTREND: 1.7
  },
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.02,
    R_R_MINIMO: 1.8,
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
// FUNÇÕES UTILITÁRIAS CORRIGIDAS
// =============================================

function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  state.timer = 60;
  document.getElementById("timer").textContent = state.timer;
  
  state.intervaloAtual = setInterval(() => {
    state.timer--;
    document.getElementById("timer").textContent = state.timer;
    
    if (state.timer <= 0) {
      state.timer = 60;
      if (!state.leituraEmAndamento) {
        analisarMercado();
      }
    }
  }, 1000);
}

function iniciarWebSocket() {
  if (state.websocket && state.websocket.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    state.websocket = new WebSocket(CONFIG.WS_ENDPOINT);

    state.websocket.onopen = () => {
      console.log("Conexão WebSocket estabelecida");
      state.websocket.send(JSON.stringify({
        action: "subscribe",
        params: Object.values(CONFIG.PARES).join(",")
      }));
    };

    state.websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === "price") {
        atualizarDadosEmTempoReal(data);
      }
    };

    state.websocket.onerror = (error) => {
      console.error("Erro WebSocket:", error);
      setTimeout(iniciarWebSocket, 5000);
    };

    state.websocket.onclose = () => {
      console.log("Conexão WebSocket fechada. Reconectando...");
      setTimeout(iniciarWebSocket, 5000);
    };

  } catch (error) {
    console.error("Erro ao iniciar WebSocket:", error);
    setTimeout(iniciarWebSocket, 10000);
  }
}

function verificarMercadosAbertos() {
  const now = new Date();
  const gmtHours = now.getUTCHours();
  const gmtDay = now.getUTCDay();
  
  state.activeMarkets = [];
  
  if (gmtDay === 0 || gmtDay === 6) {
    state.marketOpen = false;
    return;
  }
  
  const markets = [
    { name: "Tóquio", open: CONFIG.MARKET_HOURS.TOKYO_OPEN, close: CONFIG.MARKET_HOURS.TOKYO_CLOSE },
    { name: "Londres", open: CONFIG.MARKET_HOURS.LONDON_OPEN, close: CONFIG.MARKET_HOURS.LONDON_CLOSE },
    { name: "Nova York", open: CONFIG.MARKET_HOURS.NY_OPEN, close: CONFIG.MARKET_HOURS.NY_CLOSE },
    { name: "Sydney", open: CONFIG.MARKET_HOURS.SYDNEY_OPEN, close: CONFIG.MARKET_HOURS.SYDNEY_CLOSE }
  ];
  
  let isAnyOpen = false;
  
  markets.forEach(market => {
    let isOpen = false;
    
    if (market.open < market.close) {
      isOpen = gmtHours >= market.open && gmtHours < market.close;
    } else {
      isOpen = gmtHours >= market.open || gmtHours < market.close;
    }
    
    if (isOpen) {
      state.activeMarkets.push(market.name);
      isAnyOpen = true;
    }
  });
  
  state.marketOpen = isAnyOpen;
}

// =============================================
// FUNÇÕES PRINCIPAIS CORRIGIDAS
// =============================================

async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  
  state.leituraEmAndamento = true;
  try {
    verificarMercadosAbertos();
    
    if (!state.marketOpen) {
      atualizarInterface("MERCADO FECHADO", 0);
      document.getElementById("mercado-info").innerHTML = `
        <div class="market-closed">🔴 MERCADO FECHADO</div>
        <div class="next-open">Próxima abertura: ${proximaAbertura()}</div>
      `;
      return;
    }
    
    const dados = await obterDadosForex();
    if (!dados || dados.length === 0) {
      throw new Error("Dados vazios retornados da API");
    }
    
    // Restante da análise...
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    const emaCurtaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const emaLongaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema200Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200);
    const emaCurta = emaCurtaArray.slice(-1)[0] || 0;
    const emaLonga = emaLongaArray.slice(-1)[0] || 0;
    const ema200 = ema200Array.slice(-1)[0] || 0;

    const superTrend = calcularSuperTrend(highs, lows, closes);
    const currentTrend = superTrend.direction[superTrend.direction.length - 1];

    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      sma9: calcularMedia.simples(closes, 9),
      emaCurta,
      emaLonga,
      ema200,
      volume: velaAtual.volume,
      volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME) || 1,
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      vwap: calcularVWAP(dados),
      atr: calcularATR(dados),
      close: velaAtual.close,
      highs,
      lows,
      closes,
      tendencia: avaliarTendencia(closes, highs, lows, emaCurta, emaLonga, ema200),
      superTrend: currentTrend
    };

    const score = calcularScore(indicadores);
    const sinal = determinarSinal(score, indicadores.tendencia);

    state.ultimoSinal = sinal !== "ESPERAR" ? sinal : state.ultimoSinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score);
    atualizarHistorico(indicadores, sinal, score);

    state.tentativasErro = 0;
  } catch (e) {
    console.error("Erro na análise:", e);
    state.tentativasErro++;
    
    if (state.tentativasErro > 3) {
      console.log("Muitos erros consecutivos. Reiniciando...");
      setTimeout(() => location.reload(), 10000);
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

function atualizarInterface(sinal, score) {
  const comandoElement = document.getElementById("comando");
  const scoreElement = document.getElementById("score");
  const horaElement = document.getElementById("hora");
  
  if (comandoElement) comandoElement.textContent = sinal;
  if (scoreElement) scoreElement.textContent = `${score}%`;
  if (horaElement) horaElement.textContent = new Date().toLocaleTimeString("pt-BR");
  
  // Atualizar histórico na interface
  const ultimosElement = document.getElementById("ultimos");
  if (ultimosElement) {
    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%) ${sinal==="CALL"?"📈":sinal==="PUT"?"📉":"✋"}`);
    if (state.ultimos.length > 10) state.ultimos.pop();
    ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
  }
  
  // Atualizar status do mercado
  atualizarInfoMercado();
}

// =============================================
// INICIALIZAÇÃO DO APLICATIVO
// =============================================

function iniciarAplicativo() {
  // Verificar se todos os elementos necessários existem
  const ids = ['comando', 'score', 'hora', 'timer', 'criterios', 'ultimos', 'mercado-info'];
  const faltando = ids.filter(id => !document.getElementById(id));
  
  if (faltando.length > 0) {
    console.error("Elementos faltando na interface:", faltando);
    return;
  }
  
  // Iniciar componentes
  sincronizarTimer();
  iniciarWebSocket();
  analisarMercado();
  
  // Configurar atualização do relógio
  setInterval(() => {
    document.getElementById("hora").textContent = new Date().toLocaleTimeString("pt-BR");
  }, 1000);
  
  // Adicionar botão de backtest se não existir
  if (!document.querySelector('.backtest-btn')) {
    const backtestBtn = document.createElement('button');
    backtestBtn.textContent = 'Executar Backtest (5 dias)';
    backtestBtn.className = 'backtest-btn';
    backtestBtn.onclick = () => {
      backtestBtn.textContent = 'Calculando...';
      backtestSimples().then(() => {
        backtestBtn.textContent = 'Backtest Completo (ver console)';
        setTimeout(() => backtestBtn.textContent = 'Executar Backtest (5 dias)', 3000);
      });
    };
    document.body.appendChild(backtestBtn);
  }
}

// Iniciar o aplicativo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', iniciarAplicativo);
