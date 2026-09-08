import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyseChat, ChatFormatError, parseChat, tokenize } from "../static/analyser.mjs";

const BRACKETED_CHAT = `[31/08/2026, 09:42:01] Alex: Morning!
[31/08/2026, 09:43:02] Sam: Coffee?
[31/08/2026, 09:44:03] Alex: Yes please.
This is a second line.
[31/08/2026, 09:45:04] Alex changed the group name
[31/08/2026, 09:46:05] Sam: <Media omitted>`;

describe("parseChat", () => {
  it("parses bracketed iOS exports and multiline messages", () => {
    const messages = parseChat(BRACKETED_CHAT);

    assert.equal(messages.length, 4);
    assert.equal(messages[2].sender, "Alex");
    assert.equal(messages[2].body, "Yes please.\nThis is a second line.");
  });

  it("parses dashed Android exports with 12-hour times", () => {
    const messages = parseChat(
      "8/31/26, 9:42 PM - Alex: Morning\r\n8/31/26, 9:43 PM - Sam: Evening",
    );

    assert.deepEqual(
      messages.map(({ sender, body }) => ({ sender, body })),
      [
        { sender: "Alex", body: "Morning" },
        { sender: "Sam", body: "Evening" },
      ],
    );
  });

  it("does not attach timestamped system events to a message", () => {
    const messages = parseChat(
      "01/09/2026, 10:00 - Alex: Hello\n01/09/2026, 10:01 - Messages are end-to-end encrypted.\ncontinued notice",
    );

    assert.equal(messages.length, 1);
    assert.equal(messages[0].body, "Hello");
  });
});

describe("analyseChat", () => {
  it("returns summary, participant, word, and hour statistics", () => {
    const result = analyseChat(BRACKETED_CHAT);

    assert.deepEqual(result.summary, {
      messages: 3,
      words: 9,
      participants: 2,
      activeDays: 1,
      averageWords: 3,
      firstDate: "31/08/2026",
      lastDate: "31/08/2026",
    });
    assert.deepEqual(
      result.participants.map(({ name, messages }) => ({ name, messages })),
      [
        { name: "Alex", messages: 2 },
        { name: "Sam", messages: 1 },
      ],
    );
    assert.equal(result.hours[9].count, 3);
    assert.ok(result.topWords.some(({ word }) => word === "coffee"));
  });

  it("throws a helpful error for unsupported input", () => {
    assert.throws(() => analyseChat("not a chat"), ChatFormatError);
  });
});

describe("tokenize", () => {
  it("supports unicode words and apostrophes", () => {
    assert.deepEqual(tokenize("Café déjà! We're ready."), ["café", "déjà", "we're", "ready"]);
  });
});
