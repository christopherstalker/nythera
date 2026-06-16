export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg-base)] px-6">
      <div className="grid place-items-center gap-4 text-center">
        <span className="nythera-loader h-2 w-2 rounded-full bg-[var(--brand-primary)]" aria-hidden="true" />
        <p className="text-sm font-medium tracking-wide text-[var(--text-muted)]">Opening Nythera</p>
      </div>
    </main>
  );
}
