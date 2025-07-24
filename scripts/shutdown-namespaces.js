#!/usr/bin/env node

import * as k8s from '@kubernetes/client-node';

// Configuration
const serviceAccountName = process.env.SERVICE_ACCOUNT_NAME || 'shutdown-job';
const ownNamespace = process.env.POD_NAMESPACE || process.env.NAMESPACE || null;
const now = new Date();
const nowDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
const nowTimestamp = now.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ

// Calculate 7 days from now
const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
const futureDateString = futureDate.toISOString().split('T')[0];

console.log(`Starting namespace shutdown job at ${nowTimestamp}`);
console.log(`Service account: ${serviceAccountName}`);
if (ownNamespace) {
    console.log(`Own namespace: ${ownNamespace} (will be skipped)`);
}

// Initialize Kubernetes client
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

// Function to check if date is earlier than now
function isDatePast(targetDate) {
    const target = new Date(targetDate);
    const today = new Date(nowDate);
    return target < today;
}

// Function to get annotation value safely
function getAnnotation(annotations, key) {
    return annotations && annotations[key] ? annotations[key] : '';
}

async function processNamespaces() {
    // Get all namespaces
    const namespacesResponse = await k8sApi.listNamespace();
    const namespaces = namespacesResponse.items;

    for (const namespace of namespaces) {
        const namespaceName = namespace.metadata.name;
        console.log(`Processing namespace: ${namespaceName}`);

        // Skip system namespaces and our own namespace
        if (namespaceName.match(/^kube-/) || namespaceName === 'default' || namespaceName === ownNamespace) {
            console.log(`  Skipping system namespace: ${namespaceName}`);
            continue;
        }

        const annotations = namespace.metadata.annotations || {};
        const shutdownAt = getAnnotation(annotations, 'kube-esg/shutdown-at');
        const shutdownBy = getAnnotation(annotations, 'kube-esg/shutdown-by');

        // If shutdown-at annotation doesn't exist, set it to NOW+7d
        if (!shutdownAt) {
            console.log(`  Setting shutdown-at annotation to: ${futureDateString}`);
            
            const patch = [
                {
                    op: 'add',
                    path: '/metadata/annotations/kube-esg~1shutdown-at',
                    value: futureDateString
                },
                {
                    op: 'add',
                    path: '/metadata/annotations/kube-esg~1shutdown-by',
                    value: `serviceaccount/${serviceAccountName}`
                }
            ];

            // Handle case where annotations don't exist
            if (!namespace.metadata.annotations) {
                patch.unshift({
                    op: 'add',
                    path: '/metadata/annotations',
                    value: {}
                });
            }

            await k8sApi.patchNamespace({
                name: namespaceName,
                body: patch,
                pretty: undefined,
                dryRun: undefined,
                fieldManager: undefined,
                fieldValidation: undefined,
                force: undefined
            }, { headers: { 'Content-Type': 'application/json-patch+json' } });
            
            console.log(`  Annotations set for namespace: ${namespaceName}`);
            continue;
        }

        console.log(`  Current shutdown-at: ${shutdownAt}`);

        // Check if shutdown date has passed
        if (isDatePast(shutdownAt)) {
            console.log(`  Shutdown date has passed. Initiating shutdown for: ${namespaceName}`);

            const patch = [
                {
                    op: 'add',
                    path: '/metadata/annotations/kube-esg~1shutdown-done',
                    value: nowTimestamp
                }
            ];

            // Remove shutdown-at and shutdown-by annotations
            if (getAnnotation(annotations, 'kube-esg/shutdown-at')) {
                patch.push({
                    op: 'remove',
                    path: '/metadata/annotations/kube-esg~1shutdown-at'
                });
            }

            if (getAnnotation(annotations, 'kube-esg/shutdown-by')) {
                patch.push({
                    op: 'remove',
                    path: '/metadata/annotations/kube-esg~1shutdown-by'
                });
            }

            await k8sApi.patchNamespace({
                name: namespaceName,
                body: patch,
                pretty: undefined,
                dryRun: undefined,
                fieldManager: undefined,
                fieldValidation: undefined,
                force: undefined
            }, { headers: { 'Content-Type': 'application/json-patch+json' } });

            console.log(`  Set shutdown-done annotation`);
            console.log(`  Cleared shutdown-at annotation`);
            console.log(`  Cleared shutdown-by annotation`);
            console.log(`  Shutdown simulation completed for: ${namespaceName}`);
        } else {
            console.log(`  Shutdown date not reached yet for: ${namespaceName}`);
        }
    }

    console.log(`Namespace shutdown job completed at ${new Date().toISOString()}`);
}

// Run the job
processNamespaces();