"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  GitBranch,
  Map,
  Sparkles,
  UserRound,
  X,
  type LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { shouldBypassNextImageOptimization } from "@/lib/image-cache";
import {
  TUTORIAL_STEP_COUNT,
  type TutorialMemoryChoice,
  type TutorialPersonaChoice,
  type TutorialRouteChoice,
  type TutorialState,
  type TutorialStatus
} from "@/lib/tutorial";
import { cn } from "@/lib/utils";

type TutorialCharacter = {
  id: string;
  name: string;
  avatarUrl: string | null;
  description: string;
  creatorName: string;
};

type TutorialExperienceProps = {
  character: TutorialCharacter;
  travelerName: string;
  initialStep: number;
  initialState: TutorialState;
  continueHref: string;
  exitHref: string;
};

const PERSONAS: Array<{ id: TutorialPersonaChoice; label: string; detail: string; response: string }> = [
  { id: "strategist", label: "Strategist", detail: "Plans first, moves second.", response: "Good. You do the thinking. I’ll do the part where the wall stops existing." },
  { id: "daredevil", label: "Daredevil", detail: "Treats danger like an invitation.", response: "Finally. Someone with the correct amount of bad judgment." },
  { id: "scout", label: "Scout", detail: "Notices the route everyone else misses.", response: "Sharp eyes. Keep them on the exits—and maybe on anything that starts beeping." }
];

const SUPPLIES: Array<{ id: TutorialMemoryChoice; label: string; detail: string }> = [
  { id: "tuna", label: "Emergency tuna", detail: "Questionable priorities. Excellent morale." },
  { id: "shield", label: "Shield potion", detail: "Practical, blue, and only slightly fizzy." },
  { id: "grappler", label: "Grappler", detail: "Every escape route becomes vertical." }
];

const ROUTES: Record<TutorialRouteChoice, { label: string; arrival: string; reaction: string }> = {
  car: {
    label: "Steal the car",
    arrival: "The stolen car lands sideways on a rooftop, somehow still running.",
    reaction: "See? Completely controlled. The missing doors are an aerodynamic choice."
  },
  helicopter: {
    label: "Steal the helicopter",
    arrival: "The helicopter clears the compound with three warning lights flashing at once.",
    reaction: "Relax. Red lights just mean the machine is paying attention."
  }
};

const MEMORY_RECALL: Record<TutorialMemoryChoice, string> = {
  tuna: "Meowscles pulls out the emergency tuna you chose and looks visibly relieved.",
  shield: "Meowscles tosses you the shield potion you packed before the escape.",
  grappler: "Meowscles hooks the grappler you remembered to bring onto the next rooftop."
};

export function TutorialExperience({
  character,
  travelerName,
  initialStep,
  initialState,
  continueHref,
  exitHref
}: TutorialExperienceProps) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [storyState, setStoryState] = useState<TutorialState>(() => ({
    routeChoice: initialState.routeChoice ?? (initialStep > 1 ? "helicopter" : undefined),
    personaChoice: initialState.personaChoice ?? (initialStep > 2 ? "strategist" : undefined),
    memoryChoice: initialState.memoryChoice ?? (initialStep > 3 ? "tuna" : undefined),
    alternateRouteViewed: initialState.alternateRouteViewed ?? initialStep > 4
  }));
  const [leaving, setLeaving] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);

  const selectedPersona = PERSONAS.find((persona) => persona.id === storyState.personaChoice);
  const selectedSupply = SUPPLIES.find((supply) => supply.id === storyState.memoryChoice);
  const selectedRoute = storyState.routeChoice ? ROUTES[storyState.routeChoice] : null;

  async function persist(status: Exclude<TutorialStatus, "NOT_STARTED">, nextStep: number, nextState: TutorialState) {
    try {
      const response = await fetch("/api/tutorial", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, step: nextStep, state: nextState })
      });
      if (!response.ok) {
        setSaveWarning(true);
      }
    } catch {
      setSaveWarning(true);
    }
  }

  function updateStoryState(patch: Partial<TutorialState>) {
    const nextState = { ...storyState, ...patch };
    setStoryState(nextState);
    void persist("IN_PROGRESS", step, nextState);
  }

  function moveTo(nextStep: number) {
    setStep(nextStep);
    void persist("IN_PROGRESS", nextStep, storyState);
  }

  async function leave(status: "COMPLETED" | "SKIPPED", href: string) {
    if (leaving) return;
    setLeaving(true);
    await persist(status, status === "COMPLETED" ? TUTORIAL_STEP_COUNT : step, storyState);
    router.push(href);
  }

  return (
    <div className="nythera-tutorial min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <aside className="nythera-tutorial-portrait" aria-label={`${character.name}, tutorial guide`}>
        {character.avatarUrl ? (
          <Image
            src={character.avatarUrl}
            alt={character.name}
            fill
            priority
            unoptimized={shouldBypassNextImageOptimization(character.avatarUrl)}
            sizes="(max-width: 767px) 100vw, 42vw"
            className="object-cover object-top"
          />
        ) : null}
        <div className="nythera-tutorial-portrait-veil" />
        <div className="nythera-tutorial-character-copy">
          <p className="codex-kicker text-[var(--codex-mint)]">Your guide</p>
          <h1>{character.name}</h1>
          <p>{character.description}</p>
          <span>by @{character.creatorName}</span>
        </div>
      </aside>

      <main className="nythera-tutorial-manuscript">
        <header className="nythera-tutorial-header">
          <div>
            <p className="codex-kicker">Playable introduction</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Learn Nythera inside a story.</p>
          </div>
          <button
            type="button"
            className="focus-ring inline-flex min-h-11 items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[.14em] text-[var(--text-secondary)] hover:text-[var(--codex-ivory)]"
            onClick={() => void leave("SKIPPED", exitHref)}
            disabled={leaving}
          >
            <X className="h-4 w-4" /> Skip tutorial
          </button>
        </header>

        <div
          className="nythera-tutorial-progress"
          role="progressbar"
          aria-label="Tutorial progress"
          aria-valuemin={0}
          aria-valuemax={TUTORIAL_STEP_COUNT}
          aria-valuenow={step}
          aria-valuetext={`Tutorial step ${step} of ${TUTORIAL_STEP_COUNT}`}
        >
          <div className="flex items-center justify-between gap-4">
            <span>{step === 0 ? "Briefing" : `Chapter ${String(step).padStart(2, "0")}`}</span>
            <span>{Math.round((step / TUTORIAL_STEP_COUNT) * 100)}%</span>
          </div>
          <div className="mt-3 h-px bg-white/10">
            <div className="h-px bg-[var(--codex-mint)] transition-[width] duration-500" style={{ width: `${(step / TUTORIAL_STEP_COUNT) * 100}%` }} />
          </div>
        </div>

        <section className="nythera-tutorial-stage" aria-live="polite">
          {step === 0 ? (
            <WelcomeStage characterName={character.name} travelerName={travelerName} onBegin={() => moveTo(1)} />
          ) : null}
          {step === 1 ? (
            <ChoiceStage
              characterName={character.name}
              choice={storyState.routeChoice}
              onChoice={(routeChoice) => updateStoryState({ routeChoice, alternateRouteViewed: false })}
              onContinue={() => moveTo(2)}
            />
          ) : null}
          {step === 2 ? (
            <PersonaStage
              characterName={character.name}
              choice={storyState.personaChoice}
              selectedPersona={selectedPersona}
              onChoice={(personaChoice) => updateStoryState({ personaChoice })}
              onContinue={() => moveTo(3)}
            />
          ) : null}
          {step === 3 ? (
            <MemoryStage
              characterName={character.name}
              choice={storyState.memoryChoice}
              selectedSupply={selectedSupply}
              onChoice={(memoryChoice) => updateStoryState({ memoryChoice })}
              onContinue={() => moveTo(4)}
            />
          ) : null}
          {step === 4 && selectedRoute && storyState.memoryChoice ? (
            <ContinuityStage
              characterName={character.name}
              routeChoice={storyState.routeChoice!}
              route={selectedRoute}
              memoryChoice={storyState.memoryChoice}
              alternateViewed={Boolean(storyState.alternateRouteViewed)}
              onTryAlternate={() => updateStoryState({
                routeChoice: storyState.routeChoice === "car" ? "helicopter" : "car",
                alternateRouteViewed: true
              })}
              onContinue={() => moveTo(5)}
            />
          ) : null}
          {step === 5 ? (
            <CompleteStage
              characterName={character.name}
              persona={selectedPersona?.label ?? "Strategist"}
              memory={selectedSupply?.label ?? "Emergency tuna"}
              route={selectedRoute?.label ?? "Steal the helicopter"}
              leaving={leaving}
              onContinue={() => void leave("COMPLETED", continueHref)}
              onExit={() => void leave("COMPLETED", exitHref)}
            />
          ) : null}
        </section>

        {step > 0 && step < TUTORIAL_STEP_COUNT ? (
          <footer className="nythera-tutorial-footer">
            <button type="button" className="focus-ring inline-flex min-h-11 items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-[var(--text-secondary)] hover:text-[var(--codex-ivory)]" onClick={() => moveTo(step - 1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <LearningSignal step={step} />
          </footer>
        ) : null}

        {saveWarning ? (
          <p className="px-6 pb-4 text-center text-xs text-amber-200/80 sm:px-10">Progress could not be synced. You can keep playing.</p>
        ) : null}
      </main>
    </div>
  );
}

function WelcomeStage({ characterName, travelerName, onBegin }: { characterName: string; travelerName: string; onBegin: () => void }) {
  return (
    <div className="nythera-tutorial-sheet">
      <p className="codex-kicker text-[var(--codex-violet)]">Before your first story</p>
      <h2>A two-minute mission, {travelerName}.</h2>
      <p className="nythera-tutorial-lead">{characterName} will show you how choices, personas, memory, and story branches work. This is a scripted preview, so you do not need a model key yet.</p>
      <div className="nythera-tutorial-objective">
        <Sparkles className="h-5 w-5" />
        <div><strong>Objective</strong><span>Escape the compound without letting {characterName} improve the plan.</span></div>
      </div>
      <Button size="lg" onClick={onBegin}>Begin mission <ArrowRight className="h-4 w-4" /></Button>
    </div>
  );
}

function ChoiceStage({ characterName, choice, onChoice, onContinue }: { characterName: string; choice?: TutorialRouteChoice; onChoice: (choice: TutorialRouteChoice) => void; onContinue: () => void }) {
  return (
    <div className="nythera-tutorial-sheet">
      <StageHeading icon={BookOpen} eyebrow="01 · Your reply" title="Every story begins with a decision." />
      <Dialogue speaker={characterName}>“Two options. We steal their car, or we steal their helicopter. Choose fast. I’m probably going to make it worse either way.”</Dialogue>
      <p className="nythera-tutorial-instruction">Choose a reply. In a real chat, you can also write anything you want.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(ROUTES) as TutorialRouteChoice[]).map((routeChoice) => (
          <ChoiceCard key={routeChoice} selected={choice === routeChoice} onClick={() => onChoice(routeChoice)} title={ROUTES[routeChoice].label} detail={routeChoice === "car" ? "Fast, loud, technically roadworthy." : "Faster, louder, barely airworthy."} />
        ))}
      </div>
      {choice ? <Dialogue speaker={characterName}>{choice === "car" ? "Car it is. Try to look official while I remove the windshield." : "Helicopter. Excellent. Neither of us needs to know how to fly until we’re already airborne."}</Dialogue> : null}
      <StageAction disabled={!choice} onClick={onContinue}>Continue <ArrowRight className="h-4 w-4" /></StageAction>
    </div>
  );
}

function PersonaStage({ characterName, choice, selectedPersona, onChoice, onContinue }: { characterName: string; choice?: TutorialPersonaChoice; selectedPersona?: (typeof PERSONAS)[number]; onChoice: (choice: TutorialPersonaChoice) => void; onContinue: () => void }) {
  return (
    <div className="nythera-tutorial-sheet">
      <StageHeading icon={UserRound} eyebrow="02 · Persona" title="Decide who you are in this story." />
      <p className="nythera-tutorial-lead">A persona tells every character how to see you. It can be reused across chats and changed without rewriting the bot.</p>
      <div className="grid gap-3">
        {PERSONAS.map((persona) => <ChoiceCard key={persona.id} selected={choice === persona.id} onClick={() => onChoice(persona.id)} title={persona.label} detail={persona.detail} />)}
      </div>
      {selectedPersona ? <Dialogue speaker={characterName}>“{selectedPersona.response}”</Dialogue> : null}
      <StageAction disabled={!choice} onClick={onContinue}>Use this persona <ArrowRight className="h-4 w-4" /></StageAction>
    </div>
  );
}

function MemoryStage({ characterName, choice, selectedSupply, onChoice, onContinue }: { characterName: string; choice?: TutorialMemoryChoice; selectedSupply?: (typeof SUPPLIES)[number]; onChoice: (choice: TutorialMemoryChoice) => void; onContinue: () => void }) {
  return (
    <div className="nythera-tutorial-sheet">
      <StageHeading icon={Brain} eyebrow="03 · Memory" title="Give the story something to remember." />
      <Dialogue speaker={characterName}>“Before we go—grab one thing. Preferably something useful. My definition of useful is flexible.”</Dialogue>
      <div className="grid gap-3 sm:grid-cols-3">
        {SUPPLIES.map((supply) => <ChoiceCard key={supply.id} selected={choice === supply.id} onClick={() => onChoice(supply.id)} title={supply.label} detail={supply.detail} compact />)}
      </div>
      {selectedSupply ? (
        <div className="nythera-tutorial-memory"><Check className="h-4 w-4" /><div><strong>Saved to story memory</strong><span>You packed {selectedSupply.label.toLowerCase()}.</span></div></div>
      ) : null}
      <StageAction disabled={!choice} onClick={onContinue}>Jump to the next scene <ArrowRight className="h-4 w-4" /></StageAction>
    </div>
  );
}

function ContinuityStage({ characterName, routeChoice, route, memoryChoice, alternateViewed, onTryAlternate, onContinue }: { characterName: string; routeChoice: TutorialRouteChoice; route: (typeof ROUTES)[TutorialRouteChoice]; memoryChoice: TutorialMemoryChoice; alternateViewed: boolean; onTryAlternate: () => void; onContinue: () => void }) {
  return (
    <div className="nythera-tutorial-sheet">
      <StageHeading icon={GitBranch} eyebrow="04 · Continuity & branches" title="The next scene remembers your path." />
      <div className="nythera-tutorial-scene-label"><Map className="h-4 w-4" /> Twenty minutes later</div>
      <p className="font-editorial text-2xl leading-9 text-[var(--codex-ivory)]">{route.arrival}</p>
      <Dialogue speaker={characterName}>“{route.reaction}”</Dialogue>
      <div className="nythera-tutorial-memory"><Brain className="h-4 w-4" /><div><strong>Memory recalled</strong><span>{MEMORY_RECALL[memoryChoice]}</span></div></div>
      <button type="button" onClick={onTryAlternate} className="focus-ring flex w-full items-center justify-between gap-4 border border-[var(--codex-rule)] p-4 text-left transition hover:border-[var(--codex-violet)] hover:bg-white/[.025]">
        <span><strong className="block text-sm text-[var(--codex-ivory)]">Try the other route</strong><span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">Switch from {ROUTES[routeChoice].label.toLowerCase()} without losing the original path.</span></span>
        <GitBranch className="h-5 w-5 shrink-0 text-[var(--codex-violet)]" />
      </button>
      {alternateViewed ? <p className="text-xs leading-5 text-[var(--codex-mint)]">Branch created. Nythera can keep both versions of the scene.</p> : null}
      <StageAction disabled={!alternateViewed} onClick={onContinue}>Finish mission <ArrowRight className="h-4 w-4" /></StageAction>
    </div>
  );
}

function CompleteStage({ characterName, persona, memory, route, leaving, onContinue, onExit }: { characterName: string; persona: string; memory: string; route: string; leaving: boolean; onContinue: () => void; onExit: () => void }) {
  return (
    <div className="nythera-tutorial-sheet">
      <p className="codex-kicker text-[var(--codex-mint)]">Mission complete</p>
      <h2>Your story already has a history.</h2>
      <p className="nythera-tutorial-lead">You made a choice, entered through a persona, created a memory, and explored another branch—all without changing {characterName}.</p>
      <div className="nythera-tutorial-recap">
        <Recap icon={UserRound} label="Persona" value={persona} />
        <Recap icon={Brain} label="Remembered" value={memory} />
        <Recap icon={GitBranch} label="Current branch" value={route} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" onClick={onContinue} disabled={leaving}>Continue with {characterName}<ArrowRight className="h-4 w-4" /></Button>
        <Button size="lg" variant="outline" onClick={onExit} disabled={leaving}>Explore Nythera</Button>
      </div>
      <p className="text-xs leading-5 text-[var(--text-muted)]">Next, connect a model provider if needed. Your real conversations remain private to your account.</p>
    </div>
  );
}

function StageHeading({ icon: Icon, eyebrow, title }: { icon: LucideIcon; eyebrow: string; title: string }) {
  return <div><p className="codex-kicker inline-flex items-center gap-2 text-[var(--codex-violet)]"><Icon className="h-4 w-4" />{eyebrow}</p><h2>{title}</h2></div>;
}

function Dialogue({ speaker, children }: { speaker: string; children: React.ReactNode }) {
  return <blockquote className="nythera-tutorial-dialogue"><span>{speaker}</span><p>{children}</p></blockquote>;
}

function ChoiceCard({ selected, onClick, title, detail, compact = false }: { selected: boolean; onClick: () => void; title: string; detail: string; compact?: boolean }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={cn("nythera-tutorial-choice focus-ring", compact && "is-compact", selected && "is-selected")}>
      <span><strong>{title}</strong><small>{detail}</small></span>
      <span className="nythera-tutorial-choice-mark">{selected ? <Check className="h-4 w-4" /> : null}</span>
    </button>
  );
}

function StageAction({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button size="lg" className="w-full sm:w-auto" disabled={disabled} onClick={onClick}>{children}</Button>;
}

function LearningSignal({ step }: { step: number }) {
  const signals = [
    null,
    { icon: BookOpen, text: "Replies move the scene" },
    { icon: UserRound, text: "Personas define your role" },
    { icon: Brain, text: "Memories survive scene changes" },
    { icon: GitBranch, text: "Branches preserve alternatives" }
  ];
  const signal = signals[step];
  if (!signal) return null;
  const Icon = signal.icon;
  return <span className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]"><Icon className="h-4 w-4 text-[var(--codex-mint)]" />{signal.text}</span>;
}

function Recap({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div><Icon className="h-4 w-4" /><span>{label}</span><strong>{value}</strong></div>;
}
