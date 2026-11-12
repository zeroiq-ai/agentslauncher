"""Explorer indexer: 30-day P&L of stock-token traders on Robinhood Chain.

Reads ERC-20 Transfer logs of stock tokens and quote tokens (USDG, WETH) for a list of
owner addresses, groups them by transaction and prices each trade by its quote leg.
When the quote leg is not visible (paid in native ETH, routed elsewhere) the trade is
priced at the hourly close and counted as "market-priced".

Run:  python -m bot.indexer owners.txt web/data/explorer.json [days]
Only public endpoints: the chain RPC and GeckoTerminal. No keys.
"""
import concurrent.futures as cf
import json
import sys
import time
import urllib.request
from collections import defaultdict

RPC = "https://rpc.mainnet.chain.robinhood.com"
GT = "https://api.geckoterminal.com/api/v2/networks/robinhood"
UA = {"content-type": "application/json", "user-agent": "curl/8.5.0", "accept": "application/json"}
TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

# symbol -> (token address, pool used for hourly prices)
STOCKS = {
    "NVDA": ("0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec", "0x62ab521f71431f78ac374cdbadc6cda3c8916b6c"),
    "SPCX": ("0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea", "0xc61284332117c3fb23a2a56cceffd07f7af60029"),
    "SPY": ("0x117cc2133c37b721f49de2a7a74833232b3b4c0c", "0xe5923c8a8be481ec89a2ca784a2bbfa4235de6d88f92260fd66b660c4babf907"),
    "AMD": ("0x86923f96303d656e4aa86d9d42d1e57ad2023fdc", "0xe6e17efdbdd916526293cf1b509171be4ffb04f47c4a5fe1a7367acdaa6ffd82"),
    "QQQ": ("0xd5f3879160bc7c32ebb4dc785f8a4f505888de68", "0x8493982435e4273028008cd181c84c0d6a548f96792fdb5acddcbb6a8c82d305"),
    "GOOGL": ("0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3", "0x6d0f67069596c7ef9d1ce6981c1b6dbcd9a91b0c5393aebe9dd07c35e412df30"),
    "META": ("0xc0d6457c16cc70d6790dd43521c899c87ce02f35", "0x8dc0387af606d84be8e4c2fc1da7bdc6d467337e9f3e075113f968922a190847"),
}
QUOTES = {
    "USDG": ("0x5fc5360d0400a0fd4f2af552add042d716f1d168", None),
    "WETH": ("0x0bd7d308f8e1639fab988df18a8011f41eacad73", "0x7615926023bb149f36095645c2a81dc367d39750"),
}
ALL = {**STOCKS, **QUOTES}
BY_ADDR = {v[0]: k for k, v in ALL.items()}
MAX_TRANSFERS = 4000
MIN_CAPITAL = 500


def _post(url, body, tries=5):
    err = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=UA)
            return json.loads(urllib.request.urlopen(req, timeout=60).read())
        except Exception as e:  # rate limits, timeouts
            err = e
            time.sleep(2 * (i + 1))
    raise err


def rpc(method, params):
    d = _post(RPC, {"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
    if "error" in d:
        raise RuntimeError(d["error"])
    return d["result"]


def get(url, tries=5):
    for i in range(tries):
        try:
            return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read())
        except Exception:
            time.sleep(6 * (i + 1))
    raise RuntimeError("GET failed: " + url)


def hourly_prices():
    """symbol -> {hour_ts: close_usd}. USDG is pinned to 1."""
    px = {"USDG": None}
    for sym, (_, pool) in ALL.items():
        if not pool:
            continue
        d = get(f"{GT}/pools/{pool}/ohlcv/hour?limit=1000&currency=usd&token=base")
        px[sym] = {int(c[0]): float(c[4]) for c in d["data"]["attributes"]["ohlcv_list"]}
        time.sleep(2.5)
    return px


def price_at(px, sym, t):
    if sym == "USDG":
        return 1.0
    d = px[sym]
    h = int(t // 3600 * 3600)
    near = sorted(d[k] for k in range(h - 3 * 3600, h + 4 * 3600, 3600) if k in d)
    if near:
        return near[len(near) // 2]  # median of +-3h closes: thin pools spike
    k = min(d, key=lambda x: abs(x - h))
    return d[k]


def pad(a):
    return "0x" + "0" * 24 + a[2:].lower()


def fetch_logs(owners, start, latest, tokens=None):
    P = [pad(w) for w in owners]
    addrs = [v[0] for v in (tokens or ALL).values()]

    def rng(a, b, side):
        topics = [TRANSFER, None, None]
        topics[side] = P
        try:
            res = rpc("eth_getLogs", [{"fromBlock": hex(a), "toBlock": hex(b), "address": addrs, "topics": topics}])
        except Exception as e:
            if b > a and ("exceeds limit" in str(e) or b - a > 2000):
                m = (a + b) // 2
                return rng(a, m, side) + rng(m + 1, b, side)
            raise
        return [(int(l["blockNumber"], 16), l["transactionHash"], l["address"].lower(), "0x" + l["topics"][1][-40:], "0x" + l["topics"][2][-40:], int(l["data"], 16)) for l in res if len(l["topics"]) == 3]

    jobs = [(a, s) for a in range(start, latest + 1, 100000) for s in (1, 2)]
    out = []
    with cf.ThreadPoolExecutor(6) as ex:
        for k, r in enumerate(ex.map(lambda j: rng(j[0], min(j[0] + 99999, latest), j[1]), jobs)):
            out += r
            if k % 100 == 0:
                print("chunk", k, "/", len(jobs), "logs", len(out), flush=True)
    return list({(l[1], l[2], l[3], l[4], l[5]): l for l in out}.values())  # a transfer between two owners shows twice


def analyse(owner, logs, dec, px, ts_of, t_start, t_now, bal_now):
    """Average-cost P&L with every trade priced by its quote leg when possible."""
    txs = defaultdict(lambda: defaultdict(float))
    tblock = {}
    for bn, tx, tok, frm, to, raw in logs:
        sym = BY_ADDR[tok]
        amt = raw / 10 ** dec[sym]
        if frm == owner:
            txs[tx][sym] -= amt
        if to == owner:
            txs[tx][sym] += amt
        tblock[tx] = bn
    net_window = defaultdict(float)
    for d in txs.values():
        for s, v in d.items():
            net_window[s] += v
    pos = {}   # sym -> [qty, cost]
    buys = []  # (sym, qty, price) for the hold benchmark
    for s in STOCKS:
        q0 = max(0.0, bal_now.get(s, 0.0) - net_window.get(s, 0.0))
        if q0 * price_at(px, s, t_start) > 1:
            p0 = price_at(px, s, t_start)
            pos[s] = [q0, q0 * p0]
            buys.append((s, q0, p0))
    realized, trades, exec_priced, days, peak, cur_cost = 0.0, [], 0, set(), 0.0, sum(c for _, c in pos.values())
    peak = cur_cost
    for tx in sorted(txs, key=lambda x: tblock[x]):
        d = txs[tx]
        t = ts_of(tblock[tx])
        stock_legs = [(s, v) for s, v in d.items() if s in STOCKS and abs(v) > 1e-9]
        if not stock_legs:
            continue
        quote_usd = sum(v * price_at(px, s, t) for s, v in d.items() if s in QUOTES)
        exact = len(stock_legs) == 1 and abs(quote_usd) > 0.01 and (quote_usd > 0) != (stock_legs[0][1] > 0)
        days.add(int(t // 86400))
        for s, q in stock_legs:
            mkt = price_at(px, s, t)
            p = abs(quote_usd) / abs(q) if exact else mkt
            ok = exact and abs(p / mkt - 1) <= 0.1
            if not ok:
                p = mkt  # quote leg missing or implausible
            else:
                exec_priced += 1
            qty, cost = pos.get(s, [0.0, 0.0])
            if q > 0:
                pos[s] = [qty + q, cost + q * p]
                buys.append((s, q, p))
            else:
                sell = min(-q, qty)
                avg = cost / qty if qty > 0 else p
                realized += sell * (p - avg)
                pos[s] = [qty - sell, cost - sell * avg]
            trades.append({"t": int(t), "side": "buy" if q > 0 else "sell", "sym": s, "qty": round(abs(q), 4), "px": round(p, 2), "usd": round(abs(q) * p, 2), "exact": ok, "tx": tx})
        cur_cost = sum(c for _, c in pos.values())
        peak = max(peak, cur_cost)
    unreal = sum(q * price_at(px, s, t_now) - c for s, (q, c) in pos.items())
    if peak < MIN_CAPITAL or not trades:
        return None
    pnl = realized + unreal
    hold_pnl = sum(q * (price_at(px, s, t_now) - p) for s, q, p in buys)
    hold_base = sum(q * p for s, q, p in buys) or 1
    r = pnl / peak * 100
    hold = hold_pnl / hold_base * 100
    held = sorted(((s, round(q * price_at(px, s, t_now))) for s, (q, c) in pos.items() if q * price_at(px, s, t_now) > 1), key=lambda x: -x[1])
    vol = sum(x["usd"] for x in trades)
    return {
        "w": owner, "r30": round(r, 2), "hold": round(hold, 2), "vs": round(r - hold, 2),
        "pnl": round(pnl), "capital": round(peak), "volume": round(vol), "trades": len(trades),
        "days": len(days), "exact": round(exec_priced / max(1, len(trades)) * 100), "held": held,
        "stocks": sorted({x["sym"] for x in trades}, key=lambda s: -sum(x["usd"] for x in trades if x["sym"] == s)),
        "last": trades[-1]["t"], "recent": trades[-12:][::-1],
        "type": "bot" if len(trades) / max(1, len(days)) > 60 else "trader",
    }


def main(owners_file, out_file, days=30):
    owners = [l.strip().lower() for l in open(owners_file) if l.strip().startswith("0x")]
    latest = int(rpc("eth_blockNumber", []), 16)
    b1 = rpc("eth_getBlockByNumber", [hex(latest), False])
    b0 = rpc("eth_getBlockByNumber", [hex(latest - 2_000_000), False])
    t_now, t_old = int(b1["timestamp"], 16), int(b0["timestamp"], 16)
    bps = 2_000_000 / (t_now - t_old)
    start = latest - int(days * 86400 * bps)
    ts_of = lambda bn: t_now - (latest - bn) / bps
    dec = {s: int(rpc("eth_call", [{"to": v[0], "data": "0x313ce567"}, "latest"]), 16) for s, v in ALL.items()}
    px = hourly_prices()
    import os, pickle
    cache = out_file + ".cache"
    if os.path.exists(cache):
        logs, q_cached = pickle.load(open(cache, "rb"))
    else:
        logs, q_cached = fetch_logs(owners, start, latest, STOCKS), None
    cnt = defaultdict(int)
    for l in logs:
        for a in (l[3], l[4]):
            cnt[a] += 1
    keep = [w for w in owners if 0 < cnt[w] <= MAX_TRANSFERS]
    print("owners with stock transfers", sum(1 for w in owners if cnt[w]), "kept", len(keep), "(over", MAX_TRANSFERS, "transfers = infrastructure or bots)", flush=True)
    oset = set(keep)
    logs = [l for l in logs if l[3] in oset or l[4] in oset]
    txset = {l[1] for l in logs}
    q = q_cached if q_cached is not None else [l for l in fetch_logs(keep, start, latest, QUOTES) if l[1] in txset]
    if not os.path.exists(cache):
        pickle.dump((list(logs), q), open(cache, "wb"))
    logs += [l for l in q if l[1] in txset]  # only quote legs of trade transactions
    owners = keep
    by = defaultdict(list)
    for l in logs:
        for a in (l[3], l[4]):
            if a in oset:
                by[a].append(l)

    def one(w):
        bal = {s: int(rpc("eth_call", [{"to": STOCKS[s][0], "data": "0x70a08231" + pad(w)[2:]}, "latest"]), 16) / 10 ** dec[s] for s in STOCKS}
        return analyse(w, by.get(w, []), dec, px, ts_of, ts_of(start), t_now, bal)

    rows = []
    with cf.ThreadPoolExecutor(4) as ex:
        for r in ex.map(one, owners):
            if r:
                rows.append(r)
    rows.sort(key=lambda r: -r["capital"])
    json.dump({"asOf": t_now, "days": days, "chain": "Robinhood Chain", "source": "RPC transfer logs + GeckoTerminal hourly prices", "wallets": rows}, open(out_file, "w"), separators=(",", ":"))
    print("wallets", len(rows), "->", out_file)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 30)
