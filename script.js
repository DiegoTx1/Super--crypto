// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS PARA EUR/USD 2025)
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
  marketOpen: false,
  activeMarket: ""
};

const CONFIG = {
  API_ENDPOINTS: [
    "https://api.twelvedata.com",
    "https://api.frankfurter.app"
  ],
  PARES: {
    EURUSD: "EUR/USD"
  },
  // Períodos otimizados para EUR/USD em 2025
  PERIODOS: {
    RSI: 14,
    STOCH: 14,
    WILLIAMS: 14,
    EMA_CURTA: 8,      // Reduzido para capturar movimentos mais rápidos
    EMA_LONGA: 34,     // Alterado para melhor alinhamento com ciclos EUR/USD
    EMA_200: 200,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 50, // Aumentado para melhor detecção de lateralidade
    VWAP: 20,
    ATR: 14,
    ICHIMOKU_TENKAN: 9,
    ICHIMOKU_KIJUN: 26,
    ICHIMOKU_SENKOUB: 52
  },
  // Limiares ajustados para volatilidade atual do EUR/USD
  LIMIARES: {
    SCORE_ALTO: 78,    // Aumentado para reduzir falsos sinais
    SCORE_MEDIO: 68,
    RSI_OVERBOUGHT: 62, // Reduzido para EUR/USD
    RSI_OVERSOLD: 38,
    STOCH_OVERBOUGHT: 75,
    STOCH_OVERSOLD: 25,
    WILLIAMS_OVERBOUGHT: -15,
    WILLIAMS_OVERSOLD: -85,
    VOLUME_ALTO: 1.5,
    VARIACAO_LATERAL: 0.5, // Reduzido para melhor detecção
    VWAP_DESVIO: 0.0012,
    ATR_LIMIAR: 0.0008,
    ICHIMOKU_CLOUD_THICKNESS: 0.0010
  },
  // Pesos rebalanceados para estratégia 2025
  PESOS: {
    RSI: 1.3,
    MACD: 1.8,
    TENDENCIA: 2.0,    // Maior peso para tendência
    VOLUME: 0.7,
    STOCH: 1.0,
    WILLIAMS: 0.9,
    CONFIRMACAO: 1.2,
    LATERALIDADE: 2.0,  // Maior peso para evitar operar em lateral
    VWAP: 1.1,
    VOLATILIDADE: 1.0,
    ICHIMOKU: 1.5       // Novo indicador
  },
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.02,
    R_R_MINIMO: 1.8,    // Aumentado para melhor risk/reward
    ATR_MULTIPLICADOR_SL: 1.8,
    ATR_MULTIPLICADOR_TP: 3.2
  },
  // Horários de mercado atualizados
  MARKET_HOURS: {
    SYDNEY_OPEN: 22,    // 22:00 GMT
    SYDNEY_CLOSE: 6,    // 06:00 GMT
    TOKYO_OPEN: 0,      // 00:00 GMT
    TOKYO_CLOSE: 9,     // 09:00 GMT
    LONDON_OPEN: 8,     // 08:00 GMT
    LONDON_CLOSE: 17,   // 17:00 GMT
    NY_OPEN: 13,        // 13:00 GMT
    NY_CLOSE: 22        // 22:00 GMT
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
    
    // Verificar horário de mercado atualizado
    const gmtHours = now.getUTCHours();
    let activeMarket = "";
    
    const isSydneyOpen = gmtHours >= CONFIG.MARKET_HOURS.SYDNEY_OPEN || gmtHours < CONFIG.MARKET_HOURS.SYDNEY_CLOSE;
    const isTokyoOpen = gmtHours >= CONFIG.MARKET_HOURS.TOKYO_OPEN && gmtHours < CONFIG.MARKET_HOURS.TOKYO_CLOSE;
    const isLondonOpen = gmtHours >= CONFIG.MARKET_HOURS.LONDON_OPEN && gmtHours < CONFIG.MARKET_HOURS.LONDON_CLOSE;
    const isNYOpen = gmtHours >= CONFIG.MARKET_HOURS.NY_OPEN && gmtHours < CONFIG.MARKET_HOURS.NY_CLOSE;
    
    state.marketOpen = isSydneyOpen || isTokyoOpen || isLondonOpen || isNYOpen;
    
    if (isLondonOpen && isNYOpen) activeMarket = "LON/NY";
    else if (isLondonOpen) activeMarket = "LON";
    else if (isNYOpen) activeMarket = "NY";
    else if (isTokyoOpen) activeMarket = "TKY";
    else if (isSydneyOpen) activeMarket = "SYD";
    
    state.activeMarket = activeMarket;
    
    const marketStatusElement = document.getElementById("market-status");
    if (marketStatusElement) {
      marketStatusElement.textContent = state.marketOpen 
        ? `MERCADO ABERTO (${activeMarket})` 
        : "MERCADO FECHADO";
      marketStatusElement.className = state.marketOpen ? "market-open" : "market-closed";
    }
    
    if (!state.marketOpen) {
      document.getElementById("comando").textContent = "MERCADO FECHADO";
      document.getElementById("comando").className = "esperar";
    }
  }
}

// =============================================
// NOVOS INDICADORES (ICHIMOKU)
// =============================================
function calcularIchimoku(dados, tenkan = CONFIG.PERIODOS.ICHIMOKU_TENKAN, 
                         kijun = CONFIG.PERIODOS.ICHIMOKU_KIJUN,
                         senkoub = CONFIG.PERIODOS.ICHIMOKU_SENKOUB) {
  if (!Array.isArray(dados) || dados.length < senkoub) return null;
  
  // Tenkan-sen (Conversion Line)
  const tenkanHigh = Math.max(...dados.slice(-tenkan).map(v => v.high));
  const tenkanLow = Math.min(...dados.slice(-tenkan).map(v => v.low));
  const tenkanSen = (tenkanHigh + tenkanLow) / 2;
  
  // Kijun-sen (Base Line)
  const kijunHigh = Math.max(...dados.slice(-kijun).map(v => v.high));
  const kijunLow = Math.min(...dados.slice(-kijun).map(v => v.low));
  const kijunSen = (kijunHigh + kijunLow) / 2;
  
  // Senkou Span A (Leading Span A)
  const senkouA = (tenkanSen + kijunSen) / 2;
  
  // Senkou Span B (Leading Span B)
  const senkouBHigh = Math.max(...dados.slice(-senkoub).map(v => v.high));
  const senkouBLow = Math.min(...dados.slice(-senkoub).map(v => v.low));
  const senkouB = (senkouBHigh + senkouBLow) / 2;
  
  // Cloud thickness
  const cloudThickness = Math.abs(senkouA - senkouB);
  
  return {
    tenkanSen,
    kijunSen,
    senkouA,
    senkouB,
    cloudThickness,
    cloudTop: Math.max(senkouA, senkouB),
    cloudBottom: Math.min(senkouA, senkouB),
    priceInCloud: dados[dados.length-1].close >= Math.min(senkouA, senkouB) && 
                 dados[dados.length-1].close <= Math.max(senkouA, senkouB)
  };
}

// =============================================
// SISTEMA DE DECISÃO (ATUALIZADO PARA 2025)
// =============================================
function avaliarTendencia(closes, dadosCompletos, emaCurta, emaLonga, ema200) {
  if (closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  // Verificação de lateralidade mais robusta
  if (detectarMercadoLateral(closes)) {
    state.contadorLaterais++;
    return "LATERAL";
  }
  
  state.contadorLaterais = 0;
  
  const ultimoClose = closes[closes.length - 1];
  const penultimoClose = closes[closes.length - 2];
  
  // Análise Ichimoku
  const ichimoku = calcularIchimoku(dadosCompletos);
  let ichimokuSignal = "NEUTRA";
  
  if (ichimoku) {
    if (ultimoClose > ichimoku.cloudTop && 
        emaCurta > emaLonga && 
        ichimoku.tenkanSen > ichimoku.kijunSen) {
      ichimokuSignal = "FORTE_ALTA";
    } else if (ultimoClose < ichimoku.cloudBottom && 
               emaCurta < emaLonga && 
               ichimoku.tenkanSen < ichimoku.kijunSen) {
      ichimokuSignal = "FORTE_BAIXA";
    } else if (ichimoku.priceInCloud) {
      ichimokuSignal = "NEUTRA";
    }
  }
  
  // Combinação de EMA e Ichimoku
  const diffEMAs = emaCurta - emaLonga;
  const threshold = 0.0005;
  
  if (ichimokuSignal === "FORTE_ALTA" || 
      (ultimoClose > emaCurta && diffEMAs > threshold && 
       ultimoClose > penultimoClose && ultimoClose > ema200)) {
    return "FORTE_ALTA";
  }
  
  if (ichimokuSignal === "FORTE_BAIXA" || 
      (ultimoClose < emaCurta && diffEMAs < -threshold && 
       ultimoClose < penultimoClose && ultimoClose < ema200)) {
    return "FORTE_BAIXA";
  }
  
  if (ultimoClose > emaCurta && diffEMAs > threshold/2) {
    return "ALTA";
  }
  
  if (ultimoClose < emaCurta && diffEMAs < -threshold/2) {
    return "BAIXA";
  }
  
  return "NEUTRA";
}

function calcularScore(indicadores) {
  let score = 50;

  // Análise combinada RSI + Williams
  if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD && 
      indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) {
    score += 30 * (CONFIG.PESOS.RSI + CONFIG.PESOS.WILLIAMS) / 2;
  } else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && 
             indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) {
    score -= 30 * (CONFIG.PESOS.RSI + CONFIG.PESOS.WILLIAMS) / 2;
  }

  // Análise MACD com filtro de tendência
  score += (Math.min(Math.max(indicadores.macd.histograma * 12, -15), 15) * CONFIG.PESOS.MACD;
  if (Math.sign(indicadores.macd.histograma) !== Math.sign(indicadores.macd.macdLinha)) {
    score -= 5; // Penalizar divergência
  }

  // Análise de Tendência com Ichimoku
  switch(indicadores.tendencia) {
    case "FORTE_ALTA": 
      if (indicadores.ichimoku && indicadores.close > indicadores.ichimoku.cloudTop) {
        score += 25 * CONFIG.PESOS.TENDENCIA;
      } else {
        score += 18 * CONFIG.PESOS.TENDENCIA;
      }
      break;
    case "ALTA": 
      score += 12 * CONFIG.PESOS.TENDENCIA; 
      break;
    case "FORTE_BAIXA": 
      if (indicadores.ichimoku && indicadores.close < indicadores.ichimoku.cloudBottom) {
        score -= 25 * CONFIG.PESOS.TENDENCIA;
      } else {
        score -= 18 * CONFIG.PESOS.TENDENCIA;
      }
      break;
    case "BAIXA": 
      score -= 12 * CONFIG.PESOS.TENDENCIA; 
      break;
    case "LATERAL": 
      score -= Math.min(state.contadorLaterais * 2, 15) * CONFIG.PESOS.LATERALIDADE;
      break;
  }

  // Análise de Volume com filtro de horário
  if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
    const volumeImpact = state.activeMarket.includes("NY") || state.activeMarket.includes("LON") ? 10 : 5;
    score += (indicadores.tendencia.includes("ALTA") ? volumeImpact : -volumeImpact) * CONFIG.PESOS.VOLUME;
  }

  // Análise Ichimoku
  if (indicadores.ichimoku) {
    if (indicadores.ichimoku.tenkanSen > indicadores.ichimoku.kijunSen && 
        indicadores.close > indicadores.ichimoku.cloudTop) {
      score += 15 * CONFIG.PESOS.ICHIMOKU;
    } else if (indicadores.ichimoku.tenkanSen < indicadores.ichimoku.kijunSen && 
               indicadores.close < indicadores.ichimoku.cloudBottom) {
      score -= 15 * CONFIG.PESOS.ICHIMOKU;
    }
    
    if (indicadores.ichimoku.cloudThickness > CONFIG.LIMIARES.ICHIMOKU_CLOUD_THICKNESS) {
      score += 5 * CONFIG.PESOS.ICHIMOKU;
    }
  }

  // Confirmações adicionais
  const confirmacoes = [
    indicadores.rsi < 40 || indicadores.rsi > 60,
    Math.abs(indicadores.macd.histograma) > 0.05,
    indicadores.stoch.k < 30 || indicadores.stoch.k > 70,
    indicadores.williams < -70 || indicadores.williams > -30,
    indicadores.tendencia !== "LATERAL",
    (indicadores.ichimoku && !indicadores.ichimoku.priceInCloud)
  ].filter(Boolean).length;

  score += confirmacoes * 4 * CONFIG.PESOS.CONFIRMACAO;

  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia) {
  if (tendencia === "LATERAL") {
    return "ESPERAR"; // Não opera mais em mercados laterais
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
    // Requer confirmação adicional para médio score
    if (tendencia === "FORTE_ALTA" || tendencia === "FORTE_BAIXA") {
      return tendencia.includes("ALTA") ? "CALL" : "PUT";
    }
    return "ESPERAR";
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

    const emaCurtaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const emaLongaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema200Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200);
    const emaCurta = emaCurtaArray.slice(-1)[0] || 0;
    const emaLonga = emaLongaArray.slice(-1)[0] || 0;
    const ema200 = ema200Array.slice(-1)[0] || 0;

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
      ichimoku: calcularIchimoku(dados),
      close: velaAtual.close,
      tendencia: avaliarTendencia(closes, dados, emaCurta, emaLonga, ema200)
    };

    const score = calcularScore(indicadores);
    const sinal = determinarSinal(score, indicadores.tendencia);

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
          indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : ''}</li>
        <li>📊 MACD: ${indicadores.macd.histograma.toFixed(6)} ${
          indicadores.macd.histograma>0?'🟢':'🔴'}</li>
        <li>☁️ Ichimoku: ${indicadores.ichimoku ? 
          `${indicadores.close > indicadores.ichimoku.cloudTop ? 'Acima' : 
            indicadores.close < indicadores.ichimoku.cloudBottom ? 'Abaixo' : 'Dentro'} da Nuvem` : 'N/A'}</li>
        <li>📈 Stochastic K/D: ${indicadores.stoch.k.toFixed(2)}/${indicadores.stoch.d.toFixed(2)}</li>
        <li>💰 Preço: €${indicadores.close.toFixed(5)} ${
          indicadores.close>emaCurta?'🟢':'🔴'}</li>
        <li>📶 Médias: EMA${CONFIG.PERIODOS.EMA_CURTA} ${indicadores.emaCurta.toFixed(5)} | EMA${CONFIG.PERIODOS.EMA_LONGA} ${indicadores.emaLonga.toFixed(5)}</li>
        <li>💹 Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)}</li>
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
// INICIALIZAÇÃO (ATUALIZADA)
// =============================================
function iniciarAplicativo() {
  // Adiciona elemento de status do mercado
  const marketStatusElement = document.createElement('div');
  marketStatusElement.id = 'market-status';
  marketStatusElement.style.margin = '10px 0';
  marketStatusElement.style.fontWeight = 'bold';
  document.querySelector('.coluna-esquerda').prepend(marketStatusElement);
  
  // Remove histórico WIN/LOSS
  const historicoElement = document.querySelector('button[onclick="registrar(\'WIN\')"]').parentNode;
  historicoElement.remove();
  
  setInterval(atualizarRelogio,1000);
  sincronizarTimer();
  analisarMercado();
}

if(document.readyState==="complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
