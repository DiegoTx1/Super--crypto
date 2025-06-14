// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
let win = 0, loss = 0;
let ultimos = [];
let timer = 60;
let ultimaAtualizacao = "";
let leituraEmAndamento = false;
let intervaloAtual = null;
let ultimoSinal = null;

// =============================================
// VERIFICADOR DE CONEXÃO
// =============================================
async function verificarConexao() {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ping', {
      cache: 'no-store'
    });
    if (!response.ok) throw new Error("API indisponível");
    console.log("✅ Conexão com Binance OK");
    return true;
  } catch (e) {
    console.error("❌ Falha na conexão:", e);
    // Tenta reconectar após 10 segundos
    setTimeout(verificarConexao, 10000);
    return false;
  }
}

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
  const mins = Math.floor(segundos / 60);
  const secs = segundos % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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

function calcularMACD(closes, rapida = 12, lenta = 26, sinal = 9) {
  try {
    if (!Array.isArray(closes) || closes.length < lenta + sinal) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }

    const emaRapida = calcularSerieEMA(closes, rapida);
    const emaLenta = calcularSerieEMA(closes, lenta);
    
    const macdLinha = [];
    const inicio = Math.max(rapida, lenta);

    for (let i = inicio; i < closes.length; i++) {
      macdLinha[i] = emaRapida[i] - emaLenta[i];
    }

    const sinalLinha = calcularSerieEMA(macdLinha.slice(inicio), sinal);
    
    return {
      histograma: macdLinha[macdLinha.length - 1] - sinalLinha[sinalLinha.length - 1],
      macdLinha: macdLinha[macdLinha.length - 1],
      sinalLinha: sinalLinha[sinalLinha.length - 1]
    };
  } catch (e) {
    console.error("Erro no cálculo MACD:", e);
    return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  }
}

// =============================================
// LÓGICA PRINCIPAL - VERSÃO 2.3 (ESTÁVEL)
// =============================================
async function leituraReal() {
  if (leituraEmAndamento) return;
  leituraEmAndamento = true;

  try {
    const timestamp = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100&timestamp=${timestamp}`, {
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    
    const dados = await response.json();
    if (!Array.isArray(dados) || dados.length < 50) {
      throw new Error("Dados insuficientes");
    }

    const dadosValidos = dados.filter(v => 
      Array.isArray(v) && v.length >= 6 && !isNaN(parseFloat(v[4]))
    );

    if (dadosValidos.length < 50) throw new Error("Dados insuficientes após filtragem");

    const velaAtual = dadosValidos[dadosValidos.length - 1];
    const close = parseFloat(velaAtual[4]);
    const high = parseFloat(velaAtual[2]);
    const low = parseFloat(velaAtual[3]);

    const closes = dadosValidos.map(v => parseFloat(v[4]));
    const highs = dadosValidos.map(v => parseFloat(v[2]));
    const lows = dadosValidos.map(v => parseFloat(v[3]));

    // Calcula indicadores
    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    const ema21 = calcularSerieEMA(closes, 21).pop() || 0;
    const { adx } = calcularADX(highs, lows, closes);
    const fractal = detectarFractais(highs.slice(0, -1), lows.slice(0, -1));
    const volatilidade = (high - low) / low * 100;

    // Sistema de pontuação simplificado
    let pontosCALL = 0;
    let pontosPUT = 0;

    // Regras básicas
    if (macd.histograma > 0) pontosCALL += 1;
    if (macd.histograma < 0) pontosPUT += 1;
    
    if (rsi < 40) pontosCALL += 1;
    if (rsi > 60) pontosPUT += 1;

    if (close > ema21) pontosCALL += 1;
    if (close < ema21) pontosPUT += 1;

    // Decisão final
    let comando = "ESPERAR";
    if (pontosCALL >= 2 && pontosCALL > pontosPUT && volatilidade > 0.08) {
      comando = "CALL";
    } else if (pontosPUT >= 2 && pontosPUT > pontosCALL && volatilidade > 0.08) {
      comando = "PUT";
    }

    // Atualiza interface
    atualizarInterface(comando, {
      close,
      rsi,
      macd: macd.histograma,
      adx,
      volatilidade,
      ema21
    });

    // Notifica apenas sinais novos
    if (comando !== "ESPERAR" && comando !== ultimoSinal) {
      enviarNotificacao(comando, close);
      ultimoSinal = comando;
    }

  } catch (e) {
    console.error("Erro na leitura:", e);
  } finally {
    leituraEmAndamento = false;
  }
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================
function atualizarInterface(comando, dados) {
  ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
  
  document.getElementById("comando").textContent = comando;
  document.getElementById("score").textContent = 
    `RSI: ${dados.rsi.toFixed(2)} | MACD: ${dados.macd.toFixed(4)}`;
  
  document.getElementById("criterios").innerHTML = `
    <li>Preço: $${dados.close.toFixed(2)}</li>
    <li>Volatilidade: ${dados.volatilidade.toFixed(2)}%</li>
    <li>EMA21: $${dados.ema21.toFixed(2)}</li>
    <li>RSI: ${dados.rsi.toFixed(2)}</li>
    <li>ADX: ${dados.adx.toFixed(2)}</li>
  `;

  // Atualiza histórico
  ultimos.unshift(`${ultimaAtualizacao} - ${comando} ($${dados.close.toFixed(2)})`);
  if (ultimos.length > 5) ultimos.pop();
  document.getElementById("ultimos").innerHTML = 
    ultimos.map(i => `<li>${i}</li>`).join("");
}

function enviarNotificacao(comando, preco) {
  // Notificação no navegador
  if (Notification.permission === "granted") {
    new Notification(`SINAL ${comando}`, {
      body: `BTC: $${preco.toFixed(2)} - ${new Date().toLocaleTimeString()}`,
      icon: comando === "CALL" ? 'call-icon.png' : 'put-icon.png'
    });
  }

  // Alerta sonoro
  const audio = new Audio(comando === "CALL" 
    ? 'call-sound.mp3' 
    : 'put-sound.mp3');
  audio.play().catch(e => console.log("Permita áudio para alertas"));
}

// =============================================
// TIMER PRECISO (ATUALIZADO)
// =============================================
function iniciarTimer() {
  if (intervaloAtual) clearInterval(intervaloAtual);

  const agora = Date.now();
  const delayProximaVela = 60000 - (agora % 60000);
  timer = Math.floor(delayProximaVela / 1000);

  // Garante mínimo de 1 segundo
  if (timer <= 0) timer = 1;

  document.getElementById("timer").textContent = formatarTimer(timer);

  intervaloAtual = setInterval(() => {
    timer--;
    document.getElementById("timer").textContent = formatarTimer(timer);
    
    if (timer <= 0) {
      clearInterval(intervaloAtual);
      leituraReal().finally(() => iniciarTimer());
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO ROBUSTA
// =============================================
async function iniciarAplicativo() {
  // Verifica elementos DOM
  const elementosNecessarios = ['hora', 'comando', 'score', 'criterios', 'ultimos', 'timer'];
  if (elementosNecessarios.some(id => !document.getElementById(id))) {
    console.error("Elementos da interface não encontrados");
    return;
  }

  // Configura notificações
  if (Notification.permission !== "granted") {
    Notification.requestPermission();
  }

  // Verifica conexão
  if (!await verificarConexao()) return;

  // Inicia processos
  setInterval(atualizarRelogio, 1000);
  iniciarTimer();
  leituraReal();

  // Atualização de preço em tempo real
  setInterval(async () => {
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
      const data = await response.json();
      document.querySelector("#criterios li:first-child").textContent = 
        `Preço: $${parseFloat(data.price).toFixed(2)}`;
    } catch (e) {
      console.error("Erro ao atualizar preço:", e);
    }
  }, 5000);
}

// Inicialização segura
if (document.readyState === 'complete') {
  iniciarAplicativo();
} else {
  window.addEventListener('load', iniciarAplicativo);
}
