// =============================================
// CONFIGURAÇÕES GLOBAIS (OTIMIZADAS)
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
  marketOpen: true,
  activeMarkets: []
};

const CONFIG = {
  API_ENDPOINTS: ["https://api.twelvedata.com"],
  WS_ENDPOINT: "wss://stream.twelvedata.com/v1/quotes/price",
  PARES: { EURUSD: "EUR/USD" },
  PERIODOS: {
    RSI: 14, EMA_CURTA: 9, EMA_LONGA: 21, EMA_200: 200,
    SMA_VOLUME: 20, MACD_RAPIDA: 12, MACD_LENTA: 26, MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3, ANALISE_LATERAL: 30, VWAP: 20, ATR: 14
  },
  LIMIARES: {
    SCORE_ALTO: 75, SCORE_MEDIO: 65,
    RSI_OVERBOUGHT: 65, RSI_OVERSOLD: 35,
    STOCH_OVERBOUGHT: 80, STOCH_OVERSOLD: 20,
    VOLUME_ALTO: 1.3, VARIACAO_LATERAL: 0.8,
    VWAP_DESVIO: 0.0015, ATR_LIMIAR: 0.0010
  }
};

// =============================================
// FUNÇÕES PRINCIPAIS (OTIMIZADAS)
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    const now = new Date();
    elementoHora.textContent = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    
    const gmtHours = now.getUTCHours();
    state.marketOpen = (gmtHours >= 7 && gmtHours < 16) || (gmtHours >= 13 && gmtHours < 22);
    
    const mercadoElement = document.getElementById("mercado-status");
    if (mercadoElement) {
      mercadoElement.innerHTML = state.marketOpen ? 
        "MERCADO ABERTO <span class='market-open'>●</span>" : 
        "MERCADO FECHADO <span class='market-closed'>●</span>";
      mercadoElement.className = state.marketOpen ? "market-open" : "market-closed";
    }
  }
}

async function obterDadosForex() {
  try {
    const apiKey = state.apiKeys[state.currentApiKeyIndex];
    const response = await fetch(
      `https://api.twelvedata.com/time_series?symbol=EUR/USD&interval=1min&outputsize=150&apikey=${apiKey}`
    );
    const dados = await response.json();
    return dados.values.map(v => ({
      time: v.datetime,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseFloat(v.volume)
    })).reverse();
  } catch (e) {
    console.error("Erro ao obter dados:", e);
    throw e;
  }
}

function calcularMediaSimples(dados, periodo) {
  if (!Array.isArray(dados) || dados.length < periodo) return null;
  const slice = dados.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

function calcularEMA(dados, periodo) {
  if (!Array.isArray(dados) || dados.length < periodo) return [];
  const k = 2 / (periodo + 1);
  let ema = calcularMediaSimples(dados.slice(0, periodo), periodo);
  const emaArray = [ema];
  
  for (let i = periodo; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
    emaArray.push(ema);
  }
  return emaArray;
}

function calcularRSI(closes, periodo = 14) {
  if (!Array.isArray(closes) || closes.length < periodo + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / periodo;
  const avgLoss = Math.max(losses / periodo, 1e-8);
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosForex();
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const volumes = dados.map(v => v.volume);

    const emaCurta = calcularEMA(closes, CONFIG.PERIODOS.EMA_CURTA).slice(-1)[0];
    const emaLonga = calcularEMA(closes, CONFIG.PERIODOS.EMA_LONGA).slice(-1)[0];
    const ema200 = calcularEMA(closes, CONFIG.PERIODOS.EMA_200).slice(-1)[0];
    
    const rsi = calcularRSI(closes);
    const volumeMedia = calcularMediaSimples(volumes, CONFIG.PERIODOS.SMA_VOLUME) || 1;
    
    // Análise simplificada de tendência
    let tendencia = "NEUTRA";
    if (emaCurta > emaLonga && emaLonga > ema200) tendencia = "ALTA";
    if (emaCurta < emaLonga && emaLonga < ema200) tendencia = "BAIXA";
    
    // Cálculo do score
    let score = 50;
    if (tendencia === "ALTA") score += 20;
    if (tendencia === "BAIXA") score -= 20;
    if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD) score += 15;
    if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) score -= 15;
    if (velaAtual.volume > volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) score += 10;
    
    score = Math.max(0, Math.min(100, score));
    const sinal = score >= CONFIG.LIMIARES.SCORE_ALTO ? 
                 (tendencia === "ALTA" ? "CALL" : "PUT") : 
                 "ESPERAR";

    // Atualizar interface
    const comandoElement = document.getElementById("comando");
    if (comandoElement) {
      comandoElement.textContent = sinal;
      comandoElement.className = sinal.toLowerCase();
      if (sinal === "CALL") comandoElement.textContent += " 📈";
      else if (sinal === "PUT") comandoElement.textContent += " 📉";
      else comandoElement.textContent += " ✋";
    }
    
    const scoreElement = document.getElementById("score");
    if (scoreElement) {
      scoreElement.textContent = `Confiança: ${score}%`;
      scoreElement.style.color = score >= CONFIG.LIMIARES.SCORE_ALTO ? '#00ff00' : 
                                score >= CONFIG.LIMIARES.SCORE_MEDIO ? '#ffff00' : '#ff0000';
    }

    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    const horaElement = document.getElementById("hora");
    if (horaElement) horaElement.textContent = state.ultimaAtualizacao;

    // Atualizar critérios
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>📊 Tendência: ${tendencia} ${tendencia === "ALTA" ? '🟢' : tendencia === "BAIXA" ? '🔴' : '🟡'}</li>
        <li>📉 RSI: ${rsi.toFixed(2)} ${rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
        <li>📶 Médias: EMA${CONFIG.PERIODOS.EMA_CURTA} ${emaCurta.toFixed(5)} | EMA${CONFIG.PERIODOS.EMA_LONGA} ${emaLonga.toFixed(5)}</li>
        <li>💰 Preço: €${velaAtual.close.toFixed(5)}</li>
        <li>💹 Volume: ${velaAtual.volume.toFixed(2)} vs Média ${volumeMedia.toFixed(2)}</li>
      `;
    }

  } catch (e) {
    console.error("Erro na análise:", e);
    if (++state.tentativasErro > 3) {
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
  state.timer = Math.max(1, Math.floor(delayProximaVela/1000));
  
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

function iniciarAplicativo() {
  // Verificar se todos elementos necessários existem
  const elementosNecessarios = ['comando', 'score', 'hora', 'timer', 'criterios'];
  const elementosFaltando = elementosNecessarios.filter(id => !document.getElementById(id));
  
  if (elementosFaltando.length > 0) {
    console.error("Elementos faltando:", elementosFaltando);
    setTimeout(iniciarAplicativo, 100);
    return;
  }

  // Adicionar elemento de status do mercado se não existir
  if (!document.getElementById("mercado-status")) {
    const mercadoElement = document.createElement("div");
    mercadoElement.id = "mercado-status";
    mercadoElement.style.marginTop = "10px";
    mercadoElement.style.fontWeight = "bold";
    document.querySelector(".container").appendChild(mercadoElement);
  }

  // Iniciar componentes
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  analisarMercado();
}

document.addEventListener("DOMContentLoaded", iniciarAplicativo);
