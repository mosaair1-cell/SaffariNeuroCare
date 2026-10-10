# Saffari NeuroCare shared API

This API is the shared source of truth for the patient and doctor apps. A patient registration is inserted once into PostgreSQL; the doctor app reads the same record through the authenticated doctor endpoint.

## Important deployment gate
The Android apps do not become connected merely because this folder exists. Deploy this API behind HTTPS and set the same `SAFFARI_API_BASE_URL` in both Flutter builds to the deployed URL ending in `/v1`. Until deployment, apps must show a connection error and must not claim registration has synchronized.

## Deploy
1. Provision a private PostgreSQL database and an HTTPS host/container service.
2. Apply `schema.sql`.
3. Set all variables from `.env.example`; use a unique random JWT secret and a strong doctor password hash. Do not use the demo password in production.
4. Build/run this container. Expose only HTTPS through a reverse proxy; do not expose PostgreSQL publicly.
5. Verify `GET /health`, `POST /v1/patients/register`, and `GET /v1/doctor/patients`.
6. Set Flutter build define `--dart-define=SAFFARI_API_BASE_URL=https://YOUR-API-HOST/v1` for BOTH apps.

## Routes
- `POST /v1/patients/register` — registers a patient as `pending_review`; requires name, surname, mobile, national ID, diseaseCode and clinicCode.
- `POST /v1/patients/login` — verifies mobile and national ID against a salted password hash.
- `POST /v1/doctor/login` — doctor credentials are verified against server-side configuration.
- `GET /v1/doctor/patients` — JWT-authenticated shared patient list.
- `PATCH /v1/doctor/patients/:id/status` — approve/reject new patient registration.

## Privacy/security
The national ID is sensitive health-linked identity data. It is used as the initial password only for compatibility with the requested flow; users should change it to a separate password before clinical rollout. Only a salted hash is stored for login. Use HTTPS, encrypted database/storage/backups, least-privilege access, audit logging, and a privacy notice before real patients use the system. This starter API is not a substitute for a security review or clinical production validation.
