import { Server as SocketServer } from 'socket.io'
import type { NitroApp } from 'nitropack'
// import { BeloteGame } from '../utils/belote' // No longer Single Game
import { roomManager } from '../utils/roomManager'
import { findUserById } from '../utils/db'

let io: SocketServer

export default defineNitroPlugin((nitroApp: NitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    // @ts-ignore
    if (!io && event.node.res.socket?.server) {
      console.log('Initializing Socket.io Server (Multi-Room)...')
      // @ts-ignore
      io = new SocketServer(event.node.res.socket.server, {
        path: '/socket.io',
        cors: {
          origin: '*',
          methods: ['GET', 'POST']
        }
      })
      
      // Helper to update a specific room
      const updateRoom = (roomId: number) => {
          if (!io) return
          const game = roomManager.getRoom(roomId)
          if (!game) return

          // Construct Safe State
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
          }

          // Broadcast to specific ROOM channel
          const roomChannel = `room_${roomId}`;
          const roomSockets = io.sockets.adapter.rooms.get(roomChannel);
          
          if (roomSockets) {
              for (const socketId of roomSockets) {
                  const socket = io.sockets.sockets.get(socketId);
                  if (socket) {
                    const playerId = game.socketMap[socket.id]
                    const player = game.players.find(p => p.id === playerId)

                    if (player && !player.isBot) {
                        socket.emit('game-update', { 
                            ...baseState, 
                            hands: { [player.id]: game.hands[player.id] || [] },
                            possibleAnnouncements: game.possibleAnnouncements[player.id] || []
                        })
                    } else {
                        // Spectator
                        socket.emit('game-update', { ...baseState })
                    }
                  }
              }
          }
          
          // Also Notify Lobby of update (personalized)
          if (io) {
              const allSockets = io.sockets.sockets;
              allSockets.forEach(s => {
                   // Try User ID (Auth), or fallback to Socket ID (Guest default)
                   // This covers most cases. 
                   const uId = s.data.user ? s.data.user.id : s.id;
                   s.emit('lobby-update', roomManager.getLobbyList(uId));
              });
          }
      }

    // Helper to parse cookies
    const parseCookies = (str?: string) => {
      if (!str) return {}
      return Object.fromEntries(str.split('; ').map(c => c.split('=')))
    }

      io.on('connection', (socket) => {
        // console.log('Client connected:', socket.id) // noisy

        // AUTHENTICATION
        const cookies = parseCookies(socket.handshake.headers.cookie)
        const userId = cookies['belote_session']
        
        if (userId) {
            const dbUser = findUserById(userId)
            if (dbUser) {
                socket.data.user = dbUser
            }
        }

        // LOBBY: Send initial list
        socket.emit('room-list', roomManager.getLobbyList(socket.data.user?.id || socket.id));

        socket.on('get-rooms', () => {
             socket.emit('room-list', roomManager.getLobbyList(socket.data.user?.id || socket.id));
        });

        // JOIN ROOM
        socket.on('join-room', (data: { roomId: number, username: string, userId: string }) => {
             const roomId = Number(data.roomId);
             if (!roomId || roomId < 1 || roomId > 100) return;

             // Leave execution context of previous room if any
             if (socket.data.roomId && socket.data.roomId !== roomId) {
                 socket.leave(`room_${socket.data.roomId}`);
                 // Should we remove player from prev game? 
                 // Yes, relying on disconnect logic or explicit leave? 
                 // For now, let's just handle the new join.
             }

             socket.join(`room_${roomId}`);
             socket.data.roomId = roomId;

             const game = roomManager.getRoom(roomId);
             if (!game) return; // Should not happen given getRoom logic

             // Bind Update Trigger (Idempotent)
             game.onUpdate = () => updateRoom(roomId);

             // Add Player
             if (socket.data.user) {
                 game.addPlayer(socket.id, socket.data.user.username, socket.data.user.id, socket.data.user.avatar, socket.data.user.elo)
             } else {
                 game.addPlayer(socket.id, data.username || 'Guest', data.userId || socket.id)
             }
             
             updateRoom(roomId);
        })

        socket.on('leave-room', () => {
             const game = getGame();
             if (game) {
                 game.leaveSeat(socket.id);
                 game.onUpdate();
                 socket.leave(`room_${socket.data.roomId}`);
                 socket.data.roomId = null;
             }
        })
        
        // --- GAME ACTIONS (Proxy to specific Game) ---

        const getGame = () => {
            if (!socket.data.roomId) return null;
            return roomManager.getRoom(socket.data.roomId);
        }

        socket.on('start-game-bots', () => {
             const game = getGame();
             if (game) {
                 game.addBots();
                 game.startGame();
                 game.onUpdate(); // Trigger update
             }
        })

        socket.on('start-game', () => {
            const game = getGame();
            if (game) {
                game.startGame();
                game.onUpdate();
            }
        })
        
        socket.on('play-card', (cardId: string) => {
            const game = getGame();
            if (game) {
                game.playCard(socket.id, cardId);
                // game.onUpdate() is called internally by playCard
            }
        })
        
        socket.on('player-bid', (data: { action: 'take' | 'pass', suit?: any }) => {
            const game = getGame();
            if (game) game.playerBid(socket.id, data.action, data.suit);
        })
        
        socket.on('declare-announcement', (decision: boolean) => {
            const game = getGame();
            if (game) game.playerDeclare(socket.id, decision);
        })

        socket.on('player-ready', () => {
            const game = getGame();
            if (game) game.playerSetReady(socket.id);
        })

        socket.on('reset-game', () => {
            const game = getGame();
            if (game) {
                game.fullReset();
                game.onUpdate();
            }
        })

        socket.on('disconnect', () => {
          if (socket.data.roomId) {
              const game = roomManager.getRoom(socket.data.roomId);
              if (game) {
                  game.removePlayer(socket.id);
                  game.onUpdate();
              }
          }
        })
        
      })
      
      // Global Loop for Timeouts (Iterate active rooms)
      // This might become expensive if 100 rooms are active. 
      // But 100 iterations every 5s is nothing.
      setInterval(() => {
           for (const [id, game] of roomManager.rooms) {
               if (game.phase !== 'lobby') {
                   game.checkStalled();
               }
           }
      }, 5000)

      // @ts-ignore
      nitroApp.io = io
    }
  })
})
