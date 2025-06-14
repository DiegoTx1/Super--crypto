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
// INDICADORES (CORREÇÕES CRÍTICAS)
// =============================================
function calcularRSI(closes, periodo) {
  if (closes.length < periodo + 1) return 50;
  let gains = 0, losses = 0;

  // Cálculo inicial dos gains/losses
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / periodo;
  let avgLoss = losses / periodo || 1; // Evita divisão por zero

  // Suavização exponencial
  for (let i = periodo + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (periodo - 1) + gain) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
  }

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularMACD(closes, rapida = 12, lenta = 26, sinal = 9) {
  const emaRapida = calcularSerieEMA(closes, rapida);
  const emaLenta = calcularSerieEMA(closes, lenta);
  const macdLinha = [];
  const inicio = Math.max(rapida, lenta);

  for (let i = inicio; i < closes.length; i++) {
    macdLinha[i] = emaRapida[i] - emaLenta[i];
  }

  const sinalLinha = calcularSerieEMA(macdLinha.slice(inicio), sinal);
  const ultimoMACD = macdLinha[macdLinha.length - 1];
  const ultimoSinal = sinalLinha[sinalLinha.length - 1];
  const histograma = ultimoMACD - ultimoSinal;

  return { 
    histograma,
    macdLinha: ultimoMACD,
    sinalLinha: ultimoSinal
  };
}

// =============================================
// LÓGICA DE PONTUAÇÃO (AJUSTES CHAVE)
// =============================================
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
    const volume = parseFloat(velaAtual[5]);

    const closes = dados.map(v => parseFloat(v[4]));
    const highs = dados.map(v => parseFloat(v[2]));
    const lows = dados.map(v => parseFloat(v[3]));
    const volumes = dados.map(v => parseFloat(v[5]));

    // Indicadores
    const rsi = calcularRSI(closes, 14);
    const macd = calcularMACD(closes);
    const sma9 = calcularSMA(closes, 9);
    const ema21 = calcularSerieEMA(closes, 21).at(-1);
    const ema50 = calcularSerieEMA(closes, 50).at(-1);
    const adx = calcularADX(highs, lows, closes, 14);
    const fractals = detectarFractais(highs, lows, 3); // Período aumentado para 3
    const volumeMedia = calcularSMA(volumes, 20);

    // Pontuação
    let pontosCALL = 0;
    let pontosPUT = 0;

    // Regras ajustadas
    if (rsi < 30 && close > ema21) pontosCALL++; // RSI só conta se o preço estiver acima da EMA21
    if (rsi > 70 && close < ema21) pontosPUT++;

    if (macd.histograma > 0 && macd.macdLinha > macd.sinalLinha) pontosCALL++; // Confirmação do MACD
    if (macd.histograma < 0 && macd.macdLinha < macd.sinalLinha) pontosPUT++;

    if (sma9 > ema21 && ema21 > ema50) pontosCALL += 2; // Tendência forte
    if (sma9 < ema21 && ema21 < ema50) pontosPUT += 2;

    if (fractals.ultimo === "FUNDO" && volume > volumeMedia) pontosCALL++; // Fractal com volume
    if (fractals.ultimo === "TOPO" && volume > volumeMedia) pontosPUT++;

    if (adx > 25) {
      if (macd.macdLinha > macd.sinalLinha) pontosCALL++; // ADX só pontua se confirmar tendência
      else pontosPUT++;
    }

    // Decisão (exige mais pontos e diferença clara)
    let comando = "ESPERAR";
    if (pontosCALL >= 4 && pontosCALL >= pontosPUT + 2) comando = "CALL";
    else if (pontosPUT >= 4 && pontosPUT >= pontosCALL + 2) comando = "PUT";

    // Atualiza a interface
    ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR", {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    document.getElementById("comando").textContent = comando;
    document.getElementById("score").textContent = `RSI: ${rsi.toFixed(2)} | ADX: ${adx.toFixed(2)}`;
    document.getElementById("hora").textContent = ultimaAtualizacao;

    // Logs para debug (opcional)
    console.log(`CALL: ${pontosCALL} | PUT: ${pontosPUT} | MACD: ${macd.histograma.toFixed(4)} | RSI: ${rsi.toFixed(2)}`);

  } catch (e) {
    console.error("Erro na leitura:", e);
  } finally {
    leituraEmAndamento = false;
  }
}

// =============================================
// INICIALIZAÇÃO (MANTIDO)
// =============================================
setInterval(atualizarRelogio, 1000);
leituraReal();
const intervalo = iniciarTimer();
