// =============================================
// NOVAS FUNÇÕES DE ANÁLISE DE TENDÊNCIA
// =============================================
function identificarTendencia(closes, highs, lows) {
  const ema50 = calcularSerieEMA(closes, 50).pop() || 0;
  const ema200 = calcularSerieEMA(closes, 200).pop() || 0;
  const ultimoClose = closes[closes.length - 1];
  
  // Análise de volatilidade (ADX simplificado)
  let dmPlus = 0, dmMinus = 0;
  for (let i = 1; i < 14; i++) {
    const diffHigh = highs[i] - highs[i-1];
    const diffLow = lows[i-1] - lows[i];
    if (diffHigh > diffLow && diffHigh > 0) dmPlus += diffHigh;
    if (diffLow > diffHigh && diffLow > 0) dmMinus += diffLow;
  }
  const adx = (dmPlus - dmMinus) / (dmPlus + dmMinus) * 100;

  // Classificação da tendência
  if (ultimoClose > ema200 && ema50 > ema200 && adx > 25) {
    return "ALTA FORTE";
  } else if (ultimoClose > ema50 && adx > 20) {
    return "ALTA MODERADA";
  } else if (ultimoClose < ema200 && ema50 < ema200 && adx > 25) {
    return "BAIXA FORTE";
  } else if (ultimoClose < ema50 && adx > 20) {
    return "BAIXA MODERADA";
  } else {
    return "LATERALIZADO";
  }
}

// =============================================
// ATUALIZAÇÃO DA EXIBIÇÃO (MANTENDO LAYOUT)
// =============================================
function atualizarTela(comando, scoreConfianca, tendencia, possiveisEntradas) {
  // ... (código existente mantido)

  // Adiciona informações de tendência
  document.getElementById("tendencia").innerHTML = `
    <div class="tendencia ${tendencia.replace(/\s+/g, '-').toLowerCase()}">
      <span>Tendência: ${tendencia}</span>
      <div class="entradas">
        ${possiveisEntradas.call ? '⬆️ CALL: ' + possiveisEntradas.call + '%' : ''}
        ${possiveisEntradas.put ? ' ⬇️ PUT: ' + possiveisEntradas.put + '%' : ''}
      </div>
    </div>
  `;
}

// =============================================
// LÓGICA PRINCIPAL ATUALIZADA
// =============================================
async function leituraReal() {
  // ... (coleta de dados mantida)

  // Identificação precisa da tendência
  const tendencia = identificarTendencia(closes, highs, lows);
  
  // Cálculo de probabilidades
  const possiveisEntradas = {
    call: 0,
    put: 0
  };

  // Fatores para CALL
  if (rsi < 40) possiveisEntradas.call += 30;
  if (macd.histograma > 0.2) possiveisEntradas.call += 35;
  if (tendencia.includes("ALTA")) possiveisEntradas.call += 25;

  // Fatores para PUT
  if (rsi > 60) possiveisEntradas.put += 30;
  if (macd.histograma < -0.2) possiveisEntradas.put += 35;
  if (tendencia.includes("BAIXA")) possiveisEntradas.put += 25;

  // Normaliza para 100%
  const total = possiveisEntradas.call + possiveisEntradas.put;
  if (total > 0) {
    possiveisEntradas.call = Math.round((possiveisEntradas.call / total) * 100);
    possiveisEntradas.put = Math.round((possiveisEntradas.put / total) * 100);
  }

  // Decisão final
  let comando = "ESPERAR";
  if (possiveisEntradas.call >= 60 && scoreConfianca >= 65) comando = "CALL";
  if (possiveisEntradas.put >= 60 && scoreConfianca >= 65) comando = "PUT";

  // Atualiza interface
  atualizarTela(comando, scoreConfianca, tendencia, possiveisEntradas);
}
