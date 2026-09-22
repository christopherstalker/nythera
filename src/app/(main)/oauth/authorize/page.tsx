import { redirect } from "next/navigation";
import { Link2, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/api";
import { loginUrl } from "@/lib/auth-routes";
import { authorizeIntegration, IntegrationOAuthError, validateIntegrationAuthorization } from "@/lib/integration-oauth";
import { INTEGRATION_SCOPE_LABELS } from "@/lib/integration-policy";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Connect an AI application · Nythera",
  robots: { index: false, follow: false },
  referrer: "no-referrer"
};

export default async function AuthorizeIntegrationPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parameters = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(parameters)) if (typeof value === "string") query.set(key, value);
    redirect(loginUrl(`/oauth/authorize?${query}`));
  }
  let validated;
  try {
    validated = await validateIntegrationAuthorization(parameters);
  } catch (error) {
    if (!(error instanceof IntegrationOAuthError || error instanceof z.ZodError)) throw error;
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-xl font-semibold">This connection request is invalid</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Return to your AI application and start the connection again.
        </p>
      </div>
    );
  }
  const { authorization, client, scopes } = validated;

  async function decideConnection(form: FormData) {
    "use server";
    const user = await requireUser();
    const destination = await authorizeIntegration(authorization, user.id, form.get("decision") === "allow");
    redirect(destination);
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10 sm:py-16">
      <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 sm:p-8">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
          <Link2 className="h-6 w-6" />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Nythera connection
        </p>
        <h1 className="break-words text-2xl font-semibold">Connect {client.name}?</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          This application wants access to characters in your Nythera account.
        </p>
        <p className="mt-2 break-all text-xs text-[var(--text-muted)]">
          Return address: {new URL(authorization.redirect_uri).origin}
        </p>
        <ul className="my-7 space-y-4">
          {scopes.map((scope) => (
            <li key={scope} className="flex items-start gap-3 text-sm">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--accent-primary)]" />
              {INTEGRATION_SCOPE_LABELS[scope]}
            </li>
          ))}
        </ul>
        <p className="border-t border-[var(--border-default)] pt-5 text-xs leading-6 text-[var(--text-muted)]">
          New characters start private. This connection cannot read chats or model API keys. You can disconnect it at
          any time in Settings → AI connections.
        </p>
        <form action={decideConnection} className="mt-6 flex gap-3">
          <Button type="submit" name="decision" value="allow">
            Allow connection
          </Button>
          <Button type="submit" name="decision" value="deny" variant="secondary">
            Cancel
          </Button>
        </form>
      </section>
    </main>
  );
}
