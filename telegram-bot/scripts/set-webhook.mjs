/**
 * ثبت webhook ربات روی آدرس ورکر + تنظیم لیست دستورها.
 *
 * اجرا:
 *   node scripts/set-webhook.mjs https://shekargah-bot.<sub>.workers.dev
 *   node scripts/set-webhook.mjs --delete
 *
 * متغیرها: BOT_TOKEN و WEBHOOK_SECRET (از .dev.vars یا محیط).
 * ADMIN_IDS (اختیاری): لیست آیدی عددی ادمین‌ها با کاما.
 */

import { readFileSync, existsSync } from "node:fs";

function loadDevVars() {
  const file = ".dev.vars";
  if (!existsSync(file)) return {};

  const vars = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    vars[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return vars;
}

const dev = loadDevVars();
const token = process.env.BOT_TOKEN ?? dev.BOT_TOKEN;
const secret = process.env.WEBHOOK_SECRET ?? dev.WEBHOOK_SECRET ?? "";
const adminIds = (process.env.ADMIN_IDS ?? process.argv[3] ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => /^-?\d+$/.test(value));

if (!token) {
  console.error("BOT_TOKEN پیدا نشد. آن را در .dev.vars یا محیط بگذار.");
  process.exit(1);
}

const api = (method, body) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }).then(async (response) => {
    const json = await response.json();
    if (!json.ok) throw new Error(`${method}: ${json.description}`);
    return json.result;
  });

const args = process.argv.slice(2);

if (args.includes("--delete")) {
  await api("deleteWebhook", { drop_pending_updates: false });
  console.log("webhook حذف شد.");
  process.exit(0);
}

const url = args.find((value) => value.startsWith("http"));
if (!url) {
  console.error("آدرس ورکر را بده: node scripts/set-webhook.mjs https://…workers.dev");
  process.exit(1);
}

const USER_COMMANDS = [
  { command: "start", description: "شروع کار با ربات" },
  { command: "help", description: "راهنما" },
];

const ADMIN_COMMANDS = [
  ...USER_COMMANDS,
  { command: "admin", description: "پنل مدیریت" },
];

await api("setWebhook", {
  url,
  secret_token: secret || undefined,
  allowed_updates: ["message", "callback_query", "chat_member", "my_chat_member"],
  drop_pending_updates: true,
});
console.log(`webhook ثبت شد: ${url}`);

await api("setMyCommands", { commands: USER_COMMANDS });

for (const id of adminIds) {
  await api("setMyCommands", {
    commands: ADMIN_COMMANDS,
    scope: { type: "chat", chat_id: Number(id) },
  });
  console.log(`دستورهای ادمین برای ${id} تنظیم شد.`);
}

const info = await api("getWebhookInfo");
console.log("وضعیت webhook:", JSON.stringify(info, null, 2));
