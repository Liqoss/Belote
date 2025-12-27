export type Suit = 'H' | 'D' | 'C' | 'S'; // Hearts, Diamonds, Clubs, Spades
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export class Card {
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
}

export class BeloteGame {
  players: { 
      id: string;      // Persistent User ID (or Bot ID)
      socketId: string | null; // Current Socket ID
      username: string; 
      isBot: boolean;
      disconnectedAt?: number;
  }[] = [];
  
  // Maps socketId to userId for quick lookup
  socketMap: Record<string, string> = {};

  hands: Record<string, Card[]> = {};
  currentTrick: { playerId: string; card: Card }[] = [];
  lastTrick: { winnerId: string, cards: { playerId: string, card: Card }[] } | null = null;
  scores: { team1: number; team2: number } = { team1: 0, team2: 0 };
  currentScores: { team1: number; team2: number } = { team1: 0, team2: 0 };
  roundSummary: { team1: number; team2: number } | null = null;
  trumpSuit: Suit | null = null;
  
  phase: 'lobby' | 'dealing' | 'bidding' | 'playing' = 'lobby';
  
  // Callback for state updates
  onUpdate: () => void;

  // Bidding History for UI
  biddingHistory: { playerId: string, username: string, action: 'pass' | 'take', suit?: Suit }[] = [];

  constructor(onUpdate?: () => void) {
      this.onUpdate = onUpdate || (() => {});
  }
  
  setUpdateCallback(fn: () => void) {
      this.onUpdate = fn;
  }
  
  // Game State Internals
  deck: Card[] = [];
  dealerIndex: number = 0;
  turnIndex: number = 0; 
  
  // Bidding Specific
  turnedCard: Card | null = null;
  biddingRound: 1 | 2 = 1;
  bidTakerIndex: number | null = null;

  // Add/Reconnect Player
  addPlayer(socketId: string, username: string, userId: string) {
    const existingPlayer = this.players.find(p => p.id === userId);
    
    if (existingPlayer) {
        existingPlayer.socketId = socketId;
        existingPlayer.disconnectedAt = undefined;
        this.socketMap[socketId] = userId;
        console.log(`Player ${username} reconnected.`);
        
        // Resume game if it was waiting for players (e.g. paused bot turn)
        if (this.phase !== 'lobby') {
            this.checkBotTurn();
        }
    } else {
        // New Player
        if (this.players.length < 4) {
            this.players.push({ 
                id: userId, 
                socketId: socketId, 
                username, 
                isBot: false 
            });
            this.socketMap[socketId] = userId;
        }
    }
    
    
    // Rule: "Dès qu'un joueur arrive, si aucun autre n'est présent, tout est réinitialisé"
    // Modified: If I am the ONLY connected HUMAN (ignoring bots), and the game has content (bots or ghosts), RESET.
    const humanCount = this.players.filter(p => !p.isBot && p.socketId).length;
    
    if (humanCount === 1 && this.players.length > 1) {
        console.log('Player is alone (Only human connected). Triggering Full Reset.');
        this.fullReset();
    } else if (existingPlayer && this.phase !== 'lobby') {
         // Resume game if valid and it was waiting (Multiplayer case)
         this.checkBotTurn();
    }
  }
  
  fullReset() {
      this.resetToLobby();
      // Also remove disconnected humans so we start fresh
      this.players = this.players.filter(p => p.isBot || p.socketId !== null);
      // Actually, if we reset to lobby, we probably want to remove EVERYONE not connected, 
      // so the lobby shows only the new arrival.
      // But we keep Bots? 
      // If I was alone with ghosts, I probably want to launch new bots.
      // Let's keep Bots for now, or maybe remove them too if "tout réinitialiser".
      // User said "Launch with bots" button needed.
      // Let's just keep the connected human.
      if (this.players.some(p => p.isBot)) {
           // If there were bots, we effectively keep them as "active participants"
           // So activeCount would be > 1.
           // So this block only runs if I am alone with GHOST HUMANS.
      }
  }

  // Handle Socket Disconnect
  removePlayer(socketId: string) {
    const userId = this.socketMap[socketId];
    if (!userId) return;
    
    const player = this.players.find(p => p.id === userId);
    if (player) {
        player.socketId = null;
        player.disconnectedAt = Date.now();
        console.log(`Player ${player.username} disconnected. Waiting for reconnect...`);
        
        // MVP: If game hasn't started (lobby), maybe remove immediately? 
        // User asked for "session", so let's keep them even in lobby for a bit?
        // Actually for Lobby it's better to free up the slot if they don't come back fast.
        // But the constraint is "2 min -> Bot".
    }
    delete this.socketMap[socketId];
  }
  
  // Check if any human is currently connected (socketId not null)
  get hasConnectedHuman(): boolean {
      return this.players.some(p => !p.isBot && p.socketId !== null);
  }

  // Periodic Cleanup
  checkDisconnects() {
      const NOW = Date.now();
      const TIMEOUT = 2 * 60 * 1000; // 2 minutes
      
      let humanCount = 0;
      
      this.players.forEach((p, index) => {
          if (!p.isBot) {
              if (p.socketId === null && p.disconnectedAt) {
                  if (NOW - p.disconnectedAt > TIMEOUT) {
                      console.log(`Player ${p.username} timed out. Replacing with Bot.`);
                      this.replaceWithBot(index);
                  } else {
                      humanCount++; // Still a human, just disconnected temporarily
                  }
              } else {
                  humanCount++; // Connected human
              }
          }
      });
      
      // If NO humans left (all bots), reset game to save resources/avoid zombie games
      if (humanCount === 0 && this.phase !== 'lobby') {
           console.log('No humans left in game. Resetting to lobby.');
           this.resetToLobby();
      }
  }
  
  replaceWithBot(playerIndex: number) {
      const p = this.players[playerIndex];
      // Convert to Bot
      p.isBot = true;
      p.id = `bot_${Date.now()}_${playerIndex}`; // Change ID to avoid user reconnecting as this bot
      p.username = `Bot (was ${p.username})`;
      p.socketId = null;
      p.disconnectedAt = undefined;
      
      // If it was this player's turn, trigger bot check
      if (this.phase !== 'lobby' && this.turnIndex === playerIndex) {
          this.checkBotTurn();
      }
  }

  addBots() {
    const botNames = ['Trump', 'Macron', 'Poutine', 'Lepen', 'Mélenchon', 'Obama', 'Staline', 'Mandela'];
    
    while (this.players.length < 4) {
      // Pick a name not already used
      const usedNames = this.players.map(p => p.username);
      const available = botNames.filter(n => !usedNames.includes(n));
      const name = available.length > 0 
        ? available[Math.floor(Math.random() * available.length)] 
        : `Bot ${this.players.length + 1}`;
        
      const botId = `bot_${Date.now()}_${this.players.length}`;
      this.players.push({ id: botId, socketId: null, username: name, isBot: true });
    }
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
      
      // Remove bots so we can "Launch" again
      this.players = this.players.filter(p => !p.isBot);
  }

  startGame() {
    console.log('BeloteGame.startGame called. Players:', this.players.length);
    if (this.players.length !== 4) {
        console.error('Cannot start game: Not enough players');
        return;
    }
    this.scores = { team1: 0, team2: 0 };
    this.dealerIndex = Math.floor(Math.random() * 4);
    this.startRound();
  }

  startRound() {
    this.currentScores = { team1: 0, team2: 0 };
    this.trumpSuit = null;
    this.bidTakerIndex = null;
    
    // Generate and Shuffle Deck
    const suits: Suit[] = ['H', 'D', 'C', 'S'];
    const ranks: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    this.deck = [];
    suits.forEach(s => ranks.forEach(r => this.deck.push(new Card(s, r))));
    this.shuffle(this.deck);

    // 3. Start Dealing Phase (Animation)
    this.phase = 'dealing';
    this.biddingHistory = []; // Reset history
    this.onUpdate();

    this.runDealingAnimation();
  }

  runDealingAnimation() {
      // Step 1: Deal 3 cards to everyone
      setTimeout(() => {
          this.hands = {};
          this.players.forEach((p, i) => {
              this.hands[p.id] = this.deck.slice(i * 5, i * 5 + 3);
          });
          this.onUpdate();

          // Step 2: Deal 2 more cards (total 5)
          setTimeout(() => {
              this.players.forEach((p, i) => {
                  const current = this.hands[p.id] || [];
                  const nextTwo = this.deck.slice(i * 5 + 3, i * 5 + 5);
                  this.hands[p.id] = [...current, ...nextTwo];
              });
              this.onUpdate();

              // Step 3: Reveal Turned Card & Start Bidding
              setTimeout(() => {
                  this.turnedCard = this.deck[20];
                  this.phase = 'bidding';
                  this.biddingRound = 1;
                  this.turnIndex = (this.dealerIndex + 1) % 4;
                  this.onUpdate();
                  this.checkBotTurn();
              }, 2000);

          }, 2000);
      }, 1000);
  }
  
  playerBid(socketId: string, action: 'take' | 'pass', suit?: Suit) {
      if (this.phase !== 'bidding') return;
      const userId = this.socketMap[socketId];
      if (!userId) return;

      const playerIndex = this.players.findIndex(p => p.id === userId);
      if (playerIndex !== this.turnIndex) return;
      
      const player = this.players[playerIndex];

      // Determine suit for history (Round 1 = Turned Card)
      const recordedSuit = (action === 'take' && this.biddingRound === 1) ? this.turnedCard?.suit : suit;
      
      console.log(`[BELOTE] Bid: ${username}/${action} Round:${this.biddingRound} Suit:${recordedSuit} (Turned:${this.turnedCard?.suit})`);

      // Track History
      this.biddingHistory.push({
          playerId: userId,
          username: player.username,
          action: action,
          suit: recordedSuit
      });
      
      if (action === 'take') {
          // Take logic
          this.trumpSuit = this.biddingRound === 1 ? (this.turnedCard!.suit) : (suit || null);
          if (!this.trumpSuit) return; // Must have suit for round 2
          
          this.bidTakerIndex = playerIndex;
          this.finalizeDistribution();
      } else {
          // Pass logic
          this.turnIndex = (this.turnIndex + 1) % 4;
          
          // Check if full circle done
          if (this.turnIndex === (this.dealerIndex + 1) % 4) {
              if (this.biddingRound === 1) {
                  this.biddingRound = 2; // Start round 2
              } else {
                  // Everyone passed twice -> Redistribute
                  this.dealerIndex = (this.dealerIndex + 1) % 4;
                  this.startRound();
                  return;
              }
          }
          this.checkBotTurn();
      }
  }
  
  finalizeDistribution() {
      // Rule: Taker gets the turned card + 2 extra cards.
      // Everybody else gets 3 extra cards.
      // Total cards: 32. 4*5=20 dealt. 1 turned. 11 remaining.
      
      const takerId = this.players[this.bidTakerIndex!].id;
      
      // Give turned card to Taker
      if (this.turnedCard) {
          this.hands[takerId].push(this.turnedCard);
      }
      
      let deckPtr = 21;
      
      this.players.forEach((p, i) => {
          // Taker starts with 5 + 1(turned) = 6. Needs 2 to reach 8.
          // Others start with 5. Need 3 to reach 8.
          const isTaker = (i === this.bidTakerIndex);
          const count = isTaker ? 2 : 3;
          
          const newCards = this.deck.slice(deckPtr, deckPtr + count);
          this.hands[p.id].push(...newCards);
          deckPtr += count;
      });
      
      this.phase = 'playing';
      this.turnIndex = (this.dealerIndex + 1) % 4; // First to play (left of dealer)
      this.currentTrick = [];
      this.checkBotTurn();
  }

  playCard(socketId: string, cardId: string) {
    console.log(`[PlayCard] Request from ${socketId} for card ${cardId}. Phase: ${this.phase}`);
    if (this.phase !== 'playing') return;
    
    const userId = this.socketMap[socketId];
    if (!userId) {
        console.error(`[PlayCard] No userId found for socket ${socketId}`);
        return;
    }
    
    // Check if it's this user's turn
    const player = this.players[this.turnIndex];
    
    // Check against userId (persistent) OR socketId (active session)
    if (player.id !== userId && player.socketId !== socketId) {
        console.warn(`[PlayCard] Blocking Move: Turn is ${player.username} (${player.id}), but Action from ${userId}/${socketId}`);
        return; 
    }

    const hand = this.hands[userId];
    if (!hand) {
        console.error(`[PlayCard] No hand found for userId ${userId}`);
        return;
    }

    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
        console.error(`[PlayCard] Card ${cardId} not found in hand.`);
        return;
    }
    const card = hand[cardIndex];

    hand.splice(cardIndex, 1);
    this.currentTrick.push({ playerId: userId, card });
    console.log(`[PlayCard] Success via ${player.username}. Trick size: ${this.currentTrick.length}`);
    
    this.onUpdate();

    if (this.currentTrick.length === 4) {
      setTimeout(() => this.resolveTrick(), 2500); // Visual delay increased for animation
    } else {
      this.turnIndex = (this.turnIndex + 1) % 4;
      this.checkBotTurn();
    }
  }

  resolveTrick() {
    let bestCardInfo = this.currentTrick[0];
    const ledSuit = bestCardInfo.card.suit;
    
    for (let i = 1; i < 4; i++) {
        const challenge = this.currentTrick[i];
        const best = bestCardInfo.card;
        const chall = challenge.card;

        const isBestTrump = best.suit === this.trumpSuit;
        const isChallTrump = chall.suit === this.trumpSuit;

        if (isChallTrump && !isBestTrump) {
            bestCardInfo = challenge;
        } else if (isChallTrump && isBestTrump) {
            if (chall.getOrder(true) > best.getOrder(true)) bestCardInfo = challenge;
        } else if (!isChallTrump && !isBestTrump) {
            if (chall.suit === ledSuit && chall.getOrder(false) > best.getOrder(false)) {
                bestCardInfo = challenge;
            }
        }
    }

    let points = 0;
    this.currentTrick.forEach(t => points += t.card.getValue(t.card.suit === this.trumpSuit));
    
    const winnerIndex = this.players.findIndex(p => p.id === bestCardInfo.playerId);
    
    // Team Logic (0+2 vs 1+3)
    const winningTeam = (winnerIndex % 2 === 0) ? 'team1' : 'team2';
    this.currentScores[winningTeam] += points;

    this.turnIndex = winnerIndex; 
    
    // Save last trick for animation/history
    this.lastTrick = {
        winnerId: bestCardInfo.playerId,
        cards: [...this.currentTrick]
    };
    
    // Clear current trick
    this.currentTrick = [];

    // NOTIFY UPDATE AFTER TRICK RESOLUTION
    this.onUpdate();
    
    if (this.hands[this.players[0].id].length === 0) {
        // End Round
        this.currentScores[winningTeam] += 10; // Dix de der
        this.scores.team1 += this.currentScores.team1;
        this.scores.team2 += this.currentScores.team2;
        
        // Trigger Round Summary Modal
        this.roundSummary = { ...this.currentScores };
        this.onUpdate();

        // TODO: Check for Game Win (1000 pts)
        
        this.dealerIndex = (this.dealerIndex + 1) % 4;
        setTimeout(() => this.startRound(), 4000); // Increased delay to 4s for modal reading
    } else {
        this.checkBotTurn();
    }
  }

  checkBotTurn() {
    if (!this.hasConnectedHuman) {
        console.log('No humans connected. Pausing bot turn.');
        return;
    }
    const player = this.players[this.turnIndex];
    if (player.isBot) {
        setTimeout(() => {
            if (this.phase === 'bidding') {
                // ... Bidding Logic
                const takeChance = Math.random();
                // We use playerBid with a FAKE socket ID? No, we need internal method or bypass.
                // Or just overload playerBid to accept ID? 
                // Let's create internal helper or just modify logic to call logic directly.
                // Refactor: playCard and playerBid take socketId BUT we can call invalid-socket for bot if we mock it?
                // Better: Split logic.
                
                // Hack for MVP: Mock socket ID for bot? 
                // Or just insert logic here directly.
                if (this.biddingRound === 1 && takeChance > 0.8) {
                    this._botBid(player, 'take');
                } else if (this.biddingRound === 2 && takeChance > 0.9) {
                     const suits: Suit[] = ['H', 'D', 'C', 'S'];
                     const forbidden = this.turnedCard!.suit;
                     const pick = suits.find(s => s !== forbidden) || 'H';
                     this._botBid(player, 'take', pick);
                } else {
                    this._botBid(player, 'pass');
                }
            } else if (this.phase === 'playing') {
                const hand = this.hands[player.id];
                // Simplified Play Logic
                let validCards = hand;
                if (this.currentTrick.length > 0) {
                     const ledSuit = this.currentTrick[0].card.suit;
                     const hasSuit = hand.filter(c => c.suit === ledSuit);
                     if (hasSuit.length > 0) validCards = hasSuit;
                }
                const card = validCards[Math.floor(Math.random() * validCards.length)];
                
                // Internal Play for Bot
                const cardIndex = hand.indexOf(card);
                hand.splice(cardIndex, 1);
                this.currentTrick.push({ playerId: player.id, card });
                
                if (this.currentTrick.length === 4) {
                    setTimeout(() => this.resolveTrick(), 1000);
                } else {
                    this.turnIndex = (this.turnIndex + 1) % 4;
                    this.checkBotTurn();
                }
            }
        }, 2000);
    }
  }
  
  // Helper for Bot Bidding to avoid Socket ID lookup issue
  _botBid(player: any, action: 'take'|'pass', suit?: Suit) {
      const playerIndex = this.players.findIndex(p => p.id === player.id);
      
      // Track Bot History
      this.biddingHistory.push({
          playerId: player.id,
          username: player.username,
          action: action,
          suit: suit
      });

      if (action === 'take') {
          this.trumpSuit = this.biddingRound === 1 ? (this.turnedCard!.suit) : (suit || null);
          this.bidTakerIndex = playerIndex;
          this.finalizeDistribution();
          console.log(`Bot ${player.username} took ${this.trumpSuit}`);
      } else {
          this.turnIndex = (this.turnIndex + 1) % 4;
          if (this.turnIndex === (this.dealerIndex + 1) % 4) {
              if (this.biddingRound === 1) this.biddingRound = 2;
              else {
                  this.dealerIndex = (this.dealerIndex + 1) % 4;
                  this.startRound();
                  return;
              }
          }
          this.checkBotTurn();
      }
  }

  shuffle(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
  }
  
  getState() {
    return {
        players: this.players,
        currentTrick: this.currentTrick,
        scores: this.scores,
        currentScores: this.currentScores,
        trumpSuit: this.trumpSuit,
        phase: this.phase,
        turnIndex: this.turnIndex,
        dealerIndex: this.dealerIndex,
        turnedCard: this.turnedCard,
        biddingRound: this.biddingRound,
        biddingHistory: this.biddingHistory,
        lastTrick: this.lastTrick
    };
  }
}
