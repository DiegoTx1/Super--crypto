// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
let win = 0, loss = 0;
let ultimos = [];
let timer = 60;
let ultimaAtualizacao = "";

// =============================================
// FUNÇÕES PRINCIPAIS
// =============================================
function atualizarRelogio() {
  const agora = new Date();
  document.getElementById("hora").textContent = agora.toLocaleTimeString("pt-BR", {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function registrar(tipo) {
  if (tipo === 'WIN') win++;
  else loss++;
  document.getElementById("historico").textContent = `${win} WIN / ${loss} LOSS`;
}

function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

// =============================================
// ANÁLISE TÉCNICA COM MELHORIAS
// =============================================
async function leituraReal() {
  try {
    const response = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100");
    const dados = await response.json();
    const velaAtual = dados[dados.length - 1];
    const close = parseFloat(velaAtual[4]);
    const high = parseFloat(velaAtual[2]);
    const low = parseFloat(velaAtual[3]);

    const closes = dados.map(v => parseFloat(v[4]));
    const highs = dados.map(v => parseFloat(v[2]));
    const lows = dados.map(v => parseFloat(v[3]));

    const rsi = calcularRSI(closes, 14);
    const macd = calcularMACD(closes, 12, 26, 9);
    const sma9 = calcularSMA(closes, 9);
    const ema21 = calcularEMA(closes, 21);
    const ema50 = calcularEMA(closes, 50);
    const adx = calcularADX(highs, lows, closes, 14);
    const fractals = detectarFractais(highs, lows, 5);

    ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR", {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    let comando = "ESPERAR";
    if (rsi < 30 && sma9 > ema21 && ema21 > ema50 && macd.histograma > 0 && fractals.ultimo === "FUNDO" && adx > 25) {
      comando = "CALL";
    } else if (rsi > 70 && sma9 < ema21 && ema21 < ema50 && macd.histograma < 0 && fractals.ultimo === "TOPO" && adx > 25) {
      comando = "PUT";
    }

    document.getElementById("comando").textContent = comando;
    document.getElementById("score").textContent = `RSI: ${rsi.toFixed(2)} | ADX: ${adx.toFixed(2)}`;
    document.getElementById("hora").textContent = ultimaAtualizacao;

    document.getElementById("criterios").innerHTML = `
      <li>RSI: ${rsi.toFixed(2)} ${rsi < 30 ? "↓" : rsi > 70 ? "↑" : "-"}</li>
      <li>ADX: ${adx.toFixed(2)} ${adx > 25 ? "✅" : "✖️"}</li>
      <li>MACD: ${macd.histograma.toFixed(4)}</li>
      <li>Preço: $${close.toFixed(2)}</li>
      <li>Médias: ${sma9.toFixed(2)} > ${ema21.toFixed(2)} > ${ema50.toFixed(2)}</li>
      <li>Fractal: ${fractals.ultimo || "Nenhum"}</li>
    `;

    ultimos.unshift(`${ultimaAtualizacao} - ${comando} ($${close.toFixed(2)})`);
    if (ultimos.length > 5) ultimos.pop();
    document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");

    try {
      if (comando === "CALL") document.getElementById("som-call").play();
      if (comando === "PUT") document.getElementById("som-put").play();
    } catch (e) {
      console.warn("Erro ao reproduzir som:", e);
    }

  } catch (e) {
    console.error("Erro na análise:", e);
  }
}

// =============================================
// INDICADORES TÉCNICOS CORRIGIDOS
// =============================================
function calcularRSI(closes, periodo) {
  let gains = [], losses = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  let avgGain = gains.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
  let avgLoss = losses.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;

  for (let i = periodo; i < gains.length; i++) {
    avgGain = (avgGain * (periodo - 1) + gains[i]) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + losses[i]) / periodo;
  }

  const rs = avgGain / (avgLoss || 1e-10);
  return 100 - (100 / (1 + rs));
}

function calcularEMA(dados, periodo) {
  const k = 2 / (periodo + 1);
  let ema = dados.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
  for (let i = periodo; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcularSMA(dados, periodo) {
  const slice = dados.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

function calcularMACD(closes, rapida, lenta, sinal) {
  const macdSerie = [];
  for (let i = 0; i < closes.length; i++) {
    const emaRapida = calcularEMA(closes.slice(0, i + 1), rapida);
    const emaLenta = calcularEMA(closes.slice(0, i + 1), lenta);
    macdSerie.push(emaRapida - emaLenta);
  }
  const histograma = macdSerie[macdSerie.length - 1] - calcularEMA(macdSerie, sinal);
  return { histograma };
}

function calcularADX(highs, lows, closes, periodo) {
  let tr = [], plusDM = [], minusDM = [];

  for (let i = 1; i < highs.length; i++) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];

    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);

    const trueRange = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    tr.push(trueRange);
  }

  const tr14 = tr.slice(-periodo).reduce((a, b) => a + b, 0);
  const plusDM14 = plusDM.slice(-periodo).reduce((a, b) => a + b, 0);
  const minusDM14 = minusDM.slice(-periodo).reduce((a, b) => a + b, 0);

  const plusDI = 100 * (plusDM14 / tr14);
  const minusDI = 100 * (minusDM14 / tr14);
  const dx = 100 * Math.abs(plusDI - minusDI) / (plusDI + minusDI || 1e-10);

  return dx;
}

function detectarFractais(highs, lows, periodo) {
  const fractais = [];
  for (let i = periodo; i < highs.length - periodo; i++) {
    const top = Math.max(...highs.slice(i - periodo, i + periodo + 1));
    const bottom = Math.min(...lows.slice(i - periodo, i + periodo + 1));
    if (highs[i] === top) fractais.push({ tipo: "TOPO" });
    if (lows[i] === bottom) fractais.push({ tipo: "FUNDO" });
  }
  return { ultimo: fractais[fractais.length - 1]?.tipo };
}

// =============================================
// INICIALIZAÇÃO
// =============================================
setInterval(() => {
  timer--;
  document.getElementById("timer").textContent = formatarTimer(timer);
  if (timer <= 0) {
    leituraReal();
    timer = 60;
  }
}, 1000);

setInterval(atualizarRelogio, 1000);

setInterval(async () => {
  try {
    const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
    const dados = await response.json();
    document.getElementById("criterios").querySelector("li:nth-child(4)").textContent =
      `Preço: $${parseFloat(dados.lastPrice).toFixed(2)}`;
  } catch (e) {
    console.error("Erro ao atualizar preço:", e);
  }
}, 5000);

atualizarRelogio();
leituraReal();
