# Claude Context

This project is a **Kubernetes ESG Dashboard** - a Next.js application for managing Kubernetes namespaces with ESG governance annotations and OIDC authentication.

## Project Overview

**Purpose**: Provide a web interface to view and manage Kubernetes namespaces with focus on ESG (Environmental, Social, Governance) annotations and compliance tracking.

**Key Components**:
- Next.js 15 frontend with TypeScript and Tailwind CSS
- Kubernetes API integration for namespace management
- OIDC authentication via Dex identity provider
- Docker containerization with docker-compose orchestration

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Browser   │────│   Next.js App    │────│  Kubernetes API │
│                 │    │  (Port 3000)     │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                       ┌──────────────────┐
                       │   Dex OIDC       │
                       │  (Port 5556)     │
                       └──────────────────┘
```

## Key Features Implemented

✅ **Backend API**: `/api/namespaces` endpoint using `@kubernetes/client-node`
✅ **Frontend Table**: Displays namespace name, annotation-a, annotation-b, and action buttons
✅ **OIDC Authentication**: NextAuth.js integration with Dex provider
✅ **Docker Support**: Multi-stage Dockerfile with production builds
✅ **Development Environment**: Hot reload and TypeScript support

## Environment Setup

**Docker Compose Services**:
- `app`: Next.js application (port 3000)
- `oidc-server`: Dex identity provider (port 5556)

**Authentication Flow**:
1. User visits localhost:3000
2. Redirected to login page if not authenticated
3. OIDC login via Dex at 7f000001.nip.io:5556
4. Successful auth returns to dashboard

**Test Credentials**:
- Email: `user01@example.localhost`
- Password: `password`

## Development Commands

```bash
# Start containers
docker compose up

# Rebuild after code changes
docker compose build

# Development mode (local)
npm run dev

# Build production
npm run build
```

## Key Files

- `src/app/api/namespaces/route.ts`: Kubernetes API integration
- `src/app/api/auth/[...nextauth]/route.ts`: OIDC authentication
- `src/components/NamespaceTable.tsx`: Main data table component
- `docker-compose.yaml`: Service orchestration
- `Dockerfile`: Container build configuration

## Current State

The application is **fully functional** with:
- Working OIDC authentication
- Kubernetes namespace listing API
- Responsive web interface
- Docker containerization

**Known Issues**:
- Kubernetes API requires cluster access (HTTP/TLS configuration needed)
- Action buttons are placeholder (Edit/Delete not implemented)

## Next Steps

Potential enhancements:
- Implement namespace editing capabilities
- Add ESG compliance scoring
- Enhance error handling and logging
- Add tests and monitoring
- Implement RBAC for different user roles