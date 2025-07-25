import { NextResponse } from 'next/server'
import * as k8s from '@kubernetes/client-node'

// Function to check if namespace has required label
function hasRequiredLabel(namespace: k8s.V1Namespace, targetLabelName: string | undefined): boolean {
  if (!targetLabelName) {
    return true; // No filter, include all namespaces
  }
  
  const namespaceLabels = namespace.metadata?.labels || {};
  const labelValue = namespaceLabels[targetLabelName];
  
  return labelValue != null && String(labelValue).trim() !== '';
}

export async function GET() {
  try {
    const targetLabelName = process.env.TARGET_LABEL_NAME;
    const shutdownDays = parseInt(process.env.SHUTDOWN_DAYS || '7', 10);
    const maxSubscribers = parseInt(process.env.MAX_SUBSCRIBERS_PER_NAMESPACE || '10', 10);
    
    const kc = new k8s.KubeConfig()
    kc.loadFromDefault()

    const k8sApi = kc.makeApiClient(k8s.CoreV1Api)
    
    const response = await k8sApi.listNamespace()
    
    // Filter namespaces by system namespaces and label requirements
    const filteredNamespaces = response.items.filter(ns => {
      const namespaceName = ns.metadata?.name || '';
      
      // Skip system namespaces
      if (namespaceName.match(/^kube-/) || namespaceName === 'default') {
        return false;
      }
      
      // Check required label filter
      if (!hasRequiredLabel(ns, targetLabelName)) {
        return false;
      }
      
      return true;
    });
    
    const namespaces = filteredNamespaces.map(ns => {
      // Parse subscriber list from annotation
      const subscribersAnnotation = ns.metadata?.annotations?.['kube-esg/shutdown-subscribers'] || '[]';
      let subscribers: string[] = [];
      try {
        subscribers = JSON.parse(subscribersAnnotation);
      } catch {
        console.warn(`Invalid subscriber annotation for namespace ${ns.metadata?.name}:`, subscribersAnnotation);
        subscribers = [];
      }

      return {
        name: ns.metadata?.name || '',
        shutdownBy: ns.metadata?.annotations?.['kube-esg/next-shutdown-by'] || '',
        shutdownAt: ns.metadata?.annotations?.['kube-esg/next-shutdown-at'] || '',
        shutdownDone: ns.metadata?.annotations?.['kube-esg/prev-shutdown-at'] || '',
        annotations: ns.metadata?.annotations || {},
        labelValue: targetLabelName ? (ns.metadata?.labels?.[targetLabelName] || '') : null,
        subscribers,
        subscriberCount: subscribers.length,
        maxSubscribers
      }
    })

    return NextResponse.json({ 
      namespaces,
      targetLabelName,
      shutdownDays
    })
  } catch (error) {
    console.error('Error fetching namespaces:', error)
    return NextResponse.json(
      { error: 'Failed to fetch namespaces' },
      { status: 500 }
    )
  }
}