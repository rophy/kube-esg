#!/bin/sh

set -e

# Configuration
SERVICE_ACCOUNT_NAME=${SERVICE_ACCOUNT_NAME:-"shutdown-job"}
NOW=$(date -u +%Y-%m-%d)
NOW_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Calculate 7 days from now - use epoch seconds for compatibility
NOW_EPOCH=$(date +%s)
FUTURE_EPOCH=$((NOW_EPOCH + 604800))  # 7 days = 604800 seconds
FUTURE_DATE=$(date -u -d "@$FUTURE_EPOCH" +%Y-%m-%d 2>/dev/null || {
    # Fallback for BusyBox: use TZ trick
    TZ=UTC-0 date -d "@$FUTURE_EPOCH" +%Y-%m-%d 2>/dev/null || {
        # Final fallback: approximate calculation
        echo "$(date -u +%Y-%m-%d)" | awk -F- '{
            day = $3 + 7;
            month = $2;
            year = $1;
            if (day > 28) { day = day - 28; month = month + 1; }
            if (month > 12) { month = 1; year = year + 1; }
            printf "%04d-%02d-%02d\n", year, month, day;
        }'
    }
})

echo "Starting namespace shutdown job at $NOW_TIMESTAMP"
echo "Service account: $SERVICE_ACCOUNT_NAME"

# Function to check if date is earlier than now
# Convert dates to epoch for reliable comparison
is_date_past() {
    local target_date="$1"
    # Convert target date to epoch (handles YYYY-MM-DD format)
    local target_epoch=$(date -d "$target_date" +%s 2>/dev/null || echo "0")
    local now_epoch=$(date -d "$NOW" +%s 2>/dev/null || echo "999999999")
    
    if [ "$target_epoch" -lt "$now_epoch" ]; then
        return 0  # true (date is in the past)
    else
        return 1  # false (date is today or future)
    fi
}

# Get all namespaces
namespaces=$(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}')

for namespace in $namespaces; do
    echo "Processing namespace: $namespace"
    
    # Skip system namespaces
    if echo "$namespace" | grep -E "^(kube-|default$|kube-esg$)"; then
        echo "  Skipping system namespace: $namespace"
        continue
    fi
    
    # Get current annotations
    shutdown_at=$(kubectl get namespace "$namespace" -o jsonpath='{.metadata.annotations.kube-esg/shutdown-at}' 2>/dev/null || echo "")
    shutdown_by=$(kubectl get namespace "$namespace" -o jsonpath='{.metadata.annotations.kube-esg/shutdown-by}' 2>/dev/null || echo "")
    
    # If shutdown-at annotation doesn't exist, set it to NOW+7d
    if [ -z "$shutdown_at" ]; then
        echo "  Setting shutdown-at annotation to: $FUTURE_DATE"
        kubectl annotate namespace "$namespace" "kube-esg/shutdown-at=$FUTURE_DATE" --overwrite
        kubectl annotate namespace "$namespace" "kube-esg/shutdown-by=serviceaccount/$SERVICE_ACCOUNT_NAME" --overwrite
        echo "  Annotations set for namespace: $namespace"
        continue
    fi
    
    echo "  Current shutdown-at: $shutdown_at"
    
    # Check if shutdown date has passed
    if is_date_past "$shutdown_at"; then
        echo "  Shutdown date has passed. Initiating shutdown for: $namespace"
        
        # Set shutdown-done annotation
        kubectl annotate namespace "$namespace" "kube-esg/shutdown-done=$NOW_TIMESTAMP" --overwrite
        echo "  Set shutdown-done annotation"
        
        # Clear shutdown-at annotation
        kubectl annotate namespace "$namespace" "kube-esg/shutdown-at-" --ignore-not-found
        echo "  Cleared shutdown-at annotation"
        
        # Clear shutdown-by annotation
        kubectl annotate namespace "$namespace" "kube-esg/shutdown-by-" --ignore-not-found
        echo "  Cleared shutdown-by annotation"
        
        echo "  Shutdown simulation completed for: $namespace"
    else
        echo "  Shutdown date not reached yet for: $namespace"
    fi
done

echo "Namespace shutdown job completed at $(date -u +%Y-%m-%dT%H:%M:%SZ)"

