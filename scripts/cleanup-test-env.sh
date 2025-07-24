#!/bin/bash

set -e

echo "Cleaning up kube-esg test environment..."

echo ""
echo "1. Removing test namespaces..."

# List of test namespaces to remove
test_namespaces="test-app-dev test-app-prod test-service test-unmanaged-1 test-unmanaged-2"

for namespace in $test_namespaces; do
    if kubectl get namespace "$namespace" >/dev/null 2>&1; then
        echo "  Deleting namespace: $namespace"
        kubectl delete namespace "$namespace"
    else
        echo "  Namespace $namespace does not exist (already cleaned up)"
    fi
done

echo ""
echo "2. Disabling TARGET_LABEL_NAME in configuration..."

# Disable TARGET_LABEL_NAME in app-config.yaml
if grep -q "^  TARGET_LABEL_NAME:" deploy/app-config.yaml; then
    sed -i 's/^  TARGET_LABEL_NAME:/  # TARGET_LABEL_NAME:/' deploy/app-config.yaml
    sed -i 's/^  \([[:space:]]*\)"managed-by"/  # \1"managed-by"/' deploy/app-config.yaml
    echo "  Disabled TARGET_LABEL_NAME in deploy/app-config.yaml"
fi

# Disable TARGET_LABEL_NAME in shutdown-cronjob.yaml
if grep -q "^            - name: TARGET_LABEL_NAME" deploy/shutdown-cronjob.yaml; then
    sed -i 's/^            - name: TARGET_LABEL_NAME/            # - name: TARGET_LABEL_NAME/' deploy/shutdown-cronjob.yaml
    sed -i 's/^              value: "managed-by"/            #   value: "managed-by"/' deploy/shutdown-cronjob.yaml
    echo "  Disabled TARGET_LABEL_NAME in deploy/shutdown-cronjob.yaml"
fi

echo ""
echo "✅ Test environment cleanup complete!"
echo ""
echo "Configuration has been reset to default (no label filtering)."
echo "Deploy the updated configuration with: kubectl apply -f deploy/"