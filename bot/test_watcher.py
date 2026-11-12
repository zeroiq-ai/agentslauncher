from .watcher import Watcher

L = [
    {"activityId": "a", "status": "deployed", "chain": "base", "tokenSymbol": "AAA", "tokenAddress": "0x1", "unclaimedFees": {"usdValue": 1}},
    {"activityId": "b", "status": "deployed", "chain": "robinhood", "tokenSymbol": "BBB", "tokenAddress": "0x2", "unclaimedFees": {"usdValue": 100}},
    {"activityId": "c", "status": "pending", "chain": "base", "tokenSymbol": "CCC"},
]
w = Watcher(["robinhood", "base"], 5000)
e = w.step(L)
assert [(x["kind"], x["symbol"]) for x in e] == [("NEW", "AAA"), ("NEW", "BBB"), ("HOT", "BBB")], e
assert w.step(L) == []
print("ok")
