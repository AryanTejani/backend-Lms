# TraderLion Platform Backend

## Tech Stack

- **Runtime**: NestJS 11, Express 5, TypeScript 5.9 (ES2024, strict mode)
- **Database**: PostgreSQL + Prisma 7 (with `@prisma/adapter-pg`)
- **Migrations**: node-pg-migrate (NOT Prisma migrations)
- **Validation**: Zod 4 (never class-validator)
- **Cache/Sessions**: Redis via ioredis
- **Storage**: Bunny CDN (file storage + video streaming)
- **Email**: AWS SES
- **Auth**: JWT (`@nestjs/jwt`) + cookie-based sessions

## Commands

```bash
# Development
npm run dev              # Start main-panel (watch mode)
npm run dev:admin        # Start admin-panel (watch mode)
npm run dev:mobile       # Start mobile-api (watch mode)
npm run dev:all          # Start all apps concurrently

# Build
npm run build:all        # Build all three apps

# Production
npm run start:prod       # main-panel
npm run start:prod:admin # admin-panel
npm run start:prod:mobile # mobile-api

# Database
npm run migrate          # Run migrations up
npm run migrate:down     # Rollback last migration
npm run migrate:create   # Create new migration file
npx prisma generate      # Regenerate Prisma client (after schema changes)

# Quality
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier write
npm run format:check     # Prettier check
npm run typecheck        # Type-check all three apps

# Seed
npm run seed:admin       # Seed initial admin user
```

## Project Structure

NestJS monorepo with 3 apps and 5 libs:

```
apps/
  main-panel/          # Customer-facing API
  admin-panel/         # Admin/instructor API
  mobile-api/          # Mobile client API
libs/
  shared/              # Infrastructure: DB, Prisma, Cache, Email, Storage, guards, pipes, utils
  auth/                # Auth domain logic (JWT, sessions, OAuth)
  content/             # Content domain (posts, categories, tags)
  billing/             # Billing domain
  customer/            # Customer domain
prisma/
  schema.prisma        # Single schema (all models)
migrations/            # node-pg-migrate .cjs files
```

Each admin module follows this structure:
```
modules/<name>/
  controllers/         # HTTP controllers
  schemas/             # Zod validation schemas
  <name>.module.ts     # NestJS module definition
```

## Path Aliases

Defined in `tsconfig.json`, used everywhere:
```
@app/shared    → libs/shared/src
@app/auth      → libs/auth/src
@app/content   → libs/content/src
@app/billing   → libs/billing/src
@app/customer  → libs/customer/src
```

## Key Conventions

### Repository Pattern
- Repositories inject `PrismaService` and expose domain methods
- Each repository has a `mapToRecord()` method that converts Prisma's camelCase fields to snake_case for API responses
- Record interfaces (e.g., `PostRecord`) use snake_case field names
- Prisma model fields are camelCase, DB columns are snake_case via `@map()`

### ID Generation
- Always use `generateUuidV7()` from `@app/shared/utils/uuid.util` for new record IDs

### Validation
- Zod schemas + `ZodValidationPipe` from `@app/shared` — never use class-validator
- `ZodValidation` decorator for applying pipe to specific endpoints

### Error Handling
- Use `Errors` factory from `@app/shared` (e.g., `Errors.postNotFound()`, `Errors.unauthorized()`)
- Throws `AuthException` with typed error codes (`AuthErrorCode` enum)
- `AuthExceptionFilter` formats error responses

### Auth (Admin Panel)
- `@CurrentAdmin()` decorator extracts `AuthenticatedAdmin` from request
- `@AdminSessionId()` decorator extracts session ID
- `AuthenticatedAdmin` has: `id`, `email`, `first_name`, `last_name`, `role` (`'admin' | 'instructor'`)
- `@Public()` decorator skips auth guards on specific endpoints
- Global guards order: `ThrottleGuard` → `AdminSessionGuard` → `RoleGuard`

### Storage
- `StorageModule` is `@Global()` — no need to import in feature modules
- `StorageService` handles Bunny CDN file uploads/deletes
- `VideoService` handles Bunny video streaming API
- Upload path pattern: `{folder}/{year}/{month}/{uuidv7}.{ext}`

### Soft Delete
- Set `deletedAt` timestamp, never hard delete records
- Filter `deletedAt: null` in all queries

### Migrations
- Use `node-pg-migrate`, NOT `prisma migrate`
- Files are `.cjs` in `migrations/` directory
- Naming: `{timestamp}_{description}.cjs`
- After schema changes: run `npx prisma generate` (not `prisma migrate`)

### Code Style
- Prettier: singleQuote, trailingComma all, semi, printWidth 150, tabWidth 2
- ESLint: explicit-function-return-type required, unused-imports enforced, no-param-reassign
- Blank lines required before/after control flow statements (if, for, while, try, etc.)

## Gotchas

- **Migrations**: Always create `.cjs` files via `npm run migrate:create` — never use `prisma migrate`
- **Prisma generate**: After editing `prisma/schema.prisma`, run `npx prisma generate` to update the client
- **camelCase vs snake_case**: Prisma fields are camelCase, DB columns are snake_case (`@map()`), API responses are snake_case (converted by repository `mapToRecord`)
- **StorageModule is global**: Don't import it in feature modules — it's already available everywhere
- **Guard order matters**: ThrottleGuard → AdminSessionGuard → RoleGuard (defined in `app.module.ts` providers)
- **`@Public()` decorator**: Required to skip auth guards on endpoints like health checks and login
- **`explicit-function-return-type`**: ESLint requires explicit return types on all functions — don't omit them
- **`noUncheckedIndexedAccess`**: TypeScript config enables this — array/object index access returns `T | undefined`
