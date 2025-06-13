// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
let win = 0, loss = 0;
let ultimos = [];
let timer = 60;
let ultimaAtualizacao = "";

// =============================================
// FUNÇÕES BÁSICAS
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
// INDICADORES
// =============================================
function calcularRSI(closes, periodo) {
  if (closes.length < periodo + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / periodo;
  let avgLoss = losses / periodo;

  for (let i = periodo + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (periodo - 1) + gain) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularSerieEMA(dados, periodo) {
  const k = 2 / (periodo + 1);
  const emaArray = [];
  let soma = 0;
  for (let i = 0; i < periodo; i++) soma += dados[i];
  emaArray[periodo - 1] = soma / periodo;
  for (let i = periodo; i < dados.length; i++) {
    emaArray[i] = dados[i] * k + emaArray[i - 1] * (1 - k);
  }
  return emaArray;
}

function calcularSMA(dados, periodo) {
  if (dados.length < periodo) return null;
  const slice = dados.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

function calcularMACD(closes, rapida, lenta, sinal) {
  const emaRapida = calcularSerieEMA(closes, rapida);
  const emaLenta = calcularSerieEMA(closes, lenta);
  const macdLinha = [];
  const inicio = Math.max(rapida, lenta);
  for (let i = inicio; i < closes.length; i++) {
    macdLinha[i] = emaRapida[i] - emaLenta[i];
  }
  const macdValidos = macdLinha.slice(inicio).filter(v => v !== null && v !== undefined);
  const sinalLinha = calcularSerieEMA(macdValidos, sinal);
  const ultimoMACD = macdLinha[macdLinha.length - 1];
  const ultimoSinal = sinalLinha[sinalLinha.length - 1];
  const histograma = (ultimoMACD !== null && ultimoSinal !== undefined) ? ultimoMACD - ultimoSinal : 0;
  return { histograma };
}

function calcularADX(highs, lows, closes, periodo) {
  if (highs.length < periodo + 1) return 0;
  const tr = [], plusDM = [], minusDM = [];
  for (let i = 1; i < highs.length; i++) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];
    plusDM.push((highDiff > lowDiff && highDiff > 0) ? highDiff : 0);
    minusDM.push((lowDiff > highDiff && lowDiff > 0) ? lowDiff : 0);
    const trueRange = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    tr.push(trueRange);
  }

  function calcularEMAArray(dados, periodo) {
    const k = 2 / (periodo + 1);
    const emaArray = [];
    let soma = 0;
    for (let i = 0; i < periodo; i++) soma += dados[i];
    emaArray[periodo - 1] = soma / periodo;
    for (let i = periodo; i < dados.length; i++) {
      emaArray[i] = dados[i] * k + emaArray[i - 1] * (1 - k);
    }
    return emaArray;
  }

  const trEMA = calcularEMAArray(tr, periodo);
  const plusDMEMA = calcularEMAArray(plusDM, periodo);
  const minusDMEMA = calcularEMAArray(minusDM, periodo);
  const plusDI = plusDMEMA.map((v, i) => 100 * (v / (trEMA[i] || 1e-10)));
  const minusDI = minusDMEMA.map((v, i) => 100 * (v / (trEMA[i] || 1e-10)));
  const dx = plusDI.map((v, i) => {
    const sum = v + minusDI[i];
    return sum ? 100 * Math.abs(v - minusDI[i]) / sum : 0;
  });
  const adxArray = calcularEMAArray(dx, periodo);
  return adxArray[adxArray.length - 1] || 0;
}

function detectarFractais(highs, lows, periodo) {
  if (highs.length < periodo * 2 + 1) return { ultimo: null };
  const fractais = [];
  for (let i = periodo; i <= highs.length - periodo - 1; i++) {
    const janelaHigh = highs.slice(i - periodo, i + periodo + 1);
    const janelaLow = lows.slice(i - periodo, i + periodo + 1);
    const top = Math.max(...janelaHigh);
    const bottom = Math.min(...janelaLow);
    if (highs[i] === top) fractais.push({ tipo: "TOPO" });
    else if (lows[i] === bottom) fractais.push({ tipo: "FUNDO" });
  }
  return { ultimo: fractais.length ? fractais[fractais.length - 1].tipo : null };
}

// =============================================
// ANÁLISE COM SISTEMA DE PONTUAÇÃO
// =============================================
let leituraEmAndamento = false;

async function leituraReal() {
  if (leituraEmAndamento) return;
  leituraEmAndamento = true;

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
    const ema21 = calcularSerieEMA(closes, 21).at(-1);
    const ema50 = calcularSerieEMA(closes, 50).at(-1);
    const adx = calcularADX(highs, lows, closes, 14);
    const fractals = detectarFractais(highs, lows, 2);

    let pontosCALL = 0;
    let pontosPUT = 0;

    if (rsi < 30) pontosCALL++;
    if (rsi > 70) pontosPUT++;

    if (sma9 > ema21 && ema21 > ema50) pontosCALL++;
    if (sma9 < ema21 && ema21 < ema50) pontosPUT++;

    if (macd.histograma > 0) pontosCALL++;
    if (macd.histograma < 0) pontosPUT++;

    if (fractals.ultimo === "FUNDO") pontosCALL++;
    if (fractals.ultimo === "TOPO") pontosPUT++;

    if (adx > 25) { pontosCALL++; pontosPUT++; }

    let comando = "ESPERAR";
    if (pontosCALL >= 3 && pontosCALL > pontosPUT) comando = "CALL";
    else if (pontosPUT >= 3 && pontosPUT > pontosCALL) comando = "PUT";

    ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR", {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    document.getElementById("comando").textContent = comando;
    document.getElementById("score").textContent = `RSI: ${rsi.toFixed(2)} | ADX: ${adx.toFixed(2)}`;
    document.getElementById("hora").textContent = ultimaAtualizacao;

    document.getElementById("criterios").innerHTML = `
      <li>RSI: ${rsi.toFixed(2)}</li>
      <li>ADX: ${adx.toFixed(2)}</li>
      <li>MACD: ${macd.histograma.toFixed(4)}</li>
      <li>Preço: $${close.toFixed(2)}</li>
      <li>Médias: ${sma9.toFixed(2)} / ${ema21.toFixed(2)} / ${ema50.toFixed(2)}</li>
      <li>Fractal: ${fractals.ultimo || "Nenhum"}</li>
    `;

    ultimos.unshift(`${ultimaAtualizacao} - ${comando} ($${close.toFixed(2)})`);
    if (ultimos.length > 5) ultimos.pop();
    document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");

    try {
      if (comando === "CALL") await document.getElementById("som-call")?.play();
      if (comando === "PUT") await document.getElementById("som-put")?.play();
    } catch (e) {
      console.warn("Erro ao reproduzir som:", e);
    }

  } catch (e) {
    console.error("Erro na leitura:", e);
  } finally {
    leituraEmAndamento = false;
  }
}

// =============================================
// TIMER COM SINCRONIZAÇÃO DE CANDLE
// =============================================
function iniciarTimer() {
  timer = 60;
  const intervalo = setInterval(() => {
    timer--;
    document.getElementById("timer").textContent = formatarTimer(timer);
    if (timer <= 0) {
      leituraReal();
      timer = 60;
    }
  }, 1000);
  return intervalo;
}

// =============================================
// INICIALIZAÇÃO
// =============================================
setInterval(atualizarRelogio, 1000);

setInterval(async () => {
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
    const dados = await res.json();
    const precoLi = document.getElementById("criterios")?.querySelector("li:nth-child(4)");
    if (precoLi) precoLi.textContent = `Preço: $${parseFloat(dados.lastPrice).toFixed(2)}`;
  } catch (e) {
    console.error("Erro ao atualizar preço:", e);
  }
}, 5000);

// Início
atualizarRelogio();
leituraReal();
iniciarTimer();
