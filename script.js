<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TX1 PRO 💹👨🏽‍💻 - Robô de Trading</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    :root {
      --primary: #2563eb;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --dark: #1e293b;
      --darker: #0f172a;
      --light: #f1f5f9;
      --gray: #94a3b8;
      --border-radius: 8px;
      --box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    }
    
    body {
      background-color: var(--darker);
      color: var(--light);
      line-height: 1.6;
      padding: 20px;
      min-height: 100vh;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    header {
      text-align: center;
      margin-bottom: 30px;
      padding: 20px;
    }
    
    h1 {
      font-size: 2.5rem;
      background: linear-gradient(90deg, var(--primary), #8b5cf6);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      margin-bottom: 10px;
    }
    
    .subtitle {
      color: var(--gray);
      font-size: 1.1rem;
    }
    
    .painel-central {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    
    @media (max-width: 768px) {
      .painel-central {
        grid-template-columns: 1fr;
      }
    }
    
    .coluna-esquerda, .coluna-direita {
      background-color: var(--dark);
      border-radius: var(--border-radius);
      padding: 20px;
      box-shadow: var(--box-shadow);
    }
    
    .card {
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #334155;
    }
    
    .card:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    
    .card h3 {
      color: #818cf8;
      margin-bottom: 15px;
      font-size: 1.3rem;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .info-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      padding: 8px 0;
    }
    
    .info-label {
      color: var(--gray);
    }
    
    .info-value {
      font-weight: 600;
      font-size: 1.1rem;
    }
    
    #comando {
      font-size: 2.2rem;
      font-weight: 700;
      margin: 10px 0;
      text-align: center;
      padding: 15px;
      border-radius: var(--border-radius);
      transition: all 0.3s ease;
    }
    
    #comando.call {
      background-color: rgba(16, 185, 129, 0.15);
      color: var(--success);
      text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
    }
    
    #comando.put {
      background-color: rgba(239, 68, 68, 0.15);
      color: var(--danger);
      text-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
    }
    
    #comando.esperar {
      background-color: rgba(245, 158, 11, 0.15);
      color: var(--warning);
      text-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
    }
    
    #comando.erro {
      background-color: rgba(239, 68, 68, 0.15);
      color: var(--danger);
      text-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
    }
    
    #score {
      font-size: 1.8rem;
      font-weight: 700;
    }
    
    #timer {
      color: #f87171;
      font-weight: 700;
    }
    
    #criterios {
      list-style: none;
      max-height: 200px;
      overflow-y: auto;
    }
    
    #criterios li {
      padding: 10px 0;
      border-bottom: 1px solid #2d3748;
      display: flex;
      align-items: center;
    }
    
    #criterios li:last-child {
      border-bottom: none;
    }
    
    #criterios li::before {
      content: "•";
      margin-right: 10px;
      color: #818cf8;
      font-size: 1.5rem;
    }
    
    .botões-de-negociação {
      display: flex;
      flex-direction: column;
      gap: 15px;
      margin-top: 20px;
    }
    
    .botões-de-negociação button {
      padding: 12px 20px;
      border: none;
      border-radius: var(--border-radius);
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    
    #btn-win {
      background-color: var(--success);
      color: white;
    }
    
    #btn-win:hover {
      background-color: #0da271;
      transform: translateY(-2px);
    }
    
    #btn-loss {
      background-color: var(--danger);
      color: white;
    }
    
    #btn-loss:hover {
      background-color: #dc2626;
      transform: translateY(-2px);
    }
    
    #performance {
      font-weight: 700;
      font-size: 1.3rem;
      text-align: center;
    }
    
    #ultimos {
      list-style: none;
      max-height: 200px;
      overflow-y: auto;
    }
    
    #ultimos li {
      padding: 12px 15px;
      margin-bottom: 8px;
      background: #2d3748;
      border-radius: 8px;
      display: flex;
      align-items: center;
      transition: transform 0.2s;
    }
    
    #ultimos li:hover {
      transform: translateX(5px);
      background: #374151;
    }
    
    #ultimos li:first-child {
      background: #4f46e5;
      font-weight: bold;
    }
    
    .chart-container {
      background-color: var(--dark);
      border-radius: var(--border-radius);
      padding: 15px;
      box-shadow: var(--box-shadow);
      margin-top: 20px;
    }
    
    .grafico {
      border-radius: var(--border-radius);
      overflow: hidden;
      height: 500px;
    }
    
    .status-bar {
      display: flex;
      justify-content: space-between;
      padding: 12px 20px;
      background-color: var(--dark);
      border-radius: var(--border-radius);
      margin-top: 20px;
      box-shadow: var(--box-shadow);
      font-size: 0.9rem;
    }
    
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    
    .badge-success {
      background-color: rgba(16, 185, 129, 0.2);
      color: var(--success);
    }
    
    .badge-warning {
      background-color: rgba(245, 158, 11, 0.2);
      color: var(--warning);
    }
    
    .badge-danger {
      background-color: rgba(239, 68, 68, 0.2);
      color: var(--danger);
    }
    
    .loading {
      text-align: center;
      padding: 20px;
      display: none;
    }
    
    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.1);
      border-left-color: #818cf8;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 15px;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>TX1 PRO <i class="fas fa-chart-line"></i> <i class="fas fa-robot"></i></h1>
      <p class="subtitle">Robô de Trading Automatizado para Mercado Cripto</p>
    </header>

    <div class="painel-central">
      <!-- Coluna Esquerda -->
      <div class="coluna-esquerda">
        <div class="card">
          <h3><i class="fas fa-signal"></i> Sinal Atual</h3>
          <div class="info-item">
            <span class="info-label">Comando:</span>
            <span id="comando" class="esperar">ESPERAR ⏳</span>
          </div>
          <div class="info-item">
            <span class="info-label">Pontuação:</span>
            <span id="score">--%</span>
          </div>
          <div class="info-item">
            <span class="info-label">Próxima Análise:</span>
            <span id="timer">60</span>s
          </div>
          <div class="info-item">
            <span class="info-label">Última Atualização:</span>
            <span id="hora">--:--:--</span>
          </div>
        </div>

        <div class="card">
          <h3><i class="fas fa-list-check"></i> Critérios de Análise</h3>
          <ul id="criterios">
            <li>Aguardando análise inicial...</li>
          </ul>
        </div>

        <div class="card">
          <h3><i class="fas fa-gamepad"></i> Controle de Negociação</h3>
          <div class="botões-de-negociação">
            <button id="btn-win"><i class="fas fa-trophy"></i> GANHAR</button>
            <button id="btn-loss"><i class="fas fa-skull"></i> PERDA</button>
            <div class="info-item">
              <span class="info-label">Desempenho:</span>
              <span id="performance">0%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Coluna Direita -->
      <div class="coluna-direita">
        <div class="card">
          <h3><i class="fas fa-history"></i> Histórico de Sinais</h3>
          <ul id="ultimos">
            <li>Nenhum sinal gerado ainda</li>
          </ul>
        </div>

        <div class="card">
          <h3><i class="fas fa-globe"></i> Dados de Mercado</h3>
          <div class="info-item">
            <span class="info-label">Dominância BTC:</span>
            <span id="btc-dominance">--% <span class="badge badge-warning">Estável</span></span>
          </div>
          <div class="info-item">
            <span class="info-label">Taxa de Financiamento:</span>
            <span id="funding">--% <span class="badge badge-success">Positiva</span></span>
          </div>
          <div class="info-item">
            <span class="info-label">Atividade das Baleias:</span>
            <span id="whale">-- <span class="badge badge-danger">Alta</span></span>
          </div>
        </div>

        <div class="card">
          <h3><i class="fas fa-exchange-alt"></i> Ordens em Aberto</h3>
          <ul id="ordens">
            <li>Nenhuma ordem ativa no momento</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Gráfico TradingView -->
    <div class="chart-container">
      <div class="info-item" style="margin-bottom: 15px;">
        <span class="info-label">BTC/USDT - Binance</span>
        <span class="info-value">$<span id="btc-price">--</span></span>
      </div>
      <div class="grafico" id="tradingview-chart"></div>
    </div>

    <div class="status-bar">
      <div>Status: <span id="status">Conectando à Binance...</span></div>
      <div>Atualização: <span id="last-update">--:--:--</span></div>
      <div>Versão: TX1 PRO 2.5</div>
    </div>

    <div class="loading" id="loading">
      <div class="spinner"></div>
      <p>Analisando dados de mercado...</p>
    </div>
  </div>

  <!-- Script principal integrado -->
  <script>
    // =============================================
    // CONFIGURAÇÕES GLOBAIS
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
        dadosMercado: [],
        performance: {
            total: 0,
            wins: 0,
            losses: 0
        }
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
        return segundos.toString().padStart(2, '0');
    }

    function atualizarRelogio() {
        const elementoHora = document.getElementById("hora");
        const lastUpdate = document.getElementById("last-update");
        if (elementoHora) {
            const now = new Date();
            const timeString = now.toLocaleTimeString("pt-BR", {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            elementoHora.textContent = timeString;
            if (lastUpdate) lastUpdate.textContent = timeString;
            state.marketOpen = true;
        }
    }

    function atualizarInterface(sinal, score) {
        if (!state.marketOpen && sinal !== "ERRO") return;

        const comandoElement = document.getElementById("comando");
        if (comandoElement) {
            comandoElement.textContent = sinal;
            comandoElement.className = sinal.toLowerCase();
            
            if (sinal === "CALL") comandoElement.innerHTML = "CALL 🚀";
            else if (sinal === "PUT") comandoElement.innerHTML = "PUT 💥";
            else if (sinal === "ESPERAR") comandoElement.innerHTML = "ESPERAR ⏳";
            else if (sinal === "ERRO") comandoElement.innerHTML = "ERRO ❌";
        }

        const scoreElement = document.getElementById("score");
        if (scoreElement) {
            scoreElement.textContent = `${score}%`;
            if (score >= CONFIG.LIMIARES.SCORE_ALTO) scoreElement.style.color = '#00ff00';
            else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) scoreElement.style.color = '#ffff00';
            else scoreElement.style.color = '#ff0000';
        }

        const horaElement = document.getElementById("hora");
        if (horaElement) {
            horaElement.textContent = state.ultimaAtualizacao;
        }
    }

    function mostrarCarregando(mostrar) {
        const loadingElement = document.getElementById("loading");
        if (loadingElement) {
            loadingElement.style.display = mostrar ? 'block' : 'none';
        }
    }

    // =============================================
    // INDICADORES TÉCNICOS
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
    // SISTEMA DE DECISÃO
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
    // BUSCA DE DADOS DO MERCADO CRIPTO
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
    // ANÁLISE DO MERCADO
    // =============================================
    async function analisarMercado() {
        if (state.leituraEmAndamento || !state.marketOpen) return;
        state.leituraEmAndamento = true;
        mostrarCarregando(true);
        
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
            document.getElementById('status').textContent = "Conectado | Última análise bem sucedida";
        } catch (e) {
            console.error("Erro na análise:", e);
            atualizarInterface("ERRO", 0);
            document.getElementById('status').textContent = "Erro na análise: " + e.message;
            
            if (++state.tentativasErro > 3) {
                setTimeout(() => location.reload(), 10000);
            }
        } finally {
            state.leituraEmAndamento = false;
            mostrarCarregando(false);
        }
    }

    // =============================================
    // CONTROLE DE TEMPO E INICIALIZAÇÃO
    // =============================================
    function sincronizarTimer() {
        clearInterval(state.intervaloAtual);
        
        const agora = new Date();
        const segundos = agora.getSeconds();
        state.timer = 60 - segundos;
        
        const elementoTimer = document.getElementById("timer");
        if (elementoTimer) {
            elementoTimer.textContent = formatarTimer(state.timer);
        }
        
        state.intervaloAtual = setInterval(() => {
            state.timer--;
            if (elementoTimer) {
                elementoTimer.textContent = formatarTimer(state.timer);
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
            
            state.websocket.onopen = () => {
                document.getElementById('status').textContent = "Conectado à Binance";
            };
            
            state.websocket.onmessage = (event) => {
                const trade = JSON.parse(event.data);
                const price = parseFloat(trade.p);
                
                // Atualiza o preço atual na interface
                const btcPriceElement = document.getElementById("btc-price");
                if (btcPriceElement) {
                    btcPriceElement.textContent = price.toFixed(2);
                }
            };
            
            state.websocket.onerror = (error) => {
                console.error("WebSocket error:", error);
                document.getElementById('status').textContent = "Erro na conexão WebSocket";
                
                setTimeout(() => {
                    iniciarWebSocket();
                }, 5000);
            };
            
            state.websocket.onclose = () => {
                document.getElementById('status').textContent = "Conexão WebSocket fechada. Reconectando...";
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

    function atualizarPerformance() {
        const performanceElement = document.getElementById("performance");
        if (performanceElement) {
            const total = state.performance.total;
            if (total === 0) {
                performanceElement.textContent = "0%";
                return;
            }
            const percent = (state.performance.wins / total) * 100;
            performanceElement.textContent = `${percent.toFixed(1)}%`;
        }
    }

    // =============================================
    // INICIALIZAÇÃO DO APLICATIVO
    // =============================================
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
        
        // Botões de negociação
        document.getElementById("btn-win").addEventListener('click', () => {
            state.performance.total++;
            state.performance.wins++;
            atualizarPerformance();
        });
        
        document.getElementById("btn-loss").addEventListener('click', () => {
            state.performance.total++;
            state.performance.losses++;
            atualizarPerformance();
        });
        
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
  </script>
</body>
</html>
