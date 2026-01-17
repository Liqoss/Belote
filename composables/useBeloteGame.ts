import { ref, computed, watch } from 'vue'
import { io, type Socket } from 'socket.io-client'
import type { GameState, Card, Suit, Player, Announcement } from '~/types/belote'
import { useAuth } from '~/composables/useAuth'

export const useBeloteGame = () => {
    const socket = ref<Socket | null>(null)
    const gameState = ref<Partial<GameState>>({})
    const username = ref('')
    const hasJoined = ref(false)
    const myHand = ref<Card[]>([])
    const possibleAnnouncements = ref<Announcement[]>([])
    const { user } = useAuth()
    
    // Animation specific state
    const animatingTrick = ref<any>(null)
    const animationPhase = ref<'idle' | 'gathering' | 'flying'>('idle')
    const lastHandledTrick = ref<string>('')

    const initSocket = (roomId?: string | number) => {
        const guestId = localStorage.getItem('belote_user_id') || 'user_' + Math.random().toString(36).substr(2, 9)
        if (!localStorage.getItem('belote_user_id')) localStorage.setItem('belote_user_id', guestId)

        if (user.value) {
            username.value = user.value.username
        } else {
             const storedName = localStorage.getItem('belote_username')
             if (storedName) username.value = storedName
        }

        socket.value = io()
        
        socket.value.on('connect', () => {
            // Auto-join if Authenticated
            if (user.value && roomId) {
                console.log('Auto-joining as Authenticated User', user.value.username, 'to room', roomId)
                socket.value?.emit('join-room', { roomId, username: user.value.username, userId: user.value.id })
                hasJoined.value = true
            } 
            else if (username.value && roomId) {
                // Guest rejoin logic
                socket.value?.emit('join-room', { roomId, username: username.value, userId: guestId })
                hasJoined.value = true
            } else {
                // Lobby Mode or No specific room
                socket.value?.emit('get-rooms') 
            }
        })
        
        socket.value.on('game-update', (state: GameState) => {
            gameState.value = state
            
            // Sync myHand
            const effectiveId = user.value ? user.value.id : guestId
            
            if (state.hands && effectiveId && state.hands[effectiveId]) {
                myHand.value = state.hands[effectiveId]
            } else if ((state as any).myHand) {
                 myHand.value = (state as any).myHand
            }

            if ((state as any).possibleAnnouncements) {
                possibleAnnouncements.value = (state as any).possibleAnnouncements
            } else {
                possibleAnnouncements.value = []
            }
        })
    }

    // Computed
    const playerCount = computed(() => gameState.value.players ? gameState.value.players.length : 0)
    const isLobby = computed(() => gameState.value.phase === 'lobby')
    
    // Logic for my Index
    const myIndex = computed(() => {
        if (!gameState.value.players) return -1
        const targetId = user.value ? user.value.id : localStorage.getItem('belote_user_id')
        return gameState.value.players.findIndex(p => p.id === targetId)
    })

    const isMyTurn = computed(() => {
        return gameState.value.turnIndex === myIndex.value
    })

    const isAdmin = computed(() => {
        // Admin is Player 0
        return myIndex.value === 0 
        // OR better: Is Player 0 connected? If yes, he is admin. If no, is next one admin?
        // Let's stick to "First joined is Admin".
    })

    // Score Helpers
    const myTeamId = computed(() => {
        if (myIndex.value === -1) return 1 
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
    const joinGame = (roomId: string | number) => {
        // Guest Join
        if (!username.value || user.value) return 
        localStorage.setItem('belote_username', username.value)
        const userId = localStorage.getItem('belote_user_id')
        
        if (socket.value && socket.value.connected && roomId) {
             socket.value.emit('join-room', { roomId, username: username.value, userId })
             hasJoined.value = true
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
                
                // Step 1: Initialize (Cards locally at their table positions)
                animationPhase.value = 'idle' 
                
                setTimeout(() => {
                    // Step 2: GATHER (All cards move to center pile)
                    animationPhase.value = 'gathering'
                    
                    setTimeout(() => {
                         // Step 3: FLY TO WINNER (The center pile moves to winner)
                        animationPhase.value = 'flying'
                        
                        setTimeout(() => {
                            // Step 4: Cleanup
                            animatingTrick.value = null
                            animationPhase.value = 'idle'
                        }, 1500) // Slower flight (was 700) 
                    }, 600) // Time to gather
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
        isAdmin,
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

        declareAnnouncement: (decision: boolean) => socket.value?.emit('declare-announcement', decision),
        setReady: () => socket.value?.emit('player-ready'),
        // State
        possibleAnnouncements,
        resetGame: () => socket.value?.emit('reset-game'),
        leaveSeat: () => socket.value?.emit('leave-room')
    }
}
