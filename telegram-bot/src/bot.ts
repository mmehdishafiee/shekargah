/** ساخت و سیم‌کشی ربات. */

import { Bot } from "grammy";
import type { Config } from "./config.ts";
import { loadConfig } from "./config.ts";
import type { BotContext } from "./context.ts";
import { createAdminComposer } from "./handlers/admin.ts";
import { createStartComposer } from "./handlers/start.ts";
import { log } from "./log.ts";
import { SiteClient } from "./site.ts";
import { D1SessionStorage } from "./storage.ts";
import { Store } from "./store.ts";
import { subscriptionGate } from "./subscription.ts";
import type { Env } from "./types.ts";

/** همه‌ی چیزهایی که یک درخواست/اجرای کرون لازم دارد */
export interface BotDeps {
  bot: Bot<BotContext>;
  config: Config;
  store: Store;
  site: SiteClient;
}

/**
 * ربات و وابستگی‌هایش را می‌سازد.
 *
 * @param fetchImpl در تست‌ها یک fetch ماک تزریق می‌شود تا هیچ درخواست واقعی
 *                  به تلگرام نرود.
 */
export function createDeps(env: Env, fetchImpl?: typeof fetch): BotDeps {
  const config = loadConfig(env);
  const store = new Store(env.DB);
  const site = new SiteClient(config, fetchImpl);
  const storage = new D1SessionStorage(env.DB);

  const bot = new Bot<BotContext>(
    config.botToken,
    fetchImpl ? { client: { fetch: fetchImpl } } : {},
  );

  bot.catch((error) => {
    log.error(`خطای مدیریت‌نشده در آپدیت ${error.ctx.update.update_id}`, error.error);
  });

  // ترتیب مهم است: گیت عضویت اول، بعد منوی کاربر، بعد پنل ادمین.
  bot.use(subscriptionGate(config));
  bot.use(createStartComposer(config, store, site));
  bot.use(createAdminComposer(config, store, site, storage));

  return { bot, config, store, site };
}

/** فقط ربات (برای تست‌های ساده) */
export function createBot(env: Env, fetchImpl?: typeof fetch): Bot<BotContext> {
  return createDeps(env, fetchImpl).bot;
}