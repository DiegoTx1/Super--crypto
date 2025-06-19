// =============================================
// CONFIGURAÇÕES GLOBAIS - Define todos os parâmetros e estado inicial
// =============================================

// Objeto state mantém o estado atual da aplicação
const state = {
  ultimos: [],          // Armazena os últimos sinais gerados
  timer: 60,            // Intervalo de atualização em segundos
  ultimaAtualizacao: "", // Timestamp da última atualização
  leituraEmAndamento: false, // Flag para evitar chamadas simultâneas
  intervaloAtual: null,  // Referência ao intervalo do timer
  tentativasErro: 0,     // Contador de tentativas com erro
  ultimoSinal: null,     // Último sinal gerado (CALL/PUT)
  ultimoScore: 0,        // Último score de confiança calculado
  contadorLaterais: 0,   // Contador de períodos laterais
  websocket: null,       // Conexão WebSocket
  apiKeys: ["demo"],     // Chaves de API (rotação)
  currentApiKeyIndex: 0, // Índice da chave atual
  marketOpen: true,      // Status do mercado
  sentimentData: null    // Dados de sentimento do mercado
};

// Objeto CONFIG contém todos os parâmetros ajustáveis
const CONFIG = {
  // Endpoints para APIs de dados
  API_ENDPOINTS: ["https://api.twelvedata.com", "https://api.binance.com"],
  
  // Endpoint WebSocket
  WS_ENDPOINT: "wss://stream.binance.com:9443/ws",
  
  // Pares de moedas monitorados
  PARES: {
    BTCUSDT: "BTC/USDT",
    ETHUSDT: "ETH/USDT"
  },
  
  // Períodos para indicadores técnicos
  PERIODOS: {
    RSI: 14,
    STOCH: 14,
    // ... (outros períodos)
  },
  
  // Limiares para tomada de decisão
  LIMIARES: {
    SCORE_ALTO: 80,
    SCORE_MEDIO: 65,
    // ... (outros limiares)
  },
  
  // Pesos para cálculo do score
  PESOS: {
    RSI: 1.5,
    MACD: 2.0,
    // ... (outros pesos)
  },
  
  // Configurações de gerenciamento de risco
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.01, // 1% do capital
    R_R_MINIMO: 2.0,              // Ratio mínimo de risco/retorno
    // ... (outras configurações de risco)
  }
};

// =============================================
// FUNÇÕES UTILITÁRIAS - Operações auxiliares
// =============================================

// Formata o timer para exibição (MM:SS)
function formatarTimer(segundos) {
  const mins = Math.floor(segundos / 60);
  const secs = segundos % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Atualiza o relógio na interface
function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    const now = new Date();
    elementoHora.textContent = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

// =============================================
// CÁLCULO DE INDICADORES - Funções técnicas
// =============================================

// Objeto com métodos para cálculo de médias
const calcularMedia = {
  // Média Simples
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) return null;
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  },

  // Média Exponencial (EMA)
  exponencial: (dados, periodo) => {
    if (!Array.isArray(dados)) return [];
    const k = 2 / (periodo + 1);
    let ema = calcularMedia.simples(dados.slice(0, periodo), periodo);
    const emaArray = [ema];
    
    for (let i = periodo; i < dados.length; i++) {
      ema = dados[i] * k + ema * (1 - k);
      emaArray.push(ema);
    }
    return emaArray;
  }
};

// Cálculo do RSI (Relative Strength Index)
function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) return 50;
  
  let ganhos = 0;
  let perdas = 0;
  
  // Cálculo inicial
  for (let i = 1; i <= periodo; i++) {
    const diferenca = closes[i] - closes[i - 1];
    if (diferenca >= 0) ganhos += diferenca;
    else perdas += Math.abs(diferenca);
  }
  
  // Cálculo suavizado
  for (let i = periodo + 1; i < closes.length; i++) {
    const diferenca = closes[i] - closes[i - 1];
    if (diferenca >= 0) {
      ganhos = (ganhos * (periodo - 1) + diferenca) / periodo;
      perdas = (perdas * (periodo - 1)) / periodo;
    } else {
      ganhos = (ganhos * (periodo - 1)) / periodo;
      perdas = (perdas * (periodo - 1) + Math.abs(diferenca)) / periodo;
    }
  }
  
  const RS = perdas === 0 ? 100 : ganhos / perdas;
  return 100 - (100 / (1 + RS));
}

// =============================================
// NÚCLEO DA ANÁLISE - Processamento principal
// =============================================

async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    // 1. Obter dados do mercado
    const dados = await obterDadosCripto();
    if (!dados) throw new Error("Falha ao obter dados");
    
    // 2. Extrair séries de preços
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);
    
    // 3. Calcular indicadores
    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    // ... outros indicadores
    
    // 4. Avaliar tendência
    const tendencia = avaliarTendencia(closes);
    
    // 5. Calcular score
    const score = calcularScore({
      rsi,
      macd,
      tendencia
      // ... outros parâmetros
    });
    
    // 6. Determinar sinal
    const sinal = determinarSinal(score, tendencia);
    
    // 7. Atualizar interface
    atualizarInterface(sinal, score);
    
  } catch (error) {
    console.error("Erro na análise:", error);
    state.tentativasErro++;
    if (state.tentativasErro > 3) reiniciarSistema();
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE EXECUÇÃO - Inicialização
// =============================================

function iniciarAplicativo() {
  // 1. Configurar timer
  state.intervaloAtual = setInterval(() => {
    sincronizarTimer();
    if (state.timer <= 0) {
      state.timer = 60;
      analisarMercado();
    }
  }, 1000);
  
  // 2. Iniciar WebSocket
  iniciarWebSocket();
  
  // 3. Primeira análise
  analisarMercado();
}

// Inicializa quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", iniciarAplicativo);
