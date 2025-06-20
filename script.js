// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS PARA CRYPTO INDEX)
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
  noticiasRecentes: []
};

const CONFIG = {
  API_ENDPOINTS: [
    "https://api.twelvedata.com",
    "https://min-api.cryptocompare.com",
    "https://api.coingecko.com/api/v3"
  ],
  WS_ENDPOINT: "wss://stream.twelvedata.com/v1/quotes/price",
  PARES: {
    CRYPTO_IDX: "BTC/USD"  // Alterado para Crypto Index (Bitcoin como proxy)
  },
  PERIODOS: {
    RSI: 10,               // Período reduzido para maior sensibilidade
    STOCH: 11,
    WILLIAMS: 14,
    EMA_CURTA: 8,          // Sequência de Fibonacci
    EMA_MEDIA: 21,
    EMA_LONGA: 34,
    EMA_200: 200,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 10,
    MACD_LENTA: 21,
    MACD_SINAL: 8,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 30,
    VWAP: 20,
    ATR: 11,
    SUPERTREND: 10,        // Novo indicador
    VOLUME_PROFILE: 50     // Novo indicador
  },
  LIMIARES: {
    SCORE_ALTO: 82,        // Limiar elevado para cripto
    SCORE_MEDIO: 68,
    RSI_OVERBOUGHT: 68,
    RSI_OVERSOLD: 32,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    WILLIAMS_OVERBOUGHT: -15,
    WILLIAMS_OVERSOLD: -85,
    VOLUME_ALTO: 1.8,      // Volume mais significativo em cripto
    VARIACAO_LATERAL: 0.4, // REDUZIDO para detectar menos laterais
    VWAP_DESVIO: 0.025,
    ATR_LIMIAR: 0.04,      // AUMENTADO para maior sensibilidade
    SUPERTREND_SENSIBILIDADE: 2.5
  },
  PESOS: {
    RSI: 1.6,
    MACD: 2.0,
    TENDENCIA: 2.0,        // Peso maior para tendência
    VOLUME: 1.2,           // Volume mais importante em cripto
    STOCH: 1.1,
    WILLIAMS: 1.0,
    CONFIRMACAO: 1.2,
    LATERALIDADE: 1.5,
    VWAP: 1.2,
    VOLATILIDADE: 1.4,
    SUPERTREND: 1.8,       // Novo peso
    VOLUME_PROFILE: 1.3,   // Novo peso
    DIVERGENCIA: 1.7       // Novo peso
  },
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.01, // Risco reduzido para cripto
    R_R_MINIMO: 2.0,
    ATR_MULTIPLICADOR_SL: 2.0,
    ATR_MULTIPLICADOR_TP: 4
  },
  MARKET_HOURS: {
    CRYPTO_OPEN: 0,        // Mercado 24/7
    CRYPTO_CLOSE: 24
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
    
    // Mercado de cripto opera 24/7
    state.marketOpen = true;
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

function rotacionarApiKey() {
  state.currentApiKeyIndex = (state.currentApiKeyIndex + 1) % state.apiKeys.length;
  return state.apiKeys[state.currentApiKeyIndex];
}

// =============================================
// INDICADORES TÉCNICOS (ATUALIZADOS PARA CRYPTO 2025)
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

function calcularVWAP(dados, periodo = CONFIG.PERIODOS.VWAP) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo) return 0;
    
    const slice = dados.slice(-periodo);
    let typicalPriceSum = 0;
    let volumeSum = 0;
    
    for (const vela of slice) {
      const typicalPrice = (vela.high + vela.low + vela.close) / 3;
      typicalPriceSum += typicalPrice * vela.volume;
      volumeSum += vela.volume;
    }
    
    return volumeSum > 0 ? typicalPriceSum / volumeSum : 0;
  } catch (e) {
    console.error("Erro no cálculo VWAP:", e);
    return 0;
  }
}

function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo + 1) return 0;
    
    const trValues = [];
    for (let i = 1; i < dados.length; i++) {
      const tr = Math.max(
        dados[i].high - dados[i].low,
        Math.abs(dados[i].high - dados[i-1].close),
        Math.abs(dados[i].low - dados[i-1].close)
      );
      trValues.push(tr);
    }
    
    return calcularMedia.simples(trValues.slice(-periodo), periodo);
  } catch (e) {
    console.error("Erro no cálculo ATR:", e);
    return 0;
  }
}

// SuperTrend (indicador essencial para cripto em 2025)
function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = CONFIG.LIMIARES.SUPERTREND_SENSIBILIDADE) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo) return { direcao: 0, valor: 0 };
    
    const atr = calcularATR(dados, periodo);
    const ultimo = dados[dados.length - 1];
    const hl2 = (ultimo.high + ultimo.low) / 2;
    
    const upperBand = hl2 + (multiplicador * atr);
    const lowerBand = hl2 - (multiplicador * atr);
    
    let direcao = 1;
    let superTrend = upperBand;
    
    if (dados.length > periodo) {
      const prev = dados[dados.length - 2];
      const prevClose = prev.close;
      
      // Lógica revisada para evitar flip-flop
      if (prevClose > (prev.superTrend || upperBand)) {
        direcao = 1;
        superTrend = Math.min(upperBand, prev.superTrend || upperBand);
      } else if (prevClose < (prev.superTrend || lowerBand)) {
        direcao = -1;
        superTrend = Math.max(lowerBand, prev.superTrend || lowerBand);
      } else {
        // Manter direção atual
        direcao = prev.direcao || 1;
        superTrend = prev.superTrend || upperBand;
      }
    }
    
    return { direcao, valor: superTrend };
  } catch (e) {
    console.error("Erro no cálculo SuperTrend:", e);
    return { direcao: 0, valor: 0 };
  }
}

// Volume Profile (áreas de valor)
function calcularVolumeProfile(dados, periodo = CONFIG.PERIODOS.VOLUME_PROFILE) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo) return { pvp: 0, vaHigh: 0, vaLow: 0 };
    
    const slice = dados.slice(-periodo);
    const volumePorPreco = {};
    
    for (const vela of slice) {
      const range = [vela.low, vela.high].sort((a, b) => a - b);
      const passo = (range[1] - range[0]) / 10;
      
      for (let p = range[0]; p <= range[1]; p += passo) {
        const nivel = p.toFixed(2);
        volumePorPreco[nivel] = (volumePorPreco[nivel] || 0) + vela.volume;
      }
    }
    
    const niveis = Object.entries(volumePorPreco).sort((a, b) => b[1] - a[1]);
    const pvp = parseFloat(niveis[0][0]);
    const vaHigh = parseFloat(niveis[Math.floor(niveis.length * 0.3)][0]);
    const vaLow = parseFloat(niveis[Math.floor(niveis.length * 0.7)][0]);
    
    return { pvp, vaHigh, vaLow };
  } catch (e) {
    console.error("Erro no cálculo Volume Profile:", e);
    return { pvp: 0, vaHigh: 0, vaLow: 0 };
  }
}

// Detectar divergências (exaustão de tendência)
function detectarDivergencias(closes, rsis, highs, lows) {
  try {
    if (closes.length < 5 || rsis.length < 5) return { divergenciaRSI: false, divergenciaPreco: false };
    
    const ultimosCloses = closes.slice(-5);
    const ultimosRSIs = rsis.slice(-5);
    const ultimosHighs = highs.slice(-5);
    const ultimosLows = lows.slice(-5);
    
    // Divergência de alta: preço faz fundo mais baixo, RSI faz fundo mais alto
    const baixaPreco = ultimosLows[0] < ultimosLows[2] && ultimosLows[2] < ultimosLows[4];
    const altaRSI = ultimosRSIs[0] > ultimosRSIs[2] && ultimosRSIs[2] > ultimosRSIs[4];
    const divergenciaAlta = baixaPreco && altaRSI;
    
    // Divergência de baixa: preço faz topo mais alto, RSI faz topo mais baixo
    const altaPreco = ultimosHighs[0] > ultimosHighs[2] && ultimosHighs[2] > ultimosHighs[4];
    const baixaRSI = ultimosRSIs[0] < ultimosRSIs[2] && ultimosRSIs[2] < ultimosRSIs[4];
    const divergenciaBaixa = altaPreco && baixaRSI;
    
    return {
      divergenciaRSI: divergenciaAlta || divergenciaBaixa,
      tipoDivergencia: divergenciaAlta ? "ALTA" : divergenciaBaixa ? "BAIXA" : "NENHUMA"
    };
  } catch (e) {
    console.error("Erro na detecção de divergências:", e);
    return { divergenciaRSI: false, divergenciaPreco: false };
  }
}

// =============================================
// SISTEMA DE DETECÇÃO DE TENDÊNCIA (REVISADO)
// =============================================
function avaliarTendencia(closes, emaCurta, emaMedia, emaLonga, ema200, superTrend, atr, volume, volumeMedia) {
  if (closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  const ultimoClose = closes[closes.length - 1];
  const volumeForte = volume > volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.5;
  
  // 1. Sistema hierárquico de detecção de tendência
  const tendenciaSuperTrend = superTrend.direcao > 0 ? "ALTA" : "BAIXA";
  
  // 2. Força da tendência baseada em múltiplos fatores
  let forca = 0;
  
  // Fator 1: Posição relativa às EMAs
  if (ultimoClose > emaCurta && emaCurta > emaMedia && emaMedia > emaLonga) forca += 3;
  else if (ultimoClose < emaCurta && emaCurta < emaMedia && emaMedia < emaLonga) forca += 3;
  
  // Fator 2: Distância da EMA 200
  const distanciaEMA200 = Math.abs(ultimoClose - ema200) / ema200;
  if (distanciaEMA200 > 0.03) forca += 2;
  
  // Fator 3: Volume forte na direção da tendência
  if (volumeForte) forca += 2;
  
  // Fator 4: Confirmação do SuperTrend
  if ((tendenciaSuperTrend === "ALTA" && ultimoClose > superTrend.valor * 1.005) ||
      (tendenciaSuperTrend === "BAIXA" && ultimoClose < superTrend.valor * 0.995)) {
    forca += 2;
  }
  
  // 3. Verificar se o mercado está lateral (critérios mais restritos)
  if (detectarMercadoLateral(closes, atr)) {
    state.contadorLaterais++;
    // Só classificar como lateral se não houver tendência forte
    if (forca < 4) return "LATERAL";
  }
  
  state.contadorLaterais = 0;
  
  // 4. Classificação final da tendência
  if (forca >= 6) {
    return tendenciaSuperTrend === "ALTA" ? "FORTE_ALTA" : "FORTE_BAIXA";
  }
  
  if (forca >= 4) {
    return tendenciaSuperTrend;
  }
  
  // 5. Tendência fraca ou divergências
  const tendenciaBasica = emaCurta > emaMedia ? "ALTA" : "BAIXA";
  
  return tendenciaBasica;
}

function detectarMercadoLateral(closes, atr) {
  if (closes.length < CONFIG.PERIODOS.ANALISE_LATERAL) return false;
  
  const ultimosPrecos = closes.slice(-CONFIG.PERIODOS.ANALISE_LATERAL);
  const maximo = Math.max(...ultimosPrecos);
  const minimo = Math.min(...ultimosPrecos);
  const variacao = ((maximo - minimo) / minimo) * 100;
  
  // Critério mais restrito para lateralidade
  return variacao < (CONFIG.LIMIARES.VARIACAO_LATERAL * atr * 100);
}

// =============================================
// SISTEMA DE DECISÃO (ATUALIZADO PARA CRYPTO 2025)
// =============================================
function calcularScore(indicadores, divergencias) {
  let score = 50;

  // Análise de RSI com detecção de divergência
  if (divergencias.divergenciaRSI) {
    score += divergencias.tipoDivergencia === "ALTA" ? 
      25 * CONFIG.PESOS.DIVERGENCIA : 
      -25 * CONFIG.PESOS.DIVERGENCIA;
  } else {
    if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) {
      score += 25 * CONFIG.PESOS.RSI;
    } else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) {
      score -= 25 * CONFIG.PESOS.RSI;
    } else if (indicadores.rsi < 45) score += 10 * CONFIG.PESOS.RSI;
    else if (indicadores.rsi > 55) score -= 10 * CONFIG.PESOS.RSI;
  }

  // Análise MACD
  score += (Math.min(Math.max(indicadores.macd.histograma * 10, -15), 15) * CONFIG.PESOS.MACD);

  // Análise de Tendência (peso maior para tendências fortes)
  switch(indicadores.tendencia) {
    case "FORTE_ALTA": 
      score += 30 * CONFIG.PESOS.TENDENCIA;
      if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.5) score += 10;
      break;
    case "ALTA": score += 15 * CONFIG.PESOS.TENDENCIA; break;
    case "FORTE_BAIXA": 
      score -= 30 * CONFIG.PESOS.TENDENCIA;
      if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.5) score -= 10;
      break;
    case "BAIXA": score -= 15 * CONFIG.PESOS.TENDENCIA; break;
    case "LATERAL": 
      score -= Math.min(state.contadorLaterais, 15) * CONFIG.PESOS.LATERALIDADE * 1.2;
      break;
  }

  // Análise de Volume
  if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
    score += (indicadores.tendencia.includes("ALTA") ? 10 : -10) * CONFIG.PESOS.VOLUME;
  }

  // Análise Stochastic
  if (indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && 
      indicadores.stoch.d < CONFIG.LIMIARES.STOCH_OVERSOLD) {
    score += 12 * CONFIG.PESOS.STOCH;
  }
  if (indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && 
      indicadores.stoch.d > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
    score -= 12 * CONFIG.PESOS.STOCH;
  }

  // Análise Williams
  if (indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) {
    score += 10 * CONFIG.PESOS.WILLIAMS; 
  }
  if (indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) {
    score -= 10 * CONFIG.PESOS.WILLIAMS; 
  }

  // Análise VWAP
  const vwapDesvio = Math.abs(indicadores.close - indicadores.vwap) / indicadores.vwap;
  if (vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO) {
    score += (indicadores.close > indicadores.vwap ? 8 : -8) * CONFIG.PESOS.VWAP;
  }

  // Análise de Volatilidade (ATR)
  if (indicadores.atr > CONFIG.LIMIARES.ATR_LIMIAR) {
    score += 5 * CONFIG.PESOS.VOLATILIDADE;
  }

  // SuperTrend
  if (indicadores.superTrend.direcao > 0) {
    score += 10 * CONFIG.PESOS.SUPERTREND;
  } else if (indicadores.superTrend.direcao < 0) {
    score -= 10 * CONFIG.PESOS.SUPERTREND;
  }

  // Volume Profile
  if (indicadores.close > indicadores.volumeProfile.vaHigh) {
    score += 8 * CONFIG.PESOS.VOLUME_PROFILE;
  } else if (indicadores.close < indicadores.volumeProfile.vaLow) {
    score -= 8 * CONFIG.PESOS.VOLUME_PROFILE;
  }

  // Confirmações
  const confirmacoes = [
    indicadores.rsi < 40 || indicadores.rsi > 60,
    Math.abs(indicadores.macd.histograma) > 0.05,
    indicadores.stoch.k < 30 || indicadores.stoch.k > 70,
    indicadores.williams < -70 || indicadores.williams > -30,
    indicadores.tendencia !== "LATERAL",
    vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO * 0.8,
    indicadores.superTrend.direcao !== 0
  ].filter(Boolean).length;

  score += confirmacoes * 5 * CONFIG.PESOS.CONFIRMACAO;

  // Filtro de notícias recentes
  if (state.noticiasRecentes.some(noticia => 
      noticia.sentiment === "negative" && Date.now() - noticia.timestamp < 300000)) {
    score -= 15;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia, divergencias) {
  // Priorizar divergências
  if (divergencias.divergenciaRSI) {
    return divergencias.tipoDivergencia === "ALTA" ? "CALL" : "PUT";
  }
  
  // Tendências fortes têm prioridade
  if (tendencia === "FORTE_ALTA" && score >= CONFIG.LIMIARES.SCORE_MEDIO) return "CALL";
  if (tendencia === "FORTE_BAIXA" && score >= CONFIG.LIMIARES.SCORE_MEDIO) return "PUT";
  
  // Tendências médias exigem score mais alto
  if (tendencia === "ALTA" && score >= CONFIG.LIMIARES.SCORE_ALTO) return "CALL";
  if (tendencia === "BAIXA" && score >= CONFIG.LIMIARES.SCORE_ALTO) return "PUT";
  
  // Lateralidade exige score muito alto
  if (tendencia === "LATERAL" && score > 88) return "CALL";
  
  return "ESPERAR";
}

// =============================================
// CORE DO SISTEMA (ATUALIZADO PARA CRYPTO)
// =============================================
async function obterDadosCrypto() {
  for (const endpoint of CONFIG.API_ENDPOINTS) {
    try {
      let response, dados;
      if (endpoint.includes('twelvedata')) {
        const apiKey = rotacionarApiKey();
        response = await fetch(`${endpoint}/time_series?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1min&outputsize=150&apikey=${apiKey}`);
        if (!response.ok) continue;
        dados = await response.json();
        if (dados.values && Array.isArray(dados.values)) {
          return dados.values.map(v => ({
            time: v.datetime,
            open: parseFloat(v.open),
            high: parseFloat(v.high),
            low: parseFloat(v.low),
            close: parseFloat(v.close),
            volume: parseFloat(v.volume)
          })).reverse();
        }
      } else if (endpoint.includes('cryptocompare')) {
        response = await fetch(`${endpoint}/data/v2/histominute?fsym=BTC&tsym=USD&limit=150`);
        if (!response.ok) continue;
        dados = await response.json();
        if (dados.Data && dados.Data.Data) {
          return dados.Data.Data.map(v => ({
            time: new Date(v.time * 1000).toISOString(),
            open: v.open,
            high: v.high,
            low: v.low,
            close: v.close,
            volume: v.volumefrom
          }));
        }
      } else if (endpoint.includes('coingecko')) {
        response = await fetch(`${endpoint}/coins/bitcoin/market_chart?vs_currency=usd&days=1&interval=minute`);
        if (!response.ok) continue;
        dados = await response.json();
        if (dados.prices) {
          return dados.prices.map((v, i) => ({
            time: new Date(v[0]).toISOString(),
            open: i > 0 ? dados.prices[i-1][1] : v[1],
            high: v[1] * 1.001, // Aproximação
            low: v[1] * 0.999,  // Aproximação
            close: v[1],
            volume: dados.total_volumes[i][1]
          })).slice(-150);
        }
      }
    } catch (e) {
      console.error(`Erro no endpoint ${endpoint}:`, e);
    }
  }
  throw new Error("Todos os endpoints falharam");
}

async function buscarNoticiasCrypto() {
  try {
    const response = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC,ETH,CRYPTO');
    if (!response.ok) return [];
    
    const dados = await response.json();
    return dados.Data.slice(0, 5).map(noticia => ({
      title: noticia.title,
      sentiment: noticia.sentiment,
      timestamp: noticia.published_on * 1000
    }));
  } catch (e) {
    console.error("Erro ao buscar notícias:", e);
    return [];
  }
}

async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  try {
    // Buscar notícias recentes
    state.noticiasRecentes = await buscarNoticiasCrypto();
    
    const dados = await obterDadosCrypto();
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    const emaCurtaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const emaMediaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA);
    const emaLongaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema200Array  = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200);
    const emaCurta = emaCurtaArray.slice(-1)[0] || 0;
    const emaMedia = emaMediaArray.slice(-1)[0] || 0;
    const emaLonga = emaLongaArray.slice(-1)[0] || 0;
    const ema200   = ema200Array.slice(-1)[0] || 0;

    const atr = calcularATR(dados);
    const superTrend = calcularSuperTrend(dados);
    const volumeProfile = calcularVolumeProfile(dados);
    const divergencias = detectarDivergencias(closes, dados.map((_, i) => calcularRSI(closes.slice(0, i+1))), highs, lows);
    const volumeMedia = calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME) || 1;

    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      emaCurta,
      emaMedia,
      emaLonga,
      ema200,
      volume: velaAtual.volume,
      volumeMedia,
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      vwap: calcularVWAP(dados),
      atr,
      superTrend,
      volumeProfile,
      close: velaAtual.close,
      tendencia: avaliarTendencia(
        closes, 
        emaCurta, 
        emaMedia, 
        emaLonga, 
        ema200, 
        superTrend, 
        atr,
        velaAtual.volume,
        volumeMedia
      )
    };

    const score = calcularScore(indicadores, divergencias);
    const sinal = determinarSinal(score, indicadores.tendencia, divergencias);

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
        <li>💰 Preço: $${indicadores.close.toFixed(2)} ${
          indicadores.close>emaCurta?'🟢':'🔴'}</li>
        <li>📶 Médias: EMA${CONFIG.PERIODOS.EMA_CURTA} ${indicadores.emaCurta.toFixed(2)} | EMA${CONFIG.PERIODOS.EMA_MEDIA} ${indicadores.emaMedia.toFixed(2)} | EMA${CONFIG.PERIODOS.EMA_LONGA} ${indicadores.emaLonga.toFixed(2)}</li>
        <li>💹 Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)}</li>
        <li>📌 VWAP: ${indicadores.vwap.toFixed(2)} | ATR: ${indicadores.atr.toFixed(4)}</li>
        <li>🚦 SuperTrend: ${indicadores.superTrend.direcao>0?'ALTA':'BAIXA'} (${indicadores.superTrend.valor.toFixed(2)})</li>
        <li>📊 Volume Profile: PVP ${indicadores.volumeProfile.pvp.toFixed(2)} | VA ${indicadores.volumeProfile.vaLow.toFixed(2)}-${indicadores.volumeProfile.vaHigh.toFixed(2)}</li>
        <li>⚠️ Divergência: ${divergencias.divergenciaRSI ? divergencias.tipoDivergencia : 'Nenhuma'}</li>
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
// BACKTESTING BÁSICO (ATUALIZADO)
// =============================================
async function backtestSimples(dias = 5) {
  try {
    const apiKey = rotacionarApiKey();
    const response = await fetch(`https://api.twelvedata.com/time_series?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1min&outputsize=${dias*1440}&apikey=${apiKey}`);
    if (!response.ok) throw new Error("Falha ao obter dados históricos");
    
    const dados = await response.json();
    if (!dados.values || !Array.isArray(dados.values)) throw new Error("Formato de dados inválido");
    
    const dadosFormatados = dados.values.map(v => ({
      time: v.datetime,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseFloat(v.volume)
    })).reverse();
    
    let acertos = 0, total = 0;
    const resultados = [];
    
    for (let i = 150; i < dadosFormatados.length; i++) {
      const slice = dadosFormatados.slice(0, i);
      const closes = slice.map(v => v.close);
      const highs = slice.map(v => v.high);
      const lows = slice.map(v => v.low);
      const volumes = slice.map(v => v.volume);
      
      const emaCurta = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).slice(-1)[0];
      const emaMedia = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA).slice(-1)[0];
      const emaLonga = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA).slice(-1)[0];
      const ema200 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200).slice(-1)[0];
      const atr = calcularATR(slice);
      const superTrend = calcularSuperTrend(slice);
      const volumeMedia = calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME) || 1;
      const divergencias = detectarDivergencias(closes, closes.map((_, idx) => calcularRSI(closes.slice(0, idx+1))), highs, lows);
      
      const indicadores = {
        rsi: calcularRSI(closes),
        macd: calcularMACD(closes),
        emaCurta,
        emaMedia,
        emaLonga,
        ema200,
        volume: slice[i-1].volume,
        volumeMedia,
        stoch: calcularStochastic(highs, lows, closes),
        williams: calcularWilliams(highs, lows, closes),
        vwap: calcularVWAP(slice),
        atr,
        superTrend,
        close: slice[i-1].close,
        tendencia: avaliarTendencia(
          closes, 
          emaCurta, 
          emaMedia, 
          emaLonga, 
          ema200, 
          superTrend, 
          atr,
          slice[i-1].volume,
          volumeMedia
        )
      };
      
      const score = calcularScore(indicadores, divergencias);
      const sinal = determinarSinal(score, indicadores.tendencia, divergencias);
      
      if (sinal !== "ESPERAR") {
        total++;
        const proximoClose = dadosFormatados[i].close;
        const movimento = proximoClose > slice[i-1].close ? "CALL" : "PUT";
        
        if (sinal === movimento) acertos++;
        resultados.push({
          time: slice[i-1].time,
          sinal,
          score,
          precoEntrada: slice[i-1].close,
          precoSaida: proximoClose,
          resultado: sinal === movimento ? "ACERTO" : "ERRO"
        });
      }
    }
    
    console.log(`Backtest completo: ${acertos}/${total} (${(acertos/total*100).toFixed(2)}% de acerto)`);
    console.log("Detalhes das operações:", resultados);
    return resultados;
  } catch (e) {
    console.error("Erro no backtest:", e);
    return [];
  }
}

// =============================================
// CONTROLE DE TEMPO (MANTIDO)
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  const agora = Date.now();
  const delayProximaVela = 60000 - (agora % 60000);
  state.timer = Math.max(1, Math.floor(delayProximaVela/1000));
  const elementoTimer = document.getElementById("timer");
  if (elementoTimer) {
    elementoTimer.textContent = formatarTimer(state.timer);
    elementoTimer.style.color = state.timer<=5?'red':'';
  }
  state.intervaloAtual = setInterval(()=>{
    state.timer--;
    if (elementoTimer) {
      elementoTimer.textContent = formatarTimer(state.timer);
      elementoTimer.style.color = state.timer<=5?'red':'';
    }
    if (state.timer<=0) {
      clearInterval(state.intervaloAtual);
      analisarMercado().finally(sincronizarTimer);
    }
  },1000);
}

// =============================================
// INICIALIZAÇÃO (MANTIDA)
// =============================================
function iniciarAplicativo() {
  const ids=['comando','score','hora','timer','criterios','ultimos'];
  const falt = ids.filter(id=>!document.getElementById(id));
  if (falt.length>0) { console.error("Faltam:",falt); return; }
  
  setInterval(atualizarRelogio,1000);
  sincronizarTimer();
  analisarMercado();
  
  // Adiciona botão para backtesting (não altera a interface existente)
  const backtestBtn = document.createElement('button');
  backtestBtn.textContent = 'Executar Backtest (5 dias)';
  backtestBtn.style.position = 'fixed';
  backtestBtn.style.bottom = '10px';
  backtestBtn.style.right = '10px';
  backtestBtn.style.zIndex = '1000';
  backtestBtn.onclick = () => {
    backtestBtn.textContent = 'Calculando...';
    backtestSimples().then(() => {
      backtestBtn.textContent = 'Backtest Completo (ver console)';
      setTimeout(() => backtestBtn.textContent = 'Executar Backtest (5 dias)', 3000);
    });
  };
  document.body.appendChild(backtestBtn);
}

if(document.readyState==="complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
