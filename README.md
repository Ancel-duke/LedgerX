# LedgerX

A modern, full-stack finance management application for managing invoices, payments, clients, and organizations with real-time analytics and activity tracking.

## 🚀 Features

### Core Functionality
- **Invoice Management**: Create, view, update, and track invoices with multiple line items
- **Payment Processing**: Record and track payments linked to invoices or standalone
- **Client Management**: Manage client information and relationships
- **Organization Support**: Multi-tenant architecture supporting multiple organizations
- **Real-time Analytics**: Dashboard with revenue trends, invoice status, and payment completion rates
- **Activity Logging**: Comprehensive audit trail of all system actions
- **User Authentication**: Secure JWT-based authentication with role-based access control

### Key Highlights
- ✅ Real-time data updates (15-30 second refresh intervals)
- ✅ Automatic invoice status updates based on payments
- ✅ Balance tracking for partial payments
- ✅ Responsive design for desktop and mobile
- ✅ Multi-database architecture (PostgreSQL for transactional data, MongoDB for logs)

## 🛠️ Tech Stack

### Backend
- **Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **Database**: 
  - PostgreSQL (via Prisma ORM) - for invoices, payments, clients, organizations
  - MongoDB (via Mongoose) - for activity logs
- **Authentication**: JWT (JSON Web Tokens) with Passport.js
- **Validation**: class-validator, class-transformer
- **API**: RESTful API with Express

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI Library**: React 18
- **State Management**: TanStack Query (React Query) for server state
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **HTTP Client**: Axios

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **PostgreSQL** (v12 or higher)
- **MongoDB** (v5 or higher) or MongoDB Atlas account
- **Git**

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd LedgerX
```

### 2. Backend Setup

```bash
cd backend
npm install
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

## ⚙️ Configuration

### Backend Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ledgerx?schema=public"
MONGODB_URI="mongodb://localhost:27017/ledgerx"
# Or for MongoDB Atlas:
# MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/ledgerx"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRATION="1d"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-this-in-production"
JWT_REFRESH_EXPIRATION="7d"

# Application
PORT=3000
NODE_ENV=development
```

### Frontend Environment Variables

Create a `.env.local` file in the `frontend` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## 🗄️ Database Setup

### PostgreSQL Setup

1. Create a PostgreSQL database:

```sql
CREATE DATABASE ledgerx;
```

2. Run Prisma migrations:

```bash
cd backend
npx prisma migrate dev
```

3. Generate Prisma Client:

```bash
npx prisma generate
```

### MongoDB Setup

1. **Local MongoDB**: Ensure MongoDB is running on your machine
2. **MongoDB Atlas**: Update `MONGODB_URI` in `.env` with your Atlas connection string

### Seed Data (Optional)

Seed mock clients for testing:

```bash
cd backend
npm run seed:clients
```

## 🚀 Running the Application

### Development Mode

#### Start Backend

```bash
cd backend
npm run start:dev
```

The backend API will be available at `http://localhost:3000/api`

#### Start Frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:3001` (or next available port)

### Production Mode

#### Build Backend

```bash
cd backend
npm run build
npm run start:prod
```

#### Build Frontend

```bash
cd frontend
npm run build
npm start
```

## 📁 Project Structure

```
LedgerX/
├── backend/                 # NestJS backend application
│   ├── prisma/              # Prisma schema and migrations
│   │   └── schema.prisma    # Database schema definition
│   ├── src/
│   │   ├── activity-log/   # Activity logging module (MongoDB)
│   │   ├── analytics/       # Analytics and reporting
│   │   ├── auth/           # Authentication & authorization
│   │   ├── clients/        # Client management
│   │   ├── invoices/       # Invoice management
│   │   ├── payments/       # Payment processing
│   │   ├── organizations/  # Organization/tenant management
│   │   ├── users/          # User management
│   │   ├── common/         # Shared utilities, guards, decorators
│   │   ├── config/         # Configuration modules
│   │   ├── database/       # Database connections (PostgreSQL & MongoDB)
│   │   └── scripts/        # Utility scripts (seeders, etc.)
│   └── package.json
│
├── frontend/                # Next.js frontend application
│   ├── app/                # Next.js App Router pages
│   │   ├── auth/          # Authentication pages
│   │   ├── dashboard/     # Dashboard and main app pages
│   │   └── layout.tsx     # Root layout
│   ├── components/         # React components
│   │   ├── charts/        # Chart components
│   │   ├── dashboard/     # Dashboard-specific components
│   │   └── ui/            # Reusable UI components
│   ├── services/          # API service layer
│   │   └── api/          # API client services
│   └── package.json
│
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token

### Organizations
- `GET /api/organizations` - List organizations
- `POST /api/organizations` - Create organization
- `GET /api/organizations/:id` - Get organization details
- `PATCH /api/organizations/:id` - Update organization
- `DELETE /api/organizations/:id` - Delete organization

### Clients
- `GET /api/clients` - List clients
- `POST /api/clients` - Create client
- `GET /api/clients/:id` - Get client details
- `PATCH /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

### Invoices
- `GET /api/invoices` - List invoices (with pagination)
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/:id` - Get invoice details
- `PATCH /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice

### Payments
- `GET /api/payments` - List payments (with pagination)
- `POST /api/payments` - Create payment
- `GET /api/payments/:id` - Get payment details
- `PATCH /api/payments/:id` - Update payment
- `DELETE /api/payments/:id` - Delete payment

### Analytics
- `GET /api/analytics/dashboard` - Get dashboard statistics
- `GET /api/analytics/revenue` - Get revenue trends
- `GET /api/analytics/invoice-status` - Get invoice status distribution
- `GET /api/analytics/payment-methods` - Get payment method distribution

### Activity Log
- `GET /api/activity-log` - Get activity logs
- `POST /api/activity-log` - Create activity log entry
- `GET /api/activity-log/entity/:entityType/:entityId` - Get activities for specific entity

**Note**: Most endpoints require JWT authentication. Include the token in the `Authorization` header:
```
Authorization: Bearer <your-jwt-token>
```

## 🔐 Authentication Flow

1. User registers or logs in via `/api/auth/register` or `/api/auth/login`
2. Backend returns access token and refresh token
3. Frontend stores tokens and includes access token in API requests
4. When access token expires, frontend uses refresh token to get a new access token
5. All protected routes require valid JWT token

## 🗃️ Database Architecture

### PostgreSQL (Primary Database)
Stores all transactional and relational data:
- **Organizations**: Multi-tenant organization data
- **Users**: User accounts and authentication
- **Clients**: Customer/client information
- **Invoices**: Invoice records with line items
- **Payments**: Payment transactions
- **UserOrganizations**: Many-to-many relationship between users and organizations
- **Roles**: Organization-specific roles and permissions

### MongoDB (Activity Logs)
Stores activity/audit logs:
- **ActivityLog**: System activity and audit trail entries

## 🧪 Development

### Running Tests

```bash
# Backend tests
cd backend
npm run test
npm run test:watch
npm run test:cov

# Frontend linting
cd frontend
npm run lint
```

### E2E Tests (Backend)

E2E tests use a **test database**. Point `DATABASE_URL` to a dedicated test DB (do not use production).

**Required E2E environment variables:**

- **`DATABASE_URL`** – PostgreSQL connection string for the **test** database (e.g. `postgresql://user:pass@localhost:5432/ledgerx_test`).
- **`STRIPE_WEBHOOK_SECRET`** – (optional) Used by webhook idempotency E2E; use a test value (e.g. `whsec_test_e2e`) if you run those tests.

**How to run E2E locally:**

1. Create a test database and set `DATABASE_URL` in `backend/.env` (or `backend/.env.test`) to that database.
2. From the `backend` directory:
   - **Full run (reset DB then E2E):**  
     `npm run test:e2e`  
     This runs `npm run test:reset-db` (drops schema, reapplies migrations) then runs all E2E tests.
   - **Reset DB only:**  
     `npm run test:reset-db`  
     Drops the test DB schema and runs Prisma migrations.
   - **E2E only (no reset):**  
     `npm run test:e2e:only`  
     Runs E2E tests without resetting the DB (useful after a manual reset or for debugging).

**Smoke E2E coverage:**

- Health endpoint (`GET /health`)
- Auth: register and login
- Create client, invoice, and payment via API (internal; no Stripe SDK dependency)
- Optional: webhook idempotency (uses Stripe test header when `STRIPE_WEBHOOK_SECRET` is set)

### Database Management

```bash
# Open Prisma Studio (database GUI)
cd backend
npm run prisma:studio

# Create new migration
npm run prisma:migrate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Code Formatting

```bash
# Backend
cd backend
npm run format

# Frontend
cd frontend
npm run lint -- --fix
```

## 📊 Key Features Explained

### Real-time Updates
- Dashboard refreshes every 15 seconds
- Activity log refreshes every 10 seconds
- Analytics page refreshes every 30 seconds
- All data automatically syncs when changes occur

### Invoice Status Management
- Automatically updates invoice status based on payments
- Tracks partial payments and remaining balances
- Updates status to "PAID" when fully paid
- Maintains payment history per invoice

### Multi-tenant Architecture
- Each organization has isolated data
- Users can belong to multiple organizations
- Organization-scoped queries ensure data isolation
- Role-based access control per organization

## 🐛 Troubleshooting

### Common Issues

**Port already in use (EADDRINUSE)**
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (Windows)
taskkill /F /PID <process-id>
```

**Database connection errors**
- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Ensure database exists: `CREATE DATABASE ledgerx;`

**MongoDB connection errors**
- Verify MongoDB is running (if local)
- Check `MONGODB_URI` in `.env`
- For Atlas, verify network access and credentials

**Prisma client errors**
```bash
cd backend
npx prisma generate
```

**401 Unauthorized errors**
- Check if JWT token is expired
- Verify token is included in request headers
- Try logging out and logging back in

## 📝 License

This project is private and proprietary.

## 👥 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📞 Support

For issues or questions, please contact the development team.

---

**Built with NestJS, Next.js, PostgreSQL, and MongoDB**
