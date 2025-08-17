# Google Calendar Telegram Bot

🤖 Telegram бот с интеграцией Google Calendar для автоматических напоминаний о событиях.

## 🌟 Возможности

- ✅ **Автоматические уведомления** о предстоящих событиях
- ✅ **Команды в Telegram** (`/start`, `/help`, `/events`)
- ✅ **Интеграция с Google Calendar** - читает ваши события
- ✅ **Умные напоминания** за 15 минут до начала
- ✅ **Показ ближайших событий** по команде `/events`
- ✅ **Работа в Railway** без локальных файлов

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка Google Cloud Console

#### Шаг 1: Создание проекта

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите **Google Calendar API**

#### Шаг 2: Создание учетных данных

1. Перейдите в **APIs & Services** → **Credentials**
2. Нажмите **+ CREATE CREDENTIALS** → **OAuth 2.0 Client IDs**
3. Выберите **Desktop application**
4. Скачайте файл `credentials.json`

#### Шаг 3: Получение токена авторизации

1. Запустите бота локально: `npm start`
2. Откройте ссылку в браузере и авторизуйтесь
3. Скопируйте код авторизации
4. Вставьте код в консоль
5. Скопируйте содержимое созданного `token.json`

### 3. Настройка Railway

#### Переменные окружения:

```env
# Обязательные
TELEGRAM_TOKEN=your_bot_token_from_botfather
CHAT_ID=your_telegram_chat_id
GOOGLE_CREDENTIALS_JSON={"installed":{"client_id":"...","client_secret":"..."}}
GOOGLE_TOKEN_JSON={"access_token":"...","refresh_token":"..."}

# Опциональные
CALENDAR_ID=primary
CHECK_INTERVAL=60000
NOTIFY_BEFORE_MINUTES=15
```

#### Как добавить в Railway:

1. Railway Dashboard → ваш проект → **Variables**
2. Добавьте каждую переменную отдельно
3. Для `GOOGLE_CREDENTIALS_JSON` и `GOOGLE_TOKEN_JSON` скопируйте **всё содержимое** файлов

### 4. Получение TELEGRAM_TOKEN

1. Найдите [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Скопируйте полученный токен

### 5. Получение CHAT_ID

1. Добавьте бота в чат или начните диалог
2. Отправьте боту любое сообщение
3. Перейдите по ссылке: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
4. Найдите `chat.id` в ответе

## 📱 Команды бота

- `/start` или `/help` - показать справку
- `/events` - показать ближайшие 10 событий

## ⚙️ Настройка

### Интервал проверки

```env
CHECK_INTERVAL=60000  # 60 секунд (по умолчанию)
```

### Время уведомления

```env
NOTIFY_BEFORE_MINUTES=15  # за 15 минут (по умолчанию)
```

### Календарь

```env
CALENDAR_ID=primary  # основной календарь (по умолчанию)
```

## 🔧 Локальная разработка

1. Создайте `.env` файл:

```env
TELEGRAM_TOKEN=your_token
CHAT_ID=your_chat_id
GOOGLE_CREDENTIALS_JSON={"installed":{"client_id":"...","client_secret":"..."}}
GOOGLE_TOKEN_JSON={"access_token":"...","refresh_token":"..."}
```

2. Запустите: `npm start`

## 🚨 Устранение неполадок

### Ошибка "GOOGLE_CREDENTIALS_JSON не установлен"

- Проверьте, что скопировали **всё содержимое** `credentials.json`
- Убедитесь, что включили Google Calendar API

### Ошибка "GOOGLE_TOKEN_JSON не установлен"

- Сначала запустите бота локально для получения токена
- Скопируйте содержимое `token.json` в переменную

### Бот не отвечает на команды

- Проверьте `TELEGRAM_TOKEN` и `CHAT_ID`
- Убедитесь, что бот добавлен в чат

### Нет уведомлений о событиях

- Проверьте `CALENDAR_ID`
- Убедитесь, что в календаре есть события с временем

## 📁 Структура проекта

```
gcal-telegram-bot/
├── bot.js              # Основной код бота
├── package.json        # Зависимости
├── README.md           # Документация
├── .gitignore          # Игнорируемые файлы
└── notified.json       # История уведомлений (создается автоматически)
```

## 🔒 Безопасность

⚠️ **ВАЖНО**: Никогда не коммитьте в Git:

- `credentials.json`
- `token.json`
- `.env`

Все секретные данные должны быть в Railway Variables.

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи в Railway
2. Убедитесь, что все переменные окружения установлены
3. Проверьте, что Google Calendar API включен
4. Убедитесь, что бот добавлен в Telegram чат
