---
description: Use when creating a new admin panel CRUD module, adding a new resource endpoint, or scaffolding a controller under apps/admin-panel/src/modules/
---

# CRUD Admin Module

When creating a new admin panel module, scaffold the following structure under `apps/admin-panel/src/modules/<name>/`:

```
modules/<name>/
├── controllers/
│   └── <name>.controller.ts    # CRUD endpoints
├── schemas/
│   └── <name>.schema.ts        # Zod request validation
└── <name>.module.ts             # NestJS module wiring
```

## Controller Template

```ts
import { Controller, Post, Get, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { <Name>Service } from '@app/<library>/services/<name>.service';
import { <Name>Record } from '@app/<library>/repositories/<name>.repository';
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { CurrentAdmin, AuthenticatedAdmin } from '../../../decorators/current-admin.decorator';
import { create<Name>Schema, update<Name>Schema, Create<Name>Input, Update<Name>Input } from '../schemas/<name>.schema';

@Controller('<plural-name>')
export class <Name>Controller {
  constructor(private readonly <name>Service: <Name>Service) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(create<Name>Schema)) body: Create<Name>Input,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<<Name>Record> {
    return this.<name>Service.create<Name>(admin.id, body);
  }

  @Get()
  async findAll(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ data: <Name>Record[]; total: number; page: number; limit: number }> {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    // Instructors only see their own resources
    const ownerId = admin.role === 'instructor' ? admin.id : undefined;

    return this.<name>Service.list<PluralName>({ page: pageNum, limit: limitNum, ownerId });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<<Name>Record> {
    const record = await this.<name>Service.get<Name>(id);

    if (admin.role === 'instructor' && record.author_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return record;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(update<Name>Schema)) body: Update<Name>Input,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<<Name>Record> {
    return this.<name>Service.update<Name>(id, admin, body);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ): Promise<{ success: boolean }> {
    await this.<name>Service.delete<Name>(id, admin);

    return { success: true };
  }
}
```

## Pagination Pattern

Parse `page` and `limit` from query strings with safe defaults:

```ts
const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));
```

## Publish/Unpublish Actions

```ts
@Post(':id/publish')
async publish(
  @Param('id') id: string,
  @CurrentAdmin() admin: AuthenticatedAdmin,
): Promise<<Name>Record> {
  const record = await this.<name>Service.publish<Name>(id, admin);

  // Sync to Stripe if record has a price (call from controller, not service)
  if (record.amount_cents > 0) {
    try {
      await this.<name>StripeSyncService.syncProductToStripe(id);
    } catch (error) {
      this.logger.error(`Failed to sync ${id} to Stripe on publish`, error);
    }
  }

  return record;
}

@Post(':id/unpublish')
async unpublish(
  @Param('id') id: string,
  @CurrentAdmin() admin: AuthenticatedAdmin,
): Promise<<Name>Record> {
  return this.<name>Service.unpublish<Name>(id, admin);
}
```

Notes:
- Inject `Logger` via `private readonly logger = new Logger(<Name>Controller.name)`
- Import `Logger` from `@nestjs/common`
- Stripe sync runs after publish; error is logged not thrown (non-fatal)
- Reference: `apps/admin-panel/src/modules/courses/controllers/course.controller.ts`

## Customer-Facing Endpoints (main-panel)

When a resource also has customer-facing endpoints in `apps/main-panel/src/modules/<name>/`:

```ts
import { CurrentUser, AuthenticatedUser } from '../../../decorators/current-user.decorator';
import { SessionGuard } from '../../../guards/session.guard';
import { Public } from '@app/shared/decorators/public.decorator';

@Controller()
export class <Name>Controller {
  @Get('plans')
  @Public()                          // No auth required
  async listPlans() { ... }

  @Post('checkout/session')
  @UseGuards(SessionGuard)           // User session (not admin)
  async createSession(
    @CurrentUser() user: AuthenticatedUser,
  ) { ... }
}
```

Key differences from admin controllers:
- `@CurrentUser()` + `AuthenticatedUser` instead of `@CurrentAdmin()` + `AuthenticatedAdmin`
- `@UseGuards(SessionGuard)` instead of `AdminSessionGuard`
- `@Public()` for unauthenticated endpoints (listing plans, webhook receivers)
- Reference: `apps/main-panel/src/modules/checkout/controllers/checkout.controller.ts`

## Reorder Endpoint

When a resource has a `sort_order` field, add a `PUT .../reorder` endpoint that accepts an
ordered array of IDs and atomically updates all sort orders.

Schema:
```ts
export const reorder<Children>Schema = z.object({
  <child>_ids: z.array(z.string().uuid()).min(1),
});
export type Reorder<Children>Input = z.infer<typeof reorder<Children>Schema>;
```

Controller:
```ts
@Put(':parentId/<children>/reorder')
async reorder<Children>(
  @Param('parentId') parentId: string,
  @Body(new ZodValidationPipe(reorder<Children>Schema)) body: Reorder<Children>Input,
  @CurrentAdmin() admin: AuthenticatedAdmin,
): Promise<<Child>Record[]> {
  return this.<child>Service.reorder<Children>(parentId, admin, body.<child>_ids);
}
```

Service delegates to repository `reorder()` method (see library-service skill).

Reference: `apps/admin-panel/src/modules/courses/controllers/course.controller.ts`

## Filter by Status Query Param

```ts
@Query('published') published?: string,

// Safe coercion (string → boolean | undefined):
const isPublished = published === 'true' ? true : published === 'false' ? false : undefined;
```

## Module Wiring

```ts
import { Module } from '@nestjs/common';
import { ContentModule } from '@app/content'; // or relevant library module
import { <Name>Controller } from './controllers/<name>.controller';

@Module({
  imports: [ContentModule],
  controllers: [<Name>Controller],
})
export class <PluralName>Module {}
```

## Root Module Registration

Add the new module to `apps/admin-panel/src/app.module.ts` in the `imports` array under the `// App-specific HTTP modules` section:

```ts
import { <PluralName>Module } from './modules/<plural-name>/<plural-name>.module';

@Module({
  imports: [
    // ...existing modules...
    <PluralName>Module,
  ],
})
```

## Role-Based Access

- Use `@CurrentAdmin() admin: AuthenticatedAdmin` to get the logged-in admin
- Instructors (`admin.role === 'instructor'`) should only see/edit their own resources
- Admins (`admin.role === 'admin'`) can see/edit all resources
- Use `Errors.insufficientRole()` to throw 403 when access is denied

## Reference

See `apps/admin-panel/src/modules/posts/` for a complete working example:
- `controllers/post.controller.ts` — CRUD controller with role checks
- `schemas/post.schema.ts` — Zod validation schemas
- `posts.module.ts` — Module wiring with ContentModule import

## Checklist

- [ ] Controller created at `modules/<name>/controllers/<name>.controller.ts`
- [ ] Zod schemas created at `modules/<name>/schemas/<name>.schema.ts`
- [ ] Module created at `modules/<name>/<name>.module.ts`
- [ ] Module imports the relevant library module (e.g. `ContentModule`)
- [ ] Module registered in `app.module.ts` imports array
- [ ] All CRUD methods use `@CurrentAdmin()` decorator
- [ ] Request bodies validated with `ZodValidationPipe`
- [ ] Pagination uses `page`/`limit` query params with safe parsing
- [ ] Role-based ownership checks implemented (instructors see own, admins see all)
- [ ] Delete returns `{ success: boolean }`
- [ ] `Logger` injected if controller has publish/unpublish actions
- [ ] Publish action syncs to Stripe (non-fatal: log error, don't throw)
- [ ] Customer-facing routes use `@CurrentUser()` + `SessionGuard` + `@Public()`
- [ ] Boolean query params use safe string coercion
