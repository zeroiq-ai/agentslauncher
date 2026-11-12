"""LLM provider switch: OpenRouter or the Bankr LLM Gateway.

Both speak the OpenAI chat-completions format. Check the gateway path against docs.bankr.bot before going live.
Env:
  LLM_PROVIDER = openrouter | bankr        (default: openrouter)
  LLM_MODEL    = model id for that provider
  OPENROUTER_API_KEY / BANKR_LLM_KEY       keys, env only
"""
import json
import os
import urllib.request

PROVIDERS = {
    "openrouter": {"url": "https://openrouter.ai/api/v1/chat/completions", "key": "OPENROUTER_API_KEY", "header": "Authorization", "prefix": "Bearer "},
    "bankr": {"url": "https://llm.bankr.bot/v1/chat/completions", "key": "BANKR_LLM_KEY", "header": "X-API-Key", "prefix": ""},
}


def chat(messages, model=None, provider=None, temperature=0.2, timeout=60):
    name = provider or os.environ.get("LLM_PROVIDER", "openrouter")
    p = PROVIDERS[name]
    key = os.environ.get(p["key"])
    if not key:
        raise RuntimeError("%s is not set" % p["key"])
    body = {"model": model or os.environ.get("LLM_MODEL", ""), "messages": messages, "temperature": temperature}
    req = urllib.request.Request(p["url"], data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", p["header"]: p["prefix"] + key})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        j = json.loads(r.read().decode())
    return j["choices"][0]["message"]["content"]


def chat_with_fallback(messages, **kw):
    """Try the configured provider, then the other one."""
    first = kw.pop("provider", None) or os.environ.get("LLM_PROVIDER", "openrouter")
    order = [first] + [n for n in PROVIDERS if n != first]
    last = None
    for n in order:
        try:
            return chat(messages, provider=n, **kw)
        except Exception as e:
            last = e
    raise last
