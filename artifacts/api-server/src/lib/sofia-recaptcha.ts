export type RecaptchaVerificationStatus =
  | "verified"
  | "invalid"
  | "not_configured"
  | "unavailable";

type RecaptchaOptions = {
  siteKey?: string | null;
  secretKey?: string | null;
  fetcher?: typeof fetch;
};

export async function verifyRecaptchaToken(
  token: string,
  options: RecaptchaOptions = {},
): Promise<RecaptchaVerificationStatus> {
  const siteKey = (options.siteKey === undefined
    ? process.env.SOFIA_RECAPTCHA_SITE_KEY
    : options.siteKey)?.trim();
  const secretKey = (options.secretKey === undefined
    ? process.env.SOFIA_RECAPTCHA_SECRET_KEY
    : options.secretKey)?.trim();

  if (!siteKey || !secretKey) return "not_configured";
  if (!token.trim()) return "invalid";

  const body = new URLSearchParams({
    secret: secretKey,
    response: token,
  });

  try {
    const response = await (options.fetcher ?? fetch)(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) return "unavailable";

    const result = await response.json().catch(() => null) as {
      success?: unknown;
    } | null;
    return result?.success === true ? "verified" : "invalid";
  } catch {
    return "unavailable";
  }
}