"""Thin client for the Bankr public API (https://docs.bankr.bot).

Reads need no key. Deploying and claiming need BANKR_API_KEY (partner or wallet key),
read from the environment only. Never hardcode keys.
"""
import json
import os
import urllib.request

BASE = os.environ.get("BANKR_API_BASE", "https://api.bankr.bot")
CREATOR_FEE = 0.00665  # creator share of volume, per Bankr docs


def _req(method, path, body=None, auth=False, timeout=15):
    headers = {"Accept": "application/json", "User-Agent": "zeroiq-bot/0.1"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if auth:
        key = os.environ.get("BANKR_API_KEY")
        if not key:
            raise RuntimeError("BANKR_API_KEY is not set")
        headers["X-API-Key"] = key
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def launches():
    """Last ~50 token launches across chains (no auth)."""
    return _req("GET", "/token-launches").get("launches", [])


def fees(token_address):
    """Creator-fee state for one token (no auth)."""
    return _req("GET", "/token-launches/%s/fees" % token_address)


def deploy(name, symbol, image_uri=None, fee_recipient=None, extra=None):
    """Launch a token for an agent. Needs BANKR_API_KEY.

    Field names follow POST /token-launches/deploy; check the docs before going live,
    and keep this behind the Season 0 flag.
    """
    body = {"tokenName": name, "tokenSymbol": symbol}
    if image_uri:
        body["imageUri"] = image_uri
    if fee_recipient:
        body["feeRecipient"] = fee_recipient
    body.update(extra or {})
    return _req("POST", "/token-launches/deploy", body, auth=True)


def claim(token_address):
    return _req("POST", "/token-launches/%s/fees/claim" % token_address, {}, auth=True)


def est_volume_usd(launch):
    """Lower bound on traded volume from unclaimed creator fees."""
    f = (launch.get("unclaimedFees") or {}).get("usdValue") or 0
    return f / CREATOR_FEE if f else 0.0
