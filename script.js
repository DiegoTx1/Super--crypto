// =============================================
// CONFIGURAÇÕES GLOBAIS (FUNCIONA)
// =============================================
let win = 0, loss = 0;
let ultimos = [];
let timer = 60;
let ultimaAtualizacao = "";
let leituraEmAndamento = false;
let intervaloAtual = null;
let tentativasErro = 0;

// Peso dos indicadores (ajustáveis)
const PESOS = {
  RSI: 1.5,
  MACD: 2.0,
  TENDENCIA: 1.8,
  VOLUME: 1.2,
  STOCHASTIC: 1.3,
  WILLIAMS: 1.3
};

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

function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

// =============================================
// INDICADORES TÉCNICOS (MANTIDOS)
// =============================================
// [As funções de indicadores técnicos permanecem exatamente as mesmas]
// calcularRSI, calcularStochastic, calcularWilliams, calcularSerieEMA, calcularSMA, calcularMACD

// =============================================
// SISTEMA DE SCORE DE CONFIÂNCIA (MANTIDO)
// =============================================
// [A função calcularScoreConfianca permanece exatamente a mesma]

// =============================================
// LÓGICA PRINCIPAL COM MELHORIAS SOLICITADAS
// =============================================
async function leituraReal() {
  if (leituraEmAndamento) return;
  leituraEmAndamento = true;

  try {
    const endpoint = API_ENDPOINTS[0];
    const response = await fetch(`${endpoint}/klines?symbol=BTCUSDT&interval=1m&limit=150`);
    const dados = await response.json();

    const dadosValidos = dados.filter(v => Array.isArray(v) && v.length >= 6);
    if (dadosValidos.length < 50) throw new Error("Dados insuficientes");

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
    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    const sma9 = calcularSMA(closes, 9);
    const ema21 = calcularSerieEMA(closes, 21).pop() || 0;
    const ema50 = calcularSerieEMA(closes, 50).pop() || 0;
    const volumeMedia = calcularSMA(volumes, 20) || 0;
    const stoch = calcularStochastic(highs, lows, closes);
    const williams = calcularWilliams(highs, lows, closes);

    // Calcula score de confiança
    const scoreConfianca = calcularScoreConfianca({
      rsi, macd, close, ema21, ema50, volume, volumeMedia, stoch, williams
    });

    // Sistema de pontuação mais sensível
    let pontosCALL = 0, pontosPUT = 0;
    
    // RSI ajustado
    if (rsi < 40) pontosCALL += 1.2;
    if (rsi > 60) pontosPUT += 1.2;
    
    // MACD ajustado
    if (macd.histograma > 0.1) pontosCALL += 1.5;
    if (macd.histograma < -0.1) pontosPUT += 1.5;
    
    // Médias móveis
    if (close > ema21) pontosCALL += 0.8;
    if (close < ema21) pontosPUT += 0.8;
    
    // Volume
    if (volume > volumeMedia * 1.2) {
      if (pontosCALL > pontosPUT) pontosCALL += 1;
      else pontosPUT += 1;
    }
    
    // Stochastic
    if (stoch.k < 20 && stoch.d < 20) pontosCALL += 1;
    if (stoch.k > 80 && stoch.d > 80) pontosPUT += 1;
    
    // Williams
    if (williams < -80) pontosCALL += 0.8;
    if (williams > -20) pontosPUT += 0.8;

    // Tomada de decisão mais flexível
    let comando = "ESPERAR";
    if (pontosCALL >= 2.5 && scoreConfianca >= 50) comando = "CALL";
    else if (pontosPUT >= 2.5 && scoreConfianca >= 50) comando = "PUT";

    // Atualiza a interface com as melhorias solicitadas
    ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    const comandoElement = document.getElementById("comando");
    comandoElement.textContent = comando;
    
    // MELHORIA 1: Cores padronizadas para CALL/PUT
    if (comando === "CALL") {
      comandoElement.style.color = "#10B981"; // Verde
      comandoElement.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
    } else if (comando === "PUT") {
      comandoElement.style.color = "#EF4444"; // Vermelho
      comandoElement.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
    } else {
      comandoElement.style.color = "#6B7280"; // Cinza
      comandoElement.style.backgroundColor = "transparent";
    }
    
    document.getElementById("score").textContent = `Confiança: ${scoreConfianca}%`;
    document.getElementById("progress-bar").style.width = `${scoreConfianca}%`;
    document.getElementById("ultima-atualizacao").textContent = ultimaAtualizacao;

    // MELHORIA 2: Critérios técnicos em tempo real
    const criteriosHTML = `
      <div class="grid-criterios">
        <div class="criterio-item">
          <span>RSI (14):</span>
          <span class="${rsi < 30 ? 'text-red' : rsi > 70 ? 'text-green' : ''}">
            ${rsi.toFixed(2)} ${rsi < 30 ? '🔻' : rsi > 70 ? '🔺' : ''}
          </span>
        </div>
        <div class="criterio-item">
          <span>MACD:</span>
          <span class="${macd.histograma > 0 ? 'text-green' : 'text-red'}">
            ${macd.histograma.toFixed(4)} ${macd.histograma > 0 ? '🟢' : '🔴'}
          </span>
        </div>
        <div class="criterio-item">
          <span>Stochastic (K/D):</span>
          <span class="${stoch.k < 20 && stoch.d < 20 ? 'text-green' : stoch.k > 80 && stoch.d > 80 ? 'text-red' : ''}">
            ${stoch.k.toFixed(2)} / ${stoch.d.toFixed(2)}
          </span>
        </div>
        <div class="criterio-item">
          <span>Williams %R:</span>
          <span class="${williams < -80 ? 'text-green' : williams > -20 ? 'text-red' : ''}">
            ${williams.toFixed(2)}
          </span>
        </div>
        <div class="criterio-item">
          <span>Preço Atual:</span>
          <span>$${close.toFixed(2)}</span>
        </div>
        <div class="criterio-item">
          <span>Médias (9/21/50):</span>
          <span>${sma9?.toFixed(2)} / ${ema21.toFixed(2)} / ${ema50.toFixed(2)}</span>
        </div>
        <div class="criterio-item">
          <span>Volume (24h):</span>
          <span class="${volume > volumeMedia * 1.3 ? 'text-yellow' : ''}">
            ${(volume / 1000).toFixed(2)}K (Média: ${(volumeMedia / 1000).toFixed(2)}K)
          </span>
        </div>
        <div class="criterio-item">
          <span>Tendência:</span>
          <span class="${close > ema21 && ema21 > ema50 ? 'text-green' : close < ema21 && ema21 < ema50 ? 'text-red' : 'text-yellow'}">
            ${close > ema21 && ema21 > ema50 ? 'Alta' : close < ema21 && ema21 < ema50 ? 'Baixa' : 'Neutra'}
          </span>
        </div>
      </div>
    `;
    document.getElementById("criterios").innerHTML = criteriosHTML;

    // MELHORIA 3: Histórico com 10 últimos comandos
    const novoItem = `${ultimaAtualizacao} - ${comando} (${scoreConfianca}%)`;
    ultimos.unshift(novoItem);
    if (ultimos.length > 10) ultimos.pop(); // Agora mostra 10 itens
    
    const historicoHTML = ultimos.map(item => {
      const classe = item.includes("CALL") ? "text-green" : item.includes("PUT") ? "text-red" : "";
      return `<li class="${classe}">${item}</li>`;
    }).join("");
    
    document.getElementById("ultimos").innerHTML = historicoHTML;

    // Efeitos sonoros
    if (comando === "CALL") {
      document.getElementById("som-call").play().catch(e => console.log("Erro ao reproduzir som:", e));
    } else if (comando === "PUT") {
      document.getElementById("som-put").play().catch(e => console.log("Erro ao reproduzir som:", e));
    }

    // Atualiza status de conexão
    document.getElementById("status-conexao").className = "status-value online";
    tentativasErro = 0;

  } catch (e) {
    console.error("Erro na leitura:", e);
    document.getElementById("comando").textContent = "ERRO";
    document.getElementById("comando").className = "ESPERAR";
    document.getElementById("score").textContent = "Confiança: 0%";
    document.getElementById("progress-bar").style.width = "0%";
    document.getElementById("status-conexao").className = "status-value offline";
    document.getElementById("status-conexao").textContent = "OFFLINE";

    tentativasErro++;
    const delay = Math.min(10000 * tentativasErro, 60000);
    setTimeout(() => {
      leituraEmAndamento = false;
      leituraReal();
    }, delay);
  } finally {
    leituraEmAndamento = false;
  }
}

// =============================================
// TIMER E INICIALIZAÇÃO (MANTIDOS)
// =============================================
// [As funções iniciarTimer e iniciarAplicativo permanecem as mesmas]

// Inicia quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarAplicativo);
} else {
  iniciarAplicativo();
}
