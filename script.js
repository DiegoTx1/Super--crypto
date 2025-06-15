// =============================================
// CONFIGURAÇÕES GLOBAIS OTIMIZADAS PARA CRYPTO IDX
// =============================================
const config = {
  symbol: "BTCIDX",
  binanceSymbol: "BTCUSDT",
  multiplier: 1.15,          // Aumentado para refletir maior volatilidade do IDX
  minConfidence: 72,         // Aumentado para maior assertividade
  maxEntries: 3,
  leverage: 10,
  stopLossPercent: 4,        // Reduzido para o IDX
  takeProfitPercent: 10,     // Aumentado para o IDX
  historySize: 15,           // Aumentado de 5 para 15
  rsiOverbought: 68,         // Ajustado para o IDX
  rsiOversold: 32            // Ajustado para o IDX
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
// FUNÇÕES DE INDICADORES (OTIMIZADAS PARA IDX)
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
// FUNÇÕES DE INTERFACE
// =============================================
function atualizarRelogio() {
  const agora = new Date();
  ultimaAtualizacao = agora.toLocaleTimeString("pt-BR", {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  document.getElementById("hora").textContent = ultimaAtualizacao;
}

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

// =============================================
// LÓGICA PRINCIPAL (OTIMIZADA PARA CRYPTO IDX)
// =============================================
async function leituraReal() {
  if (leituraEmAndamento || bloqueioSinal) return;
  
  leituraEmAndamento = true;
  bloqueioSinal = true;

  try {
    // 1. OBTER DADOS DA BINANCE (como proxy para o IDX)
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${config.binanceSymbol}&interval=1m&limit=100`);
    const dados = await response.json();
    const closes = dados.map(c => parseFloat(c[4]));
    const highs = dados.map(c => parseFloat(c[2]));
    const lows = dados.map(c => parseFloat(c[3]));
    const volumes = dados.map(c => parseFloat(c[5]));

    // 2. CALCULAR INDICADORES COM AJUSTES PARA IDX
    const rsi = calcularRSI(closes);
    const ema9 = calcularEMA(closes, 9);
    const ema21 = calcularEMA(closes, 21);
    const ema50 = calcularEMA(closes, 50);
    const volumeMedia = calcularEMA(volumes, 20) || 1;
    const currentVolume = volumes[volumes.length - 1];
    const currentPrice = closes[closes.length - 1];

    // 3. TENDÊNCIA DETALHADA (corrigida e mais visível)
    const tendencia = currentPrice > ema21 && ema21 > ema50 ? "ALTA" :
                     currentPrice < ema21 && ema21 < ema50 ? "BAIXA" : 
                     "LATERAL";

    // 4. SISTEMA DE PONTOS PARA CRYPTO IDX
    let pontosCALL = 0, pontosPUT = 0;
    let confidence = 50;

    // Critérios otimizados para o IDX
    if (rsi < config.rsiOversold && currentPrice > ema21) {
      pontosCALL += 2;
      confidence += (config.rsiOversold - rsi) * 0.7; // Mais sensível
    }

    if (rsi > config.rsiOverbought && currentPrice < ema21) {
      pontosPUT += 2;
      confidence += (rsi - config.rsiOverbought) * 0.7; // Mais sensível
    }

    // Volume com ajuste maior para o IDX
    if (currentVolume > volumeMedia * 1.8) { // Limiar aumentado
      pontosCALL += 1;
      pontosPUT += 1;
      confidence += 15;
    }

    // Tendência com peso maior
    if (tendencia === "ALTA") {
      pontosCALL += 2;
      confidence += 10;
    } else if (tendencia === "BAIXA") {
      pontosPUT += 2;
      confidence += 10;
    }

    // 5. DECISÃO FINAL COM FILTROS PARA IDX
    let comando = "ESPERAR";
    confidence = Math.min(100, Math.max(config.minConfidence, confidence)); // Garante mínimo
    
    if (pontosCALL >= 4 && confidence >= config.minConfidence && tendencia !== "BAIXA") {
      comando = "CALL";
    } else if (pontosPUT >= 4 && confidence >= config.minConfidence && tendencia !== "ALTA") {
      comando = "PUT";
    }

    // 6. ATUALIZAR INTERFACE COMPLETA
    document.getElementById("comando").textContent = comando;
    document.getElementById("score").textContent = `Confiança: ${Math.round(confidence)}%`;
    atualizarRelogio();

    // CRITÉRIOS TÉCNICOS COMPLETOS (com tendência fixada)
    document.getElementById("criterios").innerHTML = `
      <li>Preço: $${currentPrice.toFixed(2)}</li>
      <li>Tendência: <strong>${tendencia}</strong></li>
      <li>RSI: ${rsi.toFixed(2)} ${rsi < config.rsiOversold ? '🔻' : rsi > config.rsiOverbought ? '🔺' : ''}</li>
      <li>EMA9: ${ema9?.toFixed(2) || 'N/A'}</li>
      <li>EMA21: ${ema21?.toFixed(2) || 'N/A'}</li>
      <li>EMA50: ${ema50?.toFixed(2) || 'N/A'}</li>
      <li>Volume: ${(currentVolume/volumeMedia).toFixed(2)}x média</li>
    `;

    // 7. REGISTRAR SINAL (histórico aumentado para 15)
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
// CONTROLE DO TIMER
// =============================================
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
  setInterval(atualizarRelogio, 1000);
  
  // Iniciar ciclo de leitura
  iniciarTimer();
  leituraReal();
  
  // Atualizar preço periodicamente
  setInterval(async () => {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${config.binanceSymbol}`);
      const data = await response.json();
      const priceElements = document.querySelectorAll("#criterios li");
      if (priceElements.length > 0) {
        priceElements[0].innerHTML = `Preço: $${parseFloat(data.price).toFixed(2)}`;
      }
    } catch (e) {
      console.error("Erro ao atualizar preço:", e);
    }
  }, 5000);
}

// Iniciar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarAplicativo);
} else {
  iniciarAplicativo();
}
