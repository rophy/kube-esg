# Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the Kubernetes ESG Dashboard to a Kubernetes cluster.

## Files

- `namespace.yaml` - Creates the kube-esg namespace
- `rbac.yaml` - Service account and RBAC permissions for namespace access
- `dex-config.yaml` - ConfigMap with Dex OIDC server configuration
- `dex.yaml` - Dex OIDC server deployment and service
- `app-config.yaml` - Application configuration and secrets
- `app.yaml` - Main application deployment and service

## Deployment

1. **Build and load the Docker image** (for kind cluster):
   ```bash
   docker build -t kube-esg-app:latest .
   kind load docker-image kube-esg-app:latest
   ```

2. **Apply the manifests**:
   ```bash
   kubectl apply -f deploy/
   ```

3. **Access the application**:
   - The app will be available at `http://localhost:30000`
   - Login credentials:
     - Email: `user01@example.localhost`
     - Password: `password`

## Services

- **kube-esg-app**: Main application (NodePort 30000)
- **dex**: OIDC provider (ClusterIP 5556)

## RBAC

The application service account has ClusterRole permissions to:
- `get`, `list`, `watch` namespaces cluster-wide

## Configuration

Key configuration is stored in:
- ConfigMap `app-config`: Non-sensitive environment variables
- Secret `app-secrets`: OIDC client secret and NextAuth secret