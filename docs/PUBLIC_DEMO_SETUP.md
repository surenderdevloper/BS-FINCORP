# Public demo deployment

The public demo must run as a **separate Vercel project with a separate MongoDB database**.
The client deployment keeps its existing `MONGODB_URI`; the demo deployment uses a different
database URI and a different `AUTH_SECRET`. Do not enable `PUBLIC_DEMO_MODE` on a client
deployment.

## 1. Create an isolated demo database

Create a new MongoDB database whose name includes `demo`, for example `gfm_demo`. Prefer a
dedicated MongoDB database user that can read and write only this demo database. Never reuse the
client's production URI or database user for the demo.

## 2. Create a separate Vercel project

Import this same repository as a second Vercel project and give it its own public URL, for example
`https://gfm-demo.vercel.app`. Configure these environment variables on the demo project:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | URI for the new demo database only |
| `AUTH_SECRET` | A new random secret, different from the client deployment |
| `MULTI_TENANT` | `off` (or leave unset) |
| `PUBLIC_DEMO_MODE` | `on` |
| `PUBLIC_DEMO_DATABASE_NAME` | Exact MongoDB database name, such as `gfm_demo` |
| `PUBLIC_DEMO_USER_EMAIL` | Email of the demo admin created in the next step |
| `CLIENT_NAME` | `gfm-demo` |

Do not copy client SMTP, SMS, WhatsApp, backup storage, or other external-service credentials to
the demo project. The demo login endpoint checks that multi-tenant mode is off and that the live
MongoDB connection's database name matches `PUBLIC_DEMO_DATABASE_NAME`.

## 3. Seed fake demo data

Run the seed script against the **new, empty demo database only**:

```bash
MONGODB_URI="<demo-database-uri>" \
SEED_ADMIN_EMAIL="demo@example.invalid" \
SEED_ADMIN_PASSWORD="<unique-random-password-at-least-12-characters>" \
npm run seed
```

Set `PUBLIC_DEMO_USER_EMAIL` to the same email. The seed script drops its target database before
creating sample records, so never run this command with a client or production URI. The password
is only needed for seeding; visitors use the public demo button and do not receive it.

## 4. Link the client welcome page to the demo

On the client-facing Vercel project, set `PUBLIC_DEMO_URL` to the demo project's base URL, for
example `https://gfm-demo.vercel.app`, then redeploy. The welcome page's **Client Login** button
continues to `/login`; **View Live Demo** opens the demo project's public sign-in endpoint and
lands on its dashboard.

The demo is a shared public admin account. Visitors can change the demo database, so schedule a
reset/reseed if you want every visitor to see the original sample state. Those changes remain in
the isolated demo database and cannot alter the client's database.
