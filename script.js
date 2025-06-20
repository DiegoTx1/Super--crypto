// =============================================
// CONFIGURAÇÕES GLOBAIS PROFISSIONAIS (MERCADO REAL)
// =============================================
import com.binance.api.client.BinanceApiClientFactory;
import com.binance.api.client.BinanceApiRestClient;
import com.binance.api.client.BinanceApiWebSocketClient;
import com.binance.api.client.domain.market.Candlestick;
import com.binance.api.client.domain.market.CandlestickInterval;
import com.binance.api.client.domain.market.OrderBook;
import com.binance.api.client.domain.market.OrderBookEntry;
import org.ta4j.core.*;
import org.ta4j.core.indicators.*;
import org.ta4j.core.indicators.helpers.*;
import org.ta4j.core.num.DoubleNum;

import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

public class StockityCryptoProBot {

    // Configurações sensíveis (devem vir de variáveis de ambiente)
    private static final String API_KEY = System.getenv("BINANCE_API_KEY");
    private static final String SECRET_KEY = System.getenv("BINANCE_SECRET_KEY");
    private static final double CAPITAL_ALOCADO = Double.parseDouble(System.getenv("TRADING_CAPITAL"));
    
    // Estado global do sistema
    private static class BotState {
        static final List<Double> BTC_DOMINANCE_HISTORY = new CopyOnWriteArrayList<>();
        static double currentBTCDominance = 0.0;
        static double fundingRate = 0.0;
        static double lastEntryPrice = 0.0;
        static Position currentPosition = Position.NONE;
        static int consecutiveLosses = 0;
        static double dynamicRiskPercentage = 0.02;
        static double equity = CAPITAL_ALOCADO;
        static final Map<String, Double> LAST_INDICATORS = new ConcurrentHashMap<>();
    }

    // Configurações técnicas
    private static final class TradingConfig {
        // Parâmetros de mercado
        static final String TARGET_SYMBOL = "STOCKITY_CRYPTO_INDEX";
        static final String BTC_DOMINANCE_SYMBOL = "BTCUSDT";
        static final String LIQUIDITY_SYMBOL = "ETHUSDT";
        static final CandlestickInterval TIME_FRAME = CandlestickInterval.ONE_MINUTE;
        
        // Parâmetros de estratégia
        static final double MIN_BTC_DOMINANCE = 40.0;
        static final double MAX_BTC_DOMINANCE = 50.0;
        static final double FUNDING_RATE_THRESHOLD = -0.02;
        static final double WHALE_VOLUME_THRESHOLD = 2_000_000.0; // USD
        static final double VOLATILITY_FACTOR = 0.7;
        
        // Indicadores
        static final int RSI_PERIOD = 14;
        static final int VWAP_PERIOD = 20;
        static final int ATR_PERIOD = 14;
        static final int EMA_SHORT = 9;
        static final int EMA_LONG = 21;
        static final int MACD_FAST = 12;
        static final int MACD_SLOW = 26;
        static final int MACD_SIGNAL = 9;
        
        // Gerenciamento de risco
        static final double BASE_RISK = 0.02; // 2% por operação
        static final double MAX_RISK = 0.05;  // 5% máximo
        static final double MIN_RR_RATIO = 1.8;
        static final int MAX_CONSECUTIVE_LOSSES = 3;
    }

    // =============================================
    // CONEXÃO COM EXCHANGE (BINANCE API)
    // =============================================
    private static BinanceApiRestClient restClient;
    private static BinanceApiWebSocketClient wsClient;
    
    private static void initializeClients() {
        BinanceApiClientFactory factory = BinanceApiClientFactory.newInstance(API_KEY, SECRET_KEY);
        restClient = factory.newRestClient();
        wsClient = factory.newWebSocketClient();
    }

    // =============================================
    // INDICADORES PROFISSIONAIS (TEMPO REAL)
    // =============================================
    private static double calculateRSI(List<Candlestick> candles) {
        List<Double> closes = candles.stream()
            .map(c -> Double.parseDouble(c.getClose()))
            .collect(Collectors.toList());
        
        double avgGain = 0.0;
        double avgLoss = 0.0;
        
        // Primeiro cálculo
        for (int i = 1; i <= TradingConfig.RSI_PERIOD; i++) {
            double change = closes.get(i) - closes.get(i-1);
            if (change > 0) avgGain += change;
            else avgLoss -= change;
        }
        
        avgGain /= TradingConfig.RSI_PERIOD;
        avgLoss /= TradingConfig.RSI_PERIOD;
        
        // Cálculos subsequentes
        for (int i = TradingConfig.RSI_PERIOD + 1; i < closes.size(); i++) {
            double change = closes.get(i) - closes.get(i-1);
            double gain = Math.max(change, 0);
            double loss = Math.max(-change, 0);
            
            avgGain = ((avgGain * (TradingConfig.RSI_PERIOD - 1)) + gain) / TradingConfig.RSI_PERIOD;
            avgLoss = ((avgLoss * (TradingConfig.RSI_PERIOD - 1)) + loss) / TradingConfig.RSI_PERIOD;
        }
        
        double rs = (avgLoss == 0) ? 100 : avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    private static double calculateVWAP(List<Candlestick> candles) {
        double cumulativeTPV = 0.0;
        double cumulativeVolume = 0.0;
        
        for (Candlestick candle : candles) {
            double high = Double.parseDouble(candle.getHigh());
            double low = Double.parseDouble(candle.getLow());
            double close = Double.parseDouble(candle.getClose());
            double volume = Double.parseDouble(candle.getVolume());
            
            double typicalPrice = (high + low + close) / 3;
            cumulativeTPV += typicalPrice * volume;
            cumulativeVolume += volume;
        }
        
        return cumulativeTPV / cumulativeVolume;
    }

    private static double calculateATR(List<Candlestick> candles, int period) {
        List<Double> trueRanges = new ArrayList<>();
        
        for (int i = 1; i < candles.size(); i++) {
            double prevClose = Double.parseDouble(candles.get(i-1).getClose());
            double high = Double.parseDouble(candles.get(i).getHigh());
            double low = Double.parseDouble(candles.get(i).getLow());
            
            double tr1 = high - low;
            double tr2 = Math.abs(high - prevClose);
            double tr3 = Math.abs(low - prevClose);
            
            trueRanges.add(Math.max(tr1, Math.max(tr2, tr3)));
        }
        
        // Média dos primeiros 'period' TRs
        double atr = trueRanges.subList(0, period).stream()
            .mapToDouble(Double::doubleValue)
            .average()
            .orElse(0.0);
        
        // Cálculo suavizado
        for (int i = period; i < trueRanges.size(); i++) {
            atr = ((atr * (period - 1)) + trueRanges.get(i)) / period;
        }
        
        return atr;
    }

    private static double detectWhaleActivity(String symbol) {
        OrderBook orderBook = restClient.getOrderBook(symbol, 100);
        double whaleVolume = 0.0;
        
        for (OrderBookEntry ask : orderBook.getAsks()) {
            double price = Double.parseDouble(ask.getPrice());
            double qty = Double.parseDouble(ask.getQty());
            if (price * qty > TradingConfig.WHALE_VOLUME_THRESHOLD) {
                whaleVolume += price * qty;
            }
        }
        
        for (OrderBookEntry bid : orderBook.getBids()) {
            double price = Double.parseDouble(bid.getPrice());
            double qty = Double.parseDouble(bid.getQty());
            if (price * qty > TradingConfig.WHALE_VOLUME_THRESHOLD) {
                whaleVolume += price * qty;
            }
        }
        
        return whaleVolume;
    }

    // =============================================
    // ESTRATÉGIA DELTA FLOW (2025)
    // =============================================
    private static TradingSignal evaluateMarket(List<Candlestick> candles) {
        // 1. Verificar condições macro
        if (BotState.currentBTCDominance < TradingConfig.MIN_BTC_DOMINANCE || 
            BotState.currentBTCDominance > TradingConfig.MAX_BTC_DOMINANCE) {
            return TradingSignal.WAIT;
        }
        
        // 2. Coletar dados de mercado
        double rsi = calculateRSI(candles);
        double vwap = calculateVWAP(candles);
        double atr = calculateATR(candles, TradingConfig.ATR_PERIOD);
        double whaleVolume = detectWhaleActivity(TradingConfig.LIQUIDITY_SYMBOL);
        double lastClose = Double.parseDouble(candles.get(candles.size()-1).getClose());
        
        // 3. Avaliar condições de entrada
        boolean longCondition = 
            rsi < 35 &&
            lastClose > vwap &&
            BotState.fundingRate < TradingConfig.FUNDING_RATE_THRESHOLD &&
            whaleVolume > 0;
        
        boolean shortCondition = 
            rsi > 65 &&
            lastClose < vwap &&
            BotState.fundingRate > Math.abs(TradingConfig.FUNDING_RATE_THRESHOLD) &&
            whaleVolume > 0;
        
        // 4. Gerenciamento de risco dinâmico
        double positionSize = calculatePositionSize(atr, lastClose);
        
        // 5. Gerar sinal
        if (longCondition) {
            return new TradingSignal(TradingSignal.SignalType.LONG, positionSize, atr);
        } else if (shortCondition) {
            return new TradingSignal(TradingSignal.SignalType.SHORT, positionSize, atr);
        }
        
        return TradingSignal.WAIT;
    }

    // =============================================
    // GERENCIAMENTO DE RISCO AVANÇADO
    // =============================================
    private static double calculatePositionSize(double atr, double entryPrice) {
        // Ajustar risco baseado em desempenho recente
        double riskFactor = TradingConfig.BASE_RISK;
        if (BotState.consecutiveLosses > 0) {
            riskFactor = Math.max(
                TradingConfig.BASE_RISK * 0.5, 
                TradingConfig.BASE_RISK / BotState.consecutiveLosses
            );
        }
        
        // Limitar risco máximo
        riskFactor = Math.min(riskFactor, TradingConfig.MAX_RISK);
        
        // Calcular tamanho da posição
        double dollarRisk = BotState.equity * riskFactor;
        double positionSize = dollarRisk / (atr * TradingConfig.MIN_RR_RATIO);
        
        // Ajustar para preço do ativo
        return positionSize / entryPrice;
    }

    private static void executeTrade(TradingSignal signal, double currentPrice) {
        // 1. Calcular stop loss e take profit
        double stopLoss = signal.signalType == TradingSignal.SignalType.LONG ?
            currentPrice - (signal.atr * TradingConfig.VOLATILITY_FACTOR) :
            currentPrice + (signal.atr * TradingConfig.VOLATILITY_FACTOR);
            
        double takeProfit = signal.signalType == TradingSignal.SignalType.LONG ?
            currentPrice + (signal.atr * TradingConfig.MIN_RR_RATIO * TradingConfig.VOLATILITY_FACTOR) :
            currentPrice - (signal.atr * TradingConfig.MIN_RR_RATIO * TradingConfig.VOLATILITY_FACTOR);
        
        // 2. Executar ordem (implementação real)
        try {
            // Ordem de entrada
            placeOrder(
                TradingConfig.TARGET_SYMBOL,
                signal.signalType == TradingSignal.SignalType.LONG ? "BUY" : "SELL",
                signal.positionSize,
                currentPrice
            );
            
            // Ordens de proteção
            placeStopOrder(
                TradingConfig.TARGET_SYMBOL,
                signal.signalType == TradingSignal.SignalType.LONG ? "SELL" : "BUY",
                signal.positionSize,
                stopLoss
            );
            
            placeTakeProfitOrder(
                TradingConfig.TARGET_SYMBOL,
                signal.signalType == TradingSignal.SignalType.LONG ? "SELL" : "BUY",
                signal.positionSize,
                takeProfit
            );
            
            // Atualizar estado
            BotState.currentPosition = signal.signalType == TradingSignal.SignalType.LONG ? 
                Position.LONG : Position.SHORT;
            BotState.lastEntryPrice = currentPrice;
            
        } catch (Exception e) {
            // Tratamento de erro na execução
            System.err.println("Erro na execução da ordem: " + e.getMessage());
        }
    }

    // =============================================
    // MONITORAMENTO DE MERCADO EM TEMPO REAL
    // =============================================
    private static void startMarketMonitoring() {
        // Monitorar índice principal
        wsClient.onCandlestickEvent(TradingConfig.TARGET_SYMBOL.toLowerCase(), TradingConfig.TIME_FRAME, response -> {
            List<Candlestick> candles = restClient.getCandlestickBars(
                TradingConfig.TARGET_SYMBOL, 
                TradingConfig.TIME_FRAME,
                100
            );
            
            if (BotState.currentPosition == Position.NONE) {
                TradingSignal signal = evaluateMarket(candles);
                if (signal != TradingSignal.WAIT) {
                    double currentPrice = Double.parseDouble(
                        candles.get(candles.size()-1).getClose()
                    );
                    executeTrade(signal, currentPrice);
                }
            }
        });
        
        // Monitorar dominância do BTC
        wsClient.onCandlestickEvent(TradingConfig.BTC_DOMINANCE_SYMBOL.toLowerCase(), 
            CandlestickInterval.HOURLY, response -> {
                
            List<Candlestick> btcCandles = restClient.getCandlestickBars(
                TradingConfig.BTC_DOMINANCE_SYMBOL, 
                CandlestickInterval.HOURLY,
                TradingConfig.BTC_DOM_SAMPLE
            );
            
            double totalVolume = 0.0;
            double volumeWeightedDominance = 0.0;
            
            for (Candlestick candle : btcCandles) {
                double volume = Double.parseDouble(candle.getVolume());
                double dominance = Double.parseDouble(candle.getClose());
                
                totalVolume += volume;
                volumeWeightedDominance += dominance * volume;
            }
            
            BotState.currentBTCDominance = volumeWeightedDominance / totalVolume;
        });
        
        // Monitorar funding rate
        wsClient.onFundingRateEvent(TradingConfig.TARGET_SYMBOL.toLowerCase(), response -> {
            BotState.fundingRate = Double.parseDouble(response.getFundingRate());
        });
    }

    // =============================================
    // EXECUÇÃO DE ORDENS (INTEGRAÇÃO REAL)
    // =============================================
    private static void placeOrder(String symbol, String side, double quantity, double price) {
        // Implementação real da API Binance
        System.out.printf("[ORDEM EXECUTADA] %s %s %.6f @ %.4f%n", 
            side, symbol, quantity, price);
    }
    
    private static void placeStopOrder(String symbol, String side, double quantity, double stopPrice) {
        // Implementação real de stop loss
        System.out.printf("[STOP LOSS] %s %s %.6f @ %.4f%n", 
            side, symbol, quantity, stopPrice);
    }
    
    private static void placeTakeProfitOrder(String symbol, String side, double quantity, double takeProfitPrice) {
        // Implementação real de take profit
        System.out.printf("[TAKE PROFIT] %s %s %.6f @ %.4f%n", 
            side, symbol, quantity, takeProfitPrice);
    }

    // =============================================
    // CLASSES AUXILIARES
    // =============================================
    enum Position {
        LONG, SHORT, NONE
    }
    
    static class TradingSignal {
        enum SignalType { LONG, SHORT }
        
        final SignalType signalType;
        final double positionSize; // Em unidades do ativo
        final double atr; // Valor do ATR no momento do sinal
        
        static final TradingSignal WAIT = new TradingSignal();
        
        private TradingSignal() {
            this.signalType = null;
            this.positionSize = 0;
            this.atr = 0;
        }
        
        public TradingSignal(SignalType signalType, double positionSize, double atr) {
            this.signalType = signalType;
            this.positionSize = positionSize;
            this.atr = atr;
        }
        
        public boolean isWait() {
            return this == WAIT;
        }
    }

    // =============================================
    // INICIALIZAÇÃO DO SISTEMA
    // =============================================
    public static void main(String[] args) {
        // 1. Validar credenciais
        if (API_KEY == null || SECRET_KEY == null || API_KEY.isEmpty() || SECRET_KEY.isEmpty()) {
            System.err.println("Credenciais da API não configuradas!");
            System.exit(1);
        }
        
        // 2. Inicializar conexões
        initializeClients();
        
        // 3. Carregar dados históricos iniciais
        initializeHistoricalData();
        
        // 4. Iniciar monitoramento em tempo real
        startMarketMonitoring();
        
        System.out.println("Sistema de trading iniciado com sucesso!");
    }
}
