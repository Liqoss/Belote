import { Server as SocketServer } from 'socket.io'
import type { NitroApp } from 'nitropack'
import { BeloteGame, Card } from '../utils/belote'

let io: SocketServer
const game = new BeloteGame()

export default defineNitroPlugin((nitroApp: NitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    // @ts-ignore
    if (!io && event.node.res.socket?.server) {
      console.log('Initializing Socket.io Server...')
      // @ts-ignore
      io = new SocketServer(event.node.res.socket.server, {
        path: '/socket.io',
        cors: {
          origin: '*',
          methods: ['GET', 'POST']
        }
      })

      io.on('connection', (socket) => {
        console.log('New client connected:', socket.id)

        const sendUpdate = () => {
            const state = game.getState()
            // Personalized view: only show own hand
            // For MVP: client filters? No, secure it? 
            // Let's send full state for simplicity now, but usually we filter 'hands'
            const myHand = game.hands[socket.id] || []
            socket.emit('game-update', { ...state, myHand })
            
            // Broadcast to others (generic update)
            socket.broadcast.emit('public-update', state) // We might need a loop to update everyone individually
        }
        
        // Helper to update everyone with their own view
        const updateAll = () => {
            const state = game.getState()
            game.players.forEach(p => {
                if (!p.isBot && p.socketId) {
                    const s = io.sockets.sockets.get(p.socketId)
                    if (s) {
                        s.emit('game-update', { ...state, myHand: game.hands[p.id] || [] })
                    }
                }
            })
        }
        
        // Register update callback to Game Engine
        game.setUpdateCallback(updateAll);
        
        // Initial Update
        const state = game.getState()
        socket.emit('game-update', { ...state, myHand: game.hands[game.socketMap[socket.id]] || [] })

        socket.on('join-game', (data: { username: string, userId: string }) => {
          game.addPlayer(socket.id, data.username, data.userId)
          updateAll()
        })
        
        socket.on('start-game-bots', () => {
             // Only allow if admin (first player) ? socket map check? 
             // For now allow any
             game.addBots()
             game.startGame()
             updateAll()
        })

        socket.on('start-game', () => {
            console.log('Received start-game event');
            game.startGame()
            updateAll()
        })
        
        socket.on('play-card', (cardId: string) => {
            game.playCard(socket.id, cardId)
            updateAll()
        })
        
        socket.on('player-bid', (data: { action: 'take' | 'pass', suit?: any }) => {
            game.playerBid(socket.id, data.action, data.suit)
            updateAll()
        })

        socket.on('disconnect', () => {
          console.log('Client disconnected:', socket.id)
          game.removePlayer(socket.id)
          updateAll()
        })
        
        // Loop for Bot Moves AND Disconnect Timeouts
        setInterval(() => {
            game.checkDisconnects(); // Check for timeouts
            
            if (game.phase === 'playing' || game.phase === 'bidding') {
                updateAll()
             }
        }, 1000)
      })

      // @ts-ignore
      nitroApp.io = io
    }
  })
})
