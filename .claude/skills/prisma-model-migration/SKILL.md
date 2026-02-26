---
description: Use when adding a new Prisma model, modifying the database schema, or creating a database migration
---

# Prisma Model & Migration

When adding a new database table, update the Prisma schema and create a corresponding migration file.

## Prisma Schema Conventions

File: `prisma/schema.prisma`

### Model Template

```prisma
model <Name> {
  id          String    @id @default(dbgenerated("uuidv7()")) @db.Uuid
  name        String    @db.VarChar(255)
  slug        String    @unique @db.VarChar(255)
  description String?   @db.Text
  isActive    Boolean   @default(true) @map("is_active")
  sortOrder   Int       @default(0) @map("sort_order")
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime  @default(now()) @map("updated_at") @db.Timestamptz(6)
  deletedAt   DateTime? @map("deleted_at") @db.Timestamptz(6)

  // Relations
  posts Post[]

  @@index([slug], map: "<table_name>_slug_index")
  @@map("<table_name>")
}
```

### Field Conventions

| Convention | Example |
|---|---|
| UUID primary key | `@id @default(dbgenerated("uuidv7()")) @db.Uuid` |
| Field name mapping | `coverImageUrl String? @map("cover_image_url")` |
| Table name mapping | `@@map("table_name")` (snake_case plural) |
| Timestamps | `@db.Timestamptz(6)` for all date fields |
| Standard created_at | `@default(now()) @map("created_at") @db.Timestamptz(6)` |
| Standard updated_at | `@default(now()) @map("updated_at") @db.Timestamptz(6)` |
| Soft delete | `deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)` |
| Varchar with limit | `@db.VarChar(255)` |
| Text (unlimited) | `@db.Text` |
| Named index | `@@index([field], map: "table_field_index")` |
| FK relation | `@relation(fields: [fieldId], references: [id], onDelete: Cascade, onUpdate: NoAction)` |

### Enum Pattern

```prisma
enum <EnumName> {
  VALUE_ONE   @map("value_one")
  VALUE_TWO   @map("value_two")
  VALUE_THREE @map("value_three")

  @@map("<enum_name>")
}
```

- Enum name: PascalCase (e.g. `StaffRole`)
- Values: UPPER_CASE (e.g. `ADMIN`)
- `@map()` values: lower_case (e.g. `"admin"`)
- `@@map()` table: snake_case (e.g. `"staff_role"`)

### Join Table Pattern

For many-to-many relations, use an explicit join model:

```prisma
model Post<Name> {
  postId     String   @map("post_id") @db.Uuid
  <name>Id   String   @map("<name>_id") @db.Uuid
  post       Post     @relation(fields: [postId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  <name>     <Name>   @relation(fields: [<name>Id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@id([postId, <name>Id])
  @@index([<name>Id], map: "post_<name>s_<name>_id_index")
  @@map("post_<name>s")
}
```

## Migration File

File: `migrations/<timestamp>_<description>.cjs`

Timestamp format: 13-digit Unix milliseconds (e.g. `1769509700000`). Use the next available timestamp after existing migrations.

### Migration Template

```js
/**
 * Migration: <Description>
 */

exports.up = (pgm) => {
  pgm.createTable('<table_name>', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuidv7()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    slug: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    description: {
      type: 'text',
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    // FK reference
    author_id: {
      type: 'uuid',
      notNull: true,
      references: 'staff(id)',
      onDelete: 'RESTRICT',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    deleted_at: {
      type: 'timestamptz',
    },
  });

  pgm.createIndex('<table_name>', 'slug', {
    name: '<table_name>_slug_index',
  });

  pgm.createIndex('<table_name>', 'author_id', {
    name: '<table_name>_author_id_index',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('<table_name>', { ifExists: true });
};
```

### Migration Conventions

- File uses `.cjs` extension (CommonJS for `node-pg-migrate`)
- Column names are **snake_case** in the migration (matching Prisma `@map`)
- UUID defaults use `pgm.func('uuidv7()')`
- Timestamps use `pgm.func('NOW()')`
- FK references use format `'table_name(column_name)'`
- Index names match pattern `<table>_<column>_index`
- Always include `exports.down` with `pgm.dropTable`
- For adding columns to existing tables, use `pgm.addColumns` / `pgm.dropColumns`

### Running Migrations

```bash
npm run migrate
```

## Prisma Client Sync

After updating `schema.prisma`, regenerate the Prisma client:

```bash
npx prisma generate
```

## Reference

See these files for complete working examples:
- `prisma/schema.prisma` — All models, enums, relations, and join tables
- `migrations/1769509700000_create-posts.cjs` — Table creation with indexes
- `migrations/1769509800000_create-categories-tags.cjs` — Multiple tables + join tables
- `migrations/1769509900000_add-post-seo-fields.cjs` — Adding columns to existing table

## Checklist

- [ ] Model added to `prisma/schema.prisma` with correct conventions
- [ ] All fields use `@map("snake_case")` mapping
- [ ] Model uses `@@map("table_name")` for table name
- [ ] UUID primary key: `@id @default(dbgenerated("uuidv7()")) @db.Uuid`
- [ ] Timestamps use `@db.Timestamptz(6)`
- [ ] Indexes defined with `@@index` and named `map`
- [ ] Enums use PascalCase name, UPPER_CASE values, snake_case maps
- [ ] Migration file created at `migrations/<timestamp>_<description>.cjs`
- [ ] Migration uses `node-pg-migrate` format (`exports.up`, `exports.down`)
- [ ] Migration column names match Prisma `@map` values (snake_case)
- [ ] FK references use `references: 'table(column)'` format
- [ ] `exports.down` reverses all changes
- [ ] Prisma client regenerated with `npx prisma generate`
