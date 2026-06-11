export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-10">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground">
        <p>Chats, messages, memories, reports, and usage logs are stored to provide continuity, safety, abuse prevention, and billing controls.</p>
        <p>User-supplied provider API keys are encrypted server-side. Browser clients never receive saved OpenAI, Anthropic, Gemini, Redis, or database credentials.</p>
        <p>Production deployments should enable export, deletion, retention limits, and regional compliance workflows before opening public signups.</p>
      </div>
    </div>
  );
}
