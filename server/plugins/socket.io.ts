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
          
          // Construct Safe State (exclude sensitive info by default)
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

          // Broadcast to ALL connected sockets (players + spectators)
          io.sockets.sockets.forEach((socket) => {
              // Identify if this socket belongs to a player
              // We can reverse lookup or just check mapping
              const playerId = game.socketMap[socket.id]
              const player = game.players.find(p => p.id === playerId)

              // If it's a known player, send their hand
              if (player && !player.isBot) {
                  socket.emit('game-update', { 
                      ...baseState, 
                      hands: { [player.id]: game.hands[player.id] || [] } 
                  })
              } else {
                  // Spectator or Lobby User: Send public state
                  socket.emit('game-update', {
                      ...baseState
                  })
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

        socket.on('reset-game', () => {
            console.log('[SOCKET] Reset Game requested by', socket.id)
            game.fullReset()
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
