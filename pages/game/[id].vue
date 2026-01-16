<template>
<div class="game-page">
    <ClientOnly>
      <!-- Game Over Modal -->
      <div v-if="gameState.phase === 'game_over' && !animatingTrick" class="modal-overlay">
          <div class="game-over-content glass-panel">
              <h2>PARTIE TERMINÉE</h2>
              <div class="winner-announcement">
                  <span v-if="myTeamScore > otherTeamScore">VICTOIRE ! 🏆</span>
                  <span v-else>DÉFAITE... 💀</span>
              </div>
              <div class="scores-summary">
                  <div class="team-score">
                      <span>Nous</span>
                      <span class="score-value">{{ myTeamScore }}</span>
                  </div>
                  <div class="vs">VS</div>
                  <div class="team-score">
                      <span>Eux</span>
                      <span class="score-value">{{ otherTeamScore }}</span>
                  </div>
              </div>
              <button @click="resetGame" class="chill-btn large-btn">Retour au Salon</button>
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

      <!-- PRELOADER (Hidden) -->
     <div style="display: none;">
         <img src="/cards/jack_hearts.svg" />
         <img src="/cards/jack_diamonds.svg" />
         <img src="/cards/jack_clubs.svg" />
         <img src="/cards/jack_spades.svg" />
         <img src="/cards/queen_hearts.svg" />
         <img src="/cards/queen_diamonds.svg" />
         <img src="/cards/queen_clubs.svg" />
         <img src="/cards/queen_spades.svg" />
         <img src="/cards/king_hearts.svg" />
         <img src="/cards/king_diamonds.svg" />
         <img src="/cards/king_clubs.svg" />
         <img src="/cards/king_spades.svg" />
     </div>

      <!-- Game Board -->
      <div class="game-board">
        <div class="status-bar">
          <div class="header-left-group">
              <div class="room-pill">
                <span>Salle #{{ roomId }}</span>
              </div>
              
              <div class="header-actions">
                  <button v-if="gameState.phase === 'lobby' && playerCount < 4" @click="startBots" class="action-btn">
                     Ajouter Bots
                  </button>
                  <button v-if="gameState.phase === 'lobby' && playerCount === 4" @click="startGame" class="action-btn">
                     Lancer la partie
                  </button>
              </div>
          </div>
          
          <div class="scores" v-if="gameState.phase === 'playing'">
             <span class="team-score">Nous: {{ myTeamScore }} (+{{ myTeamCurrentScore }})</span>
             <span class="divider">/</span>
             <span class="team-score">Eux: {{ otherTeamScore }} (+{{ otherTeamCurrentScore }})</span>
          </div>
          
          <!-- BURGER MENU BUTTON -->
          <button class="burger-btn" @click="toggleMenu">
             <span class="burger-icon">☰</span>
          </button>
        </div>

        <!-- MENU OVERLAY -->
        <div v-if="isMenuOpen" class="modal-overlay menu-overlay" @click.self="toggleMenu">
            <div class="glass-panel menu-modal">
                <h3>Menu</h3>
                
                <button v-if="isAdmin && gameState.phase !== 'lobby'" @click="resetGame(); toggleMenu()" class="chill-btn danger-btn full-width">
                    Redémarrez la partie
                </button>
                
                <button @click="leaveGame" class="chill-btn secondary full-width">
                    Quitter la partie
                </button>
                
                <button @click="toggleMenu" class="chill-btn small ghost-btn" style="margin-top: 1rem;">
                    Fermer
                </button>
            </div>
        </div>

        <div class="board-layout">
           <!-- GLOBAL Trump Indicator -->
           <div v-if="gameState.trumpSuit" 
                class="taker-trump-indicator global-trump"
                style="position: fixed; top: 4rem; left: 10px; z-index: 100; margin: 0;"
                :class="{ 'red-suit': isRedSuit(gameState.trumpSuit), 'black-suit': !isRedSuit(gameState.trumpSuit) }">
               {{ getSuitIcon(gameState.trumpSuit) }}
           </div>
           
            <!-- TOP PLAYER (Partner) -->
           <div class="player-slot top" :class="{ active: isTurn(playerIndex(2)) }">
              <div class="avatar-circle">
                 <img v-if="getAvatarUrl(playerIndex(2))" :src="getAvatarUrl(playerIndex(2))" class="avatar-img" />
                 <span v-else>{{ getAvatar(playerIndex(2)) }}</span>
              </div>
              <span class="player-name">{{ getName(playerIndex(2)) }}</span>
              <div v-if="getBiddingStatus(playerIndex(2))" class="bidding-status-text">
                  {{ getBiddingStatus(playerIndex(2)) }}
              </div>
           </div>

           <!-- MIDDLE ROW (Left/Table/Right) -->
           <div class="middle-row">
              <!-- Left Player -->
              <div class="player-slot left" :class="{ active: isTurn(playerIndex(1)) }">
                <div class="avatar-circle small">
                     <img v-if="getAvatarUrl(playerIndex(1))" :src="getAvatarUrl(playerIndex(1))" class="avatar-img" />
                     <span v-else>{{ getAvatar(playerIndex(1)) }}</span>
                </div>
                <span class="player-name">{{ getName(playerIndex(1)) }}</span>
                <div v-if="getBiddingStatus(playerIndex(1))" class="bidding-status-text">
                    {{ getBiddingStatus(playerIndex(1)) }}
                </div>
              </div>

              <!-- CENTER TABLE -->
                  <div class="card-carpet">
                     
                     <!-- CENTER CONTENT AREA -->
                     
                     <!-- 1. DEALING ANIMATION -->
                     <div class="dealing-animation" v-if="gameState.phase === 'dealing'">
                         <div class="dealing-text">Distribution...</div>
                      </div>

                     <!-- 2. TRICK AREA (Playing) -->
                      <div class="trick-area" v-else-if="gameState.phase === 'playing' && gameState.currentTrick">
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

                      <!-- 3. BIDDING AREA -->
                      <div class="bidding-area" v-else-if="gameState.phase === 'bidding' && gameState.turnedCard">
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
                               {{ getName(gameState.turnIndex ?? -1) }} réfléchit...
                           </div>
                      </div>

                      <!-- 4. WAITING / FALLBACK -->
                      <div v-else class="carpet-center">
                         <span class="placeholder-text">
                             <template v-if="gameState.phase === 'bidding'">
                                 Distribution<span class="loading-dots"></span>
                             </template>
                             <template v-else-if="gameState.phase === 'lobby'">
                                 En attente<span class="loading-dots"></span>
                             </template>
                             <template v-else></template>
                         </span>
                      </div>
                  </div>

              <!-- Right Player -->
              <div class="player-slot right" :class="{ active: isTurn(playerIndex(3)) }">
                 <div class="avatar-circle small">
                      <img v-if="getAvatarUrl(playerIndex(3))" :src="getAvatarUrl(playerIndex(3))" class="avatar-img" />
                      <span v-else>{{ getAvatar(playerIndex(3)) }}</span>
                 </div>
                 <span class="player-name">{{ getName(playerIndex(3)) }}</span>
                 <div v-if="getBiddingStatus(playerIndex(3))" class="bidding-status-text">
                     {{ getBiddingStatus(playerIndex(3)) }}
                 </div>
              </div>
           </div>

           <!-- BOTTOM PLAYER (Me) -->
           <div class="player-slot bottom" :class="{ active: isTurn(myIndex) }">
               <div v-if="isTurn(myIndex) && gameState.phase === 'playing'" class="my-turn-badge">À VOUS DE JOUER !</div>
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
            </div>
         </div>
       </div>
    </ClientOnly>
    
      <!-- ROUND SUMMARY MODAL -->
      <div class="login-modal-overlay" v-if="gameState.phase === 'round_summary' && !animatingTrick" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:200;">
         <div class="login-modal" style="background: rgba(40,40,60,0.95); padding: 2rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2); width: 300px; text-align: center;">
             <h2>Fin de la Manche</h2>
             <div class="scores-summary" style="margin: 1rem 0;">
                 <p style="color: var(--primary-color); font-size: 1.2rem; margin: 5px 0;">Nous: {{ myTeamScore }}</p>
                 <p style="color: #ef4444; font-size: 1.2rem; margin: 5px 0;">Eux: {{ otherTeamScore }}</p>
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
        <div class="animation-stage">
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

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useBeloteGame } from '~/composables/useBeloteGame'
import PlayingCard from '~/components/PlayingCard.vue'
import type { Card, Suit } from '~/types/belote'

const suits: Suit[] = ['H', 'D', 'C', 'S']
const route = useRoute()
const roomId = route.params.id

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
    resetGame,
    initSocket,
    myTeamScore,
    otherTeamScore,
    myTeamCurrentScore,
    otherTeamCurrentScore,
    isAdmin,
    leaveSeat
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

// --- BURGER MENU LOGIC ---
const isMenuOpen = ref(false)
const toggleMenu = () => isMenuOpen.value = !isMenuOpen.value

const leaveGame = () => {
    leaveSeat() // Emit leave-room to backend
    navigateTo('/')
}

// --- IMMEDIATE BIDDING FEEDBACK ---
const localBidMade = ref(false)

const handleBid = (action: 'take' | 'pass', suit?: Suit) => {
    localBidMade.value = true
    bid(action, suit)
}

// Reset local bid state when turn changes or phase changes
watch(() => gameState.value.turnIndex, () => {
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

const getAvatarUrl = (identifier: number | string) => {
    if (!gameState.value.players) return null
    let p: any = null
    if (typeof identifier === 'number') {
        if (identifier === -1) return null
        p = gameState.value.players[identifier]
    } else {
        p = gameState.value.players.find((player: any) => player.id === identifier)
    }
    return p ? p.avatar : null
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
    return {}
}

const getPositionClass = (playerId: string) => {
    if (!gameState.value.players) return ''
    const pIndex = gameState.value.players.findIndex((p: any) => p.id === playerId)
    if (pIndex === -1) return ''
    
    // Relative position calculation
    const rel = (pIndex - myIndex.value + 4) % 4
    
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

const isCardPlayable = (card: Card) => {
    if (!isTurn(myIndex.value)) return false
    if (!gameState.value.currentTrick || gameState.value.currentTrick.length === 0) return true
    
    const firstPlay = gameState.value.currentTrick[0]
    const ledSuit = firstPlay.card.suit
    const hasSuit = myHand.value.some(c => c.suit === ledSuit)
    
    if (hasSuit) {
        return card.suit === ledSuit;
    }
    return true
}

const tryPlayCard = (card: Card) => {
    if (!isTurn(myIndex.value)) return;
    if (isCardPlayable(card)) {
        gamePlayCard(card);
    }
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
    initSocket(roomId as string)
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
    const availableWidth = Math.min(600, windowWidth.value - 40) 
    const cardWidth = 90
    const totalRequired = handSize * cardWidth
    if (totalRequired <= availableWidth) return -30
    const margin = (availableWidth - cardWidth) / (handSize - 1) - cardWidth
    return Math.min(-30, margin) 
})
</script>

<style scoped lang="scss">
/* Use same styles as before */
:global(html), :global(body) {
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100dvh;
  overflow: hidden !important;
  overscroll-behavior: none;
}

.game-page {
  width: 100%;
  height: 100%;
  padding: 0;
  overflow: hidden;
  box-sizing: border-box;
  background: var(--bg-color);
}

.login-overlay {
    z-index: 2000;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(8px);
}

.login-modal {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  z-index: 50;
  position: relative;
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
  position: absolute;
  top: 0;
  left: 0;
  width: calc(100% - 1rem);
  padding: 0.5rem;
  background: transparent; /* Was rgba(0,0,0,0.4) */
  display: flex;
  justify-content: space-between;
  align-items: center; /* Align center */
  color: var(--text-main);
  z-index: 100;
  pointer-events: none; /* Let clicks pass through empty areas */
}

/* Enable clicks on buttons/interactive elements */
.status-bar > * {
  pointer-events: auto;
}

.header-left-group {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.room-pill {
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  background: rgba(0,0,0,0.3); /* Add background to text for readability */
  padding: 6px 14px;
  border-radius: 20px;
  backdrop-filter: blur(4px);
  color: #fff;
  font-weight: bold;
}

.action-btn {
    background: var(--primary-color);
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    cursor: pointer;
    font-weight: bold;
    pointer-events: auto;
}

.danger-btn {
    background: #ef4444; /* Red */
    border: 1px solid #b91c1c;
}
.danger-btn:hover {
    background: #dc2626;
}

.burger-btn {
    background: transparent;
    border: none;
    color: white;
    font-size: 1.8rem;
    cursor: pointer;
    padding: 0.2rem 0.5rem;
    line-height: 1;
}

.menu-overlay {
    z-index: 3000 !important;
    background: rgba(0,0,0,0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    position: fixed;
    top: 0;
    left: 0;
}

.menu-modal {
    width: 300px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    padding: 2rem;
}

.full-width {
    width: 100%;
    justify-content: center;
}

.scores {
    font-weight: bold;
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.board-layout {
  display: grid;
  grid-template-rows: min-content 1fr min-content;
  height: 100%;
  width: 100%;
  padding: 0.25rem;
  padding-bottom: env(safe-area-inset-bottom, 10px);
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}

.player-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: opacity 0.3s;
  position: relative;
  z-index: 10;
  
  &.active .avatar-circle {
    box-shadow: 0 0 15px 5px #ffd700;
    transform: scale(1.1);
    border: 2px solid #ffd700;
  }

  &.top {
    padding: 8px 0;
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
  overflow: hidden; /* Ensure image doesn't bleed */
}

.avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
}

.middle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 0;
  height: 90%;
  margin: 0;
  padding: 0.5rem 0;
}

.card-carpet {
  flex: 1;
  width: 100%;
  background: var(--carpet-green);
  border-radius: 40px;
  margin: 0 0.5rem;
  height: 100%; 
  min-height: 0;
  max-height: 100%;
  position: relative;
  box-shadow: inset 0 0 50px rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.trick-area {
    position: relative;
    width: 200px;
    height: 150px;
}

.trick-card {
    position: absolute;
    transition: all 0.5s ease-out;
    width: 90px;
    height: 135px;
}

/* CARPET POSITIONS */
/* Top Player Card */
.pos-top {
    top: -60%;
    left: 50%;
    transform: translateX(-50%);
}

/* Bottom Player Card (Me) */
.pos-bottom {
    bottom: -60%;
    left: 50%;
    transform: translateX(-50%);
}

/* Left Player Card */
.pos-left {
    left: -5%;
    top: 50%;
    transform: translateY(-50%) rotate(45deg); /* Changed from 90deg */
}

/* Right Player Card */
.pos-right {
    right: -5%;
    top: 50%;
    transform: translateY(-50%) rotate(-45deg); /* Changed from -90deg */
}

/* BIDDING AREA */
.bidding-area {
    text-align: center;
    color: white;
    z-index: 10;
}

.bidding-title {
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
    opacity: 0.8;
}

.center-turned {
    transform: scale(1.1);
    margin: 0 auto 1rem;
    box-shadow: 0 4px 15px rgba(0,0,0,0.4);
}

.bidding-controls {
    background: rgba(0,0,0,0.6);
    padding: 1rem;
    border-radius: 12px;
    margin-top: 1rem;
}

.round-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
}

.round-actions .chill-btn.secondary {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.3);
    opacity: 0.8;
}

.round-actions .chill-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    opacity: 1;
}

.color-picker {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.suit-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: white;
    font-size: 1.5rem;
    cursor: pointer;
    transition: transform 0.2s;
    
    &:hover { transform: scale(1.1); }
    &.red-suit { color: #d32f2f; }
    &.black-suit { color: #212121; }
    &:disabled { opacity: 0.3; cursor: not-allowed; }
}

.waiting-text {
    margin-top: 1rem;
    font-style: italic;
    opacity: 0.8;
    background: rgba(0,0,0,0.3);
    padding: 0.5rem 1rem;
    border-radius: 20px;
}

.player-slot.active .player-name {
    color: #ffd700;
}

/* My Hand Styles */
.my-hand {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 140px;
    width: 100%;
    margin-top: 5px;
    perspective: 1000px;
    /* Allow overflow horizontally if really needed, but try to contain */
}

/* Wrapper for overlapping */
.hand-card-wrapper {
    transition: margin-right 0.3s ease;
    height: 135px;
    width: 90px;
    /* Crucial: preserve pointer events for click */
    pointer-events: auto;
}

.hand-card {
    transition: transform 0.2s, box-shadow 0.2s;
    transform-origin: bottom center;
    
    &:hover {
        transform: translateY(-20px) scale(1.05);
        z-index: 100;
        box-shadow: 0 -5px 15px rgba(0,0,0,0.3);
    }
}

.my-turn-badge {
    background: #ef4444;
    color: white;
    font-weight: bold;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.8rem;
    margin-bottom: 5px;
    animation: bounce 1s infinite;
}

@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
}

/* ANIMATION GLOBAL */
.global-animation-layer {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9999;
    pointer-events: none;
}

.animation-stage {
    position: absolute;
    width: 200px;
    height: 150px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    /* Mimics .trick-area */
}

.trick-card.animating {
    transition: all 0.5s cubic-bezier(0.25, 1, 0.5, 1); /* Smooth snap */
}

/* 
 * STEP 1: GATHERING 
 * All cards move to center of the stage (top/left 50%)
 */
.phase-gathering {
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) rotate(0deg) !important;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
}

/* 
 * STEP 2: FLYING (Moving Group)
 * Maintains the stack (0deg) and moves to destination.
 * Slower transition for dramatic effect.
 */
.phase-flying {
    transition-duration: 1.2s !important; /* Slower */
    transform: translate(-50%, -50%) rotate(0deg) !important; /* Keep grouped defaults */
    box-shadow: 0 5px 20px rgba(0,0,0,0.5);
    /* Note: Specific fly-to classes will append Translate transforms */
}

/* 
 * STEP 2: FLYING TO WINNER 
 * The STACK (now at center) flies off screen.
 * We use Viewport Units to ensure they leave the screen regardless of stage size.
 * CRITICAL: We must Enforce top: 50% / left: 50% to prevent cards reverting to their hand positions
 */
.fly-to-pos-top {
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -60vh) rotate(0deg) !important;
    opacity: 0;
}

.fly-to-pos-bottom {
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, 60vh) rotate(0deg) !important;
    opacity: 0;
}

.fly-to-pos-left {
    top: 50% !important;
    left: 50% !important;
    transform: translate(-60vw, -50%) rotate(0deg) !important;
    opacity: 0;
}

.fly-to-pos-right {
    top: 50% !important;
    left: 50% !important;
    transform: translate(60vw, -50%) rotate(0deg) !important;
    opacity: 0;
}

.dealing-animation {
    position: relative;
    width: 100px;
    height: 140px;
}

.deck-stack {
    position: relative;
}

.dealing-text {
    position: absolute;
    bottom: -30px;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    color: white;
    font-weight: bold;
}

.bidding-status-text {
    background: rgba(255, 255, 255, 0.9);
    color: #333;
    padding: 2px 6px;
    border-radius: 8px;
    font-size: 0.7rem;
    margin-top: 2px;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.winner-announcement {
    font-size: 2rem;
    font-weight: bold;
    margin: 1rem 0;
    color: #ffd700;
    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.vs {
    font-size: 1.5rem;
    font-weight: bold;
    color: #666;
}

.score-value {
    font-size: 2.5rem;
    font-weight: bold;
    color: white;
}

.team-score {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.modal-content {
    background: rgba(30, 41, 59, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    padding: 20px;
    width: 90%;
    max-width: 400px;
    max-height: 80vh;
    overflow-y: auto;
    color: white;
}

.trick-history-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 15px 0;
}

.history-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255,255,255,0.05);
    padding: 10px;
    border-radius: 8px;
}

.mini-card {
    transform: scale(0.6);
    transform-origin: center right;
}

.winner-trophy {
    font-size: 1.2rem;
}

/* Specific fix for modal buttons */
.modal-overlay .chill-btn, .modal-content .chill-btn {
    font-size: 1rem;
}
</style>
