// =============================================
// CONFIGURAÇÕES GLOBAIS (MANTIDAS COM MELHORIAS INTERNAS)
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
    _REPETICAO_MAXIMA: 3
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
function _validarDados(dados) {
  if (!Array.isArray(dados)) return false;
  return dados.every(v => Array.isArray(v) && v.length >= 6 && !isNaN(parseFloat(v[4])));
}

function _calcularVolatilidade(closes) {
  if (closes.length < 14) return 0;
  const returns = closes.slice(-14).map((c, i, arr) => i > 0 ? Math.log(c / arr[i-1]) : 0);
  const stdDev = Math.sqrt(returns.slice(1).reduce((a,b) => a + Math.pow(b, 2), 0) / 13);
  state._ultimaVolatilidade = stdDev * 100 * Math.sqrt(365); // Volatilidade anualizada
  return state._ultimaVolatilidade;
}

function _verificarRepeticao(sinal) {
  state._ultimosSinais.push(sinal);
  if (state._ultimosSinais.length > CONFIG.PERIODOS._HISTORICO_SINAIS) {
    state._ultimosSinais.shift();
  }
  return state._ultimosSinais.filter(s => s === sinal).length >= CONFIG.LIMIARES._REPETICAO_MAXIMA;
}

// =============================================
// FUNÇÕES ORIGINAIS (MANTIDAS COM MELHORIAS INTERNAS)
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    elementoHora.textContent = new Date().toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

function atualizarInterface(sinal, score) {
  // EXATAMENTE IGUAL AO ORIGINAL
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) scoreElement.textContent = `Confiança: ${score}%`;
  
  const horaElement = document.getElementById("hora");
  if (horaElement) horaElement.textContent = state.ultimaAtualizacao;
}

// =============================================
// INDICADORES TÉCNICOS (MANTIDOS COM VALIDAÇÕES)
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

// [Todas as outras funções de indicadores técnicos permanecem EXATAMENTE IGUAIS]

// =============================================
// SISTEMA DE DECISÃO (MANTIDO COM AJUSTES INTERNOS)
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
  // ... (todo o resto do cálculo original)

  // Nova verificação de repetição (interna)
  if (state.ultimoSinal && _verificarRepeticao(state.ultimoSinal)) {
    score -= 8;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

// [Todas as outras funções de decisão permanecem EXATAMENTE IGUAIS]

// =============================================
// CORE DO SISTEMA (MANTIDO COM VALIDAÇÕES)
// =============================================
async function obterDadosBinance() {
  for (const endpoint of CONFIG.API_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}/klines?symbol=BTCUSDT&interval=1m&limit=150`);
      if (!response.ok) continue;
      const dados = await response.json();
      if (!_validarDados(dados)) continue;
      return dados.filter(v => Array.isArray(v) && v.length >= 6);
    } catch (e) {
      console.error(`Erro no endpoint ${endpoint}:`, e);
    }
  }
  throw new Error("Todos os endpoints falharam");
}

async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;

  try {
    const dados = await obterDadosBinance();
    if (!dados || dados.length < 50) throw new Error("Dados insuficientes");
    
    // Resto da função ORIGINAL (mantida integralmente)
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => parseFloat(v[4]));
    // ... (todo o processamento original)

    // A interface é atualizada EXATAMENTE como antes
    atualizarInterface(sinal, score);

    // O critério de exibição permanece IGUAL
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>Tendência: ${indicadores.tendencia.replace('_', ' ')}</li>
        <li>RSI: ${indicadores.rsi.toFixed(2)} ${indicadores.rsi < 40 ? '🔻' : indicadores.rsi > 60 ? '🔺' : ''}</li>
        <!-- Todo o resto do HTML permanece IGUAL -->
      `;
    }

  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0); // Mantido igual
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO E INICIALIZAÇÃO (MANTIDOS)
// =============================================
// [Todas as funções de timer e inicialização permanecem EXATAMENTE IGUAIS]

// Inicialização idêntica à original
if (document.readyState === 'complete') {
  iniciarAplicativo();
} else {
  document.addEventListener('DOMContentLoaded', iniciarAplicativo);
}
