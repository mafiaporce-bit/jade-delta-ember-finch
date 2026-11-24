import { i as __toESM } from "../_runtime.mjs";
import { b as require_jsx_runtime, q as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { a as ShieldAlert, c as Bluetooth, i as Square, n as Volume2, o as Plus, s as Minus, t as VolumeX } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DGikR8QM.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var clamp = (kmh, maxKmh) => Math.round(Math.min(maxKmh, Math.max(0, kmh)) * 10) / 10;
var PLANS = [
	{
		id: "easy-four",
		name: "Easy four",
		blurb: "Twenty minutes. The belt settles at 4.0 km/h.",
		segments: [
			{
				sec: 90,
				kmh: 3.2,
				label: "Ease in",
				cue: "Walking pace while the belt comes up. Short steps."
			},
			{
				sec: 180,
				kmh: 4,
				label: "Find four",
				cue: "Four kilometers an hour. Let your arms swing."
			},
			{
				sec: 720,
				kmh: 4,
				label: "Hold 4.0",
				cue: "Stay at four. This is the whole session."
			},
			{
				sec: 150,
				kmh: 3.2,
				label: "Ease out",
				cue: "I'm bringing the belt down. Keep walking it out."
			}
		]
	},
	{
		id: "walk-jog",
		name: "Walk–jog",
		blurb: "Easy walks with short jogs. Nothing sudden.",
		segments: [
			{
				sec: 180,
				kmh: 4,
				label: "Warm up",
				cue: "Four to start. Breathe through your nose if you can."
			},
			{
				sec: 60,
				kmh: 6,
				label: "Jog",
				cue: "Up to six. Light feet, stay tall."
			},
			{
				sec: 120,
				kmh: 4.2,
				label: "Walk back",
				cue: "Back to a walk. Shake your hands out."
			},
			{
				sec: 60,
				kmh: 6.5,
				label: "Jog",
				cue: "Six and a half. Same effort, not a sprint."
			},
			{
				sec: 120,
				kmh: 4.2,
				label: "Walk back",
				cue: "Walk. You've got another one after this."
			},
			{
				sec: 60,
				kmh: 7,
				label: "Jog",
				cue: "Last jog, seven. Then we walk it home."
			},
			{
				sec: 150,
				kmh: 4,
				label: "Cool down",
				cue: "Four again. I'm done asking for speed."
			}
		]
	},
	{
		id: "build-30",
		name: "30-minute build",
		blurb: "Starts at 4 and tops out wherever you set the ceiling.",
		segments: [
			{
				sec: 240,
				kmh: 4,
				label: "Base",
				cue: "Four kilometers an hour. This is the floor."
			},
			{
				sec: 240,
				kmh: 4.8,
				label: "A bit more",
				cue: "Up a little. You should still talk."
			},
			{
				sec: 300,
				kmh: 5.6,
				label: "Steady",
				cue: "Hold this. Look ahead, not at your feet."
			},
			{
				sec: 300,
				kmh: 6.4,
				label: "Push",
				cue: "This is the hard block. It ends."
			},
			{
				sec: 240,
				kmh: 5,
				label: "Settle",
				cue: "Coming off the push. Stay smooth."
			},
			{
				sec: 180,
				kmh: 4,
				label: "Down",
				cue: "Back to four. Nice work."
			}
		]
	}
];
function planById(id) {
	return PLANS.find((plan) => plan.id === id) ?? PLANS[0];
}
function planSeconds(plan) {
	return plan.segments.reduce((total, segment) => total + segment.sec, 0);
}
function spotAt(plan, elapsedSec) {
	let cursor = 0;
	for (let index = 0; index < plan.segments.length; index += 1) {
		const segment = plan.segments[index];
		if (elapsedSec < cursor + segment.sec) return {
			index,
			segment,
			left: Math.max(0, cursor + segment.sec - elapsedSec),
			next: plan.segments[index + 1] ?? null,
			done: false
		};
		cursor += segment.sec;
	}
	const last = plan.segments[plan.segments.length - 1];
	return {
		index: plan.segments.length - 1,
		segment: last,
		left: 0,
		next: null,
		done: true
	};
}
function steadyPlan(kmh, minutes, maxKmh) {
	const pace = clamp(kmh, maxKmh);
	const hold = Math.min(45, Math.max(5, Math.round(minutes))) * 60;
	const ease = clamp(Math.max(2.5, pace - .8), maxKmh);
	return {
		id: "custom",
		name: `${pace.toFixed(1)} km/h`,
		blurb: "A steady pace with an easy start and finish.",
		segments: [
			{
				sec: 90,
				kmh: ease,
				label: "Ease in",
				cue: `Starting easier, then I'll set ${pace.toFixed(1)}.`
			},
			{
				sec: hold,
				kmh: pace,
				label: `Hold ${pace.toFixed(1)}`,
				cue: `Holding ${pace.toFixed(1)} kilometers an hour.`
			},
			{
				sec: 90,
				kmh: ease,
				label: "Ease out",
				cue: "Easing the belt down. Stay on until it slows."
			}
		]
	};
}
function interpret(message, maxKmh) {
	const text = message.trim().toLowerCase();
	if (!text) return { kind: "need-ai" };
	if (/\b(stop|halt|end|finish)\b/.test(text)) return {
		kind: "stop",
		say: "Stopping. I'm setting the belt to zero."
	};
	if (/\b(slower|ease|easier|too fast)\b/.test(text)) return {
		kind: "nudge",
		delta: -.5,
		say: "Slowing it by half a kilometer an hour."
	};
	if (/\b(faster|speed up|harder|pick it up)\b/.test(text)) return {
		kind: "nudge",
		delta: .4,
		say: "A little faster. Half a step, not a jump."
	};
	if (/\b(interval|jog)\b/.test(text)) return {
		kind: "plan",
		plan: scalePlan(planById("walk-jog"), maxKmh),
		say: "Walk–jog. I'll raise and lower the belt between the blocks."
	};
	if (/\b(easy|walk|recovery)\b/.test(text) && !/\d/.test(text)) return {
		kind: "plan",
		plan: scalePlan(planById("easy-four"), maxKmh),
		say: "Easy four. I'll hold the belt at four kilometers an hour."
	};
	if (/\b(30|build|longer)\b/.test(text) && !/\bkm/.test(text)) return {
		kind: "plan",
		plan: scalePlan(planById("build-30"), maxKmh),
		say: "Thirty-minute build. The belt steps up, then comes home."
	};
	const speed = text.match(/(\d+(?:\.\d+)?)\s*(?:km\/h|kmh|kph|km\b|kilometers?)/);
	const minutes = text.match(/(\d+)\s*(?:min|minutes)/);
	const bare = text.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
	const kmh = speed ? Number(speed[1]) : bare ? Number(bare[1]) : null;
	if (kmh !== null && Number.isFinite(kmh)) {
		const plan = steadyPlan(kmh, minutes ? Number(minutes[1]) : 12, maxKmh);
		return {
			kind: "plan",
			plan,
			say: `I'll bring the belt to ${(plan.segments[1]?.kmh ?? kmh).toFixed(1)} kilometers an hour and hold it.`
		};
	}
	if (text.split(/\s+/).length >= 5 || text.includes("?")) return { kind: "need-ai" };
	return { kind: "need-ai" };
}
function scalePlan(plan, maxKmh) {
	return {
		...plan,
		segments: plan.segments.map((segment) => ({
			...segment,
			kmh: clamp(segment.kmh, maxKmh)
		}))
	};
}
function formatClock(totalSeconds) {
	const seconds = Math.max(0, Math.round(totalSeconds));
	const minutes = Math.floor(seconds / 60);
	const rest = seconds % 60;
	return `${minutes}:${String(rest).padStart(2, "0")}`;
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var askCoach = createServerFn({ method: "POST" }).validator((input) => {
	const message = String(input?.message ?? "").trim().slice(0, 400);
	if (message.length < 2) throw new Error("Tell the coach what you want.");
	return {
		message,
		maxKmh: Math.min(16, Math.max(3, Number(input?.maxKmh) || 10))
	};
}).handler(createSsrRpc("861ae09dc4355757cd09cec0672f549e77413042938986e69873ee585a5bc46d"));
/** iFit / ProForm 105 CST link.
* Read path matches the handshake already working on this treadmill.
* Speed writes match the 105 CST command used by qdomyos-zwift
* (checksum = speed_lo + speed_hi + 0x11, which is the standard body sum).
*/
var SERVICE_UUID = "00001533-1412-efde-1523-785feabcd123";
var WRITE_UUID = "00001534-1412-efde-1523-785feabcd123";
var NOTIFY_UUID = "00001535-1412-efde-1523-785feabcd123";
var EXTRA_UUIDS = ["00001530-1212-efde-1523-785feabcd123", "00001400-555e-e99c-e511-f9f4f8daeb24"];
var KMH_PER_MPH = 1.609344;
function checksum(bytes) {
	let sum = 0;
	for (const byte of bytes) sum = sum + byte & 255;
	return sum;
}
/** Logical request: 02 04 02 len | equip len cmd payload | checksum */
function request(equip, cmd, payload = []) {
	const length = payload.length + 4;
	const body = [
		equip,
		length,
		cmd,
		...payload
	];
	return [
		2,
		4,
		2,
		length,
		...body,
		checksum(body)
	];
}
function frameMessage(message) {
	const chunks = [];
	for (let index = 0; index < message.length; index += 18) chunks.push(message.slice(index, index + 18));
	const frames = [[
		254,
		2,
		message.length,
		chunks.length + 1
	]];
	chunks.forEach((chunk, index) => {
		const frame = [
			index === chunks.length - 1 ? 255 : index,
			chunk.length,
			...chunk
		];
		while (frame.length < 20) frame.push(0);
		frames.push(frame);
	});
	return frames;
}
function parseHex(value) {
	const clean = value.replace(/[^0-9a-fA-F]/g, "");
	const out = [];
	for (let index = 0; index < clean.length; index += 2) out.push(parseInt(clean.slice(index, index + 2), 16));
	return out;
}
function toHundredths(kmh, unit) {
	const shown = unit === "mph" ? kmh / KMH_PER_MPH : kmh;
	return Math.max(0, Math.min(65535, Math.round(shown * 100)));
}
function fromHundredths(raw, unit) {
	const shown = raw / 100;
	const kmh = unit === "mph" ? shown * KMH_PER_MPH : shown;
	return Math.round(kmh * 100) / 100;
}
/** Speed write. `hundredths` is in the console's own unit (4.00 km/h → 400). */
function speedMessage(hundredths) {
	const raw = Math.max(0, Math.min(65535, Math.round(hundredths)));
	return request(4, 2, [
		1,
		1,
		raw & 255,
		raw >> 8 & 255,
		0
	]);
}
function speedFrames(kmh, unit) {
	return frameMessage(speedMessage(toHundredths(kmh, unit)));
}
var POLL_READ = [
	19,
	148,
	51,
	0,
	16,
	64,
	16,
	0,
	128,
	24
];
function pollMessage() {
	return request(4, 2, [
		0,
		POLL_READ.length,
		...POLL_READ
	]);
}
var QUESTIONS = [
	{
		label: "0x81",
		equip: 2,
		cmd: 129,
		payload: []
	},
	{
		label: "0x80",
		equip: 4,
		cmd: 128,
		payload: []
	},
	{
		label: "0x88",
		equip: 4,
		cmd: 136,
		payload: []
	},
	{
		label: "0x82",
		equip: 2,
		cmd: 130,
		payload: [0, 0]
	},
	{
		label: "0x84",
		equip: 2,
		cmd: 132,
		payload: [0, 0]
	},
	{
		label: "0x95",
		equip: 2,
		cmd: 149,
		payload: []
	}
];
var UNLOCK_PAYLOAD = [
	4,
	0,
	97,
	216,
	93,
	208,
	81,
	208,
	85,
	232,
	97,
	248,
	141,
	0,
	145,
	32,
	213,
	72,
	225,
	152,
	61,
	208,
	113,
	16,
	181,
	72,
	225,
	184,
	77,
	224,
	177,
	64,
	128,
	2,
	0,
	0
];
function unlockMessage() {
	return request(4, 144, UNLOCK_PAYLOAD);
}
/** Already-framed Start sequence for the 105 CST. Only after an explicit opt-in. */
var START_FRAMES = [
	[
		254,
		2,
		32,
		3
	],
	[
		0,
		18,
		2,
		4,
		2,
		28,
		4,
		28,
		2,
		9,
		0,
		0,
		64,
		2,
		24,
		64,
		0,
		0,
		128,
		48
	],
	[
		255,
		14,
		42,
		0,
		0,
		239,
		26,
		88,
		2,
		0,
		180,
		0,
		88,
		2,
		0,
		16,
		0,
		0,
		0,
		0
	],
	[
		254,
		2,
		17,
		2
	],
	[
		255,
		17,
		2,
		4,
		2,
		13,
		4,
		13,
		2,
		2,
		3,
		16,
		160,
		0,
		0,
		0,
		10,
		0,
		210,
		0
	]
];
/** Full 105 CST wake captured from the iFit control sequence. Optional, off by default. */
var CST_WAKE_HEX = [
	"fe020802",
	"ff08020402040204818700000000000000000000",
	"fe020802",
	"ff08020402040404808800000000000000000000",
	"fe020802",
	"ff08020402040404889000000000000000000000",
	"fe020b02",
	"ff0b020402070207820000008b00000000000000",
	"fe020a02",
	"ff0a0204020602068400008c0000000000000000",
	"fe020802",
	"ff08020402040204959b00000000000000000000",
	"fe022c04",
	"0012020402280428900701ea943ce29648f8ae52",
	"01121cc48a4e10d0965a04ccb2665808fea28c74",
	"ff085a3e2080020000e000000000000000000000",
	"fe021903",
	"0012020402150415020e00000000000000000000",
	"ff070000001001003a0000000000000000000000",
	"fe021703",
	"0012020402130413020c00000000000000000000",
	"ff0500800000a500000000000000000000000000",
	"fe021703",
	"001202040213041302000d001000c01c480000e0",
	"ff05000000104a00000000000000000000000000",
	"fe021703",
	"001202040213041302000d119471001040000080",
	"ff05000000818d00000000000000000000000000",
	"fe021102",
	"ff110204020d040d020500000000085802007a00",
	"fe021102",
	"ff110204020d040d020500000000085802007a00",
	"fe021903",
	"0012020402150415020e00000000000000000000",
	"ff070000001001003a0000000000000000000000",
	"fe021002",
	"ff100204020c040c020400000002e41f001b0000",
	"fe021703",
	"001202040213041302000d800000000000000000",
	"ff0500000010b600000000000000000000000000",
	"fe021002",
	"ff100204020c040c020500000000100100280000"
];
function cstWakeFrames() {
	return CST_WAKE_HEX.map(parseHex);
}
function parseMessage(bytes) {
	const unknown = {
		dir: "unknown",
		headerOk: false,
		lengthOk: false,
		checksumOk: false,
		equip: -1,
		cmd: -1,
		payload: []
	};
	if (bytes.length < 8) return unknown;
	const dir = bytes[0] === 2 ? "request" : bytes[0] === 1 ? "response" : "unknown";
	const headerOk = dir !== "unknown" && bytes[1] === 4 && bytes[2] === 2;
	const length = bytes[3] ?? 0;
	return {
		dir,
		headerOk,
		lengthOk: length === bytes[5] && bytes.length === length + 4,
		checksumOk: checksum(bytes.slice(4, -1)) === bytes[bytes.length - 1],
		equip: bytes[4] ?? -1,
		cmd: bytes[6] ?? -1,
		payload: bytes.slice(7, -1)
	};
}
function readTelemetry(message) {
	if (message.dir !== "response" || message.cmd !== 2 || message.payload.length < 5) return null;
	const speedRaw = (message.payload[1] ?? 0) | (message.payload[2] ?? 0) << 8;
	let inclineRaw = (message.payload[3] ?? 0) | (message.payload[4] ?? 0) << 8;
	if (inclineRaw & 32768) inclineRaw -= 65536;
	if (speedRaw > 4e3) return null;
	return {
		speedRaw,
		inclineRaw
	};
}
var FrameAssembler = class {
	buf = [];
	expect = -1;
	active = false;
	reset() {
		this.buf = [];
		this.expect = -1;
		this.active = false;
	}
	push(frame) {
		if (frame.length < 2) return "unknown";
		if (frame[0] === 254 && frame[1] === 2 && frame.length >= 4) {
			this.buf = [];
			this.expect = frame[2] ?? -1;
			this.active = true;
			return null;
		}
		const size = frame[1] ?? 0;
		if (size < 1 || size > 18 || size > frame.length - 2) return "unknown";
		if (frame[0] === 255) {
			const message = this.buf.concat(frame.slice(2, 2 + size));
			const complete = this.expect < 0 || message.length === this.expect;
			this.reset();
			return {
				message,
				complete
			};
		}
		if ((frame[0] ?? 0) > 32) return "unknown";
		if (!this.active || frame[0] === 0) {
			if (!this.active) this.expect = -1;
			if (frame[0] === 0) this.buf = [];
			this.active = true;
		}
		this.buf = this.buf.concat(frame.slice(2, 2 + size));
		return null;
	}
};
var STORAGE_KEY = "pace-coach-v1";
var listeners = /* @__PURE__ */ new Set();
function emptySnap() {
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
		wakingLabel: null
	};
}
var snap = emptySnap();
function emit() {
	listeners.forEach((listener) => listener());
}
function commit(partial) {
	snap = {
		...snap,
		...partial
	};
	emit();
}
function note(line) {
	const stamp = formatClock(Math.floor(Date.now() / 1e3) % 3600);
	snap = {
		...snap,
		log: [`${stamp}  ${line}`, ...snap.log].slice(0, 8)
	};
	emit();
}
var device = null;
var writeChar = null;
var assembler = new FrameAssembler();
var queue = Promise.resolve();
var running = false;
var tickTimer = null;
var pollTimer = null;
var lastSent = null;
var startedBelt = false;
var commandSince = 0;
var writesSinceMatch = 0;
var segmentSpoken = -1;
var disposedName = "";
function supportBluetooth() {
	return typeof navigator !== "undefined" && "bluetooth" in navigator ? "ready" : "missing";
}
function speak(text) {
	if (!snap.voice || typeof window === "undefined" || !window.speechSynthesis) return;
	window.speechSynthesis.cancel();
	const utterance = new SpeechSynthesisUtterance(text);
	utterance.rate = 1;
	utterance.pitch = .96;
	window.speechSynthesis.speak(utterance);
}
function persist() {
	if (typeof localStorage === "undefined") return;
	const saved = {
		consoleUnit: snap.consoleUnit,
		maxKmh: snap.maxKmh,
		voice: snap.voice,
		autoStart: snap.autoStart,
		fullWake: snap.fullWake,
		history: snap.history.slice(0, 12),
		planId: snap.plan.id
	};
	localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}
function applySpot(elapsed, plan = snap.plan) {
	const spot = spotAt(plan, elapsed);
	return {
		plan,
		done: spot.done,
		segmentLabel: spot.done ? "Done" : spot.segment.label,
		cue: spot.done ? "Session finished. I'm slowing the belt to a stop." : spot.segment.cue,
		segmentIndex: spot.index,
		segmentLeft: spot.left,
		nextKmh: spot.next?.kmh ?? null,
		targetKmh: spot.done ? 0 : Math.min(snap.maxKmh, spot.segment.kmh)
	};
}
function rememberSession() {
	if (snap.elapsedSec < 45 && snap.distanceKm < .08) return;
	commit({ history: [{
		id: `${Date.now()}`,
		title: snap.plan.name,
		km: Math.round(snap.distanceKm * 100) / 100,
		sec: Math.round(snap.elapsedSec),
		when: Date.now()
	}, ...snap.history].slice(0, 12) });
	persist();
}
function enqueue(work) {
	const run = queue.then(work, work);
	queue = run.then(() => void 0, () => void 0);
	return run;
}
async function writeFrames(frames, label) {
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
async function sendLogical(message, label) {
	await writeFrames(frameMessage(message), label);
}
function onNotify(event) {
	const view = event.target.value;
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
	if (actual > .3) startedBelt = true;
	considerMismatch(actual);
}
function considerMismatch(actual) {
	if (snap.mismatch || snap.commandKmh < 1.5 || writesSinceMatch < 3) return;
	const ratio = actual / snap.commandKmh;
	if (snap.consoleUnit === "kmh" && ratio > 1.45 && ratio < 1.8) commit({ mismatch: "The belt is moving about as fast as miles per hour. Switch the console unit to mph." });
	else if (snap.consoleUnit === "mph" && ratio > .55 && ratio < .72) commit({ mismatch: "The belt is moving like a km/h console. Switch the console unit to km/h." });
}
async function pushSpeed(kmh, reason) {
	const safe = Math.min(snap.maxKmh, Math.max(0, Math.round(kmh * 10) / 10));
	if (!snap.armed || snap.sim || !writeChar) {
		commit({ commandKmh: safe });
		return;
	}
	if (lastSent !== null && Math.abs(lastSent - safe) < .05) {
		commit({ commandKmh: safe });
		return;
	}
	if (safe > .2 && snap.autoStart && !startedBelt) {
		await writeFrames(START_FRAMES, "Start belt");
		startedBelt = true;
	}
	await writeFrames(speedFrames(safe, snap.consoleUnit), `${reason} ${safe.toFixed(1)} km/h`);
	lastSent = safe;
	writesSinceMatch += 1;
	commandSince = Date.now();
	commit({
		commandKmh: safe,
		writes: snap.writes + 1
	});
}
function stepCommand() {
	if (!snap.armed) return 0;
	if (snap.targetKmh <= 0) return 0;
	const goal = Math.min(snap.maxKmh, snap.targetKmh);
	const current = snap.commandKmh;
	if (Math.abs(goal - current) < .05) return goal;
	const step = .3;
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
		(async () => {
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
		const dt = Math.min(.5, (now - last) / 1e3);
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
		const beltMoving = (actual ?? 0) > .2;
		if (snap.following && !snap.manualHold && (snap.sim || snap.commandKmh > .15 || beltMoving)) elapsed += dt;
		if (actual !== null && actual > .15) distance += actual * dt / 3600;
		let extra = {
			actualKmh: actual,
			commandKmh: command,
			elapsedSec: elapsed,
			distanceKm: distance
		};
		if (snap.following && !snap.manualHold) {
			const spot = applySpot(elapsed);
			extra = {
				...extra,
				...spot
			};
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
		const commanding = snap.armed && snap.commandKmh > .4 && (snap.actualKmh === null || snap.actualKmh < .2);
		if (!snap.sim && commanding && commandSince > 0 && now - commandSince > 8e3) extra.beltHint = snap.autoStart ? "I sent Start and the speed. If the belt is still stopped, press Start on the console, then pull the key if anything feels wrong." : "Speed is being sent. Press Start on the console if the belt hasn't moved. I won't press Start unless you allow it.";
		else if (!commanding) extra.beltHint = null;
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
	} catch {}
	device = null;
}
function onDisconnected() {
	const moving = (snap.actualKmh ?? 0) > .3 || snap.commandKmh > .3;
	detachGatt();
	lastSent = null;
	commit({
		phase: snap.sim ? snap.phase : "idle",
		deviceName: snap.sim ? snap.deviceName : null,
		armed: snap.sim ? snap.armed : false,
		lostWhileMoving: moving && !snap.sim,
		wakingLabel: null,
		error: moving ? null : snap.error
	});
	if (moving && !snap.sim) note("Link lost while the belt may still be moving");
}
async function handshake() {
	if (snap.fullWake) {
		const frames = cstWakeFrames();
		for (let index = 0; index < frames.length; index += 1) {
			if (!device?.gatt?.connected && device?.gatt?.connected !== void 0) break;
			commit({ wakingLabel: `Waking the console ${index + 1} of ${frames.length}` });
			await enqueue(() => writeFrames([frames[index]], "wake"));
			await wait(260);
		}
		return;
	}
	let replies = 0;
	const reply = () => new Promise((resolve) => {
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
	if (replies === 0) throw new Error("The console didn't answer. Wake the treadmill screen and try again.");
	commit({ wakingLabel: "Unlocking the link" });
	await enqueue(() => sendLogical(unlockMessage(), "Unlock"));
	await wait(400);
}
function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
async function openGatt(allDevices) {
	device = await navigator.bluetooth.requestDevice(allDevices ? {
		acceptAllDevices: true,
		optionalServices: [SERVICE_UUID, ...EXTRA_UUIDS]
	} : {
		filters: [
			{ namePrefix: "I_" },
			{ namePrefix: "ProForm" },
			{ namePrefix: "iFit" },
			{ services: [SERVICE_UUID] }
		],
		optionalServices: [SERVICE_UUID, ...EXTRA_UUIDS]
	});
	device.addEventListener("gattserverdisconnected", onDisconnected);
	const service = await (await device.gatt.connect()).getPrimaryService(SERVICE_UUID);
	const notify = await service.getCharacteristic(NOTIFY_UUID);
	writeChar = await service.getCharacteristic(WRITE_UUID);
	notify.addEventListener("characteristicvaluechanged", onNotify);
	await notify.startNotifications();
	disposedName = device.name || "Treadmill";
	commit({
		deviceName: disposedName,
		phase: "waking",
		error: null,
		sim: false
	});
	note(`Linked ${disposedName}`);
}
var deck = {
	get: () => snap,
	subscribe(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
	hydrate() {
		commit({ bluetooth: supportBluetooth() });
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const saved = JSON.parse(raw);
			const spot = applySpot(0, scalePlan(planById(typeof saved.planId === "string" ? saved.planId : "easy-four"), Number(saved.maxKmh) || 10));
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
				armed: false
			});
		} catch {}
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
			writes: 0
		});
		try {
			await openGatt(allDevices);
			await handshake();
			running = true;
			commit({
				phase: "live",
				wakingLabel: null,
				cue: snap.cue
			});
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
				wakingLabel: null
			});
		}
	},
	async practice() {
		if (!snap.sim && ((snap.actualKmh ?? 0) > .2 || snap.commandKmh > .2)) {
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
		const spot = applySpot(0, scalePlan(snap.plan, snap.maxKmh));
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
			...spot
		});
		segmentSpoken = 0;
		speak(spot.cue);
		ensureTicks();
		note("Simulated belt");
	},
	armAndFollow() {
		if (snap.phase !== "live") return;
		segmentSpoken = -1;
		const spot = applySpot(0, scalePlan(snap.plan, snap.maxKmh));
		lastSent = null;
		commandSince = Date.now();
		commit({
			armed: true,
			following: true,
			manualHold: false,
			elapsedSec: 0,
			distanceKm: snap.sim ? 0 : snap.distanceKm,
			coachSay: snap.sim ? "Practice belt is following the session." : "I'm driving. Pull the key if you need it to stop now.",
			...spot
		});
		segmentSpoken = 0;
		speak(spot.cue);
		ensureTicks();
		persist();
	},
	async stop() {
		const wasMoving = snap.commandKmh > .2 || (snap.actualKmh ?? 0) > .2 || snap.following;
		rememberSession();
		commit({
			targetKmh: 0,
			commandKmh: 0,
			following: false,
			manualHold: false,
			coachSay: "Stopping. Setting the belt to zero.",
			cue: "Stopped. Pull the safety key if the belt is still moving.",
			beltHint: null
		});
		speak("Stopping. Setting the belt to zero. Pull the key if it keeps moving.");
		if (!snap.sim && writeChar && snap.armed) try {
			await enqueue(() => pushSpeed(0, "Stop"));
		} catch (error) {
			note(error instanceof Error ? error.message : "Stop write failed");
			if (wasMoving) commit({ lostWhileMoving: true });
		}
	},
	selectPlan(id) {
		const spot = applySpot(0, scalePlan(planById(id), snap.maxKmh));
		segmentSpoken = snap.following ? -1 : 0;
		commit({
			...spot,
			elapsedSec: 0,
			following: snap.following && snap.armed,
			manualHold: false
		});
		persist();
	},
	nudge(delta) {
		if (!snap.armed) return;
		const next = Math.min(snap.maxKmh, Math.max(0, Math.round((snap.targetKmh + delta) * 10) / 10));
		commit({
			manualHold: true,
			following: true,
			targetKmh: next,
			coachSay: `Holding ${next.toFixed(1)} until you hand it back.`,
			cue: `You set ${next.toFixed(1)}. The coach is paused.`,
			segmentLabel: "Manual"
		});
	},
	resumeCoach() {
		if (!snap.armed) return;
		const spot = applySpot(snap.elapsedSec);
		commit({
			manualHold: false,
			following: true,
			coachSay: "Coach has the belt again.",
			...spot
		});
		speak(spot.cue);
	},
	async ask(message) {
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
		commit({
			asking: true,
			error: null
		});
		try {
			const answer = await askCoach({ data: {
				message,
				maxKmh: snap.maxKmh
			} });
			if (!answer.ok) throw new Error(answer.error);
			this.usePlan({
				id: "custom",
				name: answer.name,
				blurb: "Written by the coach for this session.",
				segments: answer.segments
			}, answer.say);
		} catch (error) {
			commit({
				asking: false,
				coachSay: error instanceof Error && error.message !== "AI is not available" ? "I couldn't reach the coach. Try “4 km/h” or pick a saved session." : "The coach service isn't available. “4 km/h” or Easy four still drives the belt."
			});
		}
	},
	usePlan(plan, say) {
		const spot = applySpot(0, scalePlan(plan, snap.maxKmh));
		segmentSpoken = -1;
		commit({
			asking: false,
			coachSay: say,
			manualHold: false,
			elapsedSec: 0,
			following: snap.armed && snap.phase === "live",
			...spot
		});
		if (snap.armed && snap.phase === "live") {
			segmentSpoken = 0;
			speak(say);
		}
		persist();
	},
	setUnit(unit) {
		commit({
			consoleUnit: unit,
			mismatch: null
		});
		persist();
	},
	setMax(maxKmh) {
		const max = Math.min(16, Math.max(3, maxKmh));
		commit({
			maxKmh: max,
			plan: scalePlan(snap.plan, max),
			targetKmh: Math.min(max, snap.targetKmh)
		});
		persist();
	},
	setVoice(voice) {
		commit({ voice });
		if (!voice && typeof window !== "undefined") window.speechSynthesis?.cancel();
		persist();
	},
	setAutoStart(autoStart) {
		commit({ autoStart });
		persist();
	},
	setFullWake(fullWake) {
		commit({ fullWake });
		persist();
	},
	dismissLost() {
		commit({ lostWhileMoving: false });
	},
	async disconnect() {
		const moving = !snap.sim && ((snap.actualKmh ?? 0) > .3 || snap.commandKmh > .3);
		let lost = false;
		if (moving) {
			if (!writeChar) lost = true;
			else try {
				await enqueue(() => pushSpeed(0, "Stop"));
			} catch {
				lost = true;
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
			wakingLabel: null
		});
	}
};
function pace(value) {
	if (value === null || value === void 0 || Number.isNaN(value)) return "—";
	return value.toFixed(1);
}
function Deck() {
	const snap = (0, import_react.useSyncExternalStore)(deck.subscribe, deck.get, deck.get);
	const [sheet, setSheet] = (0, import_react.useState)(false);
	const [keyOn, setKeyOn] = (0, import_react.useState)(false);
	const [canPull, setCanPull] = (0, import_react.useState)(false);
	const [askText, setAskText] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		deck.hydrate();
	}, []);
	const shown = snap.actualKmh ?? (snap.armed ? snap.commandKmh : 0);
	const caption = snap.actualKmh !== null ? "km/h on the belt" : snap.armed ? "km/h being sent" : "km/h · belt idle";
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto min-h-dvh max-w-5xl px-4 py-5 sm:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-start justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-4xl leading-none tracking-wide text-fg",
					children: "PACE"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Coach for the ProForm 105 CST"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Status, { snap })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "rounded-3xl border border-line bg-surface p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "sm:flex sm:items-end sm:justify-between sm:gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-7xl leading-none tracking-tight text-fg tabular-nums sm:text-8xl",
								children: pace(shown)
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-sm text-muted sm:mt-0 sm:pb-2 sm:text-right",
								children: [caption, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "mt-1 block text-fg",
									children: ["target ", pace(snap.armed ? snap.targetKmh : snap.plan.segments[0]?.kmh)]
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full bg-signal",
								style: { width: `${Math.min(100, shown / snap.maxKmh * 100)}%` }
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
							className: "mt-4 grid grid-cols-3 gap-2 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "Time",
									value: formatClock(snap.elapsedSec)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "Distance",
									value: `${snap.distanceKm.toFixed(2)} km`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "Sent",
									value: snap.armed ? pace(snap.commandKmh) : "—"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => void deck.stop(),
							className: "mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-stop text-lg font-semibold text-on-stop",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, {
								className: "size-5 fill-current",
								"aria-hidden": "true"
							}), "Stop the belt"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-center text-xs text-muted",
							children: "Not an emergency stop. If anything feels wrong, pull the safety key."
						}),
						snap.beltHint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 rounded-2xl bg-surface-2 px-3 py-2 text-sm text-warn",
							children: snap.beltHint
						}) : null,
						snap.mismatch ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 rounded-2xl bg-surface-2 px-3 py-2 text-sm text-warn",
							children: snap.mismatch
						}) : null,
						snap.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 rounded-2xl bg-surface-2 px-3 py-2 text-sm text-stop",
							children: snap.error
						}) : null,
						snap.wakingLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-signal",
							children: snap.wakingLabel
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": "Slower by 0.1",
									disabled: !snap.armed,
									onClick: () => deck.nudge(-.1),
									className: "flex size-12 items-center justify-center rounded-2xl border border-line bg-surface-2 text-fg disabled:opacity-40",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minus, {
										className: "size-5",
										"aria-hidden": "true"
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-center text-sm text-muted",
									children: snap.manualHold ? "You have the speed" : "Nudge the belt"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": "Faster by 0.1",
									disabled: !snap.armed,
									onClick: () => deck.nudge(.1),
									className: "flex size-12 items-center justify-center rounded-2xl border border-line bg-surface-2 text-fg disabled:opacity-40",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
										className: "size-5",
										"aria-hidden": "true"
									})
								})
							]
						}),
						snap.manualHold ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => deck.resumeCoach(),
							className: "mt-2 min-h-11 w-full rounded-2xl text-sm font-medium text-signal",
							children: "Hand the speed back to the coach"
						}) : null
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "flex flex-col gap-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-3xl border border-line bg-surface p-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-baseline justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-lg font-semibold",
										children: snap.plan.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-muted",
										children: formatClock(total)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-3 flex h-2 gap-1",
									children: snap.plan.segments.map((segment, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										style: { flexGrow: segment.sec },
										className: index < (snap.following ? snap.segmentIndex : -1) ? "rounded-full bg-signal-dim" : index === snap.segmentIndex && snap.following ? "rounded-full bg-signal" : "rounded-full bg-line"
									}, `${segment.label}-${index}`))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-3 text-sm text-muted",
									children: [
										snap.segmentLabel,
										snap.following ? ` · ${formatClock(snap.segmentLeft)} left` : "",
										snap.nextKmh !== null ? ` · next ${pace(snap.nextKmh)}` : ""
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3 border-l-2 border-signal pl-3 text-base leading-relaxed",
									children: snap.cue
								}),
								snap.coachSay ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3 text-sm text-muted",
									children: snap.coachSay
								}) : null,
								snap.sim ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3 text-sm text-signal",
									children: "Simulated belt. Nothing is being sent to a treadmill."
								}) : null,
								!snap.armed || !snap.following ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: openDrive,
									disabled: snap.phase === "connecting" || snap.phase === "waking",
									className: "mt-4 min-h-12 w-full rounded-2xl bg-signal text-base font-semibold text-on-signal disabled:opacity-40",
									children: snap.phase === "connecting" || snap.phase === "waking" ? "Linking…" : linked && !snap.sim ? "Let the coach drive" : snap.sim ? "Run this session" : "Let the coach drive"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-4 text-sm text-signal",
									children: "Coach is setting the belt."
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-2",
							children: PLANS.map((plan) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => deck.selectPlan(plan.id),
								className: snap.plan.id === plan.id ? "min-h-11 rounded-full bg-signal px-4 text-sm font-semibold text-on-signal" : "min-h-11 rounded-full border border-line bg-surface px-4 text-sm text-fg",
								children: plan.name
							}, plan.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							className: "flex gap-2",
							onSubmit: (event) => {
								event.preventDefault();
								const text = askText.trim();
								if (!text) return;
								setAskText("");
								deck.ask(text);
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "sr-only",
									htmlFor: "ask",
									children: "Ask the coach"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									id: "ask",
									value: askText,
									onChange: (event) => setAskText(event.target.value),
									placeholder: "Hold 4 km/h for 20 minutes",
									autoComplete: "off",
									className: "min-h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 text-base text-fg placeholder:text-muted"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "submit",
									disabled: snap.asking,
									className: "min-h-12 rounded-2xl bg-surface-2 px-4 text-sm font-semibold text-fg disabled:opacity-40",
									children: snap.asking ? "…" : "Ask"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => void deck.link(false),
								disabled: snap.bluetooth === "missing" || snap.phase === "connecting" || snap.phase === "waking",
								className: "flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-medium disabled:opacity-40",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bluetooth, {
									className: "size-4",
									"aria-hidden": "true"
								}), linked && !snap.sim ? "Linked" : "Link treadmill"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void deck.practice(),
								className: "min-h-12 rounded-2xl border border-line bg-surface text-sm font-medium",
								children: "Practice the coach"
							})]
						}),
						snap.bluetooth === "missing" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "This browser can't reach the treadmill. Use Chrome or Edge on the phone or laptop you already connect with. Practice still runs the whole session."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "Stand next to the console. The coach changes speed only after you arm it, and it ramps — it does not jump."
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Setup, { snap }),
			snap.log.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 space-y-1 font-mono text-xs text-muted",
				children: snap.log.map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: line }, line))
			}) : null,
			snap.history.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-medium text-muted",
					children: "On this phone"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 divide-y divide-line rounded-2xl border border-line",
					children: snap.history.slice(0, 4).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-baseline justify-between gap-3 px-4 py-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.title }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted",
							children: [
								item.km.toFixed(2),
								" km · ",
								formatClock(item.sec)
							]
						})]
					}, item.id))
				})]
			}) : null,
			sheet ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-20 flex items-end justify-center bg-bg/80 p-4 sm:items-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-md rounded-3xl border border-line bg-surface p-5",
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": "arm-title",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-signal",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
								className: "size-5",
								"aria-hidden": "true"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								id: "arm-title",
								className: "text-lg font-semibold text-fg",
								children: "Before the belt moves"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm leading-relaxed text-muted",
							children: "The coach will send speed to the treadmill. Incline stays on the knob. Pull the red key to stop for real — this app cannot do that if the link drops."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "mt-4 flex min-h-11 items-start gap-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: keyOn,
								onChange: (event) => setKeyOn(event.target.checked),
								className: "mt-1 size-5"
							}), "The safety key is clipped on."]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "mt-2 flex min-h-11 items-start gap-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: canPull,
								onChange: (event) => setCanPull(event.target.checked),
								className: "mt-1 size-5"
							}), "I can pull that key immediately."]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "mt-2 flex min-h-11 items-start gap-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: snap.autoStart,
								onChange: (event) => deck.setAutoStart(event.target.checked),
								className: "mt-1 size-5"
							}), "Also press Start for me. Leave this off if you already start the console yourself."]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-5 grid grid-cols-2 gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setSheet(false),
								className: "min-h-12 rounded-2xl border border-line",
								children: "Not yet"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: !keyOn || !canPull,
								onClick: () => void confirmDrive(),
								className: "min-h-12 rounded-2xl bg-signal font-semibold text-on-signal disabled:opacity-40",
								children: "Drive"
							})]
						})
					]
				})
			}) : null,
			snap.lostWhileMoving ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-30 flex items-center justify-center bg-bg p-6 text-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-6xl leading-none text-stop",
							children: "PULL THE KEY"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-base leading-relaxed",
							children: "The link dropped while the belt may still be moving. This app cannot stop it. Pull the safety key, then step off."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => deck.dismissLost(),
							className: "mt-6 min-h-12 w-full rounded-2xl bg-stop font-semibold text-on-stop",
							children: "I pulled the key"
						})
					]
				})
			}) : null
		]
	});
}
function Status({ snap }) {
	const live = snap.phase === "live";
	const label = snap.sim ? "Practice" : snap.phase === "connecting" || snap.phase === "waking" ? "Linking" : live ? snap.deviceName || "Linked" : snap.phase === "error" ? "No link" : "Not linked";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: live ? "live-dot size-2 rounded-full bg-signal" : "size-2 rounded-full bg-muted" }), label]
	});
}
function Stat({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl bg-surface-2 px-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "text-xs text-muted",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "mt-0.5 font-medium tabular-nums",
			children: value
		})]
	});
}
function Setup({ snap }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
		className: "mt-5 rounded-3xl border border-line bg-surface px-4 py-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
			className: "min-h-11 cursor-pointer text-sm font-medium",
			children: "Treadmill setup"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-3 grid gap-4 pb-2 text-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Console shows" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UnitButton, {
							current: snap.consoleUnit,
							value: "kmh",
							label: "km/h"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UnitButton, {
							current: snap.consoleUnit,
							value: "mph",
							label: "mph"
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "grid gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex justify-between",
						children: ["Fastest the coach may set ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "tabular-nums",
							children: [snap.maxKmh.toFixed(1), " km/h"]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "range",
						min: 3,
						max: 16,
						step: .5,
						value: snap.maxKmh,
						onChange: (event) => deck.setMax(Number(event.target.value))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex min-h-11 items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Full 105 CST wake if speed is ignored" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: snap.fullWake,
						onChange: (event) => deck.setFullWake(event.target.checked),
						className: "size-5"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted",
					children: "Leave that off the first time. Your current link already wakes the console. Turn it on and link again only if the belt never follows the number."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Spoken cues" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => deck.setVoice(!snap.voice),
						className: "flex min-h-11 items-center gap-2 rounded-full border border-line px-3",
						"aria-pressed": snap.voice,
						children: [snap.voice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "size-4" }), snap.voice ? "On" : "Off"]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => void deck.link(true),
					className: "min-h-11 text-left text-muted underline",
					children: "My treadmill isn't named I_TL — show every nearby device"
				}),
				snap.phase === "live" && !snap.sim ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => void deck.disconnect(),
					className: "min-h-11 text-left text-muted",
					children: "Disconnect"
				}) : null
			]
		})]
	});
}
function UnitButton({ current, value, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick: () => deck.setUnit(value),
		className: current === value ? "min-h-11 rounded-full bg-signal px-4 font-semibold text-on-signal" : "min-h-11 rounded-full border border-line px-4",
		children: label
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Deck, {});
}
//#endregion
export { Home as component };
