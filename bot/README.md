# bot/

Backend pieces for ZeroIQ. Python 3.9+, standard library only.

| File | What it does |
|---|---|
| `bankr.py` | Bankr API client: recent launches, fees, deploy and claim (deploy/claim need `BANKR_API_KEY`). |
| `watcher.py` | Meme watcher. Polls `/token-launches`, emits `NEW` and `HOT` pager events. |
| `llm.py` | One `chat()` call for OpenRouter or the Bankr LLM Gateway, with fallback. |

```bash
WATCH_CHAINS=robinhood,base WATCH_MIN_VOL=5000 python -m bot.watcher
python -m bot.test_watcher   # offline test
```

Keys go in environment variables only (`BANKR_API_KEY`, `BANKR_LLM_KEY`, `OPENROUTER_API_KEY`).
Agent tokens on the site are a preview until Season 0; real deploys go through `bankr.deploy()`
with the partner key (apply at bankr.bot/partner).
