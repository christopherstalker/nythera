export default function MainLoading() {
  return (
    <main className="grid min-h-full place-items-center bg-[var(--codex-paper)] px-6" aria-busy="true">
      <div className="grid place-items-center gap-4 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border border-[var(--codex-rule)] border-t-[var(--codex-mint)]" aria-hidden="true" />
        <p className="codex-kicker text-[var(--text-muted)]">Opening page</p>
      </div>
    </main>
  );
}
