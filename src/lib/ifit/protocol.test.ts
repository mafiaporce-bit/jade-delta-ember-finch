import assert from "node:assert/strict";
import test from "node:test";
import {
  QUESTIONS,
  checksum,
  frameMessage,
  hex,
  parseMessage,
  request,
  speedFrames,
  speedMessage,
} from "./protocol.ts";

test("4.00 km/h matches the 105 CST speed frame", () => {
  const frames = speedFrames(4, "kmh");
  assert.equal(hex(frames[0]!, ""), "FE020D02");
  assert.equal(hex(frames[1]!, ""), "FF0D020402090409020101900100A20000000000");
  const body = [4, 9, 2, 1, 1, 0x90, 0x01, 0];
  assert.equal(checksum(body), 0xa2);
});

test("stop is a zero speed write, not a special opcode", () => {
  const message = speedMessage(0);
  const parsed = parseMessage(message);
  assert.equal(parsed.cmd, 2);
  assert.equal(parsed.payload[0], 1);
  assert.equal(parsed.payload[2], 0);
  assert.equal(parsed.payload[3], 0);
  assert.equal(parsed.checksumOk, true);
});

test("startup questions match the known iFit wake frames", () => {
  const expected = [
    ["FE020802", "FF08020402040204818700000000000000000000"],
    ["FE020802", "FF08020402040404808800000000000000000000"],
    ["FE020802", "FF08020402040404889000000000000000000000"],
    ["FE020A02", "FF0A0204020602068200008A0000000000000000"],
    ["FE020A02", "FF0A0204020602068400008C0000000000000000"],
    ["FE020802", "FF08020402040204959B00000000000000000000"],
  ];
  QUESTIONS.forEach((question, index) => {
    const frames = frameMessage(request(question.equip, question.cmd, question.payload));
    assert.deepEqual(
      frames.map((frame) => hex(frame, "")),
      expected[index],
    );
  });
});

test("mph console converts before the write", () => {
  const frames = speedFrames(8, "mph");
  const message = frames[1]!;
  const lo = message[11]!;
  const hi = message[12]!;
  const hundredths = lo | (hi << 8);
  assert.ok(Math.abs(hundredths / 100 - 8 / 1.609344) < 0.02);
});
