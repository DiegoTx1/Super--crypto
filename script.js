// =============================================
// CONFIGURAÇÕES GLOBAIS REVISADAS
// =============================================
const config = {
  symbol: "BTCIDX",
  binanceSymbol: "BTCUSDT",
  minConfidence: 65,
  historySize: 15,
  rsiOverbought: 70,
  rsiOversold: 30,
  volumeThreshold: 1.5 // Multiplicador de volume mínimo
};

let win = 0, loss = 0;
let ultimos = [];
let timer = 60;
let ultimaAtualizacao = "";
let leituraEmAndamento = false;
let intervaloAtual = null;
let tentativasErro = 0;
let ultimoSinalTimestamp = 0;
let bloqueioSinal = false;

// =============================================
// FUNÇÕES DE INDICADORES REVISADAS
// =============================================
function calcularEMA(dados, periodo) {
  if (!Array.isArray(dados) || dados.length < periodo) return null;
  
  const k = 2 / (periodo + 1);
  let ema = dados.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
  
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

// =============================================
// LÓGICA PRINCIPAL REVISADA
// =============================================
async function leituraReal() {
  if (leituraEmAndamento || bloqueioSinal) return;
  
  leituraEmAndamento = true;
  bloqueioSinal = true;

  try {
    // 1. OBTER DADOS DA BINANCE
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${config.binanceSymbol}&interval=1m&limit=100`);
    const dados = await response.json();
    
    const closes = dados.map(c => parseFloat(c[4]));
    const highs = dados.map(c => parseFloat(c[2]));
    const lows = dados.map(c => parseFloat(c[3]));
    const volumes = dados.map(c => parseFloat(c[5]));

    const currentPrice = closes[closes.length - 1];
    const currentVolume = volumes[volumes.length - 1];

    // 2. CALCULAR INDICADORES
    const rsi = calcularRSI(closes);
    const ema9 = calcularEMA(closes, 9);
    const ema21 = calcularEMA(closes, 21);
    const ema50 = calcularEMA(closes, 50);
    const volumeMedia = calcularEMA(volumes, 20) || 1;

    // 3. DETERMINAR TENDÊNCIA REAL (CORRIGIDA)
    let tendencia;
    if (currentPrice > ema50 && ema21 > ema50) {
      tendencia = "ALTA";
    } else if (currentPrice < ema50 && ema21 < ema50) {
      tendencia = "BAIXA";
    } else {
      tendencia = "LATERAL";
    }

    // 4. SISTEMA DE DECISÃO SIMPLIFICADO E EFETIVO
    let comando = "ESPERAR";
    let confidence = 0;

    // Condições para CALL
    if (tendencia === "ALTA" && rsi < config.rsiOversold && currentVolume > volumeMedia * config.volumeThreshold) {
      comando = "CALL";
      confidence = 70 + (config.rsiOversold - rsi);
    } 
    // Condições para PUT
    else if (tendencia === "BAIXA" && rsi > config.rsiOverbought && currentVolume > volumeMedia * config.volumeThreshold) {
      comando = "PUT";
      confidence = 70 + (rsi - config.rsiOverbought);
    }

    // 5. ATUALIZAR INTERFACE (COM TENDÊNCIA CLARA)
    document.getElementById("comando").textContent = comando;
    document.getElementById("score").textContent = `Confiança: ${Math.min(100, confidence)}%`;
    ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    document.getElementById("hora").textContent = ultimaAtualizacao;

    document.getElementById("criterios").innerHTML = `
      <li><strong>Tendência: ${tendencia}</strong></li>
      <li>Preço: $${currentPrice.toFixed(2)}</li>
      <li>RSI: ${rsi.toFixed(2)} ${rsi < 30 ? '🔻' : rsi > 70 ? '🔺' : ''}</li>
      <li>Volume: ${(currentVolume/volumeMedia).toFixed(2)}x média</li>
      <li>EMA9: ${ema9?.toFixed(2) || 'N/A'}</li>
      <li>EMA21: ${ema21?.toFixed(2) || 'N/A'}</li>
      <li>EMA50: ${ema50?.toFixed(2) || 'N/A'}</li>
    `;

    // 6. REGISTRAR SINAL SE HOUVER
    if (comando !== "ESPERAR") {
      tocarSom(comando);
      ultimos.unshift(`${ultimaAtualizacao} - ${comando} (${Math.round(confidence)}%)`);
      if (ultimos.length > config.historySize) ultimos.pop();
      document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");
      ultimoSinalTimestamp = Date.now();
    }

  } catch (e) {
    console.error("Erro na leitura:", e);
    document.getElementById("comando").textContent = "ERRO";
    document.getElementById("score").textContent = "Confiança: 0%";
    tentativasErro++;
    if (tentativasErro > 3) setTimeout(() => leituraReal(), 30000);
  } finally {
    leituraEmAndamento = false;
    setTimeout(() => { bloqueioSinal = false; }, 5000);
  }
}

// =============================================
// FUNÇÕES AUXILIARES (MANTIDAS)
// =============================================
function formatarTimer(segundos) {
  const mins = Math.floor(segundos / 60);
  const secs = segundos % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function tocarSom(tipo) {
  const som = document.getElementById(`som-${tipo.toLowerCase()}`);
  if (som) {
    som.currentTime = 0;
    som.play().catch(e => console.log("Erro ao tocar som:", e));
  }
}

function registrar(resultado) {
  if (resultado === "WIN") win++;
  if (resultado === "LOSS") loss++;
  document.getElementById("historico").textContent = `${win} WIN / ${loss} LOSS`;
}

function iniciarTimer() {
  clearInterval(intervaloAtual);
  
  const agora = Date.now();
  const delayProximaVela = 60000 - (agora % 60000);
  timer = Math.max(1, Math.floor(delayProximaVela / 1000));

  const elementoTimer = document.getElementById("timer");
  elementoTimer.textContent = formatarTimer(timer);
  elementoTimer.style.color = timer <= 5 ? 'red' : '';

  intervaloAtual = setInterval(() => {
    timer--;
    elementoTimer.textContent = formatarTimer(timer);
    elementoTimer.style.color = timer <= 5 ? 'red' : '';
    
    if (timer <= 0) {
      clearInterval(intervaloAtual);
      leituraReal().finally(iniciarTimer);
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function iniciarAplicativo() {
  // Configurar atualização do relógio
  setInterval(() => {
    document.getElementById("hora").textContent = new Date().toLocaleTimeString("pt-BR");
  }, 1000);
  
  // Iniciar ciclo de leitura
  iniciarTimer();
  leituraReal();
  
  // Atualizar preço periodicamente
  setInterval(async () => {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${config.binanceSymbol}`);
      const data = await response.json();
      const priceElements = document.querySelectorAll("#criterios li");
      if (priceElements.length > 1) {
        priceElements[1].innerHTML = `Preço: $${parseFloat(data.price).toFixed(2)}`;
      }
    } catch (e) {
      console.error("Erro ao atualizar preço:", e);
    }
  }, 5000);
}

// Iniciar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', iniciarAplicativo);
