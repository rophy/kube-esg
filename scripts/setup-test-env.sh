#!/bin/bash

set -e

echo "Setting up test environment for kube-esg label filtering..."

# Function to create namespace with labels
create_test_namespace() {
    local name=$1
    local managed_by=$2
    local environment=$3
    
    echo "Creating namespace: $name"
    
    # Create the namespace
    kubectl create namespace "$name" --dry-run=client -o yaml | kubectl apply -f -
    
    # Add managed-by label
    if [ -n "$managed_by" ]; then
        kubectl label namespace "$name" managed-by="$managed_by" --overwrite
        echo "  Added label managed-by=$managed_by"
    fi
    
    # Add environment label
    if [ -n "$environment" ]; then
        kubectl label namespace "$name" environment="$environment" --overwrite
        echo "  Added label environment=$environment"
    fi
}

# Create test namespaces
echo ""
echo "1. Creating test namespaces..."

# Namespaces WITH managed-by label (should be shown when filtering)
create_test_namespace "test-app-dev" "kube-esg" "dev"
create_test_namespace "test-app-prod" "kube-esg" "prod"
create_test_namespace "test-service" "team-backend" "staging"

# Namespaces WITHOUT managed-by label (should be hidden when filtering)
create_test_namespace "test-unmanaged-1" "" "dev"
create_test_namespace "test-unmanaged-2" "" ""

echo ""
echo "2. Enabling TARGET_LABEL_NAME in app configuration..."

# Enable TARGET_LABEL_NAME in app.yaml
if grep -q "# - name: TARGET_LABEL_NAME" deploy/app.yaml; then
    # Uncomment the existing lines
    sed -i 's/^        # - name: TARGET_LABEL_NAME/        - name: TARGET_LABEL_NAME/' deploy/app.yaml
    sed -i 's/^        #   value: "managed-by"/          value: "managed-by"/' deploy/app.yaml
    echo "  Enabled TARGET_LABEL_NAME in deploy/app.yaml"
fi

# Enable TARGET_LABEL_NAME in shutdown-cronjob.yaml
if grep -q "# TARGET_LABEL_NAME:" deploy/shutdown-cronjob.yaml; then
    # Uncomment the existing lines
    sed -i 's/^            # - name: TARGET_LABEL_NAME/            - name: TARGET_LABEL_NAME/' deploy/shutdown-cronjob.yaml
    sed -i 's/^            #   value: "managed-by"/              value: "managed-by"/' deploy/shutdown-cronjob.yaml
    echo "  Enabled TARGET_LABEL_NAME in deploy/shutdown-cronjob.yaml"
fi

# Enable SHUTDOWN_DAYS in app.yaml (optional - defaults to 7)
if grep -q "# - name: SHUTDOWN_DAYS" deploy/app.yaml; then
    # Uncomment to set custom shutdown days
    sed -i 's/^        # - name: SHUTDOWN_DAYS/        - name: SHUTDOWN_DAYS/' deploy/app.yaml
    sed -i 's/^        #   value: "7"/          value: "7"/' deploy/app.yaml
    echo "  Enabled SHUTDOWN_DAYS in deploy/app.yaml (set to 7 days)"
fi

# Enable SHUTDOWN_DAYS in shutdown-cronjob.yaml (optional - defaults to 7)
if grep -q "# SHUTDOWN_DAYS:" deploy/shutdown-cronjob.yaml; then
    sed -i 's/^            # - name: SHUTDOWN_DAYS/            - name: SHUTDOWN_DAYS/' deploy/shutdown-cronjob.yaml
    sed -i 's/^            #   value: "7"/              value: "7"/' deploy/shutdown-cronjob.yaml
    echo "  Enabled SHUTDOWN_DAYS in deploy/shutdown-cronjob.yaml (set to 7 days)"
fi

echo ""
echo "3. Summary of created namespaces:"
echo ""
echo "Namespaces WITH managed-by label (should appear in UI when filtered):"
kubectl get namespaces -l managed-by --show-labels | grep -E "(NAME|test-)" || echo "  (none found)"

echo ""
echo "Namespaces WITHOUT managed-by label (should NOT appear in UI when filtered):"
kubectl get namespaces test-unmanaged-1 test-unmanaged-2 --show-labels 2>/dev/null | grep -E "(NAME|test-)" || echo "  (none found)"

echo ""
echo "4. Configuration changes:"
echo "  - deploy/app.yaml: TARGET_LABEL_NAME enabled"
echo "  - deploy/shutdown-cronjob.yaml: TARGET_LABEL_NAME enabled"
echo "  - SHUTDOWN_DAYS configuration available (defaults to 7 days)"

echo ""
echo "✅ Test environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy the updated configuration: kubectl apply -f deploy/"
echo "2. Restart the app: kubectl rollout restart deployment/kube-esg-app -n kube-esg"
echo "3. Test the UI - should only show namespaces with 'managed-by' label"
echo "4. Test shutdown job: make run-shutdown-job"
echo ""
echo "To clean up test namespaces later, run:"
echo "  kubectl delete namespace test-app-dev test-app-prod test-service test-unmanaged-1 test-unmanaged-2"