"""Check which NVIDIA NIM models answer with your key, and how fast.

Run from app/backend:  python scripts/check_nim_models.py [extra model ids...]
Reads .env for NVIDIA_NIM_API_KEY / NVIDIA_NIM_MODEL. Prints status codes and timings, never the key.
"""
import json
import sys
import time
import urllib.error
import urllib.request

CANDIDATES = [
    "nvidia/llama-3.1-nemotron-70b-instruct",
    "nv-mistralai/mistral-nemo-12b-instruct",
]


def load_env(path: str = ".env") -> dict[str, str]:
    env: dict[str, str] = {}
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def main() -> None:
    env = load_env()
    key = env.get("NVIDIA_NIM_API_KEY", "")
    base = env.get("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
    configured = env.get("NVIDIA_NIM_MODEL") or CANDIDATES[0]
    print(f"LLM_PROVIDER={env.get('LLM_PROVIDER', '(unset)')}  key present: {bool(key)}  model: {configured}\n")

    for model in dict.fromkeys([configured, *CANDIDATES, *sys.argv[1:]]):
        body = json.dumps({
            "model": model,
            "max_tokens": 30,
            "messages": [{"role": "user", "content": "In one sentence, what is a hash map?"}],
        }).encode()
        req = urllib.request.Request(f"{base}/chat/completions", data=body, headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json",
        })
        start = time.time()
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                text = json.loads(r.read())["choices"][0]["message"].get("content") or ""
                print(f"OK   {time.time() - start:5.1f}s  {model}\n     {text.strip()[:90]!r}")
        except urllib.error.HTTPError as e:
            print(f"{e.code}  {time.time() - start:5.1f}s  {model}\n     {e.read()[:150]!r}")
        except Exception as e:
            print(f"ERR  {model}: {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
