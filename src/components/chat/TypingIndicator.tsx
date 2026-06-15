export function TypingIndicator() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Typing">
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-purple)] [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-purple)] opacity-80 [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-purple)] opacity-60 [animation-delay:300ms]" />
    </span>
  );
}
