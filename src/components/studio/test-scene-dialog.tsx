"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, FlaskConical, LoaderCircle, Square } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateLocally, readLocalModel } from "@/lib/local-model";

type SceneReply = { content: string; model: string; characterUpdatedAt: string; generatedAt: string };
const SCENES = [
  { label: "First encounter", text: "We meet at the entrance just before closing time. I ask what brought you here." },
  {
    label: "Remember a detail",
    text: "Earlier I told you I am afraid of deep water and gave you a brass compass. Now we reach the river. What do you suggest?"
  },
  {
    label: "Leave me agency",
    text: "You offer me a choice that matters to you. I stay silent for a moment. Continue the scene without deciding my response."
  }
];

export function TestSceneDialog({
  character,
  open,
  onClose
}: {
  character: { id: string; name: string };
  open: boolean;
  onClose: () => void;
}) {
  const [scene, setScene] = useState(SCENES[0].text);
  const [persona, setPersona] = useState("");
  const [reply, setReply] = useState<SceneReply | null>(null);
  const [baseline, setBaseline] = useState<SceneReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  async function runScene() {
    if (busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    setChecks([]);
    const localModel = readLocalModel();
    const submit = (localOutput?: string) =>
      fetch(`/api/characters/${character.id}/test-scene`, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scene, persona, localModel: localModel ?? undefined, localOutput })
      });
    try {
      let response = await submit();
      let body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The test scene could not be generated.");
      if (body.local && localModel) {
        const content = await generateLocally(localModel, body.request, controller.signal, () => {});
        response = await submit(content);
        body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "The local test reply could not be checked.");
      }
      setReply(body);
    } catch (caught) {
      setError(
        controller.signal.aborted
          ? "Test stopped. Your previous reply is kept."
          : caught instanceof Error
            ? caught.message
            : "Connection failed. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Test ${character.name}`}
      className="sm:w-[min(860px,calc(100vw-48px))]"
    >
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-purple)]" />
        <p className="text-xs leading-5 text-[var(--text-secondary)]">
          Try the latest saved character in a private scene. Tests do not enter chat history or memory. Cloud tests use
          your connected provider and may incur usage charges.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SCENES.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={busy}
            aria-pressed={scene === preset.text}
            onClick={() => setScene(preset.text)}
            className={`focus-ring min-h-11 rounded-full border px-3 text-xs ${scene === preset.text ? "border-[var(--accent-purple)] bg-[var(--accent-purple-soft)] text-[var(--text-primary)]" : "border-[var(--border-default)] text-[var(--text-muted)]"}`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <label htmlFor="test-scene-prompt" className="mb-2 mt-4 block text-xs font-medium text-[var(--text-secondary)]">
        Scene to test
      </label>
      <Textarea
        id="test-scene-prompt"
        value={scene}
        disabled={busy}
        maxLength={4000}
        rows={4}
        onChange={(event) => setScene(event.target.value)}
      />
      <details className="mt-3 text-xs text-[var(--text-secondary)]">
        <summary className="focus-ring cursor-pointer py-2">Player persona for this test</summary>
        <label htmlFor="test-scene-persona" className="sr-only">
          Test player persona
        </label>
        <Textarea
          id="test-scene-persona"
          value={persona}
          disabled={busy}
          maxLength={4000}
          rows={3}
          onChange={(event) => setPersona(event.target.value)}
          placeholder="Identity, visible traits, and facts the character should respect"
        />
      </details>
      <div className="my-4 flex flex-wrap items-center gap-2">
        <Button disabled={busy || !scene.trim()} onClick={() => void runScene()}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          {busy ? "Generating…" : reply ? "Run again" : "Run test scene"}
        </Button>
        {busy ? (
          <Button variant="secondary" onClick={() => abortRef.current?.abort()}>
            <Square className="h-3 w-3" />
            Stop
          </Button>
        ) : reply ? (
          <Button variant="ghost" onClick={() => setBaseline(reply)}>
            <Bookmark className="h-4 w-4" />
            Keep as baseline
          </Button>
        ) : null}
        {baseline ? (
          <Button variant="ghost" onClick={() => setBaseline(null)}>
            Clear baseline
          </Button>
        ) : null}
      </div>
      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-rose-400/30 bg-rose-400/5 p-3 text-xs leading-5 text-rose-300"
        >
          {error}
        </p>
      ) : null}
      {reply ? (
        <>
          <div className={`grid gap-3 ${baseline ? "md:grid-cols-2" : ""}`}>
            {baseline ? <ReplyCard title="Baseline" reply={baseline} /> : null}
            <ReplyCard title="Latest reply" reply={reply} />
          </div>
          <fieldset className="mt-4 border-t border-[var(--border-default)] pt-4">
            <legend className="px-1 text-xs font-medium text-[var(--text-secondary)]">Your review</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {["Voice stays consistent", "Facts are respected", "Player keeps control"].map((label) => (
                <label key={label} className="flex min-h-11 items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={checks.includes(label)}
                    onChange={(event) =>
                      setChecks((current) =>
                        event.target.checked ? [...current, label] : current.filter((item) => item !== label)
                      )
                    }
                    className="h-4 w-4 accent-[var(--accent-purple)]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            A manual review of this scene, not an automatic quality score. Baseline stays available while this Studio is
            open.
          </p>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border-default)] px-5 py-7 text-center text-xs leading-5 text-[var(--text-muted)]">
          The reply will appear here. Keep one as a baseline, edit the character in another tab, then run the same scene
          again.
        </div>
      )}
    </Modal>
  );
}

function ReplyCard({ title, reply }: { title: string; reply: SceneReply }) {
  return (
    <article className="min-w-0 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
      <div className="mb-3 border-b border-[var(--border-default)] pb-3">
        <p className="text-xs font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="mt-1 break-all text-[10px] text-[var(--text-muted)]">
          {reply.model} · Character saved {new Date(reply.characterUpdatedAt).toLocaleString()}
        </p>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--text-secondary)]">{reply.content}</p>
    </article>
  );
}
