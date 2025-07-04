// =============================================
// CONFIGURAÇÕES AVANÇADAS PARA IDX M1 (2025)
// =============================================
const CONFIG = {
  PERIODOS: {
    EMA_RAPIDA: 3,
    EMA_MEDIA: 13,
    EMA_LONGA: 34,
    RSI: 7,
    VOLUME_LOOKBACK: 4,
    ATR: 14
  },
  LIMITES: {
    RSI_ALTO: 72,
    RSI_BAIXO: 30,
    VOLUME_THRESHOLD: 2.5,
    ATR_THRESHOLD: 0.015
  },
  PESOS: {
    TENDENCIA: 40,
    MOMENTUM: 30,
    VOLUME: 20,
    VOLATILIDADE: 10
  },
  HORARIOS_PREFERENCIAIS: [
    { start: 12, end: 15 },
    { start: 15, end: 18 },
    { start: 21, end: 24 }
  ]
};

// =============================================
// ESTADO DO SISTEMA
// =============================================
const state = {
  timer: 60,
  ultimos: [],
  ultimaAtualizacao: "",
  leituraEmAndamento: false,
  dadosHistoricos: [],
  ultimoSinal: "ESPERAR",
  ultimoScore: 0,
  historicoOperacoes: { win: 0, loss: 0 },
  intervaloTimer: null,
  consecutiveErrors: 0,
  lastTimestamp: null
};

// =============================================
// FUNÇÕES TÉCNICAS
// =============================================
function calcularEMA(dados, periodo) {
  if (!dados || dados.length < periodo) return null;
  
  let sma = 0;
  for (let i = 0; i < periodo; i++) {
    sma += dados[i];
  }
  sma /= periodo;
  
  const k = 2 / (periodo + 1);
  let ema = sma;
  
  for (let i = periodo; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
  }
  
  return ema;
}

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = closes.length - periodo; i < closes.length - 1; i++) {
    const diff = closes[i + 1] - closes[i];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / periodo;
  const avgLoss = losses / periodo;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
  if (dados.length < periodo + 1) return 0;
  
  const trueRanges = [];
  for (let i = dados.length - periodo; i < dados.length; i++) {
    const high = dados[i].high;
    const low = dados[i].low;
    const prevClose = i > 0 ? dados[i-1].close : dados[i].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  
  return trueRanges.reduce((sum, val) => sum + val, 0) / periodo;
}

function calcularVolumeRelativo(volumes, lookback = CONFIG.PERIODOS.VOLUME_LOOKBACK) {
  if (volumes.length < lookback) return 1.0;
  
  const volumeAtual = volumes[volumes.length - 1];
  const volumesAnteriores = volumes.slice(-lookback - 1, -1);
  const mediaVolumes = volumesAnteriores.reduce((s, v) => s + v, 0) / lookback;
  
  return mediaVolumes > 0 ? volumeAtual / mediaVolumes : 1.0;
}

function detectarImpulso(rapida, media, longa) {
  return rapida > media && media > longa;
}

function calcularForcaMercado() {
  const horaAtual = new Date().getUTCHours();
  const horaPreferencial = CONFIG.HORARIOS_PREFERENCIAIS.some(period => 
    horaAtual >= period.start && horaAtual < period.end
  );
  
  return horaPreferencial ? 1.15 : 0.85;
}

// =============================================
// GERADOR DE SINAIS
// =============================================
function gerarSinal() {
  if (state.dadosHistoricos.length < 50) {
    return { sinal: "ESPERAR", score: 0, criterios: ["Coletando dados..."] };
  }
  
  const dados = state.dadosHistoricos;
  const closes = dados.map(c => c.close);
  const volumes = dados.map(c => c.volume);
  
  const emaRapida = calcularEMA(closes, CONFIG.PERIODOS.EMA_RAPIDA);
  const emaMedia = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA);
  const emaLonga = calcularEMA(closes, CONFIG.PERIODOS.EMA_LONGA);
  const rsi = calcularRSI(closes);
  const atr = calcularATR(dados);
  const volumeRel = calcularVolumeRelativo(volumes);
  const forcaMercado = calcularForcaMercado();
  
  if ([emaRapida, emaMedia, emaLonga, rsi].some(val => val === null || isNaN(val))) {
    return { sinal: "ERRO", score: 0, criterios: ["Erro nos cálculos"] };
  }
  
  const impulsoAlta = detectarImpulso(emaRapida, emaMedia, emaLonga);
  const impulsoBaixa = detectarImpulso(emaLonga, emaMedia, emaRapida);
  
  let score = 0;
  const criterios = [];
  
  if (impulsoAlta) {
    score += CONFIG.PESOS.TENDENCIA;
    criterios.push(`✅ Tendência de Alta (${CONFIG.PESOS.TENDENCIA}%)`);
  } else if (impulsoBaixa) {
    score += CONFIG.PESOS.TENDENCIA;
    criterios.push(`✅ Tendência de Baixa (${CONFIG.PESOS.TENDENCIA}%)`);
  }
  
  if (impulsoAlta && rsi < CONFIG.LIMITES.RSI_ALTO && rsi > 40) {
    score += CONFIG.PESOS.MOMENTUM;
    criterios.push(`✅ Momentum Positivo (${CONFIG.PESOS.MOMENTUM}%)`);
  } else if (impulsoBaixa && rsi > CONFIG.LIMITES.RSI_BAIXO && rsi < 60) {
    score += CONFIG.PESOS.MOMENTUM;
    criterios.push(`✅ Momentum Negativo (${CONFIG.PESOS.MOMENTUM}%)`);
  }
  
  if (volumeRel > CONFIG.LIMITES.VOLUME_THRESHOLD) {
    score += CONFIG.PESOS.VOLUME;
    criterios.push(`🔥 Volume Anômalo (${CONFIG.PESOS.VOLUME}%)`);
  }
  
  if (atr > CONFIG.LIMITES.ATR_THRESHOLD) {
    score += CONFIG.PESOS.VOLATILIDADE;
    criterios.push(`📈 Volatilidade Elevada (${CONFIG.PESOS.VOLATILIDADE}%)`);
  }
  
  score = Math.min(100, Math.max(0, score * forcaMercado));
  
  let sinal = "ESPERAR";
  
  if (score >= 75 && impulsoAlta && rsi < 65) {
    sinal = "CALL";
    criterios.push("🚀 Sinal CALL confirmado");
  } 
  else if (score >= 75 && impulsoBaixa && rsi > 35) {
    sinal = "PUT";
    criterios.push("📉 Sinal PUT confirmado");
  }
  
  return { sinal, score, criterios };
}

// =============================================
// FUNÇÕES DE INTERFACE
// =============================================
function atualizarRelogio() {
  const now = new Date();
  state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  document.getElementById("hora").textContent = state.ultimaAtualizacao;
}

function atualizarInterface(sinal, score, criterios = []) {
  const comandoElement = document.getElementById("comando");
  const barraProgresso = document.getElementById("barra-progresso");
  
  comandoElement.className = "signal";
  comandoElement.classList.add(sinal.toLowerCase());
  
  if (sinal === "CALL") {
    comandoElement.textContent = "CALL 📈";
    try {
      document.getElementById("som-call").play();
    } catch (e) {
      console.log("Erro ao tocar som:", e);
    }
  } 
  else if (sinal === "PUT") {
    comandoElement.textContent = "PUT 📉";
    try {
      document.getElementById("som-put").play();
    } catch (e) {
      console.log("Erro ao tocar som:", e);
    }
  } 
  else if (sinal === "ERRO") {
    comandoElement.textContent = "ERRO ❌";
  } 
  else {
    comandoElement.textContent = "ESPERAR ✋";
  }
  
  document.getElementById("score").textContent = `${Math.round(score)}%`;
  barraProgresso.style.width = `${score}%`;
  
  if (score >= 75) barraProgresso.style.background = "linear-gradient(90deg, #00e676, #00b248)";
  else if (score >= 50) barraProgresso.style.background = "linear-gradient(90deg, #ffc107, #ff9800)";
  else barraProgresso.style.background = "linear-gradient(90deg, #f44336, #d32f2f)";
  
  const criteriosHTML = criterios.length 
    ? criterios.map(c => `<li>${c}</li>`).join("") 
    : "<li>Analisando condições de mercado...</li>";
  document.getElementById("criterios").innerHTML = criteriosHTML;
  
  state.ultimoSinal = sinal;
  state.ultimoScore = score;
  
  document.getElementById("wins").textContent = state.historicoOperacoes.win;
  document.getElementById("losses").textContent = state.historicoOperacoes.loss;
}

function registrar(resultado) {
  if (state.ultimoSinal === "CALL" || state.ultimoSinal === "PUT") {
    if (resultado === "WIN") state.historicoOperacoes.win++;
    else if (resultado === "LOSS") state.historicoOperacoes.loss++;
    
    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${state.ultimoSinal} (${resultado})`);
    if (state.ultimos.length > 8) state.ultimos.pop();
    
    const ultimosHTML = state.ultimos.length 
      ? state.ultimos.map(i => {
          const isCall = i.includes("CALL");
          return `<li class="${isCall ? 'call-history' : 'put-history'}">${i}</li>`;
        }).join("") 
      : "<li>Nenhum sinal registrado</li>";
    document.getElementById("ultimos").innerHTML = ultimosHTML;
  }
}

// =============================================
// SIMULADOR DE DADOS
// =============================================
function gerarDadosSimulados() {
  const ultimoClose = state.dadosHistoricos.length > 0 
    ? state.dadosHistoricos[state.dadosHistoricos.length - 1].close 
    : 35000;
  
  const variacao = (Math.random() - 0.5) * 0.015;
  const novoClose = ultimoClose * (1 + variacao);
  
  return {
    time: new Date().toISOString(),
    open: ultimoClose,
    high: Math.max(ultimoClose, novoClose) * (1 + Math.random() * 0.008),
    low: Math.min(ultimoClose, novoClose) * (1 - Math.random() * 0.008),
    close: novoClose,
    volume: 50000000 + Math.random() * 200000000
  };
}

// =============================================
// CICLO PRINCIPAL
// =============================================
function analisarMercado() {
  atualizarRelogio();
  
  const novoDado = gerarDadosSimulados();
  
  state.dadosHistoricos.push(novoDado);
  if (state.dadosHistoricos.length > 100) {
    state.dadosHistoricos.shift();
  }
  
  const { sinal, score, criterios } = gerarSinal();
  
  atualizarInterface(sinal, score, criterios);
  
  if (sinal === "CALL" || sinal === "PUT") {
    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${Math.round(score)}%)`);
    if (state.ultimos.length > 8) state.ultimos.pop();
    
    const ultimosHTML = state.ultimos.map(i => {
        const isCall = i.includes("CALL");
        return `<li class="${isCall ? 'call-history' : 'put-history'}">${i}</li>`;
    }).join("");
    document.getElementById("ultimos").innerHTML = ultimosHTML;
    
    setTimeout(() => {
        const resultado = Math.random() < 0.8 ? "WIN" : "LOSS";
        registrar(resultado);
    }, 5000);
  }
}

// =============================================
// CONTROLE DE TEMPO
// =============================================
function sincronizarTimer() {
  const agora = new Date();
  state.timer = 60 - agora.getSeconds();
  document.getElementById("timer").textContent = `${state.timer}s`;
  
  if (state.intervaloTimer) {
    clearInterval(state.intervaloTimer);
  }
  
  state.intervaloTimer = setInterval(() => {
    state.timer--;
    document.getElementById("timer").textContent = `${state.timer}s`;
    
    if (state.timer <= 0) {
      analisarMercado();
      state.timer = 60;
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function iniciar() {
  for (let i = 0; i < 50; i++) {
    const variacao = (Math.random() - 0.5) * 0.02;
    const close = 35000 * (1 + variacao);
    
    state.dadosHistoricos.push({
      time: new Date(Date.now() - (50 - i) * 60000).toISOString(),
      open: 35000 + Math.random() * 1000,
      high: close * (1 + Math.random() * 0.01),
      low: close * (1 - Math.random() * 0.01),
      close: close,
      volume: 50000000 + Math.random() * 200000000
    });
  }
  
  sincronizarTimer();
  setInterval(atualizarRelogio, 1000);
  atualizarRelogio();
  
  setTimeout(analisarMercado, 1000);
  
  atualizarInterface("ESPERAR", 0, ["Aguardando primeira análise..."]);
}

document.addEventListener("DOMContentLoaded", iniciar);
