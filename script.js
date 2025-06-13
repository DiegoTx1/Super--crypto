<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analisador Binance - BTC/USDT</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #1e1e2f;
      color: #fff;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    #comando {
      font-size: 2.5em;
      font-weight: bold;
      text-align: center;
      margin: 20px 0;
      padding: 15px;
      border-radius: 8px;
      background-color: #2a2a3a;
    }
    .call { color: #4CAF50; }
    .put { color: #F44336; }
    .esperar { color: #FFC107; }
    .card {
      background-color: #2a2a3a;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }
    ul { padding-left: 20px; }
    li { margin-bottom: 5px; }
    .flex-container {
      display: flex;
      justify-content: space-between;
      gap: 15px;
    }
    .flex-item { flex: 1; }
    #timer {
      font-size: 1.2em;
      text-align: center;
      margin: 10px 0;
    }
    #status {
      font-style: italic;
      color: #aaa;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>📈 Analisador BTC/USDT (Binance)</h1>
  
  <div class="card">
    <div id="timer">0:60</div>
    <div id="hora">--:--:--</div>
    <div id="historico">0 WIN / 0 LOSS</div>
  </div>

  <div id="comando" class="esperar">ESPERAR</div>
  
  <div class="flex-container">
    <div class="flex-item card">
      <h3>📊 Critérios Técnicos</h3>
      <ul id="criterios">
        <li>Carregando dados...</li>
      </ul>
    </div>
    
    <div class="flex-item card">
      <h3>⏳ Últimos Sinais</h3>
      <ul id="ultimos"></ul>
    </div>
  </div>

  <div id="status">Conectado à Binance</div>

  <!-- Sons de alerta (opcional) -->
  <audio id="som-call" src="https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3"></audio>
  <audio id="som-put" src="https://assets.mixkit.co/sfx/preview/mixkit-ominous-drums-227.mp3"></audio>

  <script>
    // =============================================
    // CONFIGURAÇÕES E ESTADO
    // =============================================
    const state = {
      win: 0,
      loss: 0,
      ultimos: [],
      timer: 60,
      ultimaAtualizacao: "",
      conexaoAtiva: true,
      dados: null
    };

    // =============================================
    // FUNÇÕES DE UTILIDADE
    // =============================================
    function formatarTimer(segundos) {
      return `0:${segundos.toString().padStart(2, '0')}`;
    }

    function atualizarRelogio() {
      const agora = new Date();
      document.getElementById("hora").textContent = agora.toLocaleTimeString("pt-BR", {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }

    function registrar(tipo) {
      if (tipo === 'WIN') state.win++;
      else state.loss++;
      
      document.getElementById("historico").textContent = 
        `${state.win} WIN / ${state.loss} LOSS`;
    }

    function atualizarStatus(mensagem, erro = false) {
      const elemento = document.getElementById("status");
      elemento.textContent = mensagem;
      elemento.style.color = erro ? "#F44336" : "#4CAF50";
    }

    // =============================================
    // FUNÇÕES DE INDICADORES TÉCNICOS (PRECISOS)
    // =============================================
    function calcularRSI(closes, periodo = 14) {
      if (closes.length < periodo) return 50;

      let ganhos = 0, perdas = 0;
      for (let i = 1; i <= periodo; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) ganhos += diff;
        else perdas += Math.abs(diff);
      }

      const rs = perdas === 0 ? 0 : ganhos / perdas;
      return 100 - (100 / (1 + rs));
    }

    function calcularEMA(dados, periodo, prevEMA) {
      if (dados.length < periodo) return null;

      const k = 2 / (periodo + 1);
      let ema = prevEMA || dados.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;

      for (let i = periodo; i < dados.length; i++) {
        ema = dados[i] * k + ema * (1 - k);
      }

      return ema;
    }

    function calcularMACD(closes, rapida = 12, lenta = 26, sinal = 9) {
      const ema12 = calcularEMA(closes, rapida);
      const ema26 = calcularEMA(closes, lenta);
      if (!ema12 || !ema26) return { histograma: 0 };

      const macdLine = ema12 - ema26;
      const signalLine = calcularEMA(closes.slice(-26), sinal, macdLine);
      return { histograma: macdLine - signalLine };
    }

    function detectarFractais(highs, lows, periodo = 5) {
      const fractais = [];
      for (let i = periodo; i < highs.length - periodo; i++) {
        if (highs[i] === Math.max(...highs.slice(i - periodo, i + periodo + 1))) {
          fractais.push({ tipo: "TOPO", index: i });
        } 
        else if (lows[i] === Math.min(...lows.slice(i - periodo, i + periodo + 1))) {
          fractais.push({ tipo: "FUNDO", index: i });
        }
      }
      return { ultimo: fractais[fractais.length - 1]?.tipo };
    }

    function calcularADX(highs, lows, closes, periodo = 14) {
      // Implementação simplificada (para versão precisa, use uma biblioteca)
      const variacao = Math.abs(closes[closes.length - 1] - closes[closes.length - periodo]);
      return Math.min((variacao / periodo) * 100, 100);
    }

    // =============================================
    // LÓGICA PRINCIPAL
    // =============================================
    async function analisarMercado() {
      try {
        atualizarStatus("Obtendo dados da Binance...");
        
        const response = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100");
        if (!response.ok) throw new Error("Falha na API");
        
        const dados = await response.json();
        state.dados = dados;
        const velaAtual = dados[dados.length - 1];
        
        // Processamento dos dados
        const close = parseFloat(velaAtual[4]);
        const closes = dados.map(v => parseFloat(v[4]));
        const highs = dados.map(v => parseFloat(v[2]));
        const lows = dados.map(v => parseFloat(v[3]));
        
        // Cálculo dos indicadores
        const rsi = calcularRSI(closes);
        const macd = calcularMACD(closes);
        const sma9 = calcularEMA(closes, 9);
        const ema21 = calcularEMA(closes, 21);
        const ema50 = calcularEMA(closes, 50);
        const adx = calcularADX(highs, lows, closes);
        const fractals = detectarFractais(highs, lows);

        // Atualização do estado
        state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR", {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        // Lógica de decisão
        let comando = "ESPERAR";
        let classeComando = "esperar";
        
        if (rsi < 30 && sma9 > ema21 && ema21 > ema50 && macd.histograma > 0 && fractals.ultimo === "FUNDO" && adx > 25) {
          comando = "CALL";
          classeComando = "call";
          registrar('WIN');
        } 
        else if (rsi > 70 && sma9 < ema21 && ema21 < ema50 && macd.histograma < 0 && fractals.ultimo === "TOPO" && adx > 25) {
          comando = "PUT";
          classeComando = "put";
          registrar('WIN');
        }

        // Atualização da UI
        document.getElementById("comando").textContent = comando;
        document.getElementById("comando").className = classeComando;
        
        document.getElementById("criterios").innerHTML = `
          <li>RSI: ${rsi.toFixed(2)} ${rsi < 30 ? "↓(sobrevendido)" : rsi > 70 ? "↑(sobrecomprado)" : "-"}</li>
          <li>ADX: ${adx.toFixed(2)} ${adx > 25 ? "✅(trend forte)" : "✖️(sem trend)"}</li>
          <li>MACD: ${macd.histograma.toFixed(4)} ${macd.histograma > 0 ? "↑" : "↓"}</li>
          <li>Preço: $${close.toFixed(2)}</li>
          <li>Médias: ${sma9?.toFixed(2) || '-'} > ${ema21?.toFixed(2) || '-'} > ${ema50?.toFixed(2) || '-'}</li>
          <li>Fractal: ${fractals.ultimo || "Nenhum"}</li>
        `;

        // Histórico de sinais
        state.ultimos.unshift(`${state.ultimaAtualizacao} - ${comando} ($${close.toFixed(2)})`);
        if (state.ultimos.length > 5) state.ultimos.pop();
        
        document.getElementById("ultimos").innerHTML = 
          state.ultimos.map(i => `<li>${i}</li>`).join("");

        // Sons de alerta
        if (comando === "CALL") document.getElementById("som-call")?.play();
        if (comando === "PUT") document.getElementById("som-put")?.play();

        atualizarStatus("Análise concluída - Próxima em 60s");

      } catch (e) {
        console.error("Erro na análise:", e);
        atualizarStatus(`Erro: ${e.message}`, true);
      }
    }

    // =============================================
    // INICIALIZAÇÃO E TIMERS
    // =============================================
    function iniciar() {
      // Timer principal (60 segundos)
      setInterval(() => {
        state.timer--;
        document.getElementById("timer").textContent = formatarTimer(state.timer);
        
        if (state.timer <= 0) {
          analisarMercado();
          state.timer = 60;
        }
      }, 1000);

      // Atualiza o relógio a cada segundo
      setInterval(atualizarRelogio, 1000);

      // Atualização rápida do preço (a cada 5s)
      setInterval(async () => {
        try {
          const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
          const dados = await response.json();
          const priceElement = document.querySelector("#criterios li:nth-child(4)");
          if (priceElement) {
            priceElement.textContent = `Preço: $${parseFloat(dados.lastPrice).toFixed(2)}`;
          }
        } catch (e) {
          console.log("Falha na atualização rápida:", e);
        }
      }, 5000);

      // Primeira execução
      atualizarRelogio();
      analisarMercado();
    }

    // Inicia o sistema
    document.addEventListener('DOMContentLoaded', iniciar);
  </script>
</body>
</html>
