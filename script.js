// =============================================  
// CONFIGURAÇÕES GLOBAIS (STOCKITY - CRYPTO IDX)  
// =============================================  
const state = {  
  ultimos: [],  
  timer: 60,  
  ultimaAtualizacao: "",  
  leituraEmAndamento: false,  
  intervaloAtual: null,  
  tentativasErro: 0,  
  ultimoSinal: null,  
  ultimoScore: 0,  
  contadorLaterais: 0,  
  marketOpen: true,  
  sentimentData: null,  
  liquidityZones: { support: [], resistance: [] }  
};  

const CONFIG = {  
  // Dados de Mercado (Binance API Free)  
  BINANCE_API: "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100",  
  SENTIMENT_API: "https://api.santiment.net/v1/sentiment?symbol=BTC&free_key=true",  

  // Configurações de Trading  
  SYMBOL: "CRYPTO.IDX",  
  VALOR_POR_OPERACAO: 50, // Valor em $ por trade  

  // EMOJIS (Mantidos do seu original)  
  EMOJIS: {  
    CALL: "📈",  
    PUT: "📉",  
    ESPERAR: "✋",  
    ERRO: "❗",  
    ALTA: "🟢",  
    BAIXA: "🔴",  
    LATERAL: "🟡",  
    VOLUME_ALTO: "🔊",  
    VOLUME_BAIXO: "🔈"  
  },  

  // PERIODOS & LIMIARES  
  PERIODOS: {  
    RSI: 14,  
    MACD_RAPIDA: 12,  
    MACD_LONGA: 26,  
    EMA_CURTA: 9,  
    EMA_LONGA: 21  
  },  
  LIMIARES: {  
    RSI_OVERBOUGHT: 70,  
    RSI_OVERSOLD: 30,  
    SCORE_ALTO: 80,  
    SCORE_MEDIO: 65  
  }  
};  

// =============================================  
// FUNÇÕES DE ANÁLISE TÉCNICA (ATUALIZADAS 2025)  
// =============================================  
function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {  
  if (closes.length < periodo) return 50;  

  let ganhos = 0;  
  let perdas = 0;  

  for (let i = 1; i <= periodo; i++) {  
    const diferenca = closes[i] - closes[i - 1];  
    if (diferenca > 0) ganhos += diferenca;  
    else perdas += Math.abs(diferenca);  
  }  

  const RS = ganhos / perdas;  
  return 100 - (100 / (1 + RS));  
}  

function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, lenta = CONFIG.PERIODOS.MACD_LONGA) {  
  if (closes.length < lenta) return { histograma: 0 };  

  const emaRapida = closes.slice(-rapida).reduce((a, b) => a + b, 0) / rapida;  
  const emaLenta = closes.slice(-lenta).reduce((a, b) => a + b, 0) / lenta;  
  return { histograma: emaRapida - emaLenta };  
}  

// =============================================  
// AUTOMAÇÃO DA STOCKITY (USANDO PUPPETEER)  
// =============================================  
const puppeteer = require('puppeteer');  

async function executarOrdemStockity(sinal) {  
  const browser = await puppeteer.launch({ headless: false });  
  const page = await browser.newPage();  

  try {  
    // Login  
    await page.goto('https://stockity.com/login');  
    await page.type('#email', 'SEU_EMAIL');  
    await page.type('#password', 'SUA_SENHA');  
    await page.click('#login-button');  
    await page.waitForNavigation();  

    // Operação  
    await page.goto('https://stockity.com/trade/crypto-idx');  
    await page.click(`button[data-direction="${sinal.toLowerCase()}"]`);  
    await page.type('#amount-input', CONFIG.VALOR_POR_OPERACAO.toString());  
    await page.click('#confirm-trade');  

    console.log(`✅ Ordem ${sinal} executada! ${CONFIG.EMOJIS[sinal]}`);  
  } catch (error) {  
    console.error(`❌ Erro: ${error.message}`);  
  } finally {  
    await browser.close();  
  }  
}  

// =============================================  
// LÓGICA PRINCIPAL DE TRADING  
// =============================================  
async function analisarMercado() {  
  if (state.leituraEmAndamento) return;  
  state.leituraEmAndamento = true;  

  try {  
    // 1. Busca dados do mercado  
    const response = await fetch(CONFIG.BINANCE_API);  
    const dados = await response.json();  
    const closes = dados.map(candle => parseFloat(candle[4]));  

    // 2. Calcula indicadores  
    const rsi = calcularRSI(closes);  
    const macd = calcularMACD(closes);  
    const emaCurta = closes.slice(-CONFIG.PERIODOS.EMA_CURTA).reduce((a, b) => a + b, 0) / CONFIG.PERIODOS.EMA_CURTA;  
    const emaLonga = closes.slice(-CONFIG.PERIODOS.EMA_LONGA).reduce((a, b) => a + b, 0) / CONFIG.PERIODOS.EMA_LONGA;  

    // 3. Gera sinal  
    let sinal = "ESPERAR";  
    let score = 50;  

    if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD && macd.histograma > 0 && emaCurta > emaLonga) {  
      sinal = "CALL";  
      score = 85;  
    } else if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && macd.histograma < 0 && emaCurta < emaLonga) {  
      sinal = "PUT";  
      score = 85;  
    }  

    // 4. Atualiza interface  
    state.ultimoSinal = sinal;  
    state.ultimoScore = score;  
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");  

    console.log(`📊 ${state.ultimaAtualizacao} - ${sinal} (${score}%) ${CONFIG.EMOJIS[sinal]}`);  

    // 5. Executa ordem se confiança alta  
    if (score >= CONFIG.LIMIARES.SCORE_ALTO && sinal !== "ESPERAR") {  
      await executarOrdemStockity(sinal);  
    }  

  } catch (error) {  
    console.error(`❌ Erro na análise: ${error.message}`);  
  } finally {  
    state.leituraEmAndamento = false;  
  }  
}  

// =============================================  
// INICIALIZAÇÃO DO ROBÔ  
// =============================================  
function iniciarRobo() {  
  console.log("🤖 Robô Stockity CRYPTO.IDX Iniciado!");  
  analisarMercado();  
  setInterval(analisarMercado, 60000); // Analisa a cada 1 minuto  
}  

// Inicia o robô  
iniciarRobo();
