const MEDIA_MARKERS = [
  "<media omitted>",
  "image omitted",
  "video omitted",
  "audio omitted",
  "sticker omitted",
  "gif omitted",
  "document omitted",
];

const STOP_WORDS = new Set(
  `a about after again all also am an and any are as at be because been before being but by can
   could did do does doing don't down each even for from further get got had has have having he her
   here hers herself him himself his how i if in into is it its itself just let's me more most my
   myself no nor not now of off on once only or other our ours ourselves out over own same she should
   so some such than that the their theirs them themselves then there these they this those through to
   too under until up very was we were what when where which while who why will with would you your
   yours yourself yourselves im ive ill id youre youve youll youd were wasnt didnt dont cant wont
   yeah yes okay ok lol media omitted`.split(/\s+/),
);

const TIME = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?m\.?)?`;
const BRACKETED = new RegExp(
  String.raw`^\[(?<date>[^,\]]+),\s*(?<time>${TIME})\]\s+(?<sender>[^:\n]+):\s?(?<body>.*)$`,
  "i",
);
const DASHED = new RegExp(
  String.raw`^(?<date>\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}),?\s+(?<time>${TIME})\s+-\s+(?<sender>[^:\n]+):\s?(?<body>.*)$`,
  "i",
);
const BRACKETED_EVENT = new RegExp(String.raw`^\[[^,\]]+,\s*${TIME}\]\s+`, "i");
const DASHED_EVENT = new RegExp(
  String.raw`^\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4},?\s+${TIME}\s+-\s+`,
  "i",
);

export class ChatFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = "ChatFormatError";
  }
}

function normalizeLine(line) {
  return line.replace(/[\u00a0\u202f]/g, " ");
}

function matchMessageHeader(line) {
  return normalizeLine(line).match(BRACKETED) ?? normalizeLine(line).match(DASHED);
}

function isTimestampedEvent(line) {
  const normalized = normalizeLine(line);
  return BRACKETED_EVENT.test(normalized) || DASHED_EVENT.test(normalized);
}

export function parseChat(text) {
  if (typeof text !== "string") {
    throw new TypeError("Chat input must be text.");
  }

  const messages = [];
  let current = null;

  for (const rawLine of text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n")) {
    const match = matchMessageHeader(rawLine);

    if (match?.groups) {
      current = {
        date: match.groups.date.trim(),
        time: match.groups.time.trim(),
        sender: match.groups.sender.trim(),
        body: match.groups.body,
      };
      messages.push(current);
      continue;
    }

    if (isTimestampedEvent(rawLine)) {
      current = null;
      continue;
    }

    if (current && rawLine) {
      current.body += `\n${rawLine}`;
    }
  }

  return messages;
}

export function tokenize(text) {
  return text.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}

function isMediaPlaceholder(body) {
  const normalized = body.trim().toLocaleLowerCase();
  return MEDIA_MARKERS.some((marker) => normalized.includes(marker));
}

function parseHour(time) {
  const normalized = time.toLocaleLowerCase().replaceAll(".", "").trim();
  const hour = Number.parseInt(normalized.split(":", 1)[0], 10);
  if (normalized.endsWith("pm") && hour < 12) return hour + 12;
  if (normalized.endsWith("am") && hour === 12) return 0;
  return hour >= 0 && hour <= 23 ? hour : null;
}

export function analyseChat(text) {
  const messages = parseChat(text).filter((message) => !isMediaPlaceholder(message.body));
  if (messages.length < 2) {
    throw new ChatFormatError(
      "I could not find enough messages. Export a WhatsApp chat without media, then paste or open the .txt file.",
    );
  }

  const people = new Map();
  const words = new Map();
  const dates = new Set();
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  let totalWords = 0;

  for (const message of messages) {
    const tokens = tokenize(message.body);
    totalWords += tokens.length;
    dates.add(message.date);

    const participant = people.get(message.sender) ?? {
      name: message.sender,
      messages: 0,
      words: 0,
    };
    participant.messages += 1;
    participant.words += tokens.length;
    people.set(message.sender, participant);

    for (const word of tokens) {
      if (!STOP_WORDS.has(word) && !/^\d+$/.test(word)) {
        words.set(word, (words.get(word) ?? 0) + 1);
      }
    }

    const hour = parseHour(message.time);
    if (hour !== null) hours[hour].count += 1;
  }

  const participants = [...people.values()].sort(
    (left, right) => right.messages - left.messages || left.name.localeCompare(right.name),
  );
  const topWords = [...words.entries()]
    .sort(([leftWord, leftCount], [rightWord, rightCount]) =>
      rightCount - leftCount || leftWord.localeCompare(rightWord),
    )
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));

  return {
    summary: {
      messages: messages.length,
      words: totalWords,
      participants: participants.length,
      activeDays: dates.size,
      averageWords: totalWords / messages.length,
      firstDate: messages[0].date,
      lastDate: messages.at(-1).date,
    },
    participants,
    topWords,
    hours,
  };
}
