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
  noticiasRecentes: [],
  volumeProfile: [],
  institutionalFlow: 0,
  fairValueGap: { gap: false },
  hiddenOrders: false,
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0
};

const CONFIG = {
  API_ENDPOINTS: [
    "https://api.twelvedata.com",
    "https://min-api.cryptocompare.com",
    "https://api.coingecko.com/api/v3",
    "https://api.cryptorank.io/v1" // Novo endpoint institucional
  ],
  WS_ENDPOINT: "wss://stream.twelvedata.com/v1/quotes/price",
  PARES: {
    CRYPTO_IDX: "BTC/USD"
  },
  PERIODOS: {
    RSI: 10,
    STOCH: 11,
    WILLIAMS: 14,
    EMA_CURTA: 8,
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
    SUPERTREND: 10,
    VOLUME_PROFILE: 50,
    LIQUIDITY_ZONES: 20,   // Novo: Zonas de liquidez
    FAIR_VALUE: 34,         // Novo: Período para Fair Value Gap
    ADX: 14                // Novo: Período para força da tendência
  },
  LIMIARES: {
    SCORE_ALTO: 82,
    SCORE_MEDIO: 68,
    RSI_OVERBOUGHT: 68,
    RSI_OVERSOLD: 32,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    WILLIAMS_OVERBOUGHT: -15,
    WILLIAMS_OVERSOLD: -85,
    VOLUME_ALTO: 1.8,
    VARIACAO_LATERAL: 1.2,
    VWAP_DESVIO: 0.025,
    ATR_LIMIAR: 0.035,
    SUPERTREND_SENSIBILIDADE: 2.5,
    INSTITUTIONAL_FLOW: 2500000, // USD (novo)
    ADX_TENDENCIA: 25            // Novo: Limiar para considerar tendência
  },
  PESOS: {
    RSI: 1.6,
    MACD: 2.0,
    TENDENCIA: 2.0,
    VOLUME: 1.2,
    STOCH: 1.1,
    WILLIAMS: 1.0,
    CONFIRMACAO: 1.2,
    LATERALIDADE: 1.5,
    VWAP: 1.2,
    VOLATILIDADE: 1.4,
    SUPERTREND: 1.8,
    VOLUME_PROFILE: 1.3,
    DIVERGENCIA: 1.7,
    LIQUIDITY: 1.8,         // Novo: Peso para zonas de liquidez
    FAIR_VALUE: 1.7,        // Novo: Peso para Fair Value Gap
    INSTITUTIONAL: 2.0,     // Novo: Peso para fluxo institucional
    ADX: 1.8                // Novo: Peso para força da tendência
  },
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.01,
    R_R_MINIMO: 2.0,
    ATR_MULTIPLICADOR_SL: 2.0,
    ATR_MULTIPLICADOR_TP: 4
  },
  MARKET_HOURS: {
    CRYPTO_OPEN: 0,
    CRYPTO_CLOSE: 24
  }
};

// =============================================
// FUNÇÕES UTILITÁRIAS (MANTIDAS)
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    const now = new Date();
    state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    elementoHora.textContent = state.ultimaAtualizacao;
    state.marketOpen = true;
  }
}

function atualizarInterface(sinal, score, tendencia, forcaTendencia) {
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
  
  const tendenciaElement = document.getElementById("tendencia");
  const forcaElement = document.getElementById("forca-tendencia");
  if (tendenciaElement && forcaElement) {
    tendenciaElement.textContent = tendencia;
    forcaElement.textContent = `${forcaTendencia}%`;
  }
}

function rotacionarApiKey() {
  state.currentApiKeyIndex = (state.currentApiKeyIndex + 1) % state.apiKeys.length;
  return state.apiKeys[state.currentApiKeyIndex];
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
      
      if (prev.close > superTrend) {
        direcao = 1;
        superTrend = Math.max(upperBand, prev.superTrend || upperBand);
      } else {
        direcao = -1;
        superTrend = Math.min(lowerBand, prev.superTrend || lowerBand);
      }
    }
    
    return { direcao, valor: superTrend };
  } catch (e) {
    console.error("Erro no cálculo SuperTrend:", e);
    return { direcao: 0, valor: 0 };
  }
}

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

// NOVO: Detectar Fair Value Gap (Ricardo Moura)
function detectarFairValueGap(velas) {
  if (velas.length < 3) return { gap: false };
  
  const ultima = velas[velas.length - 1];
  const penultima = velas[velas.length - 2];
  
  // Gap de alta
  if (ultima.low > penultima.high) {
    return { gap: true, direcao: 'ALTA', tamanho: ultima.low - penultima.high };
  } 
  // Gap de baixa
  else if (ultima.high < penultima.low) {
    return { gap: true, direcao: 'BAIXA', tamanho: penultima.low - ultima.high };
  }
  
  return { gap: false };
}

// NOVO: Calcular zonas de liquidez (Ricardo Moura)
function calcularLiquidez(velas, periodo = CONFIG.PERIODOS.LIQUIDITY_ZONES) {
  const slice = velas.slice(-periodo);
  const highNodes = [];
  const lowNodes = [];
  
  // Identificar nós de liquidez
  for (let i = 3; i < slice.length - 3; i++) {
    if (slice[i].high > slice[i-1].high && slice[i].high > slice[i+1].high) {
      highNodes.push(slice[i].high);
    }
    if (slice[i].low < slice[i-1].low && slice[i].low < slice[i+1].low) {
      lowNodes.push(slice[i].low);
    }
  }
  
  return {
    resistencia: calcularMedia.simples(highNodes, highNodes.length),
    suporte: calcularMedia.simples(lowNodes, lowNodes.length)
  };
}

// NOVO: Detectar divergências ocultas (Ricardo Moura)
function detectarDivergencias(closes, rsis, highs, lows) {
  try {
    if (closes.length < 5 || rsis.length < 5) return { divergenciaRSI: false, tipoDivergencia: "NENHUMA", divergenciaOculta: false };
    
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
    
    // Divergência oculta de alta: preço faz fundo mais alto, RSI faz fundo mais baixo
    const altaPrecoOculta = ultimosLows[0] > ultimosLows[2] && ultimosLows[2] > ultimosLows[4];
    const baixaRSIOculta = ultimosRSIs[0] < ultimosRSIs[2] && ultimosRSIs[2] < ultimosRSIs[4];
    const divergenciaOcultaAlta = altaPrecoOculta && baixaRSIOculta;
    
    // Divergência oculta de baixa: preço faz topo mais baixo, RSI faz topo mais alto
    const baixaPrecoOculta = ultimosHighs[0] < ultimosHighs[2] && ultimosHighs[2] < ultimosHighs[4];
    const altaRSIOculta = ultimosRSIs[0] > ultimosRSIs[2] && ultimosRSIs[2] > ultimosRSIs[4];
    const divergenciaOcultaBaixa = baixaPrecoOculta && altaRSIOculta;
    
    return {
      divergenciaRSI: divergenciaAlta || divergenciaBaixa,
      divergenciaOculta: divergenciaOcultaAlta || divergenciaOcultaBaixa,
      tipoDivergencia: divergenciaAlta ? "ALTA" : 
                      divergenciaBaixa ? "BAIXA" : 
                      divergenciaOcultaAlta ? "ALTA_OCULTA" : 
                      divergenciaOcultaBaixa ? "BAIXA_OCULTA" : "NENHUMA"
    };
  } catch (e) {
    console.error("Erro na detecção de divergências:", e);
    return { divergenciaRSI: false, divergenciaOculta: false, tipoDivergencia: "NENHUMA" };
  }
}

// =============================================
// DETECÇÃO DE TENDÊNCIA APRIMORADA
// =============================================
function calcularInclinacao(medias, periodo = 5) {
  if (medias.length < periodo + 1) return 0;
  
  const valores = medias.slice(-periodo);
  const somaX = periodo * (periodo - 1) / 2;
  const somaY = valores.reduce((a, b) => a + b, 0);
  const somaXY = valores.reduce((a, b, i) => a + (b * i), 0);
  const somaX2 = valores.reduce((a, b, i) => a + (i * i), 0);
  
  const numerador = periodo * somaXY - somaX * somaY;
  const denominador = periodo * somaX2 - somaX * somaX;
  
  return denominador !== 0 ? numerador / denominador : 0;
}

function calcularForcaTendencia(highs, lows, closes, periodo = CONFIG.PERIODOS.ADX) {
  if (closes.length < periodo * 2) return 0;
  
  let dmPlus = 0;
  let dmMinus = 0;
  let trSum = 0;
  
  for (let i = 1; i <= periodo; i++) {
    const idx = closes.length - i;
    const high = highs[idx];
    const low = lows[idx];
    const prevClose = closes[idx - 1];
    
    // True Range
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trSum += tr;
    
    // Directional Movement
    const upMove = high - highs[idx - 1];
    const downMove = lows[idx - 1] - low;
    
    if (upMove > downMove && upMove > 0) {
      dmPlus += upMove;
    } else if (downMove > upMove && downMove > 0) {
      dmMinus += downMove;
    }
  }
  
  const diPlus = (dmPlus / trSum) * 100;
  const diMinus = (dmMinus / trSum) * 100;
  const dx = (Math.abs(diPlus - diMinus) / (diPlus + diMinus)) * 100;
  
  return Math.min(100, Math.round(dx));
}

function avaliarTendencia(closes, highs, lows, emaCurta, emaMedia, emaLonga, ema200, superTrend, atr) {
  if (closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return { tendencia: "NEUTRA", forca: 0 };
  
  // Calcular inclinação das médias
  const inclinacaoCurta = calcularInclinacao(emaCurta);
  const inclinacaoMedia = calcularInclinacao(emaMedia);
  const inclinacaoLonga = calcularInclinacao(emaLonga);
  
  // Calcular força da tendência
  const forcaTendencia = calcularForcaTendencia(highs, lows, closes);
  
  const ultimoClose = closes[closes.length - 1];
  
  // Critérios para tendência de alta
  const criteriosAlta = [
    inclinacaoCurta > 0.1,
    inclinacaoMedia > 0.05,
    inclinacaoLonga > 0.02,
    forcaTendencia > CONFIG.LIMIARES.ADX_TENDENCIA,
    ultimoClose > emaCurta[emaCurta.length-1],
    emaCurta[emaCurta.length-1] > emaMedia[emaMedia.length-1],
    emaMedia[emaMedia.length-1] > emaLonga[emaLonga.length-1],
    superTrend.direcao > 0 && ultimoClose > superTrend.valor
  ];
  
  // Critérios para tendência de baixa
  const criteriosBaixa = [
    inclinacaoCurta < -0.1,
    inclinacaoMedia < -0.05,
    inclinacaoLonga < -0.02,
    forcaTendencia > CONFIG.LIMIARES.ADX_TENDENCIA,
    ultimoClose < emaCurta[emaCurta.length-1],
    emaCurta[emaCurta.length-1] < emaMedia[emaMedia.length-1],
    emaMedia[emaMedia.length-1] < emaLonga[emaLonga.length-1],
    superTrend.direcao < 0 && ultimoClose < superTrend.valor
  ];
  
  // Contar critérios atendidos
  const countAlta = criteriosAlta.filter(Boolean).length;
  const countBaixa = criteriosBaixa.filter(Boolean).length;
  
  // Determinar tendência
  if (countAlta >= 6) {
    return { tendencia: "FORTE_ALTA", forca: forcaTendencia };
  } else if (countBaixa >= 6) {
    return { tendencia: "FORTE_BAIXA", forca: forcaTendencia };
  } else if (countAlta >= 4) {
    return { tendencia: "ALTA", forca: forcaTendencia };
  } else if (countBaixa >= 4) {
    return { tendencia: "BAIXA", forca: forcaTendencia };
  } else if (forcaTendencia < 20) {
    state.contadorLaterais++;
    return { tendencia: "LATERAL", forca: forcaTendencia };
  }
  
  state.contadorLaterais = 0;
  return { tendencia: "NEUTRA", forca: forcaTendencia };
}

// =============================================
// SISTEMA DE DECISÃO (ATUALIZADO PARA 2025)
// =============================================
function calcularScore(indicadores, divergencias) {
  let score = 50;

  // Fator Fair Value Gap (Ricardo Moura)
  if (state.fairValueGap.gap) {
    score += state.fairValueGap.direcao === 'ALTA' ? 
      15 * CONFIG.PESOS.FAIR_VALUE : 
      -15 * CONFIG.PESOS.FAIR_VALUE;
  }
  
  // Fator de Liquidez (Ricardo Moura)
  const distanciaSuporte = Math.abs(indicadores.close - indicadores.liquidez.suporte);
  const distanciaResistencia = Math.abs(indicadores.close - indicadores.liquidez.resistencia);
  if (distanciaSuporte < distanciaResistencia) {
    score += 12 * CONFIG.PESOS.LIQUIDITY;
  } else {
    score -= 8 * CONFIG.PESOS.LIQUIDITY;
  }
  
  // Fluxo Institucional (Ricardo Moura)
  if (state.institutionalFlow > CONFIG.LIMIARES.INSTITUTIONAL_FLOW) {
    score += 18 * CONFIG.PESOS.INSTITUTIONAL;
  } else if (state.institutionalFlow < -CONFIG.LIMIARES.INSTITUTIONAL_FLOW) {
    score -= 18 * CONFIG.Pesos.INSTITUTIONAL;
  }

  // Análise de divergências (Ricardo Moura)
  if (divergencias.divergenciaOculta) {
    score += divergencias.tipoDivergencia.includes("ALTA") ? 
      20 * CONFIG.PESOS.DIVERGENCIA : 
      -20 * CONFIG.PESOS.DIVERGENCIA;
  } else if (divergencias.divergenciaRSI) {
    score += divergencias.tipoDivergencia === "ALTA" ? 
      15 * CONFIG.PESOS.DIVERGENCIA : 
      -15 * CONFIG.PESOS.DIVERGENCIA;
  }

  // Análise de Tendência (com peso maior e força da tendência)
  switch(indicadores.tendencia.tendencia) {
    case "FORTE_ALTA": 
      score += 30 * CONFIG.PESOS.TENDENCIA; 
      score += Math.min(indicadores.tendencia.forca * 0.5, 15);
      break;
    case "ALTA": 
      score += 20 * CONFIG.PESOS.TENDENCIA; 
      score += Math.min(indicadores.tendencia.forca * 0.3, 10);
      break;
    case "FORTE_BAIXA": 
      score -= 30 * CONFIG.PESOS.TENDENCIA; 
      score -= Math.min(indicadores.tendencia.forca * 0.5, 15);
      break;
    case "BAIXA": 
      score -= 20 * CONFIG.PESOS.TENDENCIA; 
      score -= Math.min(indicadores.tendencia.forca * 0.3, 10);
      break;
    case "LATERAL": 
      score -= Math.min(state.contadorLaterais, 15) * CONFIG.PESOS.LATERALIDADE; 
      break;
  }

  // Análise de Volume
  if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
    score += (indicadores.tendencia.tendencia.includes("ALTA") ? 10 : -10) * CONFIG.PESOS.VOLUME;
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

  // Análise VWAP (Ricardo Moura)
  const vwapDesvio = Math.abs(indicadores.close - indicadores.vwap) / indicadores.vwap;
  if (vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO) {
    score += (indicadores.close > indicadores.vwap ? 8 : -8) * CONFIG.PESOS.VWAP;
  }

  // Volume Profile (Ricardo Moura)
  if (indicadores.close > indicadores.volumeProfile.vaHigh) {
    score += 10 * CONFIG.PESOS.VOLUME_PROFILE;
  } else if (indicadores.close < indicadores.volumeProfile.vaLow) {
    score -= 10 * CONFIG.PESOS.VOLUME_PROFILE;
  }

  // Confirmações
  const confirmacoes = [
    indicadores.rsi < 40 || indicadores.rsi > 60,
    Math.abs(indicadores.macd.histograma) > 0.05,
    indicadores.stoch.k < 30 || indicadores.stoch.k > 70,
    indicadores.williams < -70 || indicadores.williams > -30,
    indicadores.tendencia.tendencia !== "LATERAL",
    vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO * 0.8,
    indicadores.superTrend.direcao !== 0,
    state.institutionalFlow > 0
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
  // Estratégia Ricardo Moura: priorizar divergências ocultas
  if (divergencias.divergenciaOculta) {
    return divergencias.tipoDivergencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  if (tendencia === "LATERAL") {
    return score > 85 ? "CALL" : "ESPERAR";
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
    if (tendencia === "NEUTRA") return "ESPERAR";
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// NOVAS FUNÇÕES DE DADOS INSTITUCIONAIS
// =============================================
async function obterFluxoInstitucional() {
  try {
    const response = await fetch('https://api.cryptorank.io/v1/currencies/1?api_key=YOUR_API_KEY');
    if (!response.ok) throw new Error("Falha na API");
    
    const data = await response.json();
    return data.data.values.USD.flow;
  } catch (e) {
    console.error("Erro fluxo institucional:", e);
    return 0;
  }
}

async function detectarOrdensOcultas() {
  try {
    const response = await fetch('https://api.cryptocompare.com/data/ob/l1/top?fsym=BTC&tsym=USD');
    if (!response.ok) throw new Error("Falha na API");
    
    const data = await response.json();
    const largeOrders = data.Data.ASK.filter(order => order.amount > 10)
                       .concat(data.Data.BID.filter(order => order.amount > 10));
    return largeOrders.length > 5;
  } catch (e) {
    console.error("Erro ordens ocultas:", e);
    return false;
  }
}

// =============================================
// CORE DO SISTEMA (ATUALIZADO PARA 2025)
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
            high: v[1] * 1.001,
            low: v[1] * 0.999,
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
    // Buscar dados institucionais (Ricardo Moura)
    state.noticiasRecentes = await buscarNoticiasCrypto();
    state.institutionalFlow = await obterFluxoInstitucional();
    state.hiddenOrders = await detectarOrdensOcultas();
    
    const dados = await obterDadosCrypto();
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Detecção Fair Value Gap (Ricardo Moura)
    state.fairValueGap = detectarFairValueGap(dados.slice(-3));

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
    const liquidez = calcularLiquidez(dados);
    
    // Detecção de divergências melhorada (Ricardo Moura)
    const rsiHistory = [];
    for (let i = CONFIG.PERIODOS.RSI; i <= closes.length; i++) {
      rsiHistory.push(calcularRSI(closes.slice(0, i)));
    }
    const divergencias = detectarDivergencias(closes, rsiHistory, highs, lows);

    // Avaliação de tendência aprimorada
    const tendencia = avaliarTendencia(closes, highs, lows, emaCurtaArray, emaMediaArray, emaLongaArray, ema200, superTrend, atr);
    state.tendenciaDetectada = tendencia.tendencia;

    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      emaCurta,
      emaMedia,
      emaLonga,
      ema200,
      volume: velaAtual.volume,
      volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME) || 1,
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      vwap: calcularVWAP(dados),
      atr,
      superTrend,
      volumeProfile,
      liquidez, // Novo: Zonas de liquidez
      close: velaAtual.close,
      tendencia: state.tendenciaDetectada,
      forcaTendencia: tendencia.forca
    };

    const score = calcularScore(indicadores, divergencias);
    const sinal = determinarSinal(score, indicadores.tendencia, divergencias);

    state.ultimoSinal = sinal !== "ESPERAR" ? sinal : state.ultimoSinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score, state.tendenciaDetectada, tendencia.forca);

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>📊 Tendência: ${state.tendenciaDetectada.replace('_',' ')} ${
          state.tendenciaDetectada.includes("ALTA") ? '🟢' :
          state.tendenciaDetectada.includes("BAIXA") ? '🔴' : '🟡'}</li>
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
        <li>🪙 Liquidez: S ${indicadores.liquidez.suporte.toFixed(2)} | R ${indicadores.liquidez.resistencia.toFixed(2)}</li>
        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
        <li>🏦 Fluxo Institucional: $${(state.institutionalFlow/1000000).toFixed(2)}M</li>
        <li>⚡ Fair Value Gap: ${state.fairValueGap.gap ? state.fairValueGap.direcao + ' ($' + state.fairValueGap.tamanho.toFixed(2) + ')' : 'Não'}</li>
        <li>🕵️‍♂️ Ordens Ocultas: ${state.hiddenOrders ? 'Sim' : 'Não'}</li>
        <li>💪 Força Tendência: ${tendencia.forca}%</li>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%) ${sinal==="CALL"?"📈":sinal==="PUT"?"📉":"✋"}`);
    if (state.ultimos.length>10) state.ultimos.pop();
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) ultimosElement.innerHTML = state.ultimos.map(i=>`<li>${i}</li>`).join("");

    state.tentativasErro = 0;
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0, "ERRO", 0);
    if (++state.tentativasErro>3) setTimeout(()=>location.reload(),10000);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// BACKTESTING (ATUALIZADO COM ESTRATÉGIA RICARDO MOURA)
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
      const volumeProfile = calcularVolumeProfile(slice);
      const liquidez = calcularLiquidez(slice);
      
      // Detecção de divergências
      const rsiHistory = [];
      for (let j = CONFIG.PERIODOS.RSI; j <= closes.length; j++) {
        rsiHistory.push(calcularRSI(closes.slice(0, j)));
      }
      const divergencias = detectarDivergencias(closes, rsiHistory, highs, lows);
      
      // Avaliação de tendência aprimorada
      const tendencia = avaliarTendencia(closes, highs, lows, 
        calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA),
        calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA),
        calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA),
        ema200, superTrend, atr
      );
      
      const indicadores = {
        rsi: calcularRSI(closes),
        macd: calcularMACD(closes),
        emaCurta,
        emaMedia,
        emaLonga,
        ema200,
        volume: slice[i-1].volume,
        volumeMedia: calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME) || 1,
        stoch: calcularStochastic(highs, lows, closes),
        williams: calcularWilliams(highs, lows, closes),
        vwap: calcularVWAP(slice),
        atr,
        superTrend,
        volumeProfile,
        liquidez,
        close: slice[i-1].close,
        tendencia: tendencia.tendencia,
        forcaTendencia: tendencia.forca
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
  
  // Adiciona botão para backtesting
  const backtestBtn = document.createElement('button');
  backtestBtn.textContent = 'Executar Backtest (5 dias)';
  backtestBtn.style.position = 'fixed';
  backtestBtn.style.bottom = '10px';
  backtestBtn.style.right = '10px';
  backtestBtn.style.zIndex = '1000';
  backtestBtn.style.padding = '10px';
  backtestBtn.style.backgroundColor = '#2c3e50';
  backtestBtn.style.color = 'white';
  backtestBtn.style.border = 'none';
  backtestBtn.style.borderRadius = '5px';
  backtestBtn.style.cursor = 'pointer';
  
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
