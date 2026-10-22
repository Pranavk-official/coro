/** Text snippets shown in more than one docs page. */
export const ENV_PROD = `# Required
BETTER_AUTH_URL=https://meet.example.com
BETTER_AUTH_SECRET=
INTERNAL_SECRET=
POSTGRES_PASSWORD=
DATABASE_URL=postgresql://app:<POSTGRES_PASSWORD>@db:5432/app
MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minio
S3_SECRET_KEY=<MINIO_ROOT_PASSWORD>
S3_BUCKET=coro
S3_PUBLIC_ENDPOINT=https://meet.example.com
REDIS_URL=redis://redis:6379
REDIS_REQUIRED=1
TRUST_PROXY=1

# HTTPS (deploy/caddy.compose.yml)
DOMAIN=meet.example.com

# Email: magic links, verification, password reset
SMTP_URL=smtps://user:password@smtp.example.com:465
MAIL_FROM=Coro <no-reply@example.com>

# Optional
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
TURN_HOST=
TURN_SECRET=
TURN_EXTERNAL_IP=`;

export const START = `sh -c "bunx prisma migrate deploy && node --import tsx server.ts"`;
