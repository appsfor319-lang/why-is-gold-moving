# Why Is Gold Moving? — independent gold-market briefing

This project does not depend on GoldSquawk. The static dashboard and its API are owned by this repository and your hosting account.

## Configure the independent data and AI feeds

Deploy the Cloudflare Worker from this directory with Wrangler. Add credentials as Worker secrets (never paste them into the website or commit them to Git):

```sh
wrangler secret put GOLDAPI_KEY
wrangler secret put TWELVEDATA_API_KEY
wrangler secret put FRED_API_KEY
wrangler secret put OPENAI_API_KEY
```

Optional Worker variables:
- `OPENAI_MODEL` (defaults to `gpt-4.1-mini`)
- `DXY_SYMBOL` and `OIL_SYMBOL` if your Twelve Data plan uses different symbols.

Then deploy:

```sh
wrangler deploy
```

In the published dashboard, open **Settings** and enter the Worker URL.

## Current source architecture

- Gold and silver spot reference: GoldAPI.
- DXY and WTI quote: Twelve Data (confirm symbol access with your plan).
- US 10-year Treasury yield: FRED DGS10. This is a daily observation, not a live intraday yield.
- Gold-related headline discovery: GDELT DOC API. Headlines link to their publishers; GDELT is not a licensed Bloomberg/Reuters/Kitco wire.
- Interpretation: OpenAI Responses API using an independent gold-analysis method and the market/headline evidence supplied by the feeds. If `OPENAI_API_KEY` is absent or the AI call fails, the Worker uses a limited rules-based fallback and labels it accordingly.

## How the gold briefing reasons

The briefing starts with gold's observed move, then ranks plausible drivers using the supplied headlines and cross-market evidence. It compares yields, DXY, silver and oil; distinguishes primary drivers from counterforces; explains mixed signals; and avoids claiming that a headline caused a move without evidence. It does not claim to reproduce another company's private model or internal instructions.

## Not connected yet

The economic calendar and historical event-reaction sections return empty arrays until a separate calendar provider and historical market-price source are selected and configured. Do not treat these sections as live until populated and tested.

## Important limitations

Provider coverage, freshness, symbol names, licensing and subscription quotas must be verified with your own accounts. A spot reference price is not guaranteed to match your OANDA XAUUSD CFD quote. FRED DGS10 is daily. GDELT headline availability and metadata may vary. This independent setup means GoldSquawk shutting down does not disable these feeds; an individual provider or hosting account can still have outages or change its terms.
