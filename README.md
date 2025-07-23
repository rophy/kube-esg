# Kubernetes ESG Dashboard

A Next.js application for managing Kubernetes namespaces with ESG (Environmental, Social, Governance) annotations and OIDC authentication.

## Features

- **Kubernetes Integration**: Lists and displays Kubernetes namespaces with custom annotations
- **OIDC Authentication**: Secure login using Dex OIDC provider
- **Tabular Interface**: Clean, responsive table showing namespace data
- **Docker Support**: Containerized deployment with docker-compose

## Architecture

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Backend API**: Next.js API routes with Kubernetes client
- **Authentication**: NextAuth.js with OIDC provider (Dex)
- **Containerization**: Docker with multi-stage builds

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Kubernetes cluster access (for namespace listing)

### Quick Start

1. **Start the application**:
   ```bash
   docker compose up
   ```

2. **Access the application**:
   - Open [http://localhost:3000](http://localhost:3000)
   - Login with test credentials:
     - Email: `user01@example.localhost`
     - Password: `password`

### Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

## Configuration

### Environment Variables

The application uses these environment variables (configured in docker-compose.yaml):

- `OIDC_ISSUER`: OIDC provider URL
- `OIDC_CLIENT_ID`: OIDC client identifier
- `OIDC_CLIENT_SECRET`: OIDC client secret
- `NEXTAUTH_URL`: Application URL for NextAuth
- `NEXTAUTH_SECRET`: NextAuth session secret

### Kubernetes Access

The application requires access to a Kubernetes cluster. Configure your kubeconfig or service account as needed.

## API Endpoints

- `GET /api/namespaces`: Lists Kubernetes namespaces with annotations
- `POST/GET /api/auth/[...nextauth]`: NextAuth.js authentication endpoints

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── login/         # Login page
│   │   └── page.tsx       # Main dashboard
│   └── components/        # React components
├── docker-compose.yaml    # Docker services
├── Dockerfile            # Container build
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
