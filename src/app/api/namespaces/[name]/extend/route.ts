import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import * as k8s from '@kubernetes/client-node'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    // Get the authenticated user session
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { name: namespaceName } = await params

    // Initialize Kubernetes client
    const kc = new k8s.KubeConfig()
    kc.loadFromDefault()
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api)

    // Calculate new shutdown date (+7 days from now)
    const newShutdownDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    // Get current namespace to check existing annotations
    const currentNamespace = await k8sApi.readNamespace({ name: namespaceName })
    const existingAnnotations = currentNamespace.metadata?.annotations || {}

    // Prepare JSON patch operations - use replace for existing, add for new
    const patch = []
    
    // Handle shutdown-at annotation
    if ('kube-esg/shutdown-at' in existingAnnotations) {
      patch.push({
        op: 'replace',
        path: '/metadata/annotations/kube-esg~1shutdown-at',
        value: newShutdownDate
      })
    } else {
      // Ensure annotations object exists first
      if (!existingAnnotations || Object.keys(existingAnnotations).length === 0) {
        patch.push({
          op: 'add',
          path: '/metadata/annotations',
          value: {}
        })
      }
      patch.push({
        op: 'add',
        path: '/metadata/annotations/kube-esg~1shutdown-at',
        value: newShutdownDate
      })
    }

    // Handle shutdown-by annotation
    if ('kube-esg/shutdown-by' in existingAnnotations) {
      patch.push({
        op: 'replace',
        path: '/metadata/annotations/kube-esg~1shutdown-by',
        value: session.user.email
      })
    } else {
      patch.push({
        op: 'add',
        path: '/metadata/annotations/kube-esg~1shutdown-by',
        value: session.user.email
      })
    }

    // Apply the JSON patch
    await k8sApi.patchNamespace({
      name: namespaceName,
      body: patch
    })

    return NextResponse.json({
      success: true,
      shutdownAt: newShutdownDate,
      shutdownBy: session.user.email
    })

  } catch (error) {
    console.error('Error extending namespace:', error)
    return NextResponse.json(
      { error: 'Failed to extend namespace' },
      { status: 500 }
    )
  }
}