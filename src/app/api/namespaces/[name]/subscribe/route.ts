import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import * as k8s from '@kubernetes/client-node'
import logger from '@/lib/logger'

const MAX_SUBSCRIBERS_PER_NAMESPACE = parseInt(process.env.MAX_SUBSCRIBERS_PER_NAMESPACE || '10', 10)
const SUBSCRIBER_ANNOTATION_KEY = 'kube-esg/shutdown-subscribers'

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
      action: 'namespace_subscribe_requested',
      namespace: namespaceName,
      user: session.user.email,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    }, 'User requested namespace subscription')

    // Initialize Kubernetes client
    const kc = new k8s.KubeConfig()
    kc.loadFromDefault()
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api)

    // Get current namespace to check existing annotations
    const currentNamespace = await k8sApi.readNamespace({ name: namespaceName })
    const existingAnnotations = currentNamespace.metadata?.annotations || {}

    // Parse existing subscribers
    const currentSubscribersList = existingAnnotations[SUBSCRIBER_ANNOTATION_KEY] 
      ? JSON.parse(existingAnnotations[SUBSCRIBER_ANNOTATION_KEY]) 
      : []

    // Check if user is already subscribed
    if (currentSubscribersList.includes(session.user.email)) {
      return NextResponse.json({
        error: 'Already subscribed',
        subscribers: currentSubscribersList,
        count: currentSubscribersList.length,
        maxAllowed: MAX_SUBSCRIBERS_PER_NAMESPACE
      }, { status: 400 })
    }

    // Check subscriber limit
    if (currentSubscribersList.length >= MAX_SUBSCRIBERS_PER_NAMESPACE) {
      return NextResponse.json({
        error: `Maximum ${MAX_SUBSCRIBERS_PER_NAMESPACE} subscribers allowed`,
        maxAllowed: MAX_SUBSCRIBERS_PER_NAMESPACE,
        current: currentSubscribersList.length
      }, { status: 400 })
    }

    // Add new subscriber
    const updatedSubscribers = [...currentSubscribersList, session.user.email]
    const subscribersJson = JSON.stringify(updatedSubscribers)

    // Check annotation size limit (Kubernetes limit is ~1KB)
    if (subscribersJson.length > 1000) {
      return NextResponse.json({
        error: 'Subscriber list would exceed annotation size limit'
      }, { status: 400 })
    }

    // Prepare JSON patch operations
    const patch = []
    
    if (SUBSCRIBER_ANNOTATION_KEY in existingAnnotations) {
      patch.push({
        op: 'replace',
        path: '/metadata/annotations/kube-esg~1shutdown-subscribers',
        value: subscribersJson
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
        path: '/metadata/annotations/kube-esg~1shutdown-subscribers',
        value: subscribersJson
      })
    }

    // Apply the JSON patch
    await k8sApi.patchNamespace({
      name: namespaceName,
      body: patch
    })

    logger.info({
      action: 'namespace_subscribe_completed',
      namespace: namespaceName,
      user: session.user.email,
      previousSubscribers: currentSubscribersList,
      newSubscribers: updatedSubscribers,
      subscriberCount: updatedSubscribers.length
    }, 'Namespace subscription completed successfully')

    return NextResponse.json({
      success: true,
      subscribers: updatedSubscribers,
      count: updatedSubscribers.length,
      maxAllowed: MAX_SUBSCRIBERS_PER_NAMESPACE
    })

  } catch (error) {
    const { name: namespaceName } = await params
    
    logger.error({
      action: 'namespace_subscribe_failed',
      namespace: namespaceName,
      user: session.user.email,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    }, 'Failed to subscribe to namespace')
    
    return NextResponse.json(
      { error: 'Failed to subscribe to namespace' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
      action: 'namespace_unsubscribe_requested',
      namespace: namespaceName,
      user: session.user.email,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    }, 'User requested namespace unsubscription')

    // Initialize Kubernetes client
    const kc = new k8s.KubeConfig()
    kc.loadFromDefault()
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api)

    // Get current namespace to check existing annotations
    const currentNamespace = await k8sApi.readNamespace({ name: namespaceName })
    const existingAnnotations = currentNamespace.metadata?.annotations || {}

    // Parse existing subscribers
    const currentSubscribersList = existingAnnotations[SUBSCRIBER_ANNOTATION_KEY] 
      ? JSON.parse(existingAnnotations[SUBSCRIBER_ANNOTATION_KEY]) 
      : []

    // Check if user is subscribed
    if (!currentSubscribersList.includes(session.user.email)) {
      return NextResponse.json({
        error: 'Not subscribed',
        subscribers: currentSubscribersList,
        count: currentSubscribersList.length,
        maxAllowed: MAX_SUBSCRIBERS_PER_NAMESPACE
      }, { status: 400 })
    }

    // Remove subscriber
    const updatedSubscribers = currentSubscribersList.filter(
      (email: string) => email !== session.user?.email
    )
    const subscribersJson = JSON.stringify(updatedSubscribers)

    // Prepare JSON patch operations
    const patch = [{
      op: 'replace',
      path: '/metadata/annotations/kube-esg~1shutdown-subscribers',
      value: subscribersJson
    }]

    // Apply the JSON patch
    await k8sApi.patchNamespace({
      name: namespaceName,
      body: patch
    })

    logger.info({
      action: 'namespace_unsubscribe_completed',
      namespace: namespaceName,
      user: session.user.email,
      previousSubscribers: currentSubscribersList,
      newSubscribers: updatedSubscribers,
      subscriberCount: updatedSubscribers.length
    }, 'Namespace unsubscription completed successfully')

    return NextResponse.json({
      success: true,
      subscribers: updatedSubscribers,
      count: updatedSubscribers.length,
      maxAllowed: MAX_SUBSCRIBERS_PER_NAMESPACE
    })

  } catch (error) {
    const { name: namespaceName } = await params
    
    logger.error({
      action: 'namespace_unsubscribe_failed',
      namespace: namespaceName,
      user: session.user.email,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    }, 'Failed to unsubscribe from namespace')
    
    return NextResponse.json(
      { error: 'Failed to unsubscribe from namespace' },
      { status: 500 }
    )
  }
}