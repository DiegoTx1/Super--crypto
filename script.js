// =============================================
// CONFIGURAÇÕES GLOBAIS (REVISADAS)
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
  _ultimosSinais: [],
  _ultimaVolatilidade: 0,
  _dadosMercado: null
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
    _VOLATILIDADE: 1.2
  }
};

// =============================================
// FUNÇÕES UTILITÁRIAS (REVISADAS)
// =============================================
function formatarTimer(segundos) {
  const mins = Math.floor(segundos / 60);
  const segs = segundos % 60;
  return `${mins}:${segs.toString().padStart(2, '0')}`;
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
// FUNÇÕES DE ANÁLISE TÉCNICA (REVISADAS)
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
  let avgLoss = losses / periodo || 0.001;

  for (let i = periodo + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    
    avgGain = (avgGain * (periodo - 1) + gain) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
  }

  if (avgLoss <= 0) return 100;
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

// =============================================
// FUNÇÕES DE DECISÃO (REVISADAS)
// =============================================
function avaliarTendencia(closes, emaCurta, emaLonga) {
  if (!Array.isArray(closes) || closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  if (detectarMercadoLateral(closes)) {
    state.contadorLaterais++;
    return "LATERAL";
  }
  
  state.contadorLaterais = 0;
  
  const ultimoClose = closes[closes.length - 1];
  const penultimoClose = closes[closes.length - 2];
  
  if (ultimoClose > emaCurta && emaCurta > emaLonga && ultimoClose > penultimoClose) {
    return "FORTE_ALTA";
  }
  if (ultimoClose < emaCurta && emaCurta < emaLonga && ultimoClose < penultimoClose) {
    return "FORTE_BAIXA";
  }
  if (ultimoClose > emaCurta && emaCurta > emaLonga) {
    return "ALTA";
  }
  if (ultimoClose < emaCurta && emaCurta < emaLonga) {
    return "BAIXA";
  }
  
  return "NEUTRA";
}

function detectarMercadoLateral(closes) {
  if (!Array.isArray(closes) || closes.length < CONFIG.PERIODOS.ANALISE_LATERAL) return false;
  
  const ultimosPrecos = closes.slice(-CONFIG.PERIODOS.ANALISE_LATERAL);
  const maximo = Math.max(...ultimosPrecos);
  const minimo = Math.min(...ultimosPrecos);
  const variacao = ((maximo - minimo) / minimo) * 100;
  
  return variacao < CONFIG.LIMIARES.VARIACAO_LATERAL;
}

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

function calcularScore(indicadores) {
  if (!indicadores || typeof indicadores !== 'object') return 50;
  
  let score = 50;

  // Verificação de volatilidade
  const volatilidade = _calcularVolatilidade(indicadores.closes);
  if (volatilidade < CONFIG.LIMIARES._VOLATILIDADE_MINIMA) {
    score -= 10 * CONFIG.PESOS._VOLATILIDADE;
  }

  // RSI
  if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) {
    score += 25 * CONFIG.PESOS.RSI;
  } else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) {
    score -= 25 * CONFIG.PESOS.RSI;
  } else if (indicadores.rsi < 40) {
    score += 12 * CONFIG.PESOS.RSI;
  } else if (indicadores.rsi > 60) {
    score -= 12 * CONFIG.PESOS.RSI;
  }

  // MACD
  if (indicadores.macd && typeof indicadores.macd.histograma === 'number') {
    score += (Math.min(Math.max(indicadores.macd.histograma * 15, -20), 20) * CONFIG.PESOS.MACD);
  }

  // Tendência
  if (indicadores.tendencia) {
    switch(indicadores.tendencia) {
      case "FORTE_ALTA": 
        score += 18 * CONFIG.PESOS.TENDENCIA; 
        break;
      case "ALTA": 
        score += 10 * CONFIG.PESOS.TENDENCIA; 
        break;
      case "FORTE_BAIXA": 
        score -= 18 * CONFIG.PESOS.TENDENCIA; 
        break;
      case "BAIXA": 
        score -= 10 * CONFIG.PESOS.TENDENCIA; 
        break;
      case "LATERAL": 
        score -= Math.min(state.contadorLaterais, 10) * CONFIG.PESOS.LATERALIDADE; 
        break;
    }
  }

  // Volume
  if (typeof indicadores.volume === 'number' && typeof indicadores.volumeMedia === 'number') {
    if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
      score += (indicadores.tendencia.includes("ALTA") ? 12 : -12) * CONFIG.PESOS.VOLUME;
    }
  }

  // Estocástico
  if (indicadores.stoch && typeof indicadores.stoch.k === 'number' && typeof indicadores.stoch.d === 'number') {
    if (indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && 
        indicadores.stoch.d < CONFIG.LIMIARES.STOCH_OVERSOLD) {
      score += 15 * CONFIG.PESOS.STOCH;
    }
    if (indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && 
        indicadores.stoch.d > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
      score -= 15 * CONFIG.PESOS.STOCH;
    }
  }

  // Williams
  if (typeof indicadores.williams === 'number') {
    if (indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) {
      score += 12 * CONFIG.PESOS.WILLIAMS;
    }
    if (indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) {
      score -= 12 * CONFIG.PESOS.WILLIAMS;
    }
  }

  // Confirmações
  const confirmacoes = [
    typeof indicadores.rsi === 'number' && (indicadores.rsi < 40 || indicadores.rsi > 60),
    indicadores.macd && Math.abs(indicadores.macd.histograma) > 0.1,
    indicadores.stoch && (indicadores.stoch.k < 30 || indicadores.stoch.k > 70),
    typeof indicadores.williams === 'number' && (indicadores.williams < -70 || indicadores.williams > -30)
  ].filter(Boolean).length;

  score += confirmacoes * 5 * CONFIG.PESOS.CONFIRMACAO;

  // Evitar repetição
  if (_verificarRepeticao(state.ultimoSinal)) {
    score -= 8;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia) {
  if (typeof score !== 'number' || !tendencia) return "ESPERAR";
  
  if (tendencia === "LATERAL") {
    return score > 75 ? "CALL" : "ESPERAR";
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
    if (tendencia === "NEUTRA") {
      return score > 70 ? "CALL" : "ESPERAR";
    }
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// CORE DO SISTEMA (REVISADO)
// =============================================
async function obterDadosBinance() {
  for (const endpoint of CONFIG.API_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}/klines?symbol=BTCUSDT&interval=1m&limit=150`);
      if (!response.ok) continue;
      
      const dados = await response.json();
      if (!Array.isArray(dados) || dados.length < 50) continue;
      
      // Validar estrutura dos dados
      const dadosValidados = dados.filter(v => 
        Array.isArray(v) && 
        v.length >= 6 && 
        !isNaN(parseFloat(v[4])) &&  // close
        !isNaN(parseFloat(v[2])) &&  // high
        !isNaN(parseFloat(v[3])) &&  // low
        !isNaN(parseFloat(v[5]))     // volume
      );
      
      if (dadosValidados.length >= 50) {
        state._dadosMercado = dadosValidados;
        return dadosValidados;
      }
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
    if (!Array.isArray(dados) || dados.length < 50) {
      throw new Error("Dados insuficientes para análise");
    }

    const velaAtual = dados[dados.length - 1];
    if (!Array.isArray(velaAtual) {
      throw new Error("Vela atual inválida");
    }
    
    const closes = dados.map(v => parseFloat(v[4]));
    const highs = dados.map(v => parseFloat(v[2]));
    const lows = dados.map(v => parseFloat(v[3]));
    const volumes = dados.map(v => parseFloat(v[5]));

    const ema21Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema50Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema21 = ema21Array[ema21Array.length - 1] || 0;
    const ema50 = ema50Array[ema50Array.length - 1] || 0;

    const indicadores = {
      closes,
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

    const score = calcularScore(indicadores);
    const sinal = determinarSinal(score, indicadores.tendencia);
    
    state.ultimoSinal = sinal !== "ESPERAR" ? sinal : state.ultimoSinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score);

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>Tendência: ${indicadores.tendencia.replace('_', ' ')}</li>
        <li>RSI: ${indicadores.rsi.toFixed(2)} ${indicadores.rsi < 40 ? '🔻' : indicadores.rsi > 60 ? '🔺' : ''}</li>
        <li>MACD: ${indicadores.macd.histograma.toFixed(4)} ${indicadores.macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>Stochastic: K ${indicadores.stoch.k.toFixed(2)} / D ${indicadores.stoch.d.toFixed(2)}</li>
        <li>Williams: ${indicadores.williams.toFixed(2)}</li>
        <li>Preço: $${indicadores.close.toFixed(2)}</li>
        <li>Médias: SMA9 ${indicadores.sma9?.toFixed(2) || 'N/A'} | EMA21 ${indicadores.ema21.toFixed(2)} | EMA50 ${indicadores.ema50.toFixed(2)}</li>
        <li>Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)}</li>
        <li>Volatilidade: ${state._ultimaVolatilidade.toFixed(2)}%</li>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 5) state.ultimos.pop();
    
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) {
      ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
    }

    state.tentativasErro = 0;
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

function sincronizarTimer() {
  clearInterval(state.intervaloAtual);

  const agora = Date.now();
  const delayProximaVela = 60000 - (agora % 60000);
  state.timer = Math.max(1, Math.floor(delayProximaVela / 1000));

  const elementoTimer = document.getElementById("timer");
  if (elementoTimer) {
    elementoTimer.textContent = formatarTimer(state.timer);
    elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
  }

  state.intervaloAtual = setInterval(() => {
    state.timer--;
    if (elementoTimer) {
      elementoTimer.textContent = formatarTimer(state.timer);
      elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
    }
    
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado().finally(sincronizarTimer);
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO (REVISADA)
// =============================================
function iniciarAplicativo() {
  // Verifica se todos os elementos da interface existem
  const elementosNecessarios = ['comando', 'score', 'hora', 'timer', 'criterios', 'ultimos'];
  const elementosFaltantes = elementosNecessarios.filter(id => !document.getElementById(id));
  
  if (elementosFaltantes.length > 0) {
    console.error("Elementos da interface não encontrados:", elementosFaltantes);
    return;
  }

  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  analisarMercado();

  // Atualização de preço em tempo real
  setInterval(async () => {
    try {
      const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
      if (!response.ok) return;
      const dados = await response.json();
      const precoElement = document.querySelector("#criterios li:nth-child(6)");
      if (precoElement && dados.lastPrice) {
        precoElement.textContent = `Preço: $${parseFloat(dados.lastPrice).toFixed(2)}`;
      }
    } catch (e) {
      console.error("Erro ao atualizar preço:", e);
    }
  }, 5000);
}

// Inicialização segura
if (document.readyState === 'complete') {
  iniciarAplicativo();
} else {
  document.addEventListener('DOMContentLoaded', iniciarAplicativo);
}
