"""Meme watcher: polls Bankr launches and turns them into pager EVENT messages.

Run:  python -m bot.watcher            (prints events)
Env:  WATCH_CHAINS=robinhood,base   WATCH_MIN_VOL=5000   WATCH_EVERY=60
The agent never buys on an event alone; the event is a signal its rules weigh.
"""
import os
import time

from . import bankr


def _cfg():
    chains = [c.strip() for c in os.environ.get("WATCH_CHAINS", "").split(",") if c.strip()]
    return chains, float(os.environ.get("WATCH_MIN_VOL", "5000")), int(os.environ.get("WATCH_EVERY", "60"))


class Watcher:
    def __init__(self, chains=None, min_vol=5000.0):
        self.chains = chains or []
        self.min_vol = min_vol
        self.seen = set()
        self.hot = set()

    def step(self, launches):
        """Return new events for this batch of launches. Pure, easy to test."""
        out = []
        for x in launches:
            if x.get("status") != "deployed":
                continue
            if self.chains and x.get("chain") not in self.chains:
                continue
            key = x.get("activityId") or x.get("tokenAddress")
            vol = bankr.est_volume_usd(x)
            if key not in self.seen:
                self.seen.add(key)
                out.append(event("NEW", x, vol))
            if vol >= self.min_vol and key not in self.hot:
                self.hot.add(key)
                out.append(event("HOT", x, vol))
        return out


def event(kind, x, vol):
    sym = x.get("tokenSymbol", "?")
    by = (x.get("deployer") or {}).get("xUsername")
    line = {
        "NEW": "New launch: $%s on %s%s." % (sym, x.get("chain"), " by @" + by if by else ""),
        "HOT": "$%s crossed ~$%s volume (est. from fees)." % (sym, format(int(vol), ",")),
    }[kind]
    return {
        "type": "EVENT",
        "kind": kind,
        "symbol": sym,
        "chain": x.get("chain"),
        "token": x.get("tokenAddress"),
        "est_volume_usd": round(vol, 2),
        "text": "EVENT · MEME\n" + line + "\nMeme sniper is on. Let it take a small position inside your limits?  [+] yes  [−] skip",
    }


def main():
    chains, min_vol, every = _cfg()
    w = Watcher(chains, min_vol)
    first = True
    while True:
        try:
            evs = w.step(bankr.launches())
            if not first:  # skip the backlog on start
                for e in evs:
                    print(e["text"], flush=True)
            first = False
        except Exception as err:  # keep polling; Bankr limits are tight
            print("watcher error:", err, flush=True)
        time.sleep(max(15, every))


if __name__ == "__main__":
    main()
