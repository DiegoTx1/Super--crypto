// =============================================
// CONFIGURAÇÕES GLOBAIS (MODIFICÁVEL)
// =============================================
const CONFIG = {
  PONTUACAO_MINIMA: 4,
  DIFERENCA_MINIMA: 2,
  RSI_OVERBOUGHT: 68,
  RSI_OVERSOLD: 32,
  ADX_FORCA_MINIMA: 20,
  VOLUME_MULTIPLIER: 1.5,
  MACD_THRESHOLD: 0.0005,
  TEMPO_ATUALIZACAO: 60000 // 1 minuto
};

// Estado do Sistema
let estado = {
  win: 0,
  loss: 0,
  ultimosSinais: [],
  timer: 60,
  ultimaAtualizacao: "",
  emOperacao: false,
  intervalo: null,
  abortController: null
};

// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarInterface(elemento, valor, cor = "") {
  if (elemento) {
    elemento.textContent = valor;
    if (cor) elemento.style.color = cor;
  }
}

function registrarSinal(tipo, preco) {
  const timestamp = new Date().toLocaleTimeString("pt-BR");
  estado.ultimosSinais.unshift(`${timestamp} - ${tipo} ($${preco.toFixed(2)})`);
  if (estado.ultimosSinais.length > 5) estado.ultimosSinais.pop();
  
  if (tipo === 'CALL') estado.win++;
  else if (tipo === 'PUT') estado.loss++;
}

// =============================================
// CÁLCULO DE INDICADORES (ROBUSTO)
// =============================================
function calcularIndicadores(dados) {
  try {
    const closes = dados.map(v => parseFloat(v[4])).filter(Number.isFinite);
    const highs = dados.map(v => parseFloat(v[2])).filter(Number.isFinite);
    const lows = dados.map(v => parseFloat(v[3])).filter(Number.isFinite);
    const volumes = dados.map(v => parseFloat(v[5])).filter(Number.isFinite);

    if (closes.length < 50) throw new Error("Dados insuficientes");

    return {
      close: closes[closes.length - 1],
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      sma9: calcularSMA(closes, 9),
      ema21: calcularEMA(closes, 21),
      ema50: calcularEMA(closes, 50),
      adx: calcularADX(highs, lows, closes),
      volume: volumes[volumes.length - 1],
      volumeMedia: calcularSMA(volumes, 20)
    };
  } catch (e) {
    console.error("Erro no cálculo de indicadores:", e);
    return null;
  }
}

// ... (mantenha as funções calcularRSI, calcularMACD, calcularEMA, calcularSMA, calcularADX do código anterior)

// =============================================
// NÚCLEO DE DECISÃO (À PROVA DE FALHAS)
// =============================================
function analisarSinal(indicadores) {
  if (!indicadores) return "ERRO";

  const { pontosCALL, pontosPUT } = calcularPontuacao(indicadores);
  
  if (pontosCALL >= CONFIG.PONTUACAO_MINIMA && 
      pontosCALL >= pontosPUT + CONFIG.DIFERENCA_MINIMA) {
    return "CALL";
  }
  
  if (pontosPUT >= CONFIG.PONTUACAO_MINIMA && 
      pontosPUT >= pontosCALL + CONFIG.DIFERENCA_MINIMA) {
    return "PUT";
  }
  
  return "ESPERAR";
}

function calcularPontuacao({ rsi, macd, close, ema21, sma9, ema50, volume, volumeMedia, adx }) {
  let pontosCALL = 0, pontosPUT = 0;

  // RSI
  if (rsi < CONFIG.RSI_OVERSOLD && close > ema21) pontosCALL += 2;
  if (rsi > CONFIG.RSI_OVERBOUGHT && close < ema21) pontosPUT += 2;

  // MACD
  if (macd.histograma > CONFIG.MACD_THRESHOLD) pontosCALL += 2;
  if (macd.histograma < -CONFIG.MACD_THRESHOLD) pontosPUT += 2;

  // Médias Móveis
  if (close > sma9 && sma9 > ema21 && ema21 > ema50) pontosCALL += 1;
  if (close < sma9 && sma9 < ema21 && ema21 < ema50) pontosPUT += 1;

  // Volume e ADX
  if (volume > volumeMedia * CONFIG.VOLUME_MULTIPLIER) {
    if (adx > CONFIG.ADX_FORCA_MINIMA) {
      pontosCALL += (macd.macdLinha > macd.sinalLinha) ? 1 : 0;
      pontosPUT += (macd.macdLinha < macd.sinalLinha) ? 1 : 0;
    }
  }

  return { pontosCALL, pontosPUT };
}

// =============================================
// CONTROLE PRINCIPAL (RESILIENTE)
// =============================================
async function obterDadosBinance() {
  try {
    estado.abortController = new AbortController();
    const timeout = setTimeout(() => estado.abortController.abort(), 10000);
    
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100`, {
      signal: estado.abortController.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.error("Falha na API:", e);
    return null;
  }
}

async function cicloAnalise() {
  if (estado.emOperacao) return;
  estado.emOperacao = true;

  const dados = await obterDadosBinance();
  if (!dados) {
    estado.emOperacao = false;
    return;
  }

  const indicadores = calcularIndicadores(dados);
  const sinal = analisarSinal(indicadores);

  // Atualizar Estado
  estado.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
  if (sinal === "CALL" || sinal === "PUT") {
    registrarSinal(sinal, indicadores.close);
  }

  // Atualizar Interface
  atualizarInterface(document.getElementById("hora"), estado.ultimaAtualizacao);
  atualizarInterface(document.getElementById("comando"), sinal, 
    sinal === "CALL" ? "green" : sinal === "PUT" ? "red" : "");
  atualizarInterface(document.getElementById("historico"), `${estado.win} WIN / ${estado.loss} LOSS`);
  
  // Debug (opcional)
  console.log("Sinal:", sinal, "Indicadores:", indicadores);

  estado.emOperacao = false;
}

function gerenciarTimer() {
  if (estado.intervalo) clearInterval(estado.intervalo);
  
  const agora = new Date();
  estado.timer = 60 - agora.getSeconds();
  
  atualizarInterface(document.getElementById("timer"), formatarTimer(estado.timer), 
    estado.timer <= 5 ? "red" : "");

  estado.intervalo = setInterval(() => {
    estado.timer = Math.max(0, estado.timer - 1);
    
    atualizarInterface(document.getElementById("timer"), formatarTimer(estado.timer), 
      estado.timer <= 5 ? "red" : "");

    if (estado.timer <= 0) {
      clearInterval(estado.intervalo);
      cicloAnalise().finally(gerenciarTimer);
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO DO SISTEMA
// =============================================
function iniciarSistema() {
  // Configurar interface
  if (!document.getElementById("controles")) {
    const controlesHTML = `
      <div id="controles" style="margin: 10px 0;">
        <button id="btnForcar" style="padding: 5px 10px; background: #555; color: white; border: none; border-radius: 3px;">
          Forçar Análise
        </button>
        <span id="status" style="margin-left: 10px;"></span>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', controlesHTML);
    
    document.getElementById("btnForcar").addEventListener("click", () => {
      if (!estado.emOperacao) cicloAnalise();
    });
  }

  // Iniciar processos
  setInterval(atualizarRelogio, 1000);
  gerenciarTimer();
  cicloAnalise();

  // Atualização contínua do preço
  setInterval(async () => {
    try {
      const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");
      if (!response.ok) return;
      
      const data = await response.json();
      const precoElemento = document.querySelector("#criterios li:nth-child(4)");
      if (precoElemento) precoElemento.textContent = `Preço: $${parseFloat(data.price).toFixed(2)}`;
    } catch (e) {
      console.error("Erro ao atualizar preço:", e);
    }
  }, 5000);
}

// Inicialização segura
if (document.readyState === 'complete') {
  iniciarSistema();
} else {
  window.addEventListener('DOMContentLoaded', iniciarSistema);
}
