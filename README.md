# Падающие буквы

Тренажёр слепой печати: на экране падают буквы, их нужно успеть нажать.
Русская (ЙЦУКЕН) или латинская раскладка, 5 уровней скорости, наборы букв по рядам,
звук на верное нажатие и ошибку, результаты пользователей хранятся на сервере (SQLite).

## Локальный запуск

Нужен Node.js 22.5+ (встроенный `node:sqlite`, внешних зависимостей нет):

    node server.js        # http://localhost:3000

## Деплой в Dokploy

1. Запушить репозиторий в Git.
2. В Dokploy: Create Service → **Compose**, источник — этот репозиторий, файл `docker-compose.yml`.
3. Deploy. Домен `letters.kachestvobiz-ai.ru` и сертификат Let's Encrypt заданы Traefik-лейблами
   в `docker-compose.yml` — во вкладке Domains ничего добавлять не нужно.
4. DNS: A-запись `letters.kachestvobiz-ai.ru` → IP сервера Dokploy.

База лежит в volume `letters-data` (`/app/data/letters.db`) и переживает передеплой.

## API

- `GET /api/users` — имена пользователей
- `GET /api/results?user=Имя` — последние 100 результатов
- `POST /api/results` — сохранить результат
- `DELETE /api/results?user=Имя` — удалить результаты пользователя
- `GET /api/health`
