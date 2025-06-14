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

// Endpoints de fallback para a API
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

function registrar(tipo) {
  if (tipo === 'WIN') win++;
  else if (tipo === 'LOSS') loss++;
  
  const elementoHistorico = document.getElementById("historico");
  if (elementoHistorico) {
    elementoHistorico.textContent = `${win} WIN / ${loss} LOSS`;
  }
}

function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

// =============================================
// INDICADORES TÉCNICOS
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
    
    if (!Array.isArray(emaRapida) || !Array.isArray(emaLenta)) {
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
// SISTEMA DE FALLBACK PARA API
// =============================================
async function fetchDados(tentativa = 0) {
  try {
    const endpoint = API_ENDPOINTS[tentativa];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // Busca dados das velas
    const responseKlines = await fetch(`${endpoint}/klines?symbol=BTCUSDT&interval=1m&limit=100`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!responseKlines.ok) throw new Error(`Erro HTTP: ${responseKlines.status}`);
    
    const dados = await responseKlines.json();
    if (!Array.isArray(dados) || dados.length < 50) {
      throw new Error("Dados insuficientes");
    }

    return dados;
  } catch (e) {
    console.warn(`Falha no endpoint ${API_ENDPOINTS[tentativa]}:`, e.message);
    
    if (tentativa < API_ENDPOINTS.length - 1) {
      return fetchDados(tentativa + 1);
    }
    throw new Error("Todos os endpoints falharam");
  }
}

// =============================================
// LÓGICA PRINCIPAL COM TRATAMENTO DE ERRO MELHORADO
// =============================================
async function leituraReal() {
  if (leituraEmAndamento) return;
  leituraEmAndamento = true;

  try {
    const dados = await fetchDados();
    tentativasErro = 0; // Resetar contador de erros

    const dadosValidos = dados.filter(v => 
      Array.isArray(v) && 
      v.length >= 6 && 
      !isNaN(parseFloat(v[4]))
    );

    if (dadosValidos.length < 50) {
      throw new Error("Dados históricos insuficientes");
    }

    const velaAtual = dadosValidos[dadosValidos.length - 1];
    const close = parseFloat(velaAtual[4]);

    const closes = dadosValidos.map(v => parseFloat(v[4]));
    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    const ema21 = calcularSerieEMA(closes, 21).pop() || 0;

    // Sistema de pontuação simplificado
    let pontosCALL = 0, pontosPUT = 0;
    if (rsi < 30 && close > ema21) pontosCALL += 2;
    if (rsi > 70 && close < ema21) pontosPUT += 2;
    if (macd.histograma > 0) pontosCALL += 1;
    if (macd.histograma < 0) pontosPUT += 1;

    let comando = "ESPERAR";
    if (pontosCALL >= 2) comando = "CALL";
    else if (pontosPUT >= 2) comando = "PUT";

    // Atualiza UI
    ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    document.getElementById("comando").textContent = comando;
    document.getElementById("score").textContent = `RSI: ${rsi.toFixed(2)}`;
    document.getElementById("hora").textContent = ultimaAtualizacao;

    // Atualiza histórico
    ultimos.unshift(`${ultimaAtualizacao} - ${comando} ($${close.toFixed(2)})`);
    if (ultimos.length > 5) ultimos.pop();
    document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");

  } catch (e) {
    console.error("Erro na leitura:", e);
    tentativasErro++;
    
    document.getElementById("comando").textContent = "ERRO";
    document.getElementById("timer").textContent = "0:00";
    
    // Tentar reconectar com backoff exponencial
    const delay = Math.min(10000 * Math.pow(2, tentativasErro), 60000);
    setTimeout(() => {
      leituraEmAndamento = false;
      leituraReal();
      iniciarTimer();
    }, delay);
  } finally {
    leituraEmAndamento = false;
  }
}

// =============================================
// TIMER RESILIENTE
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
  // Verificações iniciais
  if (typeof fetch === 'undefined') {
    alert("Seu navegador não suporta fetch API");
    return;
  }

  // Inicia processos
  setInterval(atualizarRelogio, 1000);
  iniciarTimer();
  leituraReal();

  // Atualização contínua do preço
  setInterval(async () => {
    try {
      const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
      const dados = await response.json();
      document.querySelector("#criterios li:nth-child(4)").textContent = `Preço: $${parseFloat(dados.lastPrice).toFixed(2)}`;
    } catch (e) {
      console.error("Erro ao atualizar preço:", e);
    }
  }, 5000);
}

// Inicia quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarAplicativo);
} else {
  iniciarAplicativo();
}
