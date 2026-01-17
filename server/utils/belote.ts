import { type Suit, type Rank, type Card as ICard, type Player, type GameState, type Announcement, type AnnouncementType } from '~/types/belote';
import { createGame, addGameParticipant, updateUserElo } from './db';
import crypto from 'crypto';

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
  
  phase: 'lobby' | 'dealing' | 'bidding' | 'playing' | 'round_summary' | 'game_over' = 'lobby';
  
  deck: Card[] = [];
  dealerIndex: number = 0;
  turnIndex: number = 0; 
  biddingRound: 1 | 2 = 1;
  bidTakerIndex: number | null = null;
  biddingHistory: { playerId: string, username: string, action: 'pass' | 'take', suit?: Suit }[] = [];
  readyPlayers: string[];
  
  // Announcements
  possibleAnnouncements: Record<string, Announcement[]> = {}; // Private
  pendingDeclarations: Record<string, Announcement[]> = {}; // Player decisions
  validAnnouncements: Record<string, Announcement[]> = {}; // Public results = [];
  
  isResolving: boolean = false; // New State Flag
  
  // Anti-loop protection
  lastInteraction: number = Date.now();

  onUpdate: () => void = () => { this.lastInteraction = Date.now(); };

  constructor(onUpdate?: () => void) {
      this.onUpdate = onUpdate || (() => {});
  }
  
  // --- PLAYER MANAGEMENT ---

  addPlayer(socketId: string, username: string, userId: string, avatar?: string, elo?: number) {
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
                avatar,
                elo,
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

  /**
   * Called when user explicitly clicks "Quit"
   * If game hasn't started (Lobby), we can fully remove them.
   * If game started, we just disconnect them (they remain part of the game/restriction).
   */
  leaveSeat(socketId: string) {
      const userId = this.socketMap[socketId];
      if (!userId) return;

      if (this.phase === 'lobby') {
          // Fully remove from game
          this.players = this.players.filter(p => p.id !== userId);
          delete this.socketMap[socketId];
          console.log(`[BELOTE] User ${userId} left the lobby seat.`);
          
          // If room becomes empty, it might be reset or cleaned up by RoomManager logic?
          // RoomManager doesn't auto-delete rooms, but they become "empty".
      } else {
          // Game in progress: Just treat as disconnect
          this.removePlayer(socketId);
      }
  }

  checkDisconnects() {
      const NOW = Date.now();
      const TIMEOUT = 40 * 1000; // 40 seconds
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
    this.deck = [];
    suits.forEach(s => ranks.forEach(r => this.deck.push(new Card(s, r))));
    
    // --- RIGGED DECK FOR TESTING (FORCE TIERCE/QUINTE) ---
    // User requested to force "mes cartes" (my cards) to have tierce/quinte.
    // Assuming "me" is usually Player 0 or the first human.
    // Let's rig Player 0 to have a Quinte Flush in Hearts (9, 10, J, Q, K).
    
    // 1. Remove specific cards
    const riggedIds = ['9H', '10H', 'JH', 'QH', 'KH'];
    this.deck = this.deck.filter(c => !riggedIds.includes(c.id));
    this.shuffle(this.deck);
    
    // 2. Create the rigged set
    const riggedCards = [
        new Card('H', '9'),
        new Card('H', '10'),
        new Card('H', 'J'),
        new Card('H', 'Q'),
        new Card('H', 'K')
    ];
    
    // 3. Place them at the TOP of the deck so they are dealt to Player 0.
    // Dealing logic: 3 cards to P0, then 3 to P1... then 2 to P0...
    // Total 5 cards initially. 
    // If we put 5 rigged cards at top:
    // P0 gets cards 0,1,2.
    // P1 gets 3,4,5. 
    // P2 gets 6,7,8.
    // P3 gets 9,10,11.
    // P0 gets 12,13. -> Total 5.
    
    // So indices for P0 are: 0, 1, 2 AND 12, 13.
    // We need to insert rigged cards at 0, 1, 2, 12, 13.
    
    // Steps:
    // Insert 3 cards at 0.
    // Insert 2 cards at 12 (after 3+3+3+3 = 12 cards have been passed? Wait).
    // Initial deck size = 32.
    // Logic: splicing.
    
    this.deck.splice(0, 0, riggedCards[0], riggedCards[1], riggedCards[2]); // 0,1,2
    // Now deck has 3 rigged + rest.
    // We need to skip: P1(3), P2(3), P3(3) = 9 cards.
    // Index 0,1,2 are P0.
    // Index 3..11 are P1,P2,P3.
    // Index 12 is next for P0.
    this.deck.splice(12, 0, riggedCards[3], riggedCards[4]);
    
    // For later dealing (last 3 cards), we leave it random.
    // So P0 will have 9H, 10H, JH + QH, KH + 3 randoms.
    // -----------------------------------------------------

    // this.shuffle(this.deck); // DO NOT SHUFFLE AGAIN obviously

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
      // LOCK: Prevent double-execution
      if (this.phase !== 'bidding') return;
      this.phase = 'dealing'; 
      this.onUpdate();

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
      // IDENTITY CHECK (Logging Only - No destructive repair)
      const audit = this.players.map(p => `${p.username}:${this.hands[p.id]?.length}`);
      console.log(`[BELOTE] Distribution Finalized. Hands: ${audit.join(', ')}`);
      
      // Validation: If any hand != 8, something is structurally wrong with dealing.
      // We do NOT attempt to "repair" by adding random cards as that creates duplicates.
      if (this.players.some(p => this.hands[p.id]?.length !== 8)) {
          console.error('[BELOTE] CRITICAL: Hand size mismatch detected. Game state is likely corrupted.');
      }
      
      this.onUpdate(); // Show chaos (unsorted but full hand)

      // Calculate Announcements
      this.players.forEach(p => this.calculateAnnouncements(p.id));

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

  processCardPlay(playerId: string, cardId: string) {
      if (this.phase !== 'playing') return;
      
      // CRITICAL: Block input during trick resolution (Animation window)
      if (this.isResolving) {
          console.warn(`[BELOTE] Blocked play from ${playerId} (Resolving Phase)`);
          return;
      }
      
      // CRITICAL: Prevent playing if trick is full (secondary check)
      if (this.currentTrick.length >= 4) {
          console.warn(`[BELOTE] Blocked play from ${playerId} (Trick full)`);
          return;
      }

      this.lastInteraction = Date.now(); // Reset Watchdog on valid input
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    
    // Safety against race conditions or double-plays
    if (playerIndex !== this.turnIndex) {
        console.warn(`[BELOTE] Blocked out-of-turn play by ${playerId} (Index ${playerIndex}). Current Turn: ${this.turnIndex}`);
        return;
    }

    const hand = this.hands[playerId];
    const cardIndex = hand?.findIndex(c => c.id === cardId);
    
    if (!hand || cardIndex === -1) {
        console.error(`[BELOTE] Invalid card play: ${cardId} by ${playerId}`);
        return;
    }

    const card = hand[cardIndex];
    hand.splice(cardIndex, 1);
    
    this.currentTrick.push({ playerId: playerId, card });
    this.onUpdate();

    if (this.currentTrick.length === 4) {
      this.isResolving = true; // LOCK STATE
      setTimeout(() => {
          try {
              this.resolveTrick();
          } catch (e) {
              console.error('[BELOTE] CRITICAL ERROR in resolveTrick:', e);
              this.isResolving = false; // Emergency Unlock
              // Attempt recovery
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
    
    // Resolve Announcements (End of First Trick)
    if (this.players.some(p => this.hands[p.id]?.length === 7)) {
        this.resolveAnnouncements();
    }
    
    // 3. Update State
    this.turnIndex = winnerIndex;
    console.log(`[BELOTE] Trick Won by ${winnerInfo.playerId} (Index ${winnerIndex}). New Turn: ${this.turnIndex}`);
    this.lastTrick = {
        winnerId: winnerInfo.playerId,
        cards: [...this.currentTrick]
    };
    this.currentTrick = [];
    this.isResolving = false; // UNLOCK STATE
    this.onUpdate();
    
    // 4. Check End of Round
    // 4. Check End of Round
    // Robust check: If ANY player has no cards, round ought to be over (assuming sync).
    // Safest: Check the winner's hand (since they just played).
    const isEndOfRound = this.hands[winnerInfo.playerId].length === 0;

    if (isEndOfRound) {
        // FORCE CLEANUP: Ensure all hands are empty to prevent "ghost card" desync
        this.players.forEach(p => this.hands[p.id] = []);
        
        this.currentScores[winningTeam] += 10; // Dix de Der
        this.scores.team1 += this.currentScores.team1;
        this.scores.team2 += this.currentScores.team2;
        
        this.roundSummary = { ...this.currentScores };
        
        // CHECK VICTORY (501 Points)
        if (this.scores.team1 >= 501 || this.scores.team2 >= 501) {
             console.log('[BELOTE] Game Over. Target reached.');
             this.phase = 'game_over';
             this.readyPlayers = [];

             // --- SAVE TO DB & CALC ELO ---
             try {
                 const winnerTeam = this.scores.team1 > this.scores.team2 ? 'team1' : 'team2';
                 const gameId = crypto.randomUUID();
                 
                 // 1. Create Game
                 createGame({
                     id: gameId,
                     team1_score: this.scores.team1,
                     team2_score: this.scores.team2,
                     winner_team: winnerTeam
                 });

                 // 2. Calculate ELO
                 // Group players by team
                 const team1Players = this.players.filter((p, i) => i % 2 === 0); // 0 & 2
                 const team2Players = this.players.filter((p, i) => i % 2 !== 0); // 1 & 3

                 const avgElo1 = team1Players.reduce((sum, p) => sum + (p.elo || 100), 0) / 2;
                 const avgElo2 = team2Players.reduce((sum, p) => sum + (p.elo || 100), 0) / 2;

                 const K = 32;
                 const expected1 = 1 / (1 + Math.pow(10, (avgElo2 - avgElo1) / 400));
                 const expected2 = 1 / (1 + Math.pow(10, (avgElo1 - avgElo2) / 400));

                 const actual1 = winnerTeam === 'team1' ? 1 : 0;
                 const actual2 = winnerTeam === 'team2' ? 1 : 0;

                 const change1 = Math.round(K * (actual1 - expected1));
                 const change2 = Math.round(K * (actual2 - expected2));

                 // Apply & Save
                 this.players.forEach((p, i) => {
                     // Only track humans (or bots if we wanted, but let's stick to humans)
                     if (!p.isBot) {
                         const team = (i % 2 === 0) ? 'team1' : 'team2';
                         const change = (team === 'team1') ? change1 : change2;
                         const oldElo = p.elo || 100;
                         let newElo = oldElo + change;
                         if (newElo < 0) newElo = 0; // Floor

                         // Update Memory
                         p.elo = newElo;

                         // Save History
                         addGameParticipant({
                             game_id: gameId,
                             user_id: p.id,
                             team: team,
                             elo_before: oldElo,
                             elo_change: change
                         });

                         // Update User DB
                         updateUserElo(p.id, newElo);
                     }
                 });

             } catch (e) {
                 console.error('[BELOTE] DB Save Error:', e);
             }

        } else {
             this.phase = 'round_summary'; // Blocking phase
             this.readyPlayers = []; // Reset ready state
             this.dealerIndex = (this.dealerIndex + 1) % 4;
        }

        this.onUpdate();
        // Wait for players to click Ready
    } else {
        // Wait for visual cleanup (trick animation) before bot plays
        setTimeout(() => {
             this.checkBotTurn();
        }, 1500);
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
  
  // --- ANNOUNCEMENTS LOGIC ---

  calculateAnnouncements(playerId: string) {
      const hand = this.hands[playerId];
      if (!hand) return;

      const announcements: Announcement[] = [];
      const rankValues: Record<string, number> = { 'A': 7, 'K': 6, 'Q': 5, 'J': 4, '10': 3, '9': 2, '8': 1, '7': 0 };

      // 1. SQUARES (Carrés)
      const rankCounts: Record<string, Card[]> = {};
      hand.forEach(c => {
          if (!rankCounts[c.rank]) rankCounts[c.rank] = [];
          rankCounts[c.rank].push(c);
      });

      Object.entries(rankCounts).forEach(([rank, cards]) => {
          if (cards.length === 4) {
              let pts = 0;
              // Values: J=200, 9=150, A/10/K/Q=100. 8/7=0 (No square)
              if (rank === 'J') pts = 200;
              else if (rank === '9') pts = 150;
              else if (['A', '10', 'K', 'Q'].includes(rank)) pts = 100;
              
              if (pts > 0) {
                  announcements.push({
                      type: 'square',
                      cards: cards,
                      height: rank as Rank,
                      points: pts
                  });
              }
          }
      });

      // 2. SEQUENCES (Suites)
      const suits: Suit[] = ['H', 'D', 'C', 'S'];
      suits.forEach(suit => {
          // Sort descending by rank
          const suitCards = hand.filter(c => c.suit === suit).sort((a, b) => rankValues[b.rank] - rankValues[a.rank]);
          if (suitCards.length < 3) return;

          let currentSeq: Card[] = [suitCards[0]];
          
          for (let i = 1; i < suitCards.length; i++) {
              const prev = suitCards[i-1];
              const curr = suitCards[i];
              
              if (rankValues[prev.rank] - rankValues[curr.rank] === 1) {
                  currentSeq.push(curr);
              } else {
                  this.pushSequenceIfValid(announcements, currentSeq);
                  currentSeq = [curr];
              }
          }
          this.pushSequenceIfValid(announcements, currentSeq);
      });

      this.possibleAnnouncements[playerId] = announcements;
      if (announcements.length > 0) {
          console.log(`[BELOTE] Calculated announcements for ${this.players.find(p => p.id === playerId)?.username}: Found ${announcements.length}`);
      }
  }

  pushSequenceIfValid(list: Announcement[], seq: Card[]) {
      if (seq.length >= 3) {
          const type = seq.length === 3 ? 'tierce' : (seq.length === 4 ? 'quarte' : 'quinte');
          // Points: Tierce=20, Quarte=50, Quinte=100
          // If > 5, counts as Quinte (100).
          const points = seq.length >= 5 ? 100 : (seq.length === 4 ? 50 : 20);
          
          list.push({
              type: type,
              cards: [...seq], 
              height: seq[0].rank, 
              suit: seq[0].suit,
              points: points
          });
      }
  }

  playerDeclare(socketId: string, declaration: boolean) {
      const userId = this.socketMap[socketId];
      if (!userId) return;
      
      if (this.phase !== 'playing') return;

      if (declaration) {
          this.pendingDeclarations[userId] = this.possibleAnnouncements[userId] || [];
          console.log(`[BELOTE] Player ${userId} DECLARED.`);
      } else {
           this.pendingDeclarations[userId] = []; // Explicit refusal
           console.log(`[BELOTE] Player ${userId} REFUSED announcements.`);
      }
  }

  resolveAnnouncements() {
      // Logic:
      // 1. Compare Team 1 Best vs Team 2 Best.
      // 2. Best announcement wins.
      // 3. Winner scores ALL their team's announcements. Loser scores 0.
      // 4. Equality? Logic is complex (Height, then Rank, then "Atout?"). 
      //    Simulated: Team 1 Priority if strictly better.
      
      const team1Ids = this.players.filter((_, i) => i % 2 === 0).map(p => p.id);
      const team2Ids = this.players.filter((_, i) => i % 2 !== 0).map(p => p.id);

      const t1Decls = team1Ids.flatMap(id => this.pendingDeclarations[id] || []);
      const t2Decls = team2Ids.flatMap(id => this.pendingDeclarations[id] || []);

      if (t1Decls.length === 0 && t2Decls.length === 0) return;

      const getVal = (a: Announcement) => {
          // Priority: Square > Quinte > Quarte > Tierce
          const typeScore = { 'square': 4000, 'quinte': 3000, 'quarte': 2000, 'tierce': 1000 }[a.type];
          // Height Score
          const rankScore = { 'A': 7, 'K': 6, 'Q': 5, 'J': 4, '10': 3, '9': 2, '8': 1, '7': 0 }[a.height];
          return typeScore + rankScore;
      };
      
      const best1 = t1Decls.sort((a,b) => getVal(b) - getVal(a))[0];
      const best2 = t2Decls.sort((a,b) => getVal(b) - getVal(a))[0];
      
      let winnerInfo: { team: 'team1' | 'team2', decls: Announcement[] } | null = null;
      
      if (best1 && !best2) winnerInfo = { team: 'team1', decls: t1Decls };
      else if (!best1 && best2) winnerInfo = { team: 'team2', decls: t2Decls };
      else if (best1 && best2) {
          const v1 = getVal(best1);
          const v2 = getVal(best2);
          if (v1 > v2) winnerInfo = { team: 'team1', decls: t1Decls };
          else if (v2 > v1) winnerInfo = { team: 'team2', decls: t2Decls };
          else {
              // Exact tie (same type, same height).
              // Check Trump?
              // Standard: Trump sequence beats non-trump.
              // If both non-trump or both trump -> Cancelled?
              // Or "Equality cancels"?
              // Simplification: Priority to Team 1 if Trump.
               const is1Trump = (best1.suit === this.trumpSuit);
               const is2Trump = (best2.suit === this.trumpSuit);
               
               if (is1Trump && !is2Trump) winnerInfo = { team: 'team1', decls: t1Decls };
               else if (!is1Trump && is2Trump) winnerInfo = { team: 'team2', decls: t2Decls };
               else {
                   winnerInfo = null; // Annulled
               }
          }
      }

      if (winnerInfo) {
          let total = 0;
          winnerInfo.decls.forEach(d => total += d.points);
          this.currentScores[winnerInfo.team] += total;
          
          // Publish for UI
          const winIds = (winnerInfo.team === 'team1' ? team1Ids : team2Ids);
          winIds.forEach(id => {
             if (this.pendingDeclarations[id]) {
                 this.validAnnouncements[id] = this.pendingDeclarations[id];
             }
          });
      }
      
      // Cleanup
      this.pendingDeclarations = {};
  }

  getTrickWinner(trick: { playerId: string, card: Card }[], trump: Suit): { playerId: string, card: Card } {
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
      if (this.isResolving) return; // Do not interrupt resolution
      
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
        
      // CRITICAL SAFETY: Do not schedule turn if hand is empty
      if (this.phase === 'playing' && (!this.hands[player.id] || this.hands[player.id].length === 0)) {
          console.warn(`[BELOTE] Skipped Bot Turn for ${player.username} (Hand Empty). Waiting for End-of-Round resolution.`);
          return;
      }

      // Delay for realism (1.0s to 2.0s) - Requested speed
      const delay = 1000 + Math.random() * 1000;
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
      // Sort logic: Suit (Trump first, then H/C/D/S)
      // Rank: Power-based descending (Strongest to Weakest)
      
      const suitOrder = { 'H': 0, 'C': 1, 'D': 2, 'S': 3 };
      
      // Standard (No Trump) Power: A, 10, K, Q, J, 9, 8, 7
      const rankOrderNoTrump: Record<string, number> = { 'A':7, '10':6, 'K':5, 'Q':4, 'J':3, '9':2, '8':1, '7':0 };
      
      // Trump Power: J, 9, A, 10, K, Q, 8, 7
      const rankOrderTrump: Record<string, number> = { 'J':7, '9':6, 'A':5, '10':4, 'K':3, 'Q':2, '8':1, '7':0 };
      
      const trumpSuit = this.trumpSuit;

      this.players.forEach(p => {
          if (this.hands[p.id]) {
              this.hands[p.id].sort((a, b) => {
                  // 1. Sort by Suit 
                  // If Trump exists, we might want Trump to be first (or last). 
                  // Let's keep standard Suit Order for stability, unless user requested Trump first?
                  // "tries les cartes... dans l'ordre de puissance" usually implies within the suit.
                  // I'll stick to fixed suit order to avoid confusion, but sort RANKS by power.
                  
                  if (a.suit !== b.suit) {
                       // Optional: If one is trump, put it first? 
                       // Let's keep it simple: Fixed suit order.
                       return suitOrder[a.suit] - suitOrder[b.suit];
                  }
                  
                  // 2. Sort by Rank (Power Descending)
                  const isTrump = trumpSuit && a.suit === trumpSuit;
                  const order = isTrump ? rankOrderTrump : rankOrderNoTrump;
                  
                  // Descending Power (Strongest Left)
                  return order[b.rank] - order[a.rank];
              });
          }
      });
  }
}
