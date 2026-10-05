import { useEffect } from 'react'
import { useEditorUiStore, type UiNotification } from '../state/editor-ui-store'

const KIND_STYLES: Record<string, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
}

/** Info toasts clear themselves; errors/warnings stay until the user dismisses them. */
const INFO_AUTO_DISMISS_MS = 4000

function NotificationToast({ notification }: { notification: UiNotification }) {
  const dismissNotification = useEditorUiStore((s) => s.dismissNotification)

  // Carry-over fix (phase 4->5): this used to live in normal document flow
  // above the stage, so a banner appearing mid-interaction (e.g. the
  // "click two points" hint shown on entering calibrate mode) reflowed the
  // stage container's on-screen position/size while the user was mid-click.
  // Auto-dismissing info toasts keeps the overlay (see below) brief too.
  useEffect(() => {
    if (notification.kind !== 'info') return
    const timer = window.setTimeout(() => dismissNotification(notification.id), INFO_AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [notification.id, notification.kind, dismissNotification])

  return (
    <div
      role={notification.kind === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-start justify-between gap-3 rounded border px-3 py-2 text-sm shadow-md ${KIND_STYLES[notification.kind]}`}
    >
      <span>{notification.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismissNotification(notification.id)}
        className="shrink-0 rounded px-1 font-medium leading-none hover:opacity-70 focus:outline focus:outline-2 focus:outline-current"
      >
        ×
      </button>
    </div>
  )
}

/**
 * Dismissible error/warning/info toasts, overlaid on top of the workspace
 * (`fixed` positioning, removed from normal flow) so a notification popping
 * up or disappearing can never move or resize the toolbar/stage container
 * underneath the user's pointer. See the useEffect comment above for why
 * this matters - it fixes a real Phase 4 coordinate-mapping symptom.
 */
export function NotificationBanner() {
  const notifications = useEditorUiStore((s) => s.notifications)

  if (notifications.length === 0) return null

  return (
    <div
      data-testid="notification-banner"
      className="pointer-events-none fixed inset-x-0 top-14 z-50 flex flex-col items-center gap-1 px-4"
    >
      <div className="flex w-full max-w-md flex-col gap-1">
        {notifications.map((n) => (
          <NotificationToast key={n.id} notification={n} />
        ))}
      </div>
    </div>
  )
}
