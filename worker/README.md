# Why Is Gold Moving? — independent gold-market briefing

This project does not depend on GoldSquawk. The static dashboard and its API are owned by this repository and your hosting account.

## Configure the independent data and AI feeds

Deploy the Cloudflare Worker from this directory with Wrangler. Add credentials as Worker secrets (never paste them into the website or commit them to Git):

```sh
wrangler secret put GOLDAPI_KEY
wrangler secret put TWELVEDATA_API_KEY
wrangler secret put FRED_API_KEY
wrangler secret put GEMINI_API_KEY
```

Optional Worker variables:
- `GEMINI_MODEL` (defaults to `gemini-3.8-flash`)
- `DXY_SYMBOL` and `OIL_SYMBOL` if your Twelve Data plan uses different symbols.

Then deploy:

```sh
wrangler deploy
```

In the published dashboard, open **Settings** and enter the Worker URL.

## Current source architecture

- Gold and silver spot reference: GoldAPI.
- DXY: Yahoo Finance chart endpoint for the ICE Dollar Index (daily bars; availability can vary).
- US 10-year Treasury yield: FRED DGS10 (daily observation).
- WTI oil: FRED DCOILWTICO (daily spot observation).
- Gold-related headline discovery: RSS feeds from Google News, Mining.com, CNBC, MarketWatch, OilPrice, Kitco and Yahoo Finance. The dashboard stores headline metadata and links to publishers; it is not a licensed Bloomberg/Reuters/Kitco terminal.
- Economic calendar: FRED release dates. It does not supply consensus forecasts, actual results or precise release times.
- Interpretation: Gemini Developer API (`gemini-3.8-flash` by default) receives the current market readings and a small set of recent headlines. It must distinguish observed data from plausible explanations, discount stale readings, identify opposing forces, and avoid claiming that a headline caused a move without supporting evidence. The Worker caches identical analyses for 12 minutes. If `GEMINI_API_KEY` is absent, the quota is exhausted, or the AI request fails, the Worker uses the limited rules-based fallback and labels the AI source as `fallback`.

## How the gold briefing reasons

The briefing starts with gold's observed move, then ranks plausible drivers using the supplied headlines and cross-market evidence. It compares yields, DXY, silver and oil; distinguishes primary drivers from counterforces; explains mixed signals; and avoids claiming that a headline caused a move without evidence. It does not claim to reproduce another company's private model or internal instructions.

## Not connected yet

The economic calendar and historical event-reaction sections return empty arrays until a separate calendar provider and historical market-price source are selected and configured. Do not treat these sections as live until populated and tested.

## Important limitations

Provider coverage, freshness, symbol names, licensing and subscription quotas must be verified with your own accounts. A spot reference price is not guaranteed to match your OANDA XAUUSD CFD quote. FRED DGS10 is daily. GDELT headline availability and metadata may vary. This independent setup means GoldSquawk shutting down does not disable these feeds; an individual provider or hosting account can still have outages or change its terms.


## Gemini configuration

Add `GEMINI_API_KEY` as a Cloudflare Worker secret. Never put it in Git, the static website, or a public issue. The optional `GEMINI_MODEL` Worker variable defaults to `gemini-3.8-flash`. Gemini free-tier availability and request limits depend on the Google AI Studio project and selected model; inspect the project's AI Studio usage page if requests start falling back. Free-tier data-use terms differ from paid-tier terms.
