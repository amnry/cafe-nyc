// Cloudflare Turnstile in the browser. The script loads only when the visitor taps Test.

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  remove(widgetId: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    script.onerror = () => {
      loading = null;
      reject(new Error("turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** One token per call. The widget is invisible unless Cloudflare needs an interaction. */
export async function getTurnstileToken(container: HTMLElement, siteKey: string, timeoutMs = 30_000): Promise<string> {
  const api = await loadTurnstile();
  return new Promise<string>((resolve, reject) => {
    let id: string | null = null;
    const done = (fn: () => void) => {
      clearTimeout(timer);
      if (id !== null) api.remove(id);
      fn();
    };
    const timer = setTimeout(() => done(() => reject(new Error("turnstile timeout"))), timeoutMs);
    id = api.render(container, {
      sitekey: siteKey,
      appearance: "interaction-only",
      theme: "light",
      callback: (token: string) => done(() => resolve(token)),
      "error-callback": () => done(() => reject(new Error("turnstile error"))),
      "timeout-callback": () => done(() => reject(new Error("turnstile expired"))),
    });
  });
}
