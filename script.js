Segue tbm meu html pronto Analisa meu cod para ver se precisa de ajustes e Faça uma busca no que tem de mais atualizado no mundo inteiro e compara com meu cod na parte de estratégia, analise, parâmetro e indicadores principalmente  as médias e na análise de tendência a linha que aparece a tendência no robô não bate com o robô emita sinal que vai contra a tendência sem parâmetros de exaustão dando sinais errados faça essa busca  para  Eurusd para ver se tá bom ou precisa de mudanças, tira tbm esse histórico win e loss Que não ta funcionando, acrescenta tbm uma opção que mostra o horário do mercado se tá aberto ou fechado r qual mercado tá aberto no momento, faça com o melhor visual, corrigir sem bagunçar ou estragar nada mantendo td que tá bom e a interface intacta corrigindo somente o que foi analisado e me devolvendo o código completo exatamente como o meu original só com as mudanças, lembrando tudo que tem de mais assertivo em 2025, pq esse cod tá errando muito  Gera o cod Java completo com as mudanças observadas, tenha atenção nessas médias, deve ter algo mais atual em 2025 para eurusd pq eles não estão, Consegue corrigir sem bagunçar ou estragar nada mantendo td que tá bom e a interface intacta corrigindo somente o que foi analisado e me devolvendo o código completo exatamente como o meu original só com as mudanças gera somente para eu copiar, não precisa do html pois já tenho esse // =============================================
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
  contadorLaterais: 0,
  websocket: null,
  apiKeys: [
    "demo", // Chave padrão
    "seu_outra_chave_1", // Adicione suas chaves aqui
    "seu_outra_chave_2"
  ],
  currentApiKeyIndex: 0,
  marketOpen: true
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
    STOCH: 14,
    WILLIAMS: 14,
    EMA_CURTA: 9,
    EMA_LONGA: 21,
    EMA_200: 200,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 30,
    VWAP: 20,
    ATR: 14
  },
  LIMIARES: {
    SCORE_ALTO: 75,
    SCORE_MEDIO: 65,
    RSI_OVERBOUGHT: 65,
    RSI_OVERSOLD: 35,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    WILLIAMS_OVERBOUGHT: -20,
    WILLIAMS_OVERSOLD: -80,
    VOLUME_ALTO: 1.3,
    VARIACAO_LATERAL: 0.8,
    VWAP_DESVIO: 0.0015,
    ATR_LIMIAR: 0.0010
  },
  PESOS: {
    RSI: 1.5,
    MACD: 2.0,
    TENDENCIA: 1.5,
    VOLUME: 0.8,
    STOCH: 1.2,
    WILLIAMS: 1.0,
    CONFIRMACAO: 1.0,
    LATERALIDADE: 1.8,
    VWAP: 1.3,
    VOLATILIDADE: 1.2
  },
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.02,
    R_R_MINIMO: 1.5,
    ATR_MULTIPLICADOR_SL: 1.5,
    ATR_MULTIPLICADOR_TP: 3
  },
  MARKET_HOURS: {
    LONDON_OPEN: 7,  // 7:00 GMT
    LONDON_CLOSE: 16, // 16:00 GMT
    NY_OPEN: 13,     // 13:00 GMT
    NY_CLOSE: 22     // 22:00 GMT
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
    
    // Verificar horário de mercado
    const gmtHours = now.getUTCHours();
    const isLondonOpen = gmtHours >= CONFIG.MARKET_HOURS.LONDON_OPEN && gmtHours < CONFIG.MARKET_HOURS.LONDON_CLOSE;
    const isNYOpen = gmtHours >= CONFIG.MARKET_HOURS.NY_OPEN && gmtHours < CONFIG.MARKET_HOURS.NY_CLOSE;
    state.marketOpen = isLondonOpen || isNYOpen;
    
    if (!state.marketOpen) {
      document.getElementById("comando").textContent = "MERCADO FECHADO";
      document.getElementById("comando").className = "esperar";
    }
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
// INDICADORES TÉCNICOS (ATUALIZADOS)
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

// =============================================
// SISTEMA DE DECISÃO (ATUALIZADO)
// =============================================
function avaliarTendencia(closes, emaCurta, emaLonga, ema200) {
  if (closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  if (detectarMercadoLateral(closes)) {
    state.contadorLaterais++;
    return "LATERAL";
  }
  
  state.contadorLaterais = 0;
  
  const ultimoClose = closes[closes.length - 1];
  const penultimoClose = closes[closes.length - 2];
  
  if ((ultimoClose > ema200 && emaCurta < emaLonga) ||
      (ultimoClose < ema200 && emaCurta > emaLonga)) {
    return "NEUTRA";
  }
  
  const diffEMAs = emaCurta - emaLonga;
  const threshold = 0.0005;
  
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

  // Análise de RSI
  if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) {
    score += 25 * CONFIG.PESOS.RSI;
    if (indicadores.tendencia.includes("BAIXA")) score -= 10;
  }
  else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) {
    score -= 25 * CONFIG.PESOS.RSI;
    if (indicadores.tendencia.includes("ALTA")) score += 10;
  }
  else if (indicadores.rsi < 45) score += 10 * CONFIG.PESOS.RSI;
  else if (indicadores.rsi > 55) score -= 10 * CONFIG.PESOS.RSI;

  // Análise MACD
  score += (Math.min(Math.max(indicadores.macd.histograma * 10, -15), 15) * CONFIG.PESOS.MACD);

  // Análise de Tendência
  switch(indicadores.tendencia) {
    case "FORTE_ALTA": 
      score += 20 * CONFIG.PESOS.TENDENCIA; 
      if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.2) score += 5;
      break;
    case "ALTA": score += 12 * CONFIG.PESOS.TENDENCIA; break;
    case "FORTE_BAIXA": 
      score -= 20 * CONFIG.PESOS.TENDENCIA; 
      if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.2) score -= 5;
      break;
    case "BAIXA": score -= 12 * CONFIG.PESOS.TENDENCIA; break;
    case "LATERAL": 
      score -= Math.min(state.contadorLaterais, 12) * CONFIG.PESOS.LATERALIDADE; 
      break;
  }

  // Análise de Volume
  if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
    score += (indicadores.tendencia.includes("ALTA") ? 8 : -8) * CONFIG.PESOS.VOLUME;
  }

  // Análise Stochastic
  if (indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && 
      indicadores.stoch.d < CONFIG.LIMIARES.STOCH_OVERSOLD) {
    score += 12 * CONFIG.PESOS.STOCH;
    if (indicadores.tendencia.includes("ALTA")) score -= 5;
  }
  if (indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && 
      indicadores.stoch.d > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
    score -= 12 * CONFIG.PESOS.STOCH;
    if (indicadores.tendencia.includes("BAIXA")) score += 5;
  }

  // Análise Williams
  if (indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) {
    score += 10 * CONFIG.PESOS.WILLIAMS; 
    if (indicadores.rsi < 40) score += 3;
  }
  if (indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) {
    score -= 10 * CONFIG.PESOS.WILLIAMS; 
    if (indicadores.rsi > 60) score -= 3;
  }

  // Análise VWAP (Nova)
  const vwapDesvio = Math.abs(indicadores.close - indicadores.vwap) / indicadores.vwap;
  if (vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO) {
    score += (indicadores.close > indicadores.vwap ? 8 : -8) * CONFIG.PESOS.VWAP;
  }

  // Análise de Volatilidade (ATR - Nova)
  if (indicadores.atr > CONFIG.LIMIARES.ATR_LIMIAR) {
    score += 5 * CONFIG.PESOS.VOLATILIDADE;
  }

  // Confirmações
  const confirmacoes = [
    indicadores.rsi < 40 || indicadores.rsi > 60,
    Math.abs(indicadores.macd.histograma) > 0.05,
    indicadores.stoch.k < 30 || indicadores.stoch.k > 70,
    indicadores.williams < -70 || indicadores.williams > -30,
    indicadores.tendencia !== "LATERAL",
    vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO * 0.8
  ].filter(Boolean).length;

  score += confirmacoes * 4 * CONFIG.PESOS.CONFIRMACAO;

  if (state.ultimoSinal) {
    score += (state.ultimoSinal === "CALL" ? -10 : 10);
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia) {
  if (tendencia === "LATERAL") {
    return score > 80 ? "CALL" : "ESPERAR";
  }
  if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
    if (tendencia === "NEUTRA") return score > 75 ? "CALL" : "ESPERAR";
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  return "ESPERAR";
}

// =============================================
// CORE DO SISTEMA (ATUALIZADO)
// =============================================
async function obterDadosForex() {
  for (const endpoint of CONFIG.API_ENDPOINTS) {
    try {
      let response, dados;
      if (endpoint.includes('twelvedata')) {
        const apiKey = rotacionarApiKey();
        response = await fetch(`${endpoint}/time_series?symbol=${CONFIG.PARES.EURUSD}&interval=1min&outputsize=150&apikey=${apiKey}`);
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
        response = await fetch(`${endpoint}/latest?amount=1&from=EUR&to=USD`);
        if (!response.ok) continue;
        const current = await response.json();
        const close = parseFloat(current.rates.USD);
        return [{ time: new Date().toISOString(), open: close, high: close, low: close, close, volume: 0 }];
      } else {
        response = await fetch(`${endpoint}/latest/EUR`);
        if (!response.ok) continue;
        dados = await response.json();
        if (dados.rates && dados.rates.USD) {
          const close = parseFloat(dados.rates.USD);
          return [{ time: new Date().toISOString(), open: close, high: close, low: close, close, volume: 0 }];
        }
      }
    } catch (e) {
      console.error(`Erro no endpoint ${endpoint}:`, e);
    }
  }
  throw new Error("Todos os endpoints falharam");
}

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
      tendencia: avaliarTendencia(closes, emaCurta, emaLonga, ema200)
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
        <li>📈 Stochastic K/D: ${indicadores.stoch.k.toFixed(2)}/${indicadores.stoch.d.toFixed(2)}</li>
        <li>📊 Williams: ${indicadores.williams.toFixed(2)}</li>
        <li>💰 Preço: €${indicadores.close.toFixed(5)} ${
          indicadores.close>emaCurta?'🟢':'🔴'}</li>
        <li>📶 Médias: EMA${CONFIG.PERIODOS.EMA_CURTA} ${indicadores.emaCurta.toFixed(5)} | EMA${CONFIG.PERIODOS.EMA_LONGA} ${indicadores.emaLonga.toFixed(5)} | EMA200 ${indicadores.ema200.toFixed(5)}</li>
        <li>💹 Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)}</li>
        <li>📌 VWAP: ${indicadores.vwap.toFixed(5)} | ATR: ${indicadores.atr.toFixed(6)}</li>
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
    const response = await fetch(`https://api.twelvedata.com/time_series?symbol=${CONFIG.PARES.EURUSD}&interval=1min&outputsize=${dias*1440}&apikey=${apiKey}`);
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
      const emaLonga = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA).slice(-1)[0];
      const ema200 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200).slice(-1)[0];
      
      const indicadores = {
        rsi: calcularRSI(closes),
        macd: calcularMACD(closes),
        emaCurta,
        emaLonga,
        ema200,
        volume: slice[i-1].volume,
        volumeMedia: calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME) || 1,
        stoch: calcularStochastic(highs, lows, closes),
        williams: calcularWilliams(highs, lows, closes),
        vwap: calcularVWAP(slice),
        atr: calcularATR(slice),
        close: slice[i-1].close,
        tendencia: avaliarTendencia(closes, emaCurta, emaLonga, ema200)
      };
      
      const score = calcularScore(indicadores);
      const sinal = determinarSinal(score, indicadores.tendencia);
      
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
  iniciarWebSocket();
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
