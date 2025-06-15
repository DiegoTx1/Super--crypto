// ================= CONFIGURAÇÕES GLOBAIS =================
const config = {
  paridade: "BTCUSDT",       // Paridade espelhada no Cripto IDX
  intervalo: "1m",           // Timeframe (1min para Cripto IDX)
  delayStockity: 2000,       // Delay de sincronização (2s)
  limiarRSI: { baixo: 35, alto: 65 },
  limiarStoch: { baixo: 25, alto: 75 },
  filtroLateralidade: 0.5    // Filtro de EMA (0.5%)
};

let historicoSinais = [];
let emOperacao = false;

// ================= FUNÇÕES DE ANÁLISE TÉCNICA =================
function calcularRSI(closes, periodo = 14) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i-1];
    diff > 0 ? gains += diff : losses += Math.abs(diff);
  }
  const rs = (gains/periodo)/(losses/periodo || 0.001);
  return 100 - (100/(1 + rs));
}

function calcularStochastic(highs, lows, closes, periodo = 14) {
  const kValues = [];
  for (let i = periodo-1; i < closes.length; i++) {
    const maxHigh = Math.max(...highs.slice(i-periodo+1, i+1));
    const minLow = Math.min(...lows.slice(i-periodo+1, i+1));
    kValues.push(((closes[i] - minLow)/(maxHigh - minLow)) * 100);
  }
  return {
    k: kValues[kValues.length-1] || 50,
    d: calcularSMA(kValues.slice(-3), 3) || 50
  };
}

function calcularEMA(dados, periodo) {
  const k = 2/(periodo + 1);
  let ema = dados.slice(0, periodo).reduce((a, b) => a + b, 0)/periodo;
  for (let i = periodo; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcularSMA(dados, periodo) {
  return dados.slice(-periodo).reduce((a, b) => a + b, 0)/periodo;
}

// ================= LÓGICA DE ENTRADA =================
async function executarEntrada(sinal) {
  if (emOperacao) return;
  
  emOperacao = true;
  const horario = new Date().toLocaleTimeString();
  
  try {
    console.log(`[${horario}] Executando ${sinal}...`);
    
    // Simulação de entrada (substitua pela API real da Stockity)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`[${horario}] Operação ${sinal} realizada com sucesso!`);
    historicoSinais.unshift({
      horario,
      sinal,
      resultado: "SUCESSO"
    });
    
  } catch (error) {
    console.error(`[${horario}] Erro na operação:`, error);
    historicoSinais.unshift({
      horario,
      sinal,
      resultado: "ERRO"
    });
  } finally {
    emOperacao = false;
  }
}

// ================= NÚCLEO DE ANÁLISE =================
async function analisarMercado() {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${config.paridade}&interval=${config.intervalo}&limit=100`);
    const candles = await response.json();
    
    if (!candles || candles.length < 50) {
      throw new Error("Dados insuficientes");
    }
    
    // Processamento dos dados
    const closes = candles.map(c => parseFloat(c[4]));
    const highs = candles.map(c => parseFloat(c[2]));
    const lows = candles.map(c => parseFloat(c[3]));
    const currentPrice = closes[closes.length-1];
    
    // Cálculo dos indicadores
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const ema21 = calcularEMA(closes, 21);
    const ema50 = calcularEMA(closes, 50);
    const diffEMAs = Math.abs(ema21 - ema50) / currentPrice * 100;
    
    // Geração do sinal
    let sinal = "ESPERAR";
    if (diffEMAs > config.filtroLateralidade) {
      const pontosCALL = (rsi < config.limiarRSI.baixo ? 1.3 : 0) + 
                        (stoch.k < config.limiarStoch.baixo ? 1.2 : 0);
      
      const pontosPUT = (rsi > config.limiarRSI.alto ? 1.3 : 0) + 
                       (stoch.k > config.limiarStoch.alto ? 1.2 : 0);
      
      if (pontosCALL >= 2.5 && rsi < 60) sinal = "CALL";
      if (pontosPUT >= 2.5 && rsi > 40) sinal = "PUT";
    }
    
    // Log de análise
    console.log(`\n[${new Date().toLocaleTimeString()}] Análise:`);
    console.log(`- Preço: ${currentPrice.toFixed(2)}`);
    console.log(`- RSI: ${rsi.toFixed(1)}`);
    console.log(`- Stoch: K=${stoch.k.toFixed(1)}, D=${stoch.d.toFixed(1)}`);
    console.log(`- EMAs: 21=${ema21.toFixed(2)}, 50=${ema50.toFixed(2)}`);
    console.log(`- Dif EMAs: ${diffEMAs.toFixed(2)}%`);
    console.log(`- Sinal: ${sinal}`);
    
    // Execução com delay
    if (sinal !== "ESPERAR") {
      setTimeout(() => executarEntrada(sinal), config.delayStockity);
    }
    
  } catch (error) {
    console.error("Erro na análise:", error);
  }
}

// ================= INICIALIZAÇÃO =================
function iniciarRobo() {
  console.log("Iniciando robô para Cripto IDX...");
  console.log(`Configurações: ${JSON.stringify(config, null, 2)}`);
  
  // Executa imediatamente e depois a cada minuto
  analisarMercado();
  setInterval(analisarMercado, 60000);
  
  // Monitoramento do histórico
  setInterval(() => {
    console.log("\nÚltimos sinais:");
    console.table(historicoSinais.slice(0, 5));
  }, 300000);
}

// Inicia o robô
document.addEventListener('DOMContentLoaded', iniciarRobo);
