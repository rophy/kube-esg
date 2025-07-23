# Namespace Shutdown Job

A Kubernetes job that manages namespace lifecycles based on ESG annotations.

## Functionality

1. **Iterates through all namespaces** (excluding system namespaces)
2. **Sets default shutdown dates**: If `kube-esg/shutdown-at` annotation is missing, sets it to NOW+7 days
3. **Simulates shutdowns**: For namespaces with past shutdown dates:
   - Sets `kube-esg/shutdown-done` annotation with current timestamp
   - Removes `kube-esg/shutdown-at` annotation
   - Removes `kube-esg/shutdown-by` annotation

## Building

```bash
docker build -t shutdown-job:latest shutdown-job/
```

## Environment Variables

- `SERVICE_ACCOUNT_NAME`: Name of the service account (default: "shutdown-job")

## Annotations Managed

- **`kube-esg/shutdown-at`**: Target shutdown date (YYYY-MM-DD)
- **`kube-esg/shutdown-by`**: Who/what set the shutdown date
- **`kube-esg/shutdown-done`**: Timestamp when shutdown was completed

## Skipped Namespaces

The job skips system namespaces that match:
- `kube-*` (kube-system, kube-public, etc.)
- `default`
- `kube-esg`

## Usage

### As Kubernetes Job

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: shutdown-job
spec:
  template:
    spec:
      serviceAccountName: shutdown-job
      containers:
      - name: shutdown
        image: shutdown-job:latest
        env:
        - name: SERVICE_ACCOUNT_NAME
          value: "shutdown-job"
      restartPolicy: Never
```

### As CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: shutdown-cronjob
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: shutdown-job
          containers:
          - name: shutdown
            image: shutdown-job:latest
          restartPolicy: Never
```

## Required RBAC

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: shutdown-job
rules:
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["get", "list", "patch"]
```