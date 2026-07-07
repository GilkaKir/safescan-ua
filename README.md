# SafeScan UA — Інструкція розгортання на Vercel

## Структура проекту

```
safescan-ua/
├── api/
│   └── analyze.js      ← серверна функція (проксі до Anthropic)
├── src/
│   ├── main.jsx        ← точка входу React
│   └── App.jsx         ← головний додаток
├── public/
│   └── manifest.json   ← PWA маніфест
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

## Крок 1 — GitHub репозиторій

1. Зареєструйтесь на github.com
2. Створіть новий репозиторій "safescan-ua"
3. Завантажте всі файли цієї папки в репозиторій

## Крок 2 — Vercel підключення

1. Зайдіть на vercel.com
2. "Add New Project" → імпортуйте GitHub репозиторій
3. Framework Preset: **Vite**
4. Build Command: `npm run build`
5. Output Directory: `dist`

## Крок 3 — API ключ (ОБОВ'ЯЗКОВО)

1. У Vercel Dashboard → ваш проект → **Settings → Environment Variables**
2. Додайте змінну:
   - Name: `ANTHROPIC_API_KEY`
   - Value: ваш ключ з console.anthropic.com
   - Environment: Production, Preview, Development
3. Натисніть **Save**
4. Зробіть **Redeploy** проекту

## Крок 4 — Перевірка

Відкрийте ваш-домен.vercel.app/api/analyze в браузері.
Має показати: `{"error":"Method not allowed"}` — це нормально, значить функція працює.

## Як отримати API ключ Anthropic

1. Зайдіть на console.anthropic.com
2. Зареєструйтесь
3. API Keys → Create Key
4. Скопіюйте ключ (показується тільки один раз!)
5. Встановіть ліміт витрат: Billing → Usage Limits → $20-50/міс

## Камера на мобільному

На мобільному телефоні:
- Кнопка "📷 Камера" — відкриває камеру напряму
- Кнопка "🖼 Галерея" — вибір з фотоальбому
- Потрібен дозвіл на доступ до камери при першому запуску

## PWA — встановлення як додаток

**Android Chrome:**
Меню (три крапки) → "Додати на головний екран"

**iOS Safari:**
Кнопка "Поділитись" → "На екран Дому"

## Вирішення проблем

### "Failed to fetch"
→ Перевірте чи додали ANTHROPIC_API_KEY у Vercel Environment Variables
→ Зробіть Redeploy після додавання ключа

### Камера не відкривається
→ Сайт повинен бути на HTTPS (Vercel автоматично)
→ Дозвольте доступ до камери у налаштуваннях браузера

### Помилка 429
→ Вичерпано ліміт API. Зачекайте або підвищіть ліміт у console.anthropic.com
