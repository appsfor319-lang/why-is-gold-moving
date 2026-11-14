# Why Is Gold Moving? — market terminal

Static GitHub Pages frontend plus a Cloudflare Worker API. Provider keys stay server-side.

## Worker setup
1. Install Wrangler, authenticate, then run `wrangler deploy` from this folder.
2. Add secrets: `wrangler secret put GOLDAPI_KEY`, `wrangler secret put TWELVEDATA_API_KEY`, `wrangler secret put FRED_API_KEY`.
3. Optional Worker variables `DXY_SYMBOL` and `OIL_SYMBOL` can override Twelve Data symbols according to your plan.
4. In the published dashboard open Settings and paste the Worker URL.

Gold and silver use GoldAPI; DXY and WTI use Twelve Data; US 10Y uses FRED DGS10; headlines are discovered via GDELT and link to publishers. Provider access, symbol coverage, timestamps and plan limits must be validated.

Calendar and historical reactions are intentionally empty until a licensed calendar and historical price source are selected. FRED DGS10 is daily, not intraday. GDELT is a discovery index, not a Reuters/Kitco licensed wire. The browser refreshes the API every 15 minutes; a scheduled cache is not implemented yet.
