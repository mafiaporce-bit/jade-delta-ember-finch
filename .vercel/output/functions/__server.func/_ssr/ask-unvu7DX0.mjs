import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ask-unvu7DX0.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function clampPlan(raw, maxKmh) {
	if (!raw || typeof raw !== "object") return null;
	const record = raw;
	const say = String(record.say ?? "").trim().slice(0, 280);
	const name = String(record.name ?? "Coach session").trim().slice(0, 32) || "Coach session";
	if (!Array.isArray(record.segments) || record.segments.length === 0 || record.segments.length > 12) return null;
	const segments = [];
	for (const item of record.segments) {
		if (!item || typeof item !== "object") return null;
		const row = item;
		const sec = Math.round(Number(row.sec));
		const kmh = Math.round(Number(row.kmh) * 10) / 10;
		if (!Number.isFinite(sec) || !Number.isFinite(kmh)) return null;
		segments.push({
			sec: Math.min(1200, Math.max(30, sec)),
			kmh: Math.min(maxKmh, Math.max(0, kmh)),
			label: String(row.label ?? "Pace").trim().slice(0, 24) || "Pace",
			cue: String(row.cue ?? "").trim().slice(0, 160)
		});
	}
	for (let index = 1; index < segments.length; index += 1) {
		const previous = segments[index - 1].kmh;
		const current = segments[index];
		if (current.kmh === 0) continue;
		if (current.kmh > previous + 2) current.kmh = Math.round((previous + 2) * 10) / 10;
		if (current.kmh < previous - 2) current.kmh = Math.round(Math.max(0, previous - 2) * 10) / 10;
	}
	if (segments[0].kmh > Math.min(maxKmh, 4.5)) segments[0].kmh = Math.min(maxKmh, 4);
	return {
		ok: true,
		say: say || "Here's the session. I'll set the belt one block at a time.",
		name,
		segments
	};
}
var askCoach_createServerFn_handler = createServerRpc({
	id: "861ae09dc4355757cd09cec0672f549e77413042938986e69873ee585a5bc46d",
	name: "askCoach",
	filename: "src/lib/coach/ask.ts"
}, (opts) => askCoach.__executeServer(opts));
var askCoach = createServerFn({ method: "POST" }).validator((input) => {
	const message = String(input?.message ?? "").trim().slice(0, 400);
	if (message.length < 2) throw new Error("Tell the coach what you want.");
	return {
		message,
		maxKmh: Math.min(16, Math.max(3, Number(input?.maxKmh) || 10))
	};
}).handler(askCoach_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return {
		ok: false,
		error: "AI is not available"
	};
	const response = await fetch("https://api.x.ai/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: "grok-4.5",
			temperature: .3,
			max_tokens: 700,
			messages: [{
				role: "system",
				content: "You are the coach inside a treadmill app for a ProForm 105 CST. The app sets belt speed over Bluetooth. Incline is a hand knob — never claim you changed it. Speeds are km/h. Never exceed the user's max. Use 0 only as a final stop. Adjacent blocks must not differ by more than 2 km/h. The first block should be 4.5 or slower. Total time 8 to 40 minutes unless the user names a duration. Reply with ONLY JSON: {\"say\":\"one or two short sentences you will speak\",\"name\":\"short session name\",\"segments\":[{\"sec\":120,\"kmh\":4,\"label\":\"Easy\",\"cue\":\"short cue\"}]}"
			}, {
				role: "user",
				content: `Max speed ${data.maxKmh} km/h. Request: ${data.message}`
			}]
		})
	});
	if (!response.ok) return {
		ok: false,
		error: `Coach unavailable (${response.status})`
	};
	const text = (await response.json()).choices?.[0]?.message?.content ?? "";
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) return {
		ok: false,
		error: "Coach reply was not a session."
	};
	try {
		return clampPlan(JSON.parse(text.slice(start, end + 1)), data.maxKmh) ?? {
			ok: false,
			error: "Coach reply was not a session."
		};
	} catch {
		return {
			ok: false,
			error: "Coach reply was not a session."
		};
	}
});
//#endregion
export { askCoach_createServerFn_handler };
