// Configurações do robô
const CONFIG = {
    asset: "IDX",
    timeframe: "1m",
    balance: 1000,
    riskPerTrade: 2, // 2% do saldo por operação
    minConfidence: 75, // Confiança mínima para operar
    maxTradesPerMinute: 2,
    indicators: {
        rsiPeriod: 9,
        emaShort: 5,
        emaLong: 13,
        stochPeriod: 14
    }
};

// Estado do robô
const state = {
    active: false,
    lastSignal: null,
    lastSignalTime: null,
    tradeCount: 0,
    signalHistory: [],
    indicators: {
        rsi: 50,
        macd: 0,
        stochK: 50,
        stochD: 50,
        ema5: 0,
        ema13: 0,
        volume: 0,
        trend: "NEUTRA",
        trendStrength: 50
    },
    iqOptionConnected: false,
    tradingEnabled: true
};

// Elementos DOM
const elements = {
    signal: document.getElementById('signal'),
    confidence: document.getElementById('confidence'),
    startBtn: document.getElementById('start-btn'),
    callBtn: document.getElementById('call-btn'),
    putBtn: document.getElementById('put-btn'),
    statusIndicator: document.getElementById('status-indicator'),
    statusText: document.getElementById('status-text'),
    historyList: document.getElementById('history-list'),
    rsi: document.getElementById('rsi'),
    macd: document.getElementById('macd'),
    stoch: document.getElementById('stoch'),
    ema5: document.getElementById('ema5'),
    ema13: document.getElementById('ema13'),
    volume: document.getElementById('volume'),
    trend: document.getElementById('trend'),
    strength: document.getElementById('strength'),
    lastSignal: document.getElementById('last-signal')
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Configurar event listeners
    elements.startBtn.addEventListener('click', toggleRobot);
    elements.callBtn.addEventListener('click', () => manualTrade('CALL'));
    elements.putBtn.addEventListener('click', () => manualTrade('PUT'));
    
    // Iniciar simulação de dados
    simulateMarketData();
    
    // Atualizar UI
    updateStatus();
});

// Alternar estado do robô
function toggleRobot() {
    state.active = !state.active;
    
    if (state.active) {
        elements.startBtn.innerHTML = '<i class="fas fa-pause"></i> Pausar Robô';
        elements.startBtn.classList.remove('btn-primary');
        elements.startBtn.classList.add('btn-danger');
        elements.statusIndicator.classList.add('call');
        elements.statusText.textContent = 'Operando...';
        
        // Conectar à IQ Option (simulação)
        setTimeout(() => {
            state.iqOptionConnected = true;
            updateStatus();
            addToHistory('Conexão estabelecida com IQ Option', 'system');
        }, 1500);
    } else {
        elements.startBtn.innerHTML = '<i class="fas fa-play"></i> Iniciar Robô';
        elements.startBtn.classList.remove('btn-danger');
        elements.startBtn.classList.add('btn-primary');
        elements.statusIndicator.classList.remove('call');
        elements.statusText.textContent = 'Pausado';
        state.iqOptionConnected = false;
    }
    
    updateStatus();
}

// Atualizar status da conexão
function updateStatus() {
    if (state.iqOptionConnected) {
        elements.statusIndicator.className = 'signal-indicator call';
        elements.statusText.textContent = 'Conectado';
    } else {
        elements.statusIndicator.className = 'signal-indicator wait';
        elements.statusText.textContent = state.active ? 'Conectando...' : 'Desconectado';
    }
}

// Operação manual
function manualTrade(direction) {
    if (!state.iqOptionConnected) {
        alert('Conecte-se à IQ Option primeiro!');
        return;
    }
    
    const signalData = {
        type: direction,
        confidence: 100,
        timestamp: new Date(),
        manual: true
    };
    
    executeTrade(signalData);
}

// Executar operação
function executeTrade(signal) {
    // Calcular valor da operação
    const tradeAmount = (CONFIG.balance * CONFIG.riskPerTrade) / 100;
    
    // Simular operação na IQ Option
    const success = Math.random() > 0.3; // 70% de sucesso
    const profit = success ? tradeAmount * 0.8 : -tradeAmount;
    
    // Atualizar saldo
    CONFIG.balance += profit;
    
    // Registrar operação
    signal.amount = tradeAmount;
    signal.profit = profit;
    signal.success = success;
    signal.timestamp = new Date();
    state.signalHistory.unshift(signal);
    
    // Atualizar UI
    updateTradeHistory();
    
    // Mostrar resultado
    const resultClass = success ? 'call' : 'put';
    const resultText = success ? 
        `SUCESSO! Lucro: $${profit.toFixed(2)}` : 
        `FALHA! Perda: $${Math.abs(profit).toFixed(2)}`;
    
    addToHistory(resultText, resultClass);
}

// Adicionar ao histórico
function addToHistory(text, type) {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    
    const historyItem = document.createElement('div');
    historyItem.className = `history-item`;
    
    historyItem.innerHTML = `
        <div>
            <span class="signal-indicator ${type}"></span>
            ${text}
        </div>
        <div class="time">${timeString}</div>
    `;
    
    elements.historyList.prepend(historyItem);
}

// Atualizar histórico de operações
function updateTradeHistory() {
    // Limitar histórico a 20 itens
    if (state.signalHistory.length > 20) {
        state.signalHistory = state.signalHistory.slice(0, 20);
    }
    
    // Atualizar lista
    elements.historyList.innerHTML = '';
    state.signalHistory.forEach(signal => {
        const time = new Date(signal.timestamp).toLocaleTimeString();
        const typeClass = signal.type ? signal.type.toLowerCase() : 'system';
        
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        let text = signal.manual ? 
            `Operação MANUAL (${signal.type})` : 
            `Operação AUTOMÁTICA (${signal.type})`;
        
        if (signal.success !== undefined) {
            text += ` | ${signal.success ? '✅' : '❌'} $${signal.profit.toFixed(2)}`;
        }
        
        historyItem.innerHTML = `
            <div>
                <span class="signal-indicator ${typeClass}"></span>
                ${text}
            </div>
            <div class="time">${time}</div>
        `;
        
        elements.historyList.appendChild(historyItem);
    });
}

// Gerar sinal de trading
function generateSignal() {
    if (!state.active || !state.iqOptionConnected) return;
    
    // Simular dados de mercado
    simulateMarketData();
    
    // Gerar sinal baseado nos indicadores
    let signal = "ESPERAR";
    let confidence = 0;
    
    // Lógica de geração de sinais (simplificada)
    if (state.indicators.trend === "ALTA" && state.indicators.trendStrength > 70) {
        if (state.indicators.rsi < 65 && state.indicators.stochK > 50) {
            signal = "CALL";
            confidence = 75 + Math.floor(Math.random() * 20);
        }
    } else if (state.indicators.trend === "BAIXA" && state.indicators.trendStrength > 70) {
        if (state.indicators.rsi > 35 && state.indicators.stochK < 50) {
            signal = "PUT";
            confidence = 75 + Math.floor(Math.random() * 20);
        }
    }
    
    // Limitar confiança
    confidence = Math.min(99, confidence);
    
    // Atualizar UI
    elements.signal.textContent = signal;
    elements.signal.className = `signal ${signal.toLowerCase()}`;
    elements.confidence.textContent = `Confiança: ${confidence}%`;
    
    // Adicionar classe de animação
    elements.signal.classList.add('pulse');
    setTimeout(() => {
        elements.signal.classList.remove('pulse');
    }, 500);
    
    // Registrar sinal
    if (signal !== "ESPERAR") {
        state.lastSignal = signal;
        state.lastSignalTime = new Date().toLocaleTimeString();
        elements.lastSignal.textContent = state.lastSignalTime;
        
        // Executar operação se confiança for alta
        if (confidence >= CONFIG.minConfidence && state.tradingEnabled) {
            const signalData = {
                type: signal,
                confidence: confidence,
                timestamp: new Date(),
                manual: false
            };
            
            executeTrade(signalData);
        }
        
        // Adicionar ao histórico
        addToHistory(`Sinal gerado: ${signal} (${confidence}%)`, signal.toLowerCase());
    }
}

// Simular dados de mercado
function simulateMarketData() {
    // Gerar dados aleatórios (em uma implementação real, isso viria da API)
    state.indicators.rsi = 40 + Math.random() * 40;
    state.indicators.macd = (Math.random() - 0.5) * 0.01;
    state.indicators.stochK = Math.floor(Math.random() * 100);
    state.indicators.stochD = Math.floor(Math.random() * 100);
    state.indicators.ema5 = 0.5 + Math.random() * 0.1;
    state.indicators.ema13 = 0.5 + Math.random() * 0.1;
    state.indicators.volume = Math.floor(Math.random() * 10000);
    
    // Gerar tendência
    const trendRand = Math.random();
    if (trendRand > 0.7) {
        state.indicators.trend = "ALTA";
        state.indicators.trendStrength = 60 + Math.floor(Math.random() * 40);
    } else if (trendRand < 0.3) {
        state.indicators.trend = "BAIXA";
        state.indicators.trendStrength = 60 + Math.floor(Math.random() * 40);
    } else {
        state.indicators.trend = "NEUTRA";
        state.indicators.trendStrength = 30 + Math.floor(Math.random() * 40);
    }
    
    // Atualizar UI
    updateIndicators();
}

// Atualizar indicadores na UI
function updateIndicators() {
    elements.rsi.textContent = state.indicators.rsi.toFixed(1);
    elements.macd.textContent = state.indicators.macd.toFixed(4);
    elements.stoch.textContent = `${state.indicators.stochK.toFixed(0)}/${state.indicators.stochD.toFixed(0)}`;
    elements.ema5.textContent = state.indicators.ema5.toFixed(4);
    elements.ema13.textContent = state.indicators.ema13.toFixed(4);
    elements.volume.textContent = state.indicators.volume.toLocaleString();
    elements.trend.textContent = state.indicators.trend;
    elements.strength.textContent = `${state.indicators.trendStrength}%`;
    
    // Colorir indicadores
    elements.rsi.style.color = state.indicators.rsi > 70 ? '#e74c3c' : 
                              state.indicators.rsi < 30 ? '#2ecc71' : '#3498db';
    
    elements.macd.style.color = state.indicators.macd > 0 ? '#2ecc71' : '#e74c3c';
}

// Simular mercado a cada 5 segundos
setInterval(generateSignal, 5000);

// Atualizar indicadores a cada segundo
setInterval(simulateMarketData, 1000);
