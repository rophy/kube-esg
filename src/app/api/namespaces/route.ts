import { NextResponse } from 'next/server'
import * as k8s from '@kubernetes/client-node'

export async function GET() {
  try {
    const kc = new k8s.KubeConfig()
    kc.loadFromDefault()

    const k8sApi = kc.makeApiClient(k8s.CoreV1Api)
    
    const response = await k8sApi.listNamespace()
    
    const namespaces = response.items.map(ns => ({
      name: ns.metadata?.name || '',
      annotationA: ns.metadata?.annotations?.['annotation-a'] || '',
      annotationB: ns.metadata?.annotations?.['annotation-b'] || '',
      annotations: ns.metadata?.annotations || {}
    }))

    return NextResponse.json({ namespaces })
  } catch (error) {
    console.error('Error fetching namespaces:', error)
    return NextResponse.json(
      { error: 'Failed to fetch namespaces' },
      { status: 500 }
    )
  }
}