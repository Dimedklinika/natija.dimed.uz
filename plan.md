---
name: Lab Results Web App
overview: Build a minimal vanilla JavaScript web application for checking laboratory analysis results with Telegram-based authentication, deployed on Netlify with serverless functions connecting to AWS DynamoDB.
todos: []
---

# Laboratory Analysis Results Web Application

## Architecture Overview

The application uses vanilla HTML/CSS/JavaScript frontend with Netlify Functions as the backend. Authentication is handled via Telegram bot messages with verification codes stored in DynamoDB with 2-minute TTL.

### Data Flow

1. **Authentication Flow:**

- User messages Telegram bot
- Webhook receives message, extracts Telegram user ID, phone number, and name
- System generates 6-digit code, updates/creates user record in UserVerification table
- Code stored with expiration timestamp (2 minutes)
- Code sent back to user via Telegram
- User enters code on web app
- Code verified against UserVerification table, code attributes removed but user record persists
- Session created with user info (stored in localStorage)
- On next login, user messages bot again to get new code (user info already stored)

2. **Results Viewing:**

- Authenticated user's results are searched by phone number
- Results fetched from DynamoDB AnalysisResult table
- Results displayed in UI

## DynamoDB Tables

1. **AnalysisResult** (existing)

- Partition Key: `PatientPhone` (String)
- Sort Key: `date` (String)
- Attributes: Number, Patient, BiomaterialCollectTime, Biomaterial, AnalysisTime, AccomplishedBy, RawComputerResults, Analysis, AnalysisResults, etc.

2. **UserVerification** (new)

- Partition Key: `telegramUserId` (String) - Telegram user ID
- Attributes: `phone` (String), `name` (String), `code` (String, optional), `codeCreatedAt` (Number, optional), `codeTTL` (Number, optional)
- User records persist permanently
- Code attributes (code, codeCreatedAt, codeTTL) are temporary and removed after verification or expiration

## Netlify Functions

### 1. `telegramWebhook.js`

- Receives POST requests from Telegram
- Extracts Telegram user ID, phone number, and name from message
- Generates 6-digit verification code
- Updates or creates user record in UserVerification table (by telegramUserId)
- Sets code, codeCreatedAt, and codeTTL attributes (codeTTL = current time + 120 seconds)
- Sends code back to user via Telegram Bot API
- User record persists even after code expires/removed
- **Endpoint:** `/.netlify/functions/telegramWebhook`

### 2. `verifyLogin.js`

- Receives code from frontend
- Scans UserVerification table filtering by code attribute
- Validates code exists and hasn't expired (codeTTL > current timestamp)
- Returns success with user phone/name/telegramUserId
- Updates user record to remove code attributes (code, codeCreatedAt, codeTTL) using telegramUserId as key
- User record persists with phone/name/telegramUserId for future logins
- **Endpoint:** `/.netlify/functions/verifyLogin`

### 3. `getResults.js`

- Queries AnalysisResult table by PatientPhone
- Optional date filter
- Returns array of results
- **Endpoint:** `/.netlify/functions/getResults`

## Frontend Files

### `public/index.html`

- Login page with code input field
- Results search interface (shown after login)
- Phone number input and date filter
- Results display area
- Language selector dropdown (Uzbek, Russian, English)

### `public/app.js`

- Authentication logic (code verification)
- Session management (localStorage)
- API calls to Netlify functions
- Results display logic
- Logout functionality
- Multi-language support:
- Language detection from browser settings
- Language selection with manual override
- Translation system loading JSON files
- Language preference stored in localStorage

### `public/styles.css`

- Minimal, clean styling
- Responsive layout
- Login and results views
- Language selector styling

### Translation Files

- `public/locales/uz.json` - Uzbek translations (primary language)
- `public/locales/ru.json` - Russian translations
- `public/locales/en.json` - English translations

## Dependencies

**Runtime:**

- `@aws-sdk/client-dynamodb` - DynamoDB client
- `@aws-sdk/lib-dynamodb` - Document client
- `node-fetch` or native fetch - Telegram Bot API calls

**Dev:**

- `netlify-cli` - Local development

## Environment Variables

Required in Netlify Dashboard:

- `MY_AWS_ACCESS_KEY_ID`
- `MY_AWS_SECRET_ACCESS_KEY`
- `MY_AWS_REGION`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET` (optional, for webhook security)

## Implementation Details

1. **Code Generation:** 6-digit numeric codes (100000-999999)
2. **Code Expiration:** codeTTL attribute stores expiration timestamp (current time + 120 seconds)
3. **User Persistence:** User records (telegramUserId, phone, name) persist permanently in UserVerification table
4. **Code Cleanup:** Code attributes (code, codeCreatedAt, codeTTL) are removed after successful verification, but user record remains
5. **Session:** Store user phone/name/telegramUserId in localStorage after successful verification
6. **Telegram Webhook:** Must be configured to point to `https://your-site.netlify.app/.netlify/functions/telegramWebhook`
7. **CORS:** All functions include proper CORS headers for web access
8. **Multi-language Support:**

- Uzbek (uz) as primary/default language
- Russian (ru) and English (en) as additional languages
- Auto-detect language from browser settings (navigator.language)
- Manual language selection via dropdown
- Language preference saved in localStorage
- Translation JSON files for UI text only (buttons, labels, messages)

## File Structure

```javascript
analysis-results/
├── netlify/
│   └── functions/
│       ├── telegramWebhook.js
│       ├── verifyLogin.js
│       └── getResults.js
├── public/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── locales/
│       ├── uz.json
│       ├── ru.json
│       └── en.json
├── package.json
├── netlify.toml
└── .gitignore
```



## Security Considerations