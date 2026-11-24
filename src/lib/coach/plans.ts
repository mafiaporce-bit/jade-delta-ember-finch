export type Segment = {
  sec: number;
  kmh: number;
  label: string;
  cue: string;
};

export type Plan = {
  id: string;
  name: string;
  blurb: string;
  segments: Segment[];
};

export type PlanSpot = {
  index: number;
  segment: Segment;
  left: number;
  next: Segment | null;
  done: boolean;
};

const clamp = (kmh: number, maxKmh: number) =>
  Math.round(Math.min(maxKmh, Math.max(0, kmh)) * 10) / 10;

export const PLANS: Plan[] = [
  {
    id: "easy-four",
    name: "Easy four",
    blurb: "Twenty minutes. The belt settles at 4.0 km/h.",
    segments: [
      {
        sec: 90,
        kmh: 3.2,
        label: "Ease in",
        cue: "Walking pace while the belt comes up. Short steps.",
      },
      {
        sec: 180,
        kmh: 4,
        label: "Find four",
        cue: "Four kilometers an hour. Let your arms swing.",
      },
      {
        sec: 720,
        kmh: 4,
        label: "Hold 4.0",
        cue: "Stay at four. This is the whole session.",
      },
      {
        sec: 150,
        kmh: 3.2,
        label: "Ease out",
        cue: "I'm bringing the belt down. Keep walking it out.",
      },
    ],
  },
  {
    id: "walk-jog",
    name: "Walk–jog",
    blurb: "Easy walks with short jogs. Nothing sudden.",
    segments: [
      { sec: 180, kmh: 4, label: "Warm up", cue: "Four to start. Breathe through your nose if you can." },
      { sec: 60, kmh: 6, label: "Jog", cue: "Up to six. Light feet, stay tall." },
      { sec: 120, kmh: 4.2, label: "Walk back", cue: "Back to a walk. Shake your hands out." },
      { sec: 60, kmh: 6.5, label: "Jog", cue: "Six and a half. Same effort, not a sprint." },
      { sec: 120, kmh: 4.2, label: "Walk back", cue: "Walk. You've got another one after this." },
      { sec: 60, kmh: 7, label: "Jog", cue: "Last jog, seven. Then we walk it home." },
      { sec: 150, kmh: 4, label: "Cool down", cue: "Four again. I'm done asking for speed." },
    ],
  },
  {
    id: "build-30",
    name: "30-minute build",
    blurb: "Starts at 4 and tops out wherever you set the ceiling.",
    segments: [
      { sec: 240, kmh: 4, label: "Base", cue: "Four kilometers an hour. This is the floor." },
      { sec: 240, kmh: 4.8, label: "A bit more", cue: "Up a little. You should still talk." },
      { sec: 300, kmh: 5.6, label: "Steady", cue: "Hold this. Look ahead, not at your feet." },
      { sec: 300, kmh: 6.4, label: "Push", cue: "This is the hard block. It ends." },
      { sec: 240, kmh: 5, label: "Settle", cue: "Coming off the push. Stay smooth." },
      { sec: 180, kmh: 4, label: "Down", cue: "Back to four. Nice work." },
    ],
  },
];

export function planById(id: string): Plan {
  return PLANS.find((plan) => plan.id === id) ?? PLANS[0]!;
}

export function planSeconds(plan: Plan): number {
  return plan.segments.reduce((total, segment) => total + segment.sec, 0);
}

export function spotAt(plan: Plan, elapsedSec: number): PlanSpot {
  let cursor = 0;
  for (let index = 0; index < plan.segments.length; index += 1) {
    const segment = plan.segments[index]!;
    if (elapsedSec < cursor + segment.sec) {
      return {
        index,
        segment,
        left: Math.max(0, cursor + segment.sec - elapsedSec),
        next: plan.segments[index + 1] ?? null,
        done: false,
      };
    }
    cursor += segment.sec;
  }
  const last = plan.segments[plan.segments.length - 1]!;
  return { index: plan.segments.length - 1, segment: last, left: 0, next: null, done: true };
}

export function steadyPlan(kmh: number, minutes: number, maxKmh: number): Plan {
  const pace = clamp(kmh, maxKmh);
  const hold = Math.min(45, Math.max(5, Math.round(minutes))) * 60;
  const ease = clamp(Math.max(2.5, pace - 0.8), maxKmh);
  return {
    id: "custom",
    name: `${pace.toFixed(1)} km/h`,
    blurb: "A steady pace with an easy start and finish.",
    segments: [
      {
        sec: 90,
        kmh: ease,
        label: "Ease in",
        cue: `Starting easier, then I'll set ${pace.toFixed(1)}.`,
      },
      {
        sec: hold,
        kmh: pace,
        label: `Hold ${pace.toFixed(1)}`,
        cue: `Holding ${pace.toFixed(1)} kilometers an hour.`,
      },
      {
        sec: 90,
        kmh: ease,
        label: "Ease out",
        cue: "Easing the belt down. Stay on until it slows.",
      },
    ],
  };
}

export type LocalRead =
  | { kind: "plan"; plan: Plan; say: string }
  | { kind: "stop"; say: string }
  | { kind: "nudge"; delta: number; say: string }
  | { kind: "need-ai" };

export function interpret(message: string, maxKmh: number): LocalRead {
  const text = message.trim().toLowerCase();
  if (!text) return { kind: "need-ai" };
  if (/\b(stop|halt|end|finish)\b/.test(text)) {
    return { kind: "stop", say: "Stopping. I'm setting the belt to zero." };
  }
  if (/\b(slower|ease|easier|too fast)\b/.test(text)) {
    return { kind: "nudge", delta: -0.5, say: "Slowing it by half a kilometer an hour." };
  }
  if (/\b(faster|speed up|harder|pick it up)\b/.test(text)) {
    return { kind: "nudge", delta: 0.4, say: "A little faster. Half a step, not a jump." };
  }
  if (/\b(interval|jog)\b/.test(text)) {
    return {
      kind: "plan",
      plan: scalePlan(planById("walk-jog"), maxKmh),
      say: "Walk–jog. I'll raise and lower the belt between the blocks.",
    };
  }
  if (/\b(easy|walk|recovery)\b/.test(text) && !/\d/.test(text)) {
    return {
      kind: "plan",
      plan: scalePlan(planById("easy-four"), maxKmh),
      say: "Easy four. I'll hold the belt at four kilometers an hour.",
    };
  }
  if (/\b(30|build|longer)\b/.test(text) && !/\bkm/.test(text)) {
    return {
      kind: "plan",
      plan: scalePlan(planById("build-30"), maxKmh),
      say: "Thirty-minute build. The belt steps up, then comes home.",
    };
  }
  const speed = text.match(/(\d+(?:\.\d+)?)\s*(?:km\/h|kmh|kph|km\b|kilometers?)/);
  const minutes = text.match(/(\d+)\s*(?:min|minutes)/);
  const bare = text.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  const kmh = speed ? Number(speed[1]) : bare ? Number(bare[1]) : null;
  if (kmh !== null && Number.isFinite(kmh)) {
    const plan = steadyPlan(kmh, minutes ? Number(minutes[1]) : 12, maxKmh);
    const pace = plan.segments[1]?.kmh ?? kmh;
    return {
      kind: "plan",
      plan,
      say: `I'll bring the belt to ${pace.toFixed(1)} kilometers an hour and hold it.`,
    };
  }
  if (text.split(/\s+/).length >= 5 || text.includes("?")) return { kind: "need-ai" };
  return { kind: "need-ai" };
}

export function scalePlan(plan: Plan, maxKmh: number): Plan {
  return {
    ...plan,
    segments: plan.segments.map((segment) => ({ ...segment, kmh: clamp(segment.kmh, maxKmh) })),
  };
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
