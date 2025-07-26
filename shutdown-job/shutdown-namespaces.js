#!/usr/bin/env node

import * as k8s from '@kubernetes/client-node';

// Configuration
const serviceAccountName = process.env.SERVICE_ACCOUNT_NAME || 'shutdown-job';
const ownNamespace = process.env.POD_NAMESPACE || process.env.NAMESPACE || null;
const targetLabelName = process.env.TARGET_LABEL_NAME || null; // Name of label to filter by
const shutdownDays = parseInt(process.env.SHUTDOWN_DAYS || '7', 10);
const now = new Date();
const nowDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
const nowTimestamp = now.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ

// Calculate shutdown date from now + shutdownDays
const futureDate = new Date(now.getTime() + shutdownDays * 24 * 60 * 60 * 1000);
const futureDateString = futureDate.toISOString().split('T')[0];

console.log(`Starting namespace shutdown job at ${nowTimestamp}`);
console.log(`Service account: ${serviceAccountName}`);
if (ownNamespace) {
    console.log(`Own namespace: ${ownNamespace} (will be skipped)`);
}
if (targetLabelName) {
    console.log(`Label filter: ${targetLabelName} (only namespaces with this label will be processed)`);
}

// Initialize Kubernetes client
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const batchApi = kc.makeApiClient(k8s.BatchV1Api);

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

// Function to check if namespace has required label
function hasRequiredLabel(namespace) {
    if (!targetLabelName) {
        return true; // No filter, include all namespaces
    }
    
    const namespaceLabels = namespace.metadata?.labels || {};
    const labelValue = namespaceLabels[targetLabelName];
    
    return labelValue && labelValue.trim() !== '';
}

// Function to shutdown deployments
async function shutdownDeployments(namespaceName) {
    try {
        const response = await appsApi.listNamespacedDeployment({ namespace: namespaceName });
        const deployments = response.items || [];
        let shutdownCount = 0;

        for (const deployment of deployments) {
            const name = deployment.metadata?.name;
            if (!name) continue;

            const currentReplicas = deployment.spec?.replicas || 0;
            
            // Skip if already shutdown (replicas == 0)
            if (currentReplicas === 0) {
                console.log(`    Deployment ${name} already shutdown (replicas: 0)`);
                continue;
            }

            console.log(`    Shutting down deployment ${name} (replicas: ${currentReplicas} -> 0)`);

            const patch = [
                {
                    op: 'add',
                    path: '/metadata/annotations/kube-esg~1original-replicas',
                    value: currentReplicas.toString()
                },
                {
                    op: 'add',
                    path: '/metadata/annotations/kube-esg~1prev-shutdown-at',
                    value: nowTimestamp
                },
                {
                    op: 'replace',
                    path: '/spec/replicas',
                    value: 0
                }
            ];

            // Handle case where annotations don't exist
            if (!deployment.metadata?.annotations) {
                patch.unshift({
                    op: 'add',
                    path: '/metadata/annotations',
                    value: {}
                });
            }

            await appsApi.patchNamespacedDeployment({
                name,
                namespace: namespaceName,
                body: patch,
                pretty: undefined,
                dryRun: undefined,
                fieldManager: undefined,
                fieldValidation: undefined,
                force: undefined
            }, { headers: { 'Content-Type': 'application/json-patch+json' } });

            shutdownCount++;
        }

        console.log(`    Shutdown ${shutdownCount} deployments`);
        return shutdownCount;
    } catch (error) {
        console.error(`    Failed to shutdown deployments in ${namespaceName}:`, error.message);
        return 0;
    }
}

// Function to shutdown statefulsets
async function shutdownStatefulSets(namespaceName) {
    try {
        const response = await appsApi.listNamespacedStatefulSet({ namespace: namespaceName });
        const statefulSets = response.items || [];
        let shutdownCount = 0;

        for (const statefulSet of statefulSets) {
            const name = statefulSet.metadata?.name;
            if (!name) continue;

            const currentReplicas = statefulSet.spec?.replicas || 0;
            
            // Skip if already shutdown (replicas == 0)
            if (currentReplicas === 0) {
                console.log(`    StatefulSet ${name} already shutdown (replicas: 0)`);
                continue;
            }

            console.log(`    Shutting down statefulset ${name} (replicas: ${currentReplicas} -> 0)`);

            const patch = [
                {
                    op: 'add',
                    path: '/metadata/annotations/kube-esg~1original-replicas',
                    value: currentReplicas.toString()
                },
                {
                    op: 'add',
                    path: '/metadata/annotations/kube-esg~1prev-shutdown-at',
                    value: nowTimestamp
                },
                {
                    op: 'replace',
                    path: '/spec/replicas',
                    value: 0
                }
            ];

            if (!statefulSet.metadata?.annotations) {
                patch.unshift({
                    op: 'add',
                    path: '/metadata/annotations',
                    value: {}
                });
            }

            await appsApi.patchNamespacedStatefulSet({
                name,
                namespace: namespaceName,
                body: patch,
                pretty: undefined,
                dryRun: undefined,
                fieldManager: undefined,
                fieldValidation: undefined,
                force: undefined
            }, { headers: { 'Content-Type': 'application/json-patch+json' } });

            shutdownCount++;
        }

        console.log(`    Shutdown ${shutdownCount} statefulsets`);
        return shutdownCount;
    } catch (error) {
        console.error(`    Failed to shutdown statefulsets in ${namespaceName}:`, error.message);
        return 0;
    }
}

// Function to shutdown daemonsets
async function shutdownDaemonSets(namespaceName) {
    try {
        const response = await appsApi.listNamespacedDaemonSet({ namespace: namespaceName });
        const daemonSets = response.items || [];
        let shutdownCount = 0;

        for (const daemonSet of daemonSets) {
            const name = daemonSet.metadata?.name;
            if (!name) continue;

            const currentNodeSelector = daemonSet.spec?.template?.spec?.nodeSelector || {};
            
            // Skip if already shutdown (has the magic selector)
            if (currentNodeSelector['kube-esg/shutdown'] === 'never-match') {
                console.log(`    DaemonSet ${name} already shutdown (has magic selector)`);
                continue;
            }

            console.log(`    Shutting down daemonset ${name} (using impossible node selector)`);

            const patch = [
                {
                    op: 'add',
                    path: '/metadata/annotations/kube-esg~1original-node-selector',
                    value: JSON.stringify(currentNodeSelector)
                },
                {
                    op: 'add',
                    path: '/metadata/annotations/kube-esg~1prev-shutdown-at',
                    value: nowTimestamp
                },
                {
                    op: 'replace',
                    path: '/spec/template/spec/nodeSelector',
                    value: {
                        ...currentNodeSelector,
                        'kube-esg/shutdown': 'never-match'
                    }
                }
            ];

            if (!daemonSet.metadata?.annotations) {
                patch.unshift({
                    op: 'add',
                    path: '/metadata/annotations',
                    value: {}
                });
            }

            await appsApi.patchNamespacedDaemonSet({
                name,
                namespace: namespaceName,
                body: patch,
                pretty: undefined,
                dryRun: undefined,
                fieldManager: undefined,
                fieldValidation: undefined,
                force: undefined
            }, { headers: { 'Content-Type': 'application/json-patch+json' } });

            shutdownCount++;
        }

        console.log(`    Shutdown ${shutdownCount} daemonsets`);
        return shutdownCount;
    } catch (error) {
        console.error(`    Failed to shutdown daemonsets in ${namespaceName}:`, error.message);
        return 0;
    }
}

// Function to shutdown cronjobs
async function shutdownCronJobs(namespaceName) {
    try {
        const response = await batchApi.listNamespacedCronJob({ namespace: namespaceName });
        const cronJobs = response.items || [];
        let shutdownCount = 0;

        for (const cronJob of cronJobs) {
            const name = cronJob.metadata?.name;
            if (!name) continue;

            const currentSuspend = cronJob.spec?.suspend || false;
            
            // Skip if already suspended
            if (currentSuspend === true) {
                console.log(`    CronJob ${name} already shutdown (suspended: true)`);
                continue;
            }

            console.log(`    Shutting down cronjob ${name} (suspend: ${currentSuspend} -> true)`);

            const patch = [
                {
                    op: 'add',
                    path: '/metadata/annotations/kube-esg~1original-suspend',
                    value: currentSuspend.toString()
                },
                {
                    op: 'add',
                    path: '/metadata/annotations/kube-esg~1prev-shutdown-at',
                    value: nowTimestamp
                },
                {
                    op: 'replace',
                    path: '/spec/suspend',
                    value: true
                }
            ];

            if (!cronJob.metadata?.annotations) {
                patch.unshift({
                    op: 'add',
                    path: '/metadata/annotations',
                    value: {}
                });
            }

            await batchApi.patchNamespacedCronJob({
                name,
                namespace: namespaceName,
                body: patch,
                pretty: undefined,
                dryRun: undefined,
                fieldManager: undefined,
                fieldValidation: undefined,
                force: undefined
            }, { headers: { 'Content-Type': 'application/json-patch+json' } });

            shutdownCount++;
        }

        console.log(`    Shutdown ${shutdownCount} cronjobs`);
        return shutdownCount;
    } catch (error) {
        console.error(`    Failed to shutdown cronjobs in ${namespaceName}:`, error.message);
        return 0;
    }
}

// Function to perform complete namespace shutdown
async function performNamespaceShutdown(namespaceName) {
    console.log(`  Performing actual workload shutdown for: ${namespaceName}`);
    
    // Shutdown workloads in order: CronJobs, DaemonSets, Deployments, StatefulSets
    const cronJobCount = await shutdownCronJobs(namespaceName);
    const daemonSetCount = await shutdownDaemonSets(namespaceName);
    const deploymentCount = await shutdownDeployments(namespaceName);
    const statefulSetCount = await shutdownStatefulSets(namespaceName);
    
    const totalShutdown = cronJobCount + daemonSetCount + deploymentCount + statefulSetCount;
    console.log(`  Total workloads shutdown: ${totalShutdown} (${deploymentCount} deployments, ${statefulSetCount} statefulsets, ${daemonSetCount} daemonsets, ${cronJobCount} cronjobs)`);
    
    return totalShutdown;
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

        // Check required label filter
        if (!hasRequiredLabel(namespace)) {
            console.log(`  Skipping namespace (missing required label '${targetLabelName}'): ${namespaceName}`);
            continue;
        }

        const annotations = namespace.metadata.annotations || {};
        const shutdownAt = getAnnotation(annotations, 'kube-esg/next-shutdown-at');
        const shutdownBy = getAnnotation(annotations, 'kube-esg/next-shutdown-by');

        // If shutdown-at annotation doesn't exist, set it to NOW+X days
        if (!shutdownAt) {
            console.log(`  Setting shutdown-at annotation to: ${futureDateString}`);
            
            const patch = [
                {
                    op: 'add',
                    path: '/metadata/annotations/kube-esg~1next-shutdown-at',
                    value: futureDateString
                },
                {
                    op: 'add',
                    path: '/metadata/annotations/kube-esg~1next-shutdown-by',
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

            try {
                // Perform actual workload shutdown
                const shutdownCount = await performNamespaceShutdown(namespaceName);
                
                // Mark namespace as shutdown and clean up scheduling annotations
                const patch = [
                    {
                        op: 'add',
                        path: '/metadata/annotations/kube-esg~1prev-shutdown-at',
                        value: nowTimestamp
                    }
                ];

                // Remove shutdown-at and shutdown-by annotations
                if (getAnnotation(annotations, 'kube-esg/next-shutdown-at')) {
                    patch.push({
                        op: 'remove',
                        path: '/metadata/annotations/kube-esg~1next-shutdown-at'
                    });
                }

                if (getAnnotation(annotations, 'kube-esg/next-shutdown-by')) {
                    patch.push({
                        op: 'remove',
                        path: '/metadata/annotations/kube-esg~1next-shutdown-by'
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

                console.log(`  Namespace shutdown completed for: ${namespaceName}`);
                console.log(`  Set shutdown-done annotation and cleared scheduling annotations`);
                
            } catch (error) {
                console.error(`  Failed to shutdown namespace ${namespaceName}:`, error.message);
            }
        } else {
            console.log(`  Shutdown date not reached yet for: ${namespaceName}`);
        }
    }

    console.log(`Namespace shutdown job completed at ${new Date().toISOString()}`);
}

// Run the job
processNamespaces().catch(error => {
    console.error('Shutdown job failed:', error);
    process.exit(1);
});