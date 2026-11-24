import { useEffect, useState } from "react";
import { useSyncExternalStore } from "react";
import { Bluetooth, Minus, Plus, ShieldAlert, Square, Volume2, VolumeX } from "lucide-react";
import { PLANS, formatClock, planSeconds } from "@/lib/coach/plans";
import { deck, type Snap } from "@/lib/deck-store";

function pace(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(1);
}

export function Deck() {
  const snap = useSyncExternalStore(deck.subscribe, deck.get, deck.get);
  const [sheet, setSheet] = useState(false);
  const [keyOn, setKeyOn] = useState(false);
  const [canPull, setCanPull] = useState(false);
  const [askText, setAskText] = useState("");

  useEffect(() => {
    deck.hydrate();
  }, []);

  const shown = snap.actualKmh ?? (snap.armed ? snap.commandKmh : 0);
  const caption =
    snap.actualKmh !== null ? "km/h on the belt" : snap.armed ? "km/h being sent" : "km/h · belt idle";
  const total = planSeconds(snap.plan);
  const linked = snap.phase === "live";

  function openDrive() {
    if (snap.sim && linked) {
      deck.armAndFollow();
      return;
    }
    setKeyOn(false);
    setCanPull(false);
    setSheet(true);
  }

  async function confirmDrive() {
    setSheet(false);
    if (snap.phase !== "live") await deck.link(false);
    if (deck.get().phase === "live") deck.armAndFollow();
  }

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-4 py-5 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-4xl leading-none tracking-wide text-fg">PACE</p>
          <p className="mt-1 text-sm text-muted">Coach for the ProForm 105 CST</p>
        </div>
        <Status snap={snap} />
      </header>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="rounded-3xl border border-line bg-surface p-5">
          <div className="sm:flex sm:items-end sm:justify-between sm:gap-3">
            <p className="font-display text-7xl leading-none tracking-tight text-fg tabular-nums sm:text-8xl">
              {pace(shown)}
            </p>
            <p className="mt-2 text-sm text-muted sm:mt-0 sm:pb-2 sm:text-right">
              {caption}
              <span className="mt-1 block text-fg">
                target {pace(snap.armed ? snap.targetKmh : snap.plan.segments[0]?.kmh)}
              </span>
            </p>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full bg-signal"
              style={{ width: `${Math.min(100, (shown / snap.maxKmh) * 100)}%` }}
            />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <Stat label="Time" value={formatClock(snap.elapsedSec)} />
            <Stat label="Distance" value={`${snap.distanceKm.toFixed(2)} km`} />
            <Stat label="Sent" value={snap.armed ? pace(snap.commandKmh) : "—"} />
          </dl>

          <button
            type="button"
            onClick={() => void deck.stop()}
            className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-stop text-lg font-semibold text-on-stop"
          >
            <Square className="size-5 fill-current" aria-hidden="true" />
            Stop the belt
          </button>
          <p className="mt-2 text-center text-xs text-muted">
            Not an emergency stop. If anything feels wrong, pull the safety key.
          </p>

          {snap.beltHint ? (
            <p className="mt-3 rounded-2xl bg-surface-2 px-3 py-2 text-sm text-warn">{snap.beltHint}</p>
          ) : null}
          {snap.mismatch ? (
            <p className="mt-3 rounded-2xl bg-surface-2 px-3 py-2 text-sm text-warn">{snap.mismatch}</p>
          ) : null}
          {snap.error ? (
            <p className="mt-3 rounded-2xl bg-surface-2 px-3 py-2 text-sm text-stop">{snap.error}</p>
          ) : null}
          {snap.wakingLabel ? (
            <p className="mt-3 text-sm text-signal">{snap.wakingLabel}</p>
          ) : null}

          <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <button
              type="button"
              aria-label="Slower by 0.1"
              disabled={!snap.armed}
              onClick={() => deck.nudge(-0.1)}
              className="flex size-12 items-center justify-center rounded-2xl border border-line bg-surface-2 text-fg disabled:opacity-40"
            >
              <Minus className="size-5" aria-hidden="true" />
            </button>
            <p className="text-center text-sm text-muted">
              {snap.manualHold ? "You have the speed" : "Nudge the belt"}
            </p>
            <button
              type="button"
              aria-label="Faster by 0.1"
              disabled={!snap.armed}
              onClick={() => deck.nudge(0.1)}
              className="flex size-12 items-center justify-center rounded-2xl border border-line bg-surface-2 text-fg disabled:opacity-40"
            >
              <Plus className="size-5" aria-hidden="true" />
            </button>
          </div>
          {snap.manualHold ? (
            <button
              type="button"
              onClick={() => deck.resumeCoach()}
              className="mt-2 min-h-11 w-full rounded-2xl text-sm font-medium text-signal"
            >
              Hand the speed back to the coach
            </button>
          ) : null}
        </section>

        <section className="flex flex-col gap-4">
          <div className="rounded-3xl border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">{snap.plan.name}</h2>
              <p className="text-sm text-muted">{formatClock(total)}</p>
            </div>
            <div className="mt-3 flex h-2 gap-1">
              {snap.plan.segments.map((segment, index) => (
                <div
                  key={`${segment.label}-${index}`}
                  style={{ flexGrow: segment.sec }}
                  className={
                    index < (snap.following ? snap.segmentIndex : -1)
                      ? "rounded-full bg-signal-dim"
                      : index === snap.segmentIndex && snap.following
                        ? "rounded-full bg-signal"
                        : "rounded-full bg-line"
                  }
                />
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">
              {snap.segmentLabel}
              {snap.following ? ` · ${formatClock(snap.segmentLeft)} left` : ""}
              {snap.nextKmh !== null ? ` · next ${pace(snap.nextKmh)}` : ""}
            </p>
            <p className="mt-3 border-l-2 border-signal pl-3 text-base leading-relaxed">{snap.cue}</p>
            {snap.coachSay ? <p className="mt-3 text-sm text-muted">{snap.coachSay}</p> : null}
            {snap.sim ? (
              <p className="mt-3 text-sm text-signal">Simulated belt. Nothing is being sent to a treadmill.</p>
            ) : null}

            {!snap.armed || !snap.following ? (
              <button
                type="button"
                onClick={openDrive}
                disabled={snap.phase === "connecting" || snap.phase === "waking"}
                className="mt-4 min-h-12 w-full rounded-2xl bg-signal text-base font-semibold text-on-signal disabled:opacity-40"
              >
                {snap.phase === "connecting" || snap.phase === "waking"
                  ? "Linking…"
                  : linked && !snap.sim
                    ? "Let the coach drive"
                    : snap.sim
                      ? "Run this session"
                      : "Let the coach drive"}
              </button>
            ) : (
              <p className="mt-4 text-sm text-signal">Coach is setting the belt.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => deck.selectPlan(plan.id)}
                className={
                  snap.plan.id === plan.id
                    ? "min-h-11 rounded-full bg-signal px-4 text-sm font-semibold text-on-signal"
                    : "min-h-11 rounded-full border border-line bg-surface px-4 text-sm text-fg"
                }
              >
                {plan.name}
              </button>
            ))}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const text = askText.trim();
              if (!text) return;
              setAskText("");
              void deck.ask(text);
            }}
          >
            <label className="sr-only" htmlFor="ask">
              Ask the coach
            </label>
            <input
              id="ask"
              value={askText}
              onChange={(event) => setAskText(event.target.value)}
              placeholder="Hold 4 km/h for 20 minutes"
              autoComplete="off"
              className="min-h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 text-base text-fg placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={snap.asking}
              className="min-h-12 rounded-2xl bg-surface-2 px-4 text-sm font-semibold text-fg disabled:opacity-40"
            >
              {snap.asking ? "…" : "Ask"}
            </button>
          </form>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void deck.link(false)}
              disabled={snap.bluetooth === "missing" || snap.phase === "connecting" || snap.phase === "waking"}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-medium disabled:opacity-40"
            >
              <Bluetooth className="size-4" aria-hidden="true" />
              {linked && !snap.sim ? "Linked" : "Link treadmill"}
            </button>
            <button
              type="button"
              onClick={() => void deck.practice()}
              className="min-h-12 rounded-2xl border border-line bg-surface text-sm font-medium"
            >
              Practice the coach
            </button>
          </div>
          {snap.bluetooth === "missing" ? (
            <p className="text-sm text-muted">
              This browser can't reach the treadmill. Use Chrome or Edge on the phone or laptop you already
              connect with. Practice still runs the whole session.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Stand next to the console. The coach changes speed only after you arm it, and it ramps — it does
              not jump.
            </p>
          )}
        </section>
      </div>

      <Setup snap={snap} />

      {snap.log.length > 0 ? (
        <ul className="mt-4 space-y-1 font-mono text-xs text-muted">
          {snap.log.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      {snap.history.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-muted">On this phone</h2>
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
            {snap.history.slice(0, 4).map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
                <span>{item.title}</span>
                <span className="text-muted">
                  {item.km.toFixed(2)} km · {formatClock(item.sec)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sheet ? (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-bg/80 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-5" role="dialog" aria-modal="true" aria-labelledby="arm-title">
            <div className="flex items-center gap-2 text-signal">
              <ShieldAlert className="size-5" aria-hidden="true" />
              <h2 id="arm-title" className="text-lg font-semibold text-fg">
                Before the belt moves
              </h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              The coach will send speed to the treadmill. Incline stays on the knob. Pull the red key to stop
              for real — this app cannot do that if the link drops.
            </p>
            <label className="mt-4 flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" checked={keyOn} onChange={(event) => setKeyOn(event.target.checked)} className="mt-1 size-5" />
              The safety key is clipped on.
            </label>
            <label className="mt-2 flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" checked={canPull} onChange={(event) => setCanPull(event.target.checked)} className="mt-1 size-5" />
              I can pull that key immediately.
            </label>
            <label className="mt-2 flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={snap.autoStart}
                onChange={(event) => deck.setAutoStart(event.target.checked)}
                className="mt-1 size-5"
              />
              Also press Start for me. Leave this off if you already start the console yourself.
            </label>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setSheet(false)} className="min-h-12 rounded-2xl border border-line">
                Not yet
              </button>
              <button
                type="button"
                disabled={!keyOn || !canPull}
                onClick={() => void confirmDrive()}
                className="min-h-12 rounded-2xl bg-signal font-semibold text-on-signal disabled:opacity-40"
              >
                Drive
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {snap.lostWhileMoving ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-bg p-6 text-center">
          <div className="max-w-sm">
            <p className="font-display text-6xl leading-none text-stop">PULL THE KEY</p>
            <p className="mt-4 text-base leading-relaxed">
              The link dropped while the belt may still be moving. This app cannot stop it. Pull the safety key,
              then step off.
            </p>
            <button
              type="button"
              onClick={() => deck.dismissLost()}
              className="mt-6 min-h-12 w-full rounded-2xl bg-stop font-semibold text-on-stop"
            >
              I pulled the key
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Status({ snap }: { snap: Snap }) {
  const live = snap.phase === "live";
  const label = snap.sim
    ? "Practice"
    : snap.phase === "connecting" || snap.phase === "waking"
      ? "Linking"
      : live
        ? snap.deviceName || "Linked"
        : snap.phase === "error"
          ? "No link"
          : "Not linked";
  return (
    <p className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-sm">
      <span className={live ? "live-dot size-2 rounded-full bg-signal" : "size-2 rounded-full bg-muted"} />
      {label}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Setup({ snap }: { snap: Snap }) {
  return (
    <details className="mt-5 rounded-3xl border border-line bg-surface px-4 py-3">
      <summary className="min-h-11 cursor-pointer text-sm font-medium">Treadmill setup</summary>
      <div className="mt-3 grid gap-4 pb-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Console shows</span>
          <div className="flex gap-2">
            <UnitButton current={snap.consoleUnit} value="kmh" label="km/h" />
            <UnitButton current={snap.consoleUnit} value="mph" label="mph" />
          </div>
        </div>
        <label className="grid gap-2">
          <span className="flex justify-between">
            Fastest the coach may set <span className="tabular-nums">{snap.maxKmh.toFixed(1)} km/h</span>
          </span>
          <input
            type="range"
            min={3}
            max={16}
            step={0.5}
            value={snap.maxKmh}
            onChange={(event) => deck.setMax(Number(event.target.value))}
          />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span>Full 105 CST wake if speed is ignored</span>
          <input
            type="checkbox"
            checked={snap.fullWake}
            onChange={(event) => deck.setFullWake(event.target.checked)}
            className="size-5"
          />
        </label>
        <p className="text-muted">
          Leave that off the first time. Your current link already wakes the console. Turn it on and link again
          only if the belt never follows the number.
        </p>
        <div className="flex items-center justify-between">
          <span>Spoken cues</span>
          <button
            type="button"
            onClick={() => deck.setVoice(!snap.voice)}
            className="flex min-h-11 items-center gap-2 rounded-full border border-line px-3"
            aria-pressed={snap.voice}
          >
            {snap.voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            {snap.voice ? "On" : "Off"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => void deck.link(true)}
          className="min-h-11 text-left text-muted underline"
        >
          My treadmill isn't named I_TL — show every nearby device
        </button>
        {snap.phase === "live" && !snap.sim ? (
          <button type="button" onClick={() => void deck.disconnect()} className="min-h-11 text-left text-muted">
            Disconnect
          </button>
        ) : null}
      </div>
    </details>
  );
}

function UnitButton({
  current,
  value,
  label,
}: {
  current: Snap["consoleUnit"];
  value: Snap["consoleUnit"];
  label: string;
}) {
  const on = current === value;
  return (
    <button
      type="button"
      onClick={() => deck.setUnit(value)}
      className={
        on
          ? "min-h-11 rounded-full bg-signal px-4 font-semibold text-on-signal"
          : "min-h-11 rounded-full border border-line px-4"
      }
    >
      {label}
    </button>
  );
}
