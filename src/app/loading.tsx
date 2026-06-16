export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg-base)] px-6">
      <div className="grid place-items-center gap-5 text-center">
        <span className="brand-mark-shell nythera-loading-mark h-20 w-20">
          <img src="/nythera-showcase/nythera-logo-mark.png" alt="" className="h-full w-full object-contain drop-shadow-[0_0_24px_rgba(255,122,24,0.6)]" />
        </span>
        <p className="text-sm font-medium text-[var(--text-secondary)]">Opening Nythera</p>
      </div>
    </main>
  );
}
