// =============================================
// CONFIGURAÇÕES DE SENSIBILIDADE (MODIFICAR AQUI)
// =============================================
const CONFIG = {
  PONTUACAO_MINIMA: 4,         // Era 5 (reduzido para pegar mais oportunidades)
  DIFERENCA_MINIMA: 2,         // Mantido para exigir confirmação
  RSI_OVERBOUGHT: 68,          // Era 70 (ajuste fino)
  RSI_OVERSOLD: 32,            // Era 30 (ajuste fino)
  ADX_FORCA_MINIMA: 20,        // Era 25 (mais oportunidades com tendência média)
  VOLUME_MULTIPLIER: 1.5       // Era 1.2 (exige volume mais significativo)
};

// =============================================
// SISTEMA DE PONTUAÇÃO (ATUALIZADO)
// =============================================
function calcularPontuacao() {
  let pontosCALL = 0;
  let pontosPUT = 0;

  // 1. Análise de RSI (ajustado com os novos limites)
  if (rsi < CONFIG.RSI_OVERSOLD && close > ema21) pontosCALL += 2;
  if (rsi > CONFIG.RSI_OVERBOUGHT && close < ema21) pontosPUT += 2;

  // 2. MACD (agora exige histograma mais significativo)
  if (macd.histograma > 0.0005 && macd.macdLinha > macd.sinalLinha) pontosCALL += 2;
  if (macd.histograma < -0.0005 && macd.macdLinha < macd.sinalLinha) pontosPUT += 2;

  // 3. Alinhamento de Médias (mais rigoroso)
  if (close > sma9 && sma9 > ema21 && ema21 > ema50) pontos
