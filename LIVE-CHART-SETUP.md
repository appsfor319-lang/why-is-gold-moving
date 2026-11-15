# Live XAU/USD Chart + UFD Sessions & Liquidity

This branch adds a split-screen chart to the existing Why Is Gold Moving? dashboard.

## Data source
- Twelve Data REST `time_series` for `XAU/USD`.
- Chart intervals: 1min, 5min, 15min, 30min, 1h.
- 500 candles are requested for the selected chart interval.
- A separate 1-hour series is requested for the Pine indicator's default higher-timeframe Order Blocks.
- The browser refreshes the chart every 60 seconds. This is a periodically refreshed candle chart, not an exchange tick-by-tick feed.
- The API key remains a Cloudflare Worker secret: `TWELVEDATA_API_KEY`.

## Worker endpoints
- `GET /api/chart?interval=5min`: returns XAU/USD candles and 1H candles.
- `POST /api/chart-analysis`: explains the supplied chart indicator state together with current macro market data and recent headlines. Uses the existing `GEMINI_API_KEY` Worker secret when configured; otherwise it returns a clearly identified rules-based fallback.

## UFD Sessions & Liquidity translation
The JavaScript implementation in `chart.js` follows the supplied Pine v6 source:
- Asia/Tokyo 09:00–18:00 in `Asia/Tokyo`.
- Europa/London 08:00–17:00 in `Europe/London`.
- New York 08:00–17:00 in `America/New_York`.
- Each session's high and low are calculated from candles inside its own timezone window.
- Closed-session highs/lows become dashed HH/HL liquidity levels.
- A high is swept when a later candle's wick trades above it; a low is swept when a later candle's wick trades below it. Swept levels are removed from active levels.
- Higher-timeframe OB logic defaults to 1H: bullish when the current HTF candle closes above the previous high and the previous candle was bearish; bearish when it closes below the previous low and the previous candle was bullish. The previous candle's high/low define the OB zone.
- Bullish OBs are invalidated by a later close below the zone; bearish OBs by a later close above it. Keep the most recent three per direction.
- The indicator is intended for intraday charts, matching the source Pine comments.

## Deployment
1. Confirm `TWELVEDATA_API_KEY` exists as a Cloudflare Worker secret.
2. Confirm `GEMINI_API_KEY` exists if AI chart explanations are desired. Without it, the endpoint uses rules fallback.
3. Deploy the Worker from `worker/` with Wrangler.
4. Publish the static site from the repository root using the existing GitHub Pages workflow.
5. Test `/api/chart?interval=5min` and `/api/chart-analysis` before relying on the chart.

## Data caveats
Twelve Data symbol availability, interval coverage, plan quotas, delayed/realtime status and redistribution rights depend on the account and plan. The displayed chart is Twelve Data XAU/USD, not a guaranteed match for the OANDA CFD quote. The dashboard must not label periodic candle refresh as exchange tick streaming.
