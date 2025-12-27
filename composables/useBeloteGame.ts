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

        socket.value = io()
        
        socket.value.on('connect', () => {
            if (username.value) {
                socket.value?.emit('join-game', { username: username.value, userId })
                hasJoined.value = true
            }
        })
        
        socket.value.on('game-update', (state: GameState) => {
            gameState.value = state
            
            // Extract my hand (server usually sends everything but let's assume we filter or server sends 'myHand' separately property on state object which is not in GameState type?)
            // In the original code: `if (state.myHand) myHand.value = state.myHand`
            // But GameState type expects 'hands' record. 
            // The server `onUpdate` usually broadcasts to everyone? 
            // Actually server implementation sends `this` which includes everything.
            // But for security 'hands' should be filtered. 
            // Let's assume for this refactor we rely on what the server sends.
            // NOTE: We need to extend GameState type in frontend if we receive extra 'myHand' property 
            // OR we derive it from 'hands' if the server sends our hand in the record.
            
            // Let's check 'hands'
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

    // Actions
    const joinGame = () => {
        if (!username.value) return
        initSocket()
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
        
        // Actions
        joinGame,
        startBots,
        startGame,
        bid,
        playCard,
        setReady: () => socket.value?.emit('player-ready')
    }
}
