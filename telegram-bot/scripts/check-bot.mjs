/**
 * بررسی سلامت ربات، کانال و webhook.
 * اجرا: node scripts/check-bot.mjs
 */

import { readFileSync, existsSync } from "node:fs";

function loadDevVars() {
  if (!existsSync(".dev.vars")) return {};
  const vars = {};
  for (const line of readFileSync(".dev.vars", "utf8").split(/\r?\n/)) {
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
if (!token) {
  console.error("BOT_TOKEN پیدا نشد (نه در محیط، نه در .dev.vars).");
  process.exit(1);
}

const call = (method, body) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }).then((response) => response.json());

const me = await call("getMe");
console.log(me.ok ? `🤖 ربات: @${me.result.username} (${me.result.id})` : `❌ getMe: ${me.description}`);

const webhook = await call("getWebhookInfo");
if (webhook.ok) {
  const info = webhook.result;
  console.log(`🔗 webhook: ${info.url || "(تنظیم نشده)"}`);
  if (info.last_error_message) {
    console.log(`⚠️ آخرین خطا: ${info.last_error_message}`);
  }
  console.log(`📥 آپدیت‌های در انتظار: ${info.pending_update_count ?? 0}`);
}

const url = process.env.WORKER_URL ?? process.argv[2];
if (url) {
  try {
    const health = await fetch(`${url.replace(/\/+$/, "")}/health`);
    const body = await health.json();
    console.log(`❤️ سلامت ورکر: ${health.status} ${JSON.stringify(body)}`);
  } catch (error) {
    console.log(`❌ سلامت ورکر: ${error.message}`);
  }
}
