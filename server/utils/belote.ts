import { type Suit, type Rank, type Card as ICard, type Player, type GameState } from '~/types/belote';

export class Card implements ICard {
  constructor(public suit: Suit, public rank: Rank) {}

  get id() {
    return `${this.rank}${this.suit}`;
  }

  // Value depends on if it's trump or not
  getValue(isTrump: boolean): number {
    const values: Record<string, number> = isTrump
      ? { 'J': 20, '9': 14, 'A': 11, '10': 10, 'K': 4, 'Q': 3, '8': 0, '7': 0 }
      : { 'A': 11, '10': 10, 'K': 4, 'Q': 3, 'J': 2, '9': 0, '8': 0, '7': 0 };
    return values[this.rank];
  }

  // Order for comparing cards (higher is better)
  getOrder(isTrump: boolean): number {
    const order: Record<string, number> = isTrump
      ? { 'J': 8, '9': 7, 'A': 6, '10': 5, 'K': 4, 'Q': 3, '8': 2, '7': 1 }
      : { 'A': 8, '10': 7, 'K': 6, 'Q': 5, 'J': 4, '9': 3, '8': 2, '7': 1 };
    return order[this.rank];
  }

  toJSON() {
      return {
          suit: this.suit,
          rank: this.rank,
          id: this.id
      }
  }
}

export class BeloteGame {
  players: Player[] = [];
  socketMap: Record<string, string> = {}; // socketId -> userId

  hands: Record<string, Card[]> = {};
  currentTrick: { playerId: string; card: Card }[] = [];
  lastTrick: { winnerId: string, cards: { playerId: string, card: Card }[] } | null = null;
  
  scores: { team1: number; team2: number } = { team1: 0, team2: 0 };
  currentScores: { team1: number; team2: number } = { team1: 0, team2: 0 };
  roundSummary: { team1: number; team2: number } | null = null;
  
  trumpSuit: Suit | null = null;
  turnedCard: Card | null = null;
  
  phase: 'lobby' | 'dealing' | 'bidding' | 'playing' | 'round_summary' = 'lobby';
  
  deck: Card[] = [];
  dealerIndex: number = 0;
  turnIndex: number = 0; 
  biddingRound: 1 | 2 = 1;
  bidTakerIndex: number | null = null;
  biddingHistory: { playerId: string, username: string, action: 'pass' | 'take', suit?: Suit }[] = [];
  readyPlayers: string[] = [];
  lastInteraction: number = Date.now();

  onUpdate: () => void = () => { this.lastInteraction = Date.now(); };

  constructor(onUpdate?: () => void) {
      this.onUpdate = onUpdate || (() => {});
  }
  
  // --- PLAYER MANAGEMENT ---

  addPlayer(socketId: string, username: string, userId: string) {
    const existingPlayer = this.players.find(p => p.id === userId);
    
    if (existingPlayer) {
        // --- RECONNECTION ---
        existingPlayer.socketId = socketId;
        existingPlayer.disconnectedAt = undefined;
        existingPlayer.isBot = false; // Restore humanity
        if (existingPlayer.username.startsWith('Bot (')) {
             existingPlayer.username = username; // Restore name
        }
        this.socketMap[socketId] = userId;
        console.log(`[BELOTE] Player ${username} reconnected (Was Bot? ${existingPlayer.isBot}).`);
        
        if (this.phase !== 'lobby') {
            this.checkBotTurn();
        }
    } else {
        // --- NEW PLAYER ---
        // 1. Check for empty slot
        if (this.players.length < 4) {
            this.players.push({ 
                id: userId, 
                socketId: socketId, 
                username, 
                isBot: false 
            });
            this.socketMap[socketId] = userId;
        } 
        // 2. Check for Bot to Replace (if lobby full or game started)
        else {
            const botIndex = this.players.findIndex(p => p.isBot);
            if (botIndex !== -1) {
                const bot = this.players[botIndex];
                console.log(`[BELOTE] replacing bot ${bot.username} with human ${username}.`);
                
                // Transfer Hand
                if (this.hands[bot.id]) {
                    this.hands[userId] = this.hands[bot.id];
                    delete this.hands[bot.id];
                }

                // Update Player Object in place (preserves index order)
                this.players[botIndex] = {
                    id: userId,
                    socketId: socketId,
                    username: username,
                    isBot: false
                };
                
                this.socketMap[socketId] = userId;
                // Note: We don't remove bot from socketMap because bots don't have sockets.
            } else {
                console.log(`[BELOTE] Game full of humans. ${username} is spectator.`);
                // Do nothing => Spectator
            }
        }
    }
    
    // Auto-Reset if only one human is left/connected in a polluted lobby
    // (Only if we are actually in lobby phase? Or blindly?)
    if (this.phase === 'lobby') {
        const humanCount = this.players.filter(p => !p.isBot && p.socketId).length;
        if (humanCount === 1 && this.players.length > 1) {
             // Optional: logic to clear stuck bots if only 1 human remains?
             // For now, let's keep it simple.
        }
    }
  }
  
  removePlayer(socketId: string) {
    const userId = this.socketMap[socketId];
    if (!userId) return;
    
    const player = this.players.find(p => p.id === userId);
    if (player) {
        player.socketId = null;
        player.disconnectedAt = Date.now();
        console.log(`[BELOTE] Player ${player.username} disconnected.`);
    }
    delete this.socketMap[socketId];
  }

  checkDisconnects() {
      const NOW = Date.now();
      const TIMEOUT = 2 * 60 * 1000; // 2 minutes
      let activeHumans = 0;
      
      this.players.forEach((p, index) => {
          if (!p.isBot) {
              if (p.socketId === null && p.disconnectedAt && (NOW - p.disconnectedAt > TIMEOUT)) {
                  console.log(`[BELOTE] Player ${p.username} timed out. Swapping for Bot.`);
                  this.replaceWithBot(index);
              } else {
                  activeHumans++;
              }
          }
      });
      
      if (activeHumans === 0 && this.phase !== 'lobby') {
           console.log('[BELOTE] No humans left. Resetting game.');
           this.resetToLobby();
      }
  }

  replaceWithBot(playerIndex: number) {
      const p = this.players[playerIndex];
      p.isBot = true;
      // Do NOT change ID, so user can reclaim it
      // p.id = `bot_${Date.now()}_${playerIndex}`; 
      p.username = `Bot (${p.username})`;
      p.socketId = null;
      p.disconnectedAt = undefined;
      
      if (this.phase !== 'lobby' && this.turnIndex === playerIndex) {
          this.checkBotTurn();
      }
  }
  
  fullReset() {
      this.resetToLobby();
      // Keep only connected humans
      this.players = this.players.filter(p => p.socketId !== null && !p.isBot);
  }

  resetToLobby() {
      this.phase = 'lobby';
      this.scores = { team1: 0, team2: 0 };
      this.currentScores = { team1: 0, team2: 0 };
      this.hands = {};
      this.currentTrick = [];
      this.lastTrick = null;
      this.roundSummary = null;
      this.trumpSuit = null;
      this.turnedCard = null;
      this.biddingHistory = [];
      // Remove bots so we can re-launch fresh
      this.players = this.players.filter(p => !p.isBot);
  }

  addBots() {
    const botNames = ['Trump', 'Macron', 'Poutine', 'Lepen', 'Mélenchon', 'Obama', 'Mandela'];
    while (this.players.length < 4) {
      const usedNames = this.players.map(p => p.username);
      const available = botNames.filter(n => !usedNames.includes(n));
      const name = available.length > 0 
        ? available[Math.floor(Math.random() * available.length)] 
        : `Bot ${this.players.length + 1}`;
      
      this.players.push({ 
          id: `bot_${Date.now()}_${this.players.length}`, 
          socketId: null, 
          username: name, 
          isBot: true 
      });
    }
  }

  // --- GAME LOOP ---

  startGame() {
    if (this.players.length !== 4) return;
    console.log('[BELOTE] Starting Game. Players:', this.players.map(p => `${p.username} (Bot:${p.isBot})`));
    this.scores = { team1: 0, team2: 0 };
    this.dealerIndex = Math.floor(Math.random() * 4);
    this.startRound();
  }

  startRound() {
    this.currentScores = { team1: 0, team2: 0 };
    this.trumpSuit = null;
    this.bidTakerIndex = null;
    this.bidTakerIndex = null;
    this.biddingHistory = [];
    this.readyPlayers = []; // Reset ready status for new round
    
    // Initialize Deck
    const suits: Suit[] = ['H', 'D', 'C', 'S'];
    const ranks: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    this.deck = [];
    suits.forEach(s => ranks.forEach(r => this.deck.push(new Card(s, r))));
    this.shuffle(this.deck);

    this.phase = 'dealing';
    this.onUpdate();
    this.runDealingAnimation();
  }

  runDealingAnimation() {
      // Functional Dealing Steps with Delays
      setTimeout(() => {
          this.hands = {};
          this.players.forEach((p, i) => {
              this.hands[p.id] = this.deck.slice(i * 5, i * 5 + 3);
          });
          this.onUpdate();

          setTimeout(() => {
              this.players.forEach((p, i) => {
                  const current = this.hands[p.id] || [];
                  const nextTwo = this.deck.slice(i * 5 + 3, i * 5 + 5);
                  this.hands[p.id] = [...current, ...nextTwo];
              });
              this.onUpdate();

              // SORTING STEP (5 Cards)
              setTimeout(() => {
                  this.sortHands();
                  this.onUpdate();

                  setTimeout(() => {
                      this.turnedCard = this.deck[20];
                      this.phase = 'bidding';
                      this.biddingRound = 1;
                      this.turnIndex = (this.dealerIndex + 1) % 4;
                      this.onUpdate();
                      this.checkBotTurn();
                  }, 1000); // Reveal Turn Card
              }, 1000); // Trigger Sort

          }, 1000); // Second Deal
      }, 1000); // First Deal
  }

  // --- PLAY ACTIONS ---

  playerBid(socketId: string, action: 'take' | 'pass', suit?: Suit) {
      if (this.phase !== 'bidding') return;

      const userId = this.socketMap[socketId];
      if (!userId) return;

      const playerIndex = this.players.findIndex(p => p.id === userId);
      if (playerIndex !== this.turnIndex) return; // Not their turn

      // Determine the effective suit for history
      const recordedSuit = (action === 'take' && this.biddingRound === 1) 
          ? this.turnedCard?.suit 
          : suit;

      this.processBid(playerIndex, action, recordedSuit);
  }

  processBid(playerIndex: number, action: 'take' | 'pass', suit?: Suit) {
      const player = this.players[playerIndex];
      console.log(`[BELOTE] Bid: ${player.username} -> ${action} ${suit || ''}`);

      this.biddingHistory.push({
          playerId: player.id,
          username: player.username,
          action: action,
          suit: suit
      });

      if (action === 'take' && suit) {
          this.trumpSuit = suit;
          this.bidTakerIndex = playerIndex;
          this.finalizeDistribution();
      } else {
          // PASS
          this.turnIndex = (this.turnIndex + 1) % 4;
          
          // Check if round completed
          if (this.turnIndex === (this.dealerIndex + 1) % 4) {
              if (this.biddingRound === 1) {
                  this.biddingRound = 2;
              } else {
                  // Double Pass -> Redeal
                  console.log('[BELOTE] All passed. Redealing.');
                  this.dealerIndex = (this.dealerIndex + 1) % 4;
                  this.startRound();
                  return;
              }
          }
          this.checkBotTurn();
      }
      this.onUpdate();
  }
  
  finalizeDistribution() {
      const takerId = this.players[this.bidTakerIndex!].id;
      if (this.turnedCard) {
          this.hands[takerId].push(this.turnedCard);
      }
      
      let deckPtr = 21;
      this.players.forEach((p, i) => {
          const isTaker = (i === this.bidTakerIndex);
          const count = isTaker ? 2 : 3;
          const newCards = this.deck.slice(deckPtr, deckPtr + count);
          this.hands[p.id].push(...newCards);
          deckPtr += count;
      });

      // IDENTITY CHECK & REPAIR
      this.players.forEach(p => {
          if (!this.hands[p.id]) this.hands[p.id] = [];
          
          if (this.hands[p.id].length !== 8) {
              console.error(`[BELOTE] CRITICAL: Player ${p.username} has ${this.hands[p.id].length} cards instead of 8! Attempting repair...`);
              
              // 1. Try to fill from deck if available
              const needed = 8 - this.hands[p.id].length;
              if (needed > 0) {
                   // Ensure we don't pick duplicates (simple approach: create unique cards not in any hand)
                   // For MVP/Debug: Just take from end of deck logic or generate
                   // Actually, if deckPtr < 32, we have cards?
                   // deckPtr is local.
                   // Let's just create emergency cards if deck is corrupted
                   for(let k=0; k<needed; k++) {
                       // Emergency card (Rank 0/Suit 0 - strictly for debug/anti-crash)
                       // Or random valid card?
                       // Better: Draw from unused deck.
                       // We used up to index 31.
                       // Maybe some cards were missed?
                       // We can't easily find "missing" cards without scanning all hands.
                       // Fallback: Duplicate random card (Game is corrupted anyway, but prevents crash)
                       this.hands[p.id].push(this.deck[Math.floor(Math.random() * 32)]);
                   }
              }
          }
      });

      // Final Audit with Repair confirmed
      const audit = this.players.map(p => `${p.username}:${this.hands[p.id]?.length}`);
      console.log(`[BELOTE] Distribution Finalized (Verified). Hands: ${audit.join(', ')}`);
      
      this.onUpdate(); // Show chaos (unsorted but full hand)

      // SORTING STEP (8 Cards)
      setTimeout(() => {
          this.sortHands();
          this.phase = 'playing';
          this.turnIndex = (this.dealerIndex + 1) % 4;
          this.currentTrick = [];
          this.onUpdate();
          
          setTimeout(() => {
              this.checkBotTurn();
          }, 1000);
      }, 1500);
  }

  playCard(socketId: string, cardId: string) {
    const userId = this.socketMap[socketId];
    if (!userId) {
        console.warn(`[BELOTE] playCard rejected: Unknown socket ${socketId}`);
        return;
    }
    
    const playerIndex = this.players.findIndex(p => p.id === userId);
    console.log(`[BELOTE] playCard request: User=${this.players[playerIndex]?.username} (Index ${playerIndex}), Card=${cardId}, Phase=${this.phase}, Turn=${this.turnIndex}`);

    if (this.phase !== 'playing') {
        console.warn(`[BELOTE] playCard rejected: Wrong phase (${this.phase})`);
        return;
    }
    
    if (playerIndex !== this.turnIndex) {
        console.warn(`[BELOTE] playCard rejected: Not your turn (Current: ${this.turnIndex})`);
        return;
    }

    this.processCardPlay(userId, cardId);
  }

  processCardPlay(userId: string, cardId: string) {
    const playerIndex = this.players.findIndex(p => p.id === userId);
    
    // Safety against race conditions or double-plays
    if (playerIndex !== this.turnIndex) {
        console.warn(`[BELOTE] Blocked out-of-turn play by ${userId} (Index ${playerIndex}). Current Turn: ${this.turnIndex}`);
        return;
    }

    const hand = this.hands[userId];
    const cardIndex = hand?.findIndex(c => c.id === cardId);
    
    if (!hand || cardIndex === -1) {
        console.error(`[BELOTE] Invalid card play: ${cardId} by ${userId}`);
        return;
    }

    const card = hand[cardIndex];
    hand.splice(cardIndex, 1);
    
    this.currentTrick.push({ playerId: userId, card });
    this.onUpdate();

    if (this.currentTrick.length === 4) {
      setTimeout(() => {
          try {
              this.resolveTrick();
          } catch (e) {
              console.error('[BELOTE] CRITICAL ERROR in resolveTrick:', e);
              // Attempt recovery?
              this.turnIndex = (this.turnIndex + 1) % 4;
              this.onUpdate();
          }
      }, 2000); 
    } else {
      const oldTurn = this.turnIndex;
      this.turnIndex = (this.turnIndex + 1) % 4;
      console.log(`[BELOTE] Turn advanced: ${oldTurn} -> ${this.turnIndex} (${this.players[this.turnIndex]?.username})`);
      this.onUpdate(); // <--- CRITICAL FIX: Notify clients of new turn
      this.checkBotTurn();
    }
  }

  resolveTrick() {
    // 1. Determine Winner
    const winnerInfo = this.getTrickWinner(this.currentTrick, this.trumpSuit!);
    
    // 2. Count Points
    let points = 0;
    this.currentTrick.forEach(t => points += t.card.getValue(t.card.suit === this.trumpSuit));
    
    const winnerIndex = this.players.findIndex(p => p.id === winnerInfo.playerId);
    const winningTeam = (winnerIndex % 2 === 0) ? 'team1' : 'team2';
    this.currentScores[winningTeam] += points;
    
    // 3. Update State
    this.turnIndex = winnerIndex;
    console.log(`[BELOTE] Trick Won by ${winnerInfo.playerId} (Index ${winnerIndex}). New Turn: ${this.turnIndex}`);
    this.lastTrick = {
        winnerId: winnerInfo.playerId,
        cards: [...this.currentTrick]
    };
    this.currentTrick = [];
    this.onUpdate();
    
    // 4. Check End of Round
    if (this.hands[this.players[0].id].length === 0) {
        this.currentScores[winningTeam] += 10; // Dix de Der
        this.scores.team1 += this.currentScores.team1;
        this.scores.team2 += this.currentScores.team2;
        
        this.roundSummary = { ...this.currentScores };
        this.phase = 'round_summary'; // Blocking phase
        this.readyPlayers = []; // Reset ready state
        this.dealerIndex = (this.dealerIndex + 1) % 4;
        this.onUpdate();
        // Wait for players to click Ready
    } else {
        this.checkBotTurn();
    }
  }

  playerSetReady(socketId: string) {
      const userId = this.socketMap[socketId];
      if (!userId) return;
      
      if (this.phase !== 'round_summary' && this.phase !== 'lobby') return; // Can also be used in lobby if we want? Assuming round_summary for now.
      
      if (!this.readyPlayers.includes(userId)) {
          this.readyPlayers.push(userId);
      }
      
      this.checkAllReady();
      this.onUpdate();
  }

  checkAllReady() {
      // Filter only connected humans
      const humans = this.players.filter(p => !p.isBot && p.socketId);
      const allReady = humans.every(p => this.readyPlayers.includes(p.id));
      
      if (allReady && humans.length > 0) {
          console.log('[BELOTE] All humans ready. Starting next round.');
          this.startRound();
      }
  }
  
  getTrickWinner(trick: {playerId: string, card: Card}[], trump: Suit) {
      const ledSuit = trick[0].card.suit;
      let activeBest = trick[0];
      
      for (let i = 1; i < 4; i++) {
          const challenge = trick[i];
          const bestCard = activeBest.card;
          const chalCard = challenge.card;
          
          const isBestTrump = bestCard.suit === trump;
          const isChalTrump = chalCard.suit === trump;
          
          if (isChalTrump && !isBestTrump) {
              activeBest = challenge;
          } else if (isChalTrump && isBestTrump) {
              if (chalCard.getOrder(true) > bestCard.getOrder(true)) activeBest = challenge;
          } else if (!isChalTrump && !isBestTrump) {
              if (chalCard.suit === ledSuit && chalCard.getOrder(false) > bestCard.getOrder(false)) {
                  activeBest = challenge;
              }
          }
      }
      return activeBest;
  }

  // --- BOT LOGIC ---

  checkStalled() {
      if (this.phase !== 'playing' && this.phase !== 'bidding') return;
      
      const currentPlayer = this.players[this.turnIndex];
      // Only intervene if it's a BOT's turn and nothing happened for 12 seconds
      if (currentPlayer && currentPlayer.isBot && (Date.now() - this.lastInteraction > 12000)) {
          console.warn(`[BELOTE] Watchdog detected stalled bot (${currentPlayer.username}). Forcing turn.`);
          this.lastInteraction = Date.now(); // Reset timer to avoid spam
          this.checkBotTurn();
      }
      this.checkDisconnects();
  }

  checkBotTurn() {
    const player = this.players[this.turnIndex];
    if (player && player.isBot) {
        // Delay for realism (2.5s to 4.5s) - Relaxed pace
      const delay = 2500 + Math.random() * 2000;
      setTimeout(() => {
            if (this.phase === 'bidding') this.botBid(player);
            if (this.phase === 'playing') this.botPlay(player);
        }, delay);
    }
  }

  botBid(player: Player) {
      const playerIndex = this.players.findIndex(p => p.id === player.id);
      if (playerIndex !== this.turnIndex) return; // Safety Check
      
      // Basic AI
      const roll = Math.random();
      
      if (this.biddingRound === 1 && roll > 0.8) {
          const needed = this.turnedCard?.suit;
          if (needed) this.processBid(playerIndex, 'take', needed);
      } else if (this.biddingRound === 2 && roll > 0.9) {
          const suits: Suit[] = ['H','D','C','S'];
          const forbidden = this.turnedCard?.suit;
          const pick = suits.find(s => s !== forbidden) || 'H';
          this.processBid(playerIndex, 'take', pick);
      } else {
          this.processBid(playerIndex, 'pass');
      }
  }

  botPlay(player: Player) {
    const playerIndex = this.players.findIndex(p => p.id === player.id);
    if (playerIndex !== this.turnIndex) return; // Safety Check

    const hand = this.hands[player.id];
    if (!hand || hand.length === 0) {
        console.error(`[BELOTE] CRITICAL: Bot ${player.username} has no cards but it is their turn! Breaking loop.`);
        // Emergency Skip
        this.turnIndex = (this.turnIndex + 1) % 4;
        this.onUpdate();
        this.checkBotTurn();
        return;
    }

    let playable = hand;
      
      if (this.currentTrick.length > 0) {
          const ledSuit = this.currentTrick[0].card.suit;
          const hasSuit = hand.filter(c => c.suit === ledSuit);
          if (hasSuit.length > 0) playable = hasSuit;
      }

      // Safety check
      if (playable.length === 0) {
           console.warn(`[BELOTE] Bot ${player.username} has no playable cards (filters failed?!). Reverting to full hand.`);
           playable = hand;
      }

      const cardToPlay = playable[Math.floor(Math.random() * playable.length)];
      console.log(`[BELOTE] Bot ${player.username} playing ${cardToPlay.id}`);
      this.processCardPlay(player.id, cardToPlay.id);
  }

  get hasConnectedHuman(): boolean {
      return this.players.some(p => !p.isBot && p.socketId !== null);
  }

  shuffle(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
  }

  sortHands() {
      // Sort logic: Suit (H, C, D, S) then Rank (7,8,9,10,J,Q,K,A)
      // Rank order for sorting visual doesn't need to depend on Trump (usually).
      const suitOrder = { 'H': 0, 'C': 1, 'D': 2, 'S': 3 };
      const rankOrder = { '7':0, '8':1, '9':2, '10':3, 'J':4, 'Q':5, 'K':6, 'A':7 };
      
      this.players.forEach(p => {
          if (this.hands[p.id]) {
              this.hands[p.id].sort((a, b) => {
                  if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
                  return rankOrder[a.rank] - rankOrder[b.rank];
              });
          }
      });
  }
}
