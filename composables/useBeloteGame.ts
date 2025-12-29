import { ref, computed, watch } from 'vue'
import { io, type Socket } from 'socket.io-client'
import type { GameState, Card, Suit, Player } from '~/types/belote'

export const useBeloteGame = () => {
    const socket = ref<Socket | null>(null)
    const gameState = ref<Partial<GameState>>({})
    const username = ref('')
    const hasJoined = ref(false)
    const myHand = ref<Card[]>([])
    
    // Animation specific state
    const animatingTrick = ref<any>(null)
    const animationPhase = ref<'idle' | 'gathering' | 'flying'>('idle')
    const lastHandledTrick = ref<string>('')

    const initSocket = () => {
        // Generate or retrieve persistent User ID
        let userId = localStorage.getItem('belote_user_id')
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9)
            localStorage.setItem('belote_user_id', userId)
        }

        // Try to recover username
        const storedName = localStorage.getItem('belote_username')
        if (storedName) {
            username.value = storedName
        }

        socket.value = io()
        
        socket.value.on('connect', () => {
            // Auto-rejoin if we have a username
            if (username.value) {
                socket.value?.emit('join-game', { username: username.value, userId })
                hasJoined.value = true
            } else {
                // Determine checking for existing session? 
                // For now, just connect. We rely on game-update broadcasting to all connected sockets 
                // (or at least providing lobby state to new connections).
                // If server only sends to 'room', we might need a 'spectate' generic join.
                // Assuming default implementation sends to all or we request update:
                socket.value?.emit('request-state') 
            }
        })
        
        socket.value.on('game-update', (state: GameState) => {
            gameState.value = state
            
            // Sync myHand
            if (state.hands && userId && state.hands[userId]) {
                myHand.value = state.hands[userId]
            } else if ((state as any).myHand) {
                 myHand.value = (state as any).myHand
            }
        })
    }

    // Computed
    const playerCount = computed(() => gameState.value.players ? gameState.value.players.length : 0)
    const isLobby = computed(() => gameState.value.phase === 'lobby')
    
    // Logic for my Index
    const myIndex = computed(() => {
        if (!gameState.value.players) return -1
        const userId = localStorage.getItem('belote_user_id')
        return gameState.value.players.findIndex(p => p.id === userId)
    })

    const isMyTurn = computed(() => {
        return gameState.value.turnIndex === myIndex.value
    })

    // Score Helpers (Relative to "Me")
    const myTeamId = computed(() => {
        if (myIndex.value === -1) return 1 // Default
        return (myIndex.value % 2) === 0 ? 1 : 2
    })

    const myTeamScore = computed(() => {
        if (!gameState.value.scores) return 0
        return myTeamId.value === 1 ? gameState.value.scores.team1 : gameState.value.scores.team2
    })

    const otherTeamScore = computed(() => {
        if (!gameState.value.scores) return 0
        return myTeamId.value === 1 ? gameState.value.scores.team2 : gameState.value.scores.team1
    })

    const myTeamCurrentScore = computed(() => {
        if (!gameState.value.currentScores) return 0
        return myTeamId.value === 1 ? gameState.value.currentScores.team1 : gameState.value.currentScores.team2
    })

    const otherTeamCurrentScore = computed(() => {
        if (!gameState.value.currentScores) return 0
        return myTeamId.value === 1 ? gameState.value.currentScores.team2 : gameState.value.currentScores.team1
    })

    // Actions
    const joinGame = () => {
        if (!username.value) return
        localStorage.setItem('belote_username', username.value)
        const userId = localStorage.getItem('belote_user_id')
        
        if (socket.value && socket.value.connected) {
             socket.value.emit('join-game', { username: username.value, userId })
             hasJoined.value = true
        } else {
             // Fallback if socket wasn't ready (though button is disabled usually?)
             // Force init if missing?
             if (!socket.value) initSocket()
        }
    }

    const startBots = () => socket.value?.emit('start-game-bots')
    const startGame = () => socket.value?.emit('start-game')
    
    const bid = (action: 'take' | 'pass', suit?: Suit) => {
        socket.value?.emit('player-bid', { action, suit })
    }
    
    const playCard = (card: Card) => {
        if (!isMyTurn.value) return
        const cardId = card.id || (card.rank + card.suit)
        socket.value?.emit('play-card', cardId)
    }

    // Animation Watcher
    const ANIMATION_DURATION = {
        SHRINK: 500,
        FLY: 700
    }

    watch(() => gameState.value.lastTrick, (newTrick) => {
        if (newTrick && newTrick.cards && newTrick.cards.length > 0) {
            const trickStr = JSON.stringify(newTrick)
            if (trickStr !== lastHandledTrick.value) {
                lastHandledTrick.value = trickStr
                animatingTrick.value = newTrick
                
                // Step 1: Initialize (Cards appear at table positions)
                animationPhase.value = 'idle' 
                
                setTimeout(() => {
                    // Step 2: Shrink (distinct action as requested)
                    animationPhase.value = 'gathering' // repurposing 'gathering' as 'shrink'
                    
                    setTimeout(() => {
                         // Step 3: Fly to winner
                        animationPhase.value = 'flying'
                        
                        setTimeout(() => {
                            // Step 4: Cleanup
                            animatingTrick.value = null
                            animationPhase.value = 'idle'
                        }, ANIMATION_DURATION.FLY)
                    }, ANIMATION_DURATION.SHRINK)
                }, 100)
            }
        }
    })

    return {
        socket,
        initSocket,
        gameState,
        username,
        hasJoined,
        myHand,
        animatingTrick,
        animationPhase,
        
        // Computed
        playerCount,
        myIndex,
        isMyTurn,
        isLobby,
        myTeamScore,
        otherTeamScore,
        myTeamCurrentScore,
        otherTeamCurrentScore,
        
        // Actions
        joinGame,
        startBots,
        startGame,
        bid,
        playCard,
        setReady: () => socket.value?.emit('player-ready'),
        resetGame: () => socket.value?.emit('reset-game')
    }
}
