// =============================================
// CONFIGURAÇÕES GLOBAIS OTIMIZADAS
// =============================================
const config = {
  symbol: "BTCIDX",
  binanceSymbol: "BTCUSDT",
  emaSettings: {
    short: 8,     // EMA rápida - melhor resposta para o IDX
    medium: 21,   // EMA média - padrão ouro
    long: 55      // EMA longa - melhor para tendências no IDX
  },
  rsiSettings: {
    overbought: 70,
    oversold: 30,
    period: 14
  },
  volumeSettings: {
    period: 20,
    threshold: 1.8 // 1.8x a média
  },
  minConfidence: 75,
  trendConfirmation: 3, // Número de candles de confirmação
  historySize: 15,
  refreshInterval: 5000 // 5 segundos
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
// FUNÇÕES DE INDICADORES OTIMIZADAS
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

function calcularRSI(closes, periodo = config.rsiSettings.period) {
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
// FUNÇÕES DE ANÁLISE DE TENDÊNCIA
// =============================================
function verificarTendencia(closes) {
  const ema8 = calcularEMA(closes, config.emaSettings.short);
  const ema21 = calcularEMA(closes, config.emaSettings.medium);
  const ema55 = calcularEMA(closes, config.emaSettings.long);
  
  let confirmacaoAlta = 0;
  let confirmacaoBaixa = 0;
  const startIdx = closes.length - config.trendConfirmation;
  
  for (let i = startIdx; i < closes.length; i++) {
    if (closes[i] > ema21 && ema8 > ema21 && ema21 > ema55) confirmacaoAlta++;
    if (closes[i] < ema21 && ema8 < ema21 && ema21 < ema55) confirmacaoBaixa++;
  }

  if (confirmacaoAlta === config.trendConfirmation) return "ALTA_FORTE";
  if (confirmacaoBaixa === config.trendConfirmation) return "BAIXA_FORTE";
  
  return "LATERAL";
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

function atualizarInterface(sinal) {
  document.getElementById("comando").textContent = sinal.comando;
  document.getElementById("score").textContent = `Confiança: ${Math.round(sinal.confidence)}%`;
  document.getElementById("hora").textContent = ultimaAtualizacao;

  document.getElementById("criterios").innerHTML = `
    <li><strong>Tendência: ${sinal.tendencia.replace('_FORTE', '')}</strong></li>
    <li>Preço: $${sinal.price.toFixed(2)}</li>
    <li>RSI: ${sinal.rsi.toFixed(2)} ${sinal.rsi < config.rsiSettings.oversold ? '🔻' : sinal.rsi > config.rsiSettings.overbought ? '🔺' : ''}</li>
    <li>Volume: ${sinal.volumeRatio.toFixed(2)}x média</li>
    <li>EMA8: ${sinal.ema8.toFixed(2)}</li>
    <li>EMA21: ${sinal.ema21.toFixed(2)}</li>
    <li>EMA55: ${sinal.ema55.toFixed(2)}</li>
    ${sinal.motivo ? `<li>Motivo: ${sinal.motivo}</li>` : ''}
  `;

  if (sinal.comando !== "ESPERAR") {
    tocarSom(sinal.comando);
    ultimos.unshift(`${ultimaAtualizacao} - ${sinal.comando} (${Math.round(sinal.confidence)}%)`);
    if (ultimos.length > config.historySize) ultimos.pop();
    document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");
  }
}

// =============================================
// LÓGICA PRINCIPAL OTIMIZADA
// =============================================
async function gerarSinal() {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${config.binanceSymbol}&interval=1m&limit=100`);
    const dados = await response.json();
    
    const closes = dados.map(c => parseFloat(c[4]));
    const volumes = dados.map(c => parseFloat(c[5]));
    const currentPrice = closes[closes.length - 1];
    const currentVolume = volumes[volumes.length - 1];

    // Calcular indicadores
    const rsi = calcularRSI(closes);
    const tendencia = verificarTendencia(closes);
    const ema8 = calcularEMA(closes, config.emaSettings.short);
    const ema21 = calcularEMA(closes, config.emaSettings.medium);
    const ema55 = calcularEMA(closes, config.emaSettings.long);
    const volumeMedia = calcularEMA(volumes, config.volumeSettings.period) || 1;
    const volumeRatio = currentVolume / volumeMedia;

    // Estrutura base do sinal
    const sinal = {
      price: currentPrice,
      rsi,
      ema8,
      ema21,
      ema55,
      volumeRatio,
      tendencia,
      comando: "ESPERAR",
      confidence: 0,
      motivo: ""
    };

    // Filtro de volume
    if (volumeRatio < config.volumeSettings.threshold) {
      sinal.motivo = "Volume abaixo do limiar";
      return sinal;
    }

    // Sinal de CALL (compra)
    if (tendencia === "ALTA_FORTE" && rsi < config.rsiSettings.oversold) {
      sinal.comando = "CALL";
      sinal.confidence = 75 + (config.rsiSettings.oversold - rsi);
    }
    // Sinal de PUT (venda)
    else if (tendencia === "BAIXA_FORTE" && rsi > config.rsiSettings.overbought) {
      sinal.comando = "PUT";
      sinal.confidence = 75 + (rsi - config.rsiSettings.overbought);
    } else {
      sinal.motivo = "Aguardando confirmação";
    }

    return sinal;

  } catch (e) {
    console.error("Erro na geração de sinal:", e);
    return {
      comando: "ERRO",
      confidence: 0,
      motivo: "Falha na conexão"
    };
  }
}

async function leituraReal() {
  if (leituraEmAndamento || bloqueioSinal) return;
  
  leituraEmAndamento = true;
  bloqueioSinal = true;

  try {
    atualizarRelogio();
    const sinal = await gerarSinal();
    atualizarInterface(sinal);

    if (sinal.comando !== "ESPERAR" && sinal.comando !== "ERRO") {
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
      if (priceElements.length > 1) {
        priceElements[1].innerHTML = `Preço: $${parseFloat(data.price).toFixed(2)}`;
      }
    } catch (e) {
      console.error("Erro ao atualizar preço:", e);
    }
  }, config.refreshInterval);
}

// Iniciar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', iniciarAplicativo);
