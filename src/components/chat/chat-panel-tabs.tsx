"use client";

import Link from "next/link";
import { Bookmark, CalendarClock, Check, Download, FileJson, ImagePlus, LockKeyhole, LockOpen, Mic2, PauseCircle, Plus, Route, ShieldAlert, Sparkles, Trash2, Upload, UsersRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ImageFilePicker } from "@/components/ui/image-file-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useChatQuickPanel } from "@/hooks/use-chat-quick-panel";
import { toChatPreview } from "@/lib/chat-preview";
import { cn } from "@/lib/utils";

type PanelState = ReturnType<typeof useChatQuickPanel>;

const panelSelectClass = "focus-ring h-11 w-full min-w-0 border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)]";

export function PersonaTabContent({ panel, compact = false }: { panel: PanelState; compact?: boolean }) {
  return (
    <div className="grid gap-3">
      <div className="scrollbar-none flex min-w-0 gap-2 overflow-x-auto pb-1">
        {panel.profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => void panel.switchPersona(profile)}
            className={cn(
              "focus-ring flex h-11 min-w-0 shrink-0 items-center gap-2 rounded-2xl border px-3 text-left text-xs transition-colors",
              panel.activeProfileId === profile.id
                ? "border-transparent bg-[var(--accent-purple-soft)] text-[var(--text-primary)]"
                : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-secondary)]"
            )}
          >
            <Avatar name={profile.displayName} src={profile.avatarUrl} size="xs" />
            <span className="max-w-28 truncate">{profile.label || profile.displayName}</span>
            {panel.activeProfileId === profile.id ? <Check className="h-3.5 w-3.5 text-[var(--accent-purple)]" /> : null}
          </button>
        ))}
        <button
          type="button"
          onClick={panel.startNewPersona}
          className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          aria-label="Add persona"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={panel.savePersona} className="grid gap-2">
        {!compact ? <Input value={panel.draft.label} onChange={(event) => panel.updateDraft("label", event.target.value)} placeholder="Profile label" /> : null}
        <Input value={panel.draft.displayName} onChange={(event) => panel.updateDraft("displayName", event.target.value)} placeholder="Your roleplay name" required />
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
          <ImageFilePicker
            onPick={panel.pickAvatar}
            onError={panel.setAvatarPickError}
            onUploadingChange={panel.setAvatarUploadingState}
            className="focus-ring grid h-[72px] place-items-center overflow-hidden rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--accent-purple)] transition hover:border-[var(--accent-purple)] hover:bg-white/[0.045]"
          >
            {panel.draft.avatarUrl ? <img src={panel.draft.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Upload className="h-5 w-5" />}
          </ImageFilePicker>
          <div className="grid content-center gap-2">
            <p className="text-xs leading-5 text-[var(--text-secondary)]">
              {panel.avatarUploading ? "Processing photo..." : "Tap the square to upload a photo from your gallery."}
            </p>
            {panel.draft.avatarUrl ? (
              <button
                type="button"
                onClick={() => panel.updateDraft("avatarUrl", "")}
                className="focus-ring inline-flex h-8 items-center justify-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-xs text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Clear photo
              </button>
            ) : null}
          </div>
        </div>
        <Textarea value={panel.draft.summary} onChange={(event) => panel.updateDraft("summary", event.target.value)} placeholder="Who you are in this chat." required className="min-h-20" />
        {!compact ? (
          <>
            <Textarea value={panel.draft.background} onChange={(event) => panel.updateDraft("background", event.target.value)} placeholder="Background or current situation." className="min-h-20" />
            <Textarea value={panel.draft.traits} onChange={(event) => panel.updateDraft("traits", event.target.value)} placeholder="Traits, one per line" className="min-h-16" />
          </>
        ) : null}
        <Button type="submit" disabled={!panel.draft.displayName.trim() || !panel.draft.summary.trim() || panel.avatarUploading}>
          <Check className="h-4 w-4" />
          Save persona
        </Button>
      </form>
      {panel.personaStatus ? <PanelStatusText>{panel.personaStatus}</PanelStatusText> : null}
    </div>
  );
}

export function CastTabContent({ panel }: { panel: PanelState }) {
  const cast = panel.storyParticipants.filter((participant) => participant.role === "CHARACTER" || participant.role === "NPC" || participant.role === "PLAYER" || participant.role === "OWNER");

  return (
    <div className="grid gap-6">
      <form onSubmit={panel.saveStoryCastState} className="grid gap-3 border-b border-[var(--border-default)] pb-6">
        <NarrativeHeading icon={UsersRound} title="Dynamic identity" subtitle="Current mood, look, goal, conflict, and voice" />
        <select className={panelSelectClass} value={panel.castParticipantId} onChange={(event) => panel.selectCastParticipant(event.target.value)} aria-label="Cast member">
          <option value="">Choose cast member</option>{cast.map((participant) => <option key={participant.id} value={participant.id}>{participant.displayName}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2"><Input value={panel.storyCastStateDraft.displayNameOverride} onChange={(event) => panel.updateStoryCastStateDraft("displayNameOverride", event.target.value)} placeholder="Scene name" /><Input value={panel.storyCastStateDraft.pronouns} onChange={(event) => panel.updateStoryCastStateDraft("pronouns", event.target.value)} placeholder="Pronouns" /></div>
        <Input value={panel.storyCastStateDraft.currentMood} onChange={(event) => panel.updateStoryCastStateDraft("currentMood", event.target.value)} placeholder="Current mood" />
        <Textarea value={panel.storyCastStateDraft.appearance} onChange={(event) => panel.updateStoryCastStateDraft("appearance", event.target.value)} placeholder="Current appearance or outfit" className="min-h-20" />
        <Textarea value={panel.storyCastStateDraft.currentGoal} onChange={(event) => panel.updateStoryCastStateDraft("currentGoal", event.target.value)} placeholder="Immediate goal" className="min-h-20" />
        <Textarea value={panel.storyCastStateDraft.innerConflict} onChange={(event) => panel.updateStoryCastStateDraft("innerConflict", event.target.value)} placeholder="Private inner conflict" className="min-h-20" />
        <Input value={panel.storyCastStateDraft.voiceStyle} onChange={(event) => panel.updateStoryCastStateDraft("voiceStyle", event.target.value)} placeholder="Voice quality, e.g. hushed and precise" />
        <Textarea value={panel.storyCastStateDraft.speakingStyle} onChange={(event) => panel.updateStoryCastStateDraft("speakingStyle", event.target.value)} placeholder="How speech has changed in this timeline" className="min-h-20" />
        <Button type="submit" disabled={!panel.castParticipantId}><Check className="h-4 w-4" />Save cast state</Button>
      </form>

      <form onSubmit={panel.saveStoryVoice} className="grid gap-3 border-b border-[var(--border-default)] pb-6">
        <NarrativeHeading icon={Mic2} title="Story voice" subtitle="Bind a provider voice and its real playback speed" />
        <select className={panelSelectClass} value={panel.storyVoiceDraft.provider} onChange={(event) => panel.updateStoryVoiceDraft("provider", event.target.value as typeof panel.storyVoiceDraft.provider)} aria-label="Voice provider"><option value="elevenlabs">ElevenLabs</option><option value="playht">PlayHT</option></select>
        <Input value={panel.storyVoiceDraft.voiceId} onChange={(event) => panel.updateStoryVoiceDraft("voiceId", event.target.value)} placeholder="Provider voice ID" required />
        <RangeField label="Playback speed" value={panel.storyVoiceDraft.speed} min={0.7} max={1.2} step={0.05} onChange={(value) => panel.updateStoryVoiceDraft("speed", value)} />
        <Button type="submit" disabled={!panel.castParticipantId || !panel.storyVoiceDraft.voiceId.trim()}><Mic2 className="h-4 w-4" />Save voice binding</Button>
      </form>

      <form onSubmit={panel.addStoryVisualReference} className="grid gap-3 border-b border-[var(--border-default)] pb-6">
        <NarrativeHeading icon={ImagePlus} title="Visual continuity" subtitle="Lock a portrait, outfit, place, item, or moodboard" />
        <div className="grid grid-cols-2 gap-2">
          <select className={panelSelectClass} value={panel.storyVisualDraft.participantId} onChange={(event) => panel.updateStoryVisualDraft("participantId", event.target.value)} aria-label="Visual cast member"><option value="">No cast link</option>{cast.map((participant) => <option key={participant.id} value={participant.id}>{participant.displayName}</option>)}</select>
          <select className={panelSelectClass} value={panel.storyVisualDraft.visualKind} onChange={(event) => panel.updateStoryVisualDraft("visualKind", event.target.value as typeof panel.storyVisualDraft.visualKind)} aria-label="Visual reference kind"><option value="PORTRAIT">Portrait</option><option value="OUTFIT">Outfit</option><option value="LOCATION">Location</option><option value="ITEM">Item</option><option value="MOODBOARD">Moodboard</option><option value="OTHER">Other</option></select>
        </div>
        <Input value={panel.storyVisualDraft.title} onChange={(event) => panel.updateStoryVisualDraft("title", event.target.value)} placeholder="Reference title" required />
        <Input value={panel.storyVisualDraft.imageUrl} onChange={(event) => panel.updateStoryVisualDraft("imageUrl", event.target.value)} placeholder="Image URL (optional when prompt is set)" />
        <Textarea value={panel.storyVisualDraft.prompt} onChange={(event) => panel.updateStoryVisualDraft("prompt", event.target.value)} placeholder="Canonical visual description or generation prompt" className="min-h-24" />
        <Textarea value={panel.storyVisualDraft.notes} onChange={(event) => panel.updateStoryVisualDraft("notes", event.target.value)} placeholder="Continuity notes" className="min-h-16" />
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={panel.storyVisualDraft.locked} onChange={(event) => panel.updateStoryVisualDraft("locked", event.target.checked)} />Lock into prompt continuity</label>
        <Button type="submit" disabled={!panel.storyVisualDraft.title.trim() || (!panel.storyVisualDraft.imageUrl.trim() && !panel.storyVisualDraft.prompt.trim())}><ImagePlus className="h-4 w-4" />Add visual reference</Button>
        {panel.storyVisualReferences.map((reference) => <article key={reference.id} className="grid gap-1 border-b border-[var(--border-default)] py-3"><p className="text-xs uppercase tracking-[.1em] text-[var(--text-muted)]">{reference.kind}{reference.locked ? " · locked" : ""}</p><p className="text-sm text-[var(--text-primary)]">{reference.title}</p><p className="text-xs leading-5 text-[var(--text-secondary)]">{reference.prompt || reference.notes || reference.imageUrl}</p></article>)}
      </form>

      <form onSubmit={panel.addStoryCheckpoint} className="grid gap-3">
        <NarrativeHeading icon={Bookmark} title="Continuity checkpoint" subtitle="Create a resume point; blank summary composes from current state" />
        <Input value={panel.storyCheckpointDraft.title} onChange={(event) => panel.updateStoryCheckpointDraft("title", event.target.value)} placeholder="Checkpoint title" required />
        <Textarea value={panel.storyCheckpointDraft.summary} onChange={(event) => panel.updateStoryCheckpointDraft("summary", event.target.value)} placeholder="Optional recap; leave blank for structured automatic recap" className="min-h-24" />
        <Textarea value={panel.storyCheckpointDraft.openThreads} onChange={(event) => panel.updateStoryCheckpointDraft("openThreads", event.target.value)} placeholder="Open threads, one per line" className="min-h-20" />
        <Button type="submit" disabled={!panel.storyCheckpointDraft.title.trim()}><Bookmark className="h-4 w-4" />Create checkpoint</Button>
        {panel.storyCheckpoints.map((checkpoint) => <article key={checkpoint.id} className="grid gap-2 border-b border-[var(--border-default)] py-3"><div className="flex items-center justify-between gap-2"><p className="text-sm text-[var(--text-primary)]">{checkpoint.title}</p><span className="text-[10px] uppercase tracking-[.1em] text-[var(--text-muted)]">{checkpoint.kind}</span></div><p className="line-clamp-4 text-xs leading-5 text-[var(--text-secondary)]">{checkpoint.summary}</p>{checkpoint.openThreads.length ? <p className="text-xs text-[var(--accent-mint)]">Open: {checkpoint.openThreads.join(" · ")}</p> : null}</article>)}
      </form>

      {panel.storyContinuityStatus ? <PanelStatusText>{panel.storyContinuityStatus}</PanelStatusText> : null}
    </div>
  );
}

export function MemoryTabContent({ panel }: { panel: PanelState }) {
  return (
    <div className="grid gap-3">
      <form onSubmit={panel.addMemory} className="grid gap-2">
        <Textarea value={panel.memoryDraft} onChange={(event) => panel.setMemoryDraft(event.target.value)} placeholder="Add a fact, preference, boundary, or scene detail." className="min-h-28" />
        <Button type="submit" disabled={!panel.memoryDraft.trim()}>
          <Plus className="h-4 w-4" />
          Add memory
        </Button>
      </form>
      {panel.memoryStatus ? <PanelStatusText>{panel.memoryStatus}</PanelStatusText> : null}
      <div className="grid gap-2">
        {panel.memories.map((memory) => (
          <div key={memory.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
            <p className="text-sm leading-5 text-[var(--text-primary)]">{memory.content}</p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {memory.category}
              {memory.pinned ? " - pinned" : ""}
            </p>
          </div>
        ))}
        {panel.memories.length === 0 ? <PanelStatusText>No memories for this character yet.</PanelStatusText> : null}
      </div>
    </div>
  );
}

export function SceneTabContent({ panel }: { panel: PanelState }) {
  const draft = panel.storyStateDraft;
  return (
    <div className="grid gap-6">
      <form onSubmit={panel.saveStoryState} className="grid gap-4 border-b border-[var(--border-default)] pb-6">
        <div className="grid gap-3 border-b border-[var(--border-default)] pb-4">
          <p className="codex-kicker">Current scene</p>
          <Input value={draft.location} onChange={(event) => panel.updateStoryStateDraft("location", event.target.value)} placeholder="Location" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={draft.time} onChange={(event) => panel.updateStoryStateDraft("time", event.target.value)} placeholder="Time" />
            <Input value={draft.weather} onChange={(event) => panel.updateStoryStateDraft("weather", event.target.value)} placeholder="Weather" />
          </div>
        </div>
        <SceneListField label="Inventory" value={draft.inventory} onChange={(value) => panel.updateStoryStateDraft("inventory", value)} />
        <SceneListField label="Conditions" value={draft.conditions} onChange={(value) => panel.updateStoryStateDraft("conditions", value)} />
        <SceneListField label="Active threats" value={draft.threats} onChange={(value) => panel.updateStoryStateDraft("threats", value)} />
        <SceneListField label="Director notes" value={draft.notes} onChange={(value) => panel.updateStoryStateDraft("notes", value)} />
        <Button type="submit" disabled={!panel.storyId}><Check className="h-4 w-4" />Save scene state</Button>
        {panel.storyStateStatus ? <PanelStatusText>{panel.storyStateStatus}</PanelStatusText> : null}
      </form>

      <form onSubmit={panel.saveStorySafety} className="grid gap-3">
        <NarrativeHeading icon={ShieldAlert} title="Session safety" subtitle="Hard limits, veils, check-ins, and an immediate pause" />
        <select className={panelSelectClass} value={panel.storySafetyDraft.contentRating} onChange={(event) => panel.updateStorySafetyDraft("contentRating", event.target.value as typeof panel.storySafetyDraft.contentRating)} aria-label="Story content rating">
          <option value="GENERAL">General</option><option value="TEEN">Teen</option><option value="MATURE">Mature</option>
        </select>
        <Textarea value={panel.storySafetyDraft.hardLimits} onChange={(event) => panel.updateStorySafetyDraft("hardLimits", event.target.value)} placeholder="Hard limits — never include, one per line" className="min-h-20" />
        <Textarea value={panel.storySafetyDraft.softLimits} onChange={(event) => panel.updateStorySafetyDraft("softLimits", event.target.value)} placeholder="Soft limits — approach carefully, one per line" className="min-h-20" />
        <Textarea value={panel.storySafetyDraft.fadeToBlack} onChange={(event) => panel.updateStorySafetyDraft("fadeToBlack", event.target.value)} placeholder="Fade to black instead of depicting, one per line" className="min-h-20" />
        <label className="grid gap-1 text-xs text-[var(--text-secondary)]"><span>Check in every N turns (0 disables)</span><Input type="number" min={0} max={100} value={panel.storySafetyDraft.checkInInterval} onChange={(event) => panel.updateStorySafetyDraft("checkInInterval", Number(event.target.value))} /></label>
        <Textarea value={panel.storySafetyDraft.notes} onChange={(event) => panel.updateStorySafetyDraft("notes", event.target.value)} placeholder="Private safety direction" className="min-h-20" />
        <label className="flex items-center gap-2 border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={panel.storySafetyDraft.paused} onChange={(event) => panel.updateStorySafetyDraft("paused", event.target.checked)} /><PauseCircle className="h-4 w-4 text-[var(--danger)]" />Pause fiction; require an explicit resume</label>
        <Button type="submit" disabled={!panel.storyId}><ShieldAlert className="h-4 w-4" />Save session safety</Button>
        {panel.storySafetyStatus ? <PanelStatusText>{panel.storySafetyStatus}</PanelStatusText> : null}
      </form>
    </div>
  );
}

export function PlotTabContent({ panel }: { panel: PanelState }) {
  const participants = panel.storyParticipants.filter((participant) => participant.role !== "OBSERVER");
  const pendingEvents = panel.storyProactiveEvents.filter((event) => event.status === "SCHEDULED" || event.status === "READY");

  return (
    <div className="grid gap-6">
      <form onSubmit={panel.saveStoryDirector} className="grid gap-3 border-b border-[var(--border-default)] pb-6">
        <NarrativeHeading icon={Sparkles} title="Director" subtitle="Tone, pacing, initiative, and private guidance" />
        <Input value={panel.storyDirectorDraft.tone} onChange={(event) => panel.updateStoryDirectorDraft("tone", event.target.value)} placeholder="Tone, e.g. gothic slow-burn" />
        <div className="grid grid-cols-2 gap-2">
          <select className={panelSelectClass} value={panel.storyDirectorDraft.pacing} onChange={(event) => panel.updateStoryDirectorDraft("pacing", event.target.value as typeof panel.storyDirectorDraft.pacing)} aria-label="Story pacing">
            <option value="SLOW">Slow pacing</option>
            <option value="BALANCED">Balanced pacing</option>
            <option value="FAST">Fast pacing</option>
          </select>
          <select className={panelSelectClass} value={panel.storyDirectorDraft.initiative} onChange={(event) => panel.updateStoryDirectorDraft("initiative", event.target.value as typeof panel.storyDirectorDraft.initiative)} aria-label="Character initiative">
            <option value="REACTIVE">Reactive</option>
            <option value="BALANCED">Balanced</option>
            <option value="PROACTIVE">Proactive</option>
          </select>
        </div>
        <RangeField label="Conflict" value={panel.storyDirectorDraft.conflictLevel} min={0} max={10} onChange={(value) => panel.updateStoryDirectorDraft("conflictLevel", value)} />
        <RangeField label="Romance" value={panel.storyDirectorDraft.romanceLevel} min={0} max={10} onChange={(value) => panel.updateStoryDirectorDraft("romanceLevel", value)} />
        <RangeField label="Mystery" value={panel.storyDirectorDraft.mysteryLevel} min={0} max={10} onChange={(value) => panel.updateStoryDirectorDraft("mysteryLevel", value)} />
        <RangeField label="Humor" value={panel.storyDirectorDraft.humorLevel} min={0} max={10} onChange={(value) => panel.updateStoryDirectorDraft("humorLevel", value)} />
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input type="checkbox" checked={panel.storyDirectorDraft.allowOffscreenEvents} onChange={(event) => panel.updateStoryDirectorDraft("allowOffscreenEvents", event.target.checked)} />
          Allow the world to move offscreen
        </label>
        <Textarea value={panel.storyDirectorDraft.notes} onChange={(event) => panel.updateStoryDirectorDraft("notes", event.target.value)} placeholder="Private direction the characters must never quote directly" className="min-h-20" />
        <Button type="submit" disabled={!panel.storyId}><Check className="h-4 w-4" />Save direction</Button>
      </form>

      <section className="grid gap-4 border-b border-[var(--border-default)] pb-6">
        <NarrativeHeading icon={Route} title="Arcs & beats" subtitle="What the story is moving toward" />
        <form onSubmit={panel.addStoryArc} className="grid gap-2">
          <Input value={panel.storyArcDraft.title} onChange={(event) => panel.updateStoryArcDraft("title", event.target.value)} placeholder="Arc title" required />
          <Textarea value={panel.storyArcDraft.premise} onChange={(event) => panel.updateStoryArcDraft("premise", event.target.value)} placeholder="Central tension and desired evolution" className="min-h-20" required />
          <Button type="submit" disabled={!panel.storyArcDraft.title.trim() || !panel.storyArcDraft.premise.trim()}><Plus className="h-4 w-4" />Add arc</Button>
        </form>
        <div className="grid gap-2">
          {panel.storyArcs.map((arc) => (
            <article key={arc.id} className="grid gap-2 border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-sm font-semibold text-[var(--text-primary)]">{arc.title}</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{arc.premise}</p></div>
                <button type="button" onClick={() => void panel.updateStoryNarrativeItem("arc", arc.id, { arcStatus: arc.status === "COMPLETED" ? "ACTIVE" : "COMPLETED", progress: arc.status === "COMPLETED" ? arc.progress : 100 })} className="focus-ring shrink-0 text-[11px] uppercase tracking-[.1em] text-[var(--accent-mint)]">{arc.status === "COMPLETED" ? "Reopen" : "Complete"}</button>
              </div>
              <RangeField label="Progress" value={arc.progress} min={0} max={100} onChange={(value) => void panel.updateStoryNarrativeItem("arc", arc.id, { progress: value })} />
            </article>
          ))}
        </div>
        <form onSubmit={panel.addStoryBeat} className="grid gap-2 border-t border-[var(--border-default)] pt-4">
          <p className="codex-kicker">Next beat</p>
          <select className={panelSelectClass} value={panel.storyBeatDraft.arcId} onChange={(event) => panel.updateStoryBeatDraft("arcId", event.target.value)} aria-label="Beat story arc"><option value="">No linked arc</option>{panel.storyArcs.map((arc) => <option key={arc.id} value={arc.id}>{arc.title}</option>)}</select>
          <Input value={panel.storyBeatDraft.title} onChange={(event) => panel.updateStoryBeatDraft("title", event.target.value)} placeholder="Beat title" required />
          <Textarea value={panel.storyBeatDraft.description} onChange={(event) => panel.updateStoryBeatDraft("description", event.target.value)} placeholder="What should become possible, not forced" className="min-h-20" required />
          <select className={panelSelectClass} value={panel.storyBeatDraft.status} onChange={(event) => panel.updateStoryBeatDraft("status", event.target.value as typeof panel.storyBeatDraft.status)} aria-label="Beat readiness"><option value="PLANNED">Planned</option><option value="READY">Ready for next turn</option></select>
          <Button type="submit"><Plus className="h-4 w-4" />Add beat</Button>
        </form>
        <div className="grid divide-y divide-[var(--border-default)] border-y border-[var(--border-default)]">
          {panel.storyBeats.map((beat) => (
            <article key={beat.id} className="grid gap-2 py-3">
              <div className="flex items-start justify-between gap-2"><div><p className="text-xs uppercase tracking-[.1em] text-[var(--text-muted)]">{beat.status}</p><p className="mt-1 text-sm text-[var(--text-primary)]">{beat.title}</p></div><button type="button" onClick={() => void panel.updateStoryNarrativeItem("beat", beat.id, { beatStatus: beat.status === "COMPLETED" ? "READY" : "COMPLETED" })} className="focus-ring text-xs text-[var(--accent-mint)]">{beat.status === "COMPLETED" ? "Ready" : "Done"}</button></div>
              <p className="text-xs leading-5 text-[var(--text-secondary)]">{beat.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 border-b border-[var(--border-default)] pb-6">
        <NarrativeHeading icon={Sparkles} title="Open hooks" subtitle="Mysteries, promises, and unresolved pressure" />
        <form onSubmit={panel.addStoryHook} className="grid gap-2">
          <select className={panelSelectClass} value={panel.storyHookDraft.arcId} onChange={(event) => panel.updateStoryHookDraft("arcId", event.target.value)} aria-label="Hook story arc"><option value="">No linked arc</option>{panel.storyArcs.map((arc) => <option key={arc.id} value={arc.id}>{arc.title}</option>)}</select>
          <Input value={panel.storyHookDraft.title} onChange={(event) => panel.updateStoryHookDraft("title", event.target.value)} placeholder="Hook title" required />
          <Textarea value={panel.storyHookDraft.description} onChange={(event) => panel.updateStoryHookDraft("description", event.target.value)} placeholder="The unanswered question or unresolved promise" className="min-h-20" required />
          <RangeField label="Urgency" value={panel.storyHookDraft.urgency} min={0} max={10} onChange={(value) => panel.updateStoryHookDraft("urgency", value)} />
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={panel.storyHookDraft.directorOnly} onChange={(event) => panel.updateStoryHookDraft("directorOnly", event.target.checked)} />Keep payoff private</label>
          <Button type="submit"><Plus className="h-4 w-4" />Open hook</Button>
        </form>
        {panel.storyHooks.map((hook) => (
          <article key={hook.id} className="grid gap-2 border-b border-[var(--border-default)] pb-3">
            <div className="flex items-start justify-between gap-2"><div><p className="text-sm text-[var(--text-primary)]">{hook.title}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Urgency {hook.urgency}/10{hook.directorOnly ? " · private" : ""}</p></div><button type="button" onClick={() => void panel.updateStoryNarrativeItem("hook", hook.id, { hookStatus: hook.status === "RESOLVED" ? "OPEN" : "RESOLVED" })} className="focus-ring text-xs text-[var(--accent-mint)]">{hook.status === "RESOLVED" ? "Reopen" : "Resolve"}</button></div>
            <p className="text-xs leading-5 text-[var(--text-secondary)]">{hook.description}</p>
          </article>
        ))}
      </section>

      <form onSubmit={panel.saveStoryRelationship} className="grid gap-3 border-b border-[var(--border-default)] pb-6">
        <NarrativeHeading icon={Route} title="Relationship state" subtitle="Directional emotional continuity between cast members" />
        <div className="grid grid-cols-2 gap-2">
          <select className={panelSelectClass} value={panel.storyRelationshipDraft.fromParticipantId} onChange={(event) => panel.updateStoryRelationshipDraft("fromParticipantId", event.target.value)} aria-label="Relationship from"><option value="">From</option>{participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.displayName}</option>)}</select>
          <select className={panelSelectClass} value={panel.storyRelationshipDraft.toParticipantId} onChange={(event) => panel.updateStoryRelationshipDraft("toParticipantId", event.target.value)} aria-label="Relationship to"><option value="">To</option>{participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.displayName}</option>)}</select>
        </div>
        <Input value={panel.storyRelationshipDraft.label} onChange={(event) => panel.updateStoryRelationshipDraft("label", event.target.value)} placeholder="Dynamic, e.g. reluctant allies" />
        <RangeField label="Trust" value={panel.storyRelationshipDraft.trust} min={-100} max={100} onChange={(value) => panel.updateStoryRelationshipDraft("trust", value)} />
        <RangeField label="Affection" value={panel.storyRelationshipDraft.affection} min={-100} max={100} onChange={(value) => panel.updateStoryRelationshipDraft("affection", value)} />
        <RangeField label="Tension" value={panel.storyRelationshipDraft.tension} min={-100} max={100} onChange={(value) => panel.updateStoryRelationshipDraft("tension", value)} />
        <RangeField label="Respect" value={panel.storyRelationshipDraft.respect} min={-100} max={100} onChange={(value) => panel.updateStoryRelationshipDraft("respect", value)} />
        <Textarea value={panel.storyRelationshipDraft.notes} onChange={(event) => panel.updateStoryRelationshipDraft("notes", event.target.value)} placeholder="What changed and how it should color future scenes" className="min-h-20" />
        <Button type="submit" disabled={!panel.storyRelationshipDraft.fromParticipantId || !panel.storyRelationshipDraft.toParticipantId}><Check className="h-4 w-4" />Save relationship</Button>
        {panel.storyRelationships.map((relationship) => <p key={relationship.id} className="text-xs leading-5 text-[var(--text-secondary)]"><span className="text-[var(--text-primary)]">{relationship.fromParticipant.displayName} → {relationship.toParticipant.displayName}</span>{relationship.label ? ` · ${relationship.label}` : ""} · trust {relationship.trust}, affection {relationship.affection}, tension {relationship.tension}, respect {relationship.respect}</p>)}
      </form>

      <section className="grid gap-4">
        <NarrativeHeading icon={CalendarClock} title="Character initiative" subtitle="Schedule an action for a future turn" />
        <form onSubmit={panel.addStoryEvent} className="grid gap-2">
          <select className={panelSelectClass} value={panel.storyEventDraft.actorParticipantId} onChange={(event) => panel.updateStoryEventDraft("actorParticipantId", event.target.value)} aria-label="Initiative actor"><option value="">The world / any character</option>{participants.filter((participant) => participant.role === "CHARACTER" || participant.role === "NPC").map((participant) => <option key={participant.id} value={participant.id}>{participant.displayName}</option>)}</select>
          <Input value={panel.storyEventDraft.title} onChange={(event) => panel.updateStoryEventDraft("title", event.target.value)} placeholder="Event title" required />
          <Textarea value={panel.storyEventDraft.instruction} onChange={(event) => panel.updateStoryEventDraft("instruction", event.target.value)} placeholder="What initiative should surface when due" className="min-h-20" required />
          <div className="grid grid-cols-2 gap-2"><select className={panelSelectClass} value={panel.storyEventDraft.channel} onChange={(event) => panel.updateStoryEventDraft("channel", event.target.value as typeof panel.storyEventDraft.channel)} aria-label="Initiative channel"><option value="ACTION">Action</option><option value="DIALOGUE">Dialogue</option><option value="WHISPER">Whisper</option><option value="THOUGHT">Thought</option></select><Input type="number" min={0} max={10000} value={panel.storyEventDraft.afterTurns} onChange={(event) => panel.updateStoryEventDraft("afterTurns", Number(event.target.value))} aria-label="Turns until event" /></div>
          <Button type="submit"><CalendarClock className="h-4 w-4" />Schedule initiative</Button>
        </form>
        {pendingEvents.map((event) => <article key={event.id} className="flex items-start justify-between gap-3 border-b border-[var(--border-default)] pb-3"><div><p className="text-sm text-[var(--text-primary)]">{event.title}</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{event.actorParticipant?.displayName ?? "The world"} · {event.status.toLowerCase()} · due turn {event.dueSequence ?? "time trigger"}</p></div><button type="button" onClick={() => void panel.updateStoryNarrativeItem("event", event.id, { eventStatus: "CANCELLED" })} className="focus-ring text-xs text-[var(--text-muted)] hover:text-[var(--danger)]">Cancel</button></article>)}
      </section>

      {panel.storyNarrativeStatus ? <PanelStatusText>{panel.storyNarrativeStatus}</PanelStatusText> : null}
    </div>
  );
}

export function CanonTabContent({ panel }: { panel: PanelState }) {
  const draft = panel.canonDraft;
  const knowledgeParticipants = panel.storyParticipants.filter((participant) => participant.role === "CHARACTER" || participant.role === "NPC");
  const scopedKnowledge = draft.scope === "CHARACTER" || draft.scope === "PARTICIPANT";

  return (
    <div className="grid gap-5">
      <form onSubmit={panel.addCanonFact} className="grid gap-3 border-b border-[var(--border-default)] pb-5">
        <p className="codex-kicker">New canonical fact</p>
        <select value={draft.subjectEntityId} onChange={(event) => panel.updateCanonDraft("subjectEntityId", event.target.value)} className="focus-ring h-11 w-full border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)]" aria-label="Canon subject">
          <option value="">The story in general</option>
          {panel.storyEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
        </select>
        <Input value={draft.predicate} onChange={(event) => panel.updateCanonDraft("predicate", event.target.value)} placeholder="Fact type, e.g. carries or promised" required />
        <Textarea value={draft.objectText} onChange={(event) => panel.updateCanonDraft("objectText", event.target.value)} placeholder="What is true in this timeline?" className="min-h-24" required />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <select value={draft.scope} onChange={(event) => panel.updateCanonDraft("scope", event.target.value as typeof draft.scope)} className="focus-ring h-11 min-w-0 border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)]" aria-label="Canon visibility">
            <option value="STORY">Known in the story</option>
            <option value="CHARACTER">Known by selected cast</option>
            <option value="OWNER">Director only</option>
          </select>
          <button type="button" onClick={() => panel.updateCanonDraft("locked", !draft.locked)} className={cn("focus-ring inline-flex h-11 items-center gap-2 border px-3 text-xs uppercase tracking-[.12em]", draft.locked ? "border-[var(--accent-mint)] text-[var(--accent-mint)]" : "border-[var(--border-default)] text-[var(--text-muted)]")} aria-pressed={draft.locked}>
            {draft.locked ? <LockKeyhole className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
            Lock
          </button>
        </div>
        {scopedKnowledge ? (
          <fieldset className="grid gap-2 border border-[var(--border-default)] p-3">
            <legend className="codex-kicker px-1">Who knows this</legend>
            {knowledgeParticipants.map((participant) => (
              <label key={participant.id} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input type="checkbox" checked={draft.participantIds.includes(participant.id)} onChange={() => panel.toggleCanonKnowledge(participant.id)} />
                <span>{participant.displayName}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        <Button type="submit" disabled={!panel.storyId || !draft.predicate.trim() || !draft.objectText.trim()}>
          <Plus className="h-4 w-4" />
          Add to canon
        </Button>
      </form>

      {panel.canonStatus ? <PanelStatusText>{panel.canonStatus}</PanelStatusText> : null}
      <div className="grid border-t border-[var(--border-default)]">
        {panel.canonFacts.map((fact) => (
          <article key={fact.id} className="grid gap-2 border-b border-[var(--border-default)] py-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[.12em] text-[var(--text-muted)]">{fact.subjectEntity?.name ?? "Story"} · {fact.predicate}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-primary)]">{fact.objectText}</p>
              </div>
              <button type="button" onClick={() => void panel.updateCanonFact(fact.id, { locked: !fact.locked })} className={cn("focus-ring grid h-8 w-8 shrink-0 place-items-center", fact.locked ? "text-[var(--accent-mint)]" : "text-[var(--text-muted)]")} aria-label={fact.locked ? "Unlock canon fact" : "Lock canon fact"}>
                {fact.locked ? <LockKeyhole className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={() => void panel.updateCanonFact(fact.id, { status: "RETRACTED" })} className="focus-ring grid h-8 w-8 shrink-0 place-items-center text-[var(--text-muted)] hover:text-[var(--danger)]" aria-label="Retract canon fact">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] uppercase tracking-[.1em] text-[var(--text-muted)]">
              {fact.scope === "OWNER" ? "Director only" : fact.knowledge.length > 0 ? `Known by ${fact.knowledge.map((entry) => entry.participant.displayName).join(", ")}` : "Shared canon"}
              {fact.sourceMessage ? " · linked to source message" : " · manually recorded"}
            </p>
          </article>
        ))}
        {panel.canonFacts.length === 0 ? <PanelStatusText>No canon facts yet. Record the first truth that must survive every turn.</PanelStatusText> : null}
      </div>
    </div>
  );
}

function SceneListField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2">
      <span className="codex-kicker">{label}</span>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="One item per line" className="min-h-20" />
    </label>
  );
}

export function HistoryTabContent({
  panel,
  chatId,
  onNavigate,
  onNewChat
}: {
  panel: PanelState;
  chatId: string;
  onNavigate?: () => void;
  onNewChat?: () => void;
}) {
  return (
    <div className="grid gap-5">
      {panel.storyId ? (
        <section className="grid gap-3 border-b border-[var(--border-default)] pb-5">
          <NarrativeHeading icon={Download} title="Story package" subtitle="Portable canon, state, plot, cast, and manuscript" />
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline"><a href={`/api/stories/${panel.storyId}/export?format=json`} download><FileJson className="h-4 w-4" />JSON</a></Button>
            <Button asChild variant="outline"><a href={`/api/stories/${panel.storyId}/export?format=markdown`} download><Download className="h-4 w-4" />Markdown</a></Button>
          </div>
          <p className="text-xs leading-5 text-[var(--text-muted)]">Private exports include director notes and checkpoints. Public share links omit director-only canon and inner conflict.</p>
        </section>
      ) : null}
      <div className="grid gap-2">
      {onNewChat ? (
        <Button
          type="button"
          onClick={onNewChat}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          Start new chat
        </Button>
      ) : null}
      {panel.chats.map((chat) => (
        <Link
          key={chat.id}
          href={`/chat/${chat.id}`}
          onClick={onNavigate}
          className={cn(
            "flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 no-underline transition-colors hover:bg-[var(--bg-elevated)]",
            chat.id === chatId && "border-[var(--border-strong)] bg-[var(--accent-purple-soft)]"
          )}
        >
          <Avatar name={chat.character.name} src={chat.character.avatarUrl} size="xs" />
          <div className="min-w-0 flex-1">
            <p className="block truncate text-sm font-medium text-[var(--text-primary)]">{chat.character.name}</p>
            <p className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{toChatPreview(chat.messages[0]?.content || chat.character.description || "Continue chat")}</p>
          </div>
        </Link>
      ))}
      {panel.chats.length === 0 ? <PanelStatusText>No chat history yet.</PanelStatusText> : null}
      </div>
    </div>
  );
}

function NarrativeHeading({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center border border-[var(--border-default)] text-[var(--accent-mint)]"><Icon className="h-4 w-4" /></div>
      <div><p className="codex-kicker">{title}</p><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{subtitle}</p></div>
    </div>
  );
}

function RangeField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return (
    <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
      <span>{label}</span><span className="tabular-nums text-[var(--text-primary)]">{value}</span>
      <input className="col-span-2 w-full accent-[var(--accent-mint)]" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function PanelStatusText({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-sm leading-5 text-[var(--text-secondary)] shadow-[var(--glass-highlight)]">
      {children}
    </p>
  );
}
