// =============================================
// CONFIGURAÇÕES GLOBAIS
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
  marketOpen: true,
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  dadosHistoricos: [],
  resistenciaKey: 0,
  suporteKey: 0,
  rsiCache: { avgGain: 0, avgLoss: 0, initialized: false },
  emaCache: {
    ema5: null,
    ema13: null
  },
  macdCache: {
    emaRapida: null,
    emaLenta: null,
    macdLine: [],
    signalLine: []
  },
  superTrendCache: [],
  atrGlobal: 0,
  rsiHistory: [],
  cooldown: 0
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com"
  },
  PARES: {
    CRYPTO_IDX: "BTC/USD"
  },
  PERIODOS: {
    RSI: 9,
    STOCH_K: 14,
    STOCH_D: 3,
    EMA_CURTA: 5,
    EMA_MEDIA: 13,
    MACD_RAPIDA: 6,
    MACD_LENTA: 13,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 7,
    DIVERGENCIA_LOOKBACK: 8,
    EXTREME_LOOKBACK: 2
  },
  LIMIARES: {
    SCORE_ALTO: 85,
    SCORE_MEDIO: 70,
    RSI_OVERBOUGHT: 75,
    RSI_OVERSOLD: 25,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    VARIACAO_LATERAL: 0.005,
    ATR_LIMIAR: 0.015,
    LATERALIDADE_LIMIAR: 0.005
  },
  PESOS: {
    RSI: 1.7,
    MACD: 2.2,
    TENDENCIA: 2.8,
    STOCH: 1.2,
    SUPERTREND: 1.9,
    DIVERGENCIA: 2.0
  }
};

// =============================================
// FUNÇÕES PRINCIPAIS CORRIGIDAS
// =============================================

// Função EMA corrigida
function calcularEMA(dados, periodo) {
  if (dados.length < periodo) return null;
  
  const k = 2 / (periodo + 1);
  let ema = dados.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
  
  for (let i = periodo; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
  }
  
  return ema;
}

// Detecção de divergências simplificada e funcional
function detectarDivergencias(closes, rsis) {
  if (closes.length < 5 || rsis.length < 5) {
    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
  }

  const ultimoClose = closes[closes.length - 1];
  const penultimoClose = closes[closes.length - 2];
  const ultimoRSI = rsis[rsis.length - 1];
  const penultimoRSI = rsis[rsis.length - 2];

  // Divergência de alta: Preço faz fundo mais baixo mas RSI faz fundo mais alto
  if (ultimoClose < penultimoClose && ultimoRSI > penultimoRSI) {
    return { divergenciaRSI: true, tipoDivergencia: "ALTA" };
  }
  
  // Divergência de baixa: Preço faz topo mais alto mas RSI faz topo mais baixo
  if (ultimoClose > penultimoClose && ultimoRSI < penultimoRSI) {
    return { divergenciaRSI: true, tipoDivergencia: "BAIXA" };
  }
  
  return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
}

// Gerador de dados simulados funcional
function simularDados() {
  const dados = [];
  let preco = 50000;
  
  for (let i = 0; i < 100; i++) {
    const variacao = (Math.random() - 0.5) * 1000;
    preco += variacao;
    
    dados.push({
      time: new Date(Date.now() - (100 - i) * 60000).toISOString(),
      open: preco - variacao,
      close: preco,
      high: preco + Math.random() * 500,
      low: preco - Math.random() * 500,
      volume: 1000000 + Math.random() * 500000
    });
  }
  
  return dados;
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================
function calcularMediaSimples(dados, periodo) {
  if (!Array.isArray(dados) || dados.length < periodo) return null;
  const slice = dados.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / periodo;
  const avgLoss = losses / periodo;
  
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes) {
  if (closes.length < 14) return { k: 50, d: 50 };
  
  const currentClose = closes[closes.length - 1];
  const lowestLow = Math.min(...lows.slice(-14));
  const highestHigh = Math.max(...highs.slice(-14));
  
  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  return { k, d: k }; // Simplificado para demonstração
}

function calcularMACD(closes) {
  const ema12 = calcularEMA(closes, 12);
  const ema26 = calcularEMA(closes, 26);
  
  if (!ema12 || !ema26) return { histograma: 0 };
  
  const macdLine = ema12 - ema26;
  return { histograma: macdLine };
}

function calcularATR(dados) {
  if (dados.length < 2) return 0;
  
  const current = dados[dados.length - 1];
  const previous = dados[dados.length - 2];
  
  const tr = Math.max(
    current.high - current.low,
    Math.abs(current.high - previous.close),
    Math.abs(current.low - previous.close)
  );
  
  return tr;
}

function calcularSuperTrend(dados) {
  if (dados.length < 2) return { direcao: 0, valor: 0 };
  
  const current = dados[dados.length - 1];
  return { 
    direcao: current.close > current.open ? 1 : -1,
    valor: (current.high + current.low) / 2 
  };
}

function detectarLateralidade(closes) {
  if (closes.length < 20) return false;
  
  const min = Math.min(...closes.slice(-20));
  const max = Math.max(...closes.slice(-20));
  const range = max - min;
  const avgPrice = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  
  return (range / avgPrice) < 0.01;
}

// =============================================
// CORE DO SISTEMA
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = simularDados();
    state.dadosHistoricos = dados;
    
    if (dados.length < 20) {
      throw new Error(`Dados insuficientes (${dados.length} velas)`);
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);

    // Calcular indicadores
    const ema5 = calcularEMA(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema13 = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA);
    const superTrend = calcularSuperTrend(dados);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    const atr = calcularATR(dados);
    
    // Preencher histórico de RSI
    state.rsiHistory = [];
    for (let i = 10; i < closes.length; i++) {
      state.rsiHistory.push(calcularRSI(closes.slice(0, i+1)));
    }
    
    const divergencias = detectarDivergencias(closes, state.rsiHistory);
    const lateral = detectarLateralidade(closes);
    
    // Avaliar tendência
    const diff = ema5 - ema13;
    const forcaTendencia = Math.min(100, Math.abs(diff * 10000));
    let tendencia;
    
    if (forcaTendencia > 75) {
      tendencia = diff > 0 ? "FORTE_ALTA" : "FORTE_BAIXA";
    } else if (forcaTendencia > 40) {
      tendencia = diff > 0 ? "ALTA" : "BAIXA";
    } else {
      tendencia = "NEUTRA";
    }

    state.tendenciaDetectada = tendencia;
    state.forcaTendencia = forcaTendencia;

    // Calcular suporte/resistência
    const prices = closes.slice(-50);
    state.resistenciaKey = Math.max(...prices);
    state.suporteKey = Math.min(...prices);

    // Gerar sinal
    let sinal = "ESPERAR";
    
    if (tendencia === "FORTE_ALTA" && velaAtual.close > ema5 && macd.histograma > 0) {
      sinal = "CALL";
    }
    else if (tendencia === "FORTE_BAIXA" && velaAtual.close < ema5 && macd.histograma < 0) {
      sinal = "PUT";
    }
    else if (divergencias.divergenciaRSI) {
      sinal = divergencias.tipoDivergencia === "ALTA" ? "CALL" : "PUT";
    }
    else if (rsi < 30 && velaAtual.close > ema13) {
      sinal = "CALL";
    }
    else if (rsi > 70 && velaAtual.close < ema13) {
      sinal = "PUT";
    }

    // Calcular score
    let score = 60;
    if (sinal !== "ESPERAR") {
      if (tendencia.includes(sinal === "CALL" ? "ALTA" : "BAIXA")) score += 20;
      if (divergencias.divergenciaRSI) score += 15;
      if (velaAtual.close > ema13) score += 10;
    }

    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    // Atualizar interface
    const comandoElement = document.getElementById("comando");
    const scoreElement = document.getElementById("score");
    const tendenciaElement = document.getElementById("tendencia");
    const forcaElement = document.getElementById("forca-tendencia");
    const timerElement = document.getElementById("timer");
    const horaElement = document.getElementById("hora");
    const suporteElement = document.getElementById("suporte");
    const resistenciaElement = document.getElementById("resistencia");
    
    if (comandoElement) {
      comandoElement.textContent = sinal;
      comandoElement.className = `signal-box ${sinal.toLowerCase()}`;
    }
    
    if (scoreElement) {
      scoreElement.textContent = `${score}%`;
      scoreElement.className = score > 70 ? "signal-high" : score > 60 ? "signal-medium" : "signal-low";
    }
    
    if (tendenciaElement) tendenciaElement.textContent = tendencia;
    if (forcaElement) forcaElement.textContent = `${forcaTendencia}%`;
    if (timerElement) timerElement.textContent = formatarTimer(state.timer);
    if (horaElement) horaElement.textContent = state.ultimaAtualizacao;
    if (suporteElement) suporteElement.textContent = state.suporteKey.toFixed(2);
    if (resistenciaElement) resistenciaElement.textContent = state.resistenciaKey.toFixed(2);

    // Atualizar histórico
    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 5) state.ultimos.pop();
    
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) {
      ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
    }

    state.tentativasErro = 0;
  } catch (e) {
    console.error("Erro na análise:", e);
    const comandoElement = document.getElementById("comando");
    if (comandoElement) {
      comandoElement.textContent = "ERRO";
      comandoElement.className = "signal-box erro";
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// FUNÇÕES DE TEMPO E INICIALIZAÇÃO
// =============================================
function formatarTimer(segundos) {
  const min = Math.floor(segundos / 60);
  const sec = segundos % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  
  const agora = new Date();
  const segundos = agora.getSeconds();
  state.timer = 60 - segundos;
  
  const timerElement = document.getElementById("timer");
  if (timerElement) timerElement.textContent = formatarTimer(state.timer);
  
  state.intervaloAtual = setInterval(() => {
    state.timer--;
    
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado();
      sincronizarTimer();
    } else {
      if (timerElement) timerElement.textContent = formatarTimer(state.timer);
    }
  }, 1000);
}

function iniciarAplicativo() {
  // Criar elementos básicos se não existirem
  if (!document.getElementById("comando")) {
    const appContainer = document.createElement("div");
    appContainer.id = "trading-app";
    appContainer.innerHTML = `
      <div class="header">
        <h2>Analisador Cripto</h2>
        <div class="time-info">
          <span id="hora">00:00:00</span> | 
          <span id="timer">1:00</span>
        </div>
      </div>
      
      <div class="main-signal">
        <div id="comando" class="signal-box esperar">---</div>
        <div id="score" class="signal-medium">0%</div>
      </div>
      
      <div class="tendency-info">
        <div>Tendência: <span id="tendencia">NEUTRA</span></div>
        <div>Força: <span id="forca-tendencia">0%</span></div>
      </div>
      
      <div class="levels">
        <div>Suporte: <span id="suporte">0</span></div>
        <div>Resistência: <span id="resistencia">0</span></div>
      </div>
      
      <div class="history">
        <h3>Últimos Sinais</h3>
        <ul id="ultimos"></ul>
      </div>
    `;
    document.body.appendChild(appContainer);
    
    // Adicionar estilos básicos
    const style = document.createElement("style");
    style.textContent = `
      #trading-app {
        font-family: Arial, sans-serif;
        max-width: 400px;
        margin: 20px auto;
        padding: 20px;
        border: 1px solid #ccc;
        border-radius: 10px;
        background-color: #f9f9f9;
      }
      .header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 15px;
      }
      .main-signal {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
      }
      .signal-box {
        padding: 20px;
        border-radius: 8px;
        font-weight: bold;
        font-size: 24px;
        min-width: 100px;
        text-align: center;
      }
      .esperar { background-color: #e0e0e0; color: #333; }
      .call { background-color: #4CAF50; color: white; }
      .put { background-color: #F44336; color: white; }
      .erro { background-color: #FF9800; color: white; }
      #score {
        padding: 20px;
        border-radius: 8px;
        font-size: 24px;
        display: flex;
        align-items: center;
      }
      .signal-high { background-color: #4CAF50; color: white; }
      .signal-medium { background-color: #FFC107; color: black; }
      .signal-low { background-color: #F44336; color: white; }
      .tendency-info, .levels {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .history ul {
        list-style: none;
        padding: 0;
      }
      .history li {
        padding: 5px;
        border-bottom: 1px solid #eee;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Iniciar processos
  setInterval(() => {
    const agora = new Date();
    const hora = agora.toLocaleTimeString("pt-BR");
    const horaElement = document.getElementById("hora");
    if (horaElement) horaElement.textContent = hora;
  }, 1000);
  
  sincronizarTimer();
  setTimeout(analisarMercado, 1000);
}

// Iniciar quando o documento estiver pronto
if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
