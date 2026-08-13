"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { parsePersonaLines } from "@/lib/user-persona-profiles";

export type PersonaProfile = {
  id: string;
  label: string;
  displayName: string;
  avatarUrl?: string | null;
  summary: string;
  background?: string | null;
  traits: string[];
  likes: string[];
  dislikes: string[];
  boundaries: string[];
  isDefault: boolean;
  visibility: "PRIVATE" | "PUBLIC" | "UNLISTED";
};

export type PersonaDraft = {
  profileId?: string;
  label: string;
  displayName: string;
  avatarUrl: string;
  summary: string;
  background: string;
  traits: string;
  likes: string;
  dislikes: string;
  boundaries: string;
};

export type MemoryRow = {
  id: string;
  content: string;
  category: string;
  pinned: boolean;
  status?: "PENDING" | "ACTIVE" | "REJECTED";
  character?: { name: string } | null;
};

export type ChatPreview = {
  id: string;
  title?: string | null;
  lastActiveAt?: string;
  createdAt?: string;
  character: {
    id: string;
    name: string;
    description?: string | null;
    avatarUrl?: string | null;
  };
  messages: Array<{ content: string }>;
};

export type StoryParticipantRow = {
  id: string;
  displayName: string;
  role: "OWNER" | "PLAYER" | "CHARACTER" | "NPC" | "OBSERVER";
  characterId?: string | null;
};

export type StoryEntityRow = {
  id: string;
  name: string;
  type: string;
  locked: boolean;
};

export type StoryFactRow = {
  id: string;
  predicate: string;
  objectText: string;
  scope: "STORY" | "PARTICIPANT" | "CHARACTER" | "OWNER";
  locked: boolean;
  importance: number;
  subjectEntity?: { id: string; name: string; type: string } | null;
  sourceMessage?: { id: string; content: string; createdAt: string } | null;
  knowledge: Array<{
    state: "KNOWN" | "SUSPECTED" | "FORGOTTEN";
    participant: StoryParticipantRow;
  }>;
};

export type StoryStateDraft = {
  time: string;
  location: string;
  weather: string;
  inventory: string;
  conditions: string;
  threats: string;
  notes: string;
};

export type CanonDraft = {
  subjectEntityId: string;
  predicate: string;
  objectText: string;
  scope: StoryFactRow["scope"];
  locked: boolean;
  participantIds: string[];
};

export type StoryDirectorDraft = {
  tone: string;
  pacing: "SLOW" | "BALANCED" | "FAST";
  initiative: "REACTIVE" | "BALANCED" | "PROACTIVE";
  conflictLevel: number;
  romanceLevel: number;
  mysteryLevel: number;
  humorLevel: number;
  allowOffscreenEvents: boolean;
  notes: string;
};

export type StoryArcRow = {
  id: string;
  title: string;
  premise: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "ABANDONED";
  priority: number;
  progress: number;
};

export type StoryBeatRow = {
  id: string;
  arcId?: string | null;
  title: string;
  description: string;
  status: "PLANNED" | "READY" | "COMPLETED" | "SKIPPED";
  position: number;
  priority: number;
};

export type StoryHookRow = {
  id: string;
  arcId?: string | null;
  title: string;
  description: string;
  payoff?: string | null;
  status: "OPEN" | "ESCALATED" | "RESOLVED" | "DROPPED";
  urgency: number;
  directorOnly: boolean;
};

export type StoryRelationshipRow = {
  id: string;
  label?: string | null;
  trust: number;
  affection: number;
  tension: number;
  respect: number;
  notes?: string | null;
  fromParticipant: StoryParticipantRow;
  toParticipant: StoryParticipantRow;
  revisions?: Array<{ id: string; trust: number; affection: number; tension: number; respect: number; createdAt: string }>;
};

export type StoryProactiveEventRow = {
  id: string;
  title: string;
  instruction: string;
  status: "SCHEDULED" | "READY" | "FIRED" | "CANCELLED";
  channel: "DIALOGUE" | "ACTION" | "THOUGHT" | "WHISPER" | "OOC" | "SYSTEM";
  priority: number;
  dueSequence?: number | null;
  actorParticipant?: StoryParticipantRow | null;
};

export type StoryArcDraft = { title: string; premise: string };
export type StoryBeatDraft = { arcId: string; title: string; description: string; status: "PLANNED" | "READY" };
export type StoryHookDraft = { arcId: string; title: string; description: string; urgency: number; directorOnly: boolean };
export type StoryRelationshipDraft = { fromParticipantId: string; toParticipantId: string; label: string; trust: number; affection: number; tension: number; respect: number; notes: string };
export type StoryEventDraft = { actorParticipantId: string; title: string; instruction: string; channel: StoryProactiveEventRow["channel"]; afterTurns: number; triggerAt: string };

export type StoryParticipantStateRow = {
  id: string;
  participantId: string;
  displayNameOverride?: string | null;
  pronouns?: string | null;
  currentMood?: string | null;
  appearance?: string | null;
  currentGoal?: string | null;
  innerConflict?: string | null;
  voiceStyle?: string | null;
  speakingStyle?: string | null;
  participant: StoryParticipantRow;
};

export type StoryVoiceBindingRow = {
  id: string;
  participantId: string;
  provider: "elevenlabs" | "playht";
  voiceId: string;
  style?: string | null;
  speed: number;
  pitch: number;
  autoPlay: boolean;
  participant: StoryParticipantRow;
};

export type StoryVisualReferenceRow = {
  id: string;
  kind: "PORTRAIT" | "OUTFIT" | "LOCATION" | "ITEM" | "MOODBOARD" | "OTHER";
  title: string;
  imageUrl?: string | null;
  prompt?: string | null;
  notes?: string | null;
  locked: boolean;
  participant?: StoryParticipantRow | null;
  entity?: StoryEntityRow | null;
};

export type StoryCheckpointRow = {
  id: string;
  kind: "MANUAL" | "AUTO" | "BOOKMARK";
  title: string;
  summary: string;
  openThreads: string[];
  stateVersion: number;
  createdAt: string;
};

export type StoryCastStateDraft = { displayNameOverride: string; pronouns: string; currentMood: string; appearance: string; currentGoal: string; innerConflict: string; voiceStyle: string; speakingStyle: string };
export type StoryVoiceDraft = { provider: "elevenlabs" | "playht"; voiceId: string; style: string; speed: number; pitch: number; autoPlay: boolean };
export type StoryVisualDraft = { participantId: string; entityId: string; visualKind: StoryVisualReferenceRow["kind"]; title: string; imageUrl: string; prompt: string; notes: string; locked: boolean };
export type StoryCheckpointDraft = { title: string; summary: string; openThreads: string };
export type StorySafetyDraft = { contentRating: "GENERAL" | "TEEN" | "MATURE"; hardLimits: string; softLimits: string; fadeToBlack: string; checkInInterval: number; paused: boolean; notes: string };

export const emptyPersonaDraft: PersonaDraft = {
  label: "",
  displayName: "",
  avatarUrl: "",
  summary: "",
  background: "",
  traits: "",
  likes: "",
  dislikes: "",
  boundaries: ""
};

export const emptyStoryStateDraft: StoryStateDraft = {
  time: "",
  location: "",
  weather: "",
  inventory: "",
  conditions: "",
  threats: "",
  notes: ""
};

export const emptyCanonDraft: CanonDraft = {
  subjectEntityId: "",
  predicate: "is true now",
  objectText: "",
  scope: "STORY",
  locked: false,
  participantIds: []
};

export const defaultStoryDirectorDraft: StoryDirectorDraft = {
  tone: "",
  pacing: "BALANCED",
  initiative: "BALANCED",
  conflictLevel: 5,
  romanceLevel: 3,
  mysteryLevel: 5,
  humorLevel: 3,
  allowOffscreenEvents: true,
  notes: ""
};

export const emptyStoryArcDraft: StoryArcDraft = { title: "", premise: "" };
export const emptyStoryBeatDraft: StoryBeatDraft = { arcId: "", title: "", description: "", status: "PLANNED" };
export const emptyStoryHookDraft: StoryHookDraft = { arcId: "", title: "", description: "", urgency: 3, directorOnly: false };
export const emptyStoryRelationshipDraft: StoryRelationshipDraft = { fromParticipantId: "", toParticipantId: "", label: "", trust: 0, affection: 0, tension: 0, respect: 0, notes: "" };
export const emptyStoryEventDraft: StoryEventDraft = { actorParticipantId: "", title: "", instruction: "", channel: "ACTION", afterTurns: 0, triggerAt: "" };
export const emptyStoryCastStateDraft: StoryCastStateDraft = { displayNameOverride: "", pronouns: "", currentMood: "", appearance: "", currentGoal: "", innerConflict: "", voiceStyle: "", speakingStyle: "" };
export const emptyStoryVoiceDraft: StoryVoiceDraft = { provider: "elevenlabs", voiceId: "", style: "", speed: 1, pitch: 0, autoPlay: false };
export const emptyStoryVisualDraft: StoryVisualDraft = { participantId: "", entityId: "", visualKind: "PORTRAIT", title: "", imageUrl: "", prompt: "", notes: "", locked: true };
export const emptyStoryCheckpointDraft: StoryCheckpointDraft = { title: "", summary: "", openThreads: "" };
export const defaultStorySafetyDraft: StorySafetyDraft = { contentRating: "MATURE", hardLimits: "", softLimits: "", fadeToBlack: "", checkInInterval: 0, paused: false, notes: "" };

type UseChatQuickPanelOptions = {
  chatId?: string | null;
  characterId?: string | null;
  enabled?: boolean;
};

export function useChatQuickPanel({ chatId, characterId, enabled = true }: UseChatQuickPanelOptions) {
  const [profiles, setProfiles] = useState<PersonaProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [temporaryProfileId, setTemporaryProfileId] = useState<string | null>(null);
  const [characterDefaultProfileId, setCharacterDefaultProfileId] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<PersonaProfile | null>(null);
  const [draft, setDraft] = useState<PersonaDraft>(emptyPersonaDraft);
  const [personaStatus, setPersonaStatus] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryStatus, setMemoryStatus] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [memoryEditingId, setMemoryEditingId] = useState<string | null>(null);
  const [memoryEditDraft, setMemoryEditDraft] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [panelLoadStatus, setPanelLoadStatus] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [storyTimelineId, setStoryTimelineId] = useState<string | null>(null);
  const [storyParticipants, setStoryParticipants] = useState<StoryParticipantRow[]>([]);
  const [storyEntities, setStoryEntities] = useState<StoryEntityRow[]>([]);
  const [canonFacts, setCanonFacts] = useState<StoryFactRow[]>([]);
  const [canonDraft, setCanonDraft] = useState<CanonDraft>(emptyCanonDraft);
  const [canonStatus, setCanonStatus] = useState<string | null>(null);
  const [storyStateDraft, setStoryStateDraft] = useState<StoryStateDraft>(emptyStoryStateDraft);
  const [storyStateStatus, setStoryStateStatus] = useState<string | null>(null);
  const [storyDirectorDraft, setStoryDirectorDraft] = useState<StoryDirectorDraft>(defaultStoryDirectorDraft);
  const [storyArcs, setStoryArcs] = useState<StoryArcRow[]>([]);
  const [storyBeats, setStoryBeats] = useState<StoryBeatRow[]>([]);
  const [storyHooks, setStoryHooks] = useState<StoryHookRow[]>([]);
  const [storyRelationships, setStoryRelationships] = useState<StoryRelationshipRow[]>([]);
  const [storyProactiveEvents, setStoryProactiveEvents] = useState<StoryProactiveEventRow[]>([]);
  const [storyArcDraft, setStoryArcDraft] = useState<StoryArcDraft>(emptyStoryArcDraft);
  const [storyBeatDraft, setStoryBeatDraft] = useState<StoryBeatDraft>(emptyStoryBeatDraft);
  const [storyHookDraft, setStoryHookDraft] = useState<StoryHookDraft>(emptyStoryHookDraft);
  const [storyRelationshipDraft, setStoryRelationshipDraft] = useState<StoryRelationshipDraft>(emptyStoryRelationshipDraft);
  const [storyEventDraft, setStoryEventDraft] = useState<StoryEventDraft>(emptyStoryEventDraft);
  const [storyNarrativeStatus, setStoryNarrativeStatus] = useState<string | null>(null);
  const [storyParticipantStates, setStoryParticipantStates] = useState<StoryParticipantStateRow[]>([]);
  const [storyVoiceBindings, setStoryVoiceBindings] = useState<StoryVoiceBindingRow[]>([]);
  const [storyVisualReferences, setStoryVisualReferences] = useState<StoryVisualReferenceRow[]>([]);
  const [storyCheckpoints, setStoryCheckpoints] = useState<StoryCheckpointRow[]>([]);
  const [castParticipantId, setCastParticipantId] = useState("");
  const castParticipantIdRef = useRef("");
  const [storyCastStateDraft, setStoryCastStateDraft] = useState<StoryCastStateDraft>(emptyStoryCastStateDraft);
  const [storyVoiceDraft, setStoryVoiceDraft] = useState<StoryVoiceDraft>(emptyStoryVoiceDraft);
  const [storyVisualDraft, setStoryVisualDraft] = useState<StoryVisualDraft>(emptyStoryVisualDraft);
  const [storyCheckpointDraft, setStoryCheckpointDraft] = useState<StoryCheckpointDraft>(emptyStoryCheckpointDraft);
  const [storyContinuityStatus, setStoryContinuityStatus] = useState<string | null>(null);
  const [storySafetyDraft, setStorySafetyDraft] = useState<StorySafetyDraft>(defaultStorySafetyDraft);
  const [storySafetyStatus, setStorySafetyStatus] = useState<string | null>(null);
  const [contextRevision, setContextRevision] = useState(0);

  useEffect(() => {
    const refresh = (event: Event) => {
      const updatedChatId = (event as CustomEvent<{ chatId?: string }>).detail?.chatId;
      if (!updatedChatId || updatedChatId === chatId) {
        setContextRevision((current) => current + 1);
      }
    };

    window.addEventListener("nythera:chat-context-updated", refresh);
    return () => window.removeEventListener("nythera:chat-context-updated", refresh);
  }, [chatId]);

  async function performWrite(
    action: string,
    url: string,
    init: RequestInit,
    setStatus: (message: string | null) => void,
    fallback: string
  ) {
    setPendingAction(action);
    setStatus(null);
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        setStatus(await safeResponseError(response, fallback));
        return null;
      }
      setLastSavedAt(Date.now());
      return response;
    } catch {
      setStatus("Network error. Your draft was kept; try again.");
      return null;
    } finally {
      setPendingAction(null);
    }
  }

  const applyStoryNarrative = useCallback((body: Record<string, unknown>) => {
    const director = body.director && typeof body.director === "object" ? body.director as Record<string, unknown> : {};
    setStoryDirectorDraft({
      tone: typeof director.tone === "string" ? director.tone : "",
      pacing: director.pacing === "SLOW" || director.pacing === "FAST" ? director.pacing : "BALANCED",
      initiative: director.initiative === "REACTIVE" || director.initiative === "PROACTIVE" ? director.initiative : "BALANCED",
      conflictLevel: numberOr(director.conflictLevel, 5),
      romanceLevel: numberOr(director.romanceLevel, 3),
      mysteryLevel: numberOr(director.mysteryLevel, 5),
      humorLevel: numberOr(director.humorLevel, 3),
      allowOffscreenEvents: director.allowOffscreenEvents !== false,
      notes: typeof director.notes === "string" ? director.notes : ""
    });
    if (Array.isArray(body.participants) && body.participants.length > 0) {
      setStoryParticipants(body.participants as StoryParticipantRow[]);
    }
    setStoryArcs(Array.isArray(body.arcs) ? body.arcs as StoryArcRow[] : []);
    setStoryBeats(Array.isArray(body.beats) ? body.beats as StoryBeatRow[] : []);
    setStoryHooks(Array.isArray(body.hooks) ? body.hooks as StoryHookRow[] : []);
    setStoryRelationships(Array.isArray(body.relationships) ? body.relationships as StoryRelationshipRow[] : []);
    setStoryProactiveEvents(Array.isArray(body.proactiveEvents) ? body.proactiveEvents as StoryProactiveEventRow[] : []);
  }, []);

  const loadStoryNarrative = useCallback(async (storyIdValue: string, timelineIdValue?: string | null, signal?: AbortSignal) => {
    const timelineQuery = timelineIdValue ? `?timelineId=${encodeURIComponent(timelineIdValue)}` : "";
    const response = await fetch(`/api/stories/${storyIdValue}/narrative${timelineQuery}`, { cache: "no-store", signal });
    if (!response.ok) {
      throw new Error(await safeResponseError(response, "Could not load story direction."));
    }
    applyStoryNarrative(await response.json());
  }, [applyStoryNarrative]);

  const applyStoryContinuity = useCallback((body: Record<string, unknown>) => {
    const participants = Array.isArray(body.participants) ? body.participants as StoryParticipantRow[] : [];
    const states = Array.isArray(body.states) ? body.states as StoryParticipantStateRow[] : [];
    const bindings = Array.isArray(body.voiceBindings) ? body.voiceBindings as StoryVoiceBindingRow[] : [];
    setStoryParticipantStates(states);
    setStoryVoiceBindings(bindings);
    setStoryVisualReferences(Array.isArray(body.visualReferences) ? body.visualReferences as StoryVisualReferenceRow[] : []);
    setStoryCheckpoints(Array.isArray(body.checkpoints) ? body.checkpoints as StoryCheckpointRow[] : []);
    const selected = participants.find((participant) => participant.id === castParticipantIdRef.current)
      ?? participants.find((participant) => participant.role === "CHARACTER" || participant.role === "NPC")
      ?? participants[0];
    if (selected) {
      castParticipantIdRef.current = selected.id;
      setCastParticipantId(selected.id);
      const state = states.find((entry) => entry.participantId === selected.id);
      const binding = bindings.find((entry) => entry.participantId === selected.id);
      setStoryCastStateDraft(stateToCastDraft(state));
      setStoryVoiceDraft(bindingToVoiceDraft(binding));
      setStoryVisualDraft((current) => ({ ...current, participantId: current.participantId || selected.id }));
    }
  }, []);

  const loadStoryContinuity = useCallback(async (storyIdValue: string, timelineIdValue?: string | null, signal?: AbortSignal) => {
    const timelineQuery = timelineIdValue ? `?timelineId=${encodeURIComponent(timelineIdValue)}` : "";
    const response = await fetch(`/api/stories/${storyIdValue}/continuity${timelineQuery}`, { cache: "no-store", signal });
    if (!response.ok) {
      throw new Error(await safeResponseError(response, "Could not load story continuity."));
    }
    applyStoryContinuity(await response.json());
  }, [applyStoryContinuity]);

  const loadStorySafety = useCallback(async (storyIdValue: string, signal?: AbortSignal) => {
    const response = await fetch(`/api/stories/${storyIdValue}/safety`, { cache: "no-store", signal });
    if (!response.ok) {
      throw new Error(await safeResponseError(response, "Could not load session safety."));
    }
    const body = await response.json();
    const safety = body.safety && typeof body.safety === "object" ? body.safety as Record<string, unknown> : null;
    setStorySafetyDraft(safety ? {
      contentRating: safety.contentRating === "GENERAL" || safety.contentRating === "TEEN" ? safety.contentRating : "MATURE",
      hardLimits: listToText(safety.hardLimits),
      softLimits: listToText(safety.softLimits),
      fadeToBlack: listToText(safety.fadeToBlack),
      checkInInterval: numberOr(safety.checkInInterval, 0),
      paused: safety.paused === true,
      notes: typeof safety.notes === "string" ? safety.notes : ""
    } : defaultStorySafetyDraft);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    async function loadInitialData() {
      setPanelLoadStatus(null);
      const memoryParams = new URLSearchParams({ take: "8" });
      if (characterId) {
        memoryParams.set("characterId", characterId);
      }

      const personaParams = new URLSearchParams();
      if (chatId) {
        personaParams.set("chatId", chatId);
      }

      const [personaResponse, memoriesResponse, chatsResponse, storyResponse] = await Promise.allSettled([
        fetch(`/api/user-persona?${personaParams.toString()}`, { cache: "no-store", signal }),
        fetch(`/api/memories?${memoryParams.toString()}`, { cache: "no-store", signal }),
        fetch(characterId ? `/api/chats?characterId=${encodeURIComponent(characterId)}` : "/api/chats", { cache: "no-store", signal }),
        chatId
          ? fetch("/api/stories/resolve", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ chatId }),
              signal
            })
          : Promise.resolve(null)
      ]);

      if (personaResponse.status === "fulfilled" && personaResponse.value.ok) {
        const body = await personaResponse.value.json();
        const nextProfiles = Array.isArray(body.profiles) ? body.profiles.map(profileFromApi) : [];
        const active = body.activeProfile ? profileFromApi(body.activeProfile) : nextProfiles[0] ?? null;
        setProfiles(nextProfiles);
        setActiveProfileId(body.activeProfileId ?? nextProfiles[0]?.id ?? null);
        setTemporaryProfileId(body.temporaryProfileId ?? null);
        setCharacterDefaultProfileId(body.characterDefaultProfileId ?? null);
        setActivePersona(active);
        if (body.activeProfile) {
          setDraft(profileToDraft(body.activeProfile));
        }
      }

      if (memoriesResponse.status === "fulfilled" && memoriesResponse.value.ok) {
        const body = await memoriesResponse.value.json();
        setMemories(Array.isArray(body.memories) ? body.memories : []);
      }

      if (chatsResponse.status === "fulfilled" && chatsResponse.value.ok) {
        const body = await chatsResponse.value.json();
        setChats(Array.isArray(body.chats) ? body.chats : []);
      }

      if (storyResponse.status === "fulfilled" && storyResponse.value?.ok) {
        const body = await storyResponse.value.json();
        applyStoryCodex(body);
        const foundation = body.foundation && typeof body.foundation === "object" ? body.foundation as Record<string, unknown> : null;
        const resolvedStoryId = String(foundation?.storyId ?? "");
        const resolvedTimelineId = String(foundation?.timelineId ?? "");
        if (resolvedStoryId) {
          await Promise.all([
            loadStoryNarrative(resolvedStoryId, resolvedTimelineId || null, signal),
            loadStoryContinuity(resolvedStoryId, resolvedTimelineId || null, signal),
            loadStorySafety(resolvedStoryId, signal)
          ]);
        }
      }

      const failedResponse = [personaResponse, memoriesResponse, chatsResponse, storyResponse].find(
        (result) => result.status === "rejected" || (result.value instanceof Response && !result.value.ok)
      );
      if (failedResponse) {
        if (failedResponse.status === "rejected") {
          throw failedResponse.reason;
        }
        throw new Error(await safeResponseError(failedResponse.value as Response, "Could not load part of Story context."));
      }
    }

    void loadInitialData().catch((error) => {
      if (!signal.aborted) {
        setPanelLoadStatus(error instanceof Error ? error.message : "Could not load Story context.");
      }
    });

    return () => controller.abort();
  }, [chatId, characterId, contextRevision, enabled, loadStoryContinuity, loadStoryNarrative, loadStorySafety]);

  async function loadMemories(signal?: AbortSignal) {
    const params = new URLSearchParams({ take: "8" });
    if (characterId) {
      params.set("characterId", characterId);
    }

    const response = await fetch(`/api/memories?${params.toString()}`, { cache: "no-store", signal });
    if (!response.ok) {
      throw new Error(await safeResponseError(response, "Could not load memories."));
    }

    const body = await response.json();
    setMemories(Array.isArray(body.memories) ? body.memories : []);
  }

  function applyStoryCodex(body: Record<string, unknown>) {
    const foundation = body.foundation && typeof body.foundation === "object" ? body.foundation as Record<string, unknown> : null;
    const story = body.story && typeof body.story === "object" ? body.story as Record<string, unknown> : null;
    const timeline = body.timeline && typeof body.timeline === "object" ? body.timeline as Record<string, unknown> : null;
    const snapshot = body.snapshot && typeof body.snapshot === "object" ? body.snapshot as Record<string, unknown> : null;
    setStoryId(String(foundation?.storyId ?? story?.id ?? "") || null);
    setStoryTimelineId(String(foundation?.timelineId ?? timeline?.id ?? "") || null);
    setStoryParticipants(Array.isArray(story?.participants) ? story.participants as StoryParticipantRow[] : []);
    setStoryEntities(Array.isArray(story?.entities) ? story.entities as StoryEntityRow[] : []);
    setCanonFacts(Array.isArray(body.facts) ? body.facts as StoryFactRow[] : []);
    const state = snapshot?.state && typeof snapshot.state === "object" ? snapshot.state as Record<string, unknown> : {};
    setStoryStateDraft({
      time: typeof state.time === "string" ? state.time : "",
      location: typeof state.location === "string" ? state.location : "",
      weather: typeof state.weather === "string" ? state.weather : "",
      inventory: listToText(state.inventory),
      conditions: listToText(state.conditions),
      threats: listToText(state.threats),
      notes: listToText(state.notes)
    });
  }

  async function loadStoryCodex() {
    if (!storyId) {
      return;
    }
    const timelineQuery = storyTimelineId ? `?timelineId=${encodeURIComponent(storyTimelineId)}` : "";
    const response = await fetch(`/api/stories/${storyId}/canon${timelineQuery}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await safeResponseError(response, "Could not refresh canon."));
    }
    applyStoryCodex({ ...(await response.json()), foundation: { storyId, timelineId: storyTimelineId } });
  }

  function updateDraft<K extends keyof PersonaDraft>(field: K, value: PersonaDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function pickAvatar(dataUrl: string) {
    updateDraft("avatarUrl", dataUrl);
    setPersonaStatus(null);
  }

  function setAvatarPickError(message: string) {
    setPersonaStatus(message);
  }

  function setAvatarUploadingState(uploading: boolean) {
    setAvatarUploading(uploading);
  }

  async function switchPersona(profile: PersonaProfile) {
    setActiveProfileId(profile.id);
    setActivePersona(profile);
    setDraft(profileToDraft(profile));
    setPersonaStatus(null);

    const response = await performWrite("persona:switch", "/api/user-persona", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
        body: JSON.stringify({
          activeProfileId: profile.id,
          ...(chatId ? { chatId } : {})
        })
    }, setPersonaStatus, "Could not switch persona.");

    if (response) {
      setPersonaStatus("Active persona updated.");
      window.dispatchEvent(new CustomEvent("nythera:persona-updated"));
    }
  }

  async function usePersonaOnce(profile: PersonaProfile) {
    if (!chatId) return;
    const response = await performWrite("persona:temporary", "/api/user-persona", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ activeProfileId: profile.id, chatId, temporary: true })
    }, setPersonaStatus, "Could not set the temporary persona.");
    if (!response) return;
    setTemporaryProfileId(profile.id);
    setPersonaStatus(`${profile.displayName} will be used for the next reply only.`);
  }

  async function setCharacterDefault(profile: PersonaProfile) {
    if (!characterId) return;
    const nextProfileId = characterDefaultProfileId === profile.id ? null : profile.id;
    const response = await performWrite("persona:character-default", "/api/user-persona", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ characterId, characterDefaultProfileId: nextProfileId })
    }, setPersonaStatus, "Could not update this character's default persona.");
    if (!response) return;
    setCharacterDefaultProfileId(nextProfileId);
    setPersonaStatus(nextProfileId ? `${profile.displayName} is now the default for this character.` : "Character-specific default removed.");
  }

  async function savePersona(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.displayName.trim() || !draft.summary.trim()) {
      return;
    }

    const response = await performWrite("persona:save", "/api/user-persona", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileId: draft.profileId,
        label: draft.label || draft.displayName,
        displayName: draft.displayName,
        avatarUrl: draft.avatarUrl,
        summary: draft.summary,
        background: draft.background,
        traits: parsePersonaLines(draft.traits),
        likes: parsePersonaLines(draft.likes),
        dislikes: parsePersonaLines(draft.dislikes),
        boundaries: parsePersonaLines(draft.boundaries),
        visibility: "PRIVATE",
        ...(chatId ? { chatId } : {})
      })
    }, setPersonaStatus, "Could not save persona.");

    if (!response) {
      return;
    }

    const body = await response.json();
    const nextActive = body.activeProfile ? profileFromApi(body.activeProfile) : null;
    setPersonaStatus("Persona saved for the next message.");
    setProfiles(Array.isArray(body.profiles) ? body.profiles.map(profileFromApi) : []);
    setActiveProfileId(body.activeProfileId ?? null);
    setActivePersona(nextActive);
    if (body.activeProfile) {
      setDraft(profileToDraft(body.activeProfile));
    }
    window.dispatchEvent(new CustomEvent("nythera:persona-updated"));
  }

  async function addMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memoryDraft.trim()) {
      return;
    }

    const response = await performWrite("memory:add", "/api/memories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: memoryDraft,
        characterId: characterId ?? null,
        category: "FACT",
        importance: 2,
        pinned: true
      })
    }, setMemoryStatus, "Could not save memory.");
    if (!response) {
      return;
    }

    const body = await response.json();
    if (body.memory?.id) {
      setMemories((current) => [body.memory as MemoryRow, ...current.filter((memory) => memory.id !== body.memory.id)]);
    }
    setMemoryDraft("");
    setMemoryStatus("Pinned memory saved for every chat with this character.");
    await loadMemories().catch((error) => setMemoryStatus(error instanceof Error ? error.message : "Memory saved, but the list could not refresh."));
  }

  function startEditingMemory(memory: MemoryRow) {
    setMemoryEditingId(memory.id);
    setMemoryEditDraft(memory.content);
    setMemoryStatus(null);
  }

  function cancelEditingMemory() {
    setMemoryEditingId(null);
    setMemoryEditDraft("");
  }

  async function saveMemory(memoryId: string) {
    const content = memoryEditDraft.trim();
    if (!content) {
      setMemoryStatus("Memory fact cannot be empty.");
      return;
    }
    const response = await performWrite(`memory:edit:${memoryId}`, `/api/memories?id=${encodeURIComponent(memoryId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, pinned: true })
    }, setMemoryStatus, "Could not update memory.");
    if (!response) {
      return;
    }
    const body = await response.json();
    if (body.memory?.id) {
      setMemories((current) => current.map((memory) => memory.id === memoryId ? { ...memory, ...body.memory } : memory));
    }
    cancelEditingMemory();
    setMemoryStatus("Memory updated for every chat with this character.");
    await loadMemories().catch((error) => setMemoryStatus(error instanceof Error ? error.message : "Memory updated, but the list could not refresh."));
  }

  async function removeMemory(memoryId: string) {
    const response = await performWrite(`memory:delete:${memoryId}`, `/api/memories?id=${encodeURIComponent(memoryId)}`, { method: "DELETE" }, setMemoryStatus, "Could not delete memory.");
    if (!response) {
      return;
    }
    if (memoryEditingId === memoryId) {
      cancelEditingMemory();
    }
    setMemories((current) => current.filter((memory) => memory.id !== memoryId));
    setMemoryStatus("Memory removed from character context.");
    await loadMemories().catch((error) => setMemoryStatus(error instanceof Error ? error.message : "Memory removed, but the list could not refresh."));
  }

  async function reviewMemory(memoryId: string, status: "ACTIVE" | "REJECTED") {
    const response = await performWrite(`memory:review:${memoryId}`, `/api/memories?id=${encodeURIComponent(memoryId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    }, setMemoryStatus, "Could not review memory.");
    if (!response) return;
    if (status === "REJECTED") setMemories((current) => current.filter((memory) => memory.id !== memoryId));
    else setMemories((current) => current.map((memory) => memory.id === memoryId ? { ...memory, status } : memory));
    setMemoryStatus(status === "ACTIVE" ? "Memory approved and available to the character." : "Memory rejected.");
  }

  function updateCanonDraft<K extends keyof CanonDraft>(field: K, value: CanonDraft[K]) {
    setCanonDraft((current) => {
      if (field === "scope" && (value === "CHARACTER" || value === "PARTICIPANT") && current.participantIds.length === 0) {
        const activeCharacter = storyParticipants.find((participant) => participant.characterId === characterId)
          ?? storyParticipants.find((participant) => participant.role === "CHARACTER");
        return { ...current, [field]: value, participantIds: activeCharacter ? [activeCharacter.id] : [] };
      }
      return { ...current, [field]: value };
    });
  }

  function toggleCanonKnowledge(participantId: string) {
    setCanonDraft((current) => ({
      ...current,
      participantIds: current.participantIds.includes(participantId)
        ? current.participantIds.filter((id) => id !== participantId)
        : [...current.participantIds, participantId]
    }));
  }

  async function addCanonFact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyId || !canonDraft.predicate.trim() || !canonDraft.objectText.trim()) {
      setCanonStatus("Write the canonical fact before saving.");
      return;
    }
    if ((canonDraft.scope === "CHARACTER" || canonDraft.scope === "PARTICIPANT") && canonDraft.participantIds.length === 0) {
      setCanonStatus("Choose at least one character who knows this fact.");
      return;
    }
    const response = await performWrite("canon:add", `/api/stories/${storyId}/canon`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        timelineId: storyTimelineId,
        subjectEntityId: canonDraft.subjectEntityId || null,
        predicate: canonDraft.predicate,
        objectText: canonDraft.objectText,
        scope: canonDraft.scope,
        locked: canonDraft.locked,
        importance: canonDraft.locked ? 3 : 1.5,
        participantIds: canonDraft.scope === "CHARACTER" || canonDraft.scope === "PARTICIPANT" ? canonDraft.participantIds : []
      })
    }, setCanonStatus, "Could not save canon fact.");
    if (!response) {
      return;
    }
    setCanonDraft(emptyCanonDraft);
    setCanonStatus("Canon updated for the next turn.");
    await loadStoryCodex().catch((error) => setCanonStatus(error instanceof Error ? error.message : "Canon saved, but the section could not refresh."));
  }

  async function updateCanonFact(factId: string, input: { locked?: boolean; status?: "RETRACTED" }) {
    if (!storyId) {
      return;
    }
    const response = await performWrite(`canon:update:${factId}`, `/api/stories/${storyId}/canon?factId=${encodeURIComponent(factId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    }, setCanonStatus, "Could not update canon fact.");
    if (!response) {
      return;
    }
    setCanonStatus(input.status === "RETRACTED" ? "Fact removed from active canon." : "Canon lock updated.");
    await loadStoryCodex().catch((error) => setCanonStatus(error instanceof Error ? error.message : "Canon updated, but the section could not refresh."));
  }

  function updateStoryStateDraft<K extends keyof StoryStateDraft>(field: K, value: StoryStateDraft[K]) {
    setStoryStateDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveStoryState(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyId) {
      return;
    }
    const response = await performWrite("scene:save", `/api/stories/${storyId}/state`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        time: storyStateDraft.time.trim() || null,
        location: storyStateDraft.location.trim() || null,
        weather: storyStateDraft.weather.trim() || null,
        inventory: parsePersonaLines(storyStateDraft.inventory),
        conditions: parsePersonaLines(storyStateDraft.conditions),
        threats: parsePersonaLines(storyStateDraft.threats),
        notes: parsePersonaLines(storyStateDraft.notes)
      })
    }, setStoryStateStatus, "Could not update scene state.");
    if (!response) {
      return;
    }
    setStoryStateStatus("Scene state updated for the next turn.");
    await loadStoryCodex().catch((error) => setStoryStateStatus(error instanceof Error ? error.message : "Scene saved, but the section could not refresh."));
  }

  function updateStorySafetyDraft<K extends keyof StorySafetyDraft>(field: K, value: StorySafetyDraft[K]) {
    setStorySafetyDraft((current) => ({ ...current, [field]: value }));
    setStorySafetyStatus(null);
  }

  async function saveStorySafety(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyId) {
      return;
    }
    const response = await performWrite("safety:save", `/api/stories/${storyId}/safety`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...storySafetyDraft,
        hardLimits: parsePersonaLines(storySafetyDraft.hardLimits),
        softLimits: parsePersonaLines(storySafetyDraft.softLimits),
        fadeToBlack: parsePersonaLines(storySafetyDraft.fadeToBlack),
        notes: storySafetyDraft.notes.trim() || null
      })
    }, setStorySafetyStatus, "Could not update session safety.");
    if (!response) {
      return;
    }
    setStorySafetyStatus(storySafetyDraft.paused ? "Story paused. The model will wait out of character." : "Session safety updated for the next turn.");
    await loadStorySafety(storyId).catch((error) => setStorySafetyStatus(error instanceof Error ? error.message : "Safety saved, but the section could not refresh."));
  }

  function updateStoryDirectorDraft<K extends keyof StoryDirectorDraft>(field: K, value: StoryDirectorDraft[K]) {
    setStoryDirectorDraft((current) => ({ ...current, [field]: value }));
  }

  function updateStoryArcDraft<K extends keyof StoryArcDraft>(field: K, value: StoryArcDraft[K]) {
    setStoryArcDraft((current) => ({ ...current, [field]: value }));
  }

  function updateStoryBeatDraft<K extends keyof StoryBeatDraft>(field: K, value: StoryBeatDraft[K]) {
    setStoryBeatDraft((current) => ({ ...current, [field]: value }));
  }

  function updateStoryHookDraft<K extends keyof StoryHookDraft>(field: K, value: StoryHookDraft[K]) {
    setStoryHookDraft((current) => ({ ...current, [field]: value }));
  }

  function updateStoryRelationshipDraft<K extends keyof StoryRelationshipDraft>(field: K, value: StoryRelationshipDraft[K]) {
    setStoryRelationshipDraft((current) => ({ ...current, [field]: value }));
  }

  function updateStoryEventDraft<K extends keyof StoryEventDraft>(field: K, value: StoryEventDraft[K]) {
    setStoryEventDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveStoryDirector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyId) {
      return;
    }
    const response = await performWrite("narrative:director", `/api/stories/${storyId}/narrative`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...storyDirectorDraft,
        tone: storyDirectorDraft.tone.trim() || null,
        notes: storyDirectorDraft.notes.trim() || null
      })
    }, setStoryNarrativeStatus, "Could not update the story plan.");
    await finishNarrativeWrite(response, "Director settings updated.");
  }

  async function addStoryArc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyArcDraft.title.trim() || !storyArcDraft.premise.trim()) {
      setStoryNarrativeStatus("Add an arc title and premise.");
      return;
    }
    const response = await postNarrative({ kind: "arc", timelineId: storyTimelineId, ...storyArcDraft });
    if (response?.ok) {
      setStoryArcDraft(emptyStoryArcDraft);
    }
    await finishNarrativeWrite(response, "Story arc added.");
  }

  async function addStoryBeat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyBeatDraft.title.trim() || !storyBeatDraft.description.trim()) {
      setStoryNarrativeStatus("Add a beat title and description.");
      return;
    }
    const response = await postNarrative({
      kind: "beat",
      timelineId: storyTimelineId,
      ...storyBeatDraft,
      arcId: storyBeatDraft.arcId || null,
      position: storyBeats.length,
      priority: storyBeatDraft.status === "READY" ? 2 : 0
    });
    if (response?.ok) {
      setStoryBeatDraft(emptyStoryBeatDraft);
    }
    await finishNarrativeWrite(response, "Story beat added.");
  }

  async function addStoryHook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyHookDraft.title.trim() || !storyHookDraft.description.trim()) {
      setStoryNarrativeStatus("Add a hook title and description.");
      return;
    }
    const response = await postNarrative({
      kind: "hook",
      timelineId: storyTimelineId,
      ...storyHookDraft,
      arcId: storyHookDraft.arcId || null
    });
    if (response?.ok) {
      setStoryHookDraft(emptyStoryHookDraft);
    }
    await finishNarrativeWrite(response, "Story hook opened.");
  }

  async function saveStoryRelationship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyRelationshipDraft.fromParticipantId || !storyRelationshipDraft.toParticipantId) {
      setStoryNarrativeStatus("Choose two different participants.");
      return;
    }
    const response = await postNarrative({
      kind: "relationship",
      timelineId: storyTimelineId,
      ...storyRelationshipDraft,
      label: storyRelationshipDraft.label.trim() || null,
      notes: storyRelationshipDraft.notes.trim() || null
    });
    await finishNarrativeWrite(response, "Relationship state updated.");
  }

  async function addStoryEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyEventDraft.title.trim() || !storyEventDraft.instruction.trim()) {
      setStoryNarrativeStatus("Add an initiative title and instruction.");
      return;
    }
    const response = await postNarrative({
      kind: "event",
      timelineId: storyTimelineId,
      ...storyEventDraft,
      actorParticipantId: storyEventDraft.actorParticipantId || null,
      triggerAt: storyEventDraft.triggerAt ? new Date(storyEventDraft.triggerAt).toISOString() : null,
      priority: 2
    });
    if (response?.ok) {
      setStoryEventDraft(emptyStoryEventDraft);
    }
    await finishNarrativeWrite(response, "Character initiative scheduled.");
  }

  async function updateStoryNarrativeItem(kind: "arc" | "beat" | "hook" | "relationship" | "event", id: string, input: Record<string, unknown>) {
    if (!storyId) {
      return;
    }
    const response = await performWrite(`narrative:update:${kind}:${id}`, `/api/stories/${storyId}/narrative`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, id, ...input })
    }, setStoryNarrativeStatus, "Could not update the story plan.");
    await finishNarrativeWrite(response, "Narrative plan updated.");
  }

  async function postNarrative(input: Record<string, unknown>) {
    if (!storyId) {
      return null;
    }
    return performWrite(`narrative:${String(input.kind ?? "write")}`, `/api/stories/${storyId}/narrative`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    }, setStoryNarrativeStatus, "Could not update the story plan.");
  }

  async function finishNarrativeWrite(response: Response | null, successMessage: string) {
    if (!response) {
      return;
    }
    setStoryNarrativeStatus(successMessage);
    if (storyId) {
      await loadStoryNarrative(storyId, storyTimelineId).catch((error) => setStoryNarrativeStatus(error instanceof Error ? error.message : "Story plan saved, but the section could not refresh."));
    }
  }

  function selectCastParticipant(participantId: string) {
    castParticipantIdRef.current = participantId;
    setCastParticipantId(participantId);
    setStoryCastStateDraft(stateToCastDraft(storyParticipantStates.find((entry) => entry.participantId === participantId)));
    setStoryVoiceDraft(bindingToVoiceDraft(storyVoiceBindings.find((entry) => entry.participantId === participantId)));
    setStoryVisualDraft((current) => ({ ...current, participantId }));
    setStoryContinuityStatus(null);
  }

  function updateStoryCastStateDraft<K extends keyof StoryCastStateDraft>(field: K, value: StoryCastStateDraft[K]) {
    setStoryCastStateDraft((current) => ({ ...current, [field]: value }));
  }

  function updateStoryVoiceDraft<K extends keyof StoryVoiceDraft>(field: K, value: StoryVoiceDraft[K]) {
    setStoryVoiceDraft((current) => ({ ...current, [field]: value }));
  }

  function updateStoryVisualDraft<K extends keyof StoryVisualDraft>(field: K, value: StoryVisualDraft[K]) {
    setStoryVisualDraft((current) => ({ ...current, [field]: value }));
  }

  function updateStoryCheckpointDraft<K extends keyof StoryCheckpointDraft>(field: K, value: StoryCheckpointDraft[K]) {
    setStoryCheckpointDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveStoryCastState(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!castParticipantId) {
      setStoryContinuityStatus("Choose a cast member first.");
      return;
    }
    const response = await postContinuity({
      kind: "participant_state",
      timelineId: storyTimelineId,
      participantId: castParticipantId,
      ...nullableTextFields(storyCastStateDraft)
    });
    await finishContinuityWrite(response, "Cast state updated for future turns.");
  }

  async function saveStoryVoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!castParticipantId || !storyVoiceDraft.voiceId.trim()) {
      setStoryContinuityStatus("Choose a cast member and add a provider voice ID.");
      return;
    }
    const response = await postContinuity({
      kind: "voice",
      participantId: castParticipantId,
      ...storyVoiceDraft,
      style: storyVoiceDraft.style.trim() || null
    });
    await finishContinuityWrite(response, "Story voice binding saved.");
  }

  async function addStoryVisualReference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyVisualDraft.title.trim() || (!storyVisualDraft.imageUrl.trim() && !storyVisualDraft.prompt.trim())) {
      setStoryContinuityStatus("Add a title and either an image URL or visual prompt.");
      return;
    }
    const response = await postContinuity({
      kind: "visual",
      timelineId: storyTimelineId,
      ...storyVisualDraft,
      participantId: storyVisualDraft.participantId || null,
      entityId: storyVisualDraft.entityId || null,
      imageUrl: storyVisualDraft.imageUrl.trim() || null,
      prompt: storyVisualDraft.prompt.trim() || null,
      notes: storyVisualDraft.notes.trim() || null
    });
    if (response?.ok) {
      setStoryVisualDraft({ ...emptyStoryVisualDraft, participantId: castParticipantId });
    }
    await finishContinuityWrite(response, "Visual continuity reference added.");
  }

  async function addStoryCheckpoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyCheckpointDraft.title.trim()) {
      setStoryContinuityStatus("Add a checkpoint title.");
      return;
    }
    const response = await postContinuity({
      kind: "checkpoint",
      timelineId: storyTimelineId,
      checkpointKind: "MANUAL",
      title: storyCheckpointDraft.title,
      summary: storyCheckpointDraft.summary.trim() || null,
      openThreads: parsePersonaLines(storyCheckpointDraft.openThreads)
    });
    if (response?.ok) {
      setStoryCheckpointDraft(emptyStoryCheckpointDraft);
    }
    await finishContinuityWrite(response, "Continuity checkpoint created.");
  }

  async function postContinuity(input: Record<string, unknown>) {
    if (!storyId) {
      return null;
    }
    return performWrite(`continuity:${String(input.kind ?? "write")}`, `/api/stories/${storyId}/continuity`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    }, setStoryContinuityStatus, "Could not update story continuity.");
  }

  async function finishContinuityWrite(response: Response | null, successMessage: string) {
    if (!response) {
      return;
    }
    setStoryContinuityStatus(successMessage);
    if (storyId) {
      await loadStoryContinuity(storyId, storyTimelineId).catch((error) => setStoryContinuityStatus(error instanceof Error ? error.message : "Continuity saved, but the section could not refresh."));
    }
  }

  function startNewPersona() {
    setDraft({ ...emptyPersonaDraft, label: "New persona" });
    setActiveProfileId(null);
    setActivePersona(null);
    setPersonaStatus(null);
  }

  return {
    chatId,
    characterId,
    profiles,
    activeProfileId,
    temporaryProfileId,
    characterDefaultProfileId,
    activePersona,
    draft,
    personaStatus,
    memoryDraft,
    memoryStatus,
    memories,
    memoryEditingId,
    memoryEditDraft,
    pendingAction,
    lastSavedAt,
    panelLoadStatus,
    chats,
    avatarUploading,
    storyId,
    storyTimelineId,
    storyParticipants,
    storyEntities,
    canonFacts,
    canonDraft,
    canonStatus,
    storyStateDraft,
    storyStateStatus,
    storyDirectorDraft,
    storyArcs,
    storyBeats,
    storyHooks,
    storyRelationships,
    storyProactiveEvents,
    storyArcDraft,
    storyBeatDraft,
    storyHookDraft,
    storyRelationshipDraft,
    storyEventDraft,
    storyNarrativeStatus,
    storyParticipantStates,
    storyVoiceBindings,
    storyVisualReferences,
    storyCheckpoints,
    castParticipantId,
    storyCastStateDraft,
    storyVoiceDraft,
    storyVisualDraft,
    storyCheckpointDraft,
    storyContinuityStatus,
    storySafetyDraft,
    storySafetyStatus,
    setMemoryDraft,
    setMemoryEditDraft,
    updateDraft,
    pickAvatar,
    setAvatarPickError,
    setAvatarUploadingState,
    switchPersona,
    usePersonaOnce,
    setCharacterDefault,
    savePersona,
    addMemory,
    startEditingMemory,
    cancelEditingMemory,
    saveMemory,
    removeMemory,
    reviewMemory,
    updateCanonDraft,
    toggleCanonKnowledge,
    addCanonFact,
    updateCanonFact,
    updateStoryStateDraft,
    saveStoryState,
    updateStoryDirectorDraft,
    updateStoryArcDraft,
    updateStoryBeatDraft,
    updateStoryHookDraft,
    updateStoryRelationshipDraft,
    updateStoryEventDraft,
    saveStoryDirector,
    addStoryArc,
    addStoryBeat,
    addStoryHook,
    saveStoryRelationship,
    addStoryEvent,
    updateStoryNarrativeItem,
    selectCastParticipant,
    updateStoryCastStateDraft,
    updateStoryVoiceDraft,
    updateStoryVisualDraft,
    updateStoryCheckpointDraft,
    saveStoryCastState,
    saveStoryVoice,
    addStoryVisualReference,
    addStoryCheckpoint,
    updateStorySafetyDraft,
    saveStorySafety,
    startNewPersona
  };
}

function listToText(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join("\n") : "";
}

async function safeResponseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return body && typeof body.error === "string" && body.error.trim() ? body.error : fallback;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableTextFields<T extends Record<string, string>>(value: T) {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, entry.trim() || null]));
}

function stateToCastDraft(state?: StoryParticipantStateRow): StoryCastStateDraft {
  return {
    displayNameOverride: state?.displayNameOverride ?? "",
    pronouns: state?.pronouns ?? "",
    currentMood: state?.currentMood ?? "",
    appearance: state?.appearance ?? "",
    currentGoal: state?.currentGoal ?? "",
    innerConflict: state?.innerConflict ?? "",
    voiceStyle: state?.voiceStyle ?? "",
    speakingStyle: state?.speakingStyle ?? ""
  };
}

function bindingToVoiceDraft(binding?: StoryVoiceBindingRow): StoryVoiceDraft {
  return {
    provider: binding?.provider ?? "elevenlabs",
    voiceId: binding?.voiceId ?? "",
    style: binding?.style ?? "",
    speed: Math.max(0.7, Math.min(1.2, binding?.speed ?? 1)),
    pitch: binding?.pitch ?? 0,
    autoPlay: binding?.autoPlay ?? false
  };
}

export function profileFromApi(profile: Record<string, unknown>): PersonaProfile {
  return {
    id: String(profile.id ?? "default"),
    label: String(profile.label ?? profile.displayName ?? "Persona"),
    displayName: String(profile.displayName ?? ""),
    avatarUrl: typeof profile.avatarUrl === "string" ? profile.avatarUrl : null,
    summary: String(profile.summary ?? ""),
    background: typeof profile.background === "string" ? profile.background : "",
    traits: Array.isArray(profile.traits) ? profile.traits.filter((item): item is string => typeof item === "string") : [],
    likes: Array.isArray(profile.likes) ? profile.likes.filter((item): item is string => typeof item === "string") : [],
    dislikes: Array.isArray(profile.dislikes) ? profile.dislikes.filter((item): item is string => typeof item === "string") : [],
    boundaries: Array.isArray(profile.boundaries) ? profile.boundaries.filter((item): item is string => typeof item === "string") : [],
    isDefault: profile.isDefault === true,
    visibility: profile.visibility === "PUBLIC" || profile.visibility === "UNLISTED" ? profile.visibility : "PRIVATE"
  };
}

export function profileToDraft(profile: Record<string, unknown>): PersonaDraft {
  const parsed = profileFromApi(profile);
  return {
    profileId: parsed.id,
    label: parsed.label,
    displayName: parsed.displayName,
    avatarUrl: parsed.avatarUrl ?? "",
    summary: parsed.summary,
    background: parsed.background ?? "",
    traits: parsed.traits.join("\n"),
    likes: parsed.likes.join("\n"),
    dislikes: parsed.dislikes.join("\n"),
    boundaries: parsed.boundaries.join("\n")
  };
}
