import assert from "node:assert/strict";
import test from "node:test";
import { SecureNodemailer, renderVerificationEmail } from "../src/lib/auth-email-provider";

test("verification email escapes URL content and rejects unsafe theme colors", () => {
  const message = renderVerificationEmail(
    "https://example.com/api/auth/callback?token=%22%3E%3Cscript%3E",
    "red; background:url(javascript:alert(1))"
  );

  assert.match(message.html, /background:#8b5cf6/);
  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.html, /%22%3E%3Cscript%3E/);
});

test("secure email provider preserves the nodemailer provider id and sends magic links", async () => {
  let sentMessage: Record<string, string> | undefined;
  const provider = SecureNodemailer(
    {
      server: "smtp://localhost:2525",
      from: "Nythera <no-reply@example.com>"
    },
    () => ({
      async sendMail(message) {
        sentMessage = message;
        return { rejected: [], pending: [] };
      }
    })
  );

  assert.equal(provider.id, "nodemailer");
  assert.equal(provider.type, "email");

  await provider.sendVerificationRequest({
    identifier: "traveler@example.com",
    url: "https://example.com/api/auth/callback?token=safe",
    expires: new Date(Date.now() + 60_000),
    provider,
    token: "safe",
    theme: {
      colorScheme: "auto",
      logo: "",
      brandColor: "#123456",
      buttonText: "#ffffff"
    },
    request: new Request("https://example.com")
  });

  assert.equal(sentMessage?.to, "traveler@example.com");
  assert.equal(sentMessage?.from, "Nythera <no-reply@example.com>");
  assert.match(sentMessage?.html ?? "", /background:#123456/);
});

test("secure email provider fails closed when SMTP rejects a recipient", async () => {
  const provider = SecureNodemailer(
    {
      server: "smtp://localhost:2525",
      from: "no-reply@example.com"
    },
    () => ({
      async sendMail() {
        return { rejected: ["traveler@example.com"] };
      }
    })
  );

  await assert.rejects(
    async () =>
      provider.sendVerificationRequest({
        identifier: "traveler@example.com",
        url: "https://example.com/api/auth/callback?token=safe",
        expires: new Date(Date.now() + 60_000),
        provider,
        token: "safe",
        theme: {
          colorScheme: "auto",
          logo: "",
          brandColor: "#123456",
          buttonText: "#ffffff"
        },
        request: new Request("https://example.com")
      }),
    /delivery was rejected/
  );
});
