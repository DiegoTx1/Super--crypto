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
// INDICADORES TÉCNICOS
// =============================================
function calcularRSI(closes, periodo = 14) {
  if (!Array.isArray(closes) return 50;
  if (closes.length < periodo + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = 1; i <= periodo; i++) {
    if (i >= closes.length) break;
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
  if (dados.some(isNaN)) return [];
  
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
    
    if (!Array.isArray(emaRapida) || !Array.isArray(emaLenta) || emaRapida.length < 1 || emaLenta.length < 1) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }

    const macdLinha = [];
    const inicio = Math.max(rapida, lenta);

    for (let i = inicio; i < closes.length; i++) {
      if (i >= emaRapida.length || i >= emaLenta.length) break;
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
    if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes)) return 0;
    if (highs.length !== lows.length || highs.length !== closes.length) return 0;
    if (highs.length < periodo * 2) return 0;

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

    const adx = calcularSerieEMA(dx, periodo);
    return adx.length > 0 ? adx[adx.length - 1] : 0;
  } catch (e) {
    console.error("Erro no cálculo ADX:", e);
    return 0;
  }
}

function detectarFractais(highs, lows, periodo = 3) {
  try {
    if (!Array.isArray(highs) || !Array.isArray(lows)) return null;
    if (highs.length !== lows.length) return null;
    if (highs.length < periodo * 2 + 1) return null;

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
// LÓGICA PRINCIPAL
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

    // Filtra candles inválidos
    const dadosValidos = dados.filter(v => 
      Array.isArray(v) && 
      v.length >= 6 && 
      !isNaN(parseFloat(v[4])) && 
      !isNaN(parseFloat(v[2])) && 
      !isNaN(parseFloat(v[3]))
    );

    if (dadosValidos.length < 50) {
      throw new Error("Dados históricos insuficientes após filtragem");
    }

    const velaAtual = dadosValidos[dadosValidos.length - 1];
    const close = parseFloat(velaAtual[4]);
    const high = parseFloat(velaAtual[2]);
    const low = parseFloat(velaAtual[3]);
    const volume = parseFloat(velaAtual[5]);

    if (isNaN(close)) throw new Error("Preço de fechamento inválido");
    if (isNaN(high)) throw new Error("Preço máximo inválido");
    if (isNaN(low)) throw new Error("Preço mínimo inválido");
    if (isNaN(volume)) throw new Error("Volume inválido");

    const closes = dadosValidos.map(v => parseFloat(v[4]));
    const highs = dadosValidos.map(v => parseFloat(v[2]));
    const lows = dadosValidos.map(v => parseFloat(v[3]));
    const volumes = dadosValidos.map(v => parseFloat(v[5]));

    // Calcula indicadores
    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    const sma9 = calcularSMA(closes, 9);
    const ema21Array = calcularSerieEMA(closes, 21);
    const ema21 = ema21Array.length > 0 ? ema21Array[ema21Array.length - 1] : 0;
    const ema50Array = calcularSerieEMA(closes, 50);
    const ema50 = ema50Array.length > 0 ? ema50Array[ema50Array.length - 1] : 0;
    const adx = calcularADX(highs, lows, closes);
    const fractal = detectarFractais(highs, lows);
    const volumeMedia = calcularSMA(volumes, 20) || 0;

    // Sistema de pontuação
    let pontosCALL = 0;
    let pontosPUT = 0;

    // Regras de entrada
    if (rsi < 30 && close > ema21) pontosCALL += 2;
    if (rsi > 70 && close < ema21) pontosPUT += 2;

    if (macd.histograma > 0 && macd.macdLinha > macd.sinalLinha) pontosCALL += 2;
    if (macd.histograma < 0 && macd.macdLinha < macd.sinalLinha) pontosPUT += 2;

    if (sma9 > ema21 && ema21 > ema50) pontosCALL += 1;
    if (sma9 < ema21 && ema21 < ema50) pontosPUT += 1;

    if (fractal?.tipo === "FUNDO" && volume > volumeMedia * 1.2) pontosCALL += 1;
    if (fractal?.tipo === "TOPO" && volume > volumeMedia * 1.2) pontosPUT += 1;

    if (adx > 25) {
      if (macd.macdLinha > macd.sinalLinha) pontosCALL += 1;
      else pontosPUT += 1;
    }

    // Tomada de decisão
    let comando = "ESPERAR";
    if (pontosCALL >= 5 && pontosCALL >= pontosPUT + 2) comando = "CALL";
    else if (pontosPUT >= 5 && pontosPUT >= pontosCALL + 2) comando = "PUT";

    // Atualiza UI
    ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR", {
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });

    const elementoComando = document.getElementById("comando");
    if (elementoComando) elementoComando.textContent = comando;
    
    const elementoScore = document.getElementById("score");
    if (elementoScore) elementoScore.textContent = `RSI: ${rsi.toFixed(2)} | ADX: ${adx.toFixed(2)}`;
    
    const elementoHora = document.getElementById("hora");
    if (elementoHora) elementoHora.textContent = ultimaAtualizacao;

    const elementoCriterios = document.getElementById("criterios");
    if (elementoCriterios) {
      elementoCriterios.innerHTML = `
        <li>RSI: ${rsi.toFixed(2)} (${rsi < 30 ? '↓' : rsi > 70 ? '↑' : '•'})</li>
        <li>ADX: ${adx.toFixed(2)} ${adx > 25 ? '📈' : ''}</li>
        <li>MACD: ${macd.histograma.toFixed(4)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>Preço: $${close.toFixed(2)}</li>
        <li>Médias: ${sma9?.toFixed(2) || 'N/A'} / ${ema21?.toFixed(2) || 'N/A'} / ${ema50?.toFixed(2) || 'N/A'}</li>
        <li>Fractal: ${fractal?.tipo || "—"} ${fractal?.tipo ? (fractal.tipo === "TOPO" ? '🔻' : '🔺') : ''}</li>
      `;
    }

    // Atualiza histórico
    ultimos.unshift(`${ultimaAtualizacao} - ${comando} ($${close.toFixed(2)})`);
    ultimos = ultimos.slice(0, 5);
    
    const elementoUltimos = document.getElementById("ultimos");
    if (elementoUltimos) {
      elementoUltimos.innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");
    }

    // Sons de alerta
    try {
      if (comando === "CALL") {
        const somCall = document.getElementById("som-call");
        if (somCall) await somCall.play().catch(e => console.warn("Erro ao reproduzir som:", e));
      }
      if (comando === "PUT") {
        const somPut = document.getElementById("som-put");
        if (somPut) await somPut.play().catch(e => console.warn("Erro ao reproduzir som:", e));
      }
    } catch (e) {
      console.warn("Erro ao reproduzir som:", e);
    }

  } catch (e) {
    console.error("Erro na leitura:", e);
    setTimeout(leituraReal, 10000);
  } finally {
    leituraEmAndamento = false;
  }
}

// =============================================
// TIMER PRECISO
// =============================================
function iniciarTimer() {
  if (intervaloAtual) {
    clearInterval(intervaloAtual);
  }

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
      if (timer <= 5) elementoTimer.style.color = 'red';
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
    console.error("
