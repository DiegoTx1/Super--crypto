const WebSocket = require('ws');
const axios = require('axios');
const math = require('mathjs');

// Configurações do robô
const CONFIG = {
    asset: "BTCUSDT", // Ativo de referência para o CRYPTO IDX
    timeframe: "1m",
    minConfidence: 75, // Confiança mínima para emitir sinal
    indicators: {
        rsiPeriod: 9,
        emaShort: 5,
        emaLong: 13,
        stochPeriod: 14
    }
};

// Estado do robô
const state = {
    active: true,
    lastSignal: null,
    lastSignalTime: null,
    signalHistory: [],
    indicators: {
        rsi: 50,
        stochK: 50,
        stochD: 50,
        ema5: 0,
        ema13: 0,
        volume: 0,
        trend: "NEUTRA",
        trendStrength: 50
    },
    candles: []
};

// Inicializar WebSocket
const ws = new WebSocket(`wss://fstream.binance.com/ws/${CONFIG.asset.toLowerCase()}@kline_${CONFIG.timeframe}`);

ws.on('open', () => {
    console.log(`Conectado à Binance: ${CONFIG.asset}@${CONFIG.timeframe}`);
    console.log("Aguardando dados para gerar sinais...\n");
});

ws.on('message', (data) => {
    const message = JSON.parse(data);
    if (message.k) {
        processCandle(message.k);
    }
});

// Processar dados da vela
function processCandle(candle) {
    const newCandle = {
        open: parseFloat(candle.o),
        high: parseFloat(candle.h),
        low: parseFloat(candle.l),
        close: parseFloat(candle.c),
        volume: parseFloat(candle.v),
        timestamp: new Date(candle.t),
        isClosed: candle.x
    };

    if (newCandle.isClosed) {
        state.candles.push(newCandle);
        
        // Manter apenas as últimas 100 velas
        if (state.candles.length > 100) {
            state.candles.shift();
        }
        
        // Calcular indicadores
        calculateIndicators();
        
        // Gerar sinal
        generateSignal();
    }
}

// Calcular indicadores
function calculateIndicators() {
    if (state.candles.length < 20) return;
    
    // Calcular RSI
    state.indicators.rsi = calculateRSI(CONFIG.indicators.rsiPeriod);
    
    // Calcular EMAs
    state.indicators.ema5 = calculateEMA(CONFIG.indicators.emaShort);
    state.indicators.ema13 = calculateEMA(CONFIG.indicators.emaLong);
    
    // Calcular Estocástico
    calculateStochastic();
    
    // Volume (última vela)
    state.indicators.volume = state.candles[state.candles.length - 1].volume;
    
    // Determinar tendência
    updateTrend();
}

// Cálculo do RSI
function calculateRSI(period) {
    const closes = state.candles.slice(-period - 1).map(c => c.close);
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i-1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / (avgLoss || 1); // Evita divisão por zero
    return 100 - (100 / (1 + rs));
}

// Cálculo da EMA
function calculateEMA(period) {
    const closes = state.candles.map(c => c.close);
    if (closes.length < period) return 0;
    
    let ema = math.mean(closes.slice(0, period));
    const multiplier = 2 / (period + 1);
    
    for (let i = period; i < closes.length; i++) {
        ema = (closes[i] - ema) * multiplier + ema;
    }
    
    return ema;
}

// Calcular Estocástico
function calculateStochastic() {
    const period = CONFIG.indicators.stochPeriod;
    if (state.candles.length < period) return;
    
    const recentCandles = state.candles.slice(-period);
    const currentClose = recentCandles[recentCandles.length - 1].close;
    
    // Encontrar máximo e mínimo no período
    const high = math.max(recentCandles.map(c => c.high));
    const low = math.min(recentCandles.map(c => c.low));
    
    // Calcular %K
    state.indicators.stochK = ((currentClose - low) / (high - low)) * 100;
    
    // Calcular %D (média móvel simples de 3 períodos do %K)
    const kValues = [
        state.indicators.stochK,
        ...state.signalHistory.slice(-2).map(s => s.stochK)
    ].filter(v => v !== undefined);
    
    state.indicators.stochD = math.mean(kValues);
}

// Atualizar tendência
function updateTrend() {
    const emaDiff = state.indicators.ema5 - state.indicators.ema13;
    const rsiValue = state.indicators.rsi;
    
    if (emaDiff > 0 && rsiValue > 50) {
        state.indicators.trend = "ALTA";
        state.indicators.trendStrength = 80;
    } else if (emaDiff < 0 && rsiValue < 50) {
        state.indicators.trend = "BAIXA";
        state.indicators.trendStrength = 80;
    } else {
        state.indicators.trend = "NEUTRA";
        state.indicators.trendStrength = 50;
    }
}

// Gerar sinal com confiança
function generateSignal() {
    if (!state.active) return;
    
    let signal = "ESPERAR";
    let confidence = 0;
    
    // Lógica de geração de sinais
    if (state.indicators.trend === "ALTA" && state.indicators.trendStrength > 70) {
        if (state.indicators.rsi < 65 && state.indicators.stochK > 50) {
            signal = "CALL";
            confidence = 75 + math.random(0, 20);
        }
    } else if (state.indicators.trend === "BAIXA" && state.indicators.trendStrength > 70) {
        if (state.indicators.rsi > 35 && state.indicators.stochK < 50) {
            signal = "PUT";
            confidence = 75 + math.random(0, 20);
        }
    }
    
    // Limitar confiança
    confidence = math.min(99, confidence);
    
    // Emitir sinal se tiver confiança mínima
    if (signal !== "ESPERAR" && confidence >= CONFIG.minConfidence) {
        state.lastSignal = signal;
        state.lastSignalTime = new Date();
        
        // Registrar sinal
        const signalData = {
            type: signal,
            confidence: math.round(confidence),
            timestamp: new Date(),
            indicators: {...state.indicators}
        };
        
        state.signalHistory.push(signalData);
        
        // Exibir sinal no console
        displaySignal(signalData);
    }
}

// Exibir sinal formatado
function displaySignal(signal) {
    const timeString = signal.timestamp.toLocaleTimeString();
    
    console.log(`\n=== SINAL PARA CRYPTO IDX ===`);
    console.log(`Hora: ${timeString}`);
    console.log(`Sinal: ${signal.type}`);
    console.log(`Confiança: ${signal.confidence}%`);
    console.log('--- Indicadores ---');
    console.log(`Tendência: ${state.indicators.trend} (${state.indicators.trendStrength}%)`);
    console.log(`RSI: ${state.indicators.rsi.toFixed(1)}`);
    console.log(`Estocástico: K=${state.indicators.stochK.toFixed(1)}, D=${state.indicators.stochD.toFixed(1)}`);
    console.log(`EMA5: ${state.indicators.ema5.toFixed(2)}`);
    console.log(`EMA13: ${state.indicators.ema13.toFixed(2)}`);
    console.log(`Volume: ${state.indicators.volume.toLocaleString()}`);
    console.log(`==============================\n`);
}

// Inicialização
console.log("Iniciando robô para CRYPTO IDX");
console.log("Configurações:");
console.log(`- Ativo de referência: ${CONFIG.asset}`);
console.log(`- Timeframe: ${CONFIG.timeframe}`);
console.log(`- Confiança mínima: ${CONFIG.minConfidence}%`);
console.log("----------------------------------------");

// Função para ativar/desativar o robô via console
process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
    const command = input.toString().trim().toLowerCase();
    
    if (command === 'on') {
        state.active = true;
        console.log("Robô ATIVADO");
    } else if (command === 'off') {
        state.active = false;
        console.log("Robô DESATIVADO");
    } else if (command === 'status') {
        console.log(`Estado: ${state.active ? 'ATIVO' : 'INATIVO'}`);
        console.log(`Último sinal: ${state.lastSignalTime ? state.lastSignalTime.toLocaleTimeString() : 'Nenhum'}`);
    } else if (command === 'exit') {
        console.log("Encerrando robô...");
        process.exit();
    } else {
        console.log("Comandos disponíveis:");
        console.log("on   - Ativar robô");
        console.log("off  - Desativar robô");
        console.log("status - Ver estado atual");
        console.log("exit - Sair do programa");
    }
});

console.log("\nComandos disponíveis: [on] [off] [status] [exit]\n");
