# Kubernetes ESG Dashboard

A Next.js application for managing Kubernetes namespaces with ESG (Environmental, Social, Governance) annotations and OIDC authentication.

## Features

- **Namespace Lifecycle Management**: View and extend namespace shutdown dates
- **ESG Annotations**: Track `kube-esg/shutdown-at` and `kube-esg/shutdown-by` annotations
- **OIDC Authentication**: Secure login using Dex OIDC provider
- **Tabular Interface**: Clean, responsive table with conditional formatting
- **Kubernetes Deployment**: Production-ready with Skaffold workflow

## Architecture

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Backend API**: Next.js API routes with Kubernetes client
- **Authentication**: NextAuth.js with OIDC provider (Dex)
- **Deployment**: Kubernetes manifests with Skaffold orchestration

## Getting Started

### Prerequisites

- **Kubernetes cluster** (kind, minikube, or cloud cluster)
- **Skaffold** for deployment workflow
- **kubectl** configured for your cluster

### Quick Start with Skaffold

1. **Deploy the application**:
   ```bash
   skaffold run
   ```

2. **Access the application**:
   - Application will be available at `http://localhost:30000` (NodePort)
   - Login credentials:
     - Email: `user01@example.localhost`
     - Password: `password`

### Development Workflow

1. **Development mode with hot reload**:
   ```bash
   skaffold dev
   ```

2. **Clean up deployment**:
   ```bash
   skaffold delete
   ```

### Local Development

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

The application uses these environment variables (configured in `deploy/app-config.yaml`):

- `OIDC_ISSUER`: OIDC provider issuer URL
- `OIDC_AUTHORIZATION_ENDPOINT`: OAuth authorization endpoint
- `OIDC_TOKEN_ENDPOINT`: OAuth token endpoint
- `OIDC_JWKS_URI`: JWKS endpoint for token validation
- `OIDC_USERINFO_ENDPOINT`: User info endpoint
- `OIDC_CLIENT_ID`: OIDC client identifier
- `OIDC_CLIENT_SECRET`: OIDC client secret (stored in Secret)
- `NEXTAUTH_URL`: Application URL for NextAuth
- `NEXTAUTH_SECRET`: NextAuth session secret (stored in Secret)

### RBAC Permissions

The application requires these Kubernetes permissions:
- `get`, `list`: Read namespaces
- `patch`: Update namespace annotations

## API Endpoints

- `GET /api/namespaces`: Lists Kubernetes namespaces with ESG annotations
- `POST /api/namespaces/[name]/extend`: Extends namespace shutdown date by 7 days
- `POST/GET /api/auth/[...nextauth]`: NextAuth.js authentication endpoints

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/                    # API routes
│   │   │   ├── namespaces/         # Namespace management
│   │   │   └── auth/               # Authentication
│   │   ├── login/                  # Login page
│   │   └── page.tsx                # Main dashboard
│   └── components/                 # React components
├── deploy/                         # Kubernetes manifests
│   ├── namespace.yaml              # Namespace definition
│   ├── rbac.yaml                   # Service account & permissions
│   ├── dex-config.yaml             # Dex OIDC configuration
│   ├── dex.yaml                    # Dex deployment
│   ├── app-config.yaml             # App configuration & secrets
│   └── app.yaml                    # App deployment & service
├── skaffold.yaml                   # Skaffold configuration
├── Dockerfile                      # Container build
└── README.md
```

## ESG Annotations

The application manages these Kubernetes namespace annotations:

- **`kube-esg/shutdown-at`**: Target shutdown date (YYYY-MM-DD format)
- **`kube-esg/shutdown-by`**: User who last extended the namespace

### Annotation Behavior

- **Confirmed dates**: Displayed in dark text when annotation exists
- **Estimated dates**: Displayed in grey italic when annotation missing (shows +7 days from current date)
- **Extend functionality**: Updates both annotations when "Extend" button is clicked

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
