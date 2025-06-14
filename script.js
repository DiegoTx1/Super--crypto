// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
let win = 0, loss = 0;
let ultimos = [];
let timer = 60;
let ultimaAtualizacao = "";
let leituraEmAndamento = false;
let intervaloAtual = null;

// Configurações de Análise
const ANALISE_CONFIG = {
  RSI_OVERBOUGHT: 70,
  RSI_OVERSOLD: 30,
  ADX_FORCA_MINIMA: 25,
  VOLUME_MULTIPLIER: 1.3,
  PONTUACAO_MINIMA: 4,
  DIFERENCA_MINIMA: 2
};

// =============================================
// FUNÇÕES BÁSICAS (MANTIDAS)
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
// INDICADORES TÉCNICOS (MANTIDOS)
// =============================================
function calcularRSI(closes, periodo = 14) {
  if (!Array.isArray(closes) || closes.length < periodo + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = 1; i <= periodo; i++) {
    if (typeof closes[i-1] === 'undefined') continue;
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
    
    if (!Array.isArray(emaRapida) || !Array.isArray(emaLenta)) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }

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
    if (!Array.isArray(highs) || highs.length < periodo * 2) return 0;

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

    return calcularSerieEMA(dx, periodo).pop() || 0;
  } catch (e) {
    console.error("Erro no cálculo ADX:", e);
    return 0;
  }
}

function detectarFractais(highs, lows, periodo = 3) {
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
// LÓGICA PRINCIPAL (PARTE MODIFICADA)
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
    const ema21 = ema21Array[ema21Array.length - 1] || 0;
    const ema50Array = calcularSerieEMA(closes, 50);
    const ema50 = ema50Array[ema50Array.length - 1] || 0;
    const adx = calcularADX(highs, lows, closes);
    const fractal = detectarFractais(highs, lows);
    const volumeMedia = calcularSMA(volumes, 20) || 0;

    // Sistema de pontuação MODIFICADO
    let pontosCALL = 0;
    let pontosPUT = 0;

    // 1. RSI com limites configuráveis
    if (rsi < ANALISE_CONFIG.RSI_OVERSOLD && close > ema21) pontosCALL += 2;
    if (rsi > ANALISE_CONFIG.RSI_OVERBOUGHT && close < ema21) pontosPUT += 2;

    // 2. MACD com verificação de força
    if (macd.histograma > 0.0002 && macd.macdLinha > macd.sinalLinha) pontosCALL += 2;
    if (macd.histograma < -0.0002 && macd.macdLinha < macd.sinalLinha) pontosPUT += 2;

    // 3. Alinhamento de médias mais rigoroso
    if (close > sma9 && sma9 > ema21 && ema21 > ema50) pontosCALL += 1;
    if (close < sma9 && sma9 < ema21 && ema21 < ema50) pontosPUT += 1;

    // 4. Fractais com volume significativo
    if (fractal?.tipo === "FUNDO" && volume > volumeMedia * ANALISE_CONFIG.VOLUME_MULTIPLIER) pontosCALL += 1;
    if (fractal?.tipo === "TOPO" && volume > volumeMedia * ANALISE_CONFIG.VOLUME_MULTIPLIER) pontosPUT += 1;

    // 5. ADX com força mínima configurável
    if (adx > ANALISE_CONFIG.ADX_FORCA_MINIMA) {
      if (macd.macdLinha > macd.sinalLinha) pontosCALL += 1;
      else pontosPUT += 1;
    }

    // Tomada de decisão MODIFICADA
    let comando = "ESPERAR";
    if (pontosCALL >= ANALISE_CONFIG.PONTUACAO_MINIMA && pontosCALL >= pontosPUT + ANALISE_CONFIG.DIFERENCA_MINIMA) {
      comando = "CALL";
    } else if (pontosPUT >= ANALISE_CONFIG.PONTUACAO_MINIMA && pontosPUT >= pontosCALL + ANALISE_CONFIG.DIFERENCA_MINIMA) {
      comando = "PUT";
    }

    // Atualiza UI (MANTIDO)
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
        <li>RSI: ${rsi.toFixed(2)} (${rsi < ANALISE_CONFIG.RSI_OVERSOLD ? '↓' : rsi > ANALISE_CONFIG.RSI_OVERBOUGHT ? '↑' : '•'})</li>
        <li>ADX: ${adx.toFixed(2)} ${adx > ANALISE_CONFIG.ADX_FORCA_MINIMA ? '📈' : ''}</li>
        <li>MACD: ${macd.histograma.toFixed(4)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>Preço: $${close.toFixed(2)}</li>
        <li>Médias: ${sma9?.toFixed(2) || 'N/A'} / ${ema21?.toFixed(2) || 'N/A'} / ${ema50?.toFixed(2) || 'N/A'}</li>
        <li>Fractal: ${fractal?.tipo || "—"} ${fractal?.tipo ? (fractal.tipo === "TOPO" ? '🔻' : '🔺') : ''}</li>
      `;
    }

    // Atualiza histórico
    if (comando !== "ESPERAR") {
      ultimos.unshift(`${ultimaAtualizacao} - ${comando} ($${close.toFixed(2)})`);
      if (ultimos.length > 5) ultimos.pop();
      
      const elementoUltimos = document.getElementById("ultimos");
      if (elementoUltimos) {
        elementoUltimos.innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");
      }

      // Sons de alerta
      try {
        const som = document.getElementById(`som-${comando.toLowerCase()}`);
        if (som) await som.play().catch(e => console.warn("Erro ao reproduzir som:", e));
      } catch (e) {
        console.warn("Erro ao reproduzir som:", e);
      }
    }

  } catch (e) {
    console.error("Erro na leitura:", e);
    setTimeout(leituraReal, 10000);
  } finally {
    leituraEmAndamento = false;
  }
}

// =============================================
// TIMER PRECISO (MANTIDO)
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
// INICIALIZAÇÃO (MANTIDO)
// =============================================
function iniciarAplicativo() {
  // Verifica ambiente
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.error("Ambiente de navegador não detectado");
    return;
  }

  // Verifica API fetch
  if (typeof fetch === 'undefined') {
    console.error("API fetch não disponível");
    return;
  }

  // Verifica elementos DOM
  const elementosNecessarios = [
    'hora', 'historico', 'comando', 
    'score', 'criterios', 'ultimos', 'timer'
  ];
  
  const elementosFaltando = elementosNecessarios
    .map(id => ({ id, elemento: document.getElementById(id) }))
    .filter(item => !item.elemento);
  
  if (elementosFaltando.length > 0) {
    console.error("Elementos DOM faltando:", elementosFaltando.map(item => item.id));
    return;
  }

  // Inicia os processos
  try {
    setInterval(atualizarRelogio, 1000);
    iniciarTimer();
    leituraReal();

    // Atualização contínua do preço
    setInterval(async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        
        const dados = await response.json();
        if (!dados || typeof dados.lastPrice === 'undefined') {
          throw new Error("Dados de preço inválidos");
        }

        const preco = parseFloat(dados.lastPrice);
        if (isNaN(preco)) throw new Error("Preço inválido");

        const precoLi = document.getElementById("criterios")?.querySelector("li:nth-child(4)");
        if (precoLi) {
          precoLi.textContent = `Preço: $${preco.toFixed(2)}`;
        }
      } catch (e) {
        console.error("Erro ao atualizar preço:", e);
      }
    }, 5000);

  } catch (e) {
    console.error("Erro na inicialização:", e);
  }
}

// Inicia quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarAplicativo);
} else {
  iniciarAplicativo();
}

// Testes unitários básicos
function testeUnidade() {
  console.assert(calcularRSI([], 14) === 50, "RSI deve retornar 50 para array vazio");
  console.assert(calcularSMA([1,2,3], 3) === 2, "SMA de [1,2,3] deve ser 2");
  console.assert(formatarTimer(5) === "0:05", "Formatação de timer deve ter 2 dígitos");
  console.assert(calcularMACD([]).histograma === 0, "MACD deve retornar 0 para array vazio");
}
testeUnidade();
