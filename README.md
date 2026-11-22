# PizzaHub — API Server

REST API for the PizzaHub pizza ordering & delivery platform. Built with **Express 5**, **MongoDB
(Mongoose)**, **Better Auth** and **Stripe**.

> **Live links**
>
> - API Server: `https://pizza-hub-server-six.vercel.app`
> - Client Application: `https://pizzahub-pink.vercel.app`
> - Server GitHub Repository: `https://github.com/abu-tahir-sk/Pizza-Hub-server`
> - Client GitHub Repository: `https://github.com/abu-tahir-sk/Pizza-Hub-client`
>
> Health check: `GET /api/health`

## Features

- **Better Auth** email/password + Google OAuth, MongoDB adapter
- Session → JWT bridge (`POST /api/auth-extra/token`) with HS256 tokens
- Role-based access control (`customer`, `vendor`, `admin`) and ownership checks on every resource
- Blocked users rejected with `403`; missing/invalid tokens return `401`
- Menu API: search, category/location filters, price sorting, pagination, featured items
- Order API: place, list (customer/vendor), cancel, accept/reject, per-user stats
- Vendor subscriptions through **Stripe Checkout** (vendors only)
- Premium activates **only** through the signature-verified Stripe webhook
- Admin API: overview stats, user moderation, menu approval, read-only transactions
- Image upload proxy to **ImgBB** (API key stays server-side)
- Secure admin seeding script (no public admin signup)
- Validation with Zod, centralized error handling, Helmet, CORS, request logging

## Tech stack

| Layer | Tech |
| --- | --- |
| Runtime | Node.js 18+ |
| Framework | Express 5 |
| Language | TypeScript (ESM) |
| Database | MongoDB + Mongoose |
| Auth | Better Auth + `jsonwebtoken` |
| Payments | Stripe Checkout + webhooks |
| Images | ImgBB |
| Validation | Zod |

## Getting started

```bash
# 1. install dependencies
npm install

# 2. configure environment
cp .env.example .env
#    fill in MongoDB, Better Auth, Stripe and ImgBB credentials

# 3. run the dev server
npm run dev
# → http://localhost:5000

# 4. (optional) create the admin account
npm run seed:admin
```

The client (`../client`) expects this API at `http://localhost:5000` by default.

## Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `PORT` | no | API port (default `5000`) |
| `NODE_ENV` | no | `development` or `production` |
| `CLIENT_URL` | yes | Client origin for CORS + Better Auth trusted origins |
| `MONGODB_URI` | yes | MongoDB connection string |
| `BETTER_AUTH_SECRET` | yes | Long random secret used by Better Auth |
| `BETTER_AUTH_URL` | yes | Public base URL of this API |
| `GOOGLE_CLIENT_ID` | no | Google OAuth client id (social login disabled when empty) |
| `GOOGLE_CLIENT_SECRET` | no | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | yes | Stripe secret key (server-side only) |
| `STRIPE_WEBHOOK_SECRET` | yes | Signing secret for `POST /api/payments/webhook` |
| `STRIPE_PREMIUM_PRICE_ID` | no | Optional Stripe Price id; falls back to inline price data |
| `IMGBB_API_KEY` | yes | ImgBB API key for menu image uploads |
| `ADMIN_NAME` | no | Seed admin display name |
| `ADMIN_EMAIL` | no | Seed admin email |
| `ADMIN_PASSWORD` | no | Seed admin password |

Never commit `.env` — it is git-ignored.

## Admin seed

```bash
npm run seed:admin
```

The script writes directly to the Better Auth `user` / `account` collections. It uses an ObjectId for
`user._id`, and the credential row follows Better Auth's contract exactly:
`userId = user._id`, `accountId = user._id.toHexString()` and `providerId = "credential"` with a
bcrypt password hash. It is idempotent (re-running resets the admin password and repairs the
credential row), and it is the only way to create an `admin` account; public signup always resolves
to `customer` or `vendor`.

## API overview

| Method & path | Access | Purpose |
| --- | --- | --- |
| `POST /api/auth/*` | public | Better Auth (sign in/up, Google, session) |
| `POST /api/auth-extra/token` | session | Mint a PizzaHub JWT from the session cookie |
| `GET /api/menu` | public | Browse/search/filter/sort/paginate approved items |
| `GET /api/menu/featured` | public | Featured (premium vendor) items |
| `GET /api/menu/:id` | public | Item details |
| `GET /api/menu/vendor/my-items` | vendor | Own items |
| `POST /api/menu` | vendor | Create item (pending approval) |
| `PATCH /api/menu/:id` | vendor (owner) | Edit item / toggle availability |
| `DELETE /api/menu/:id` | vendor (owner) | Delete item |
| `POST /api/orders` | customer | Place an order |
| `GET /api/orders/my` | customer | Own orders |
| `GET /api/orders/vendor` | vendor | Orders for own items |
| `PATCH /api/orders/:id/cancel` | customer (owner) | Cancel a pending order |
| `PATCH /api/orders/:id/decision` | vendor (owner) | Accept / reject |
| `GET /api/orders/stats` | authenticated | Role-scoped order statistics |
| `POST /api/payments/create-checkout-session` | vendor | Stripe Checkout |
| `GET /api/payments/verify` | vendor (owner) | Verify a checkout session |
| `GET /api/payments/my-transactions` | vendor | Own payment history |
| `POST /api/payments/webhook` | Stripe signature | Activate Premium (raw body) |
| `GET/PATCH /api/users/me` | authenticated | Read/update own profile |
| `POST /api/uploads/image` | vendor | Upload image via ImgBB |
| `GET /api/admin/overview` | admin | Dashboard statistics |
| `GET /api/admin/users` | admin | List/search users |
| `PATCH /api/admin/users/:id/block-status` | admin | Block/unblock (admins protected) |
| `GET /api/admin/menu-items` | admin | Moderate items |
| `PATCH /api/admin/menu-items/:id/status` | admin | Approve/reject |
| `DELETE /api/admin/menu-items/:id` | admin | Delete item |
| `GET /api/admin/transactions` | admin | Read-only payments + revenue |

## Implementation notes

### Authentication & authorization flow

1. The client signs in through **Better Auth** and then calls `POST /api/auth-extra/token` with the
   session cookie. The server mints a short-lived **HS256 JWT** containing the user id.
2. Every business route is wrapped by `verifyJWT`. It reads `Authorization: Bearer <token>`, verifies
   the signature/expiry, then **re-loads the user from MongoDB** on each request. This means a blocked
   user or a deleted account loses access immediately, even while holding an unexpired token.
3. `verifyJWT` rejects missing/invalid tokens with `401`, and blocked users with `403`.
4. `requireRole("customer" | "vendor" | "admin")` adds role checks and returns `403` on mismatch.
5. Ownership is enforced in the database query itself (`{ _id, vendorId: req.user._id }`), so a
   vendor/customer cannot read or mutate another user's rows even by guessing an id.
6. Profile updates (`PATCH /api/users/me`) accept only `name` and `image`. The Zod schema strips
   `role`, `isBlocked`, `subscriptionPlan` and `subscriptionExpiresAt`, so privilege escalation through
   the profile endpoint is impossible. Admins cannot block other admins.

### Menu search, filter, sort & pagination

`GET /api/menu` accepts the following query parameters (all optional):

| Param | Values | Default | Behaviour |
| --- | --- | --- | --- |
| `search` | text | — | Case-insensitive match on item name and description |
| `category` | one of `MENU_CATEGORIES` | — | Exact category filter |
| `location` | text | — | Case-insensitive location match |
| `sortBy` | `createdAt`, `price` | `createdAt` | Sort field |
| `sortDir` | `asc`, `desc` | `desc` | Sort direction |
| `page` | integer ≥ 1 | `1` | 1-based page number |
| `limit` | 1–50 | `9` | Page size |

The response includes `data` plus pagination metadata (`page`, `limit`, `total`, `totalPages`). Only
`status: "approved"` items are ever returned publicly; pending/rejected/inactive items are hidden and
`GET /api/menu/:id` returns `404` for them.

### Order rules

- Statuses: `pending → accepted | rejected`, plus `cancelled` (customer only, and only while pending).
- A vendor may decide an order **once**; a second decision returns `409`.
- Duplicate guard: a customer cannot have two `pending`/`accepted` orders for the same item on the
  same delivery date (`409`).
- Self-ordering is blocked (`403`), and only `approved` items can be ordered.
- Delivery dates must be in the future.
- **Customer orders are cash-on-delivery only.** Stripe is used exclusively for vendor subscription
  upgrades; there is no online payment path for pizza orders.

### Payments (vendor subscriptions only)

1. `POST /api/payments/create-checkout-session` creates a Stripe Checkout session and a `pending`
   transaction row. The vendor is redirected to Stripe's hosted page.
2. Premium is **never** granted from the success redirect. The client can only read status.
3. `POST /api/payments/webhook` verifies the Stripe signature against the raw body, then atomically
   moves the transaction `pending → paid`. Premium is activated only when that transition succeeds,
   which also makes webhook redelivery idempotent.
4. Expired/failed checkout sessions are marked `expired`/`failed`. Expired Premium plans fall back to
   `free` on the next authenticated request.

### Database collections

There are exactly four business collections: **users**, **menuItems**, **orders**, and
**transactions**. Better Auth keeps its own `session`/`account` collections; no extra business
collections are introduced.

## Security model

- Better Auth owns sessions; business APIs require `Authorization: Bearer <JWT>`.
- `verifyJWT` re-checks the user in MongoDB on every request, so blocking a user takes effect
  immediately even if they still hold a valid token.
- `requireRole(...)` enforces role access; ownership is checked in queries (`vendorId: req.user._id`).
- Transactions have **no** admin write endpoint — only the verified Stripe webhook changes status.
- Stripe webhook uses the raw request body and signature verification; metadata (vendor + plan) is
  trusted because it was written server-side.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start with `tsx watch` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run the compiled server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed:admin` | Create/update the admin account |

## Deployment

1. Set every variable from `.env.example` in your host (Render/Railway/Fly/etc.).
2. Set `BETTER_AUTH_URL` to the public API URL and `CLIENT_URL` to the deployed client.
3. Register the Stripe webhook endpoint `https://<api>/api/payments/webhook` for
   `checkout.session.completed` and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Run `npm run seed:admin` once against the production database.
