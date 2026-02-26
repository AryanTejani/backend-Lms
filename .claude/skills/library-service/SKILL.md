---
description: Use when creating a new service or repository in a shared library under libs/, adding domain business logic, or building a reusable data access layer
---

# Library Service & Repository

When adding a new domain service, create a repository + service pair under the appropriate library in `libs/<library>/src/`.

## Repository Pattern

File: `libs/<library>/src/repositories/<name>.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { generateUuidV7 } from '@app/shared/utils/uuid.util';

export interface <Name>Record {
  id: string;
  // snake_case fields matching API response shape
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

@Injectable()
export class <Name>Repository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    // camelCase input params
  }): Promise<<Name>Record> {
    const id = generateUuidV7();
    const record = await this.prisma.<model>.create({
      data: { id, ...params },
    });

    return this.mapToRecord(record);
  }

  async findById(id: string): Promise<<Name>Record | null> {
    const record = await this.prisma.<model>.findUnique({ where: { id } });

    if (!record || record.deletedAt !== null) {
      return null;
    }

    return this.mapToRecord(record);
  }

  async findAll(params: {
    page: number;
    limit: number;
  }): Promise<{ data: <Name>Record[]; total: number }> {
    const skip = (params.page - 1) * params.limit;
    const where: Record<string, unknown> = { deletedAt: null };

    const [records, total] = await Promise.all([
      this.prisma.<model>.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.<model>.count({ where }),
    ]);

    return {
      data: records.map((r) => this.mapToRecord(r)),
      total,
    };
  }

  async update(id: string, data: Record<string, unknown>): Promise<<Name>Record> {
    const record = await this.prisma.<model>.update({
      where: { id },
      data,
    });

    return this.mapToRecord(record);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.<model>.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private mapToRecord(record: {
    // Prisma model fields (camelCase)
  }): <Name>Record {
    return {
      id: record.id,
      // Map camelCase Prisma fields → snake_case API response
      // e.g. cover_image_url: record.coverImageUrl,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      deleted_at: record.deletedAt,
    };
  }
}
```

### Key Repository Conventions

- Use `generateUuidV7()` for all new IDs
- `findById` filters out soft-deleted records (`deletedAt !== null`)
- `findAll` uses `Promise.all` for parallel `findMany` + `count`
- `mapToRecord` converts Prisma camelCase fields to snake_case for API responses
- Soft delete sets `deletedAt` to current timestamp (never hard delete)
- `where` objects filter `deletedAt: null` by default

## Service Pattern

File: `libs/<library>/src/services/<name>.service.ts`

```ts
import { Injectable } from '@nestjs/common';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { <Name>Repository, <Name>Record } from '../repositories/<name>.repository';

@Injectable()
export class <Name>Service {
  constructor(private readonly <name>Repository: <Name>Repository) {}

  async create<Name>(
    authorId: string,
    input: { /* typed input */ },
  ): Promise<<Name>Record> {
    const slug = await this.generateUniqueSlug(input.title);

    return this.<name>Repository.create({ ...input, slug, authorId });
  }

  async update<Name>(
    id: string,
    admin: { id: string; role: 'admin' | 'instructor' },
    input: { /* typed input */ },
  ): Promise<<Name>Record> {
    const record = await this.<name>Repository.findById(id);

    if (!record) {
      throw Errors.<name>NotFound();
    }

    // Instructors can only edit their own resources
    if (admin.role === 'instructor' && record.author_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    return this.<name>Repository.update(id, input);
  }

  async delete<Name>(
    id: string,
    admin: { id: string; role: 'admin' | 'instructor' },
  ): Promise<void> {
    const record = await this.<name>Repository.findById(id);

    if (!record) {
      throw Errors.<name>NotFound();
    }

    if (admin.role === 'instructor' && record.author_id !== admin.id) {
      throw Errors.insufficientRole();
    }

    await this.<name>Repository.softDelete(id);
  }

  async get<Name>(id: string): Promise<<Name>Record> {
    const record = await this.<name>Repository.findById(id);

    if (!record) {
      throw Errors.<name>NotFound();
    }

    return record;
  }

  async list<PluralName>(params: {
    page: number;
    limit: number;
    authorId?: string;
  }): Promise<{ data: <Name>Record[]; total: number; page: number; limit: number }> {
    const result = await this.<name>Repository.findAll(params);

    return { ...result, page: params.page, limit: params.limit };
  }

  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (await this.<name>Repository.slugExists(slug, excludeId)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
```

### Key Service Conventions

- Inject the repository, not `PrismaService` directly
- Use `Errors` factory for all thrown exceptions (e.g. `Errors.postNotFound()`)
- Ownership checks: verify `admin.role === 'instructor'` against `record.author_id`
- Slug generation: lowercase, replace non-alphanumeric with dashes, deduplicate with counter
- `list` methods return `{ data, total, page, limit }` shape

## BigInt / Monetary Values

Monetary fields come back as `bigint` from raw SQL and must be converted to `number` in `mapToRecord()`:

```ts
// In the Record interface — expose as number:
export interface OrderRecord {
  id: string;
  total_cents: number; // Expose as number in Record (convert from bigint)
  // ...
}

// In mapToRecord() — convert bigint → number:
private mapToRecord(row: Record<string, unknown>): OrderRecord {
  return {
    id: row.id as string,
    total_cents: Number(row.total_cents),  // bigint from DB → number
    // ...
  };
}
```

When to use `$queryRaw` instead of Prisma model queries:
- Tables with partition keys (Prisma can't generate efficient queries)
- Complex multi-table joins not expressible in Prisma's API
- Monetary/aggregate queries where Prisma returns `bigint` by default

```ts
const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
  SELECT id, total_cents FROM orders WHERE id = ${id}
`;
```

Reference: `libs/billing/src/repositories/order.repository.ts`

## Service-to-Service Calls

A domain service in one library can inject a sync/integration service from another library:

```ts
// libs/content/src/services/course-product.service.ts
@Injectable()
export class CourseProductService {
  constructor(
    private readonly courseRepository: CourseRepository,
    // Cross-library injection — CourseStripeSyncService is from @app/billing
    private readonly courseStripeSyncService: CourseStripeSyncService,
  ) {}
}
```

The consuming module must import both library modules:
```ts
@Module({
  imports: [ContentModule, BillingModule],
  controllers: [CourseController],
})
```

## Module Registration

Add the repository and service to the library module's `providers` and `exports`:

```ts
// libs/<library>/src/<library>.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/shared/prisma/prisma.module';
import { <Name>Repository } from './repositories/<name>.repository';
import { <Name>Service } from './services/<name>.service';

@Module({
  imports: [PrismaModule],
  providers: [<Name>Repository, <Name>Service],
  exports: [<Name>Repository, <Name>Service],
})
export class <Library>Module {}
```

## Barrel Export

Add to the library's `index.ts`:

```ts
// libs/<library>/src/index.ts
export { <Name>Repository } from './repositories/<name>.repository';
export type { <Name>Record } from './repositories/<name>.repository';
export { <Name>Service } from './services/<name>.service';
```

## Error Factory

Add a new error to `libs/shared/src/exceptions/auth.exception.ts` if the resource needs a "not found" error:

```ts
// In AuthErrorCode enum:
<NAME>_NOT_FOUND = '<NAME>_NOT_FOUND',

// In Errors factory:
<name>NotFound: (): AuthException =>
  new AuthException(AuthErrorCode.<NAME>_NOT_FOUND, '<Name> not found', 404),
```

## Reference

See `libs/content/src/` for a complete working example:
- `repositories/post.repository.ts` — Full repository with `mapToRecord`
- `services/post.service.ts` — Service with ownership checks and slug generation
- `content.module.ts` — Module with providers/exports
- `index.ts` — Barrel exports

## Reorder Repository Method

For resources with `sortOrder`, add a `reorder()` method that atomically sets each record's
position using `$transaction` with a mapped array of updates:

```ts
async reorder(ids: string[]): Promise<void> {
  await this.prisma.$transaction(
    ids.map((id, index) =>
      this.prisma.<model>.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
}
```

`prisma.$transaction([...array])` (interactive-transaction variant) is used here — not the
callback form — because the operations are independent and don't need cross-step reads.

Reference: `libs/content/src/repositories/section.repository.ts`

## Cascading Publish/Unpublish

When publishing a parent cascades to all children (e.g., publishing a course publishes all its
sections, lessons, topics), add `publishByParentId(parentId)` and `unpublishByParentId(parentId)`
methods to each child repository, then call them in sequence from the parent service:

```ts
// In parent service:
async publishCourse(productId: string): Promise<CourseRecord> {
  const record = await this.prisma.product.update({
    where: { id: productId },
    data: { isPublished: true, publishedAt: new Date() },
  });

  // Cascade — each repository has publishByProductId()
  await this.sectionRepository.publishByProductId(productId);
  await this.lessonRepository.publishByProductId(productId);
  await this.topicRepository.publishByProductId(productId);

  return this.mapToRecord(record);
}

// In child repository:
async publishByProductId(productId: string): Promise<void> {
  await this.prisma.<model>.updateMany({
    where: { productId, deletedAt: null },
    data: { isPublished: true },
  });
}
```

Note: These cascade calls are NOT wrapped in a single `$transaction` — each is independent, and
a partial failure is acceptable (retry-safe since `updateMany` is idempotent).

Reference: `libs/content/src/services/course-product.service.ts`

## Checklist

- [ ] Repository created at `libs/<library>/src/repositories/<name>.repository.ts`
- [ ] `<Name>Record` interface exported with snake_case fields
- [ ] `generateUuidV7()` used for new record IDs
- [ ] `mapToRecord` method converts camelCase Prisma → snake_case response
- [ ] `findAll` uses `Promise.all` for parallel query + count
- [ ] Soft delete implemented (sets `deletedAt`, never hard deletes)
- [ ] Service created at `libs/<library>/src/services/<name>.service.ts`
- [ ] Service uses `Errors` factory for exceptions
- [ ] Ownership checks in update/delete methods
- [ ] Repository and service added to module `providers` and `exports`
- [ ] Barrel exports added to library `index.ts`
- [ ] Error code added to `AuthErrorCode` enum if needed
- [ ] Monetary fields stored as `bigint` in DB, converted with `Number()` in `mapToRecord()`
- [ ] `$queryRaw` used for partitioned tables or complex joins
- [ ] Cross-library service injection wires both library modules in the consuming module
