import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import * as k8s from '@kubernetes/client-node'
import logger from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  // Get the authenticated user session
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }
  
  try {

    const { name: namespaceName } = await params

    logger.info({
      action: 'namespace_extend_requested',
      namespace: namespaceName,
      user: session.user.email,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    }, 'User requested namespace extension')

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

    logger.info({
      action: 'namespace_extend_completed',
      namespace: namespaceName,
      user: session.user.email,
      previousShutdownAt: existingAnnotations['kube-esg/shutdown-at'] || 'not set',
      newShutdownAt: newShutdownDate,
      previousShutdownBy: existingAnnotations['kube-esg/shutdown-by'] || 'not set'
    }, 'Namespace extension completed successfully')

    return NextResponse.json({
      success: true,
      shutdownAt: newShutdownDate,
      shutdownBy: session.user.email
    })

  } catch (error) {
    const { name: namespaceName } = await params
    
    logger.error({
      action: 'namespace_extend_failed',
      namespace: namespaceName,
      user: session.user.email,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    }, 'Failed to extend namespace')
    
    return NextResponse.json(
      { error: 'Failed to extend namespace' },
      { status: 500 }
    )
  }
}