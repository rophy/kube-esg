# Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the Kubernetes ESG Dashboard to a Kubernetes cluster.

## Files

### Core Application
- `namespace.yaml` - Creates the kube-esg namespace
- `rbac.yaml` - Service accounts and RBAC permissions for UI and shutdown automation
- `dex-config.yaml` - ConfigMap with Dex OIDC server configuration
- `dex.yaml` - Dex OIDC server deployment and service
- `app.yaml` - Main application deployment, service, and configuration
- `shutdown-cronjob.yaml` - Automated shutdown job (runs daily at 19:23 UTC)

### Test Resources
- `test-namespaces.yaml` - Test namespaces with sample workloads for development/testing

## Deployment

### Option 1: Using Skaffold (Recommended for Development)
```bash
# Deploy core application (single namespace)
skaffold dev

# Deploy test resources separately (multi-namespace)
kubectl apply -f deploy/test-namespaces.yaml
```

### Option 2: Manual Deployment
1. **Build and load the Docker image** (for kind cluster):
   ```bash
   docker build -t kube-esg-app:latest .
   kind load docker-image kube-esg-app:latest
   ```

2. **Apply core manifests**:
   ```bash
   kubectl apply -f deploy/namespace.yaml
   kubectl apply -f deploy/rbac.yaml
   kubectl apply -f deploy/dex-config.yaml
   kubectl apply -f deploy/dex.yaml
   kubectl apply -f deploy/app.yaml
   kubectl apply -f deploy/shutdown-cronjob.yaml
   ```

3. **Deploy test resources** (optional):
   ```bash
   kubectl apply -f deploy/test-namespaces.yaml
   ```

## Access

- **Application**: `http://localhost:30000`
- **OIDC Login**: `http://7f000001.nip.io:5556/dex`
- **Test Credentials**:
  - Email: `user01@example.localhost`
  - Password: `password`

## Services

- **kube-esg-app**: Main web application (NodePort 30000)
- **dex**: OIDC identity provider (ClusterIP 5556)

## Service Accounts & RBAC

### `kube-esg-app` (UI Service Account)
- **Permissions**: Namespace read/patch for annotation management
- **Usage**: Web interface, extend functionality
- **ClusterRole**: `kube-esg-app`

### `shutdown-job` (Automation Service Account)  
- **Permissions**: Full workload shutdown/restore capabilities
- **Usage**: Automated shutdown cronjob
- **ClusterRole**: `shutdown-job`
- **Resources**: deployments, statefulsets, daemonsets, cronjobs

## Configuration

### Environment Variables (Both app.yaml and shutdown-cronjob.yaml)
- `TARGET_LABEL_NAME="team"` - Filter namespaces by team label
- `SHUTDOWN_DAYS="30"` - Shutdown grace period (30 days)
- `NODE_ENV="production"` - Application environment
- OIDC configuration for Dex integration

### Shutdown Automation
- **Schedule**: Daily at 19:23 UTC (03:23 GMT+8)
- **Behavior**: 
  - Sets `next-shutdown-at` annotation for new namespaces (NOW + 30 days)
  - Shuts down workloads when shutdown date passes
  - Records shutdown timestamp in `prev-shutdown-at` annotation

## Test Environment

The `test-namespaces.yaml` creates three test namespaces with various workloads:

### Test Namespaces
- **test-app-alpha**: Scheduled for shutdown, mixed workloads
- **test-app-beta**: Previously shutdown, different replica counts  
- **test-app-gamma**: Both scheduled and previously shutdown

### Test Workloads (per namespace)
- **Deployment**: Using `hashicorp/http-echo` with team-specific messages
- **StatefulSet**: Database/storage services
- **DaemonSet**: Node agents/monitoring
- **CronJob**: Maintenance scripts using `busybox`

### Test Resource Management
```bash
# Deploy test resources
kubectl apply -f deploy/test-namespaces.yaml

# Remove test resources
kubectl delete -f deploy/test-namespaces.yaml

# View test namespaces (with team labels)
kubectl get namespaces -l team --show-labels
```

## Troubleshooting

### Check Application Status
```bash
kubectl get pods -n kube-esg
kubectl logs -n kube-esg deployment/kube-esg-app
kubectl logs -n kube-esg deployment/dex
```

### Check Shutdown Job
```bash
kubectl get cronjobs -n kube-esg
kubectl get jobs -n kube-esg
kubectl logs -n kube-esg job/shutdown-job-<timestamp>
```

### Manual Shutdown Job Execution
```bash
kubectl create job --from=cronjob/shutdown-job manual-shutdown -n kube-esg
```