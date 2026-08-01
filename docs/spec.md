# Smart Reminder Bot — Product & Technical Spec

Rules for how to work in this repo live in `CLAUDE.md`. This file is the
"what and why": product purpose, module responsibilities, and the
architectural decisions made along the way.

## Purpose

A Telegram bot that understands natural-language reminders — in Uzbek,
Russian, and English — and reminds users at the correct time.

Example:

> User: "Men ertaga 18:00 da aptekadan dori olishim kerak"
>
> Bot understands: title "Dori olish", time "tomorrow 18:00". Stores it in
> MongoDB, sends a notification later.

## Main idea

No reliance on commands — the user chats naturally. Examples the bot must
understand:

- Men ertaga 18:00 da zalga boraman
- Har juma namozni eslat
- 2 soatdan keyin onamga telefon qilishni eslat
- Har kuni 8:00 da suv ichishimni eslat

## Technology

Node.js, TypeScript, grammY, MongoDB Atlas + Mongoose, dotenv, tsx, luxon.
No NestJS, Express controllers, Prisma, SQL/PostgreSQL, or another ORM.

## Project structure

```
src/
  bot/
    handlers/
    middlewares/
    index.ts
  config/
    env.ts
  database/
    connection.ts
  modules/
    user/         user.model.ts, user.service.ts, user.types.ts
    reminder/     reminder.model.ts, reminder.service.ts, reminder.types.ts
    parser/       parser.service.ts, parser.types.ts
    scheduler/    scheduler.service.ts
    notification/ notification.service.ts, notification.types.ts
    ai/           (future)
  shared/
    constants/
    keyboards/
    types/
  locales/
  utils/
  server.ts
```

## Modules

### User module

Fields: `telegramId`, `username`, `fullName`, `languageCode` (Telegram's own
language), `language` (bot language, chosen explicitly), `timezone`,
`createdAt`, `updatedAt`.

Functions: find by telegram id, find by id, create, find-or-create
(atomic upsert), update language.

Language is independent from Telegram's `language_code` — the user picks it
explicitly via the `/language` inline keyboard and it's stored separately.

### Language / translation system

Supported: uz, ru, en. `locales/{en,uz,ru}.ts` + `locales/index.ts` +
`shared/types/translation.ts`. The `Translations` interface is the single
source of truth for shape — every locale object must match it exactly.
Never hardcode user-facing text outside `locales/`.

### Reminder module

Fields: `userId`, `title`, `originalText`, `description`, `remindAt`,
`remindBefore` (`number[]`, minutes — one or more lead-times), `repeat`,
`customRepeatDays`, `timezone`, `status`, `isConfirmed`,
`lastNotificationAt`, `nextRunAt`, `createdAt`, `updatedAt`.

- `ReminderStatus`: `ACTIVE`, `COMPLETED`, `CANCELLED`, `MISSED`.
- `ReminderRepeatType`: `NONE`, `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`, `CUSTOM`.

Functions: create, find by id, list active reminders for a user, delete,
complete, cancel, `findDueReminders`, `recordNotification`, `markMissed`,
`advanceRepeat`, `getNextRunAt`, `rescheduleReminder`.

`MISSED` marks a reminder the scheduler gave up on — either its owning user
record is gone, or its due moment went unsent for longer than the overdue
threshold (see Scheduler below) and it doesn't repeat, so there's no future
occurrence to fall back to.

### Parser module

Regex-based (Phase 1); an AI fallback is planned for Phase 3. Converts
natural language into structured data. Never talks to Telegram or the
database.

Returns: `title`, `remindAt`, `remindBefore`, `repeat`, `confidence`,
`originalText`, `ambiguousToken?`, `unclear?`.

Conventions established while building it:

- luxon handles all date/zone math. `now` and `timezone` are always passed
  in as arguments — the parser never calls `new Date()`/`Date.now()`
  itself, which keeps `parse()` a pure, easily-testable function.
- Word boundaries use a Unicode lookaround
  (`(?<![\p{L}\p{N}])...(?![\p{L}\p{N}])`) instead of `\b`, because `\b`
  doesn't treat Cyrillic letters as word characters.
- Confidence tiers: **0.9** date+time both resolved · **0.7** time only, or
  a relative "in N minutes/hours" · **0.5** date without time, day-marker
  without time, or an ambiguous `DD.MM`/`HH.MM` token resolved via context
  · **0.4** a genuinely ambiguous numeric token with no resolving signal
  (`ambiguousToken` is set) · **0.3** a repeat marker only · **0.1**
  nothing recognized.
- `DD.MM` / `HH.MM` ambiguity: classified by range validity (day 1–31 vs.
  hour 0–23, month 1–12 vs. minute 0–59) into date-only / time-only /
  invalid / ambiguous. A truly ambiguous token is resolved using context
  signals — another time found elsewhere, a month name found elsewhere, a
  day marker found elsewhere, or an immediately preceding `soat`/`в`/`at` —
  and only asks the user (`unclear: 'ambiguous'`) when none of those fire.
- `unclear: 'time' | 'date' | 'ambiguous'` tells the handler which
  follow-up question to ask the user; checked *before* the confidence
  thresholds in `reminder.handler.ts`.
- Lead-time expressions ("2 soat oldin" / "за 2 часа до" / "2 hours
  before") are matched and masked out of the text *before* the
  relative-time matcher runs, so a lead-time can never be swallowed by the
  deadline pattern ("2 soatdan keyin" / "через 2 часа") — in Uzbek the two
  differ by a single word (`oldin` vs. `dan keyin`).
- Title cleanup only strips prepositions/particles and trailing command
  verbs ("eslat", "напомни", "remind me") at the edges of a removed
  date/time expression or the string itself — words in the middle of a
  sentence are never touched.

### Scheduler module

Runs every 60 seconds (`setInterval`). Never parses text, never talks to
the user directly — only to the notification service.

- Finds reminders with `status: ACTIVE` and `nextRunAt <= now` (backed by
  the `{status: 1, nextRunAt: 1}` index), oldest first, capped at 100 per
  tick.
- For each, picks the single *latest* due send-moment — an unsent
  `remindBefore` lead-time, or the deadline itself — that hasn't already
  been notified. Earlier missed moments are deliberately skipped so a user
  coming back after downtime doesn't get a backlog of messages.
- `OVERDUE_THRESHOLD_MINUTES = 30`
  (`shared/constants/scheduler.constants.ts`): a chosen moment more than 30
  minutes late is not sent at all. A too-late advance warning is just
  rescheduled to the next moment; a too-late non-repeating main deadline is
  marked `MISSED`; a repeating one is advanced to its next occurrence
  instead.
- A module-level `isRunning` flag (reset in `finally`) prevents a slow tick
  from overlapping with the next one.
- Each reminder is processed in its own try/catch so one failure (e.g. a
  user who blocked the bot) can't stop the rest of the batch.

### Notification module

Renders and sends the Telegram message. Never parses, never touches the
database.

Does **not** import `bot` from `bot/index.ts` — that would create a cycle
(`bot/index → handlers → notification → bot/index`). Instead it depends on
a minimal structural interface:

```ts
export interface MessageSender {
  sendMessage(chatId: number, text: string): Promise<unknown>;
}
```

`server.ts` passes `bot.api` in from outside — it satisfies `MessageSender`
structurally, since grammY's `Api.sendMessage` takes the same two required
arguments plus optional extras. The scheduler takes the same `MessageSender`
and never imports grammY either.

### AI module

Future only (Phase 3). Regex parsing is tried first; the AI is a fallback
for what regex can't handle. The AI only ever returns structured JSON —
it never writes to the database directly.

## Bot flow

User → Telegram Handler → Parser Service → Reminder Service → MongoDB →
Scheduler → Notification Service → Telegram. Never change this flow.

## Roadmap

- **Phase 1 (done):** user system, language selection, reminder CRUD,
  scheduler, notification, parser.
- **Phase 2:** richer recurring-reminder handling, timezone support beyond
  the default, reminder editing/deletion, broader NLP coverage.
- **Phase 3:** Gemini/Claude integration, voice message parsing, OCR,
  calendar integration.
- **Phase 4:** production deployment, logging, metrics, monitoring, tests,
  CI/CD, Docker.
