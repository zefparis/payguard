import { useEffect, type ReactNode } from 'react'
import { useBehavioral, type BehavioralController } from '../hooks/useBehavioral'

type Props = {
  motionEnabled?: boolean
  pointerEnabled?: boolean
  onController: (controller: BehavioralController) => void
  children: ReactNode
}

export function BehavioralCapture({ motionEnabled = true, pointerEnabled = true, onController, children }: Props) {
  const enabled = motionEnabled || pointerEnabled
  const controller = useBehavioral(motionEnabled)

  useEffect(() => {
    onController(controller)

    if (enabled) {
      void controller.start()
    } else {
      controller.stop()
    }

    return () => {
      controller.stop()
    }
  }, [controller, enabled, onController])

  return <>{children}</>
}
