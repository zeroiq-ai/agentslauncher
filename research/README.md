# Research: who trades stock tokens on Robinhood Chain (12 Nov 2026)

Scripts, no data. Data sources: GeckoTerminal (pools, last 300 trades, daily OHLCV), the public RPC
`rpc.mainnet.chain.robinhood.com` (max 100k blocks and 10k logs per `eth_getLogs`).

1. `owners.py` — takes the trades sample, pulls receipts, finds the real token owner per tx
   (skips pools and routers). Tx senders are mostly relayers: 1,081 senders, 316 real owners.
2. `history.py` — 30 days of stock-token Transfer logs for the top owners (all wallets in one
   query per 100k-block chunk), balances now, daily prices.

Known limit: both legs are priced at the daily close, so intraday P&L is invisible.
Next version must read the quote leg (USDG / WETH) of each swap from the receipt.
