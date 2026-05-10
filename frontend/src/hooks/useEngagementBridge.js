import { useCallback, useRef } from "react"

function useEngagementBridge() {
  const listenersRef = useRef(new Set())

  const publishEngagement = useCallback((payload) => {
    const engagementPayload = {
      engagementScore: Number(payload.engagementScore || 0),
      dominantEmotion: payload.dominantEmotion || null,
      stabilityScore: Number(payload.stabilityScore || 0),
      transitionRate: Number(payload.transitionRate || 0),
      timestamp: Date.now(),
    }

    listenersRef.current.forEach((listener) => {
      try {
        listener(engagementPayload)
      } catch (error) {
        console.error("Engagement listener error", error)
      }
    })

    return engagementPayload
  }, [])

  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener)
    return () => listenersRef.current.delete(listener)
  }, [])

  return { publishEngagement, subscribe }
}

export { useEngagementBridge }
