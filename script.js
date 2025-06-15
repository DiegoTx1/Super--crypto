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

// Configurações ajustáveis
const CONFIG = {
  limiteVelas: 150,
  periodoRSI: 14,
  periodoStochastic: 14,
  periodoMediaVolume: 20,
  limiteConfianca: 65,  // Aumentado para reduzir entradas ruins
  limitePontos: 3.5     // Aumentado para exigir confirmação mais forte
};

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
  return `0:${segundos.toString().padStart(2, '0')}`;
}

// =============================================
// INDICADORES TÉCNICOS - VERSÃO APRIMORADA
// =============================================
function calcularRSI(closes, periodo = CONFIG.periodoRSI) {
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

function calcularStochastic(highs, lows, closes, periodo = CONFIG.periodoStochastic) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo) return { k: 50, d: 50 };
    
    const kValues = [];
    for (let i = periodo-1; i < closes.length; i++) {
      const highestHigh = Math.max(...highs.slice(i-periodo+1, i+1));
      const lowestLow = Math.min(...lows.slice(i-periodo+1, i+1));
      const currentClose = closes[i];
      kValues.push(((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100);
    }
    
    const dValues = calcularSMA(kValues, 3);
    return {
      k: kValues[kValues.length-1] || 50,
      d: dValues || 50
    };
  } catch (e) {
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularMediaVolume(volumes, periodo = CONFIG.periodoMediaVolume) {
  if (!Array.isArray(volumes) || volumes.length < periodo) return 0;
  return volumes.slice(-periodo).reduce((a, b) => a + b, 0) / periodo;
}

// =============================================
// SISTEMA DE CONFIRMAÇÃO DE SINAIS
// =============================================
function verificarConfirmacao(indicadores) {
  // Verifica se há confirmação de múltiplos indicadores
  const confirmacoes = {
    rsi: (indicadores.rsi < 35 || indicadores.rsi > 65),
    macd: (Math.abs(indicadores.macd.histograma) > 0.2),
    stochastic: (indicadores.stoch.k < 20 && indicadores.stoch.d < 20) || 
                (indicadores.stoch.k > 80 && indicadores.stoch.d > 80),
    volume: (indicadores.volume > indicadores.volumeMedia * 1.5),
    tendencia: (indicadores.close > indicadores.ema21 && indicadores.ema21 > indicadores.ema50) ||
               (indicadores.close < indicadores.ema21 && indicadores.ema21 < indicadores.ema50)
  };

  // Conta quantas confirmações temos
  return Object.values(confirmacoes).filter(Boolean).length;
}

// =============================================
// LÓGICA PRINCIPAL - VERSÃO MAIS CONSERVADORA
// =============================================
async function leituraReal() {
  if (leituraEmAndamento) return;
  leituraEmAndamento = true;

  try {
    // Tenta diferentes endpoints até conseguir os dados
    let dados;
    for (const endpoint of API_ENDPOINTS) {
      try {
        const response = await fetch(`${endpoint}/klines?symbol=BTCUSDT&interval=1m&limit=${CONFIG.limiteVelas}`);
        dados = await response.json();
        if (dados && dados.length > 0) break;
      } catch (e) {
        console.warn(`Falha no endpoint ${endpoint}`, e);
      }
    }

    if (!dados || dados.length < 50) throw new Error("Dados insuficientes");

    const dadosValidos = dados.filter(v => Array.isArray(v) && v.length >= 6);
    const velaAtual = dadosValidos[dadosValidos.length - 1];
    
    const close = parseFloat(velaAtual[4]);
    const high = parseFloat(velaAtual[2]);
    const low = parseFloat(velaAtual[3]);
    const volume = parseFloat(velaAtual[5]);

    const closes = dadosValidos.map(v => parseFloat(v[4]));
    const highs = dadosValidos.map(v => parseFloat(v[2]));
    const lows = dadosValidos.map(v => parseFloat(v[3]));
    const volumes = dadosValidos.map(v => parseFloat(v[5]));

    // Calcula todos os indicadores
    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      stoch: calcularStochastic(highs, lows, closes),
      close,
      ema21: calcularSerieEMA(closes, 21).pop() || 0,
      ema50: calcularSerieEMA(closes, 50).pop() || 0,
      volume,
      volumeMedia: calcularMediaVolume(volumes)
    };

    // Calcula número de confirmações
    const numConfirmacoes = verificarConfirmacao(indicadores);

    // Sistema de decisão mais conservador
    let comando = "ESPERAR";
    let scoreConfianca = 0;
    
    // Só gera sinal se tiver pelo menos 3 confirmações
    if (numConfirmacoes >= 3) {
      scoreConfianca = Math.min(100, 50 + (numConfirmacoes * 15));
      
      // Tendência de alta
      if (indicadores.close > indicadores.ema21 && 
          indicadores.ema21 > indicadores.ema50 &&
          indicadores.rsi < 45 &&
          indicadores.macd.histograma > 0) {
        comando = "CALL";
      }
      // Tendência de baixa
      else if (indicadores.close < indicadores.ema21 && 
               indicadores.ema21 < indicadores.ema50 &&
               indicadores.rsi > 55 &&
               indicadores.macd.histograma < 0) {
        comando = "PUT";
      }
    }

    // Atualiza a interface
    atualizarInterface(comando, scoreConfianca, indicadores);

  } catch (e) {
    console.error("Erro na leitura:", e);
    document.getElementById("comando").textContent = "ERRO";
    document.getElementById("score").textContent = "Confiança: 0%";
    setTimeout(() => {
      leituraEmAndamento = false;
      leituraReal();
    }, 10000);
  } finally {
    leituraEmAndamento = false;
  }
}

// =============================================
// FUNÇÕES DE ATUALIZAÇÃO DA INTERFACE
// =============================================
function atualizarInterface(comando, scoreConfianca, indicadores) {
  ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
  
  // Atualiza elementos principais
  document.getElementById("comando").textContent = comando;
  document.getElementById("comando").className = comando;
  document.getElementById("score").textContent = `Confiança: ${scoreConfianca}%`;
  document.getElementById("hora").textContent = ultimaAtualizacao;

  // Atualiza critérios técnicos
  document.getElementById("criterios").innerHTML = `
    <li>RSI: ${indicadores.rsi.toFixed(2)} ${indicadores.rsi < 35 ? '🔻' : indicadores.rsi > 65 ? '🔺' : ''}</li>
    <li>MACD: ${indicadores.macd.histograma.toFixed(4)} ${indicadores.macd.histograma > 0 ? '🟢' : '🔴'}</li>
    <li>Stochastic: K ${indicadores.stoch.k.toFixed(2)} / D ${indicadores.stoch.d.toFixed(2)}</li>
    <li>Preço: $${indicadores.close.toFixed(2)}</li>
    <li>Médias: EMA21 ${indicadores.ema21.toFixed(2)} | EMA50 ${indicadores.ema50.toFixed(2)}</li>
    <li>Volume: ${(indicadores.volume/1000).toFixed(2)}K vs Média ${(indicadores.volumeMedia/1000).toFixed(2)}K</li>
  `;

  // Atualiza histórico
  ultimos.unshift(`${ultimaAtualizacao} - ${comando} (${scoreConfianca}%)`);
  if (ultimos.length > 5) ultimos.pop();
  document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");
}

// =============================================
// INICIALIZAÇÃO DO ROBÔ
// =============================================
function iniciarAplicativo() {
  // Configura timer de atualização
  iniciarTimer();
  
  // Inicia relógio
  setInterval(atualizarRelogio, 1000);
  
  // Primeira leitura
  leituraReal();
  
  // Atualização de preço em tempo real
  setInterval(atualizarPrecoAtual, 5000);
}

// Inicia quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarAplicativo);
} else {
  iniciarAplicativo();
}
