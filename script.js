// =============================================
// VARIÁVEIS GLOBAIS ADICIONADAS
// =============================================
let ultimoSinalTimestamp = 0;
let ultimaTendencia = "LATERAL";
let bloqueioSinal = false;

// =============================================
// FUNÇÃO leituraReal() MODIFICADA
// =============================================
async function leituraReal() {
  if (leituraEmAndamento || bloqueioSinal) return;
  leituraEmAndamento = true;

  try {
    // ... [código anterior mantido até o cálculo dos indicadores] ...

    // 1. CÁLCULO DE TENDÊNCIA SINCRONIZADO COM GRÁFICO REAL
    const agora = Date.now();
    const diffMinutos = (agora - ultimoSinalTimestamp) / (1000 * 60
