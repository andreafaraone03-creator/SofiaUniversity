import { useEffect, useRef, useState } from "react";
import { useGetRecaptchaConfig } from "@workspace/api-client-react";

type GoogleRecaptchaApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme: "light";
    },
  ) => number;
  reset: (widgetId?: number) => void;
};

declare global {
  interface Window {
    grecaptcha?: GoogleRecaptchaApi;
  }
}

let recaptchaScriptPromise: Promise<void> | null = null;

function loadRecaptchaScript(): Promise<void> {
  if (window.grecaptcha?.render) return Promise.resolve();
  if (recaptchaScriptPromise) return recaptchaScriptPromise;

  recaptchaScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-sofia-recaptcha]");
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (window.grecaptcha?.render) resolve();
      else {
        script.remove();
        reject(new Error("Google reCAPTCHA non disponibile."));
      }
    };
    const onError = () => {
      script.remove();
      reject(new Error("Impossibile caricare Google reCAPTCHA."));
    };

    if (!existing) {
      script.src = "https://www.google.com/recaptcha/api.js?render=explicit&hl=it";
      script.async = true;
      script.defer = true;
      script.dataset.sofiaRecaptcha = "true";
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      document.head.append(script);
    } else if (window.grecaptcha?.render) {
      onLoad();
    } else {
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
    }
  }).catch((error: unknown) => {
    recaptchaScriptPromise = null;
    throw error;
  });

  return recaptchaScriptPromise;
}

type RecaptchaCheckboxProps = {
  onTokenChange: (token: string | null) => void;
  resetKey: number;
};

export function RecaptchaCheckbox({ onTokenChange, resetKey }: RecaptchaCheckboxProps) {
  const configQuery = useGetRecaptchaConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    const siteKey = configQuery.data?.siteKey;
    if (!configQuery.data?.enabled || !siteKey || !containerRef.current) {
      onTokenChangeRef.current(null);
      return;
    }

    let active = true;
    setLoadError("");
    void loadRecaptchaScript()
      .then(() => {
        if (!active || !containerRef.current || !window.grecaptcha) return;
        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          theme: "light",
          callback: (token) => {
            onTokenChangeRef.current(token);
          },
          "expired-callback": () => {
            onTokenChangeRef.current(null);
          },
          "error-callback": () => {
            onTokenChangeRef.current(null);
            setLoadError("Google reCAPTCHA non è raggiungibile. Ricarica la pagina e riprova.");
          },
        });
      })
      .catch(() => {
        if (!active) return;
        onTokenChangeRef.current(null);
        setLoadError("Impossibile caricare la verifica anti-spam. Ricarica la pagina e riprova.");
      });

    return () => {
      active = false;
      const widgetId = widgetIdRef.current;
      if (widgetId !== null) {
        try {
          window.grecaptcha?.reset(widgetId);
        } catch {
          // The widget may already have been removed by Google.
        }
        widgetIdRef.current = null;
      }
    };
  }, [configQuery.data?.enabled, configQuery.data?.siteKey]);

  useEffect(() => {
    if (resetKey === 0) return;
    onTokenChangeRef.current(null);
    if (widgetIdRef.current !== null) {
      window.grecaptcha?.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  return (
    <fieldset className="border border-[hsl(var(--border))] p-4">
      <legend className="px-1 text-xs font-semibold">Verifica anti-spam</legend>
      {configQuery.isLoading && (
        <p className="text-sm text-[hsl(var(--muted-foreground))]" role="status">
          Caricamento della verifica…
        </p>
      )}
      {configQuery.isError && (
        <p className="text-sm text-[hsl(var(--destructive))]" role="alert">
          Non riesco a preparare la verifica anti-spam. Ricarica la pagina.
        </p>
      )}
      {!configQuery.isLoading && !configQuery.isError && !configQuery.data?.enabled && (
        <p className="text-sm text-[hsl(var(--destructive))]" role="alert">
          La verifica anti-spam non è configurata. Le prenotazioni sono temporaneamente disattivate.
        </p>
      )}
      {configQuery.data?.enabled && (
        <>
          <div ref={containerRef} aria-label="reCAPTCHA Non sono un robot" />
          {loadError && <p className="mt-2 text-sm text-[hsl(var(--destructive))]" role="alert">{loadError}</p>}
        </>
      )}
    </fieldset>
  );
}