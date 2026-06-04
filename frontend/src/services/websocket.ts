class WebSocketService {
  private displaySocket: WebSocket | null = null
  private adminSocket: WebSocket | null = null
  private displayListeners: Map<string, Set<(data: any) => void>> = new Map()
  private adminListeners: Map<string, Set<(data: any) => void>> = new Map()

  connectDisplay(eventId: number) {
    if (this.displaySocket) {
      this.displaySocket.close()
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    this.displaySocket = new WebSocket(
      `${protocol}//${window.location.host}/ws/display/${eventId}`
    )
    this.displaySocket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        this.notifyListeners('display', data.type, data)
      } catch (err) {
        console.error('WebSocket parse error:', err)
      }
    }
    this.displaySocket.onopen = () => {
      console.log('Display WebSocket connected')
    }
    this.displaySocket.onclose = () => {
      console.log('Display WebSocket disconnected')
      setTimeout(() => this.connectDisplay(eventId), 3000)
    }
  }

  connectAdmin(eventId: number, token: string) {
    if (this.adminSocket) {
      this.adminSocket.close()
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    this.adminSocket = new WebSocket(
      `${protocol}//${window.location.host}/ws/admin/${eventId}?token=${token}`
    )
    this.adminSocket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        this.notifyListeners('admin', data.type, data)
      } catch (err) {
        console.error('WebSocket parse error:', err)
      }
    }
    this.adminSocket.onopen = () => {
      console.log('Admin WebSocket connected')
    }
    this.adminSocket.onclose = () => {
      console.log('Admin WebSocket disconnected')
      setTimeout(() => this.connectAdmin(eventId, token), 3000)
    }
  }

  private notifyListeners(
    type: 'display' | 'admin',
    eventType: string,
    data: any
  ) {
    const listeners = type === 'display' 
      ? this.displayListeners 
      : this.adminListeners
    const eventListeners = listeners.get(eventType)
    if (eventListeners) {
      eventListeners.forEach((cb) => cb(data))
    }
    const allListeners = listeners.get('*')
    if (allListeners) {
      allListeners.forEach((cb) => cb(data))
    }
  }

  onDisplay(eventType: string, callback: (data: any) => void) {
    if (!this.displayListeners.has(eventType)) {
      this.displayListeners.set(eventType, new Set())
    }
    this.displayListeners.get(eventType)!.add(callback)
    return () => {
      this.displayListeners.get(eventType)?.delete(callback)
    }
  }

  onAdmin(eventType: string, callback: (data: any) => void) {
    if (!this.adminListeners.has(eventType)) {
      this.adminListeners.set(eventType, new Set())
    }
    this.adminListeners.get(eventType)!.add(callback)
    return () => {
      this.adminListeners.get(eventType)?.delete(callback)
    }
  }

  sendAdmin(data: any) {
    if (this.adminSocket?.readyState === WebSocket.OPEN) {
      this.adminSocket.send(JSON.stringify(data))
    }
  }

  disconnectDisplay() {
    if (this.displaySocket) {
      this.displaySocket.close()
      this.displaySocket = null
    }
  }

  disconnectAdmin() {
    if (this.adminSocket) {
      this.adminSocket.close()
      this.adminSocket = null
    }
  }

  disconnectAll() {
    this.disconnectDisplay()
    this.disconnectAdmin()
  }
}

export const wsService = new WebSocketService()
