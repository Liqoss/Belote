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

      <!-- Last Trick Modal -->
      <div v-if="showLastTrickModal && gameState.lastTrick" class="glass-panel round-modal trick-review" @click="showLastTrickModal = false">
          <h3>Dernier Pli (Gagnant: {{ getName(gameState.players.findIndex(p => p.id === gameState.lastTrick.winnerId)) }})</h3>
          <div class="mini-trick">
             <div v-for="play in gameState.lastTrick.cards" :key="play.playerId" class="mini-card">
                <PlayingCard :rank="play.card.rank" :suit="play.card.suit" :clickable="false" />
             </div>
          </div>
          <p class="click-hint">(Cliquer pour fermer)</p>
      </div>

      <!-- Game Board -->
      <div v-else class="game-board">
        <div class="status-bar">
          <div class="left-stats">
            <span>Joueurs : {{ playerCount }}/4</span>
            <button v-if="canStartBots" @click="startBots" class="action-btn">
              🤖 Lancer avec Bots
            </button>
            <button v-if="canStartGame" @click="startGame" class="action-btn">
              🃏 Démarrer la partie
            </button>
          </div>
          
          
          <div class="scores" v-if="gameState.phase === 'playing'">
             <span class="team-score">Nous: {{ gameState.scores.team1 }} (+{{ gameState.currentScores.team1 }})</span>
             <span class="divider">/</span>
             <span class="team-score">Eux: {{ gameState.scores.team2 }} (+{{ gameState.currentScores.team2 }})</span>
          </div>
          
          <NuxtLink to="/" class="action-btn icon-only" title="Retour Accueil">🏠</NuxtLink>
        </div>

        <div class="board-layout">
           <!-- ME Trump Indicator (Top Right absolute) -->
           <div v-if="gameState.bidTakerIndex === myIndex" 
                class="taker-trump-indicator my-trump"
                style="position: absolute; top: 10px; right: 10px; z-index: 100;"
                :class="{ 'red-suit': ['H','D'].includes(gameState.trumpSuit), 'black-suit': ['C','S'].includes(gameState.trumpSuit) }">
               {{ getSuitIcon(gameState.trumpSuit) }}
           </div>
           <!-- Top (Partner) -->
           <div class="player-slot top" :class="{ active: isTurn(playerIndex(2)) }">
              <div class="avatar-circle">
                 {{ getAvatar(playerIndex(2)) }}
              </div>
              <span class="player-name">{{ getName(playerIndex(2)) }}</span>
              <div v-if="getBiddingStatus(playerIndex(2))" class="bidding-status-text">
                  {{ getBiddingStatus(playerIndex(2)) }}
              </div>
               <div v-if="gameState.bidTakerIndex === playerIndex(2)" 
                    class="taker-trump-indicator"
                    :class="{ 'red-suit': ['H','D'].includes(gameState.trumpSuit), 'black-suit': ['C','S'].includes(gameState.trumpSuit) }">
                   {{ getSuitIcon(gameState.trumpSuit) }}
               </div>
           </div>

           <!-- Middle Area (Table + Side Players) -->
           <div class="middle-row">
              <!-- Left -->
              <div class="player-slot left" :class="{ active: isTurn(playerIndex(1)) }">
                <div class="avatar-circle small">{{ getAvatar(playerIndex(1)) }}</div>
                <span class="player-name">{{ getName(playerIndex(1)) }}</span>
                <div v-if="getBiddingStatus(playerIndex(1))" class="bidding-status-text">
                    {{ getBiddingStatus(playerIndex(1)) }}
                </div>
                 <div v-if="gameState.bidTakerIndex === playerIndex(1)" 
                    class="taker-trump-indicator"
                    :class="{ 'red-suit': ['H','D'].includes(gameState.trumpSuit), 'black-suit': ['C','S'].includes(gameState.trumpSuit) }">
                   {{ getSuitIcon(gameState.trumpSuit) }}
               </div>
              </div>

                    <div class="dealing-animation" v-if="gameState.phase === 'dealing'">
                        <div class="deck-stack">
                           <div v-for="n in 5" :key="n" class="card-back" :style="{ top: -n + 'px', left: -n + 'px' }"></div>
                        </div>
                        <div class="dealing-text">Distribution...</div>
                     </div>

                 <!-- Carpet / Trick / Bidding -->
                 <div class="card-carpet" v-else>
                 <!-- PLAYING PHASE: Current Trick -->
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

                 <!-- OVERLAYS (Animation & UI) -->
                 <!-- ANIMATION LAYER (Ghost Trick) -->
                 <div class="trick-area animation-layer" v-if="animatingTrick" style="pointer-events: none;">
                    <div 
                        v-for="play in animatingTrick.cards" 
                        :key="'anim-'+play.playerId"
                        class="trick-card animating"
                        :class="[
                            getPositionClass(play.playerId), 
                            animationPhase === 'gathering' ? 'gather-center' : '',
                            animationPhase === 'flying' ? 'fly-to-' + getPositionClass(animatingTrick.winnerId) : ''
                        ]"
                    >
                       <PlayingCard 
                         :rank="play.card.rank" 
                         :suit="play.card.suit" 
                       />
                       <div class="winner-badge" v-if="play.playerId === animatingTrick.winnerId">🏆</div>
                    </div>
                 </div>
                 
                 <!-- Review Buttons (Last Trick / Score) -->
                 <!-- Only show if we have a last trick AND we are in playing phase, and check for round 2 via total hand counts or score update? -->
                 <!-- Simply: if gameState.lastTrick exists, allow viewing it -->
                 <div class="review-controls-top-left" v-if="gameState.lastTrick && gameState.phase === 'playing'">
                     <button class="icon-btn" @click="showLastTrickModal = !showLastTrickModal" title="Voir le dernier pli">
                        🔄
                     </button>
                 </div>

                 
                 <!-- BIDDING PHASE -->
                 <div class="bidding-area" v-else-if="gameState.phase === 'bidding' && gameState.turnedCard">
                     <p class="bidding-title">Tour de parole</p>
                     <div class="turned-card-display">
                         <PlayingCard 
                             :rank="gameState.turnedCard.rank" 
                             :suit="gameState.turnedCard.suit"
                             class="center-turned"
                         />
                     </div>
                     
                     <div v-if="isTurn(myIndex)" class="bidding-controls">
                         <div v-if="gameState.biddingRound === 1" class="round-actions">
                             <button @click="bid('take')" class="chill-btn small">Prendre</button>
                             <button @click="bid('pass')" class="chill-btn small secondary">Passer</button>
                         </div>
                         <div v-else class="round-actions">
                             <p>Choisir une couleur :</p>
                             <div class="color-picker">
                                 <button v-for="suit in ['H','D','C','S']" :key="suit" 
                                    @click="bid('take', suit)"
                                    class="suit-btn" 
                                    :class="{ 'red-suit': ['H','D'].includes(suit), 'black-suit': ['C','S'].includes(suit) }"
                                    :disabled="suit === gameState.turnedCard.suit">
                                     {{ getSuitIcon(suit) }}
                                 </button>
                             </div>
                             <button @click="bid('pass')" class="chill-btn small secondary">Passer</button>
                         </div>
                     </div>
                     <div v-else class="waiting-text">
                         {{ getName(gameState.turnIndex) }} réfléchit...
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

              <!-- Right -->
              <div class="player-slot right" :class="{ active: isTurn(playerIndex(3)) }">
                 <div class="avatar-circle small">{{ getAvatar(playerIndex(3)) }}</div>
                 <span class="player-name">{{ getName(playerIndex(3)) }}</span>
                 <div v-if="getBiddingStatus(playerIndex(3))" class="bidding-status-text">
                     {{ getBiddingStatus(playerIndex(3)) }}
                 </div>
                 <div v-if="gameState.bidTakerIndex === playerIndex(3)" 
                    class="taker-trump-indicator"
                    :class="{ 'red-suit': ['H','D'].includes(gameState.trumpSuit), 'black-suit': ['C','S'].includes(gameState.trumpSuit) }">
                   {{ getSuitIcon(gameState.trumpSuit) }}
               </div>
              </div>
           </div>

           <!-- Bottom (Me) -->
           <div class="player-slot bottom" :class="{ active: isTurn(myIndex) }">
               <div v-if="isTurn(myIndex) && gameState.phase === 'playing'" class="my-turn-badge">⚡ À VOUS DE JOUER ! ⚡</div>
               <div class="my-hand">
                  <PlayingCard 
                    v-for="card in sortedHand" 
                    :key="card.id"
                    :rank="card.rank" 
                    :suit="card.suit"
                    :clickable="isCardPlayable(card)"
                    :disabled="!isCardPlayable(card)"
                    @click="isCardPlayable(card) && playCard(card)"
                    class="hand-card"
                  />
               </div>
               <span class="player-name me">{{ username }} (Moi)</span>
               <div v-if="getBiddingStatus(myIndex)" class="bidding-status-text me-status">
                   {{ getBiddingStatus(myIndex) }}
               </div>
                
            </div>
         </div>
       </div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSocket } from '~/composables/useSocket'
import PlayingCard from '~/components/PlayingCard.vue'
import { io } from 'socket.io-client'

const username = ref('')
const hasJoined = ref(false)
const showRoundSummary = ref(false);

const socket = ref<any>(null)
const gameState = ref<any>({})
const myHand = ref<any[]>([])

// Animation trigger state
// Animation trigger state
const animatingTrick = ref<any>(null);
const animationPhase = ref<'idle' | 'gathering' | 'flying'>('idle');
const lastHandledTrick = ref<string>('');

watch(() => gameState.value.lastTrick, (newTrick) => {
    if (newTrick && newTrick.cards && newTrick.cards.length > 0) {
        const trickStr = JSON.stringify(newTrick);
        if (trickStr !== lastHandledTrick.value) {
            lastHandledTrick.value = trickStr;
            animatingTrick.value = newTrick;
            animationPhase.value = 'idle'; 
            
            // Phase 1: Wait (readability) -> 1000ms
            setTimeout(() => {
                animationPhase.value = 'gathering';
                
                // Phase 2: Gather -> Wait for transition (e.g. 500ms)
                setTimeout(() => {
                    animationPhase.value = 'flying';
                    
                    // Phase 3: Fly -> Wait for transition (e.g. 1000ms)
                    setTimeout(() => {
                         animatingTrick.value = null;
                         animationPhase.value = 'idle';
                    }, 1500);
                }, 800);
            }, 1000);
        }
    }
})



// Round Summary / Last Trick Modal control
const showLastTrickModal = ref(false);

const joinGame = () => {
    if(!username.value) return
    
    // Generate or retrieve persistent User ID
    let userId = localStorage.getItem('belote_user_id')
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('belote_user_id', userId);
    }
    
    socket.value = io() // Connect
    
    socket.value.on('connect', () => {
        socket.value.emit('join-game', { username: username.value, userId })
        hasJoined.value = true
    })
    
    socket.value.on('game-update', (state: any) => {
        gameState.value = state
        if (state.myHand) myHand.value = state.myHand
    })
}

// Auto-join if session exists? Maybe not, let them click.
// But we could pre-fill username if we stored it?
// For now keep manual join but with persistent ID logic.

const playerCount = computed(() => gameState.value.players ? gameState.value.players.length : 0)
const canStartBots = computed(() => playerCount.value > 0 && playerCount.value < 4 && gameState.value.phase === 'lobby')
const canStartGame = computed(() => playerCount.value === 4 && gameState.value.phase === 'lobby')

const myIndex = computed(() => {
    if (!gameState.value.players) return -1
    // We need to match by something unique. 
    // Socket ID changes on reconnect!
    // We should match by userId if we had it in state?
    // The server state sends 'players' with 'id' = userId now.
    const userId = localStorage.getItem('belote_user_id');
    return gameState.value.players.findIndex((p: any) => p.id === userId)
})
const playerIndex = (offset: number) => {
    if (myIndex.value === -1) return -1 // Spectator or not joined logic needed?
    return (myIndex.value + offset) % 4
}

const sortedHand = computed(() => {
    if (!myHand.value) return [];
    // Sort Order: Suit then Rank
    const suitOrder = { 'H': 0, 'C': 1, 'D': 2, 'S': 3 };
    const rankOrder = { '7': 0, '8': 1, '9': 2, '10': 3, 'J': 4, 'Q': 5, 'K': 6, 'A': 7 }; // Standard sort
    // Or Belote sort? Let's use standard for display grouping, or Belote value? 
    // Usually grouping by suit is enough.
    
    return [...myHand.value].sort((a, b) => {
        if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
        return rankOrder[a.rank] - rankOrder[b.rank];
    });
});

const isCardPlayable = (card: any) => {
    // If it's not our turn, no card is playable
    if (!isTurn(myIndex.value)) return false;
    
    // If trick is empty, any card is valid
    if (!gameState.value.currentTrick || gameState.value.currentTrick.length === 0) return true;
    
    // Need to follow suit of the FIRST card played
    const firstPlay = gameState.value.currentTrick[0];
    const ledSuit = firstPlay.card.suit;
    
    // Do we have that suit?
    const hasSuit = myHand.value.some((c: any) => c.suit === ledSuit);
    
    // If we have the suit, we MUST play it
    if (hasSuit) {
        return card.suit === ledSuit;
    }
    
    // If we don't have the suit, we can play anything (Standard Belote: usually must trump if partner losing, simplified here)
    // For now: Play anything if void in suit.
    return true;
}

const getName = (index: number) => {
    if (index === -1 || !gameState.value.players) return '...'
    const p = gameState.value.players[index]
    return p ? p.username : 'Vide'
}
const getAvatar = (index: number) => {
    const name = getName(index)
    return name ? name.substring(0, 2).toUpperCase() : '?'
}

const isTurn = (index: number) => {
    if (!gameState.value.players) return false
    return gameState.value.turnIndex === index
}

const getPositionClass = (playerId: string) => {
    if (!gameState.value.players) return ''
    const pIndex = gameState.value.players.findIndex((p: any) => p.id === playerId)
    if (pIndex === -1) return ''
    
    // Relative position
    const rel = (pIndex - myIndex.value + 4) % 4
    if (rel === 0) return 'pos-bottom'
    if (rel === 1) return 'pos-left'
    if (rel === 2) return 'pos-top'
    return 'pos-right'
}

const getBiddingStatus = (pIdx: number) => {
    if (!gameState.value.biddingHistory) return null;
    if (pIdx === -1) return null;
    if (!gameState.value.players || !gameState.value.players[pIdx]) return null;
    
    const pId = gameState.value.players[pIdx].id;
    // Find LAST action for this player
    for (let i = gameState.value.biddingHistory.length - 1; i >= 0; i--) {
        const h = gameState.value.biddingHistory[i];
        if (h.playerId === pId) {
            if (h.action === 'pass') return 'Passe';
            if (h.action === 'take') {
                const suit = h.suit || (gameState.value.turnedCard ? gameState.value.turnedCard.suit : null);
                return `Pris (${suit ? getSuitIcon(suit) : '?'})`;
            }
        }
    }
    return null;
}

const getSuitIcon = (suit: string) => {
    switch(suit) {
        case 'H': return '♥';
        case 'D': return '♦';
        case 'C': return '♣';
        case 'S': return '♠';
        default: return '?';
    }
}

const startBots = () => {
    socket.value?.emit('start-game-bots')
}

const startGame = () => {
    console.log('Frontend: Clicking Start Game. Socket:', socket.value?.id)
    if (!socket.value) {
        alert("Erreur de connexion (Socket manquant)")
        return
    }
    socket.value.emit('start-game')
}


const playCard = (card: any) => {
    if (!isTurn(myIndex.value)) return
    const cardId = card.id || (card.rank + card.suit);
    socket.value?.emit('play-card', cardId)
}

const bid = (action: 'take' | 'pass', suit?: string) => {
    if (!socket.value) {
        console.error('[FRONTEND] Socket is null in bid()');
        alert("Erreur: Non connecté au serveur");
        return;
    }
    socket.value.emit('player-bid', { action, suit });
}
</script>

<style scoped lang="scss">
.game-page {
  padding: 0;
  height: 100vh;
  overflow: hidden;
  /* background removed to use global body texture */
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
  overflow: hidden; 
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

.trump-indicator {
    background: white;
    color: black;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    margin-left: 1rem;
}

/* Board Layout */
.board-layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.25rem;
  position: relative;
  overflow: hidden;
  width: 100vw;
}

.player-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: opacity 0.3s;
  position: relative;
  
  &.active .avatar-circle {
    box-shadow: 0 0 15px 5px #ffd700; /* Golden Glow */
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
  border: 8px solid #5d4037; /* Wood border */
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Trick Display */
.trick-area {
    position: relative;
    width: 200px;
    height: 200px;
}

.trick-card {
    position: absolute;
    transition: transform 0.3s;

    &.animating {
      transition: all 1s ease-in-out;
      z-index: 100 !important;
      
      &.fly-to-pos-top {
          top: 10% !important; left: 50% !important; transform: translate(-50%, -50%) scale(0.5) !important; opacity: 0;
      }
      &.fly-to-pos-bottom {
          top: 90% !important; left: 50% !important; transform: translate(-50%, 50%) scale(0.5) !important; opacity: 0;
      }
      &.fly-to-pos-left {
          top: 50% !important; left: 10% !important; transform: translate(-50%, -50%) scale(0.5) !important; opacity: 0;
      }
      &.fly-to-pos-right {
          top: 50% !important; left: 90% !important; transform: translate(50%, -50%) scale(0.5) !important; opacity: 0;
      }
    }
}

.pos-bottom { bottom: -50px; left: 50%; transform: translateX(-50%); z-index: 10; }
.pos-top { top: -50px; left: 50%; transform: translateX(-50%); z-index: 1; }
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
    z-index: 100; /* High z-index to ensure clickability */
    position: relative; /* Ensure z-index applies */
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
    background: rgba(0,0,0,0.8); /* Darker for contrast */
    padding: 1rem;
    border-radius: 12px;
    z-index: 9999; /* Nuclear z-index */
    pointer-events: auto;
    
    /* Absolute center to escape layout issues */
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 20px rgba(0,0,0,0.5); /* Lift off */
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

.taker-trump-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
    margin-top: -10px;
    z-index: 20;
    
    &.red-suit { color: #d32f2f; }
    &.black-suit { color: #212121; }
}

.dealing-animation {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 50; /* Ensure on top of carpet */
}

.deck-stack {
    position: relative;
    width: 60px;
    height: 90px;
    margin-bottom: 2rem; /* Add spacing for text */
}

.card-back {
    position: absolute; /* Force absolute overlap */
    top: 0;
    left: 0;
    width: 60px;
    height: 90px;
    background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%);
    border: 2px solid #fff;
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    
    /* Cross hatch pattern css */
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

.round-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translateX(-50%);
    bottom: -150%;
    z-index: 100;
    text-align: center;
    width: 300px;
    animation: fadeIn 0.5s;
    
    h3 { margin-top: 0; color: #ffd700; }
    
    .summary-scores {
        margin: 1rem 0;
        font-size: 1.5rem;
        
        .score-row {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 2rem;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
    }
}


.my-turn-badge {
    position: absolute;
    top: -60px;
    background: #ffd700;
    color: #1a1a1a;
    font-weight: bold;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    z-index: 100;
    white-space: nowrap;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
}

/* Entry Animations */
@keyframes slideInBottom { from { transform: translate(-50%, 100%) scale(0.5); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }
@keyframes slideInTop { from { transform: translate(-50%, -100%) scale(0.5); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }
@keyframes slideInLeft { from { transform: translate(-100%, -50%) rotate(-45deg) scale(0.5); opacity: 0; } to { transform: translateY(-50%) rotate(-45deg) scale(1); opacity: 1; } }
@keyframes slideInRight { from { transform: translate(100%, -50%) rotate(45deg) scale(0.5); opacity: 0; } to { transform: translateY(-50%) rotate(45deg) scale(1); opacity: 1; } }

.trick-card {
    &.pos-bottom { animation: slideInBottom 0.4s ease-out; }
    &.pos-top { animation: slideInTop 0.4s ease-out; }
    &.pos-left { animation: slideInLeft 0.4s ease-out; }
    &.pos-right { animation: slideInRight 0.4s ease-out; }

    /* Exit/Flight Animations */
    &.animating {
        transition: all 1s ease-in-out;
    }

    &.fly-to-pos-bottom {
        bottom: -300% !important; /* Move down via bottom */
        left: 50% !important;
        transform: translate(-50%, 0) scale(0.2) !important;
        opacity: 0;
        transition: all 1s ease-in-out !important;
    }
    &.fly-to-pos-top {
        top: -200% !important;
        left: 50% !important;
        transform: translate(-50%, 0) scale(0.2) !important;
        opacity: 0;
        transition: all 1s ease-in-out !important;
    }
    &.fly-to-pos-left {
        top: 50% !important;
        left: -200% !important;
        transform: translate(0, -50%) scale(0.2) !important;
        opacity: 0;
        transition: all 1s ease-in-out !important;
    }
    &.fly-to-pos-right {
        top: 50% !important;
        left: 200% !important;
        transform: translate(0, -50%) scale(0.2) !important;
        opacity: 0;
        transition: all 1s ease-in-out !important;
    }
}

.gather-center {
    top: 50% !important;
    left: 50% !important;
    bottom: auto !important;
    right: auto !important;
    transform: translate(-50%, -50%) scale(0.8) !important;
    opacity: 1;
    transition: all 0.5s ease-in-out !important;
}

/* Unified positioning using Top/Left for correct animations */
.pos-bottom { bottom: -30%; left: 50%; transform: translateX(-50%); z-index: 10; }
.pos-top { top: -30%; left: 50%; transform: translateX(-50%); z-index: 1; }
.pos-left { top: 50%; transform: translateY(-50%) rotate(-45deg); z-index: 2; }
.pos-right { top: 50%; transform: translateY(-50%) rotate(45deg); z-index: 3; }
.review-controls-top-left {
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 50;
}
.icon-only {
    font-size: 1.5rem;
    padding: 0 0.5rem;
    margin-left: 1rem;
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
    display: flex; /* Centering */
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
.click-hint { font-size: 0.8rem; opacity: 0.7; }
</style>
