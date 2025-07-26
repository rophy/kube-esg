#!/bin/bash

set -e

echo "=== Testing shutdown-job logic ==="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Reset test namespaces and resources${NC}"
kubectl apply -f deploy/test-namespaces.yaml

echo -e "${YELLOW}Step 2: Set shutdown-at of test-app-alpha to previous date${NC}"
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)
kubectl annotate namespace test-app-alpha kube-esg/next-shutdown-at=$YESTERDAY --overwrite

echo -e "${YELLOW}Step 3: Set shutdown-at of test-app-beta to future date${NC}"
FUTURE_DATE=$(date -d "+10 days" +%Y-%m-%d)
kubectl annotate namespace test-app-beta kube-esg/next-shutdown-at=$FUTURE_DATE --overwrite

echo -e "${YELLOW}Step 4: Leave test-app-gamma with no shutdown-at annotation${NC}"
kubectl annotate namespace test-app-gamma kube-esg/next-shutdown-at- || true

echo -e "${YELLOW}Step 5: Show initial state${NC}"
echo "Namespace annotations:"
kubectl get namespaces test-app-alpha test-app-beta test-app-gamma -o jsonpath='{range .items[*]}{.metadata.name}{": "}{.metadata.annotations.kube-esg/next-shutdown-at}{"\n"}{end}'

echo "Deployment replicas before shutdown:"
kubectl get deployments -n test-app-alpha -o jsonpath='{range .items[*]}{.metadata.name}{": "}{.spec.replicas}{"\n"}{end}' | sed 's/^/  test-app-alpha: /'
kubectl get deployments -n test-app-beta -o jsonpath='{range .items[*]}{.metadata.name}{": "}{.spec.replicas}{"\n"}{end}' | sed 's/^/  test-app-beta: /'
kubectl get deployments -n test-app-gamma -o jsonpath='{range .items[*]}{.metadata.name}{": "}{.spec.replicas}{"\n"}{end}' | sed 's/^/  test-app-gamma: /'

echo -e "${YELLOW}Step 6: Run shutdown-job${NC}"
kubectl delete job test-shutdown-job -n kube-esg --ignore-not-found
kubectl create job --from=cronjob/shutdown-job test-shutdown-job -n kube-esg

echo "Waiting for job to complete..."
kubectl wait --for=condition=complete job/test-shutdown-job -n kube-esg --timeout=120s

echo -e "${YELLOW}Step 7: Show job logs${NC}"
kubectl logs job/test-shutdown-job -n kube-esg

echo -e "${YELLOW}Step 8: Verify results${NC}"

echo "Namespace annotations after shutdown:"
kubectl get namespaces test-app-alpha test-app-beta test-app-gamma -o jsonpath='{range .items[*]}{.metadata.name}{": shutdown-at="}{.metadata.annotations.kube-esg/next-shutdown-at}{", prev-shutdown-at="}{.metadata.annotations.kube-esg/prev-shutdown-at}{"\n"}{end}'

echo "Deployment replicas after shutdown:"
kubectl get deployments -n test-app-alpha -o jsonpath='{range .items[*]}{.metadata.name}{": "}{.spec.replicas}{"\n"}{end}' | sed 's/^/  test-app-alpha: /'
kubectl get deployments -n test-app-beta -o jsonpath='{range .items[*]}{.metadata.name}{": "}{.spec.replicas}{"\n"}{end}' | sed 's/^/  test-app-beta: /'
kubectl get deployments -n test-app-gamma -o jsonpath='{range .items[*]}{.metadata.name}{": "}{.spec.replicas}{"\n"}{end}' | sed 's/^/  test-app-gamma: /'

echo -e "${YELLOW}Step 9: Validation${NC}"

# Check test-app-alpha (should be shutdown)
ALPHA_REPLICAS=$(kubectl get deployment nginx -n test-app-alpha -o jsonpath='{.spec.replicas}')
if [ "$ALPHA_REPLICAS" = "0" ]; then
    echo -e "${GREEN}✓ test-app-alpha correctly shutdown (replicas: 0)${NC}"
else
    echo -e "${RED}✗ test-app-alpha NOT shutdown (replicas: $ALPHA_REPLICAS)${NC}"
fi

# Check test-app-beta (should NOT be shutdown)
BETA_REPLICAS=$(kubectl get deployment nginx -n test-app-beta -o jsonpath='{.spec.replicas}')
if [ "$BETA_REPLICAS" != "0" ]; then
    echo -e "${GREEN}✓ test-app-beta correctly preserved (replicas: $BETA_REPLICAS)${NC}"
else
    echo -e "${RED}✗ test-app-beta incorrectly shutdown (replicas: $BETA_REPLICAS)${NC}"
fi

# Check test-app-gamma (should get shutdown-at annotation)
GAMMA_SHUTDOWN_AT=$(kubectl get namespace test-app-gamma -o jsonpath='{.metadata.annotations.kube-esg/next-shutdown-at}')
if [ -n "$GAMMA_SHUTDOWN_AT" ]; then
    echo -e "${GREEN}✓ test-app-gamma got shutdown-at annotation: $GAMMA_SHUTDOWN_AT${NC}"
else
    echo -e "${RED}✗ test-app-gamma missing shutdown-at annotation${NC}"
fi

echo -e "${YELLOW}Test completed!${NC}"