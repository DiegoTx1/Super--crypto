// =============================================
// CONFIGURAÇÕES GLOBAIS (REVISADAS PARA CRIPTO IDX 2025)
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
    websocket: null,
    marketOpen: true,
    dadosMercado: []
};

const CONFIG = {
    WS_ENDPOINT: "wss://stream.binance.com:9443/ws/btcusdt@trade",
    HTTP_ENDPOINT: "https://api.binance.com/api/v3/klines", 
    PARES: {
        CRIPTOIDX: "BTCUSDT"
    },
    PERIODOS: {
        RSI: 14,
        STOCH: 14,
        WILLIAMS: 14,
        EMA_CURTA: 9,
        EMA_LONGA: 21,
        EMA_200: 200,
        SMA_VOLUME: 20,
        MACD_RAPIDA: 12,
        MACD_LENTA: 26,
        MACD_SINAL: 9,
        VELAS_CONFIRMACAO: 3,
        ANALISE_LATERAL: 30,
        VWAP: 20,
        ATR: 14
    },
    LIMIARES: {
        SCORE_ALTO: 80,
        SCORE_MEDIO: 68,
        RSI_OVERBOUGHT: 70,
        RSI_OVERSOLD: 30,
        STOCH_OVERBOUGHT: 85,
        STOCH_OVERSOLD: 15,
        WILLIAMS_OVERBOUGHT: -15,
        WILLIAMS_OVERSOLD: -85,
        VOLUME_ALTO: 1.5,
        VARIACAO_LATERAL: 0.5,
        VWAP_DESVIO: 0.0025,
        ATR_LIMIAR: 0.0020
    },
    PESOS: {
        RSI: 1.6,
        MACD: 2.2,
        TENDENCIA: 1.6,
        VOLUME: 0.9,
        STOCH: 1.3,
        WILLIAMS: 1.1,
        CONFIRMACAO: 1.1,
        LATERALIDADE: 2.0,
        VWAP: 1.4,
        VOLATILIDADE: 1.3
    },
    RISCO: {
        MAX_RISCO_POR_OPERACAO: 0.015,
        R_R_MINIMO: 2,
        ATR_MULTIPLICADOR_SL: 1.8,
        ATR_MULTIPLICADOR_TP: 3.6
    }
};

// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================
function formatarTimer(segundos) {
    return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
    const elementoHora = document.getElementById("hora");
    if (elementoHora) {
        const now = new Date();
        elementoHora.textContent = now.toLocaleTimeString("pt-BR", {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        state.marketOpen = true;
    }
}

function atualizarInterface(sinal, score) {
    if (!state.marketOpen && sinal !== "ERRO") return;

    const comandoElement = document.getElementById("comando");
    if (comandoElement) {
        comandoElement.textContent = sinal;
        comandoElement.className = sinal.toLowerCase();
        
        if (sinal === "CALL") comandoElement.textContent += " 🚀";
        else if (sinal === "PUT") comandoElement.textContent += " 💥";
        else if (sinal === "ESPERAR") comandoElement.textContent += " ⏳";
    }

    const scoreElement = document.getElementById("score");
    if (scoreElement) {
        scoreElement.textContent = `Confiança: ${score}%`;
        if (score >= CONFIG.LIMIARES.SCORE_ALTO) scoreElement.style.color = '#00ff00';
        else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) scoreElement.style.color = '#ffff00';
        else scoreElement.style.color = '#ff0000';
    }

    const horaElement = document.getElementById("hora");
    if (horaElement) {
        horaElement.textContent = state.ultimaAtualizacao;
    }
}

// =============================================
// INDICADORES TÉCNICOS (CORRIGIDOS)
// =============================================
const calcularMedia = {
    simples: (dados, periodo) => {
        if (!Array.isArray(dados) || dados.length < periodo) return null;
        const slice = dados.slice(-periodo);
        return slice.reduce((a, b) => a + b, 0) / periodo;
    },
    exponencial: (dados, periodo) => {
        if (!Array.isArray(dados) || dados.length < periodo) return [];
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

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
    if (closes.length < periodo + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    // Primeiro cálculo
    for (let i = 1; i <= periodo; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
    }
    
    let avgGain = gains / periodo;
    let avgLoss = losses / periodo || 0.000001;
    
    // Cálculos subsequentes
    for (let i = periodo + 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;
        
        avgGain = (avgGain * (periodo - 1) + gain) / periodo;
        avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
    }
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, periodo = CONFIG.PERIODOS.STOCH) {
    if (closes.length < periodo) return { k: 50, d: 50 };
    
    const kValues = [];
    for (let i = periodo - 1; i < closes.length; i++) {
        const sliceHigh = highs.slice(i - periodo + 1, i + 1);
        const sliceLow = lows.slice(i - periodo + 1, i + 1);
        const highestHigh = Math.max(...sliceHigh);
        const lowestLow = Math.min(...sliceLow);
        const range = highestHigh - lowestLow;
        kValues.push(range > 0 ? ((closes[i] - lowestLow) / range) * 100 : 50);
    }
    
    const dValues = kValues.length >= 3 ? 
        calcularMedia.simples(kValues.slice(-3), 3) : 50;
    
    return {
        k: kValues[kValues.length - 1] || 50,
        d: dValues || 50
    };
}

function calcularWilliams(highs, lows, closes, periodo = CONFIG.PERIODOS.WILLIAMS) {
    if (closes.length < periodo) return 0;
    
    const sliceHigh = highs.slice(-periodo);
    const sliceLow = lows.slice(-periodo);
    const highestHigh = Math.max(...sliceHigh);
    const lowestLow = Math.min(...sliceLow);
    const range = highestHigh - lowestLow;
    
    return range > 0 ? 
        ((highestHigh - closes[closes.length - 1]) / range) * -100 : 0;
}

function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA,
                    lenta = CONFIG.PERIODOS.MACD_LENTA,
                    sinal = CONFIG.PERIODOS.MACD_SINAL) {
    if (closes.length < lenta + sinal) return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    
    const emaRapida = calcularMedia.exponencial(closes, rapida);
    const emaLenta = calcularMedia.exponencial(closes, lenta);
    
    if (emaRapida.length < lenta || emaLenta.length < lenta) {
        return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }
    
    const startIdx = lenta - rapida > 0 ? lenta - rapida : 0;
    const macdLinha = emaRapida.slice(startIdx).map((val, idx) => val - emaLenta[idx]);
    const sinalLinha = calcularMedia.exponencial(macdLinha, sinal);
    
    const ultimoMACD = macdLinha[macdLinha.length - 1] || 0;
    const ultimoSinal = sinalLinha[sinalLinha.length - 1] || 0;
    
    return {
        histograma: ultimoMACD - ultimoSinal,
        macdLinha: ultimoMACD,
        sinalLinha: ultimoSinal
    };
}

function calcularVWAP(dados, periodo = CONFIG.PERIODOS.VWAP) {
    if (dados.length < periodo) return 0;
    
    let typicalPriceSum = 0;
    let volumeSum = 0;
    
    for (const vela of dados.slice(-periodo)) {
        const high = parseFloat(vela[2]);
        const low = parseFloat(vela[3]);
        const close = parseFloat(vela[4]);
        const volume = parseFloat(vela[5]);
        
        const typicalPrice = (high + low + close) / 3;
        typicalPriceSum += typicalPrice * volume;
        volumeSum += volume;
    }
    
    return volumeSum > 0 ? typicalPriceSum / volumeSum : 0;
}

function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
    if (dados.length < periodo + 1) return 0;
    
    const trValues = [];
    for (let i = 1; i < dados.length; i++) {
        const velaAtual = dados[i];
        const velaAnterior = dados[i-1];
        
        const high = parseFloat(velaAtual[2]);
        const low = parseFloat(velaAtual[3]);
        const prevClose = parseFloat(velaAnterior[4]);
        
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trValues.push(tr);
    }
    
    return calcularMedia.simples(trValues.slice(-periodo), periodo) || 0;
}

// =============================================
// SISTEMA DE DECISÃO (OTIMIZADO)
// =============================================
function avaliarTendencia(closes, emaCurta, emaLonga, ema200) {
    if (closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
    
    const lateral = detectarMercadoLateral(closes);
    if (lateral) {
        state.contadorLaterais++;
        return "LATERAL";
    } else {
        state.contadorLaterais = 0;
    }
    
    const ultimoClose = closes[closes.length - 1];
    const penultimoClose = closes[closes.length - 2];
    const diffEMAs = emaCurta - emaLonga;
    const threshold = 0.0010;
    
    if (ultimoClose > emaCurta && diffEMAs > threshold && ultimoClose > penultimoClose) return "FORTE_ALTA";
    if (ultimoClose < emaCurta && diffEMAs < -threshold && ultimoClose < penultimoClose) return "FORTE_BAIXA";
    if (ultimoClose > emaCurta && diffEMAs > threshold / 2) return "ALTA";
    if (ultimoClose < emaCurta && diffEMAs < -threshold / 2) return "BAIXA";
    return "NEUTRA";
}

function detectarMercadoLateral(closes) {
    if (closes.length < CONFIG.PERIODOS.ANALISE_LATERAL) return false;
    
    const precos = closes.slice(-CONFIG.PERIODOS.ANALISE_LATERAL);
    const maximo = Math.max(...precos);
    const minimo = Math.min(...precos);
    const variacao = ((maximo - minimo) / minimo) * 100;
    
    return variacao < CONFIG.LIMIARES.VARIACAO_LATERAL;
}

function calcularScore(indicadores) {
    let score = 50;
    
    // RSI
    if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) {
        score += 25 * CONFIG.PESOS.RSI;
        if (indicadores.tendencia.includes("BAIXA")) score -= 10;
    } else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) {
        score -= 25 * CONFIG.PESOS.RSI;
        if (indicadores.tendencia.includes("ALTA")) score += 10;
    } else if (indicadores.rsi < 45) {
        score += 10 * CONFIG.PESOS.RSI;
    } else if (indicadores.rsi > 55) {
        score -= 10 * CONFIG.PESOS.RSI;
    }

    // MACD
    const macdFactor = Math.min(Math.max(indicadores.macd.histograma * 10, -15), 15);
    score += macdFactor * CONFIG.PESOS.MACD;

    // Tendência
    switch (indicadores.tendencia) {
        case "FORTE_ALTA": score += 20 * CONFIG.PESOS.TENDENCIA; break;
        case "ALTA": score += 12 * CONFIG.PESOS.TENDENCIA; break;
        case "FORTE_BAIXA": score -= 20 * CONFIG.PESOS.TENDENCIA; break;
        case "BAIXA": score -= 12 * CONFIG.PESOS.TENDENCIA; break;
        case "LATERAL": score -= Math.min(state.contadorLaterais, 12) * CONFIG.PESOS.LATERALIDADE; break;
    }

    // Confirmadores
    const confirmacoes = [
        indicadores.rsi < 40 || indicadores.rsi > 60,
        Math.abs(indicadores.macd.histograma) > 0.05,
        indicadores.stoch.k < 30 || indicadores.stoch.k > 70,
        indicadores.williams < -70 || indicadores.williams > -30,
        indicadores.tendencia !== "LATERAL"
    ].filter(Boolean).length;

    score += confirmacoes * 4 * CONFIG.PESOS.CONFIRMACAO;
    
    return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia) {
    if (tendencia === "LATERAL") {
        return score > CONFIG.LIMIARES.SCORE_ALTO ? "CALL" : "ESPERAR";
    }
    if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
        return tendencia.includes("ALTA") ? "CALL" : "PUT";
    }
    if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
        return tendencia.includes("ALTA") ? "CALL" : "PUT";
    }
    return "ESPERAR";
}

// =============================================
// BUSCA DE DADOS DO MERCADO CRIPTO (BINANCE)
// =============================================
async function obterDadosCripto() {
    const url = `${CONFIG.HTTP_ENDPOINT}?symbol=${CONFIG.PARES.CRIPTOIDX}&interval=1m&limit=150`;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) throw new Error("Dados vazios");
        
        return data;
    } catch (e) {
        console.error("Erro ao buscar dados:", e);
        throw new Error("Falha na coleta de dados");
    }
}

// =============================================
// ANÁLISE DO MERCADO (CORRIGIDA)
// =============================================
async function analisarMercado() {
    if (state.leituraEmAndamento || !state.marketOpen) return;
    state.leituraEmAndamento = true;
    
    try {
        const dados = await obterDadosCripto();
        
        const closes = dados.map(v => parseFloat(v[4]));
        const highs = dados.map(v => parseFloat(v[2]));
        const lows = dados.map(v => parseFloat(v[3]));
        const volumes = dados.map(v => parseFloat(v[5]));
        
        const emaCurtaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
        const emaLongaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
        const ema200Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200);
        const emaCurta = emaCurtaArray[emaCurtaArray.length - 1] || 0;
        const emaLonga = emaLongaArray[emaLongaArray.length - 1] || 0;
        const ema200 = ema200Array[ema200Array.length - 1] || 0;

        const indicadores = {
            rsi: calcularRSI(closes),
            macd: calcularMACD(closes),
            stoch: calcularStochastic(highs, lows, closes),
            williams: calcularWilliams(highs, lows, closes),
            vwap: calcularVWAP(dados),
            atr: calcularATR(dados),
            close: closes[closes.length - 1],
            volume: volumes[volumes.length - 1],
            volumeMedia: calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME) || 1,
            emaCurta,
            emaLonga,
            ema200,
            tendencia: avaliarTendencia(closes, emaCurta, emaLonga, ema200)
        };

        const score = calcularScore(indicadores);
        const sinal = determinarSinal(score, indicadores.tendencia);

        state.ultimoSinal = sinal !== "ESPERAR" ? sinal : state.ultimoSinal;
        state.ultimoScore = score;
        state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

        atualizarInterface(sinal, score);

        const criteriosElement = document.getElementById("criterios");
        if (criteriosElement) {
            criteriosElement.innerHTML = `
                <li>📊 Tendência: ${indicadores.tendencia.replace('_', ' ')} ${
                    indicadores.tendencia.includes("ALTA") ? '🟢' :
                    indicadores.tendencia.includes("BAIXA") ? '🔴' : '🟡'}</li>
                <li>📉 RSI: ${indicadores.rsi.toFixed(2)}</li>
                <li>📊 MACD: ${indicadores.macd.histograma.toFixed(6)} ${
                    indicadores.macd.histograma > 0 ? '🟢' : '🔴'}</li>
                <li>📈 Stochastic K/D: ${indicadores.stoch.k.toFixed(2)}/${indicadores.stoch.d.toFixed(2)}</li>
                <li>📊 Williams: ${indicadores.williams.toFixed(2)}</li>
                <li>💰 Preço: $${indicadores.close.toFixed(2)}</li>
                <li>📶 Médias: EMA${CONFIG.PERIODOS.EMA_CURTA} ${indicadores.emaCurta.toFixed(2)} | 
                    EMA${CONFIG.PERIODOS.EMA_LONGA} ${indicadores.emaLonga.toFixed(2)} | 
                    EMA200 ${indicadores.ema200.toFixed(2)}</li>
                <li>💹 Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)}</li>
                <li>📌 VWAP: ${indicadores.vwap.toFixed(2)} | ATR: ${indicadores.atr.toFixed(6)}</li>
            `;
        }

        const sinalEmoji = sinal === "CALL" ? "🚀" : sinal === "PUT" ? "💥" : "⏳";
        state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%) ${sinalEmoji}`);
        if (state.ultimos.length > 10) state.ultimos.pop();

        const ultimosElement = document.getElementById("ultimos");
        if (ultimosElement) {
            ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
        }

        state.tentativasErro = 0;
    } catch (e) {
        console.error("Erro na análise:", e);
        atualizarInterface("ERRO", 0);
        
        if (++state.tentativasErro > 3) {
            setTimeout(() => location.reload(), 10000);
        }
    } finally {
        state.leituraEmAndamento = false;
    }
}

// =============================================
// CONTROLE DE TEMPO E INICIALIZAÇÃO (CORRIGIDO)
// =============================================
function sincronizarTimer() {
    clearInterval(state.intervaloAtual);
    
    const agora = new Date();
    const segundos = agora.getSeconds();
    state.timer = 60 - segundos;
    
    const elementoTimer = document.getElementById("timer");
    if (elementoTimer) {
        elementoTimer.textContent = formatarTimer(state.timer);
        elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
    }
    
    state.intervaloAtual = setInterval(() => {
        state.timer--;
        if (elementoTimer) {
            elementoTimer.textContent = formatarTimer(state.timer);
            elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
        }
        if (state.timer <= 0) {
            clearInterval(state.intervaloAtual);
            analisarMercado().finally(sincronizarTimer);
        }
    }, 1000);
}

function iniciarWebSocket() {
    try {
        state.websocket = new WebSocket(CONFIG.WS_ENDPOINT);
        
        state.websocket.onmessage = (event) => {
            const trade = JSON.parse(event.data);
            const price = parseFloat(trade.p);
            
            // Atualiza o preço atual na interface
            const priceElements = document.querySelectorAll('.info-value');
            if (priceElements.length > 0) {
                priceElements[0].textContent = `$${price.toFixed(2)}`;
            }
        };
        
        state.websocket.onerror = (error) => {
            console.error("WebSocket error:", error);
            setTimeout(() => {
                iniciarWebSocket();
            }, 5000);
        };
        
        state.websocket.onclose = () => {
            setTimeout(() => {
                iniciarWebSocket();
            }, 3000);
        };
    } catch (e) {
        console.error("Erro ao iniciar WebSocket:", e);
        setTimeout(() => {
            iniciarWebSocket();
        }, 5000);
    }
}

function iniciarAplicativo() {
    const ids = ['comando', 'score', 'hora', 'timer', 'criterios', 'ultimos'];
    const faltando = ids.filter(id => !document.getElementById(id));
    
    if (faltando.length > 0) {
        console.error("Elementos faltando:", faltando);
        return;
    }
    
    setInterval(atualizarRelogio, 1000);
    sincronizarTimer();
    analisarMercado().finally(sincronizarTimer);
    iniciarWebSocket();
    
    window.addEventListener('beforeunload', () => {
        if (state.websocket) state.websocket.close();
        clearInterval(state.intervaloAtual);
    });
}

// Inicialização
if (document.readyState === "complete") {
    iniciarAplicativo();
} else {
    document.addEventListener("DOMContentLoaded", iniciarAplicativo);
}
