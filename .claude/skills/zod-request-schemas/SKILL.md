---
description: Use when creating Zod validation schemas for API request bodies, adding input validation, or defining typed request DTOs
---

# Zod Request Schemas

When adding request validation for an API endpoint, create Zod schemas in the module's `schemas/` directory.

## File Location

```
apps/admin-panel/src/modules/<name>/schemas/<name>.schema.ts
```

## Schema Template

```ts
import { z } from 'zod';

export const create<Name>Schema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be less than 500 characters'),
  content: z.string().min(1, 'Content is required').max(500000),
  description: z.string().max(1000).optional(),
  imageUrl: z.url('Invalid URL').max(1000).optional(),
  relatedIds: z.array(z.string().uuid()).optional(),
});

export const update<Name>Schema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(500000).optional(),
  description: z.string().max(1000).nullable().optional(),
  imageUrl: z.url('Invalid URL').max(1000).nullable().optional(),
  relatedIds: z.array(z.string().uuid()).optional(),
});

export type Create<Name>Input = z.infer<typeof create<Name>Schema>;
export type Update<Name>Input = z.infer<typeof update<Name>Schema>;
```

## Create vs Update Pattern

- **Create schema**: Required fields use `.min(1, 'message')`, optional fields use `.optional()`
- **Update schema**: All fields are `.optional()` (partial update)
- **Clearable fields**: Fields that can be set to `null` to clear them use `.nullable().optional()` in the update schema

```ts
// Create: required
title: z.string().min(1, 'Title is required').max(500),

// Update: optional (can update but not clear)
title: z.string().min(1).max(500).optional(),

// Update: nullable + optional (can update or clear)
excerpt: z.string().max(1000).nullable().optional(),
```

## Type Inference

Always infer TypeScript types from schemas — never define request types manually:

```ts
export type Create<Name>Input = z.infer<typeof create<Name>Schema>;
export type Update<Name>Input = z.infer<typeof update<Name>Schema>;
```

## Usage with ZodValidationPipe

Apply the schema in the controller using `ZodValidationPipe`:

```ts
import { ZodValidationPipe } from '@app/shared/pipes/zod-validation.pipe';
import { create<Name>Schema, Create<Name>Input } from '../schemas/<name>.schema';

@Post()
async create(
  @Body(new ZodValidationPipe(create<Name>Schema)) body: Create<Name>Input,
): Promise<<Name>Record> {
  // body is validated and typed
}
```

## Common Validators

| Validator | Use case |
|---|---|
| `z.string().min(1).max(500)` | Required text field with max length |
| `z.string().max(1000).optional()` | Optional text field |
| `z.url('Invalid URL').max(1000)` | URL field with validation message |
| `z.array(z.string().uuid())` | Array of UUID references |
| `z.coerce.number()` | Number from string (query params) |
| `.nullable().optional()` | Field that can be updated or cleared |

## Validation Error Handling

`ZodValidationPipe` automatically catches `ZodError` and throws via `Errors.validationError()`, returning the first issue's message. No extra error handling is needed in the controller.

## Reference

See `apps/admin-panel/src/modules/posts/schemas/post.schema.ts` for a complete example with:
- Required fields in create, optional in update
- `.nullable().optional()` for clearable fields (`excerpt`, `coverImageUrl`)
- UUID array fields (`categoryIds`, `tagIds`)
- Type inference exports

## Discriminated Union Schemas

When one endpoint handles two distinct operation types (e.g., full vs. partial refund), use
`z.discriminatedUnion()` so TypeScript narrows the type in the controller.

```ts
export const refundOrderSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('full'),
    order_year: z.number().int().min(2020).max(2099),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal('partial'),
    order_year: z.number().int().min(2020).max(2099),
    amount_cents: z.number().int().positive('Refund amount must be positive'),
    reason: z.string().optional(),
  }),
]);

export type RefundOrderInput = z.infer<typeof refundOrderSchema>;

// Controller — TypeScript narrows type after discriminant check:
if (body.type === 'full') {
  await this.refundService.issueFullRefund(orderId, body.order_year, body.reason);
} else {
  await this.refundService.issuePartialRefund(orderId, body.order_year, body.amount_cents);
}
```

Use `z.discriminatedUnion` (not `z.union`) when schemas share a literal discriminant field — it
gives better error messages and faster validation.

Reference: `apps/admin-panel/src/modules/customers/schemas/customer.schema.ts`

## Checklist

- [ ] Schema file created at `modules/<name>/schemas/<name>.schema.ts`
- [ ] `create<Name>Schema` defined with required fields
- [ ] `update<Name>Schema` defined with all fields `.optional()`
- [ ] Clearable fields use `.nullable().optional()` in update schema
- [ ] Types inferred with `z.infer<typeof schema>` and exported
- [ ] Controller uses `@Body(new ZodValidationPipe(schema)) body: Type`
- [ ] Custom error messages on required `.min(1, 'message')` validators
- [ ] Max lengths set on all string fields
