import { askCoach } from "@/lib/coach/ask";
import {
  formatClock,
  interpret,
  planById,
  planSeconds,
  scalePlan,
  spotAt,
  type Plan,
} from "@/lib/coach/plans";
import {
  EXTRA_UUIDS,
  FrameAssembler,
  NOTIFY_UUID,
  QUESTIONS,
  SERVICE_UUID,
  START_FRAMES,
  WRITE_UUID,
  cstWakeFrames,
  frameMessage,
  fromHundredths,
  hex,
  parseMessage,
  pollMessage,
  readTelemetry,
  request,
  speedFrames,
  unlockMessage,
  type ConsoleUnit,
} from "@/lib/ifit/protocol";

export type Phase = "idle" | "connecting" | "waking" | "live" | "error";

export type HistoryItem = {
  id: string;
  title: string;
  km: number;
  sec: number;
  when: number;
};

export type Snap = {
  phase: Phase;
  sim: boolean;
  deviceName: string | null;
  error: string | null;
  armed: boolean;
  following: boolean;
  manualHold: boolean;
  autoStart: boolean;
  fullWake: boolean;
  voice: boolean;
  consoleUnit: ConsoleUnit;
  maxKmh: number;
  targetKmh: number;
  commandKmh: number;
  actualKmh: number | null;
  distanceKm: number;
  elapsedSec: number;
  plan: Plan;
  segmentLabel: string;
  cue: string;
  segmentIndex: number;
  segmentLeft: number;
  nextKmh: number | null;
  writes: number;
  packets: number;
  log: string[];
  lostWhileMoving: boolean;
  mismatch: string | null;
  asking: boolean;
  coachSay: string | null;
  beltHint: string | null;
  history: HistoryItem[];
  bluetooth: "unknown" | "ready" | "missing";
  wakingLabel: string | null;
};

const STORAGE_KEY = "pace-coach-v1";

type Saved = {
  consoleUnit: ConsoleUnit;
  maxKmh: number;
  voice: boolean;
  autoStart: boolean;
  fullWake: boolean;
  history: HistoryItem[];
  planId: string;
};

const listeners = new Set<() => void>();

function emptySnap(): Snap {
  const plan = planById("easy-four");
  const spot = spotAt(plan, 0);
  return {
    phase: "idle",
    sim: false,
    deviceName: null,
    error: null,
    armed: false,
    following: false,
    manualHold: false,
    autoStart: false,
    fullWake: false,
    voice: true,
    consoleUnit: "kmh",
    maxKmh: 10,
    targetKmh: spot.segment.kmh,
    commandKmh: 0,
    actualKmh: null,
    distanceKm: 0,
    elapsedSec: 0,
    plan,
    segmentLabel: spot.segment.label,
    cue: "Clip the safety key. When you let me drive, I'll set the belt — I won't touch it before that.",
    segmentIndex: 0,
    segmentLeft: spot.segment.sec,
    nextKmh: spot.next?.kmh ?? null,
    writes: 0,
    packets: 0,
    log: [],
    lostWhileMoving: false,
    mismatch: null,
    asking: false,
    coachSay: null,
    beltHint: null,
    history: [],
    bluetooth: "unknown",
    wakingLabel: null,
  };
}

let snap: Snap = emptySnap();

function emit() {
  listeners.forEach((listener) => listener());
}

function commit(partial: Partial<Snap>) {
  snap = { ...snap, ...partial };
  emit();
}

function note(line: string) {
  const stamp = formatClock(Math.floor(Date.now() / 1000) % 3600);
  snap = { ...snap, log: [`${stamp}  ${line}`, ...snap.log].slice(0, 8) };
  emit();
}

type GattChar = {
  properties: { write?: boolean; writeWithoutResponse?: boolean; notify?: boolean; indicate?: boolean };
  writeValueWithResponse(data: BufferSource): Promise<void>;
  writeValueWithoutResponse(data: BufferSource): Promise<void>;
  startNotifications(): Promise<GattChar>;
  addEventListener(type: string, listener: (event: Event) => void): void;
  uuid: string;
};

type GattServer = {
  connect(): Promise<GattServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<GattChar> }>;
  connected?: boolean;
};

type BleDevice = {
  name?: string;
  gatt?: GattServer;
  addEventListener(type: string, listener: () => void): void;
};

let device: BleDevice | null = null;
let writeChar: GattChar | null = null;
let assembler = new FrameAssembler();
let queue: Promise<unknown> = Promise.resolve();
let running = false;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let lastSent: number | null = null;
let startedBelt = false;
let commandSince = 0;
let writesSinceMatch = 0;
let segmentSpoken = -1;
let disposedName = "";

function supportBluetooth(): "ready" | "missing" {
  return typeof navigator !== "undefined" && "bluetooth" in navigator ? "ready" : "missing";
}

function speak(text: string) {
  if (!snap.voice || typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 0.96;
  window.speechSynthesis.speak(utterance);
}

function persist() {
  if (typeof localStorage === "undefined") return;
  const saved: Saved = {
    consoleUnit: snap.consoleUnit,
    maxKmh: snap.maxKmh,
    voice: snap.voice,
    autoStart: snap.autoStart,
    fullWake: snap.fullWake,
    history: snap.history.slice(0, 12),
    planId: snap.plan.id,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function applySpot(elapsed: number, plan = snap.plan) {
  const spot = spotAt(plan, elapsed);
  return {
    plan,
    done: spot.done,
    segmentLabel: spot.done ? "Done" : spot.segment.label,
    cue: spot.done ? "Session finished. I'm slowing the belt to a stop." : spot.segment.cue,
    segmentIndex: spot.index,
    segmentLeft: spot.left,
    nextKmh: spot.next?.kmh ?? null,
    targetKmh: spot.done ? 0 : Math.min(snap.maxKmh, spot.segment.kmh),
  };
}

function rememberSession() {
  if (snap.elapsedSec < 45 && snap.distanceKm < 0.08) return;
  const item: HistoryItem = {
    id: `${Date.now()}`,
    title: snap.plan.name,
    km: Math.round(snap.distanceKm * 100) / 100,
    sec: Math.round(snap.elapsedSec),
    when: Date.now(),
  };
  commit({ history: [item, ...snap.history].slice(0, 12) });
  persist();
}

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function writeFrames(frames: number[][], label: string) {
  const characteristic = writeChar;
  if (!characteristic) throw new Error("Not linked");
  const withResponse = Boolean(characteristic.properties.write);
  for (const frame of frames) {
    const bytes = new Uint8Array(frame);
    if (withResponse) await characteristic.writeValueWithResponse(bytes);
    else await characteristic.writeValueWithoutResponse(bytes);
  }
  if (label !== "poll" && label !== "wake") note(label);
}

async function sendLogical(message: number[], label: string) {
  await writeFrames(frameMessage(message), label);
}

function onNotify(event: Event) {
  const view = (event.target as unknown as { value?: DataView | null }).value;
  if (!view) return;
  const frame = Array.from(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  const assembled = assembler.push(frame);
  if (!assembled || assembled === "unknown" || !assembled.complete) return;
  const parsed = parseMessage(assembled.message);
  if (!parsed.headerOk || parsed.dir !== "response") return;
  commit({ packets: snap.packets + 1 });
  if (!parsed.checksumOk || parsed.cmd !== 2) return;
  const live = readTelemetry(parsed);
  if (!live) return;
  const kmh = fromHundredths(live.speedRaw, snap.consoleUnit);
  if (kmh < 0 || kmh > 30) return;
  const actual = Math.round(kmh * 10) / 10;
  commit({ actualKmh: actual });
  if (actual > 0.3) startedBelt = true;
  considerMismatch(actual);
}

function considerMismatch(actual: number) {
  if (snap.mismatch || snap.commandKmh < 1.5 || writesSinceMatch < 3) return;
  const ratio = actual / snap.commandKmh;
  if (snap.consoleUnit === "kmh" && ratio > 1.45 && ratio < 1.8) {
    commit({
      mismatch: "The belt is moving about as fast as miles per hour. Switch the console unit to mph.",
    });
  } else if (snap.consoleUnit === "mph" && ratio > 0.55 && ratio < 0.72) {
    commit({
      mismatch: "The belt is moving like a km/h console. Switch the console unit to km/h.",
    });
  }
}

async function pushSpeed(kmh: number, reason: string) {
  const safe = Math.min(snap.maxKmh, Math.max(0, Math.round(kmh * 10) / 10));
  if (!snap.armed || snap.sim || !writeChar) {
    commit({ commandKmh: safe });
    return;
  }
  if (lastSent !== null && Math.abs(lastSent - safe) < 0.05) {
    commit({ commandKmh: safe });
    return;
  }
  if (safe > 0.2 && snap.autoStart && !startedBelt) {
    await writeFrames(START_FRAMES, "Start belt");
    startedBelt = true;
  }
  await writeFrames(speedFrames(safe, snap.consoleUnit), `${reason} ${safe.toFixed(1)} km/h`);
  lastSent = safe;
  writesSinceMatch += 1;
  commandSince = Date.now();
  commit({ commandKmh: safe, writes: snap.writes + 1 });
}

function stepCommand(): number {
  if (!snap.armed) return 0;
  if (snap.targetKmh <= 0) return 0;
  const goal = Math.min(snap.maxKmh, snap.targetKmh);
  const current = snap.commandKmh;
  if (Math.abs(goal - current) < 0.05) return goal;
  const step = 0.3;
  const next = current < goal ? Math.min(goal, current + step) : Math.max(goal, current - step);
  return Math.round(next * 10) / 10;
}

async function controlTick() {
  if (!snap.armed || snap.phase !== "live" || snap.sim) return;
  const next = stepCommand();
  if (next === 0 && (lastSent === null || lastSent === 0)) return;
  try {
    await enqueue(() => pushSpeed(next, "Set"));
  } catch (error) {
    note(error instanceof Error ? error.message : "Speed write failed");
  }
}

function schedulePoll() {
  if (!running) return;
  pollTimer = setTimeout(() => {
    void (async () => {
      if (!running || !writeChar) return;
      try {
        await enqueue(() => sendLogical(pollMessage(), "poll"));
        await controlTick();
      } catch (error) {
        note(error instanceof Error ? error.message : "Link write failed");
      }
      schedulePoll();
    })();
  }, 320);
}

function ensureTicks() {
  if (tickTimer !== null) return;
  let last = Date.now();
  tickTimer = setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.5, (now - last) / 1000);
    last = now;
    if (snap.phase !== "live") return;

    let actual = snap.actualKmh;
    let command = snap.commandKmh;
    if (snap.sim && snap.armed) {
      const goal = stepCommand();
      command = goal;
      const current = actual ?? 0;
      const diff = goal - current;
      const chase = Math.sign(diff) * Math.min(Math.abs(diff), 1.1 * dt);
      actual = Math.round((current + chase) * 100) / 100;
    }

    let elapsed = snap.elapsedSec;
    let distance = snap.distanceKm;
    const beltMoving = (actual ?? 0) > 0.2;
    const sessionOn = snap.following && !snap.manualHold && (snap.sim || snap.commandKmh > 0.15 || beltMoving);
    if (sessionOn) elapsed += dt;
    if (actual !== null && actual > 0.15) distance += (actual * dt) / 3600;

    let extra: Partial<Snap> = {
      actualKmh: actual,
      commandKmh: command,
      elapsedSec: elapsed,
      distanceKm: distance,
    };

    if (snap.following && !snap.manualHold) {
      const spot = applySpot(elapsed);
      extra = { ...extra, ...spot };
      if (spot.done && snap.targetKmh !== 0) {
        extra.following = false;
        extra.coachSay = "That's the session. Slowing to a stop.";
        speak("That's the session. I'm slowing the belt.");
        rememberSession();
      } else if (!spot.done && spot.segmentIndex !== segmentSpoken) {
        segmentSpoken = spot.segmentIndex;
        speak(spot.cue);
      }
    }

    const commanding = snap.armed && snap.commandKmh > 0.4 && (snap.actualKmh === null || snap.actualKmh < 0.2);
    if (!snap.sim && commanding && commandSince > 0 && now - commandSince > 8000) {
      extra.beltHint = snap.autoStart
        ? "I sent Start and the speed. If the belt is still stopped, press Start on the console, then pull the key if anything feels wrong."
        : "Speed is being sent. Press Start on the console if the belt hasn't moved. I won't press Start unless you allow it.";
    } else if (!commanding) {
      extra.beltHint = null;
    }

    commit(extra);
  }, 200);
}

function stopLoops() {
  running = false;
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
}

function detachGatt() {
  stopLoops();
  writeChar = null;
  assembler.reset();
  try {
    device?.gatt?.disconnect();
  } catch {
    /* already gone */
  }
  device = null;
}

function onDisconnected() {
  const moving = (snap.actualKmh ?? 0) > 0.3 || snap.commandKmh > 0.3;
  detachGatt();
  lastSent = null;
  commit({
    phase: snap.sim ? snap.phase : "idle",
    deviceName: snap.sim ? snap.deviceName : null,
    armed: snap.sim ? snap.armed : false,
    lostWhileMoving: moving && !snap.sim,
    wakingLabel: null,
    error: moving ? null : snap.error,
  });
  if (moving && !snap.sim) note("Link lost while the belt may still be moving");
}

async function handshake() {
  if (snap.fullWake) {
    const frames = cstWakeFrames();
    for (let index = 0; index < frames.length; index += 1) {
      if (!device?.gatt?.connected && device?.gatt?.connected !== undefined) break;
      commit({ wakingLabel: `Waking the console ${index + 1} of ${frames.length}` });
      await enqueue(() => writeFrames([frames[index]!], "wake"));
      await wait(260);
    }
    return;
  }

  let replies = 0;
  const reply = () =>
    new Promise<boolean>((resolve) => {
      const started = snap.packets;
      const timer = setInterval(() => {
        if (snap.packets > started) {
          clearInterval(timer);
          resolve(true);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(timer);
        resolve(false);
      }, 1100);
    });

  for (const question of QUESTIONS) {
    commit({ wakingLabel: `Asking ${question.label}` });
    await enqueue(() => sendLogical(request(question.equip, question.cmd, question.payload), `Ask ${question.label}`));
    if (await reply()) replies += 1;
    await wait(200);
  }
  if (replies === 0) {
    throw new Error("The console didn't answer. Wake the treadmill screen and try again.");
  }
  commit({ wakingLabel: "Unlocking the link" });
  await enqueue(() => sendLogical(unlockMessage(), "Unlock"));
  await wait(400);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openGatt(allDevices: boolean) {
  const bluetooth = (navigator as Navigator & {
    bluetooth: {
      requestDevice(options: unknown): Promise<BleDevice>;
    };
  }).bluetooth;
  const devicePick = await bluetooth.requestDevice(
    allDevices
      ? { acceptAllDevices: true, optionalServices: [SERVICE_UUID, ...EXTRA_UUIDS] }
      : {
          filters: [
            { namePrefix: "I_" },
            { namePrefix: "ProForm" },
            { namePrefix: "iFit" },
            { services: [SERVICE_UUID] },
          ],
          optionalServices: [SERVICE_UUID, ...EXTRA_UUIDS],
        },
  );
  device = devicePick;
  device.addEventListener("gattserverdisconnected", onDisconnected);
  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);
  const notify = await service.getCharacteristic(NOTIFY_UUID);
  writeChar = await service.getCharacteristic(WRITE_UUID);
  notify.addEventListener("characteristicvaluechanged", onNotify);
  await notify.startNotifications();
  disposedName = device.name || "Treadmill";
  commit({ deviceName: disposedName, phase: "waking", error: null, sim: false });
  note(`Linked ${disposedName}`);
}

export const deck = {
  get: () => snap,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  hydrate() {
    commit({ bluetooth: supportBluetooth() });
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Saved>;
      const plan = planById(typeof saved.planId === "string" ? saved.planId : "easy-four");
      const spot = applySpot(0, scalePlan(plan, Number(saved.maxKmh) || 10));
      commit({
        consoleUnit: saved.consoleUnit === "mph" ? "mph" : "kmh",
        maxKmh: Math.min(16, Math.max(3, Number(saved.maxKmh) || 10)),
        voice: saved.voice !== false,
        autoStart: Boolean(saved.autoStart),
        fullWake: Boolean(saved.fullWake),
        history: Array.isArray(saved.history) ? saved.history.slice(0, 12) : [],
        ...spot,
        commandKmh: 0,
        actualKmh: null,
        elapsedSec: 0,
        distanceKm: 0,
        following: false,
        armed: false,
      });
    } catch {
      /* ignore broken storage */
    }
  },
  async link(allDevices = false) {
    if (snap.phase === "connecting" || snap.phase === "waking") return;
    detachGatt();
    lastSent = null;
    startedBelt = false;
    writesSinceMatch = 0;
    assembler = new FrameAssembler();
    commit({
      phase: "connecting",
      sim: false,
      error: null,
      armed: false,
      following: false,
      actualKmh: null,
      commandKmh: 0,
      lostWhileMoving: false,
      packets: 0,
      writes: 0,
    });
    try {
      await openGatt(allDevices);
      await handshake();
      running = true;
      commit({ phase: "live", wakingLabel: null, cue: snap.cue });
      note("Live. Speed stays put until you let the coach drive.");
      ensureTicks();
      schedulePoll();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't link";
      const cancelled = /cancel|abort|user/i.test(message);
      detachGatt();
      commit({
        phase: cancelled ? "idle" : "error",
        error: cancelled ? null : message,
        wakingLabel: null,
      });
    }
  },
  async practice() {
    const moving = !snap.sim && ((snap.actualKmh ?? 0) > 0.2 || snap.commandKmh > 0.2);
    if (moving) {
      if (!writeChar) {
        commit({ lostWhileMoving: true });
        return;
      }
      try {
        await enqueue(() => pushSpeed(0, "Stop"));
      } catch {
        commit({ lostWhileMoving: true });
        return;
      }
    }
    detachGatt();
    lastSent = null;
    startedBelt = true;
    segmentSpoken = -1;
    const plan = scalePlan(snap.plan, snap.maxKmh);
    const spot = applySpot(0, plan);
    commit({
      phase: "live",
      sim: true,
      armed: true,
      following: true,
      manualHold: false,
      deviceName: "Simulated belt",
      error: null,
      actualKmh: 0,
      commandKmh: 0,
      distanceKm: 0,
      elapsedSec: 0,
      lostWhileMoving: false,
      writes: 0,
      packets: 0,
      coachSay: null,
      beltHint: null,
      ...spot,
    });
    segmentSpoken = 0;
    speak(spot.cue);
    ensureTicks();
    note("Simulated belt");
  },
  armAndFollow() {
    if (snap.phase !== "live") return;
    segmentSpoken = -1;
    const plan = scalePlan(snap.plan, snap.maxKmh);
    const spot = applySpot(0, plan);
    lastSent = null;
    commandSince = Date.now();
    commit({
      armed: true,
      following: true,
      manualHold: false,
      elapsedSec: 0,
      distanceKm: snap.sim ? 0 : snap.distanceKm,
      coachSay: snap.sim ? "Practice belt is following the session." : "I'm driving. Pull the key if you need it to stop now.",
      ...spot,
    });
    segmentSpoken = 0;
    speak(spot.cue);
    ensureTicks();
    persist();
  },
  async stop() {
    const wasMoving = snap.commandKmh > 0.2 || (snap.actualKmh ?? 0) > 0.2 || snap.following;
    rememberSession();
    commit({
      targetKmh: 0,
      commandKmh: 0,
      following: false,
      manualHold: false,
      coachSay: "Stopping. Setting the belt to zero.",
      cue: "Stopped. Pull the safety key if the belt is still moving.",
      beltHint: null,
    });
    speak("Stopping. Setting the belt to zero. Pull the key if it keeps moving.");
    if (!snap.sim && writeChar && snap.armed) {
      try {
        await enqueue(() => pushSpeed(0, "Stop"));
      } catch (error) {
        note(error instanceof Error ? error.message : "Stop write failed");
        if (wasMoving) commit({ lostWhileMoving: true });
      }
    }
  },
  selectPlan(id: string) {
    const plan = scalePlan(planById(id), snap.maxKmh);
    const spot = applySpot(0, plan);
    segmentSpoken = snap.following ? -1 : 0;
    commit({
      ...spot,
      elapsedSec: 0,
      following: snap.following && snap.armed,
      manualHold: false,
    });
    persist();
  },
  nudge(delta: number) {
    if (!snap.armed) return;
    const next = Math.min(snap.maxKmh, Math.max(0, Math.round((snap.targetKmh + delta) * 10) / 10));
    commit({
      manualHold: true,
      following: true,
      targetKmh: next,
      coachSay: `Holding ${next.toFixed(1)} until you hand it back.`,
      cue: `You set ${next.toFixed(1)}. The coach is paused.`,
      segmentLabel: "Manual",
    });
  },
  resumeCoach() {
    if (!snap.armed) return;
    const spot = applySpot(snap.elapsedSec);
    commit({ manualHold: false, following: true, coachSay: "Coach has the belt again.", ...spot });
    speak(spot.cue);
  },
  async ask(message: string) {
    const local = interpret(message, snap.maxKmh);
    if (local.kind === "stop") {
      await this.stop();
      return;
    }
    if (local.kind === "nudge") {
      if (!snap.armed && snap.phase === "live" && snap.sim) this.armAndFollow();
      this.nudge(local.delta);
      commit({ coachSay: local.say });
      speak(local.say);
      return;
    }
    if (local.kind === "plan") {
      this.usePlan(local.plan, local.say);
      return;
    }
    commit({ asking: true, error: null });
    try {
      const answer = await askCoach({ data: { message, maxKmh: snap.maxKmh } });
      if (!answer.ok) throw new Error(answer.error);
      this.usePlan(
        {
          id: "custom",
          name: answer.name,
          blurb: "Written by the coach for this session.",
          segments: answer.segments,
        },
        answer.say,
      );
    } catch (error) {
      commit({
        asking: false,
        coachSay:
          error instanceof Error && error.message !== "AI is not available"
            ? "I couldn't reach the coach. Try “4 km/h” or pick a saved session."
            : "The coach service isn't available. “4 km/h” or Easy four still drives the belt.",
      });
    }
  },
  usePlan(plan: Plan, say: string) {
    const scaled = scalePlan(plan, snap.maxKmh);
    const spot = applySpot(0, scaled);
    segmentSpoken = -1;
    commit({
      asking: false,
      coachSay: say,
      manualHold: false,
      elapsedSec: 0,
      following: snap.armed && snap.phase === "live",
      ...spot,
    });
    if (snap.armed && snap.phase === "live") {
      segmentSpoken = 0;
      speak(say);
    }
    persist();
  },
  setUnit(unit: ConsoleUnit) {
    commit({ consoleUnit: unit, mismatch: null });
    persist();
  },
  setMax(maxKmh: number) {
    const max = Math.min(16, Math.max(3, maxKmh));
    const plan = scalePlan(snap.plan, max);
    commit({ maxKmh: max, plan, targetKmh: Math.min(max, snap.targetKmh) });
    persist();
  },
  setVoice(voice: boolean) {
    commit({ voice });
    if (!voice && typeof window !== "undefined") window.speechSynthesis?.cancel();
    persist();
  },
  setAutoStart(autoStart: boolean) {
    commit({ autoStart });
    persist();
  },
  setFullWake(fullWake: boolean) {
    commit({ fullWake });
    persist();
  },
  dismissLost() {
    commit({ lostWhileMoving: false });
  },
  async disconnect() {
    const moving = !snap.sim && ((snap.actualKmh ?? 0) > 0.3 || snap.commandKmh > 0.3);
    let lost = false;
    if (moving) {
      if (!writeChar) lost = true;
      else {
        try {
          await enqueue(() => pushSpeed(0, "Stop"));
        } catch {
          lost = true;
        }
      }
    }
    detachGatt();
    commit({
      phase: "idle",
      sim: false,
      armed: false,
      following: false,
      deviceName: null,
      commandKmh: 0,
      targetKmh: 0,
      lostWhileMoving: lost,
      wakingLabel: null,
    });
  },
};
