// Variáveis globais atualizadas
let win = 0, loss = 0;
let ultimos = [];
let performanceData = [];
let currentInterval = '1m';
let chartInstance = null;
let lastAnalysisTime = 0; // Armazena timestamp da última análise

// Novo sistema de sincronização temporal
function sincronizarTemporizador() {
  // Obtém tempo do servidor Binance para sincronização perfeita
  fetch('https://api.binance.com/api/v3/time')
    .then(response => response.json())
    .then(data => {
      const serverTime = data.serverTime;
      const agora = Date.now();
      const diff = Math.floor((serverTime - agora) / 1000);
      
      // Calcula segundos até próxima análise (sincronizado com o minuto do mercado)
      const segundosAtual = new Date(serverTime).getSeconds();
      timer = 60 - segundosAtual;
      
      // Se faltar menos de 5s para nova vela, força análise imediata
      if (timer <= 5) {
        leituraReal();
        timer = 60;
      }
      
      document.getElementById("timer").textContent = timer;
    });
}

// Função de análise completamente reformulada
async function leituraReal() {
  try {
    // Atualiza o timestamp da última análise
    lastAnalysisTime = Date.now();
    localStorage.setItem('lastAnalysisTime', lastAnalysisTime.toString());

    const marketData = await fetchMarketData();
    const indicators = calculateAdvancedIndicators(marketData.closes, marketData.volumes);
    
    // 1. Cálculo de tendência REAL (usando EMA 9 e EMA 21)
    const ema9 = calculateEMA(marketData.closes, 9).pop();
    const ema21 = calculateEMA(marketData.closes, 21).pop();
    const tendencia = ema9 > ema21 ? "ALTA" : "BAIXA";

    // 2. Sistema de decisão aprimorado
    let comando = "NEUTRO";
    let confidence = 0;
    const price = marketData.close;

    // Condição CALL (compra)
    if (
      price > ema9 &&
      price > ema21 &&
      indicators.rsi < 65 &&
      indicators.macd.histogram > 0
    ) {
      comando = "CALL";
      confidence = 85;
    }
    // Condição PUT (venda)
    else if (
      price < ema9 &&
      price < ema21 &&
      indicators.rsi > 35 &&
      indicators.macd.histogram < 0
    ) {
      comando = "PUT";
      confidence = 85;
    }

    // 3. Atualização da interface
    document.getElementById("comando").textContent = comando;
    document.getElementById("comando").className = comando;
    document.getElementById("score").textContent = `${confidence}%`;
    
    // Atualização do status do mercado
    const marketElement = document.getElementById("market-trend");
    marketElement.textContent = tendencia;
    marketElement.style.color = tendencia === "ALTA" ? '#10b981' : '#ef4444';

    // ... (restante do código de atualização)

  } catch (e) {
    console.error("Erro na análise:", e);
  }
}

// Sistema de inicialização sincronizado
document.addEventListener('DOMContentLoaded', () => {
  // Recupera último timestamp do localStorage
  const savedTime = localStorage.getItem('lastAnalysisTime');
  lastAnalysisTime = savedTime ? parseInt(savedTime) : 0;
  
  // Verifica se precisa de nova análise imediata
  const elapsed = (Date.now() - lastAnalysisTime) / 1000;
  if (elapsed >= 55) {
    leituraReal();
  }

  sincronizarTemporizador();
  initChart();
  
  // Temporizador principal sincronizado
  setInterval(() => {
    timer--;
    document.getElementById("timer").textContent = timer;
    
    if (timer === 5) {
      leituraReal();
    }
    
    if (timer <= 0) {
      sincronizarTemporizador(); // Ressincroniza com tempo de mercado
    }
  }, 1000);
});

// Adicionar ao fetchMarketData()
async function fetchMarketData() {
  try {
    // Verifica se já temos dados recentes (últimos 30s)
    if (Date.now() - lastAnalysisTime < 30000) {
      throw new Error("Dados muito recentes");
    }
    
    // ... (restante do código existente)
  } catch (e) {
    // Tenta usar dados locais se possível
    return getCachedData();
  }
}
