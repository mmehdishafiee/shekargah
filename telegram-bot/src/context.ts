/** کانتکست ربات (به‌همراه نشست برای فرم پنل ادمین). */

import type { Context, SessionFlavor } from "grammy";
import type { SessionData } from "./storage.ts";

export type BotContext = Context & SessionFlavor<SessionData>;