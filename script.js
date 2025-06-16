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
    // Atualizados para estratégias 2025
    RSI: 14,
    STOCH: 11,
    WILLIAMS: 14,
    EMA_CURTA: 8,  // Mais sensível para EUR/USD
    EMA_LONGA: 34, // Melhor para identificar tendências
    EMA_200: 200,
    SMA_VOLUME: 14,
    MACD_RAPIDA: 8,
    MACD_LENTA: 21,
    MACD_SINAL: 8,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 34, // Aumentado para reduzir falsos
    VWAP: 20,
    ATR: 14,
    SUPERTREND: 10, // Novo indicador
    SUPERTREND_MULTIPLIER: 3.0
  },
  LIMIARES: {
    SCORE_ALTO: 78,  // Aumentado para reduzir falsos
    SCORE_MEDIO: 65,
    RSI_OVERBOUGHT: 70,  // Ajustado para EUR/USD
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    WILLIAMS_OVERBOUGHT: -15,
    WILLIAMS_OVERSOLD: -85,
    VOLUME_ALTO: 1.5,  // Aumentado para maior confirmação
    VARIACAO_LATERAL: 0.5,  // Reduzido para detectar melhor lateralidade
    VWAP_DESVIO: 0.0020,  // Aumentado para EUR/USD
    ATR_LIMIAR: 0.0012,
    EXAUSTAO_COMPRA: 0.85,  // Novo parâmetro
    EXAUSTAO_VENDA: 0.85    // Novo parâmetro
  },
  PESOS: {
    // Rebalanceado para 2025
    RSI: 1.3,
    MACD: 1.8,
    TENDENCIA: 2.0,  // Mais peso para tendência
    VOLUME: 1.0,
    STOCH: 1.0,
    WILLIAMS: 0.9,
    CONFIRMACAO: 1.2,
    LATERALIDADE: 1.5,
    VWAP: 1.2,
    VOLATILIDADE: 1.3,
    SUPERTREND: 1.7  // Novo peso
  },
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.02,
    R_R_MINIMO: 1.8,  // Aumentado
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
// NOVAS FUNÇÕES UTILITÁRIAS
// =============================================
function calcularSuperTrend(highs, lows, closes, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = CONFIG.PERIODOS.SUPERTREND_MULTIPLIER) {
  if (closes.length < periodo) return { trend: Array(closes.length).fill(0), direction: Array(closes.length).fill('neutral') };
  
  const atrValues = [];
  const superTrend = [];
  const direction = [];
  
  // Calcular ATR
  for (let i = periodo; i < closes.length; i++) {
    const trueRanges = [];
    for (let j = i - periodo + 1; j <= i; j++) {
      const tr = Math.max(
        highs[j] - lows[j],
        Math.abs(highs[j] - closes[j-1]),
        Math.abs(lows[j] - closes[j-1])
      );
      trueRanges.push(tr);
    }
    atrValues.push(calcularMedia.simples(trueRanges, periodo));
  }
  
  // Calcular SuperTrend
  for (let i = periodo; i < closes.length; i++) {
    const atr = atrValues[i - periodo];
    const hl2 = (highs[i] + lows[i]) / 2;
    
    const upperBand = hl2 + (multiplicador * atr);
    const lowerBand = hl2 - (multiplicador * atr);
    
    if (i === periodo) {
      superTrend.push(lowerBand);
      direction.push('up');
    } else {
      let currentTrend = superTrend[i - periodo - 1];
      let currentDirection = direction[i - periodo - 1];
      
      if (currentDirection === 'up') {
        if (closes[i] > lowerBand) {
          currentTrend = Math.max(lowerBand, currentTrend);
          currentDirection = 'up';
        } else {
          currentTrend = upperBand;
          currentDirection = 'down';
        }
      } else {
        if (closes[i] < upperBand) {
          currentTrend = Math.min(upperBand, currentTrend);
          currentDirection = 'down';
        } else {
          currentTrend = lowerBand;
          currentDirection = 'up';
        }
      }
      
      superTrend.push(currentTrend);
      direction.push(currentDirection);
    }
  }
  
  return {
    trend: superTrend,
    direction: direction
  };
}

function verificarMercadosAbertos() {
  const now = new Date();
  const gmtHours = now.getUTCHours();
  const gmtDay = now.getUTCDay(); // 0 = Domingo, 6 = Sábado
  
  state.activeMarkets = [];
  
  // Verificar se é fim de semana
  if (gmtDay === 0 || gmtDay === 6) {
    state.marketOpen = false;
    return;
  }
  
  // Verificar cada mercado
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

function atualizarInfoMercado() {
  const mercadoElement = document.getElementById("mercado-info");
  if (!mercadoElement) return;
  
  verificarMercadosAbertos();
  
  if (!state.marketOpen) {
    mercadoElement.innerHTML = `
      <div class="market-closed">🔴 MERCADO FECHADO</div>
      <div class="next-open">Próxima abertura: ${proximaAbertura()}</div>
    `;
    return;
  }
  
  let marketsHtml = state.activeMarkets.map(market => 
    `<div class="market-open">🟢 ${market} ABERTO</div>`
  ).join('');
  
  mercadoElement.innerHTML = `
    <div class="market-status">🟢 MERCADO ABERTO</div>
    <div class="active-markets">${marketsHtml}</div>
  `;
}

function proximaAbertura() {
  const now = new Date();
  const gmtHours = now.getUTCHours();
  const gmtDay = now.getUTCDay();
  
  // Se for fim de semana, próxima abertura é segunda-feira em Tóquio
  if (gmtDay === 0) { // Domingo
    return "Segunda-feira 00:00 GMT (Tóquio)";
  } else if (gmtDay === 6) { // Sábado
    return "Domingo 22:00 GMT (Sydney)";
  }
  
  // Durante a semana, verificar qual mercado abre a seguir
  if (gmtHours < CONFIG.MARKET_HOURS.TOKYO_OPEN) return `Hoje ${CONFIG.MARKET_HOURS.TOKYO_OPEN}:00 GMT (Tóquio)`;
  if (gmtHours < CONFIG.MARKET_HOURS.LONDON_OPEN) return `Hoje ${CONFIG.MARKET_HOURS.LONDON_OPEN}:00 GMT (Londres)`;
  if (gmtHours < CONFIG.MARKET_HOURS.NY_OPEN) return `Hoje ${CONFIG.MARKET_HOURS.NY_OPEN}:00 GMT (Nova York)`;
  if (gmtHours < CONFIG.MARKET_HOURS.SYDNEY_OPEN) return `Hoje ${CONFIG.MARKET_HOURS.SYDNEY_OPEN}:00 GMT (Sydney)`;
  
  // Se todos os mercados já fecharam, próximo é Tóquio no dia seguinte
  const nextDay = new Date(now);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return `${nextDay.toLocaleDateString()} 00:00 GMT (Tóquio)`;
}

// =============================================
// ATUALIZAÇÃO DA FUNÇÃO avaliarTendencia
// =============================================
function avaliarTendencia(closes, highs, lows, emaCurta, emaLonga, ema200) {
  if (closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  // Verificar lateralidade primeiro
  if (detectarMercadoLateral(closes)) {
    state.contadorLaterais++;
    return "LATERAL";
  }
  
  state.contadorLaterais = 0;
  
  const ultimoClose = closes[closes.length - 1];
  const penultimoClose = closes[closes.length - 2];
  
  // Calcular SuperTrend para tendência
  const superTrend = calcularSuperTrend(highs, lows, closes);
  const currentSuperTrendDirection = superTrend.direction[superTrend.direction.length - 1];
  
  // Verificar divergência entre EMAs e SuperTrend
  const emaDirection = emaCurta > emaLonga ? 'up' : 'down';
  const trendConflict = emaDirection !== currentSuperTrendDirection;
  
  // Se houver conflito entre indicadores, tendência neutra
  if (trendConflict) return "NEUTRA";
  
  // Análise combinada de EMAs e SuperTrend
  const diffEMAs = emaCurta - emaLonga;
  const threshold = 0.0005 * (1 + (CONFIG.LIMIARES.ATR_LIMIAR / ultimoClose));
  
  if (currentSuperTrendDirection === 'up' && emaCurta > emaLonga && diffEMAs > threshold) {
    if (ultimoClose > ema200 && emaLonga > ema200) {
      return "FORTE_ALTA";
    }
    return "ALTA";
  }
  
  if (currentSuperTrendDirection === 'down' && emaCurta < emaLonga && diffEMAs < -threshold) {
    if (ultimoClose < ema200 && emaLonga < ema200) {
      return "FORTE_BAIXA";
    }
    return "BAIXA";
  }
  
  return "NEUTRA";
}

// =============================================
// ATUALIZAÇÃO DA FUNÇÃO calcularScore
// =============================================
function calcularScore(indicadores) {
  let score = 50;

  // Verificação de exaustão (novo)
  const exaustaoCompra = indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && 
                         indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT &&
                         indicadores.close > indicadores.vwap * (1 + CONFIG.LIMIARES.VWAP_DESVIO);
  
  const exaustaoVenda = indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD && 
                        indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD &&
                        indicadores.close < indicadores.vwap * (1 - CONFIG.LIMIARES.VWAP_DESVIO);

  // Análise de RSI com filtro de exaustão
  if (!exaustaoVenda && indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) {
    score += 25 * CONFIG.PESOS.RSI;
    if (indicadores.tendencia.includes("BAIXA")) score -= 10;
  }
  else if (!exaustaoCompra && indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) {
    score -= 25 * CONFIG.PESOS.RSI;
    if (indicadores.tendencia.includes("ALTA")) score += 10;
  }
  else if (indicadores.rsi < 45) score += 10 * CONFIG.PESOS.RSI;
  else if (indicadores.rsi > 55) score -= 10 * CONFIG.PESOS.RSI;

  // Análise MACD com confirmação de tendência
  score += (Math.min(Math.max(indicadores.macd.histograma * 10, -15), 15) * CONFIG.PESOS.MACD);
  
  // Adicionar peso do SuperTrend (novo)
  const superTrend = calcularSuperTrend(indicadores.highs, indicadores.lows, indicadores.closes);
  const currentTrend = superTrend.direction[superTrend.direction.length - 1];
  
  if (currentTrend === 'up') {
    score += 15 * CONFIG.PESOS.SUPERTREND;
  } else if (currentTrend === 'down') {
    score -= 15 * CONFIG.PESOS.SUPERTREND;
  }

  // Restante da função mantido com pequenos ajustes...
  // ... [o restante da função permanece igual, com os pesos atualizados]
  
  // Penalizar em caso de exaustão
  if (exaustaoCompra && indicadores.tendencia.includes("ALTA")) {
    score -= 20;
  }
  if (exaustaoVenda && indicadores.tendencia.includes("BAIXA")) {
    score += 20;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

// =============================================
// ATUALIZAÇÃO DA FUNÇÃO analisarMercado
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    atualizarInfoMercado();
    if (!state.marketOpen) {
      atualizarInterface("MERCADO FECHADO", 0);
      return;
    }
    
    const dados = await obterDadosForex();
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

    // Atualizar histórico de win/loss (novo)
    if (state.ultimoSinal && sinal !== "ESPERAR" && state.ultimoSinal !== sinal) {
      const resultado = {
        data: new Date().toLocaleString(),
        sinalAnterior: state.ultimoSinal,
        novoSinal: sinal,
        scoreAnterior: state.ultimoScore,
        novoScore: score,
        preco: indicadores.close
      };
      state.winLossHistory.push(resultado);
      state.lastTradeResult = resultado;
      
      if (state.winLossHistory.length > 20) {
        state.winLossHistory.shift();
      }
    }

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
        <li>💰 Preço: €${indicadores.close.toFixed(5)} ${
          indicadores.close>emaCurta?'🟢':'🔴'}</li>
        <li>📶 Médias: EMA${CONFIG.PERIODOS.EMA_CURTA} ${indicadores.emaCurta.toFixed(5)} | 
          EMA${CONFIG.PERIODOS.EMA_LONGA} ${indicadores.emaLonga.toFixed(5)} | 
          EMA200 ${indicadores.ema200.toFixed(5)}</li>
        <li>💹 Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)}</li>
        <li>📌 VWAP: ${indicadores.vwap.toFixed(5)} | ATR: ${indicadores.atr.toFixed(6)}</li>
        <li>🔄 SuperTrend: ${indicadores.superTrend === 'up' ? '🟢 ALTA' : '🔴 BAIXA'}</li>
        ${state.lastTradeResult ? `
        <li>📊 Último Resultado: ${state.lastTradeResult.sinalAnterior} → 
          ${state.lastTradeResult.novoSinal} @ ${state.lastTradeResult.preco.toFixed(5)}</li>
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
// ATUALIZAÇÃO DA FUNÇÃO iniciarAplicativo
// =============================================
function iniciarAplicativo() {
  const ids=['comando','score','hora','timer','criterios','ultimos','mercado-info'];
  const falt = ids.filter(id=>!document.getElementById(id));
  if (falt.length>0) { console.error("Faltam:",falt); return; }
  
  setInterval(atualizarRelogio,1000);
  sincronizarTimer();
  iniciarWebSocket();
  analisarMercado();
  
  // Adiciona botão para backtesting
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
  
  // Adiciona seção de histórico de trades
  const historySection = document.createElement('div');
  historySection.id = 'trade-history';
  historySection.className = 'history-section';
  historySection.innerHTML = `
    <h3>Histórico de Operações</h3>
    <div id="history-content"></div>
  `;
  document.body.appendChild(historySection);
}
