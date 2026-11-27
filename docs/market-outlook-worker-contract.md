# Worker endpoint contract: POST /api/market-outlook

The website's new “Where Is Gold Going Now?” tab calls this endpoint on the existing Worker base URL.

## Request
JSON:
- market: live terminal snapshot (gold price/change, DXY, US yield, silver, oil, current briefing, headlines, calendar, positioning, provider statuses)
- request.force_refresh: user-requested refresh
- request.focus: requested analysis scope
- request.instructions: accuracy and research constraints

## Required behavior
- Research fresh accessible sources: GoldSquawk, TradingView XAUUSD ideas, X/Twitter professional gold/macro analysts, Reuters and other reliable news, macro data.
- Clearly disclose sources that are inaccessible; never claim access.
- Return sourced, timestamped opinions and levels. Deduplicate reposts and same-author repetitions; count independent sources only.
- Never invent analyst counts, price levels, citations, or accuracy rates.
- Separate fact, analyst opinion, and model inference. Include source URLs and timestamps.
- Explain the current movement, what price is struggling at (if evidence supports it), why, likely next destinations, conditional paths and invalidation.
- Distinguish short-term (hours), daily, and multi-day views.
- Calibrate confidence; no unsupported numerical probabilities.
- Cache results to respect provider/API limits; return cache age and data freshness.

## Response shape
Return JSON with an `outlook` object:
```json
{
  "outlook": {
    "direction": "bullish|bearish|neutral|mixed",
    "confidence": "low|moderate|high or sourced calibrated number",
    "summary": "plain-language current story",
    "why_title": "main drivers",
    "why": "causal explanation grounded in data",
    "obstacle": "current support/resistance or reason price is stuck",
    "obstacle_reason": "evidence",
    "next_target": {"price": 0, "label": "target"},
    "next_target_reason": "evidence",
    "levels": [{"price": 0, "type": "support|resistance|target|liquidity", "reason": "", "consensus_count": 0, "source_links": []}],
    "scenarios": [{"name": "", "trigger": "", "target": "", "reason": "", "invalidation": ""}],
    "consensus": {"sources_analyzed": 0, "bullish_count": 0, "bearish_count": 0, "neutral_count": 0, "summary": "", "opinions": [{"source": "", "author": "", "title": "", "summary": "", "reason": "", "direction": "", "target": "", "published_at": "", "url": ""}]},
    "sources": [{"source": "", "title": "", "summary": "", "published_at": "", "url": ""}],
    "engine": "name",
    "data_freshness": "description",
    "updated_at": "ISO-8601"
  }
}
```

If the research source is unavailable, return a partial response and explain missing coverage instead of fabricating it.
