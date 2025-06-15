// =============================================
// CONFIGURAÇÕES GLOBAIS (ORIGINAL + MELHORIAS INTERNAS)
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
  // Novos estados internos (não afetam a interface)
  _ultimosSinais: [],
  _ultimaVolatilidade: 0
};

const CONFIG = {
  API_ENDPOINTS: [
    "https://api.binance.com/api/v3",
    "https://api1.binance.com/api/v3", 
    "https://api2.binance.com/api/v3",
    "https://api3.binance.com/api/v3"
  ],
  PERIODOS: {
    RSI: 14,
    STOCH: 14,
    WILLIAMS: 14,
    EMA_CURTA: 21,
    EMA_LONGA: 50,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 20,
    // Novos parâmetros internos
    _HISTORICO_SINAIS: 5,
    _VOLATILIDADE_PERIODO: 14
  },
  LIMIARES: {
    SCORE_ALTO: 68,
    SCORE_MEDIO: 58,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    WILLIAMS_OVERBOUGHT: -20,
    WILLIAMS_OVERSOLD: -80,
    VOLUME_ALTO: 1.5,
    VARIACAO_LATERAL: 1.2,
    // Novos limiares internos
    _VOLATILIDADE_MINIMA: 0.3,
    _REPETICAO_MAXIMA: 3,
    _MAX_TENTATIVAS_ERRO: 5
  },
  PESOS: {
    RSI: 1.6,
    MACD: 2.2,
    TENDENCIA: 1.3,
    VOLUME: 1.1,
    STOCH: 1.3,
    WILLIAMS: 1.1,
    CONFIRMACAO: 0.9,
    LATERALIDADE: 1.5,
    // Novo peso interno
    _VOLATILIDADE: 1.2
  }
};

// =============================================
// FUNÇÕES NOVAS (INTERNAS - NÃO AFETAM INTERFACE)
// =============================================
function _calcularVolatilidade(closes) {
  if (!Array.isArray(closes) || closes.length < CONFIG.PERIODOS._VOLATILIDADE_PERIODO) return 0;
  
  const returns = [];
  for (let i = 1; i < closes.length && i < CONFIG.PERIODOS._VOLATILIDADE_PERIODO; i++) {
    const retorno = Math.log(closes[i] / closes[i-1]);
    returns.push(retorno);
  }
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  state._ultimaVolatilidade = stdDev * 100;
  return state._ultimaVolatilidade;
}

function _verificarRepeticao(sinal) {
  if (sinal === "ESPERAR") return false;
  
  state._ultimosSinais.push(sinal);
  if (state._ultimosSinais.length > CONFIG.PERIODOS._HISTORICO_SINAIS) {
    state._ultimosSinais.shift();
  }
  
  return state._ultimosSinais.filter(s => s === sinal).length >= CONFIG.LIMIARES._REPETICAO_MAXIMA;
}

// =============================================
// FUNÇÕES ORIGINAIS (MANTIDAS INTACTAS)
// =============================================
// [Todas as suas funções originais permanecem EXATAMENTE IGUAIS]
// [Incluindo: formatarTimer, atualizarRelogio, atualizarInterface, calcularMedia]
// [calcularRSI, calcularStochastic, calcularWilliams, calcularMACD]
// [avaliarTendencia, detectarMercadoLateral, determinarSinal]

// =============================================
// ÚNICA MODIFICAÇÃO NECESSÁRIA - função calcularScore
// =============================================
function calcularScore(indicadores) {
  let score = 50;

  // Nova verificação de volatilidade (não afeta interface)
  if (_calcularVolatilidade(indicadores.closes) < CONFIG.LIMIARES._VOLATILIDADE_MINIMA) {
    score -= 10 * CONFIG.PESOS._VOLATILIDADE;
  }

  // Restante da função ORIGINAL (mantida integralmente)
  if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) score += 25 * CONFIG.PESOS.RSI;
  else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) score -= 25 * CONFIG.PESOS.RSI;
  else if (indicadores.rsi < 40) score += 12 * CONFIG.PESOS.RSI;
  else if (indicadores.rsi > 60) score -= 12 * CONFIG.PESOS.RSI;

  if (indicadores.macd && typeof indicadores.macd.histograma === 'number') {
    score += (Math.min(Math.max(indicadores.macd.histograma * 15, -20), 20) * CONFIG.PESOS.MACD);
  }

  switch(indicadores.tendencia) {
    case "FORTE_ALTA": score += 18 * CONFIG.PESOS.TENDENCIA; break;
    case "ALTA": score += 10 * CONFIG.PESOS.TENDENCIA; break;
    case "FORTE_BAIXA": score -= 18 * CONFIG.PESOS.TENDENCIA; break;
    case "BAIXA": score -= 10 * CONFIG.PESOS.TENDENCIA; break;
    case "LATERAL": score -= Math.min(state.contadorLaterais, 10) * CONFIG.PESOS.LATERALIDADE; break;
  }

  if (typeof indicadores.volume === 'number' && typeof indicadores.volumeMedia === 'number') {
    if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
      score += (indicadores.tendencia.includes("ALTA") ? 12 : -12) * CONFIG.PESOS.VOLUME;
    }
  }

  if (indicadores.stoch && typeof indicadores.stoch.k === 'number' && typeof indicadores.stoch.d === 'number') {
    if (indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && indicadores.stoch.d < CONFIG.LIMIARES.STOCH_OVERSOLD) {
      score += 15 * CONFIG.PESOS.STOCH;
    }
    if (indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && indicadores.stoch.d > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
      score -= 15 * CONFIG.PESOS.STOCH;
    }
  }

  if (typeof indicadores.williams === 'number') {
    if (indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) score += 12 * CONFIG.PESOS.WILLIAMS;
    if (indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) score -= 12 * CONFIG.PESOS.WILLIAMS;
  }

  const confirmacoes = [
    typeof indicadores.rsi === 'number' && (indicadores.rsi < 40 || indicadores.rsi > 60),
    indicadores.macd && Math.abs(indicadores.macd.histograma) > 0.1,
    indicadores.stoch && (indicadores.stoch.k < 30 || indicadores.stoch.k > 70),
    typeof indicadores.williams === 'number' && (indicadores.williams < -70 || indicadores.williams > -30)
  ].filter(Boolean).length;

  score += confirmacoes * 5 * CONFIG.PESOS.CONFIRMACAO;

  // Nova verificação de repetição (interna)
  if (state.ultimoSinal && _verificarRepeticao(state.ultimoSinal)) {
    score -= 8;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

// =============================================
// MODIFICAÇÃO NA FUNÇÃO analisarMercado
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;

  try {
    const dados = await obterDadosBinance();
    const velaAtual = dados[dados.length - 1];
    
    const closes = dados.map(v => parseFloat(v[4]));
    const highs = dados.map(v => parseFloat(v[2]));
    const lows = dados.map(v => parseFloat(v[3]));
    const volumes = dados.map(v => parseFloat(v[5]));

    const ema21Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema50Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema21 = ema21Array[ema21Array.length - 1] || 0;
    const ema50 = ema50Array[ema50Array.length - 1] || 0;

    const indicadores = {
      closes, // Adicionado para cálculo de volatilidade
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      sma9: calcularMedia.simples(closes, 9),
      ema21,
      ema50,
      volume: parseFloat(velaAtual[5]),
      volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME),
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      close: parseFloat(velaAtual[4]),
      tendencia: avaliarTendencia(closes, ema21, ema50)
    };

    // [Resto da função permanece EXATAMENTE IGUAL]
    // ... (incluindo todas as atualizações de interface)
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0);
    
    if (++state.tentativasErro > CONFIG.LIMIARES._MAX_TENTATIVAS_ERRO) {
      console.error("Muitos erros consecutivos, reiniciando...");
      setTimeout(() => location.reload(), 10000);
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// O RESTO DO SEU CÓDIGO ORIGINAL PERMANECE IGUAL
// =============================================
// [Todas as outras funções: obterDadosBinance, sincronizarTimer, iniciarAplicativo]
// [e a inicialização no final do arquivo permanecem EXATAMENTE como no seu original]
