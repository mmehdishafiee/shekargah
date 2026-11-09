/** تست‌های ربات شکارگاه — بدون هیچ اتصال واقعی به تلگرام یا Supabase. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { displayNameOf, derivePassword, telegramEmail, verifyInitData } from "../src/auth.ts";
import { loadConfig, parseAdminIds } from "../src/config.ts";
import { productCardText, footerLine, shorten, withFooter } from "../src/delivery.ts";
import { toFaDigits } from "../src/html.ts";
import { userMenuKeyboard } from "../src/keyboards.ts";
import type { SiteProduct } from "../src/site.ts";
import {
  announceNewProducts,
  backfillProducts,
  isFuture,
  parseScheduleInput,
} from "../src/schedule.ts";
import { Store } from "../src/store.ts";
import { makeWorker } from "../src/index.ts";
import { createDeps } from "../src/bot.ts";
import {
  callbackUpdate,
  createFakeFetch,
  createTestDb,
  fakeJwt,
  testEnv,
  textUpdate,
} from "./helpers.ts";

const SAMPLE_PRODUCT: SiteProduct = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  slug: "نمونه-محصول",
  name: "نمونه محصول",
  tagline: "یک محصول آزمایشی برای تست",
  description: "توضیح کوتاه محصول آزمایشی که باید در پست کانال کوتاه شود.",
  logoPath: null,
  categoryName: "وب‌اپلیکیشن",
  votesCount: 12,
  publishedAt: "2026-11-01T10:00:00.000Z",
};

// ---------- تنظیمات ----------

test("parseAdminIds آیدی‌های درست را جدا می‌کند و بقیه را رد", () => {
  const ids = parseAdminIds("111, 222;333, abc, ");
  assert.deepEqual([...ids].sort(), [111, 222, 333]);
});

test("loadConfig توکن جای‌نگهدار را رد می‌کند", () => {
  assert.throws(
    () => loadConfig({ ...testEnv(createTestDb()), BOT_TOKEN: "" }),
    /BOT_TOKEN/,
  );
});

test("loadConfig آدرس سایت را نرمال و اسلش انتهایی را حذف می‌کند", () => {
  const config = loadConfig({
    ...testEnv(createTestDb()),
    SITE_URL: "shekargaah.ir/",
  });
  assert.equal(config.siteUrl, "https://shekargaah.ir");
  assert.equal(config.channelHandle, "@shekargah");
});

test("loadConfig REQUIRE_JOIN=0 گیت عضویت را خاموش می‌کند", () => {
  const config = loadConfig({ ...testEnv(createTestDb()), REQUIRE_JOIN: "0" });
  assert.equal(config.requireJoin, false);
});

// ---------- زمان‌بندی ----------

test("parseScheduleInput زمان مطلق تهران را به UTC تبدیل می‌کند", () => {
  const iso = parseScheduleInput("2026-11-05 09:30");
  assert.equal(iso, "2026-11-05T06:00:00.000Z");
});

test("parseScheduleInput ورودی نامعتبر را رد می‌کند", () => {
  assert.equal(parseScheduleInput("فردا صبح"), null);
  assert.equal(parseScheduleInput("2026-02-31 10:00"), null);
});

test("parseScheduleInput زمان نسبی را می‌فهمد", () => {
  const iso = parseScheduleInput("+2h");
  assert.ok(iso && isFuture(iso));
});

// ---------- متن‌ها ----------

test("productCardText نام و دسته را نشان می‌دهد", () => {
  const text = productCardText(SAMPLE_PRODUCT, { forChannel: true });
  assert.match(text, /نمونه محصول/);
  assert.match(text, /وب‌اپلیکیشن/);
  assert.match(text, /۱۲ رأی/);
});

test("productCardText تگ‌های HTML نام را فرار می‌دهد", () => {
  const text = productCardText({ ...SAMPLE_PRODUCT, name: "<b>بد</b>" });
  assert.match(text, /&lt;b&gt;بد&lt;\/b&gt;/);
});

test("shorten متن بلند را با سه‌نقطه کوتاه می‌کند", () => {
  const value = shorten("یک ".repeat(100), 20);
  assert.ok(value.length <= 21, value);
  assert.ok(value.endsWith("…"));
});

test("withFooter فوتر را وقتی جا شود اضافه می‌کند", () => {
  const result = withFooter("متن", "🤖 footer", 100);
  assert.equal(result.footerSeparately, false);
  assert.match(result.text, /متن\n\n🤖 footer/);
});

test("withFooter وقتی متن پر است فوتر را جدا می‌کند", () => {
  const result = withFooter("ا".repeat(50), "🤖 footer", 20);
  assert.equal(result.footerSeparately, true);
  assert.equal(result.text, "ا".repeat(50));
});

test("toFaDigits رقم‌ها را فارسی می‌کند", () => {
  assert.equal(toFaDigits("2026"), "۲۰۲۶");
});

// ---------- دیتابیس ----------

test("کد ورود یک‌بارمصرف است", async () => {
  const store = new Store(createTestDb());
  const future = new Date(Date.now() + 60_000).toISOString();

  await store.createLoginCode("hash-1", 42, future);
  assert.equal(await store.consumeLoginCode("hash-1", new Date().toISOString()), 42);
  assert.equal(await store.consumeLoginCode("hash-1", new Date().toISOString()), null);
});

test("کد ورود منقضی مصرف نمی‌شود", async () => {
  const store = new Store(createTestDb());
  const past = new Date(Date.now() - 60_000).toISOString();

  await store.createLoginCode("hash-2", 42, past);
  assert.equal(await store.consumeLoginCode("hash-2", new Date().toISOString()), null);
});

test("وضعیت سراسری ذخیره و خوانده می‌شود", async () => {
  const store = new Store(createTestDb());
  assert.equal(await store.getState("k"), null);
  await store.setState("k", "v");
  assert.equal(await store.getState("k"), "v");
  await store.setState("k", "v2");
  assert.equal(await store.getState("k"), "v2");
});

test("مشترکان اعلان درست فهرست می‌شوند", async () => {
  const store = new Store(createTestDb());
  await store.saveUser(1, "a", "الف");
  await store.saveUser(2, "b", "ب");
  await store.setWantsNewProducts(1, true);

  assert.deepEqual(await store.listSubscribers(), [1]);

  await store.markBlocked(1);
  assert.deepEqual(await store.listSubscribers(), []);
});

// ---------- معرفی خودکار ----------

test("اجرای اول فقط نقطه‌ی شروع را ثبت می‌کند", async () => {
  const db = createTestDb();
  const store = new Store(db);
  const fake = createFakeFetch({ products: [rawProduct()] });
  const deps = createDeps(testEnv(db), fake.fetch);

  const result = await announceNewProducts(deps.bot.api, store, deps.config, deps.site);

  assert.equal(result.announced, 0);
  assert.equal(await store.getState("products_watermark"), SAMPLE_PRODUCT.publishedAt);
  assert.equal(fake.telegram.length, 0);
});

test("محصول تازه بعد از نقطه‌ی شروع در کانال معرفی می‌شود", async () => {
  const db = createTestDb();
  const store = new Store(db);
  await store.setState("products_watermark", "2026-10-01T00:00:00.000Z");

  const fake = createFakeFetch({ products: [rawProduct()] });
  const deps = createDeps(testEnv(db), fake.fetch);

  const result = await announceNewProducts(deps.bot.api, store, deps.config, deps.site);

  assert.equal(result.announced, 1);
  const send = fake.telegram.find((call) => call.method === "sendMessage");
  assert.ok(send, "پیام کانال فرستاده نشد");
  assert.equal(send.body.chat_id, "@shekargah");
  assert.match(String(send.body.text), /نمونه محصول/);
  assert.equal(await store.hasAnnouncement(SAMPLE_PRODUCT.id), true);
});

test("محصول معرفی‌شده دوباره پست نمی‌شود", async () => {
  const db = createTestDb();
  const store = new Store(db);
  await store.setState("products_watermark", "2026-10-01T00:00:00.000Z");

  const fake = createFakeFetch({ products: [rawProduct()] });
  const deps = createDeps(testEnv(db), fake.fetch);

  await announceNewProducts(deps.bot.api, store, deps.config, deps.site);
  fake.telegram.length = 0;

  const second = await announceNewProducts(deps.bot.api, store, deps.config, deps.site);
  assert.equal(second.announced, 0);
  assert.equal(fake.telegram.length, 0);
});

test("تعلیق اعلان خودکار جلوی پست را می‌گیرد", async () => {
  const db = createTestDb();
  const store = new Store(db);
  await store.setState("products_watermark", "2026-10-01T00:00:00.000Z");
  await store.setState("announce_paused", "1");

  const fake = createFakeFetch({ products: [rawProduct()] });
  const deps = createDeps(testEnv(db), fake.fetch);

  const result = await announceNewProducts(deps.bot.api, store, deps.config, deps.site);
  assert.equal(result.announced, 0);
  assert.equal(fake.telegram.length, 0);
});

test("بک‌فیل محصولات قبلی را معرفی می‌کند", async () => {
  const db = createTestDb();
  const store = new Store(db);
  const fake = createFakeFetch({ products: [rawProduct()] });
  const deps = createDeps(testEnv(db), fake.fetch);

  const result = await backfillProducts(deps.bot.api, store, deps.config, deps.site, 5);
  assert.equal(result.announced, 1);
});

// ---------- ورود ----------

test("ایمیل و نام نمایشی تلگرام درست ساخته می‌شوند", () => {
  assert.equal(telegramEmail(12345), "tg12345@telegram.shekargah.ir");
  assert.equal(displayNameOf("م", null), "کاربر شکارگاه");
  assert.equal(displayNameOf("مریم", "احمدی"), "مریم احمدی");
});

test("رمز مشتق‌شده قطعی و یکسان است", async () => {
  const a = await derivePassword("secret", 7);
  const b = await derivePassword("secret", 7);
  const c = await derivePassword("secret", 8);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("verifyInitData امضای نادرست را رد می‌کند", async () => {
  const result = await verifyInitData(
    "123456:TEST-TOKEN",
    "user=%7B%22id%22%3A1%7D&auth_date=9999999999&hash=deadbeef",
  );
  assert.equal(result, null);
});

// ---------- Worker ----------

test("مسیر سلامت بدون توکن ربات هم جواب می‌دهد", async () => {
  const worker = makeWorker((env) => {
    const fake = createFakeFetch();
    return createDeps(env, fake.fetch);
  });

  const response = await worker.fetch(
    new Request("https://bot.example.com/health"),
    { ...testEnv(createTestDb()) } as never,
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", service: "shekargah-bot" });
});

test("webhook با secret نادرست رد می‌شود", async () => {
  const db = createTestDb();
  const fake = createFakeFetch();
  const worker = makeWorker((env) => createDeps(env, fake.fetch));

  const response = await worker.fetch(
    new Request("https://bot.example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "wrong",
      },
      body: JSON.stringify(textUpdate("/start")),
    }),
    testEnv(db) as never,
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 401);
});

test("webhook دستور start را پردازش می‌کند", async () => {
  const db = createTestDb();
  const fake = createFakeFetch();
  const worker = makeWorker((env) => createDeps(env, fake.fetch));

  const response = await worker.fetch(
    new Request("https://bot.example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "test-secret",
      },
      body: JSON.stringify(textUpdate("/start", 999)),
    }),
    testEnv(db) as never,
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 200);
  const send = fake.telegram.find((call) => call.method === "sendMessage");
  assert.ok(send, "پاسخ start فرستاده نشد");
  assert.match(String(send.body.text), /شکارگاه/);

  const store = new Store(db);
  assert.equal(await store.usersCount(), 1);
});

test("دکمه‌ی ورود لینک یک‌بارمصرف می‌سازد", async () => {
  const db = createTestDb();
  const fake = createFakeFetch();
  const worker = makeWorker((env) => createDeps(env, fake.fetch));

  await worker.fetch(
    new Request("https://bot.example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "test-secret",
      },
      body: JSON.stringify(callbackUpdate("login", 999)),
    }),
    testEnv(db) as never,
    { waitUntil() {}, passThroughOnException() {} },
  );

  const send = fake.telegram.find(
    (call) => call.method === "sendMessage" && /ورود/.test(String(call.body.text)),
  );
  assert.ok(send, "پیام ورود فرستاده نشد");

  const keyboard = send.body.reply_markup as {
    inline_keyboard: { url: string }[][];
  };
  const url = keyboard.inline_keyboard[0]?.[0]?.url ?? "";
  assert.match(url, /\/login\/telegram\?code=/);
});

test("تبدیل کد ورود توکن نشست برمی‌گرداند", async () => {
  const db = createTestDb();
  const store = new Store(db);
  const fake = createFakeFetch();
  const worker = makeWorker((env) => createDeps(env, fake.fetch));
  const env = testEnv(db);

  // کد را مستقیم در دیتابیس می‌گذاریم (هش sha256 از «code-1»)
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update("code-1").digest("hex");
  await store.createLoginCode(hash, 42, new Date(Date.now() + 60_000).toISOString());

  const response = await worker.fetch(
    new Request("https://bot.example.com/auth/exchange", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://shekargaah.ir" },
      body: JSON.stringify({ code: "code-1" }),
    }),
    env as never,
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { access_token?: string };
  assert.ok(payload.access_token);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://shekargaah.ir");

  // کد یک‌بارمصرف بوده
  const again = await worker.fetch(
    new Request("https://bot.example.com/auth/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "code-1" }),
    }),
    env as never,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(again.status, 400);
});

test("jwtSubject شناسه را از توکن می‌خواند", async () => {
  const { jwtSubject } = await import("../src/auth.ts");
  assert.equal(jwtSubject(fakeJwt("abc")), "abc");
  assert.equal(jwtSubject("garbage"), null);
});

// ---------- فوتر و گیت عضویت ----------

test("فوتر پست کانال، آیدی کانال را با ایموجی 🌐 نشان می‌دهد", () => {
  const config = loadConfig(testEnv(createTestDb()));
  const footer = footerLine(config);

  assert.match(footer, /^🌐/);
  assert.match(footer, /@shekargah/);
  assert.doesNotMatch(footer, /shekargaah_bot/);
});

test("اعلان محصول در کانال با فوتر کانال پست می‌شود", async () => {
  const db = createTestDb();
  const store = new Store(db);
  await store.setState("products_watermark", "2026-10-01T00:00:00.000Z");

  const fake = createFakeFetch({ products: [rawProduct()] });
  const deps = createDeps(testEnv(db), fake.fetch);

  await announceNewProducts(deps.bot.api, store, deps.config, deps.site);

  const send = fake.telegram.find((call) => call.method === "sendMessage");
  assert.ok(send);
  assert.match(String(send.body.text), /🌐/);
  assert.match(String(send.body.text), /@shekargah/);
});

test("عضو نبودن در کانال جلوی استفاده از ربات را می‌گیرد", async () => {
  const db = createTestDb();
  const nonMember = 900111;
  const fake = createFakeFetch({ nonMembers: [nonMember] });
  const worker = makeWorker((env) => createDeps(env, fake.fetch));

  const response = await worker.fetch(
    new Request("https://bot.example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "test-secret",
      },
      body: JSON.stringify(textUpdate("/start", nonMember)),
    }),
    { ...testEnv(db), REQUIRE_JOIN: "1" } as never,
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 200);

  const send = fake.telegram.find((call) => call.method === "sendMessage");
  assert.ok(send, "پیام عضویت فرستاده نشد");
  assert.match(String(send.body.text), /عضو کانال/);

  // دکمه‌ی «عضو شدم، بررسی کن» باید باشد
  const keyboard = send.body.reply_markup as { inline_keyboard: { callback_data?: string }[][] };
  const datas = keyboard.inline_keyboard
    .flat()
    .map((button) => ("callback_data" in button ? button.callback_data : undefined));
  assert.ok(datas.includes("check_join"));
});

test("عضو کانال بدون مانع وارد ربات می‌شود", async () => {
  const db = createTestDb();
  const member = 900222;
  const fake = createFakeFetch();
  const worker = makeWorker((env) => createDeps(env, fake.fetch));

  await worker.fetch(
    new Request("https://bot.example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "test-secret",
      },
      body: JSON.stringify(textUpdate("/start", member)),
    }),
    { ...testEnv(db), REQUIRE_JOIN: "1" } as never,
    { waitUntil() {}, passThroughOnException() {} },
  );

  const send = fake.telegram.find((call) => call.method === "sendMessage");
  assert.ok(send);
  assert.match(String(send.body.text), /خوش اومدی/);
});

test("لینک ورود به سایت هم فقط برای اعضای کانال ساخته می‌شود", async () => {
  const db = createTestDb();
  const nonMember = 900333;
  const fake = createFakeFetch({ nonMembers: [nonMember] });
  const worker = makeWorker((env) => createDeps(env, fake.fetch));

  await worker.fetch(
    new Request("https://bot.example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "test-secret",
      },
      body: JSON.stringify(textUpdate("/start login", nonMember)),
    }),
    { ...testEnv(db), REQUIRE_JOIN: "1" } as never,
    { waitUntil() {}, passThroughOnException() {} },
  );

  const send = fake.telegram.find((call) => call.method === "sendMessage");
  assert.ok(send);
  assert.match(String(send.body.text), /عضو کانال/);

  // هیچ حساب Supabase ساخته نشده
  assert.equal(fake.calls.some((call) => call.url.includes("/auth/v1/admin/users")), false);
});

// ---------- دسته‌بندی‌ها ----------

test("منو دکمه‌ی دسته‌بندی‌ها و درباره دارد", () => {
  const config = loadConfig(testEnv(createTestDb()));
  const keyboard = userMenuKeyboard(config);
  const datas = keyboard.inline_keyboard
    .flat()
    .map((button) => ("callback_data" in button ? button.callback_data : undefined));

  assert.ok(datas.includes("cats"));
  assert.ok(datas.includes("about"));
});

test("دسته‌بندی‌های سایت با تعداد محصول فهرست می‌شوند", async () => {
  const db = createTestDb();
  const fake = createFakeFetch({
    categories: [
      { slug: "web-apps", name: "وب‌اپلیکیشن", description: null },
      { slug: "open-source", name: "متن‌باز", description: null },
    ],
    products: [
      rawProduct({ slug: "نمونه", categorySlug: "web-apps" }),
      rawProduct({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", slug: "دوم", categorySlug: "web-apps" }),
    ],
  });
  const worker = makeWorker((env) => createDeps(env, fake.fetch));

  await worker.fetch(
    new Request("https://bot.example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "test-secret",
      },
      body: JSON.stringify(callbackUpdate("cats", 999)),
    }),
    testEnv(db) as never,
    { waitUntil() {}, passThroughOnException() {} },
  );

  const call = fake.telegram.find((item) => item.method === "editMessageText");
  assert.ok(call, "صفحه‌ی دسته‌بندی‌ها ویرایش نشد");
  assert.match(String(call.body.text), /دسته‌بندی‌های شکارگاه/);

  const keyboard = call.body.reply_markup as {
    inline_keyboard: { text: string; callback_data?: string }[][];
  };
  const buttons = keyboard.inline_keyboard.flat();
  const web = buttons.find((button) => button.callback_data === "cat:web-apps:0");
  assert.ok(web, "دکمه‌ی دسته‌ی وب‌اپلیکیشن نبود");
  assert.match(web.text, /۲/);
});

test("محصولات یک دسته نمایش داده می‌شوند", async () => {
  const db = createTestDb();
  const fake = createFakeFetch({
    categories: [{ slug: "web-apps", name: "وب‌اپلیکیشن", description: null }],
    products: [
      rawProduct({ slug: "نمونه", categorySlug: "web-apps" }),
      rawProduct({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", slug: "دیگری", name: "محصول دیگر", categorySlug: "fintech" }),
    ],
  });
  const worker = makeWorker((env) => createDeps(env, fake.fetch));

  await worker.fetch(
    new Request("https://bot.example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "test-secret",
      },
      body: JSON.stringify(callbackUpdate("cat:web-apps:0", 999)),
    }),
    testEnv(db) as never,
    { waitUntil() {}, passThroughOnException() {} },
  );

  const call = fake.telegram.find((item) => item.method === "editMessageText");
  assert.ok(call, "صفحه‌ی دسته ویرایش نشد");
  assert.match(String(call.body.text), /وب‌اپلیکیشن/);

  const keyboard = call.body.reply_markup as {
    inline_keyboard: { text: string; callback_data?: string }[][];
  };
  const buttons = keyboard.inline_keyboard.flat();
  const productButtons = buttons.filter((button) => button.callback_data?.startsWith("product:"));
  assert.equal(productButtons.length, 1);
  assert.match(String(productButtons[0]?.text), /نمونه محصول/);
  assert.ok(buttons.some((button) => button.callback_data === "cats"));
});

test("بخش درباره از منو باز می‌شود", async () => {
  const db = createTestDb();
  const fake = createFakeFetch();
  const worker = makeWorker((env) => createDeps(env, fake.fetch));

  await worker.fetch(
    new Request("https://bot.example.com/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "test-secret",
      },
      body: JSON.stringify(callbackUpdate("about", 999)),
    }),
    testEnv(db) as never,
    { waitUntil() {}, passThroughOnException() {} },
  );

  const call = fake.telegram.find((item) => item.method === "editMessageText");
  assert.ok(call, "صفحه‌ی درباره باز نشد");
  assert.match(String(call.body.text), /درباره شکارگاه/);
  assert.match(String(call.body.text), /ورود با تلگرام/);
});

/** پاسخ REST یک محصول همان‌طور که PostgREST می‌دهد. */
function rawProduct(
  overrides: { id?: string; slug?: string; name?: string; categorySlug?: string } = {},
) {
  const slug = overrides.categorySlug ?? "web-apps";

  return {
    id: overrides.id ?? SAMPLE_PRODUCT.id,
    slug: overrides.slug ?? SAMPLE_PRODUCT.slug,
    name: overrides.name ?? SAMPLE_PRODUCT.name,
    tagline: SAMPLE_PRODUCT.tagline,
    description: SAMPLE_PRODUCT.description,
    logo_path: null,
    published_at: SAMPLE_PRODUCT.publishedAt,
    votes_count: SAMPLE_PRODUCT.votesCount,
    categories: { name: SAMPLE_PRODUCT.categoryName, slug },
  };
}
