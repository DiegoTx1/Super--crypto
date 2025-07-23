         // =============================================
        // CONFIGURAÇÕES GLOBAIS (OTIMIZADAS PARA CRYPTO)
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
            marketOpen: true,
            tendenciaDetectada: "NEUTRA",
            forcaTendencia: 0,
            dadosHistoricos: [],
            resistenciaKey: 0,
            suporteKey: 0,
            rsiCache: { avgGain: 0, avgLoss: 0, initialized: false },
            emaCache: { ema5: null, ema13: null, ema50: null },
            macdCache: { emaRapida: null, emaLenta: null, macdLine: [], signalLine: [] },
            superTrendCache: [],
            atrGlobal: 0,
            rsiHistory: [],
            cooldown: 0,
            volumeHistory: []
        };

        const CONFIG = {
            API_ENDPOINTS: { TWELVE_DATA: "https://api.twelvedata.com" },
            PARES: { CRYPTO_IDX: "BTC/USD" },
            PERIODOS: {
                RSI: 9,
                STOCH: 14,
                EMA_CURTA: 5,
                EMA_MEDIA: 13,
                EMA_LONGA: 50,
                MACD_RAPIDA: 6,
                MACD_LENTA: 13,
                MACD_SINAL: 9,
                ANALISE_LATERAL: 20,
                ATR: 14,
                SUPERTREND: 7,
                DIVERGENCIA_LOOKBACK: 8,
                EXTREME_LOOKBACK: 2,
                VOLUME_LOOKBACK: 10
            },
            LIMIARES: {
                SCORE_ALTO: 85,
                SCORE_MEDIO: 70,
                RSI_OVERBOUGHT: 72,
                RSI_OVERSOLD: 28,
                STOCH_OVERBOUGHT: 80,
                STOCH_OVERSOLD: 20,
                VARIACAO_LATERAL: 0.006,
                ATR_LIMIAR: 0.012,
                VOLUME_PICO: 1.5,
                VOLUME_MINIMO: 0.7
            },
            PESOS: {
                RSI: 1.7,
                MACD: 2.2,
                TENDENCIA: 2.8,
                STOCH: 1.2,
                SUPERTREND: 1.9,
                DIVERGENCIA: 2.0,
                VOLUME: 1.5,
                PADRAO_VELA: 1.8
            }
        };

        const API_KEYS = ["9cf795b2a4f14d43a049ca935d174ebb", "0105e6681b894e0185704171c53f5075"];
        let currentKeyIndex = 0;
        let errorCount = 0;

        // =============================================
        // SISTEMA DE TENDÊNCIA MULTI-EMA
        // =============================================
        function avaliarTendencia(ema5, ema13, ema50, volume, volumeMedio) {
            const diffCurto = ema5 - ema13;
            const diffLongo = ema13 - ema50;
            const forcaCurto = Math.min(100, Math.abs(diffCurto * 10000));
            const forcaLongo = Math.min(100, Math.abs(diffLongo * 10000));
            
            // Ponderar pela força das duas tendências
            const forca = (forcaCurto * 0.7 + forcaLongo * 0.3);
            const volumeFator = volume > volumeMedio * CONFIG.LIMIARES.VOLUME_PICO ? 1.2 : 
                            volume < volumeMedio * CONFIG.LIMIARES.VOLUME_MINIMO ? 0.8 : 1;

            if (forca > 75) {
                return diffCurto > 0 
                    ? { tendencia: "FORTE_ALTA", forca: forca * volumeFator }
                    : { tendencia: "FORTE_BAIXA", forca: forca * volumeFator };
            }
            
            if (forca > 40) {
                return diffCurto > 0 
                    ? { tendencia: "ALTA", forca: forca * volumeFator } 
                    : { tendencia: "BAIXA", forca: forca * volumeFator };
            }
            
            return { tendencia: "NEUTRA", forca: 0 };
        }

        // =============================================
        // DETECÇÃO DE PADRÕES DE VELAS
        // =============================================
        function detectarPadraoVelas(velas) {
            const velaAtual = velas[velas.length - 1];
            const velaAnterior = velas[velas.length - 2];
            
            // Martelo (Hammer)
            if (velaAtual.close > velaAtual.open && 
                (velaAtual.close - velaAtual.open) * 3 < (velaAtual.open - velaAtual.low) &&
                (velaAtual.high - velaAtual.close) < (velaAtual.open - velaAtual.low) * 0.3) {
                return "MARTELO";
            }
            
            // Martelo invertido (Inverted Hammer)
            if (velaAtual.close > velaAtual.open && 
                (velaAtual.close - velaAtual.open) * 3 < (velaAtual.high - velaAtual.close) &&
                (velaAtual.open - velaAtual.low) < (velaAtual.high - velaAtual.close) * 0.3) {
                return "MARTELO_INVERTIDO";
            }
            
            // Engolfo de alta (Bullish Engulfing)
            if (velaAnterior.close < velaAnterior.open &&
                velaAtual.close > velaAtual.open &&
                velaAtual.open < velaAnterior.close &&
                velaAtual.close > velaAnterior.open) {
                return "ENGOLFO_ALTA";
            }
            
            // Engolfo de baixa (Bearish Engulfing)
            if (velaAnterior.close > velaAnterior.open &&
                velaAtual.close < velaAtual.open &&
                velaAtual.open > velaAnterior.close &&
                velaAtual.close < velaAnterior.open) {
                return "ENGOLFO_BAIXA";
            }
            
            return "NENHUM";
        }

        // =============================================
        // GERADOR DE SINAIS AVANÇADO
        // =============================================
        function gerarSinal(indicadores, divergencias, padraoVela) {
            const { rsi, stoch, macd, close, emaCurta, emaMedia, emaLonga, superTrend, tendencia } = indicadores;
            const zonas = calcularZonasPreco(state.dadosHistoricos);
            state.suporteKey = zonas.suporte;
            state.resistenciaKey = zonas.resistencia;

            // 1. Priorizar tendências fortes com confirmação de volume e padrão de vela
            if (tendencia.forca > 80) {
                if (tendencia.tendencia === "FORTE_ALTA") {
                    if (macd.histograma > 0 && close > emaCurta && (padraoVela === "MARTELO" || padraoVela === "ENGOLFO_ALTA")) 
                        return "CALL";
                } else if (tendencia.tendencia === "FORTE_BAIXA") {
                    if (macd.histograma < 0 && close < emaCurta && (padraoVela === "MARTELO_INVERTIDO" || padraoVela === "ENGOLFO_BAIXA")) 
                        return "PUT";
                }
            }

            // 2. Breakout com confirmação de volume
            const variacao = state.resistenciaKey - state.suporteKey;
            const limiteBreakout = variacao * 0.04;
            const volumeAtual = state.dadosHistoricos[state.dadosHistoricos.length-1].volume;
            const volumeMedio = calcularMedia.simples(state.volumeHistory, CONFIG.PERIODOS.VOLUME_LOOKBACK);

            if (close > (state.resistenciaKey + limiteBreakout) && volumeAtual > volumeMedio * 1.3) 
                return "CALL";
            
            if (close < (state.suporteKey - limiteBreakout) && volumeAtual > volumeMedio * 1.3) 
                return "PUT";

            // 3. Divergências com confirmação de preço e padrão de vela
            if (divergencias.divergenciaRSI) {
                if (divergencias.tipoDivergencia === "ALTA" && close > zonas.suporte && padraoVela === "MARTELO") 
                    return "CALL";
                if (divergencias.tipoDivergencia === "BAIXA" && close < zonas.resistencia && padraoVela === "MARTELO_INVERTIDO") 
                    return "PUT";
            }

            // 4. Condições de sobrevenda/sobrecompra com filtro de tendência
            if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD && stoch < CONFIG.LIMIARES.STOCH_OVERSOLD) {
                if (tendencia.tendencia.includes("ALTA") && close > emaMedia) 
                    return "CALL";
            }
            
            if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && stoch > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
                if (tendencia.tendencia.includes("BAIXA") && close < emaMedia) 
                    return "PUT";
            }

            return "ESPERAR";
        }

        // =============================================
        // CALCULADOR DE CONFIANÇA AVANÇADO
        // =============================================
        function calcularScore(sinal, indicadores, divergencias, padraoVela) {
            let score = 65;
            const { rsi, stoch, macd, close, emaMedia, superTrend, tendencia, volume, volumeMedio } = indicadores;

            // Fatores positivos
            if (sinal === "CALL") {
                // Tendência
                if (tendencia.tendencia.includes("ALTA")) score += 25;
                // Divergência
                if (divergencias.divergenciaRSI && divergencias.tipoDivergencia === "ALTA") score += 20;
                // Posição em relação à média
                if (close > emaMedia) score += 15;
                // SuperTrend
                if (close > superTrend.valor && superTrend.direcao > 0) score += 10;
                // Volume
                if (volume > volumeMedio * 1.3) score += 10;
                // MACD
                if (macd.histograma > 0) score += 8;
                // Padrão de vela
                if (padraoVela === "MARTELO" || padraoVela === "ENGOLFO_ALTA") score += 12;
            } 
            else if (sinal === "PUT") {
                if (tendencia.tendencia.includes("BAIXA")) score += 25;
                if (divergencias.divergenciaRSI && divergencias.tipoDivergencia === "BAIXA") score += 20;
                if (close < emaMedia) score += 15;
                if (close < superTrend.valor && superTrend.direcao < 0) score += 10;
                if (volume > volumeMedio * 1.3) score += 10;
                if (macd.histograma < 0) score += 8;
                if (padraoVela === "MARTELO_INVERTIDO" || padraoVela === "ENGOLFO_BAIXA") score += 12;
            }

            // Fatores negativos
            if ((sinal === "CALL" && rsi > 65) || (sinal === "PUT" && rsi < 35)) score -= 15;
            if (Math.abs(close - emaMedia) < 0.005 * close) score -= 10;

            return Math.min(100, Math.max(0, score));
        }

        // =============================================
        // FUNÇÕES UTILITÁRIAS
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

        function calcularZonasPreco(dados, periodo = 50) {
            if (dados.length < periodo) periodo = dados.length;
            const slice = dados.slice(-periodo);
            const highs = slice.map(v => v.high);
            const lows = slice.map(v => v.low);
            
            return {
                resistencia: Math.max(...highs),
                suporte: Math.min(...lows),
                pivot: (Math.max(...highs) + Math.min(...lows) + dados[dados.length-1].close) / 3
            };
        }

        function formatarTimer(segundos) {
            return `0:${segundos.toString().padStart(2, '0')}`;
        }

        // =============================================
        // INDICADORES TÉCNICOS (OTIMIZADOS)
        // =============================================
        function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
            if (closes.length < periodo + 1) return 50;
            
            if (!state.rsiCache.initialized) {
                let gains = 0, losses = 0;
                for (let i = 1; i <= periodo; i++) {
                    const diff = closes[i] - closes[i - 1];
                    if (diff > 0) gains += diff;
                    else losses -= diff;
                }
                state.rsiCache.avgGain = gains / periodo;
                state.rsiCache.avgLoss = losses / periodo;
                state.rsiCache.initialized = true;
                const rs = state.rsiCache.avgLoss === 0 ? Infinity : state.rsiCache.avgGain / state.rsiCache.avgLoss;
                return 100 - (100 / (1 + rs));
            }
            
            const diff = closes[closes.length - 1] - closes[closes.length - 2];
            if (diff > 0) {
                state.rsiCache.avgGain = ((state.rsiCache.avgGain * (periodo - 1)) + diff) / periodo;
                state.rsiCache.avgLoss = (state.rsiCache.avgLoss * (periodo - 1)) / periodo;
            } else {
                state.rsiCache.avgGain = (state.rsiCache.avgGain * (periodo - 1)) / periodo;
                state.rsiCache.avgLoss = ((state.rsiCache.avgLoss * (periodo - 1)) - diff) / periodo;
            }
            
            const rs = state.rsiCache.avgLoss === 0 ? Infinity : state.rsiCache.avgGain / state.rsiCache.avgLoss;
            return 100 - (100 / (1 + rs));
        }

        function calcularStochastic(highs, lows, closes, periodo = CONFIG.PERIODOS.STOCH) {
            try {
                if (closes.length < periodo) return 50;
                const currentClose = closes[closes.length-1];
                const high = Math.max(...highs.slice(-periodo));
                const low = Math.min(...lows.slice(-periodo));
                return ((currentClose - low) / (high - low)) * 100;
            } catch (e) {
                console.error("Erro no cálculo Stochastic:", e);
                return 50;
            }
        }

        function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, 
                            lenta = CONFIG.PERIODOS.MACD_LENTA, 
                            sinal = CONFIG.PERIODOS.MACD_SINAL) {
            try {
                if (state.macdCache.emaRapida === null || state.macdCache.emaLenta === null) {
                    const emaRapida = calcularMedia.exponencial(closes, rapida);
                    const emaLenta = calcularMedia.exponencial(closes, lenta);
                    const startIdx = Math.max(0, lenta - rapida);
                    const macdLinha = emaRapida.slice(startIdx).map((val, idx) => val - emaLenta[idx]);
                    const sinalLinha = calcularMedia.exponencial(macdLinha, sinal);
                    const ultimoMACD = macdLinha[macdLinha.length - 1] || 0;
                    const ultimoSinal = sinalLinha[sinalLinha.length - 1] || 0;
                    state.macdCache = {
                        emaRapida: emaRapida[emaRapida.length - 1],
                        emaLenta: emaLenta[emaLenta.length - 1],
                        macdLine: macdLinha,
                        signalLine: sinalLinha
                    };
                    return {
                        histograma: ultimoMACD - ultimoSinal,
                        macdLinha: ultimoMACD,
                        sinalLinha: ultimoSinal
                    };
                }
                
                const kRapida = 2 / (rapida + 1);
                const kLenta = 2 / (lenta + 1);
                const kSinal = 2 / (sinal + 1);
                const novoValor = closes[closes.length - 1];
                
                state.macdCache.emaRapida = novoValor * kRapida + state.macdCache.emaRapida * (1 - kRapida);
                state.macdCache.emaLenta = novoValor * kLenta + state.macdCache.emaLenta * (1 - kLenta);
                const novaMacdLinha = state.macdCache.emaRapida - state.macdCache.emaLenta;
                
                state.macdCache.macdLine.push(novaMacdLinha);
                const ultimoSinal = state.macdCache.signalLine.length > 0 
                    ? state.macdCache.signalLine[state.macdCache.signalLine.length - 1]
                    : novaMacdLinha;
                const novoSignal = novaMacdLinha * kSinal + ultimoSinal * (1 - kSinal);
                state.macdCache.signalLine.push(novoSignal);
                
                return {
                    histograma: novaMacdLinha - novoSignal,
                    macdLinha: novaMacdLinha,
                    sinalLinha: novoSignal
                };
            } catch (e) {
                console.error("Erro no cálculo MACD:", e);
                return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
            }
        }

        function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
            try {
                if (!Array.isArray(dados) || dados.length < periodo + 1) return 0;
                const trValues = [];
                for (let i = 1; i < dados.length; i++) {
                    const tr = Math.max(
                        dados[i].high - dados[i].low,
                        Math.abs(dados[i].high - dados[i-1].close),
                        Math.abs(dados[i].low - dados[i-1].close)
                    );
                    trValues.push(tr);
                }
                return calcularMedia.simples(trValues.slice(-periodo), periodo);
            } catch (e) {
                console.error("Erro no cálculo ATR:", e);
                return 0;
            }
        }

        function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3) {
            try {
                if (dados.length < periodo) return { direcao: 0, valor: 0 };
                if (state.atrGlobal === 0) state.atrGlobal = calcularATR(dados, periodo);
                
                const current = dados[dados.length - 1];
                const hl2 = (current.high + current.low) / 2;
                const atr = state.atrGlobal;
                const upperBand = hl2 + (multiplicador * atr);
                const lowerBand = hl2 - (multiplicador * atr);
                
                let superTrend, direcao;
                if (state.superTrendCache.length === 0) {
                    superTrend = upperBand;
                    direcao = 1;
                } else {
                    const prev = dados[dados.length - 2];
                    const prevSuperTrend = state.superTrendCache[state.superTrendCache.length - 1];
                    if (prev.close > prevSuperTrend.valor) {
                        direcao = 1;
                        superTrend = Math.max(lowerBand, prevSuperTrend.valor);
                    } else {
                        direcao = -1;
                        superTrend = Math.min(upperBand, prevSuperTrend.valor);
                    }
                }
                
                state.superTrendCache.push({ direcao, valor: superTrend });
                return { direcao, valor: superTrend };
            } catch (e) {
                console.error("Erro no cálculo SuperTrend:", e);
                return { direcao: 0, valor: 0 };
            }
        }

        function detectarDivergencias(closes, rsis, highs, lows) {
            try {
                const lookback = CONFIG.PERIODOS.DIVERGENCIA_LOOKBACK;
                if (closes.length < lookback || rsis.length < lookback) {
                    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
                }

                // Encontrar máximos e mínimos
                const priceHighs = [], priceLows = [], rsiHighs = [], rsiLows = [];
                
                for (let i = lookback; i < closes.length; i++) {
                    const priceSlice = closes.slice(i - lookback, i);
                    const rsiSlice = rsis.slice(i - lookback, i);
                    
                    const maxPrice = Math.max(...priceSlice);
                    const minPrice = Math.min(...priceSlice);
                    const maxRsi = Math.max(...rsiSlice);
                    const minRsi = Math.min(...rsiSlice);
                    
                    if (closes[i] === maxPrice) priceHighs.push(i);
                    if (closes[i] === minPrice) priceLows.push(i);
                    if (rsis[i] === maxRsi) rsiHighs.push(i);
                    if (rsis[i] === minRsi) rsiLows.push(i);
                }

                // Verificar divergências
                let divergenciaBaixa = false;
                let divergenciaAlta = false;

                if (priceHighs.length > 1 && rsiHighs.length > 1) {
                    const ultimoPreco = priceHighs[priceHighs.length - 1];
                    const penultimoPreco = priceHighs[priceHighs.length - 2];
                    const ultimoRsi = rsiHighs[rsiHighs.length - 1];
                    const penultimoRsi = rsiHighs[rsiHighs.length - 2];
                    
                    if (closes[ultimoPreco] > closes[penultimoPreco] && rsis[ultimoRsi] < rsis[penultimoRsi]) {
                        divergenciaBaixa = true;
                    }
                }

                if (priceLows.length > 1 && rsiLows.length > 1) {
                    const ultimoPreco = priceLows[priceLows.length - 1];
                    const penultimoPreco = priceLows[priceLows.length - 2];
                    const ultimoRsi = rsiLows[rsiLows.length - 1];
                    const penultimoRsi = rsiLows[rsiLows.length - 2];
                    
                    if (closes[ultimoPreco] < closes[penultimoPreco] && rsis[ultimoRsi] > rsis[penultimoRsi]) {
                        divergenciaAlta = true;
                    }
                }

                return {
                    divergenciaRSI: divergenciaAlta || divergenciaBaixa,
                    tipoDivergencia: divergenciaAlta ? "ALTA" : divergenciaBaixa ? "BAIXA" : "NENHUMA"
                };
            } catch (e) {
                console.error("Erro na detecção de divergências:", e);
                return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
            }
        }

        // =============================================
        // CORE DO SISTEMA (ATUALIZADO)
        // =============================================
        async function analisarMercado() {
            if (state.leituraEmAndamento) return;
            state.leituraEmAndamento = true;
            
            try {
                const dados = await obterDadosTwelveData();
                state.dadosHistoricos = dados;
                
                if (dados.length < 20) {
                    throw new Error(`Dados insuficientes (${dados.length} velas)`);
                }
                
                const velaAtual = dados[dados.length - 1];
                const closes = dados.map(v => v.close);
                const highs = dados.map(v => v.high);
                const lows = dados.map(v => v.low);
                const volumes = dados.map(v => v.volume);
                state.volumeHistory = volumes.slice(-CONFIG.PERIODOS.VOLUME_LOOKBACK);

                // Calcular indicadores
                const calcularEMA = (dados, periodo) => {
                    const emaArray = calcularMedia.exponencial(dados, periodo);
                    return emaArray[emaArray.length - 1];
                };

                const ema5 = calcularEMA(closes, CONFIG.PERIODOS.EMA_CURTA);
                const ema13 = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA);
                const ema50 = calcularEMA(closes, CONFIG.PERIODOS.EMA_LONGA);
                const superTrend = calcularSuperTrend(dados);
                const rsi = calcularRSI(closes);
                const stoch = calcularStochastic(highs, lows, closes);
                const macd = calcularMACD(closes);
                const atr = calcularATR(dados);
                const volumeMedio = calcularMedia.simples(state.volumeHistory, CONFIG.PERIODOS.VOLUME_LOOKBACK);

                // Preencher histórico de RSI
                state.rsiHistory = [];
                for (let i = CONFIG.PERIODOS.RSI; i < closes.length; i++) {
                    state.rsiHistory.push(calcularRSI(closes.slice(0, i+1)));
                }
                
                const divergencias = detectarDivergencias(closes, state.rsiHistory, highs, lows);
                const tendencia = avaliarTendencia(ema5, ema13, ema50, velaAtual.volume, volumeMedio);
                const padraoVela = detectarPadraoVelas(dados.slice(-3));

                state.tendenciaDetectada = tendencia.tendencia;
                state.forcaTendencia = Math.round(tendencia.forca);

                const indicadores = {
                    rsi,
                    stoch,
                    macd,
                    emaCurta: ema5,
                    emaMedia: ema13,
                    emaLonga: ema50,
                    close: velaAtual.close,
                    superTrend,
                    tendencia,
                    atr,
                    volume: velaAtual.volume,
                    volumeMedio
                };

                let sinal = gerarSinal(indicadores, divergencias, padraoVela);
                
                // Gerenciamento de cooldown
                if (sinal !== "ESPERAR" && state.cooldown <= 0) {
                    state.cooldown = 2; // Reduzido para 2 minutos
                } else if (state.cooldown > 0) {
                    state.cooldown--;
                    sinal = "ESPERAR";
                }

                const score = calcularScore(sinal, indicadores, divergencias, padraoVela);

                state.ultimoSinal = sinal;
                state.ultimoScore = score;
                state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

                atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

                // Atualizar critérios na interface
                const criteriosElement = document.getElementById("criterios");
                if (criteriosElement) {
                    criteriosElement.innerHTML = `
                        <li>📊 Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)</li>
                        <li>💰 Preço: ${indicadores.close.toFixed(2)}</li>
                        <li>📉 RSI: ${rsi.toFixed(2)} ${rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
                        <li>📊 MACD: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(4)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
                        <li>📈 Stochastic: ${stoch.toFixed(2)}</li>
                        <li>📌 Médias: EMA5 ${ema5.toFixed(2)} | EMA13 ${ema13.toFixed(2)} | EMA50 ${ema50.toFixed(2)}</li>
                        <li>📊 Suporte: ${state.suporteKey.toFixed(2)} | Resistência: ${state.resistenciaKey.toFixed(2)}</li>
                        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
                        <li>🚦 SuperTrend: ${superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'} (${superTrend.valor.toFixed(2)})</li>
                        <li>⚡ Volatilidade (ATR): ${atr.toFixed(4)}</li>
                        <li>📈 Volume: ${(indicadores.volume/indicadores.volumeMedio).toFixed(2)}x médio</li>
                        <li>🕯️ Padrão Vela: ${padraoVela}</li>
                    `;
                }

                state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
                if (state.ultimos.length > 8) state.ultimos.pop();
                
                const ultimosElement = document.getElementById("ultimos");
                if (ultimosElement) {
                    ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
                }

                state.tentativasErro = 0;
            } catch (e) {
                console.error("Erro na análise:", e);
                atualizarInterface("ERRO", 0, "ERRO", 0);
                
                const criteriosElement = document.getElementById("criterios");
                if (criteriosElement) {
                    criteriosElement.innerHTML = `<li>ERRO: ${e.message}</li>`;
                }
                
                if (++state.tentativasErro > 3) setTimeout(() => location.reload(), 10000);
            } finally {
                state.leituraEmAndamento = false;
            }
        }

        // =============================================
        // FUNÇÕES DE DADOS (TWELVE DATA API)
        // =============================================
        async function obterDadosTwelveData() {
            try {
                const apiKey = API_KEYS[currentKeyIndex];
                const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1min&outputsize=100&apikey=${apiKey}`;
                
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Falha na API: ${response.status}`);
                
                const data = await response.json();
                if (data.status === 'error') throw new Error(data.message || `Erro Twelve Data: ${data.code}`);
                
                const valores = data.values ? data.values.reverse() : [];
                
                return valores.map(item => ({
                    time: item.datetime,
                    open: parseFloat(item.open),
                    high: parseFloat(item.high),
                    low: parseFloat(item.low),
                    close: parseFloat(item.close),
                    volume: parseFloat(item.volume) || 1
                }));
            } catch (e) {
                console.error("Erro ao obter dados:", e);
                errorCount++;
                if (errorCount >= 2) {
                    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
                    errorCount = 0;
                }
                throw e;
            }
        }

        // =============================================
        // CONTROLE DE TEMPO
        // =============================================
        function sincronizarTimer() {
            clearInterval(state.intervaloAtual);
            const agora = new Date();
            const segundos = agora.getSeconds();
            state.timer = 60 - segundos;
            
            const elementoTimer = document.getElementById("timer");
            if (elementoTimer) {
                elementoTimer.textContent = formatarTimer(state.timer);
                elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
            }
            
            state.intervaloAtual = setInterval(() => {
                state.timer--;
                
                if (elementoTimer) {
                    elementoTimer.textContent = formatarTimer(state.timer);
                    elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
                }
                
                if (state.timer <= 0) {
                    clearInterval(state.intervaloAtual);
                    analisarMercado();
                    sincronizarTimer();
                }
            }, 1000);
        }

        // =============================================
        // INTERFACE DO USUÁRIO
        // =============================================
        function atualizarInterface(sinal, score, tendencia, forcaTendencia) {
            if (!state.marketOpen) return;
            
            const comandoElement = document.getElementById("comando");
            if (comandoElement) {
                comandoElement.textContent = sinal;
                comandoElement.className = sinal.toLowerCase();
                
                if (sinal === "CALL") comandoElement.textContent += " 📈";
                else if (sinal === "PUT") comandoElement.textContent += " 📉";
                else if (sinal === "ESPERAR") comandoElement.textContent += " ✋";
            }
            
            const scoreElement = document.getElementById("score");
            if (scoreElement) {
                scoreElement.textContent = `Confiança: ${score}%`;
                scoreElement.style.color = score >= CONFIG.LIMIARES.SCORE_ALTO ? '#00ff00' :
                                        score >= CONFIG.LIMIARES.SCORE_MEDIO ? '#ffff00' : '#ff0000';
            }
            
            const tendenciaElement = document.getElementById("tendencia");
            const forcaElement = document.getElementById("forca-tendencia");
            if (tendenciaElement && forcaElement) {
                tendenciaElement.textContent = tendencia;
                forcaElement.textContent = `${forcaTendencia}%`;
            }
            
            const progressBar = document.getElementById("trend-progress");
            if (progressBar) {
                progressBar.style.width = `${forcaTendencia}%`;
                if (tendencia.includes("ALTA")) {
                    progressBar.style.background = "var(--call)";
                } else if (tendencia.includes("BAIXA")) {
                    progressBar.style.background = "var(--put)";
                } else {
                    progressBar.style.background = "var(--wait)";
                }
            }
        }

        function atualizarRelogio() {
            const elementoHora = document.getElementById("hora");
            if (elementoHora) {
                const now = new Date();
                state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                elementoHora.textContent = state.ultimaAtualizacao;
            }
        }

        // =============================================
        // INICIALIZAÇÃO DO APLICATIVO
        // =============================================
        function iniciarAplicativo() {
            // Iniciar processos
            setInterval(atualizarRelogio, 1000);
            sincronizarTimer();
            setTimeout(analisarMercado, 1000);
        }

        // Iniciar quando o documento estiver pronto
        if (document.readyState === "complete") iniciarAplicativo();
        else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
    
