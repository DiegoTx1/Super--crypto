// 1. CORREÇÃO NO CÁLCULO DE VOLUME (Linha 870)
// Original:
volume: velaAtual.volume,

// Corrigido:
volume: velaAtual.volume || 0, // Previne NaN

// 2. AJUSTE NO CÁLCULO DE WILLIAMS %R (Linha 290)
// Original:
return range > 0 ? ((highestHigh - closes[closes.length-1]) / range) * -100 : 0;

// Corrigido:
return range > 0 ? ((highestHigh - closes[closes.length-1]) / range) * -100 : -50; // Valor neutro

// 3. MELHORIA NA DETECÇÃO DE ORDENS OCULTAS (Linha 703)
// Original:
const largeOrders = data.bids.filter(bid => parseFloat(bid[1]) > 10)
                   .concat(data.asks.filter(ask => parseFloat(ask[1]) > 10));
return largeOrders.length > 5;

// Otimizado:
const largeBids = data.bids.filter(bid => parseFloat(bid[1]) > 10);
const largeAsks = data.asks.filter(ask => parseFloat(ask[1]) > 10);
return (largeBids.length > 3 && largeAsks.length > 3); // Exige liquidez bilateral
