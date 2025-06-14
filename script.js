// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
let win = 0, loss = 0;
let ultimos = [];
let timer = 60;
let ultimaAtualizacao = "";
let leituraEmAndamento = false;
let intervaloAtual = null;

// =============================================
// MONITOR DE SAÚDE (DIAGNÓSTICO)
// =============================================
async function verificarProblemas() {
  try {
    const apiResponse = await fetch("https://api.binance.com/api/v3/ping");
    console.log("✅ Conexão com Binance:", apiResponse.ok ? "OK" : "FALHA");
    
    const candleData = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=2");
    const candles = await candleData.json();
    console.log("📊 Dados recebidos:", {
      candles: candles.length,
      últimoPreço: candles[0][4],
      horário: new Date(candles[0][0]).toLocaleTimeString()
    });
    
    const testRSI = calcularRSI([30,31,32,33,34,35,36,37,38,39,40,41,42,43,44]);
    console.log("📈 Teste RSI:", testRSI > 30 && testRSI < 70 ? "OK" : "VALOR ESTRANHO");
    
    return true;
  } catch (e) {
    console.error("❌ Falha no diagnóstico:", e);
    return false;
  }
}

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

function registrar(tipo) {
  if (tipo === 'WIN') win++;
  else if (tipo === 'LOSS') loss++;
  
  const elementoHistorico = document.getElementById("historico");
  if (elementoHistorico) {
    elementoHistorico.textContent = `${win} WIN / ${loss} LOSS`;
  }
}

function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

// =============================================
// INDICADORES TÉCNICOS (OTIMIZADOS)
// =============================================
function calcularRSI(closes, periodo = 14) {
  if (!Array.isArray(closes) || closes.length < periodo + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / periodo;
  let avgLoss = losses / periodo || 0.001;

  for (let i = periodo + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (periodo - 1) + gain) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
  }

  if (avgLoss <= 0.001) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularSerieEMA(dados, periodo) {
  if (!Array.isArray(dados) || dados.length < periodo) return [];
  
  const k = 2 / (periodo + 1);
  const emaArray = [];
  let soma = 0;
  
  for (let i = 0; i < periodo; i++) {
    soma += dados[i];
  }
  emaArray[periodo - 1] = soma / periodo;

  for (let i = periodo; i < dados.length; i++) {
    emaArray[i] = dados[i] * k + emaArray[i - 1] * (1 - k);
  }
  
  return emaArray;
}

function calcularSMA(dados, periodo) {
  if (!Array.isArray(dados) || dados.length < periodo) return null;
  return dados.slice(-periodo).reduce((a, b) => a + b, 0) / periodo;
}

function calcularMACD(closes, rapida = 12, lenta = 26, sinal = 9) {
  try {
    if (!Array.isArray(closes) || closes.length < lenta + sinal) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }

    const emaRapida = calcularSerieEMA(closes, rapida);
    const emaLenta = calcularSerieEMA(closes, lenta);
    
    const macdLinha = [];
    const inicio = Math.max(rapida, lenta);

    for (let i = inicio; i < closes.length; i++) {
      macdLinha[i] = emaRapida[i] - emaLenta[i];
    }

    const sinalLinha = calcularSerieEMA(macdLinha.slice(inicio), sinal);
    
    const ultimoMACD = macdLinha[macdLinha.length - 1] || 0;
    const ultimoSinal = sinalLinha[sinalLinha.length - 1] || 0;
    
    return {
      histograma: ultimoMACD - ultimoSinal,
      macdLinha: ultimoMACD,
      sinalLinha: ultimoSinal
    };
  } catch (e) {
    console.error("Erro no cálculo MACD:", e);
    return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  }
}

function calcularADX(highs, lows, closes, periodo = 14) {
  try {
    if (!Array.isArray(highs) || highs.length < periodo * 2) return { adx: 0, plusDI: 0, minusDI: 0 };

    const trs = [], plusDMs = [], minusDMs = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trs.push(tr);

      const highDiff = highs[i] - highs[i - 1];
      const lowDiff = lows[i - 1] - lows[i];
      plusDMs.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
      minusDMs.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
    }

    const trEMA = calcularSerieEMA(trs, periodo);
    const plusDMEMA = calcularSerieEMA(plusDMs, periodo);
    const minusDMEMA = calcularSerieEMA(minusDMs, periodo);

    const plusDI = plusDMEMA.map((dm, i) => 100 * (dm / (trEMA[i] || 1)));
    const minusDI = minusDMEMA.map((dm, i) => 100 * (dm / (trEMA[i] || 1)));

    const dx = plusDI.map((pdi, i) => {
      const sum = pdi + minusDI[i];
      return sum ? 100 * Math.abs(pdi - minusDI[i]) / sum : 0;
    });

    const adx = calcularSerieEMA(dx, periodo).pop() || 0;
    
    return {
      adx,
      plusDI: plusDI[plusDI.length - 1] || 0,
      minusDI: minusDI[minusDI.length - 1] || 0
    };
  } catch (e) {
    console.error("Erro no cálculo ADX:", e);
    return { adx: 0, plusDI: 0, minusDI: 0 };
  }
}

function detectarFractais(highs, lows, periodo = 2) {
  try {
    if (!Array.isArray(highs) || highs.length < periodo * 2 + 1) return null;

    const fractais = [];
    for (let i = periodo; i < highs.length - periodo; i++) {
      const highWindow = highs.slice(i - periodo, i + periodo + 1);
      const lowWindow = lows.slice(i - periodo, i + periodo + 1);
      if (highs[i] === Math.max(...highWindow)) fractais.push({ tipo: "TOPO", index: i });
      else if (lows[i] === Math.min(...lowWindow)) fractais.push({ tipo: "FUNDO", index: i });
    }
    return fractais.length ? fractais[fractais.length - 1] : null;
  } catch (e) {
    console.error("Erro na detecção de fractais:", e);
    return null;
  }
}

// =============================================
// LÓGICA PRINCIPAL - VERSÃO 2.2 (SENSÍVEL)
// =============================================
async function leituraReal() {
  if (leituraEmAndamento) return;
  leituraEmAndamento = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100", {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    
    const dados = await response.json();
    if (!Array.isArray(dados) || dados.length < 50) {
      throw new Error("Dados insuficientes");
    }

    const dadosValidos = dados.filter(v => 
      Array.isArray(v) && v.length >= 6 && !isNaN(parseFloat(v[4]))
    );

    if (dadosValidos.length < 50) throw new Error("Dados insuficientes após filtragem");

    const velaAtual = dadosValidos[dadosValidos.length - 1];
    const close = parseFloat(velaAtual[4]);
    const high = parseFloat(velaAtual[2]);
    const low = parseFloat(velaAtual[3]);
    const volume = parseFloat(velaAtual[5]);

    const closes = dadosValidos.map(v => parseFloat(v[4]));
    const highs = dadosValidos.map(v => parseFloat(v[2]));
    const lows = dadosValidos.map(v => parseFloat(v[3]));
    const volumes = dadosValidos.map(v => parseFloat(v[5]));

    // Calcula indicadores
    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    const sma9 = calcularSMA(closes, 9);
    const ema21 = calcularSerieEMA(closes, 21).pop() || 0;
    const ema50 = calcularSerieEMA(closes, 50).pop() || 0;
    const { adx, plusDI, minusDI } = calcularADX(highs, lows, closes);
    const fractal = detectarFractais(highs.slice(0, -1), lows.slice(0, -1));
    const volumeMedia = calcularSMA(volumes, 20) || 0;
    const volatilidade = (high - low) / low * 100;

    // Sistema de pontuação OTIMIZADO - versão 2.2
    let pontosCALL = 0;
    let pontosPUT = 0;

    // 1. Tendência (Peso maior) - Relaxado
    if (macd.histograma > 0) pontosCALL += 1;
    if (macd.histograma < 0) pontosPUT += 1;

    // 2. Momentum (Peso médio) - Limites ampliados
    if (rsi < 45) pontosCALL += 1;
    if (rsi > 55) pontosPUT += 1;

    // 3. Fractais (Confirmados por volume) - Mais sensível
    if (fractal?.tipo === "FUNDO") pontosCALL += 1;
    if (fractal?.tipo === "TOPO") pontosPUT += 1;

    // DECISÃO FINAL (Critério relaxado)
    let comando = "ESPERAR";
    if (volatilidade > 0.05) { // Filtro mínimo de volatilidade
      if (pontosCALL >= 2) comando = "CALL";
      else if (pontosPUT >= 2) comando = "PUT";
    }

    // DEBUG: Mostra pontuação no console
    console.log(`[${new Date().toLocaleTimeString()}] Pontuação: 
      CALL = ${pontosCALL} (MACD: ${macd.histograma > 0 ? '✔' : '✖'}, RSI: ${rsi < 45 ? '✔' : '✖'})
      PUT = ${pontosPUT} (MACD: ${macd.histograma < 0 ? '✔' : '✖'}, RSI: ${rsi > 55 ? '✔' : '✖'})
      Volatilidade: ${volatilidade.toFixed(2)}%
    `);

    // Notificações
    if (comando === "CALL" || comando === "PUT") {
      // Notificação no navegador
      if (Notification.permission === "granted") {
        new Notification(`SINAL ${comando}`, { 
          body: `BTC: $${close.toFixed(2)} (${new Date().toLocaleTimeString()})`,
          icon: comando === "CALL" ? 'https://i.imgur.com/upG7aIk.png' : 'https://i.imgur.com/DmG0pWQ.png'
        });
      }

      // Alerta sonoro
      const audio = new Audio(comando === "CALL" 
        ? 'https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3' 
        : 'https://assets.mixkit.co/sfx/preview/mixkit-ominous-drums-227.mp3');
      audio.play().catch(e => console.log("Ative o áudio manualmente!"));

      // Log colorido no console
      console.log(`%c${comando} em $${close.toFixed(2)}`, 
        `color: white; background: ${comando === "CALL" ? "green" : "red"}; font-size: 14px; padding: 4px;`);
    }

    // Atualiza UI
    ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR", {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const elementoComando = document.getElementById("comando");
    if (elementoComando) elementoComando.textContent = comando;
    
    const elementoScore = document.getElementById("score");
    if (elementoScore) elementoScore.textContent = `RSI: ${rsi.toFixed(2)} | ADX: ${adx.toFixed(2)} | MACD: ${macd.histograma.toFixed(4)}`;
    
    const elementoHora = document.getElementById("hora");
    if (elementoHora) elementoHora.textContent = ultimaAtualizacao;

    const elementoCriterios = document.getElementById("criterios");
    if (elementoCriterios) {
      elementoCriterios.innerHTML = `
        <li>RSI: ${rsi.toFixed(2)} ${rsi < 45 ? '↓' : rsi > 55 ? '↑' : '•'}</li>
        <li>ADX: ${adx.toFixed(2)} ${adx > 20 ? '📈' : '📉'}</li>
        <li>MACD: ${macd.histograma.toFixed(4)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>Preço: $${close.toFixed(2)} (Vol: ${volatilidade.toFixed(2)}%)</li>
        <li>Médias: ${sma9.toFixed(2)} / ${ema21.toFixed(2)} / ${ema50.toFixed(2)}</li>
        <li>Fractal: ${fractal?.tipo || "—"} ${fractal?.tipo ? (fractal.tipo === "TOPO" ? '🔻' : '🔺') : ''}</li>
      `;
    }

    // Atualiza histórico
    ultimos.unshift(`${ultimaAtualizacao} - ${comando} ($${close.toFixed(2)})`);
    if (ultimos.length > 5) ultimos.pop();
    
    const elementoUltimos = document.getElementById("ultimos");
    if (elementoUltimos) {
      elementoUltimos.innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");
    }

  } catch (e) {
    console.error("Erro na leitura:", e);
  } finally {
    leituraEmAndamento = false;
  }
}

// =============================================
// TIMER PRECISO (SINCRONIZADO COM CANDLE)
// =============================================
function iniciarTimer() {
  if (intervaloAtual) clearInterval(intervaloAtual);

  const agora = Date.now();
  const delayProximaVela = 60000 - (agora % 60000);
  timer = Math.max(1, Math.floor(delayProximaVela / 1000));

  const elementoTimer = document.getElementById("timer");
  if (elementoTimer) {
    elementoTimer.textContent = formatarTimer(timer);
    elementoTimer.style.color = timer <= 5 ? 'red' : '';
  }

  intervaloAtual = setInterval(() => {
    timer = Math.max(0, timer - 1);
    
    if (elementoTimer) {
      elementoTimer.textContent = formatarTimer(timer);
      elementoTimer.style.color = timer <= 5 ? 'red' : '';
    }

    if (timer <= 0) {
      clearInterval(intervaloAtual);
      leituraReal().finally(() => iniciarTimer());
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function iniciarAplicativo() {
  // Verifica ambiente
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.error("Ambiente de navegador não detectado");
    return;
  }

  // Verifica elementos DOM
  const elementosNecessarios = ['hora', 'historico', 'comando', 'score', 'criterios', 'ultimos', 'timer'];
  for (const id of elementosNecessarios) {
    if (!document.getElementById(id)) {
      console.error(`Elemento não encontrado: #${id}`);
      return;
    }
  }

  // Ativa notificações
  Notification.requestPermission().then(perm => {
    if (perm === "granted") console.log("🔔 Notificações ativadas!");
  });

  // Inicia processos
  verificarProblemas();
  setInterval(atualizarRelogio, 1000);
  iniciarTimer();
  leituraReal();

  // Atualização contínua do preço
  setInterval(async () => {
    try {
      const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
      if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
      
      const dados = await response.json();
      const precoLi = document.getElementById("criterios")?.querySelector("li:nth-child(4)");
      if (precoLi && dados.lastPrice) {
        precoLi.textContent = `Preço: $${parseFloat(dados.lastPrice).toFixed(2)}`;
      }
    } catch (e) {
      console.error("Erro ao atualizar preço:", e);
    }
  }, 5000);
}

// Inicia quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarAplicativo);
} else {
  iniciarAplicativo();
}
