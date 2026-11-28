# MGC Order Flow bridge contract

The public TradZ page can connect to a local bridge on the user's own PC at `ws://127.0.0.1:8765/market`. This browser module is a display client only; it does not log into AMP/CQG or capture Quantower sessions.

## WebSocket JSON messages

Send any of these messages:

- Snapshot: `{"type":"snapshot","data":{"symbol":"MGC...","timestamp":"2026-11-28T...Z","last":...,"bid":...,"bidSize":...,"ask":...,"askSize":...,"book":{"timestamp":"...","bids":[{"price":...,"size":...}],"asks":[{"price":...,"size":...}]},"trades":[{"timestamp":"...","price":...,"size":...,"side":"buy"}]}}`
- Quote update: `{"type":"quote","symbol":"MGC...","timestamp":"...","last":...,"bid":...,"bidSize":...,"ask":...,"askSize":...}`
- Book update: `{"type":"book","timestamp":"...","bids":[{"price":...,"size":...}],"asks":[{"price":...,"size":...}]}`
- Trade: `{"type":"trade","timestamp":"...","price":...,"size":...,"side":"buy|sell|unknown"}`

The client requests subscription with `{"type":"subscribe","symbols":["MGC"]}`. Do not send synthetic data. Bind the server only to loopback; do not expose an unauthenticated bridge to the public internet. Live feed entitlement and any external redistribution permissions remain the provider's responsibility.

## Status

Frontend receiver implemented. A provider-authorized publisher and data-source entitlement are not yet implemented or verified.
