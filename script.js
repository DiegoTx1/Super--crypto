

// --- Melhorias de assertividade ---
// Filtro de divergência RSI/CCI
function verificarDivergencia(rsiAtual, cciAtual, precoAtual, precoAnterior) {
  return ((rsiAtual > 70 && precoAtual < precoAnterior) ||
          (rsiAtual < 30 && precoAtual > precoAnterior)) &&
         ((cciAtual > 100 && precoAtual < precoAnterior) ||
          (cciAtual < -100 && precoAtual > precoAnterior));
}

// Confirmação de vela forte
function velaForte(velaAnterior, velaAtual) {
  return Math.abs(velaAtual - velaAnterior) > (0.5 * Math.abs(velaAnterior));
}

// Ajuste de níveis críticos
function rsiCritico(rsi) {
  return rsi <= 25 || rsi >= 75;
}

// Controle refinado de volatilidade com ATR
function volatilidadeOk(atr, mediaATR) {
  return atr < (mediaATR * 2);
}



let win = 0, loss = 0, timer = 60;
let ultimos = [];
let countdown = timer;

function atualizarHora() {
  const agora = new Date();
  document.getElementById("hora").textContent = agora.toLocaleTimeString("pt-BR");
}

function atualizarCronometro() {
  document.getElementById("proximaLeitura").textContent = countdown + "s";
  countdown--;
  if (countdown < 0) {
    countdown = timer;
    leituraReal();
  }
}

function registrar(tipo) {
  if (tipo === 'WIN') win++;
  else loss++;
  document.getElementById("historico").textContent = `${win} WIN / ${loss} LOSS`;
}

function calcularSMA(data, period) {
  if (data.length < period) return null;
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) {
    sum += parseFloat(data[i]);
  }
  return sum / period;
}

function calcularRSI(closes, period) {
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length - 1; i++) {
    let diff = closes[i + 1] - closes[i];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let rs = gains / (losses || 1);
  return 100 - (100 / (1 + rs));
}

function detectarEngolfo(velaAtual, velaAnterior) {
  let open = parseFloat(velaAtual[1]);
  let close = parseFloat(velaAtual[4]);
  let openPrev = parseFloat(velaAnterior[1]);
  let closePrev = parseFloat(velaAnterior[4]);
  return (close > open && closePrev < openPrev && close > openPrev && open < closePrev) ||
         (close < open && closePrev > openPrev && close < openPrev && open > closePrev);
}

function detectarMartelo(vela) {
  let open = parseFloat(vela[1]);
  let close = parseFloat(vela[4]);
  let high = parseFloat(vela[2]);
  let low = parseFloat(vela[3]);
  let body = Math.abs(close - open);
  let lowerShadow = open < close ? open - low : close - low;
  let upperShadow = high - Math.max(open, close);
  return lowerShadow > 2 * body && upperShadow < body;
}

function detectarEstrelaCadente(vela) {
  let open = parseFloat(vela[1]);
  let close = parseFloat(vela[4]);
  let high = parseFloat(vela[2]);
  let low = parseFloat(vela[3]);
  let body = Math.abs(close - open);
  let upperShadow = high - Math.max(open, close);
  let lowerShadow = Math.min(open, close) - low;
  return upperShadow > 2 * body && lowerShadow < body;
}

async function leituraReal() {
  try {
    const r = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=50");
    const dados = await r.json();

    const velaAtual = dados[dados.length - 1];
    const velaAnterior = dados[dados.length - 2];

    const open = parseFloat(velaAtual[1]);
    const high = parseFloat(velaAtual[2]);
    const low = parseFloat(velaAtual[3]);
    const close = parseFloat(velaAtual[4]);
    const range = high - low;
    const corpo = Math.abs(close - open);

    const closes = dados.map(v => parseFloat(v[4]));
    const sma = calcularSMA(closes, 14);
    const rsi = calcularRSI(closes, 14);

    let score = 0;

    if (close > open) score++;
    if (corpo > open * 0.001) score++;
    if (range > open * 0.002) score++;
    if (close > (open + range / 2)) score++;
    if ((high - close) < range * 0.15 || (open - low) < range * 0.15) score++;

    const openPrev = parseFloat(velaAnterior[1]);
    const closePrev = parseFloat(velaAnterior[4]);
    if ((close > open && closePrev > openPrev) || (close < open && closePrev < openPrev)) score++;

    if (detectarEngolfo(velaAtual, velaAnterior)) score++;
    if (detectarMartelo(velaAtual)) score++;
    if (detectarEstrelaCadente(velaAtual)) score++;

    if (sma && close > sma) score++;
    else if (sma && close < sma) score--;

    if (rsi > 70) score--;
    else if (rsi < 30) score++;

    let comando = "ESPERAR";
    if (score >= 7) comando = "CALL";
    else if (score <= 2) comando = "PUT";

    document.getElementById("comando").textContent = comando;
    document.getElementById("score").textContent = `${(score / 10 * 100).toFixed(0)}%`;

    const criterios = [
      `SMA: ${sma ? sma.toFixed(2) : "N/A"}`,
      `RSI: ${rsi.toFixed(2)}`,
      `Engolfo: ${detectarEngolfo(velaAtual, velaAnterior) ? "Sim" : "Não"}`,
      `Martelo: ${detectarMartelo(velaAtual) ? "Sim" : "Não"}`,
      `Estrela Cadente: ${detectarEstrelaCadente(velaAtual) ? "Sim" : "Não"}`
    ];

    document.getElementById("criterios").innerHTML = criterios.map(c => `<li>${c}</li>`).join("");
    document.getElementById("ultimaAnalise").textContent = new Date().toLocaleTimeString("pt-BR");

  } catch (e) {
    console.error("Erro na leitura:", e);
  }
}

setInterval(atualizarHora, 1000);
setInterval(atualizarCronometro, 1000);
