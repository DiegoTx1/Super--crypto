// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
let win = 0, loss = 0;
let ultimos = [];
let timer = 60;
let ultimaAtualizacao = "";
let leituraEmAndamento = false;
let intervaloAtual = null;
let tentativasErro = 0;
let ultimoSinalTimestamp = 0;
let bloqueioSinal = false;

const API_ENDPOINTS = [
  "https://api.binance.com/api/v3",
  "https://api1.binance.com/api/v3", 
  "https://api2.binance.com/api/v3",
  "https://api3.binance.com/api/v3"
];

// =============================================
// FUNÇÕES BÁSICAS
// =============================================
function atualizarRelogio() {
  const agora = new Date();
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    elementoHora.textContent = agora.toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

function formatarTimer(segundos) {
  const mins = Math.floor(segundos / 60);
  const secs = segundos % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// =============================================
// FUNÇÕES DE INDICADORES
// =============================================
function calcularSMA(dados, periodo) {
  if (!Array.isArray(dados) || dados.length < periodo) return null;
  return dados.slice(-periodo).reduce((a, b) => a + b, 0) / periodo;
}

function calcularEMA(dados, periodo) {
  if (!Array.isArray(dados) || dados.length < periodo) return null;
  
  const k = 2 / (periodo + 1);
  let ema = calcularSMA(dados.slice(0, periodo), periodo);
  
  for (let i = periodo; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
  }
  
  return ema;
}

function calcularRSI(closes, periodo = 14) {
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
    avgGain = (avgGain * (periodo - 1) + (diff > 0 ? diff : 0)) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + (diff < 0 ? Math.abs(diff) : 0)) / periodo;
  }

  return avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
}

function calcularStochastic(highs, lows, closes, periodo = 14) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo) return { k: 50, d: 50 };
    
    const currentClose = closes[closes.length - 1];
    const highestHigh = Math.max(...highs.slice(-periodo));
    const lowestLow = Math.min(...lows.slice(-periodo));
    
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    return { k, d: k }; // Versão simplificada
  } catch (e) {
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularMACD(closes, rapida = 12, lenta = 26, sinal = 9) {
  try {
    if (!Array.isArray(closes) || closes.length < lenta + sinal) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }

    const emaRapida = calcularEMA(closes, rapida);
    const emaLenta = calcularEMA(closes, lenta);
    const macdLinha = emaRapida - emaLenta;
    const sinalLinha = calcularEMA(closes.slice(-sinal), sinal);
    
    return {
      histograma: macdLinha - sinalLinha,
      macdLinha,
      sinalLinha
    };
  } catch (e) {
    console.error("Erro no cálculo MACD:", e);
    return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  }
}

// =============================================
// LÓGICA PRINCIPAL SIMPLIFICADA
// =============================================
async function leituraReal() {
  if (leituraEmAndamento || bloqueioSinal) return;
  
  leituraEmAndamento = true;
  bloqueioSinal = true;

  try {
    const endpoint = API_ENDPOINTS[0];
    const response = await fetch(`${endpoint}/klines?symbol=BTCUSDT&interval=1m&limit=100`);
    if (!response.ok) throw new Error("Falha na requisição");
    
    const dados = await response.json();
    const dadosValidos = dados.filter(v => Array.isArray(v) && v.length >= 6);
    if (dadosValidos.length < 50) throw new Error("Dados insuficientes");

    const closes = dadosValidos.map(v => parseFloat(v[4]));
    const highs = dadosValidos.map(v => parseFloat(v[2]));
    const lows = dadosValidos.map(v => parseFloat(v[3]));
    const volumes = dadosValidos.map(v => parseFloat(v[5]));

    const close = closes[closes.length - 1];
    const volume = volumes[volumes.length - 1];

    // Calcula indicadores
    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    const ema9 = calcularEMA(closes, 9);
    const ema21 = calcularEMA(closes, 21);
    const ema50 = calcularEMA(closes, 50);
    const stoch = calcularStochastic(highs, lows, closes);
    const volumeMedia = calcularSMA(volumes, 20) || 1;

    // Tendência simplificada
    const tendencia = close > ema21 && ema21 > ema50 ? "ALTA" :
                     close < ema21 && ema21 < ema50 ? "BAIXA" : "LATERAL";

    // Sistema de pontos
    let pontosCALL = 0, pontosPUT = 0;
    
    if (rsi < 35) pontosCALL += 1;
    if (rsi > 65) pontosPUT += 1;
    
    if (macd.histograma > 0.1) pontosCALL += 1;
    if (macd.histograma < -0.1) pontosPUT += 1;
    
    if (close > ema9) pontosCALL += 1;
    if (close < ema9) pontosPUT += 1;
    
    if (volume > volumeMedia * 1.5) {
      pontosCALL += 1;
      pontosPUT += 1;
    }

    // Decisão final
    let comando = "ESPERAR";
    if (pontosCALL >= 3 && tendencia !== "BAIXA") comando = "CALL";
    else if (pontosPUT >= 3 && tendencia !== "ALTA") comando = "PUT";

    // Atualiza interface
    ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    if (document.getElementById("comando")) {
      document.getElementById("comando").textContent = comando;
      document.getElementById("score").textContent = `Confiança: ${Math.min(100, Math.max(0, (pontosCALL + pontosPUT) * 20))}%`;
      document.getElementById("hora").textContent = ultimaAtualizacao;

      document.getElementById("criterios").innerHTML = `
        <li>Tendência: ${tendencia}</li>
        <li>RSI: ${rsi.toFixed(2)}</li>
        <li>MACD: ${macd.histograma.toFixed(4)}</li>
        <li>Stochastic: K ${stoch.k.toFixed(2)}</li>
        <li>Preço: $${close.toFixed(2)}</li>
        <li>Médias: EMA9 ${ema9?.toFixed(2)} | EMA21 ${ema21?.toFixed(2)} | EMA50 ${ema50?.toFixed(2)}</li>
      `;

      // Atualiza histórico
      ultimos.unshift(`${ultimaAtualizacao} - ${comando}`);
      if (ultimos.length > 5) ultimos.pop();
      if (document.getElementById("ultimos")) {
        document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");
      }
    }

    if (comando !== "ESPERAR") {
      ultimoSinalTimestamp = Date.now();
    }

  } catch (e) {
    console.error("Erro na leitura:", e);
    if (document.getElementById("comando")) {
      document.getElementById("comando").textContent = "ERRO";
      document.getElementById("score").textContent = "Confiança: 0%";
    }
    tentativasErro++;
    if (tentativasErro > 3) {
      setTimeout(() => leituraReal(), 30000);
    }
  } finally {
    leituraEmAndamento = false;
    setTimeout(() => { bloqueioSinal = false; }, 5000);
  }
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function iniciarTimer() {
  clearInterval(intervaloAtual);
  
  const agora = Date.now();
  const delayProximaVela = 60000 - (agora % 60000);
  timer = Math.max(1, Math.floor(delayProximaVela / 1000));

  const elementoTimer = document.getElementById("timer");
  if (elementoTimer) {
    elementoTimer.textContent = formatarTimer(timer);
    elementoTimer.style.color = timer <= 5 ? 'red' : '';
  }

  intervaloAtual = setInterval(() => {
    timer--;
    if (elementoTimer) {
      elementoTimer.textContent = formatarTimer(timer);
      elementoTimer.style.color = timer <= 5 ? 'red' : '';
    }
    
    if (timer <= 0) {
      clearInterval(intervaloAtual);
      leituraReal().finally(iniciarTimer);
    }
  }, 1000);
}

function iniciarAplicativo() {
  if (!document.getElementById("hora")) {
    setTimeout(iniciarAplicativo, 100);
    return;
  }

  setInterval(atualizarRelogio, 1000);
  iniciarTimer();
  leituraReal();
}

document.addEventListener('DOMContentLoaded', iniciarAplicativo);
