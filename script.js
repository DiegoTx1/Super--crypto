// =============================================
// CONFIGURAÇÕES DO SISTEMA REAL
// =============================================
const CONFIG = {
  API_KEY: 'SUA_CHAVE_API_STOCKITY', // SUA CHAVE REAL AQUI
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
  ],
  SYMBOL: 'IDX/USDT',
  TRADE_AMOUNT: 100 // Valor em USDT por operação
};

// =============================================
// ESTADO DO SISTEMA
// =============================================
const state = {
  timer: 60,
  ultimosSinais: [],
  ultimaAtualizacao: "",
  dadosHistoricos: [],
  ultimoSinal: "ESPERAR",
  ultimoScore: 0,
  historicoOperacoes: { win: 0, loss: 0 },
  intervaloTimer: null,
  stockityConectado: false,
  precoAtual: 0,
  volumeAtual: 0,
  botAtivo: false
};

// =============================================
// FUNÇÕES DE CONEXÃO COM A STOCKITY
// =============================================
async function autenticarStockity() {
  try {
    const response = await fetch('https://api.stockity.com/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': CONFIG.API_KEY
      }
    });
    
    if (!response.ok) throw new Error('Falha na autenticação');
    
    const data = await response.json();
    state.stockityConectado = true;
    console.log('Autenticado com sucesso! Token:', data.token);
    return data.token;
  } catch (error) {
    console.error('Erro na autenticação:', error);
    state.stockityConectado = false;
    return null;
  }
}

async function obterDadosMercado() {
  try {
    const response = await fetch(`https://api.stockity.com/market-data?symbol=${CONFIG.SYMBOL}&timeframe=1m&limit=100`, {
      headers: {
        'X-API-KEY': CONFIG.API_KEY
      }
    });
    
    if (!response.ok) throw new Error('Erro ao obter dados');
    
    const data = await response.json();
    state.dadosHistoricos = data.candles;
    state.precoAtual = data.current_price;
    state.volumeAtual = data.current_volume;
    
    // Atualizar UI
    document.querySelector('.price-display').textContent = state.precoAtual.toFixed(4);
    
    return true;
  } catch (error) {
    console.error('Erro nos dados de mercado:', error);
    return false;
  }
}

async function executarOrdem(direcao) {
  try {
    const response = await fetch('https://api.stockity.com/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': CONFIG.API_KEY
      },
      body: JSON.stringify({
        symbol: CONFIG.SYMBOL,
        type: 'MARKET',
        side: direcao === 'CALL' ? 'BUY' : 'SELL',
        amount: CONFIG.TRADE_AMOUNT
      })
    });
    
    if (!response.ok) throw new Error('Erro na execução da ordem');
    
    const data = await response.json();
    console.log('Ordem executada:', data);
    
    // Registrar operação
    const novaOperacao = {
      id: data.orderId,
      time: new Date().toLocaleTimeString(),
      direction: direcao,
      amount: CONFIG.TRADE_AMOUNT,
      status: 'EXECUTED'
    };
    
    state.ultimosSinais.unshift(novaOperacao);
    if (state.ultimosSinais.length > 10) state.ultimosSinais.pop();
    
    atualizarHistorico();
    
    return data;
  } catch (error) {
    console.error('Erro ao executar ordem:', error);
    return null;
  }
}

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
  
  const closes = state.dadosHistoricos.map(c => c.close);
  const volumes = state.dadosHistoricos.map(c => c.volume);
  
  const emaRapida = calcularEMA(closes, CONFIG.PERIODOS.EMA_RAPIDA);
  const emaMedia = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA);
  const emaLonga = calcularEMA(closes, CONFIG.PERIODOS.EMA_LONGA);
  const rsi = calcularRSI(closes);
  const atr = calcularATR(state.dadosHistoricos);
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
  } 
  else if (sinal === "PUT") {
    comandoElement.textContent = "PUT 📉";
  } 
  else if (sinal === "ERRO") {
    comandoElement.textContent = "ERRO ❌";
  } 
  else {
    comandoElement.textContent = "AGUARDANDO SINAL";
  }
  
  document.getElementById("score").textContent = `${Math.round(score)}%`;
  barraProgresso.style.width = `${score}%`;
  
  if (score >= 75) barraProgresso.style.background = "linear-gradient(90deg, #00e676, #00b248)";
  else if (score >= 50) barraProgresso.style.background = "linear-gradient(90deg, #ffc107, #ff9800)";
  else barraProgresso.style.background = "linear-gradient(90deg, #f44336, #d32f2f)";
  
  const criteriosHTML = criterios.length 
    ? criterios.map(c => `<li><i class="fas fa-check-circle"></i> ${c}</li>`).join("") 
    : "<li><i class="fas fa-circle-notch fa-spin"></i> Analisando condições de mercado...</li>";
  document.getElementById("criterios").innerHTML = criteriosHTML;
  
  state.ultimoSinal = sinal;
  state.ultimoScore = score;
  
  document.getElementById("wins").textContent = state.historicoOperacoes.win;
  document.getElementById("losses").textContent = state.historicoOperacoes.loss;
}

function atualizarHistorico() {
  const historyList = document.getElementById("ultimos");
  historyList.innerHTML = "";
  
  if (state.ultimosSinais.length === 0) {
    historyList.innerHTML = "<li class='wait'>Nenhuma operação realizada</li>";
    return;
  }
  
  state.ultimosSinais.forEach(op => {
    const li = document.createElement("li");
    li.className = op.direction.toLowerCase();
    
    li.innerHTML = `
      <div class="trade-info">
        <div>${op.time}</div>
        <div>${op.direction} • $${op.amount}</div>
      </div>
      <div class="trade-status ${op.status === 'EXECUTED' ? 'status-success' : 'status-warning'}">
        ${op.status === 'EXECUTED' ? 'EXECUTADO' : 'PENDENTE'}
      </div>
    `;
    
    historyList.appendChild(li);
  });
}

// =============================================
// CICLO PRINCIPAL DE TRADING
// =============================================
async function analisarMercado() {
  if (!state.botAtivo) return;
  
  // Atualizar dados do mercado
  const dadosAtualizados = await obterDadosMercado();
  if (!dadosAtualizados) {
    atualizarInterface("ERRO", 0, ["Falha na conexão com a Stockity"]);
    return;
  }
  
  // Gerar sinal
  const { sinal, score, criterios } = gerarSinal();
  
  // Atualizar interface
  atualizarInterface(sinal, score, criterios);
  
  // Executar ordem se necessário
  if ((sinal === "CALL" || sinal === "PUT") && score >= 75) {
    const resultado = await executarOrdem(sinal);
    
    if (resultado) {
      // Atualizar histórico após execução
      setTimeout(atualizarHistorico, 1000);
    }
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
// INICIALIZAÇÃO DO SISTEMA
// =============================================
async function iniciar() {
  // Autenticar na Stockity
  const autenticado = await autenticarStockity();
  
  if (!autenticado) {
    document.querySelector(".indicator").classList.add("offline");
    document.querySelector(".status-indicator span").textContent = "Falha na conexão com a Stockity";
    return;
  }
  
  // Obter dados iniciais
  await obterDadosMercado();
  
  // Iniciar processos
  sincronizarTimer();
  setInterval(atualizarRelogio, 1000);
  atualizarRelogio();
  
  // Primeira análise
  setTimeout(analisarMercado, 1000);
  
  // Inicializar interface
  atualizarInterface("ESPERAR", 0, ["Aguardando primeira análise..."]);
  
  // Ativar bot
  state.botAtivo = true;
  
  // Configurar botão de parada
  document.getElementById("btn-refresh").addEventListener("click", analisarMercado);
}

document.addEventListener("DOMContentLoaded", iniciar);
