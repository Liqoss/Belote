import { Server as SocketServer } from 'socket.io'
import type { NitroApp } from 'nitropack'
import { BeloteGame } from '../utils/belote'

let io: SocketServer
// Initialize game. The callback will be set later via io connection hook or we can wrap it.
// Actually, since 'updateAll' depends on 'io', we execute it only when io exists.
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
      
      // Helper to update everyone with their own view
      const updateAll = () => {
          if (!io) return
          
          // Construct Safe State (exclude sensitive info if needed, or strictly match GameState)
          // For now, simpler: we send the public state.
          const baseState = {
              phase: game.phase,
              players: game.players,
              currentTrick: game.currentTrick,
              lastTrick: game.lastTrick,
              scores: game.scores,
              currentScores: game.currentScores,
              trumpSuit: game.trumpSuit,
              turnedCard: game.turnedCard,
              dealerIndex: game.dealerIndex,
              turnIndex: game.turnIndex,
              bidTakerIndex: game.bidTakerIndex,
              biddingRound: game.biddingRound,
              biddingHistory: game.biddingHistory,
              readyPlayers: game.readyPlayers
              // Hands are NOT sent in baseState
          }

          game.players.forEach(p => {
              if (!p.isBot && p.socketId) {
                  const s = io.sockets.sockets.get(p.socketId)
                  if (s) {
                      s.emit('game-update', { 
                          ...baseState, 
                          hands: { [p.id]: game.hands[p.id] || [] } // Send only THEIR hand
                      })
                  }
              }
          })
      }

      // Hook the update method
      game.onUpdate = updateAll

      io.on('connection', (socket) => {
        console.log('New client connected:', socket.id)

        // Initial Update for this specific client
        const player = game.players.find(p => p.socketId === socket.id) || game.players.find(p => !p.socketId && p.id === game.socketMap[socket.id])
        
        // If player known, send state
        if (player) {
             updateAll()
        } else {
            // Send empty/spectator state
             socket.emit('game-update', { 
                 phase: game.phase,
                 players: game.players,
                 // ... minimal state
             })
        }

        socket.on('join-game', (data: { username: string, userId: string }) => {
          game.addPlayer(socket.id, data.username, data.userId)
          updateAll()
        })
        
        socket.on('start-game-bots', () => {
             game.addBots()
             game.startGame()
             updateAll()
        })

        socket.on('start-game', () => {
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

        socket.on('player-ready', () => {
            game.playerSetReady(socket.id)
            updateAll()
        })

        socket.on('disconnect', () => {
          console.log('Client disconnected:', socket.id)
          game.removePlayer(socket.id)
          updateAll()
        })
        
        // Loop for Timeouts and Bot updates
        // Note: game.checkBotTurn already uses internal timeouts, but checkDisconnects needs polling
        setInterval(() => {
            game.checkStalled(); 
        }, 5000)
      })

      // @ts-ignore
      nitroApp.io = io
    }
  })
})
