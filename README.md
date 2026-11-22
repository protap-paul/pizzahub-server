# PizzaHub Server

Express.js and MongoDB API for the PizzaHub pizza ordering platform. It provides Better Auth authentication, JWT/role-based authorization, menu moderation, orders, favorites, reviews, subscriptions, and Stripe webhook handling.

## Live Links

- **Live API:** https://pizzahub-server-ehzh.onrender.com
- **Live client:** https://pizzahub-client-sigma.vercel.app
- **Server repository:** https://github.com/protap-paul/pizzahub-server
- **Client repository:** https://github.com/protap-paul/pizzahub-client

## Features

- Better Auth with MongoDB adapter, email/password, Google OAuth, JWT plugin, and role metadata (`customer`, `vendor`, `admin`).
- Server-side ownership and role checks on all protected business routes.
- Menu item creation with ImgBB upload handling, admin approval workflow, public approved-only listing, search, category/location filters, price sorting, and pagination.
- Order creation, duplicate prevention, status workflow, and role-specific order queries.
- Customer favorites and menu item reviews/ratings.
- Dashboard statistics for each role and admin transaction reporting.
- Stripe Checkout sessions for vendor Premium plus webhook-verified activation, renewal, cancellation, and transaction recording.
- Health endpoint, JSON 404 handler, and global error handler.

## Technology Stack

- Express.js 5
- MongoDB with `mongodb` driver
- Better Auth with `@better-auth/mongo-adapter` and JWT plugin
- `jose` for JWKS-based JWT verification
- Stripe SDK
- Multer for image upload handling
- Resend for order notification emails
- ImgBB for hosted menu item images
- `dotenv`, `cors`

## Environment Variables

Create `.env` from `.env.example`:

```env
PORT=5000
CLIENT_URL=http://localhost:3000

MONGODB_URI=
DB_NAME=pizzahub

BETTER_AUTH_SECRET=replace-with-a-random-secret
BETTER_AUTH_URL=http://localhost:5000

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PREMIUM_PRICE_ID=your_stripe_price_id
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

RESEND_API_KEY=your_resend_api_key
RESEND_TEST_EMAIL=your_verified_email@example.com
NODE_ENV=development

IMGBB_API_KEY=your_imgbb_api_key
```

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port used by Express. |
| `CLIENT_URL` | Allowed browser origin for CORS with credentials. |
| `MONGODB_URI` | MongoDB Atlas/local connection string. |
| `DB_NAME` | Application database name. |
| `BETTER_AUTH_SECRET` | Secret used to sign Better Auth tokens/cookies. |
| `BETTER_AUTH_URL` | Public server URL used for auth callbacks, JWT issuer/audience, and JWKS. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth credentials. |
| `STRIPE_SECRET_KEY` | Stripe secret key; server-side only. |
| `STRIPE_PREMIUM_PRICE_ID` | Price ID used for the vendor Premium subscription. |
| `STRIPE_WEBHOOK_SECRET` | Secret used to verify Stripe webhook signatures. |
| `IMGBB_API_KEY` | API key used to host menu item images. |
| `RESEND_API_KEY`, `RESEND_TEST_EMAIL` | Optional email notification configuration. |
| `NODE_ENV` | Runtime mode. |

> Never commit `.env` or real credentials. The repository only tracks `.env.example`.

## Local Installation

```bash
git clone https://github.com/protap-paul/pizzahub-server.git
cd pizzahub-server
npm install
cp .env.example .env
# Fill in the required environment variables
npm run dev
```

The API runs on http://localhost:5000 by default. Check http://localhost:5000/api/health.

For production:

```bash
npm start
```

## Main Route Prefixes

- `/api/auth/*` — Better Auth handler, including JWT and JWKS endpoints
- `/api/menu-items` — public menu, vendor menu CRUD, admin moderation, reviews, and image upload
- `/api/users` — profile, favorites, and admin user management
- `/api/orders` — customer orders, vendor orders, and order status updates
- `/api/dashboard` — role-specific dashboard statistics
- `/api/subscriptions` — Stripe checkout and subscription cancellation
- `/api/transactions` — admin transaction listing
- `/api/stripe/webhook` — raw-body Stripe webhook endpoint
- `/api/health` — health check

## Security Flow

1. The client obtains a JWT from the Better Auth `jwt` plugin.
2. Protected requests send `Authorization: Bearer <token>`.
3. `verifyToken` verifies the token with Stripe-free JWKS discovery from `${BETTER_AUTH_URL}/api/auth/jwks`, checks standard claims and the user payload, and attaches `req.user`.
4. `checkBlockedUser` rejects blocked accounts.
5. `authorizeRoles(...allowedRoles)` checks the role and returns 403 when forbidden.
6. Controllers verify resource ownership before updates and deletes.

Stripe Premium activation is performed only inside the verified webhook handler. A successful checkout redirect is never trusted to change the subscription plan. The webhook route is registered before `express.json()` so Stripe signatures are verified against the raw body.

## Deployment Notes

- Set `CLIENT_URL` to the deployed Vercel URL and `BETTER_AUTH_URL` to the deployed Render URL.
- Add the deployed client origin to Better Auth `trustedOrigins` and Google OAuth redirect URIs.
- Register `https://<server-domain>/api/stripe/webhook` in Stripe with the `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted` events.
- Admin accounts are not created through public registration. Provision them securely in the database/auth collection and supply the credentials separately for testing.
