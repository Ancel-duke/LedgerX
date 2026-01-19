# Multi-Tenant Finance System - Prisma Schema Design

## Overview

This schema implements a production-ready multi-tenant finance system with proper data isolation, soft deletes, and transaction support.

## Key Features

### 1. Multi-Tenant Architecture

- **Organization** is the tenant boundary
- All data is scoped by `organizationId`
- Foreign keys enforce referential integrity
- Indexes optimize multi-tenant queries

### 2. Many-to-Many User-Organization Relationship

- **UserOrganization** junction table enables users to belong to multiple organizations
- Each user-organization relationship has a **Role** (organization-specific)
- Supports different permissions per organization

### 3. Role-Based Access Control

- **Role** model stores organization-specific roles
- Permissions stored as JSON for flexibility
- Roles are scoped to organizations

### 4. Client Management

- **Client** model replaces inline client fields in invoices
- Clients are organization-scoped
- Supports soft deletes when invoices exist

### 5. Soft Deletes

All models support soft deletes via `deletedAt`:
- **Organization**: `deletedAt`
- **User**: `deletedAt`
- **UserOrganization**: `deletedAt`
- **Role**: `deletedAt`
- **Client**: `deletedAt`
- **Invoice**: `deletedAt`
- **InvoiceItem**: `deletedAt`
- **Payment**: `deletedAt`

### 6. Data Integrity

- Foreign keys with appropriate `onDelete` actions:
  - `Cascade`: Delete related records
  - `Restrict`: Prevent deletion if referenced
  - `SetNull`: Set foreign key to null
- Unique constraints prevent duplicates
- Composite indexes for efficient queries

## Schema Relationships

```
Organization
  ├── UserOrganization (many-to-many with User)
  ├── Role (one-to-many)
  ├── Client (one-to-many)
  ├── Invoice (one-to-many)
  └── Payment (one-to-many)

User
  └── UserOrganization (many-to-many with Organization)

Client
  └── Invoice (one-to-many)

Invoice
  ├── InvoiceItem (one-to-many)
  └── Payment (one-to-many)
```

## Indexes

### Performance Indexes
- `organizationId` on all tenant-scoped models
- `deletedAt` for soft delete filtering
- Composite indexes: `[isActive, deletedAt]` for active record queries
- `status` indexes on Invoice and Payment
- `email` indexes for user lookup
- `transactionId` unique index on Payment

### Unique Constraints
- `[organizationId, invoiceNumber]` on Invoice
- `[userId, organizationId]` on UserOrganization
- `[organizationId, name]` on Role
- `transactionId` on Payment

## Transaction Examples

See `src/invoices/invoices-transaction.service.ts` for examples:

1. **createInvoiceWithItems**: Atomic invoice + items creation
2. **processPayment**: Payment processing with invoice status update
3. **refundPayment**: Refund handling with status updates
4. **softDeleteInvoice**: Safe deletion preserving data
5. **markOverdueInvoices**: Batch status updates

## Migration Strategy

1. Generate migration:
   ```bash
   npx prisma migrate dev --name multi_tenant_finance_system
   ```

2. Review migration file in `prisma/migrations/`

3. Apply migration:
   ```bash
   npx prisma migrate deploy
   ```

## Data Isolation

All queries must include:
- `organizationId` filter
- `deletedAt: null` filter (unless explicitly including deleted records)

Example:
```typescript
const invoices = await prisma.invoice.findMany({
  where: {
    organizationId,
    deletedAt: null,
    status: 'SENT',
  },
});
```

## Best Practices

1. **Always use transactions** for multi-step operations
2. **Filter by organizationId** in every query
3. **Use soft deletes** for audit trails
4. **Validate foreign keys** before operations
5. **Index frequently queried fields**
6. **Use composite indexes** for common query patterns
