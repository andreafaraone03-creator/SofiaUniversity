import assert from "node:assert/strict";
import test from "node:test";
import { verifyRecaptchaToken } from "../artifacts/api-server/src/lib/sofia-recaptcha.ts";

const configured = {
  siteKey: "public-site-key",
  secretKey: "private-secret-key",
};

test("reCAPTCHA verification fails closed when keys are not configured", async () => {
  let fetchCalled = false;
  const status = await verifyRecaptchaToken("user-token", {
    siteKey: "",
    secretKey: "",
    fetcher: async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    },
  });

  assert.equal(status, "not_configured");
  assert.equal(fetchCalled, false);
});

test("reCAPTCHA sends the token and secret to Google's verification endpoint", async () => {
  const status = await verifyRecaptchaToken("user-token", {
    ...configured,
    fetcher: async (url, init) => {
      assert.equal(url, "https://www.google.com/recaptcha/api/siteverify");
      assert.equal(init.method, "POST");
      assert.equal(init.headers["Content-Type"], "application/x-www-form-urlencoded");
      const body = new URLSearchParams(init.body);
      assert.equal(body.get("secret"), configured.secretKey);
      assert.equal(body.get("response"), "user-token");
      assert.equal(body.has("siteKey"), false);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    },
  });

  assert.equal(status, "verified");
});

test("reCAPTCHA rejects tokens Google marks unsuccessful", async () => {
  const status = await verifyRecaptchaToken("expired-token", {
    ...configured,
    fetcher: async () => new Response(
      JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }),
      { status: 200 },
    ),
  });

  assert.equal(status, "invalid");
});

test("reCAPTCHA fails closed when Google cannot be reached", async () => {
  const status = await verifyRecaptchaToken("user-token", {
    ...configured,
    fetcher: async () => {
      throw new Error("provider unreachable");
    },
  });

  assert.equal(status, "unavailable");
});