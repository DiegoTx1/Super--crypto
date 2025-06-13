// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
let win = 0, loss = 0;
let ultimos = [];
let timer = 60; // Timer regressivo de 1 minuto (0:59)
let ultimaAtualizacao = "";

// =============================================
// FUNÇÕES PRINCIPAIS (ATUALIZADAS)
// =============================================

// Relógio dinâmico (atualiza a cada segundo)
function atualizarRelogio() {
  const agora = new Date();
  document.getElementById("hora").textContent = agora.toLocaleTimeString("pt-BR", {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Registro de operações (WIN/LOSS)
function registrar(tipo) {
  if (tipo === 'WIN') win++;
  else loss++;
  document.getElementById("historico").textContent = `${win} WIN / ${loss} LOSS`;
}

// Formata o timer para "0:59"
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

// =============================================
// ANÁLISE TÉCNICA (SINCRONIZADA COM A CORRETORA)
// =============================================
async function leituraReal() {
  try {
    const response = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100");
    const dados = await response.json();
    const velaAtual = dados[dados.length - 1];
    
    // Dados da vela atual
    const close = parseFloat(velaAtual[4]);
    const high = parseFloat(velaAtual[2]);
    const low = parseFloat(velaAtual[3]);
    
    // Indicadores (calculados em tempo real)
    const closes = dados.map(v => parseFloat(v[4]));
    const rsi = calcularRSI(closes, 14);
    const macd = calcularMACD(closes, 12, 26, 9);
    const sma9 = calcularSMA(closes, 9);
    const ema21 = calcularEMA(closes, 21);
    const ema50 = calcularEMA(closes, 50);
    const adx = calcularADX(dados.map(v => parseFloat(v[2])), dados.map(v => parseFloat(v[3])), closes, 14);
    const fractals = detectarFractais(dados.map(v => parseFloat(v[2])), dados.map(v => parseFloat(v[3])), 5);

    // Atualiza a hora da última análise
    ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Lógica de decisão
    let comando = "ESPERAR";
    if (rsi < 30 && sma9 > ema21 && ema21 > ema50 && macd.histograma > 0 && fractals.ultimo === "FUNDO" && adx > 25) {
      comando = "CALL";
    } 
    else if (rsi > 70 && sma9 < ema21 && ema21 < ema50 && macd.histograma < 0 && fractals.ultimo === "TOPO" && adx > 25) {
      comando = "PUT";
    }

    // Atualiza a interface
    document.getElementById("comando").textContent = comando;
    document.getElementById("score").textContent = `RSI: ${rsi.toFixed(2)} | ADX: ${adx.toFixed(2)}`;
    document.getElementById("hora").textContent = ultimaAtualizacao;

    // Critérios técnicos em tempo real
    document.getElementById("criterios").innerHTML = `
      <li>RSI: ${rsi.toFixed(2)} ${rsi < 30 ? "↓" : rsi > 70 ? "↑" : "-"}</li>
      <li>ADX: ${adx.toFixed(2)} ${adx > 25 ? "✅" : "✖️"}</li>
      <li>MACD: ${macd.histograma.toFixed(4)}</li>
      <li>Preço: $${close.toFixed(2)}</li>
      <li>Médias: ${sma9.toFixed(2)} > ${ema21.toFixed(2)} > ${ema50.toFixed(2)}</li>
      <li>Fractal: ${fractals.ultimo || "Nenhum"}</li>
    `;

    // Atualiza histórico
    ultimos.unshift(`${ultimaAtualizacao} - ${comando} ($${close.toFixed(2)})`);
    if (ultimos.length > 5) ultimos.pop();
    document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");

    // Sons de alerta
    if (comando === "CALL") document.getElementById("som-call").play();
    if (comando === "PUT") document.getElementById("som-put").play();

  } catch (e) {
    console.error("Erro na análise:", e);
  }
}

// =============================================
// FUNÇÕES DE INDICADORES (MANTIDAS)
// =============================================
function calcularRSI(closes, periodo) {
  let ganhos = 0, perdas = 0;
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i-1];
    if (diff > 0) ganhos += diff;
    else perdas += Math.abs(diff);
  }
  const rs = ganhos / perdas;
  return 100 - (100 / (1 + rs));
}

function calcularMACD(closes, rapida, lenta, sinal) {
  const ema12 = calcularEMA(closes, rapida);
  const ema26 = calcularEMA(closes, lenta);
  const macdLine = ema12 - ema26;
  const signalLine = calcularEMA(closes.map((_, i) => i >= 25 ? macdLine : 0), sinal);
  return { histograma: macdLine - signalLine };
}

function calcularSMA(dados, periodo) {
  const slice = dados.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

function calcularEMA(dados, periodo) {
  const k = 2 / (periodo + 1);
  let ema = dados[0];
  for (let i = 1; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
  }
  return ema;
}

function detectarFractais(highs, lows, periodo) {
  const fractais = [];
  for (let i = periodo; i < highs.length - periodo; i++) {
    if (highs[i] === Math.max(...highs.slice(i - periodo, i + periodo + 1))) {
      fractais.push({ tipo: "TOPO" });
    } else if (lows[i] === Math.min(...lows.slice(i - periodo, i + periodo + 1))) {
      fractais.push({ tipo: "FUNDO" });
    }
  }
  return { ultimo: fractais[fractais.length - 1]?.tipo };
}

function calcularADX(highs, lows, closes, periodo) {
  // Versão simplificada (para precisão, instale 'technicalindicators')
  const variacao = Math.abs(closes[closes.length - 1] - closes[closes.length - periodo]);
  return Math.min((variacao / periodo) * 10, 60);
}

// =============================================
// INICIALIZAÇÃO
// =============================================

// Timer principal (60 segundos)
setInterval(() => {
  timer--;
  document.getElementById("timer").textContent = formatarTimer(timer);
  if (timer <= 0) {
    leituraReal();
    timer = 60;
  }
}, 1000);

// Atualiza o relógio a cada segundo
setInterval(atualizarRelogio, 1000);

// Atualiza critérios técnicos a cada 5 segundos (sem gerar sinais)
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

// Primeira execução
atualizarRelogio();
leituraReal();
