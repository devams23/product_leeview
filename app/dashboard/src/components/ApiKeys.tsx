import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { keysApi, type KeysResponse, type KeyStatus, type Provider } from "../services/api";
import { formatRelative } from "../lib/format";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Chip } from "./ui/Chip";
import { ErrorBanner } from "./ui/ErrorBanner";
import { Skeleton } from "./ui/Skeleton";

interface ProviderInfo {
  id: Provider;
  name: string;
  role: string;
  consoleUrl: string;
  placeholder: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: "nvidia_nim",
    name: "NVIDIA NIM",
    role: "Runs the interviewer and writes your debrief.",
    consoleUrl: "https://build.nvidia.com/settings/api-keys",
    placeholder: "nvapi-…",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    role: "Takes over when NVIDIA is down or rate limited. Can also be your only model key.",
    consoleUrl: "https://openrouter.ai/settings/keys",
    placeholder: "sk-or-v1-…",
  },
  {
    id: "deepgram",
    name: "Deepgram",
    role: "Hears you (Flux speech-to-text) and gives the interviewer a voice.",
    consoleUrl: "https://console.deepgram.com/",
    placeholder: "Deepgram API key",
  },
];

type Keys = Record<Provider, KeyStatus>;

/** What is still needed before an interview can start, in plain words. */
function readiness(keys: Keys): { ready: boolean; text: string } {
  const llm = keys.nvidia_nim.saved || keys.openrouter.saved;
  const voice = keys.deepgram.saved;
  if (llm && voice) {
    const backup = keys.nvidia_nim.saved && keys.openrouter.saved;
    return { ready: true, text: backup ? "Ready, with OpenRouter as backup." : "Ready to interview." };
  }
  if (!llm && !voice) return { ready: false, text: "Add a Deepgram key and an NVIDIA NIM or OpenRouter key." };
  return { ready: false, text: llm ? "Add a Deepgram key." : "Add an NVIDIA NIM or OpenRouter key." };
}

function KeyRow({
  info,
  status,
  onSave,
  onRemove,
}: {
  info: ProviderInfo;
  status: KeyStatus;
  onSave: (key: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setEditing(false);
    setValue("");
    setError(null);
  };

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const key = value.trim();
    if (!key) {
      setError("Paste your key first");
      return;
    }
    void run(() => onSave(key));
  }

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-[240px]">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-medium text-text-1">{info.name}</p>
            {status.saved ? (
              <Chip tone="ok">Saved {status.hint}</Chip>
            ) : (
              <Chip>Not set</Chip>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-text-3">
            {info.role}
            {status.saved && status.updated_at ? ` Updated ${formatRelative(status.updated_at)}.` : ""}
          </p>
        </div>
        {!editing && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant={status.saved ? "secondary" : "primary"} onClick={() => setEditing(true)}>
              {status.saved ? "Replace" : "Add key"}
            </Button>
            {status.saved && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(onRemove)}>
                Remove
              </Button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor={inputId} className="sr-only">
            {info.name} API key
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={inputId}
              type="password"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={info.placeholder}
              className="h-10 min-w-0 flex-1 rounded-btn border border-line-2 bg-ink-0 px-3 font-mono text-[13px] text-text-1 placeholder:text-text-3 focus:border-signal focus:outline-none"
            />
            <div className="flex gap-2">
              <Button type="submit" size="md" variant="primary" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
              <Button size="md" variant="ghost" disabled={busy} onClick={close}>
                Cancel
              </Button>
            </div>
          </div>
          <a
            href={info.consoleUrl}
            target="_blank"
            rel="noreferrer"
            className="self-start text-[13px] text-text-2 underline-offset-2 transition-colors duration-150 hover:text-text-1 hover:underline"
          >
            Get a {info.name} key
          </a>
        </form>
      )}

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Bring-your-own-keys: the user's provider keys, saved encrypted on the server and never shown again. */
export function ApiKeys() {
  const [data, setData] = useState<KeysResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    keysApi
      .list()
      .then(setData)
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : "Could not load your keys"));
  }, []);

  useEffect(load, [load]);

  const apply = (next: { keys: Keys }) => setData((prev) => ({ server_keys_allowed: prev?.server_keys_allowed ?? false, keys: next.keys }));

  if (loadError) return <ErrorBanner title="Your API keys did not load" message={loadError} onRetry={load} />;

  if (!data) {
    return (
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        {PROVIDERS.map((p) => (
          <Skeleton key={p.id} className="h-10 w-full" />
        ))}
      </Card>
    );
  }

  const state = readiness(data.keys);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="divide-y divide-line">
          {PROVIDERS.map((info) => (
            <KeyRow
              key={info.id}
              info={info}
              status={data.keys[info.id]}
              onSave={async (key) => apply(await keysApi.save(info.id, key))}
              onRemove={async () => apply(await keysApi.remove(info.id))}
            />
          ))}
        </div>
      </Card>
      <p className={`text-[13px] ${state.ready ? "text-ok" : "text-text-2"}`}>
        {state.text}
        {!state.ready && data.server_keys_allowed && " Until then, this server's own keys are used."}
      </p>
    </div>
  );
}
