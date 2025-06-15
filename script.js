// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
let win = 0, loss = 0;
let ultimos = [];
let timer = 60;
let ultimaAtualizacao = "";
let leituraEmAndamento = false;
let intervaloAtual = null;

const API_ENDPOINTS = [
  "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1000",
  "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=800",
  "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=500",
];

// =============================================
// FUNÇÕES BÁSICAS
// =============================================
function formatarTimer(segundos) {
  return `00:${segundos.toString().padStart(2, "0")}`;
}

function calcularMedia(array) {
  const soma = array.reduce((a, b) => a + b, 0);
  return soma / array.length;
}

function calcularEMA(precos, periodo) {
  const k = 2 / (periodo + 1);
  let emaArray = [precos[0]];
  for (let i = 1; i < precos.length; i++) {
    emaArray.push(precos[i] * k + emaArray[i - 1] * (1 - k));
  }
  return emaArray;
}

function calcularRSI(closes, periodo = 14) {
  let ganhos = 0;
  let perdas = 0;
  for (let i = 1; i <= periodo; i++) {
    const diferenca = closes[i] - closes[i - 1];
    if (diferenca >= 0) ganhos += diferenca;
    else perdas -= diferenca;
  }
  const rs = ganhos / perdas;
  return 100 - 100 / (1 + rs);
}

function calcularMACD(closes, curto = 12, longo = 26, sinal = 9) {
  const emaCurto = calcularEMA(closes, curto);
  const emaLongo = calcularEMA(closes, longo);
  const macdLinha = emaCurto.map((val, idx) => val - emaLongo[idx]);
  const inicio = macdLinha.findIndex(v => !isNaN(v));
  const sinalLinha = calcularEMA(macdLinha.slice(inicio).filter(v => v !== undefined), sinal);
  const histograma = macdLinha.slice(-sinalLinha.length).map((val, idx) => val - sinalLinha[idx]);
  return {
    macd: macdLinha[macdLinha.length - 1],
    sinal: sinalLinha[sinalLinha.length - 1],
    histograma: histograma[histograma.length - 1]
  };
}

function calcularEstocastico(closes, low, high, periodo = 14) {
  const max = Math.max(...high.slice(-periodo));
  const min = Math.min(...low.slice(-periodo));
  return ((closes[closes.length - 1] - min) / (max - min)) * 100;
}

function calcularWilliamsR(closes, low, high, periodo = 14) {
  const max = Math.max(...high.slice(-periodo));
  const min = Math.min(...low.slice(-periodo));
  return ((max - closes[closes.length - 1]) / (max - min)) * -100;
}

// =============================================
// LEITURA PRINCIPAL
// =============================================
async function leituraReal() {
  if (leituraEmAndamento) return;
  leituraEmAndamento = true;

  try {
    const response = await fetch(API_ENDPOINTS[0]);
    const data = await response.json();

    const closes = data.map(d => parseFloat(d[4]));
    const low = data.map(d => parseFloat(d[3]));
    const high = data.map(d => parseFloat(d[2]));
    const volume = data.map(d => parseFloat(d[5]));

    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    const ema21 = calcularEMA(closes, 21).slice(-1)[0];
    const ema50 = calcularEMA(closes, 50).slice(-1)[0];
    const estocastico = calcularEstocastico(closes, low, high);
    const williamsR = calcularWilliamsR(closes, low, high);

    const precoAtual = closes[closes.length - 1];

    let scoreCall = 0;
    let scorePut = 0;

    if (rsi < 30) scoreCall++;
    if (rsi > 70) scorePut++;
    if (macd.histograma > 0) scoreCall++;
    if (macd.histograma < 0) scorePut++;
    if (precoAtual > ema21 && ema21 > ema50) scoreCall++;
    if (precoAtual < ema21 && ema21 < ema50) scorePut++;
    if (estocastico < 20) scoreCall++;
    if (estocastico > 80) scorePut++;
    if (williamsR < -80) scoreCall++;
    if (williamsR > -20) scorePut++;

    let acao = "ESPERAR";
    let cor = "white";
    const forca = Math.abs(scoreCall - scorePut);

    if (scoreCall >= 4 && scoreCall > scorePut) {
      acao = "CALL";
      cor = "lime";
    } else if (scorePut >= 4 && scorePut > scoreCall) {
      acao = "PUT";
      cor = "red";
    }

    document.getElementById("comando").textContent = acao;
    document.getElementById("comando").style.color = cor;
    document.getElementById("score").textContent = `Call: ${scoreCall} | Put: ${scorePut} | Força: ${forca}`;
    document.getElementById("hora").textContent = new Date().toLocaleTimeString();

    const precoElement = Array.from(document.querySelectorAll("#criterios li"))
      .find(li => li.textContent.startsWith("Preço:"));
    if (precoElement) precoElement.textContent = `Preço: ${precoAtual.toFixed(2)}`;

    if (acao !== "ESPERAR") {
      ultimos.unshift(`${acao} (${new Date().toLocaleTimeString()})`);
      if (ultimos.length > 10) ultimos.pop();
      document.getElementById("ultimos").innerHTML = ultimos.map(u => `<li>${u}</li>`).join("");
    }

    ultimaAtualizacao = new Date().toLocaleTimeString();
  } catch (erro) {
    console.error("Erro na leitura:", erro);
  } finally {
    leituraEmAndamento = false;
  }
}

// =============================================
// TIMER SINCRONIZADO
// =============================================
function iniciarTimer() {
  clearInterval(intervaloAtual);

  const agora = Date.now();
  const delayProximaVela = 60000 - (agora % 60000);
  timer = Math.max(1, Math.floor(delayProximaVela / 1000));

  const elementoTimer = document.getElementById("timer");
  if (!elementoTimer) return;

  elementoTimer.textContent = formatarTimer(timer);
  elementoTimer.style.color = timer <= 5 ? 'red' : '';

  intervaloAtual = setInterval(() => {
    timer--;
    if (!elementoTimer) return;
    elementoTimer.textContent = formatarTimer(timer);
    elementoTimer.style.color = timer <= 5 ? 'red' : '';

    if (timer <= 0) {
      clearInterval(intervaloAtual);
      leituraReal().finally(iniciarTimer);
    }
  }, 1000);
}

// =============================================
// INÍCIO AUTOMÁTICO
// =============================================
window.onload = () => {
  leituraReal().finally(iniciarTimer);
};
