# LedgerX Frontend

Next.js application with TypeScript, Tailwind CSS, and React Query.

## Features

- **Next.js App Router** - Modern React framework
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS with neutral theme
- **React Query** - Server state management
- **Authentication** - Protected routes and auth context
- **API Service Layer** - Clean separation of API calls
- **Reusable Components** - UI component library

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file:
```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Protected dashboard pages
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/           # Reusable React components
│   ├── layout/          # Layout components
│   └── ui/              # UI components
├── lib/                  # Library code
│   └── auth/            # Authentication utilities
├── services/             # API service layer
│   └── api/              # API clients
└── types/                # TypeScript types
```

## Architecture

### Authentication
- Client-side auth context with React Context
- Server-side session checking
- Protected route wrapper component
- Automatic token refresh

### API Layer
- Centralized API client with axios
- Request/response interceptors
- Automatic token injection
- Error handling and token refresh

### State Management
- React Query for server state
- Context API for authentication
- No global state management needed

### Styling
- Tailwind CSS with neutral color palette
- Reusable component classes
- Responsive design utilities
