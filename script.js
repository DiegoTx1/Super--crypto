// =============================================
// CONFIGURAÇÕES GLOBAIS (REVISADAS PARA EUR/USD)
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
  contadorLaterais: 0
};

const CONFIG = {
  API_ENDPOINTS: [
    "https://api.twelvedata.com",
    "https://api.frankfurter.app",
    "https://api.exchangerate-api.com"
  ],
  PARES: {
    EURUSD: "EUR/USD"
  },
  PERIODOS: {
    RSI: 14,
    STOCH: 14,
    WILLIAMS: 14,
    EMA_CURTA: 9,  // Reduzido para melhor resposta no Forex
    EMA_LONGA: 21, // Ajustado para timeframe de 1 minuto
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 30  // Aumentado para melhor detecção de lateralidade
  },
  LIMIARES: {
    SCORE_ALTO: 75,  // Aumentado para maior confiabilidade
    SCORE_MEDIO: 65,
    RSI_OVERBOUGHT: 65,  // Ajustado para Forex
    RSI_OVERSOLD: 35,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    WILLIAMS_OVERBOUGHT: -20,
    WILLIAMS_OVERSOLD: -80,
    VOLUME_ALTO: 1.3,  // Reduzido para Forex
    VARIACAO_LATERAL: 0.8  // Reduzido para menor volatilidade do EUR/USD
  },
  PESOS: {
    RSI: 1.5,
    MACD: 2.0,  // Peso reduzido para evitar falsos sinais
    TENDENCIA: 1.5,  // Maior importância para tendência no Forex
    VOLUME: 0.8,  // Menor importância no Forex
    STOCH: 1.2,
    WILLIAMS: 1.0,
    CONFIRMACAO: 1.0,
    LATERALIDADE: 1.8  // Maior peso para lateralidade
  }
};

// =============================================
// FUNÇÕES UTILITÁRIAS (CORRIGIDAS)
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
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    // Adiciona emojis para melhor visualização
    if (sinal === "CALL") comandoElement.textContent += " 📈";
    else if (sinal === "PUT") comandoElement.textContent += " 📉";
    else if (sinal === "ESPERAR") comandoElement.textContent += " ✋";
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Confiança: ${score}%`;
    // Cores baseadas no score
    if (score >= CONFIG.LIMIARES.SCORE_ALTO) scoreElement.style.color = '#00ff00';
    else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) scoreElement.style.color = '#ffff00';
    else scoreElement.style.color = '#ff0000';
  }
  
  const horaElement = document.getElementById("hora");
  if (horaElement) horaElement.textContent = state.ultimaAtualizacao;
}

// =============================================
// INDICADORES TÉCNICOS (OTIMIZADOS PARA FOREX)
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
// SISTEMA DE DECISÃO (OTIMIZADO PARA EUR/USD)
// =============================================
function avaliarTendencia(closes, emaCurta, emaLonga) {
  if (closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  if (detectarMercadoLateral(closes)) {
    state.contadorLaterais++;
    return "LATERAL";
  }
  
  state.contadorLaterais = 0;
  
  const ultimoClose = closes[closes.length - 1];
  const penultimoClose = closes[closes.length - 2];
  
  // Suavização para evitar falsas tendências no Forex
  const diffEMAs = emaCurta - emaLonga;
  const threshold = 0.0005; // Limiar ajustado para EUR/USD
  
  if (ultimoClose > emaCurta && diffEMAs > threshold && ultimoClose > penultimoClose) {
    return "FORTE_ALTA";
  }
  if (ultimoClose < emaCurta && diffEMAs < -threshold && ultimoClose < penultimoClose) {
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

function detectarMercadoLateral(closes) {
  if (closes.length < CONFIG.PERIODOS.ANALISE_LATERAL) return false;
  
  const ultimosPrecos = closes.slice(-CONFIG.PERIODOS.ANALISE_LATERAL);
  const maximo = Math.max(...ultimosPrecos);
  const minimo = Math.min(...ultimosPrecos);
  const variacao = ((maximo - minimo) / minimo) * 100;
  
  return variacao < CONFIG.LIMIARES.VARIACAO_LATERAL;
}

function calcularScore(indicadores) {
  let score = 50;

  // RSI (Ajustado para Forex)
  if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) {
    score += 25 * CONFIG.PESOS.RSI;
    if (indicadores.tendencia.includes("BAIXA")) score -= 10; // Filtro contra-tendência
  }
  else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) {
    score -= 25 * CONFIG.PESOS.RSI;
    if (indicadores.tendencia.includes("ALTA")) score += 10; // Filtro contra-tendência
  }
  else if (indicadores.rsi < 45) score += 10 * CONFIG.PESOS.RSI;
  else if (indicadores.rsi > 55) score -= 10 * CONFIG.PESOS.RSI;

  // MACD (Peso reduzido para Forex)
  score += (Math.min(Math.max(indicadores.macd.histograma * 10, -15), 15) * CONFIG.PESOS.MACD);

  // Tendência (Maior peso no Forex)
  switch(indicadores.tendencia) {
    case "FORTE_ALTA": 
      score += 20 * CONFIG.PESOS.TENDENCIA; 
      // Confirmação de volume para tendência forte
      if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.2) score += 5;
      break;
    case "ALTA": 
      score += 12 * CONFIG.PESOS.TENDENCIA; 
      break;
    case "FORTE_BAIXA": 
      score -= 20 * CONFIG.PESOS.TENDENCIA;
      // Confirmação de volume para tendência forte
      if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.2) score -= 5;
      break;
    case "BAIXA": 
      score -= 12 * CONFIG.PESOS.TENDENCIA; 
      break;
    case "LATERAL": 
      score -= Math.min(state.contadorLaterais, 12) * CONFIG.PESOS.LATERALIDADE; 
      break;
  }

  // Volume (Menor peso no Forex)
  if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
    score += (indicadores.tendencia.includes("ALTA") ? 8 : -8) * CONFIG.PESOS.VOLUME;
  }

  // Estocástico
  if (indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && 
      indicadores.stoch.d < CONFIG.LIMIARES.STOCH_OVERSOLD) {
    score += 12 * CONFIG.PESOS.STOCH;
    // Filtro para evitar sinais contra a tendência
    if (indicadores.tendencia.includes("ALTA")) score -= 5;
  }
  if (indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && 
      indicadores.stoch.d > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
    score -= 12 * CONFIG.PESOS.STOCH;
    // Filtro para evitar sinais contra a tendência
    if (indicadores.tendencia.includes("BAIXA")) score += 5;
  }

  // Williams
  if (indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) {
    score += 10 * CONFIG.PESOS.WILLIAMS;
    // Filtro de confirmação
    if (indicadores.rsi < 40) score += 3;
  }
  if (indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) {
    score -= 10 * CONFIG.PESOS.WILLIAMS;
    // Filtro de confirmação
    if (indicadores.rsi > 60) score -= 3;
  }

  // Confirmações (mais rigorosas para Forex)
  const confirmacoes = [
    indicadores.rsi < 40 || indicadores.rsi > 60,
    Math.abs(indicadores.macd.histograma) > 0.05,
    indicadores.stoch.k < 30 || indicadores.stoch.k > 70,
    indicadores.williams < -70 || indicadores.williams > -30,
    indicadores.tendencia !== "LATERAL"
  ].filter(Boolean).length;

  score += confirmacoes * 4 * CONFIG.PESOS.CONFIRMACAO;

  // Evitar repetição de sinais
  if (state.ultimoSinal) {
    score += (state.ultimoSinal === "CALL" ? -10 : 10);
  }

  // Limitar score entre 0 e 100
  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia) {
  if (tendencia === "LATERAL") {
    // Estratégia mais conservadora em mercados laterais
    return score > 80 ? "CALL" : "ESPERAR";
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
    // Requer confirmação adicional para médio score
    if (tendencia === "NEUTRA") return score > 75 ? "CALL" : "ESPERAR";
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// CORE DO SISTEMA (ADAPTADO PARA FOREX)
// =============================================
async function obterDadosForex() {
  // Tenta várias APIs de Forex em caso de falha
  for (const endpoint of CONFIG.API_ENDPOINTS) {
    try {
      let response, dados;
      
      if (endpoint.includes('twelvedata')) {
        // API TwelveData
        response = await fetch(`${endpoint}/time_series?symbol=${CONFIG.PARES.EURUSD}&interval=1min&outputsize=150&apikey=demo`);
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
      } else if (endpoint.includes('frankfurter')) {
        // API Frankfurter (últimos 90 dias)
        response = await fetch(`${endpoint}/latest?amount=1&from=EUR&to=USD`);
        if (!response.ok) continue;
        const current = await response.json();
        const close = parseFloat(current.rates.USD);
        return [{
          time: new Date().toISOString(),
          open: close,
          high: close,
          low: close,
          close: close,
          volume: 0
        }];
      } else {
        // API genérica
        response = await fetch(`${endpoint}/latest/EUR`);
        if (!response.ok) continue;
        dados = await response.json();
        if (dados.rates && dados.rates.USD) {
          const close = parseFloat(dados.rates.USD);
          return [{
            time: new Date().toISOString(),
            open: close,
            high: close,
            low: close,
            close: close,
            volume: 0
          }];
        }
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
    const dados = await obterDadosForex();
    const velaAtual = dados[dados.length - 1];
    
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    const emaCurtaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const emaLongaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const emaCurta = emaCurtaArray[emaCurtaArray.length - 1] || 0;
    const emaLonga = emaLongaArray[emaLongaArray.length - 1] || 0;

    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      sma9: calcularMedia.simples(closes, 9),
      emaCurta,
      emaLonga,
      volume: velaAtual.volume,
      volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME) || 1,
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      close: velaAtual.close,
      tendencia: avaliarTendencia(closes, emaCurta, emaLonga)
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
        <li>📊 Tendência: ${indicadores.tendencia.replace('_', ' ')} ${
          indicadores.tendencia.includes("ALTA") ? '🟢' : 
          indicadores.tendencia.includes("BAIXA") ? '🔴' : '🟡'}</li>
        <li>📉 RSI: ${indicadores.rsi.toFixed(2)} ${
          indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻(Oversold)' : 
          indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺(Overbought)' : ''}</li>
        <li>📊 MACD: ${indicadores.macd.histograma.toFixed(6)} ${
          indicadores.macd.histograma > 0 ? '🟢(Alta)' : '🔴(Baixa)'}</li>
        <li>📈 Stochastic: K ${indicadores.stoch.k.toFixed(2)} / D ${indicadores.stoch.d.toFixed(2)} ${
          indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && indicadores.stoch.d < CONFIG.LIMIARES.STOCH_OVERSOLD ? '🔻(Oversold)' : 
          indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && indicadores.stoch.d > CONFIG.LIMIARES.STOCH_OVERBOUGHT ? '🔺(Overbought)' : ''}</li>
        <li>📊 Williams: ${indicadores.williams.toFixed(2)} ${
          indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD ? '🔻(Oversold)' : 
          indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT ? '🔺(Overbought)' : ''}</li>
        <li>💰 Preço: €${indicadores.close.toFixed(5)} ${
          indicadores.close > emaCurta ? '🟢' : '🔴'}</li>
        <li>📶 Médias: EMA${CONFIG.PERIODOS.EMA_CURTA} ${indicadores.emaCurta.toFixed(5)} | EMA${CONFIG.PERIODOS.EMA_LONGA} ${indicadores.emaLonga.toFixed(5)} ${
          emaCurta > emaLonga ? '🟢(Alta)' : '🔴(Baixa)'}</li>
        <li>💹 Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)} ${
          indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO ? '🔺(Alto)' : ''}</li>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%) ${
      sinal === "CALL" ? "📈" : sinal === "PUT" ? "📉" : "✋"}`);
    if (state.ultimos.length > 10) state.ultimos.pop();  // Aumentado para 10 sinais
    
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) {
      ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
    }

    state.tentativasErro = 0;
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0);
    
    if (++state.tentativasErro > 3) {
      console.error("Muitos erros consecutivos, reiniciando...");
      setTimeout(() => location.reload(), 10000);
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO (REVISADO)
// =============================================
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
// INICIALIZAÇÃO (SEGURA)
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
      const response = await fetch("https://api.twelvedata.com/price?symbol=EUR/USD&apikey=demo");
      if (!response.ok) return;
      const dados = await response.json();
      const precoElement = document.querySelector("#criterios li:nth-child(6)");
      if (precoElement && dados.price) {
        precoElement.textContent = `💰 Preço: €${parseFloat(dados.price).toFixed(5)}`;
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
