/** iFit / ProForm 105 CST link.
 * Read path matches the handshake already working on this treadmill.
 * Speed writes match the 105 CST command used by qdomyos-zwift
 * (checksum = speed_lo + speed_hi + 0x11, which is the standard body sum).
 */

export const SERVICE_UUID = "00001533-1412-efde-1523-785feabcd123";
export const WRITE_UUID = "00001534-1412-efde-1523-785feabcd123";
export const NOTIFY_UUID = "00001535-1412-efde-1523-785feabcd123";
export const EXTRA_UUIDS = [
  "00001530-1212-efde-1523-785feabcd123",
  "00001400-555e-e99c-e511-f9f4f8daeb24",
];

export const KMH_PER_MPH = 1.609344;

export function checksum(bytes: number[]): number {
  let sum = 0;
  for (const byte of bytes) sum = (sum + byte) & 255;
  return sum;
}

/** Logical request: 02 04 02 len | equip len cmd payload | checksum */
export function request(equip: number, cmd: number, payload: number[] = []): number[] {
  const length = payload.length + 4;
  const body = [equip, length, cmd, ...payload];
  return [0x02, 0x04, 0x02, length, ...body, checksum(body)];
}

export function frameMessage(message: number[]): number[][] {
  const chunks: number[][] = [];
  for (let index = 0; index < message.length; index += 18) {
    chunks.push(message.slice(index, index + 18));
  }
  const frames: number[][] = [[0xfe, 0x02, message.length, chunks.length + 1]];
  chunks.forEach((chunk, index) => {
    const frame = [index === chunks.length - 1 ? 0xff : index, chunk.length, ...chunk];
    while (frame.length < 20) frame.push(0);
    frames.push(frame);
  });
  return frames;
}

export function hex(bytes: number[], separator = " "): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(separator);
}

export function parseHex(value: string): number[] {
  const clean = value.replace(/[^0-9a-fA-F]/g, "");
  const out: number[] = [];
  for (let index = 0; index < clean.length; index += 2) {
    out.push(parseInt(clean.slice(index, index + 2), 16));
  }
  return out;
}

export type ConsoleUnit = "kmh" | "mph";

export function toHundredths(kmh: number, unit: ConsoleUnit): number {
  const shown = unit === "mph" ? kmh / KMH_PER_MPH : kmh;
  return Math.max(0, Math.min(0xffff, Math.round(shown * 100)));
}

export function fromHundredths(raw: number, unit: ConsoleUnit): number {
  const shown = raw / 100;
  const kmh = unit === "mph" ? shown * KMH_PER_MPH : shown;
  return Math.round(kmh * 100) / 100;
}

/** Speed write. `hundredths` is in the console's own unit (4.00 km/h → 400). */
export function speedMessage(hundredths: number): number[] {
  const raw = Math.max(0, Math.min(0xffff, Math.round(hundredths)));
  return request(4, 0x02, [0x01, 0x01, raw & 255, (raw >> 8) & 255, 0x00]);
}

export function speedFrames(kmh: number, unit: ConsoleUnit): number[][] {
  return frameMessage(speedMessage(toHundredths(kmh, unit)));
}

const POLL_READ = [19, 148, 51, 0, 16, 64, 16, 0, 128, 24];

export function pollMessage(): number[] {
  return request(4, 0x02, [0, POLL_READ.length, ...POLL_READ]);
}

export const QUESTIONS: { label: string; equip: number; cmd: number; payload: number[] }[] = [
  { label: "0x81", equip: 2, cmd: 0x81, payload: [] },
  { label: "0x80", equip: 4, cmd: 0x80, payload: [] },
  { label: "0x88", equip: 4, cmd: 0x88, payload: [] },
  { label: "0x82", equip: 2, cmd: 0x82, payload: [0, 0] },
  { label: "0x84", equip: 2, cmd: 0x84, payload: [0, 0] },
  { label: "0x95", equip: 2, cmd: 0x95, payload: [] },
];

const UNLOCK_PAYLOAD = [
  4, 0, 97, 216, 93, 208, 81, 208, 85, 232, 97, 248, 141, 0, 145, 32, 213, 72, 225, 152, 61, 208,
  113, 16, 181, 72, 225, 184, 77, 224, 177, 64, 128, 2, 0, 0,
];

export function unlockMessage(): number[] {
  return request(4, 0x90, UNLOCK_PAYLOAD);
}

/** Already-framed Start sequence for the 105 CST. Only after an explicit opt-in. */
export const START_FRAMES: number[][] = [
  [0xfe, 0x02, 0x20, 0x03],
  [
    0x00, 0x12, 0x02, 0x04, 0x02, 0x1c, 0x04, 0x1c, 0x02, 0x09, 0x00, 0x00, 0x40, 0x02, 0x18, 0x40,
    0x00, 0x00, 0x80, 0x30,
  ],
  [
    0xff, 0x0e, 0x2a, 0x00, 0x00, 0xef, 0x1a, 0x58, 0x02, 0x00, 0xb4, 0x00, 0x58, 0x02, 0x00, 0x10,
    0x00, 0x00, 0x00, 0x00,
  ],
  [0xfe, 0x02, 0x11, 0x02],
  [
    0xff, 0x11, 0x02, 0x04, 0x02, 0x0d, 0x04, 0x0d, 0x02, 0x02, 0x03, 0x10, 0xa0, 0x00, 0x00, 0x00,
    0x0a, 0x00, 0xd2, 0x00,
  ],
];

/** Full 105 CST wake captured from the iFit control sequence. Optional, off by default. */
export const CST_WAKE_HEX = [
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
  "ff100204020c040c020500000000100100280000",
];

export function cstWakeFrames(): number[][] {
  return CST_WAKE_HEX.map(parseHex);
}

export type ParsedMessage = {
  dir: "request" | "response" | "unknown";
  headerOk: boolean;
  lengthOk: boolean;
  checksumOk: boolean;
  equip: number;
  cmd: number;
  payload: number[];
};

export function parseMessage(bytes: number[]): ParsedMessage {
  const unknown: ParsedMessage = {
    dir: "unknown",
    headerOk: false,
    lengthOk: false,
    checksumOk: false,
    equip: -1,
    cmd: -1,
    payload: [],
  };
  if (bytes.length < 8) return unknown;
  const dir = bytes[0] === 2 ? "request" : bytes[0] === 1 ? "response" : "unknown";
  const headerOk = dir !== "unknown" && bytes[1] === 4 && bytes[2] === 2;
  const length = bytes[3] ?? 0;
  const lengthOk = length === bytes[5] && bytes.length === length + 4;
  const checksumOk = checksum(bytes.slice(4, -1)) === bytes[bytes.length - 1];
  return {
    dir,
    headerOk,
    lengthOk,
    checksumOk,
    equip: bytes[4] ?? -1,
    cmd: bytes[6] ?? -1,
    payload: bytes.slice(7, -1),
  };
}

export function readTelemetry(message: ParsedMessage): { speedRaw: number; inclineRaw: number } | null {
  if (message.dir !== "response" || message.cmd !== 2 || message.payload.length < 5) return null;
  const speedRaw = (message.payload[1] ?? 0) | ((message.payload[2] ?? 0) << 8);
  let inclineRaw = (message.payload[3] ?? 0) | ((message.payload[4] ?? 0) << 8);
  if (inclineRaw & 0x8000) inclineRaw -= 0x10000;
  if (speedRaw > 4000) return null;
  return { speedRaw, inclineRaw };
}

export class FrameAssembler {
  private buf: number[] = [];
  private expect = -1;
  private active = false;

  reset(): void {
    this.buf = [];
    this.expect = -1;
    this.active = false;
  }

  push(frame: number[]): { message: number[]; complete: boolean } | "unknown" | null {
    if (frame.length < 2) return "unknown";
    if (frame[0] === 0xfe && frame[1] === 0x02 && frame.length >= 4) {
      this.buf = [];
      this.expect = frame[2] ?? -1;
      this.active = true;
      return null;
    }
    const size = frame[1] ?? 0;
    if (size < 1 || size > 18 || size > frame.length - 2) return "unknown";
    if (frame[0] === 0xff) {
      const message = this.buf.concat(frame.slice(2, 2 + size));
      const complete = this.expect < 0 || message.length === this.expect;
      this.reset();
      return { message, complete };
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
}
