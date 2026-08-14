# PayNow

Expense splitting for Indian college students. Node + Express + MongoDB backend, React Native + Expo frontend, Firebase phone auth, Socket.io for real-time payment handshakes.

```
paynow/
├── backend/        Node.js + Express + MongoDB
├── frontend/       React Native + Expo
└── PayNow.html     Original design prototype (visual reference only)
```

## Prerequisites

You need to set these up **before** running anything.

### 1. MongoDB Atlas (free)

1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create a free M0 cluster
3. Add `0.0.0.0/0` to Network Access (or your IP)
4. Database Access → create a user with read/write
5. Connect → drivers → copy the connection string

### 2. Firebase project (free)

1. https://console.firebase.google.com → add project
2. **Authentication** → Sign-in method → enable **Phone**
3. For real device testing, add your phone as a *test number* during dev (avoids SMS quotas)
4. **Project settings → Service accounts → Generate new private key** → download the JSON.
   You'll paste these three fields into `backend/.env`:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` sequences as literal `\n` in the .env value)
5. For the mobile app:
   - **Android**: Project settings → add Android app (package `com.paynow.app`) → download `google-services.json` → place in `frontend/`
   - **iOS**: Project settings → add iOS app (bundle id `com.paynow.app`) → download `GoogleService-Info.plist` → place in `frontend/`

## Backend

```bash
cd backend
npm install
cp .env.example .env       # fill in real values
npm run dev                # or: npm start
```

Smoke test:

```bash
curl http://localhost:5000/health
# → {"ok":true,"ts":...}
```

### Endpoints

| Group        | Endpoint                                       |
| ------------ | ---------------------------------------------- |
| Auth         | `POST /api/auth/verify-token`                  |
|              | `POST /api/auth/complete-profile`              |
| Users        | `GET  /api/users/me`                           |
|              | `PUT  /api/users/me`                           |
|              | `GET  /api/users/search?phone=+91XXXXXXXXXX`   |
|              | `POST /api/users/friends/:userId`              |
|              | `GET  /api/users/friends`                      |
| Groups       | `GET  /api/groups`                             |
|              | `POST /api/groups`                             |
|              | `GET  /api/groups/:groupId`                    |
|              | `PUT  /api/groups/:groupId`                    |
|              | `POST /api/groups/:groupId/members`            |
|              | `DELETE /api/groups/:groupId/members/:userId`  |
|              | `GET  /api/groups/:groupId/balances`           |
| Expenses     | `GET  /api/expenses/group/:groupId`            |
|              | `POST /api/expenses/group/:groupId`            |
|              | `PUT  /api/expenses/:expenseId`                |
|              | `DELETE /api/expenses/:expenseId`              |
|              | `GET  /api/expenses/activity`                  |
| Settlements  | `POST /api/settlements/initiate`               |
|              | `POST /api/settlements/:settlementId/confirm`  |
|              | `POST /api/settlements/:settlementId/dispute`  |
|              | `GET  /api/settlements/group/:groupId`         |
|              | `GET  /api/settlements/pending`                |

All routes except `/api/auth/*` require a `Authorization: Bearer <jwt>` header.

### Socket.io events

Client → server:
- `join_group(groupId, ack)` — join a group room (membership-checked)
- `leave_group(groupId, ack)`
- `payment_initiated`, `payment_confirmed`, `payment_disputed` — fast peer notifications

Server → client (broadcast to `group:<id>`):
- `expense_added`, `expense_updated`, `expense_deleted`
- `payment_initiated`, `payment_confirmed`, `payment_disputed`

## Frontend

```bash
cd frontend
npm install
```

Configure the backend URL — open `frontend/app.json` and edit `expo.extra.apiBaseUrl`. For a phone on your LAN, run [ngrok](https://ngrok.com/) on the backend and use the public URL.

```bash
npx expo start                       # then scan with Expo Go (Android) or run on iOS sim
# or:
npx expo run:android                 # native build (needed for @react-native-firebase/auth)
npx expo run:ios
```

**Important:** `@react-native-firebase/auth` requires a **dev build**, not Expo Go. Run `npx expo prebuild` once and then `npx expo run:android` / `run:ios` to produce a native client.

## Build order checklist

1. ✅ Stand up MongoDB Atlas + Firebase service account
2. ✅ `backend/.env` filled in, `npm run dev`, `/health` returns 200
3. Test endpoints with Postman or `curl` (Firebase ID token for `/auth/verify-token` is the trickiest — easiest is to call `auth().currentUser.getIdToken()` from a tiny test client and copy the value)
4. ✅ `frontend/` deps installed, `app.json` points at backend
5. Run on a real device (phone auth doesn't work in iOS simulator)
6. Sign up → onboard → create group → add expense → settle up → confirm from second device

## Known gaps in this build

These were noted explicitly so you know what's still on you:

- **Optimistic UI** — `addExpense` and `createGroup` refresh from server on success rather than optimistically updating; safe but slightly slower-feeling
- **Client-side FCM token registration** — the backend now fires push via `firebase-admin` on `expense_added`, `payment_initiated`, `payment_confirmed`, `payment_disputed`, but the mobile app still needs to call `messaging().getToken()` once on launch and post it to `PUT /api/users/me`. Without that the backend skips silently (no error)

## Common gotchas

- **Firebase private key in .env** — keep the `\n` sequences as literal characters; the code in `config/firebase.js` converts them back. Wrap the whole value in double quotes.
- **CORS** — the `CORS_ORIGINS` env var supports comma-separated entries and a trailing `*` wildcard suffix (e.g. `exp://*`) for Expo dev clients
- **`localhost` from a phone** — your phone can't reach `localhost`. Use your machine's LAN IP (`http://192.168.x.x:5000`) or ngrok
- **JWT secret** — generate something real: `openssl rand -base64 48`
- **Atlas IP allowlist** — if requests hang for ~30s and time out, you forgot to allow your IP
