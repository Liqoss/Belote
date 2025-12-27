import { io, type Socket } from 'socket.io-client'
import { ref } from 'vue'

export const useSocket = () => {
  const socket = ref<Socket | null>(null)

  const connect = () => {
    if (!socket.value) {
      socket.value = io({
        path: '/socket.io',
        autoConnect: true
      })
      
      socket.value.on('connect', () => {
        console.log('Connected to WebSocket server')
      })
    }
    return socket.value
  }

  return {
    socket,
    connect
  }
}
