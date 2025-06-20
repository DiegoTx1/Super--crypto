// =============================================
// ROBÔ PRO REAL CRYPTO IDX - VERSÃO 2025
// API Binance pública - Sem HTML
// =============================================

const WebSocket = require('ws');
const fetch = require('node-fetch');

// Configurações do robô
const CONFIG = {
    SYMBOL: "BTCUSDT", // Você pode trocar pelo ativo do CRYPTO IDX equivalente na corretora
    INTERVAL: "1m",
    API_REST: "https://api.binance.com/api/v3/klines",
    API_WS: "wss://stream.binance.com:9443/ws/",
    PERIODOS: {
        RSI: 14,
        STOCH: 14,
        WILLIAMS: 14,
        EMA_CURTA: 9,
        EMA_LONGA: 21,
        EMA_200: 200,
        MACD_RAPIDA: 12,
        MACD_LENTA: 26,
        MACD_SINAL: 9,
    },
    LIMIARES: {
        RSI_OVERBOUGHT: 65,
        RSI_OVERSOLD: 35,
        STOCH_OVERBOUGHT: 80,
        STOCH_OVERSOLD: 20,
        WILLIAMS_OVERBOUGHT: -20,
        WILLIAMS_OVERSOLD: -80,
        SCORE_ALTO: 75,
        SCORE_MEDIO: 65
    }
};

// Função utilitária: média simples
function SMA(values, period) {
    if (values.length < period) return null;
    const slice = values.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
}

// Média exponencial
function EMA(values, period) {
    if (values.length < period) return null;
    const k = 2 / (period + 1);
    let ema = SMA(values.slice(0, period), period);
    for (let i = period; i < values.length; i++) {
        ema = values[i] * k + ema * (1 - k) * ema;
    }
    return ema;
}

// Cálculo RSI
function calcularRSI(closes, period = CONFIG.PERIODOS.RSI) {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = closes[i] - closes[i - 1];
        diff >= 0 ? gains += diff : losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    const rs = avgGain / (avgLoss || 0.0001);
    return 100 - (100 / (1 + rs));
}

// Cálculo MACD
function calcularMACD(closes) {
    const emaRapida = EMA(closes, CONFIG.PERIODOS.MACD_RAPIDA);
    const emaLenta = EMA(closes, CONFIG.PERIODOS.MACD_LENTA);
    const macd = emaRapida - emaLenta;
    const sinal = EMA(closes.map((_, i) => (i >= CONFIG.PERIODOS.MACD_LENTA ? closes[i] - closes[i - CONFIG.PERIODOS.MACD_LENTA] : 0)), CONFIG.PERIODOS.MACD_SINAL);
    return { macd, histograma: macd - sinal };
}

// Cálculo Williams
function calcularWilliams(highs, lows, closes, period = CONFIG.PERIODOS.WILLIAMS) {
    if (closes.length < period) return 0;
    const highMax = Math.max(...highs.slice(-period));
    const lowMin = Math.min(...lows.slice(-period));
    return -100 * ((highMax - closes[closes.length - 1]) / (highMax - lowMin));
}

// Cálculo Stochastic
function calcularStochastic(highs, lows, closes, period = CONFIG.PERIODOS.STOCH) {
    if (closes.length < period) return { k: 50, d: 50 };
    const highMax = Math.max(...highs.slice(-period));
    const lowMin = Math.min(...lows.slice(-period));
    const k = 100 * ((closes[closes.length - 1] - lowMin) / (highMax - lowMin));
    return { k, d: k };
}

// Sistema de score
function calcularScore(ind) {
    let score = 50;
    if (ind.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) score += 20;
    if (ind.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) score -= 20;
    if (ind.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) score += 10;
    if (ind.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) score -= 10;
    if (ind.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD) score += 10;
    if (ind.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT) score -= 10;
    score += ind.macd.histograma * 10;
    return Math.max(0, Math.min(100, Math.round(score)));
}

function gerarSinal(score) {
    if (score >= CONFIG.LIMIARES.SCORE_ALTO) return "CALL 📈";
    if (score <= 100 - CONFIG.LIMIARES.SCORE_ALTO) return "PUT 📉";
    return "ESPERAR ✋";
}

// Buscar candles históricos via REST
async function carregarHistorico() {
    const url = `${CONFIG.API_REST}?symbol=${CONFIG.SYMBOL}&interval=${CONFIG.INTERVAL}&limit=500`;
    const resp = await fetch(url);
    const data = await resp.json();
    return data.map(candle => ({
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        time: parseInt(candle[0])
    }));
}

// Iniciar WebSocket de leitura em tempo real
async function iniciar() {
    const historico = await carregarHistorico();
    let candles = historico;

    const ws = new WebSocket(`${CONFIG.API_WS}${CONFIG.SYMBOL.toLowerCase()}@kline_${CONFIG.INTERVAL}`);
    ws.on('message', data => {
        const json = JSON.parse(data);
        const k = json.k;
        if (k.x) { // candle fechado
            candles.push({
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
                time: parseInt(k.t)
            });
            if (candles.length > 500) candles.shift();

            const closes = candles.map(c => c.close);
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);

            const indicadores = {
                rsi: calcularRSI(closes),
                macd: calcularMACD(closes),
                williams: calcularWilliams(highs, lows, closes),
                stoch: calcularStochastic(highs, lows, closes)
            };

            const score = calcularScore(indicadores);
            const sinal = gerarSinal(score);

            console.clear();
            console.log(`⏰ ${new Date().toLocaleTimeString()} - Sinal: ${sinal}`);
            console.log(`RSI: ${indicadores.rsi.toFixed(2)} | MACD: ${indicadores.macd.histograma.toFixed(4)} | Williams: ${indicadores.williams.toFixed(2)} | Stoch K: ${indicadores.stoch.k.toFixed(2)} | Score: ${score}%`);
        }
    });

    ws.on('error', err => console.error('WebSocket Error:', err));
}

iniciar();
