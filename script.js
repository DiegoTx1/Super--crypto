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
  return `0:${segundos.toString().padStart(2, '0')}`;
}

// =============================================
// INDICADORES TÉCNICOS (OTIMIZADOS)
// =============================================
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
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (periodo - 1) + gain) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
  }

  if (avgLoss <= 0.001) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, periodo = 14) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo) return { k: 50, d: 50 };
    
    const kValues = [];
    for (let i = periodo-1; i < closes.length; i++) {
      const highestHigh = Math.max(...highs.slice(i-periodo+1, i+1));
      const lowestLow = Math.min(...lows.slice(i-periodo+1, i+1));
      const currentClose = closes[i];
      kValues.push(((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100);
    }
    
    const dValues = kValues.length >= 3 ? calcularSMA(kValues, 3) : 50;
    return {
      k: kValues[kValues.length-1] || 50,
      d: dValues || 50
    };
  } catch (e) {
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularWilliams(highs, lows, closes, periodo = 14) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo) return 0;
    
    const highestHigh = Math.max(...highs.slice(-periodo));
    const lowestLow = Math.min(...lows.slice(-periodo));
    const currentClose = closes[closes.length-1];
    
    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  } catch (e) {
    console.error("Erro no cálculo Williams:", e);
    return 0;
  }
}

function calcularSerieEMA(dados, periodo) {
  if (!Array.isArray(dados) || dados.length < periodo) return [];
  
  const k = 2 / (periodo + 1);
  const emaArray = [];
  let soma = 0;
  
  for (let i = 0; i < periodo; i++) {
    soma += dados[i];
  }
  emaArray[periodo - 1] = soma / periodo;

  for (let i = periodo; i < dados.length; i++) {
    emaArray[i] = dados[i] * k + emaArray[i - 1] * (1 - k);
  }
  
  return emaArray;
}

function calcularSMA(dados, periodo) {
  if (!Array.isArray(dados) || dados.length < periodo) return null;
  return dados.slice(-periodo).reduce((a, b) => a + b, 0) / periodo;
}

function calcularMACD(closes, rapida = 12, lenta = 26, sinal = 9) {
  try {
    if (!Array.isArray(closes) || closes.length < lenta + sinal) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }

    const emaRapida = calcularSerieEMA(closes, rapida);
    const emaLenta = calcularSerieEMA(closes, lenta);
    
    if (!emaRapida.length || !emaLenta.length) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }

    const macdLinha = [];
    const inicio = Math.max(rapida, lenta);

    for (let i = inicio; i < closes.length; i++) {
      macdLinha[i] = emaRapida[i] - emaLenta[i];
    }

    const sinalLinha = calcularSerieEMA(macdLinha.slice(inicio), sinal);
    
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
// SISTEMA DE SCORE DE CONFIÂNCIA
// =============================================
function calcularScoreConfianca(indicadores) {
  let score = 50;

  if (indicadores.rsi < 30 || indicadores.rsi > 70) score += 15;
  else if (indicadores.rsi < 40 || indicadores.rsi > 60) score += 10;

  if (Math.abs(indicadores.macd.histograma) > 0.3) score += 15;
  else if (Math.abs(indicadores.macd.histograma) > 0.1) score += 10;

  if (indicadores.close > indicadores.ema21 && indicadores.ema21 > indicadores.ema50) score += 15;
  else if (indicadores.close < indicadores.ema21 && indicadores.ema21 < indicadores.ema50) score += 15;

  if (indicadores.volume > indicadores.volumeMedia * 1.3) score += 10;

  if (indicadores.stoch.k < 20 && indicadores.stoch.d < 20) score += 10;
  else if (indicadores.stoch.k > 80 && indicadores.stoch.d > 80) score += 10;

  if (indicadores.williams < -80) score += 10;
  else if (indicadores.williams > -20) score += 10;

  return Math.min(100, Math.max(0, score));
}

// =============================================
// LÓGICA PRINCIPAL (COM MELHORIAS)
// =============================================
async function leituraReal() {
  if (leituraEmAndamento) return;
  leituraEmAndamento = true;

  try {
    // Tenta endpoints alternativos em caso de falha
    let dados;
    for (const endpoint of API_ENDPOINTS) {
      try {
        const response = await fetch(`${endpoint}/klines?symbol=BTCUSDT&interval=1m&limit=150`);
        if (!response.ok) continue;
        dados = await response.json();
        if (Array.isArray(dados) && dados.length > 0) break;
      } catch (e) {
        console.error(`Erro no endpoint ${endpoint}:`, e);
      }
    }

    if (!Array.isArray(dados) || dados.length === 0) {
      throw new Error("Todos os endpoints falharam");
    }

    const dadosValidos = dados.filter(v => Array.isArray(v) && v.length >= 6);
    if (dadosValidos.length < 50) throw new Error("Dados insuficientes");

    const velaAtual = dadosValidos[dadosValidos.length - 1];
    const close = parseFloat(velaAtual[4]);
    const high = parseFloat(velaAtual[2]);
    const low = parseFloat(velaAtual[3]);
    const volume = parseFloat(velaAtual[5]);

    const closes = dadosValidos.map(v => parseFloat(v[4]));
    const highs = dadosValidos.map(v => parseFloat(v[2]));
    const lows = dadosValidos.map(v => parseFloat(v[3]));
    const volumes = dadosValidos.map(v => parseFloat(v[5]));

    // Calcula indicadores
    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    const sma9 = calcularSMA(closes, 9);
    const ema21Array = calcularSerieEMA(closes, 21);
    const ema21 = ema21Array[ema21Array.length - 1] || 0;
    const ema50Array = calcularSerieEMA(closes, 50);
    const ema50 = ema50Array[ema50Array.length - 1] || 0;
    const volumeMedia = calcularSMA(volumes, 20) || 0;
    const stoch = calcularStochastic(highs, lows, closes);
    const williams = calcularWilliams(highs, lows, closes);

    // Calcula score
    const scoreConfianca = calcularScoreConfianca({
      rsi, macd, close, ema21, ema50, volume, volumeMedia, stoch, williams
    });

    // Sistema de pontos
    let pontosCALL = 0, pontosPUT = 0;
    
    if (rsi < 40) pontosCALL += 1.2;
    if (rsi > 60) pontosPUT += 1.2;
    
    if (macd.histograma > 0.1) pontosCALL += 1.5;
    if (macd.histograma < -0.1) pontosPUT += 1.5;
    
    if (close > ema21) pontosCALL += 0.8;
    if (close < ema21) pontosPUT += 0.8;
    
    if (volume > volumeMedia * 1.2) {
      if (pontosCALL > pontosPUT) pontosCALL += 1;
      else pontosPUT += 1;
    }
    
    if (stoch.k < 20 && stoch.d < 20) pontosCALL += 1;
    if (stoch.k > 80 && stoch.d > 80) pontosPUT += 1;
    
    if (williams < -80) pontosCALL += 0.8;
    if (williams > -20) pontosPUT += 0.8;

    // Decisão com filtro de tendência
    const tendencia = close > ema50 && ema21 > ema50 ? "ALTA" :
                     close < ema50 && ema21 < ema50 ? "BAIXA" : "LATERAL";

    let comando = "ESPERAR";
    if (pontosCALL >= 2.5 && scoreConfianca >= 50) {
      comando = tendencia === "BAIXA" ? "ESPERAR" : "CALL";
    } else if (pontosPUT >= 2.5 && scoreConfianca >= 50) {
      comando = tendencia === "ALTA" ? "ESPERAR" : "PUT";
    }

    // Atualiza interface
    ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    document.getElementById("comando").textContent = comando;
    document.getElementById("score").textContent = `Confiança: ${scoreConfianca}%`;
    document.getElementById("hora").textContent = ultimaAtualizacao;

    document.getElementById("criterios").innerHTML = `
      <li>Tendência: ${tendencia}</li>
      <li>RSI: ${rsi.toFixed(2)} ${rsi < 40 ? '🔻' : rsi > 60 ? '🔺' : ''}</li>
      <li>MACD: ${macd.histograma.toFixed(4)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
      <li>Stochastic: K ${stoch.k.toFixed(2)} / D ${stoch.d.toFixed(2)}</li>
      <li>Williams: ${williams.toFixed(2)}</li>
      <li>Preço: $${close.toFixed(2)}</li>
      <li>Médias: SMA9 ${sma9?.toFixed(2) || 'N/A'} | EMA21 ${ema21.toFixed(2)} | EMA50 ${ema50.toFixed(2)}</li>
      <li>Volume: ${volume.toFixed(2)} vs Média ${volumeMedia.toFixed(2)}</li>
    `;

    // Histórico
    ultimos.unshift(`${ultimaAtualizacao} - ${comando} (${scoreConfianca}%)`);
    if (ultimos.length > 5) ultimos.pop();
    document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");

  } catch (e) {
    console.error("Erro na leitura:", e);
    document.getElementById("comando").textContent = "ERRO";
    document.getElementById("score").textContent = "Confiança: 0%";
    
    tentativasErro++;
    if (tentativasErro > 3) {
      console.error("Muitos erros consecutivos, reiniciando...");
      setTimeout(() => location.reload(), 10000);
    } else {
      setTimeout(() => leituraReal(), 10000);
    }
  } finally {
    leituraEmAndamento = false;
  }
}

// =============================================
// TIMER E INICIALIZAÇÃO (MELHORADOS)
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
  setInterval(atualizarRelogio, 1000);
  iniciarTimer();
  leituraReal();

  setInterval(async () => {
    try {
      const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
      if (!response.ok) return;
      const dados = await response.json();
      const precoElement = document.querySelector("#criterios li:nth-child(6)");
      if (precoElement && dados.lastPrice) {
        precoElement.textContent = `Preço: $${parseFloat(dados.lastPrice).toFixed(2)}`;
      }
    } catch (e) {
      console.error("Erro ao atualizar preço:", e);
    }
  }, 5000);
}

// Inicialização segura
document.addEventListener('DOMContentLoaded', iniciarAplicativo);
