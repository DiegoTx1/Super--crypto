let win = 0, loss = 0;
let ultimos = [];
let timerInterval, clockInterval;
let lastSignalTime = 0;
const ANALYSIS_INTERVAL = 60; // 60 segundos

// Inicialização robusta
function initSystem() {
  // Carregar histórico
  loadHistory();
  
  // Iniciar relógio
  atualizarHora();
  clockInterval = setInterval(atualizarHora, 1000);
  
  // Sincronização temporal precisa
  syncWithBinanceTime();
  
  // Primeira análise imediata
  setTimeout(leituraReal, 1000);
}

// Sincronização perfeita com tempo Binance
function syncWithBinanceTime() {
  fetch('https://api.binance.com/api/v3/time')
    .then(response => response.json())
    .then(data => {
      const serverTime = data.serverTime;
      const now = Date.now();
      const diff = serverTime - now;
      
      // Calcular tempo até o próximo minuto completo
      const serverDate = new Date(serverTime);
      const seconds = serverDate.getSeconds();
      const msToNextMinute = (60 - seconds) * 1000;
      
      // Iniciar temporizador sincronizado
      startSynchronizedTimer(msToNextMinute);
    })
    .catch(() => {
      // Fallback se API falhar
      const now = new Date();
      const seconds = now.getSeconds();
      const msToNextMinute = (60 - seconds) * 1000;
      startSynchronizedTimer(msToNextMinute);
    });
}

// Iniciar temporizador preciso
function startSynchronizedTimer(initialDelay) {
  // Parar qualquer temporizador existente
  if (timerInterval) clearInterval(timerInterval);
  
  // Configurar temporizador
  setTimeout(() => {
    // Executar análise imediatamente no início do minuto
    leituraReal();
    
    // Iniciar contagem regressiva periódica
    let count = ANALYSIS_INTERVAL;
    updateTimerDisplay(count);
    
    timerInterval = setInterval(() => {
      count--;
      updateTimerDisplay(count);
      
      if (count <= 0) {
        leituraReal();
        count = ANALYSIS_INTERVAL;
      }
    }, 1000);
  }, initialDelay);
}

// Atualizar exibição do timer
function updateTimerDisplay(seconds) {
  document.getElementById("timer").textContent = seconds;
}

// Carregar histórico do localStorage
function loadHistory() {
  const savedWin = localStorage.getItem('win');
  const savedLoss = localStorage.getItem('loss');
  const savedSignals = localStorage.getItem('ultimos');
  
  if (savedWin) win = parseInt(savedWin);
  if (savedLoss) loss = parseInt(savedLoss);
  if (savedSignals) ultimos = JSON.parse(savedSignals);
  
  document.getElementById("historico").textContent = `${win} WIN / ${loss} LOSS`;
  if (ultimos.length > 0) {
    document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");
  }
}

// Salvar histórico
function saveHistory() {
  localStorage.setItem('win', win.toString());
  localStorage.setItem('loss', loss.toString());
  localStorage.setItem('ultimos', JSON.stringify(ultimos));
}

// Atualizar relógio
function atualizarHora() {
  const agora = new Date();
  document.getElementById("hora").textContent = agora.toLocaleTimeString("pt-BR");
}

// Registrar resultado
function registrar(tipo) {
  if (tipo === 'WIN') win++;
  else if (tipo === 'LOSS') loss++;
  
  document.getElementById("historico").textContent = `${win} WIN / ${loss} LOSS`;
  saveHistory();
}

// Pausar/continuar
function togglePause() {
  const btn = document.getElementById('btn-pause');
  const isPaused = btn.textContent === 'CONTINUAR';
  
  if (isPaused) {
    btn.textContent = 'PAUSAR';
    syncWithBinanceTime(); // Re-sincronizar ao continuar
  } else {
    btn.textContent = 'CONTINUAR';
    clearInterval(timerInterval);
  }
}

// Função principal de análise
async function leituraReal() {
  try {
    const agora = new Date();
    lastSignalTime = agora.getTime();
    
    // Buscar dados da Binance
    const response = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100");
    const data = await response.json();
    
    // Processar última vela
    const lastCandle = data[data.length - 1];
    const open = parseFloat(lastCandle[1]);
    const high = parseFloat(lastCandle[2]);
    const low = parseFloat(lastCandle[3]);
    const close = parseFloat(lastCandle[4]);
    const volume = parseFloat(lastCandle[5]);
    
    // Calcular indicadores
    const rsi = calculateRSI(data);
    const macd = calculateMACD(data);
    const ema9 = calculateEMA(data, 9);
    const ema21 = calculateEMA(data, 21);
    
    // Gerar sinal
    let comando = "NEUTRO";
    let confidence = 0;
    
    // Lógica de sinalização aprimorada
    if (close > ema9 && close > ema21 && rsi < 60) {
      comando = "CALL";
      confidence = 75 + Math.min(25, (ema9 - ema21) * 10);
    } else if (close < ema9 && close < ema21 && rsi > 40) {
      comando = "PUT";
      confidence = 75 + Math.min(25, (ema21 - ema9) * 10);
    }
    
    // Atualizar interface
    document.getElementById("comando").textContent = comando;
    document.getElementById("comando").className = comando;
    document.getElementById("score").textContent = `${Math.round(confidence)}%`;
    
    // Atualizar critérios
    const criterios = [
      `Preço: $${close.toFixed(2)}`,
      `EMA9: $${ema9.toFixed(2)}`,
      `EMA21: $${ema21.toFixed(2)}`,
      `RSI: ${rsi.toFixed(2)}`,
      `Volume: ${(volume / 1000).toFixed(1)}K BTC`
    ];
    
    document.getElementById("criterios").innerHTML = criterios.map(c => `<li>${c}</li>`).join("");
    
    // Registrar sinal
    const horario = agora.toLocaleTimeString("pt-BR");
    ultimos.unshift(`${horario} - ${comando} (${Math.round(confidence)}%)`);
    if (ultimos.length > 5) ultimos.pop();
    document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");
    saveHistory();
    
    // Tocar som de alerta
    if (comando === "CALL") document.getElementById("som-call").play();
    if (comando === "PUT") document.getElementById("som-put").play();
    
  } catch (e) {
    console.error("Erro na análise:", e);
    document.getElementById("comando").textContent = "ERRO";
    document.getElementById("comando").className = "";
  }
}

// Funções de indicadores técnicos
function calculateRSI(candles, period = 14) {
  const closes = candles.map(c => parseFloat(c[4]));
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i-1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(candles, fast = 12, slow = 26, signal = 9) {
  const closes = candles.map(c => parseFloat(c[4]));
  
  const fastEMA = calculateEMA(closes, fast);
  const slowEMA = calculateEMA(closes, slow);
  
  const macdLine = fastEMA.map((val, i) => val - slowEMA[i]);
  const signalLine = calculateEMA(macdLine, signal);
  
  const histogram = macdLine.map((val, i) => val - (signalLine[i] || 0));
  
  return {
    macdLine: macdLine[macdLine.length - 1],
    signalLine: signalLine[signalLine.length - 1],
    histogram: histogram[histogram.length - 1]
  };
}

function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  const emaArray = [];
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    emaArray.push(ema);
  }
  
  return emaArray;
}

// Inicializar sistema quando a página carregar
window.addEventListener('load', initSystem);
