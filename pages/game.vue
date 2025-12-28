<template>
  <div class="page-container game-page">
    <ClientOnly>
      <!-- Login Modal -->
      <div v-if="!hasJoined" class="glass-panel login-modal">
        <h2>Entrez dans l'Arène</h2>
        <input 
          v-model="username" 
          placeholder="Votre Pseudo" 
          class="chill-input" 
          @keyup.enter="joinGame"
        />
        <button @click="joinGame" class="chill-btn small" :disabled="!username">
          Rejoindre
        </button>
      </div>


      <!-- Game Over Modal -->
      <!-- Game Over Modal -->
      <div v-if="gameState.phase === 'game_over'" class="modal-overlay">
          <div class="game-over-content glass-panel">
              <h2>PARTIE TERMINÉE</h2>
              <div class="winner-announcement">
                  <span v-if="gameState.scores.team1 > gameState.scores.team2">VICTOIRE ! 🏆</span>
                  <span v-else>DÉFAITE... 💀</span>
              </div>
              <div class="scores-summary">
                 <div class="team-score">
                     <span>Nous</span>
                     <span class="score-value">{{ gameState.scores?.team1 }}</span>
                 </div>
                 <div class="vs">VS</div>
                 <div class="team-score">
                     <span>Eux</span>
                     <span class="score-value">{{ gameState.scores?.team2 }}</span>
                 </div>
              </div>
              <button @click="resetGame" class="chill-btn large-btn">Retour au Lobby</button>
          </div>
      </div>

      <!-- Last Trick Modal -->
      <div v-if="showLastTrickModal && gameState.lastTrick" class="modal-overlay" @click.self="showLastTrickModal = false">
         <div class="modal-content mobile-first">
             <h3>Dernier Pli</h3>
             <div class="trick-history-list">
                 <div v-for="play in gameState.lastTrick.cards" :key="play.playerId" class="history-item">
                     <div class="player-info">
                         <span class="avatar-small">{{ getAvatar(play.playerId) }}</span>
                         <span class="name">{{ getName(play.playerId) }}</span>
                     </div>
                     <span v-if="play.playerId === gameState.lastTrick.winnerId" class="winner-trophy">🏆</span>
                     <PlayingCard 
                         :rank="play.card.rank" 
                         :suit="play.card.suit"
                         class="mini-card"
                     />
                 </div>
             </div>
             <button @click="showLastTrickModal = false" class="chill-btn small">Fermer</button>
         </div>
      </div>

      <!-- Game Board -->
      <div v-else class="game-board">
        <div class="status-bar">
          <div class="left-stats">
            <span>Joueurs : {{ playerCount }}/4</span>
            <button v-if="gameState.phase === 'lobby'" @click="startBots" class="action-btn">
              Lancer la partie
            </button>
          </div>
          
          <div class="scores" v-if="gameState.phase === 'playing'">
             <span class="team-score">Nous: {{ gameState.scores?.team1 }} (+{{ gameState.currentScores?.team1 }})</span>
             <span class="divider">/</span>
             <span class="team-score">Eux: {{ gameState.scores?.team2 }} (+{{ gameState.currentScores?.team2 }})</span>
          </div>
          
          <NuxtLink to="/" class="action-btn icon-only" title="Retour Accueil">🏠</NuxtLink>
        </div>

        <div class="board-layout">
           <!-- ME Trump Indicator (Top Right absolute) -->
           <!-- GLOBAL Trump Indicator (Top Right absolute) -->
           <div v-if="gameState.trumpSuit" 
                class="taker-trump-indicator global-trump"
                style="position: fixed; top: 4rem; left: 10px; z-index: 100; margin: 0;"
                :class="{ 'red-suit': isRedSuit(gameState.trumpSuit), 'black-suit': !isRedSuit(gameState.trumpSuit) }">
               {{ getSuitIcon(gameState.trumpSuit) }}
           </div>
           
           <!-- TOP PLAYER (Partner) -->
           <div class="player-slot top" :class="{ active: isTurn(playerIndex(2)) }">
              <div class="avatar-circle">
                 {{ getAvatar(playerIndex(2)) }}
              </div>
              <span class="player-name">{{ getName(playerIndex(2)) }}</span>
              <div v-if="getBiddingStatus(playerIndex(2))" class="bidding-status-text">
                  {{ getBiddingStatus(playerIndex(2)) }}
              </div>
               <!-- Removed taker-trump-indicator as requested -->
           </div>

           <!-- MIDDLE ROW (Left/Table/Right) -->
           <div class="middle-row">
              <!-- Left Player -->
              <div class="player-slot left" :class="{ active: isTurn(playerIndex(1)) }">
                <div class="avatar-circle small">{{ getAvatar(playerIndex(1)) }}</div>
                <span class="player-name">{{ getName(playerIndex(1)) }}</span>
                <div v-if="getBiddingStatus(playerIndex(1))" class="bidding-status-text">
                    {{ getBiddingStatus(playerIndex(1)) }}
                </div>
              </div>

              <!-- CENTER TABLE -->
                 <div class="dealing-animation" v-if="gameState.phase === 'dealing'">
                     <div class="deck-stack">
                        <div v-for="n in 5" :key="n" class="card-back" :style="{ top: -n + 'px', left: -n + 'px' }"></div>
                     </div>
                     <div class="dealing-text">Distribution...</div>
                  </div>

                 <div class="card-carpet" v-else>
                     <!-- PLAYING PHASE -->
                     <div class="trick-area" v-if="gameState.phase === 'playing' && gameState.currentTrick">
                        <div 
                            v-for="(play, index) in gameState.currentTrick" 
                            :key="play.playerId"
                            class="trick-card"
                            :class="getPositionClass(play.playerId)"
                            :style="{ zIndex: index + 1 }"
                        >
                           <PlayingCard 
                             :rank="play.card.rank" 
                             :suit="play.card.suit" 
                           />
                        </div>
                     </div>

                       <button 
                           v-if="gameState.lastTrick && gameState.phase === 'playing'" 
                           class="chill-btn small ghost-btn" 
                           @click="showLastTrickModal = !showLastTrickModal" 
                           style="position: fixed; top: 4rem; right: 8px; z-index: 100; font-size: 0.8rem; padding: 4px 10px; margin: 0;"
                       >
                          Dernier pli
                       </button>

                     <!-- BIDDING PHASE -->
                     <div class="bidding-area" v-if="gameState.phase === 'bidding' && gameState.turnedCard">
                         <p class="bidding-title">Tour de parole</p>
                         <div class="turned-card-display">
                              <PlayingCard 
                                  :rank="gameState.turnedCard.rank" 
                                  :suit="gameState.turnedCard.suit"
                                  class="center-turned"
                              />
                          </div>
                          
                          <!-- MY CONTROLS -->
                          <div v-if="isTurn(myIndex) && !localBidMade" class="bidding-controls">
                              <div v-if="gameState.biddingRound === 1" class="round-actions">
                                  <button @click="handleBid('take')" class="chill-btn small">Prendre</button>
                                  <button @click="handleBid('pass')" class="chill-btn small secondary">Passer</button>
                              </div>
                              <div v-else class="round-actions">
                                  <p>Choisir une couleur :</p>
                                  <div class="color-picker">
                                      <button v-for="suit in suits" :key="suit" 
                                         @click="handleBid('take', suit)"
                                         class="suit-btn" 
                                         :class="{ 'red-suit': isRedSuit(suit), 'black-suit': !isRedSuit(suit) }"
                                         :disabled="suit === gameState.turnedCard?.suit">
                                          {{ getSuitIcon(suit) }}
                                      </button>
                                  </div>
                                  <button @click="bid('pass')" class="chill-btn small secondary">Passer</button>
                              </div>
                          </div>
                          <div v-else class="waiting-text">
                              {{ getName(gameState.turnIndex || -1) }} réfléchit...
                          </div>
                     </div>

                     <div v-else class="carpet-center">
                        <span class="placeholder-text">
                            <template v-if="gameState.phase === 'playing'"></template>
                            <template v-else>
                                En attente<span class="loading-dots"></span>
                            </template>
                        </span>
                     </div>
                 </div>

              <!-- Right Player -->
              <div class="player-slot right" :class="{ active: isTurn(playerIndex(3)) }">
                 <div class="avatar-circle small">{{ getAvatar(playerIndex(3)) }}</div>
                 <span class="player-name">{{ getName(playerIndex(3)) }}</span>
                 <div v-if="getBiddingStatus(playerIndex(3))" class="bidding-status-text">
                     {{ getBiddingStatus(playerIndex(3)) }}
                 </div>
              </div>
           </div>

           <!-- BOTTOM PLAYER (Me) -->
           <div class="player-slot bottom" :class="{ active: isTurn(myIndex) }">
               <div v-if="isTurn(myIndex) && gameState.phase === 'playing'" class="my-turn-badge">⚡ À VOUS DE JOUER ! ⚡</div>
               <TransitionGroup 
                 name="hand-card" 
                 tag="div" 
                 class="my-hand"
               >
                  <div 
                    v-for="(card, index) in myHand" 
                    :key="card.id"
                    class="hand-card-wrapper"
                    :style="{
                        marginRight: (index === myHand.length - 1) ? '0px' : (dynamicMargin + 'px')
                    }"
                    @click="tryPlayCard(card)"
                  >
                      <PlayingCard 
                        :rank="card.rank" 
                        :suit="card.suit" 
                        :is-playable="isCardPlayable(card) && isTurn(myIndex) && gameState.phase === 'playing'"
                        :clickable="true"
                        :disabled="false"
                        class="hand-card"
                      />
                  </div>
               </TransitionGroup>
               <span class="player-name me">{{ username }} (Moi)</span>
               <div v-if="getBiddingStatus(myIndex)" class="bidding-status-text me-status">
                   {{ getBiddingStatus(myIndex) }}
               </div>
                <!-- Removed taker-trump-indicator as requested -->
            </div>
         </div>
       </div>
    </ClientOnly>
    
      <!-- ROUND SUMMARY MODAL -->
      <div class="login-modal-overlay" v-if="gameState.phase === 'round_summary'" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:200;">
         <div class="login-modal" style="background: rgba(40,40,60,0.95); padding: 2rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2); width: 300px; text-align: center;">
             <h2>Fin de la Manche</h2>
             <div class="scores-summary" style="margin: 1rem 0;">
                 <p style="color: var(--primary-color); font-size: 1.2rem; margin: 5px 0;">Nous: {{ gameState.scores?.team1 }}</p>
                 <p style="color: #ef4444; font-size: 1.2rem; margin: 5px 0;">Eux: {{ gameState.scores?.team2 }}</p>
             </div>
             
             <div class="ready-status" style="margin-bottom: 20px;">
                 <p>{{ readyCount }} / {{ humanCount }} joueurs prêts</p>
             </div>

             <button @click="setReady" class="chill-btn" :disabled="hasClickedReady" :class="{ 'secondary': hasClickedReady }" style="width: 100%;">
                 {{ hasClickedReady ? 'En attente...' : 'PRÊT !' }}
             </button>
         </div>
      </div>

     <!-- GLOBAL ANIMATION LAYER -->
     <div class="global-animation-layer" v-if="animatingTrick">
        <div 
            v-for="play in animatingTrick.cards" 
            :key="'anim-'+play.playerId"
            class="trick-card animating"
            :class="[
                getPositionClass(play.playerId), 
                animationPhase === 'gathering' ? 'phase-gathering' : '',
                animationPhase === 'flying' ? 'phase-flying fly-to-' + getPositionClass(animatingTrick.winnerId) : ''
            ]"
            :style="getFlyingStyle(play.playerId, animatingTrick.winnerId)"
        >
           <PlayingCard 
             :rank="play.card.rank" 
             :suit="play.card.suit" 
           />
        </div>
     </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useBeloteGame } from '~/composables/useBeloteGame'
import PlayingCard from '~/components/PlayingCard.vue'
import type { Card, Suit } from '~/types/belote'

const suits: Suit[] = ['H', 'D', 'C', 'S']

// Use the new composable
const { 
    gameState, 
    username, 
    hasJoined, 
    myHand, 
    playerCount, 
    myIndex, 
    joinGame, 
    startBots, 
    startGame, 
    bid, 
    playCard: gamePlayCard,
    animatingTrick,
    animationPhase,
    setReady,
    resetGame
} = useBeloteGame()

const humanCount = computed(() => {
    if (!gameState.value.players) return 0
    return gameState.value.players.filter((p: any) => !p.isBot).length
})

const readyCount = computed(() => {
    return gameState.value.readyPlayers ?  gameState.value.readyPlayers.length : 0
})

const hasClickedReady = computed(() => {
    const userId = localStorage.getItem('belote_user_id')
    return gameState.value.readyPlayers?.includes(userId || '')
})

// --- IMMEDIATE BIDDING FEEDBACK ---
const localBidMade = ref(false)

const handleBid = (action: 'take' | 'pass', suit?: Suit) => {
    localBidMade.value = true
    bid(action, suit)
}

// Reset local bid state when turn changes or phase changes
watch(() => gameState.value.turnIndex, () => {
    // If turn changes (to someone else or back to me later), reset lock
    localBidMade.value = false
})

const showLastTrickModal = ref(false)

// VIEW HELPERS

const playerIndex = (offset: number) => {
    if (myIndex.value === -1) return -1
    return (myIndex.value + offset) % 4
}

const isTurn = (index: number) => {
    if (!gameState.value.players) return false
    return gameState.value.turnIndex === index
}

const getName = (identifier: number | string) => {
    if (!gameState.value.players) return 'Attente...'
    
    let p: any = null
    if (typeof identifier === 'number') {
        if (identifier === -1) return '...'
        p = gameState.value.players[identifier]
    } else {
        p = gameState.value.players.find((player: any) => player.id === identifier)
    }
    
    return p ? p.username : 'Inconnu'
}

const getAvatar = (identifier: number | string) => {
    const name = getName(identifier)
    return name && name !== 'Wait...' && name !== 'Inconnu' && name !== '...' ? name.substring(0, 2).toUpperCase() : '?'
}



const isRedSuit = (suit: string | null | undefined) => ['H', 'D'].includes(suit || '')

const getSuitIcon = (suit: string | null | undefined) => {
    switch(suit) {
        case 'H': return '♥'
        case 'D': return '♦'
        case 'C': return '♣'
        case 'S': return '♠'
        default: return '?'
    }
}

// Helper for Animation Styles (Fly to Winner)
const getFlyingStyle = (cardOwnerId: string, winnerId: string) => {
    if (animationPhase.value !== 'flying') return {}
    
    // We rely on CSS classes for positions, but we could add dynamic offsets if needed.
    // The CSS .fly-to-pos-X will handle the translation.
    return {}
}

const getPositionClass = (playerId: string) => {
    if (!gameState.value.players) return ''
    const pIndex = gameState.value.players.findIndex((p) => p.id === playerId)
    if (pIndex === -1) return ''
    
    // Relative position calculation
    const rel = (pIndex - myIndex.value + 4) % 4
    
    // If we are animating globally, use standard Top/Left coordinates to avoid transition glitches
    if (animatingTrick.value) {
        if (rel === 0) return 'anim-pos-bottom'
        if (rel === 1) return 'anim-pos-left'
        if (rel === 2) return 'anim-pos-top'
        return 'anim-pos-right'
    }

    if (rel === 0) return 'pos-bottom'
    if (rel === 1) return 'pos-left'
    if (rel === 2) return 'pos-top'
    return 'pos-right' 
}

const getBiddingStatus = (pIdx: number) => {
    if (!gameState.value.biddingHistory) return null
    if (pIdx === -1) return null
    if (!gameState.value.players || !gameState.value.players[pIdx]) return null
    
    const pId = gameState.value.players[pIdx].id
    // Find LAST action for this player
    for (let i = gameState.value.biddingHistory.length - 1; i >= 0; i--) {
        const h = gameState.value.biddingHistory[i]
        if (h.playerId === pId) {
            if (h.action === 'pass') return 'Passe'
            if (h.action === 'take') {
                const suit = h.suit || (gameState.value.turnedCard ? gameState.value.turnedCard.suit : null)
                return `Pris (${suit ? getSuitIcon(suit) : '?'})`
            }
        }
    }
    return null
}

// Hand Sorting
const sortedHand = computed(() => {
    if (!myHand.value) return []
    const suitOrder = { 'H': 0, 'C': 1, 'D': 2, 'S': 3 }
    const rankOrder = { '7': 0, '8': 1, '9': 2, '10': 3, 'J': 4, 'Q': 5, 'K': 6, 'A': 7 }
    
    return [...myHand.value].sort((a, b) => {
        if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit]
        return rankOrder[a.rank] - rankOrder[b.rank]
    })
})

const isCardPlayable = (card: Card) => {
    if (!isTurn(myIndex.value)) return false
    if (!gameState.value.currentTrick || gameState.value.currentTrick.length === 0) return true
    
    const firstPlay = gameState.value.currentTrick[0]
    const ledSuit = firstPlay.card.suit
    const hasSuit = myHand.value.some(c => c.suit === ledSuit)
    
    if (hasSuit) {
        // If I have the suit, I MUST play it.
        // So this card is playable only if it matches the suit.
        return card.suit === ledSuit;
    }
    // Simplified Belote rules (no mandatory trumping yet for MVP)
    // If I don't have the suit, I can play anything.
    return true
}

const tryPlayCard = (card: Card) => {
    console.log('[DEBUG] Clicked Card:', card.id);
    console.log('[DEBUG] My Index:', myIndex.value, 'Turn Index:', gameState.value.turnIndex);
    console.log('[DEBUG] Is My Turn?', isTurn(myIndex.value));
    
    if (!isTurn(myIndex.value)) {
        console.warn('[DEBUG] Not my turn!');
        return;
    }
    
    const playable = isCardPlayable(card);
    console.log('[DEBUG] Is Playable?', playable);
    
    if (playable) {
        gamePlayCard(card);
    } else {
        console.warn('[DEBUG] Card blocked by rules (Suit mismatch?)');
    }
}

const playCard = (card: Card) => {
    gamePlayCard(card)
}

// --- DYNAMIC CARD OVERLAP ---
const windowWidth = ref(1000)

const updateWidth = () => {
    if (typeof window !== 'undefined') {
        windowWidth.value = window.innerWidth
    }
}

onMounted(() => {
    updateWidth()
    window.addEventListener('resize', updateWidth)
})

onUnmounted(() => {
    if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateWidth)
    }
})

const dynamicMargin = computed(() => {
    const handSize = myHand.value.length
    if (handSize <= 1) return 0
    
    // Config: Card width ~100px normally.
    // Available width = Screen width - Padding (e.g. 20px on each side)
    const availableWidth = Math.min(600, windowWidth.value - 40) 
    // We cap at 600px for the hand area to keep it centered nice
    
    const cardWidth = 90 // Approximate visible width of a card
    const totalRequired = handSize * cardWidth
    
    if (totalRequired <= availableWidth) {
        return -30 // Default overlap if we have space
    }
    
    // Calculate overlap needed to squeeze into availableWidth
    // (n-1) * (cardWidth + overlap) + cardWidth = availableWidth
    // (n-1) * overlap = availableWidth - n * cardWidth
    // overlap = (availableWidth - n * cardWidth) / (n - 1)
    
    // Actually simpler: 
    // We want the total span to be availWidth.
    // Span = cardWidth + (n-1) * (visiblePart)
    // visiblePart = cardWidth + margin
    // margin = visiblePart - cardWidth
    
    // margin = (availableWidth - cardWidth) / (handSize - 1) - cardWidth
    
    const margin = (availableWidth - cardWidth) / (handSize - 1) - cardWidth
    return Math.min(-30, margin) // Never spread more than -30, but compress if needed
})
</script>

<style scoped lang="scss">
/* Global reset for mobile scroll interaction */
:global(html), :global(body) {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden !important;
  overscroll-behavior: none;
}

.game-page {
  padding: 0;
  width: 100%;
  height: 100vh; /* Fallback */
  height: 100dvh; /* Dynamic Viewport Height for mobile */
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
}

.login-modal {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  z-index: 50;
  position: absolute;
}

.chill-input {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 0.8rem;
  border-radius: 8px;
}

.game-board {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.status-bar {
  padding: 0.5rem;
  background: rgba(0,0,0,0.4);
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--text-main);
  backdrop-filter: blur(5px);
}

.left-stats {
  display: flex;
  align-items: center;
  font-size: 0.9rem;
}

.action-btn {
    background: var(--primary-color);
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    cursor: pointer;
    font-weight: bold;
    margin-left: 1rem;
}

.scores {
    font-weight: bold;
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

/* Board Layout */
.board-layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.25rem;
  position: relative;
}

.player-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: opacity 0.3s;
  position: relative;
  
  &.active .avatar-circle {
    box-shadow: 0 0 15px 5px #ffd700;
    transform: scale(1.1);
    border: 2px solid #ffd700;
  }
}

.taker-trump-indicator {
    font-size: 1.5rem;
    background: white;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
    margin-top: -10px;
    z-index: 20;
    
    &.red-suit { color: #d32f2f; }
    &.black-suit { color: #212121; }
}

.player-name {
    color: white;
    font-weight: bold;
    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
    background: rgba(0,0,0,0.3);
    padding: 2px 8px;
    border-radius: 12px;
    margin-top: 5px;
    font-size: 0.75rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 50px;
}

.avatar-circle {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #334155, #1e293b);
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: white;
}

.middle-row {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-carpet {
  flex: 1;
  background: var(--carpet-green);
  border-radius: 40px;
  margin: 0 0.5rem;
  height: 90%;
  box-shadow: inset 0 0 40px rgba(0,0,0,0.6);
  border: 8px solid #5d4037;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* --- HAND ANIMATIONS (SORTING/DEALING) --- */
.hand-card-move,
.hand-card-enter-active,
.hand-card-leave-active {
  transition: all 0.5s ease;
}

.hand-card-enter-from,
.hand-card-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.hand-card-leave-active {
  position: absolute; /* Ensures smooth sorting when items leave */
}

/* Ensure TransitionGroup container behaves like the old flexbox */
.my-hand {
    display: flex;
    justify-content: center;
    width: 100%;
    /* Remove gap, handle overlap via margin on items */
}

.hand-card-wrapper {
    /* Margin handled dynamically by JS style */
    transition: transform 0.2s, margin-right 0.3s; 
}

.hand-card-wrapper:last-child {
    /* Margin 0 handled by JS logic too for safety/consistency */
}

.hand-card-wrapper:hover {
    z-index: 10;
    transform: translateY(-10px);
}

@media (max-width: 600px) {
    /* We keep the scale reduction but margin is now dynamic JS */
    .my-hand {
        transform: scale(0.9); 
        transform-origin: bottom center;
    }
}

/* Trick Display */
.trick-area {
    position: relative;
    width: 200px;
    height: 200px;
}


.trick-card {
    position: absolute;
    /* Default transition for dealing */
    transition: transform 0.3s ease-out;

    &.animating {
      /* Base state for animation layer */
      z-index: 100 !important;
    }
}

.pos-bottom { bottom: -70px; left: 50%; transform: translateX(-50%); z-index: 10; }
.pos-top { top: -70px; left: 50%; transform: translateX(-50%); z-index: 1; }
.pos-left { left: 0; top: 50%; transform: translateY(-50%) rotate(-45deg); z-index: 2; }
.pos-right { right: 0; top: 50%; transform: translateY(-50%) rotate(45deg); z-index: 3; }

.my-hand {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  height: 140px;
  margin-bottom: -20px;
  width: 100%;
}

.hand-card {
    margin-left: -50px;
    transition: margin-bottom 0.2s;
    
    &:first-child { margin-left: 0; }
}

/* Bidding UI */
.bidding-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    z-index: 100;
    position: relative;
}

.bidding-title {
    color: white;
    font-size: 1.2rem;
    margin: 0;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.bidding-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    background: rgba(0,0,0,0.8);
    padding: 1rem;
    border-radius: 12px;
    z-index: 9999;
    pointer-events: auto;
    
    position: absolute;
    top: 140%;
    left: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 20px rgba(0,0,0,0.5);
}

.round-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
}

.chill-btn.secondary {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.3);
    font-size: 1.2rem;
    padding: 0.5rem 1rem;
    
    &:hover { background: rgba(255,255,255,0.1); }
}

.chill-btn.ghost-btn {
    background: transparent;
    border: 1px solid white;
    color: white;
    backdrop-filter: blur(4px);
    transition: all 0.2s;
    
    &:hover { background: rgba(255,255,255,0.1); transform: scale(1.05); }
}

.color-picker {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.suit-btn {
    font-size: 1.5rem;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    
    &.red-suit { color: #d32f2f; }
    &.black-suit { color: #212121; }
    
    &:disabled { opacity: 0.3; cursor: not-allowed; }
    &:hover:not(:disabled) { transform: scale(1.1); }
}

.dealing-animation {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 50; 
}

.deck-stack {
    position: relative;
    width: 60px;
    height: 90px;
    margin-bottom: 2rem;
}

.card-back {
    position: absolute;
    top: 0;
    left: 0;
    width: 60px;
    height: 90px;
    background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%);
    border: 2px solid #fff;
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0, rgba(255,255,255,0.1) 2px, transparent 2px, transparent 4px);
}

.dealing-text {
    position: absolute;
    bottom: -30px;
    color: white;
    font-style: italic;
    animation: pulse 1s infinite;
    white-space: nowrap;
}

.toggle-scores-btn {
    margin-top: 5px;
    font-size: 0.8rem;
    opacity: 0.8;
}

@keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
}

/* Global Animation Layer */
.global-animation-layer {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: hidden;
    z-index: 999;
    /* Removed flex to avoid layout interference with absolute children */
}


.review-controls-top-left {
    position: absolute;
    top: -100px;
    left: -60px;
    z-index: 50;
}
.icon-only {
    font-size: 1.5rem;
    padding: 0;
    margin-left: 0;
    background: transparent;
    &:hover { background: rgba(255,255,255,0.1); }
}
.icon-btn {
    background: rgba(255,255,255,0.2);
    border: 1px solid white;
    color: white;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    &:hover { background: rgba(255,255,255,0.4); }
}

.trick-review {
    width: 500px !important;
    .mini-trick {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin: 2rem 0;
        .playing-card { transform: scale(0.8); margin: 0; }
    }
}
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 99999; 
    backdrop-filter: blur(5px);
}

.modal-content.mobile-first {
    background: #1e293b;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 16px;
    padding: 1.5rem;
    width: 90%;
    max-width: 400px;
    max-height: 80vh; /* Limit height */
    overflow-y: auto; /* Allow Scroll */
    color: white;
    text-align: center;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    
    h3 { margin-top: 0; color: #ffd700; margin-bottom: 1rem; }
}

.trick-history-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
}

.history-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255,255,255,0.05);
    padding: 0.5rem;
    border-radius: 8px;
    
    .player-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100px;
        text-align: left;
        
        .avatar-small { font-size: 1.2rem; }
        .name { font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    }
    
    .mini-card { 
        transform: scale(0.6); 
        transform-origin: center;
        margin: 0;
    }
    
    .winner-trophy { font-size: 1.2rem; }
}

/* Animation Fixes */
.trick-card.animating {
  transition: all 1s ease-in-out;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.fly-to-anim-pos-bottom {
  transform: translate(-50%, 40vh) scale(0.5) !important;
  opacity: 0;
}
.fly-to-anim-pos-top {
   transform: translate(-50%, -40vh) scale(0.5) !important;
   opacity: 0;
}
.fly-to-anim-pos-left {
   transform: translate(-45vw, -50%) scale(0.5) !important;
   opacity: 0;
}
.fly-to-anim-pos-right {
   transform: translate(45vw, -50%) scale(0.5) !important;
   opacity: 0;
}

.game-over-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    padding: 3rem;
    border-radius: 20px;
    background: rgba(30, 41, 59, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 0 50px rgba(0, 0, 0, 0.8);
    text-align: center;
    min-width: 320px;
    animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes popIn {
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1); }
}

.winner-announcement {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 2.5rem;
    font-weight: 800;
    color: #ffd700;
    margin-bottom: 2rem;
    text-shadow: 0 4px 10px rgba(255, 215, 0, 0.3);
}

.scores-summary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3rem;
    margin-bottom: 2.5rem;
    background: rgba(0,0,0,0.3);
    padding: 1.5rem 2rem;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.05);
}

.team-score {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
}

.team-score span:first-child {
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 2px;
    opacity: 0.8;
}

.score-value {
    font-size: 2.5rem;
    font-weight: bold;
    font-family: monospace;
}

.vs {
    font-size: 1.2rem;
    font-weight: bold;
    opacity: 0.5;
    font-style: italic;
}

.chill-btn.large-btn {
    font-size: 1.2rem;
    padding: 1rem 2.5rem;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}
</style>
