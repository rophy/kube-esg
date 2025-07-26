import logger from './logger'

export interface NotificationEvent {
  namespace: string
  subscribers: string[]
  shutdownAt: string
  action: 'shutdown_warning' | 'shutdown_imminent' | 'shutdown_completed'
  hoursUntilShutdown?: number
}

/**
 * Log notification events for the shutdown job to process
 * This function creates structured log entries that external notification systems can consume
 */
export function logNotificationEvent(event: NotificationEvent) {
  logger.info({
    type: 'namespace_notification',
    namespace: event.namespace,
    subscribers: event.subscribers,
    subscriberCount: event.subscribers.length,
    shutdownAt: event.shutdownAt,
    action: event.action,
    hoursUntilShutdown: event.hoursUntilShutdown,
    timestamp: new Date().toISOString()
  }, `Notification required: ${event.action} for namespace ${event.namespace} with ${event.subscribers.length} subscribers`)
}

/**
 * Helper function to check if namespace has subscribers and log appropriate notification
 * This would be called by the shutdown job before namespace operations
 */
export function checkAndLogShutdownNotification(
  namespaceName: string, 
  subscribers: string[], 
  shutdownAt: string,
  action: 'shutdown_warning' | 'shutdown_imminent' | 'shutdown_completed'
) {
  if (subscribers.length === 0) {
    logger.info({
      type: 'namespace_notification',
      namespace: namespaceName,
      subscriberCount: 0,
      action: action
    }, `No subscribers for namespace ${namespaceName} - no notification needed`)
    return
  }

  const shutdownDate = new Date(shutdownAt)
  const now = new Date()
  const hoursUntilShutdown = Math.max(0, Math.floor((shutdownDate.getTime() - now.getTime()) / (1000 * 60 * 60)))

  logNotificationEvent({
    namespace: namespaceName,
    subscribers,
    shutdownAt,
    action,
    hoursUntilShutdown
  })
}