// bot.js (ESM, для Node 18+) - Адаптирован для Railway
import fs from "fs";
import { google } from "googleapis";
// dotenv не нужен в Railway - используем только переменные окружения

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
const CREDENTIALS_JSON = process.env.GOOGLE_CREDENTIALS_JSON;
const TOKEN_JSON = process.env.GOOGLE_TOKEN_JSON;
const NOTIFIED_PATH = process.env.NOTIFIED_FILE || "notified.json";
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || "60000", 10); // ms
const NOTIFY_BEFORE_MINUTES = parseInt(
  process.env.NOTIFY_BEFORE_MINUTES || "15",
  10
);
const CALENDAR_ID = process.env.CALENDAR_ID || "primary";

if (!TELEGRAM_TOKEN || !CHAT_ID) {
  console.error("❌ ОШИБКА: Не установлены обязательные переменные окружения!");
  console.log("");
  console.log("📋 Для локального запуска создайте .env файл:");
  console.log("   TELEGRAM_TOKEN=your_bot_token_here");
  console.log("   CHAT_ID=your_chat_id_here");
  console.log("");
  console.log("📋 Для Railway добавьте в Variables:");
  console.log("   TELEGRAM_TOKEN=your_bot_token_here");
  console.log("   CHAT_ID=your_chat_id_here");
  console.log("");
  console.log("🔗 Как получить TELEGRAM_TOKEN: https://t.me/botfather");
  console.log(
    "🔗 Как получить CHAT_ID: https://api.telegram.org/bot<TOKEN>/getUpdates"
  );
  process.exit(1);
}

if (!CREDENTIALS_JSON) {
  console.error("❌ ОШИБКА: Не установлен GOOGLE_CREDENTIALS_JSON!");
  console.log("");
  console.log("📋 Для локального запуска добавьте в .env:");
  console.log(
    '   GOOGLE_CREDENTIALS_JSON={"installed":{"client_id":"...","client_secret":"..."}}'
  );
  console.log("");
  console.log("📋 Для Railway добавьте в Variables");
  console.log("📋 Скачайте credentials.json из Google Cloud Console");
  console.log("🔗 https://console.cloud.google.com/apis/credentials");
  process.exit(1);
}

// загружаем список уже уведомлённых событий
let notified = new Set();
if (fs.existsSync(NOTIFIED_PATH)) {
  try {
    const raw = fs.readFileSync(NOTIFIED_PATH, "utf-8");
    const arr = JSON.parse(raw);
    notified = new Set(arr);
  } catch (err) {
    console.warn(
      "⚠️ Не удалось прочитать notified.json, начнём с пустого:",
      err.message
    );
  }
}

// Глобальная переменная для хранения авторизованного клиента
let authClient = null;

function saveNotified() {
  try {
    fs.writeFileSync(
      NOTIFIED_PATH,
      JSON.stringify(Array.from(notified)),
      "utf-8"
    );
  } catch (err) {
    console.error("❌ Ошибка записи notified.json:", err);
  }
}

// авторизация Google (адаптировано для Railway)
async function authorize() {
  try {
    // Парсим credentials из переменной окружения
    const content = JSON.parse(CREDENTIALS_JSON);
    const creds = content.installed || content.web;
    const { client_secret, client_id, redirect_uris } = creds;

    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // Проверяем, есть ли токен в переменных окружения
    if (TOKEN_JSON) {
      try {
        const token = JSON.parse(TOKEN_JSON);
        oAuth2Client.setCredentials(token);
        console.log("✅ Google авторизация успешна (из переменных)");
        return oAuth2Client;
      } catch (err) {
        console.warn(
          "⚠️ Не удалось распарсить GOOGLE_TOKEN_JSON:",
          err.message
        );
      }
    }

    // Если нет токена, выводим инструкцию
    console.log("❌ GOOGLE_TOKEN_JSON не установлен или неверный");
    console.log("📋 Для получения токена:");
    console.log("1. Запустите бота локально один раз");
    console.log("2. Скопируйте содержимое token.json в GOOGLE_TOKEN_JSON");
    console.log("3. Перезапустите в Railway");

    // В Railway не можем открыть браузер, поэтому выходим
    process.exit(1);
  } catch (err) {
    console.error("❌ Ошибка авторизации Google:", err.message);
    process.exit(1);
  }
}

// чтение событий
async function getEvents(auth, maxResults = 20) {
  const calendar = google.calendar({ version: "v3", auth });
  const now = new Date().toISOString();
  const res = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: now,
    maxResults: maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });
  return res.data.items || [];
}

// отправка в Telegram (используем глобальный fetch)
async function sendTelegramMessage(text, chatId = CHAT_ID) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const body = { chat_id: chatId, text, parse_mode: "HTML" };
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (!json.ok) console.error("❌ Ошибка Telegram API:", json);
    return json;
  } catch (err) {
    console.error("❌ Ошибка отправки в Telegram:", err);
  }
}

// Обработка команд Telegram
async function handleCommand(message) {
  const chatId = message.chat.id;
  const text = message.text || "";

  if (text === "/start" || text === "/help") {
    const helpText = `🤖 <b>Google Calendar Bot</b>

<b>Доступные команды:</b>
/events - показать ближайшие события
/help - показать эту справку

Бот автоматически уведомляет о предстоящих событиях за ${NOTIFY_BEFORE_MINUTES} минут.`;

    await sendTelegramMessage(helpText, chatId);
  } else if (text === "/events") {
    await showUpcomingEvents(chatId);
  }
}

// Показать ближайшие события
async function showUpcomingEvents(chatId) {
  try {
    if (!authClient) {
      await sendTelegramMessage("⏳ Инициализация календаря...", chatId);
      return;
    }

    const events = await getEvents(authClient, 10); // Показываем 10 ближайших событий

    if (events.length === 0) {
      await sendTelegramMessage("📅 У вас нет предстоящих событий.", chatId);
      return;
    }

    let message = "📅 <b>Ближайшие события:</b>\n\n";

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const start = ev.start?.dateTime || ev.start?.date;
      if (!start) continue;

      const summary = ev.summary || "Без названия";
      const location = ev.location ? `📍 ${escapeHtml(ev.location)}` : "";
      const desc = ev.description
        ? `\n   ${escapeHtml(ev.description.substring(0, 100))}${
            ev.description.length > 100 ? "..." : ""
          }`
        : "";

      // Форматируем время
      const startDate = new Date(start);
      const now = new Date();
      const timeUntil = minutesUntil(start);

      let timeStatus = "";
      if (timeUntil < 0) {
        timeStatus = "🔴 Прошло";
      } else if (timeUntil <= NOTIFY_BEFORE_MINUTES) {
        timeStatus = "⚠️ Скоро";
      } else if (timeUntil <= 60) {
        timeStatus = `🟡 Через ${timeUntil} мин`;
      } else if (timeUntil <= 1440) {
        timeStatus = `🟢 Через ${Math.floor(timeUntil / 60)} ч`;
      } else {
        timeStatus = `🔵 Через ${Math.floor(timeUntil / 1440)} дн`;
      }

      message += `${i + 1}. <b>${escapeHtml(summary)}</b>\n`;
      message += `   ${timeStatus}\n`;
      message += `   🗓 ${startDate.toLocaleString(
        "ru-RU"
      )}${location}${desc}\n\n`;
    }

    await sendTelegramMessage(message, chatId);
  } catch (error) {
    console.error("❌ Ошибка при получении событий:", error);
    await sendTelegramMessage(
      "❌ Ошибка при получении событий. Попробуйте позже.",
      chatId
    );
  }
}

// Получение обновлений от Telegram
async function getTelegramUpdates(offset = 0) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=30`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.ok && data.result) {
      return data.result;
    }
    return [];
  } catch (error) {
    console.error("❌ Ошибка получения обновлений Telegram:", error);
    return [];
  }
}

// Обработка обновлений Telegram
async function processTelegramUpdates() {
  let offset = 0;

  while (true) {
    try {
      const updates = await getTelegramUpdates(offset);

      for (const update of updates) {
        if (update.message && update.message.text) {
          await handleCommand(update.message);
        }
        offset = update.update_id + 1;
      }

      // Небольшая пауза между запросами
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error("❌ Ошибка обработки обновлений Telegram:", error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

function minutesUntil(dateTime) {
  const now = Date.now();
  const then = new Date(dateTime).getTime();
  return Math.round((then - now) / 60000);
}

function escapeHtml(text) {
  if (!text) return "";
  return text.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

// основной цикл
async function main() {
  try {
    authClient = await authorize();
    console.log(
      "✅ Бот запущен. Проверка событий каждые",
      CHECK_INTERVAL / 1000,
      "сек."
    );

    // Отправляем уведомление о запуске
    await sendTelegramMessage(
      "🚀 Google Calendar Bot запущен и готов к работе!"
    );

    // Запускаем обработку команд Telegram в отдельном потоке
    processTelegramUpdates().catch((err) =>
      console.error("❌ Ошибка обработки команд Telegram:", err)
    );

    setInterval(async () => {
      try {
        const events = await getEvents(authClient);
        for (const ev of events) {
          const start = ev.start?.dateTime || ev.start?.date;
          if (!start) continue;

          // сейчас пропускаем all-day (ev.start.date), можно доработать если нужно
          if (!ev.start.dateTime) continue;

          const mins = minutesUntil(start);
          if (mins <= NOTIFY_BEFORE_MINUTES && mins >= 0) {
            if (!notified.has(ev.id)) {
              const summary = ev.summary || "Без названия";
              const location = ev.location
                ? `\n📍 ${escapeHtml(ev.location)}`
                : "";
              const desc = ev.description
                ? `\n\n${escapeHtml(ev.description)}`
                : "";
              const msg = `⏰ <b>Напоминание</b>\nЧерез ${mins} мин начнётся: <b>${escapeHtml(
                summary
              )}</b>\n🗓 Время: ${new Date(
                start
              ).toLocaleString()}${location}${desc}`;
              await sendTelegramMessage(msg);
              notified.add(ev.id);
              saveNotified();
            }
          }
        }
      } catch (err) {
        console.error("❌ Ошибка в основном цикле:", err);
      }
    }, CHECK_INTERVAL);
  } catch (err) {
    console.error("❌ Ошибка запуска:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  console.log("🛑 SIGINT — сохраняю состояние и выхожу.");
  saveNotified();
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM — сохраняю состояние и выхожу.");
  saveNotified();
  process.exit(0);
});

main().catch((err) => console.error("❌ Ошибка запуска:", err));
