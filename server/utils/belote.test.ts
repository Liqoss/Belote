import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BeloteGame, Card } from './belote'
import type { Suit, Rank } from '~/types/belote'

describe('BeloteGame', () => {
  let game: BeloteGame
  let mockUpdate: any

  beforeEach(() => {
    mockUpdate = vi.fn()
    game = new BeloteGame(mockUpdate)
    // Add 4 dummy players
    for (let i = 0; i < 4; i++) {
        game.addPlayer(`socket_${i}`, `Player${i}`, `user_${i}`)
    }
  })

  it('should initialize with 4 players', () => {
    expect(game.players.length).toBe(4)
    expect(game.phase).toBe('lobby')
  })

  it('should deal cards correctly', () => {
    game.startGame()
    
    // Dealing is async with timeouts in the actual code, 
    // but for unit testing we might want to fast-forward or mock timers
    // However, BeloteGame uses real setTimeout. We can use vi.useFakeTimers()
    
    vi.useFakeTimers()
    game.startRound() // This is called by startGame usually
    vi.advanceTimersByTime(10000) // Forward 10s to cover all dealing animations (4s total)
    
    // After dealing, bid card should be turned
    expect(game.turnedCard).toBeDefined()
    expect(game.phase).toBe('bidding')
    
    // Players should have 5 cards each
    game.players.forEach(p => {
        expect(game.hands[p.id].length).toBe(5)
    })
    
    vi.useRealTimers()
  })
  
  it('should handle bidding correctly', () => {
      vi.useFakeTimers()
      game.startRound()
      vi.advanceTimersByTime(10000)
      
      const firstPlayer = game.players[game.turnIndex]
      const turnedSuit = game.turnedCard!.suit
      
      // First player takes
      game.playerBid(firstPlayer.socketId!, 'take')
      
      // Allow animation (finalizeDistribution has 1500ms delay)
      vi.advanceTimersByTime(2000)
      
      expect(game.trumpSuit).toBe(turnedSuit)
      expect(game.bidTakerIndex).toBe(game.turnIndex) // Note: turnIndex changes logic inside bid?
      
      // Taker should have 8 cards, others 8 cards eventually? 
      // The logic in finalizeDistribution gives: 2 to taker (5+2+1=8), 3 to others (5+3=8).
      expect(game.phase).toBe('playing')
      expect(game.hands[firstPlayer.id].length).toBe(8)
      game.players.forEach(p => {
          if (p.id !== firstPlayer.id) expect(game.hands[p.id].length).toBe(8)
      })
      
      vi.useRealTimers()
  })

  it('should determine the correct trick winner (No Trump)', () => {
      // Mock Trick: No Trump, H led
      const trump: Suit = 'S'
      game.trumpSuit = trump
      
      // Player 0: 10 of Hearts (10 points, Rank 10)
      // Player 1: 9 of Hearts (0 points, Rank 9)
      // Player 2: Ace of Hearts (11 points, Rank A) -> WINNER
      // Player 3: 7 of Hearts (0 points, Rank 7)
      
      const trick = [
          { playerId: 'p0', card: new Card('H', '10') },
          { playerId: 'p1', card: new Card('H', '9') },
          { playerId: 'p2', card: new Card('H', 'A') },
          { playerId: 'p3', card: new Card('H', '7') },
      ]
      
      const winner = game.getTrickWinner(trick, trump)
      expect(winner.playerId).toBe('p2')
  })

  it('should determine the correct trick winner (Trump Cut)', () => {
      // Mock Trick: Hearts led, Spades is Trump
      const trump: Suit = 'S'
      game.trumpSuit = trump
      
      // Player 0: Ace of Hearts (11 Pts)
      // Player 1: 7 of Spades (Trump) -> WINNER (Trump beats non-trump)
      // Player 2: King of Hearts
      // Player 3: 8 of Clubs (Discard)
      
      const trick = [
          { playerId: 'p0', card: new Card('H', 'A') },
          { playerId: 'p1', card: new Card('S', '7') },
          { playerId: 'p2', card: new Card('H', 'K') },
          { playerId: 'p3', card: new Card('C', '8') },
      ]
      
      const winner = game.getTrickWinner(trick, trump)
      expect(winner.playerId).toBe('p1') // Small trump beats big Ace
  })
  
  it('should determine the correct trick winner (OverTrump)', () => {
      // Mock Trick: Spades (Trump) led
      const trump: Suit = 'S'
      game.trumpSuit = trump
      
      // Player 0: 10 of Spades
      // Player 1: Jack of Spades (20pts) -> WINNER (Highest Trump)
      // Player 2: 9 of Spades (14pts)
      // Player 3: Ace of Spades (11pts)
      
      const trick = [
          { playerId: 'p0', card: new Card('S', '10') },
          { playerId: 'p1', card: new Card('S', 'J') },
          { playerId: 'p2', card: new Card('S', '9') },
          { playerId: 'p3', card: new Card('S', 'A') },
      ]
      
      const winner = game.getTrickWinner(trick, trump)
      expect(winner.playerId).toBe('p1') 
  })

  it('should count points correctly', () => {
       const trump: Suit = 'H'
       const c1 = new Card('H', 'J') // 20
       const c2 = new Card('H', '9') // 14
       const c3 = new Card('H', 'A') // 11
       const c4 = new Card('C', 'A') // 11 (Non trump)
       
       expect(c1.getValue(true)).toBe(20)
       expect(c2.getValue(true)).toBe(14)
       expect(c3.getValue(true)).toBe(11)
       expect(c4.getValue(false)).toBe(11)
  })

  it('should award Dix de Der (10 points) to the winner of the last trick', () => {
      game.startRound()
      
      // Fast forward to last trick state mock
      game.phase = 'playing'
      game.trumpSuit = 'H'
      game.currentScores = { team1: 0, team2: 0 }
      
      // Initialize hands dictionary and set to empty (simulating end of round)
      game.hands = {} 
      game.players.forEach(p => game.hands[p.id] = [])
      
      // Mock Last Trick Play
      game.currentTrick = [
          { playerId: game.players[0].id, card: new Card('C', 'A') }, // Winner (Non-trump Ace)
          { playerId: game.players[1].id, card: new Card('C', '7') },
          { playerId: game.players[2].id, card: new Card('C', '8') },
          { playerId: game.players[3].id, card: new Card('C', '9') },
      ]
      
      // Execute trick resolution
      game.resolveTrick() 
      
      // Assert IMMEDIATE state (before 8s timeout triggers new round)
      // Player 0 (Team 1) wins 11 pts + 10 pts (Dix de Der) = 21
      expect(game.currentScores.team1).toBe(21)
      expect(game.roundSummary).toBeDefined()
      expect(game.phase).toBe('round_summary')
      
      // Now we can advance timers if we want to test reset, but checking outcome is enough
      vi.useRealTimers()
  })
  
  it('should replace disconnected player with bot', () => {
      const pIndex = 2
      const pId = game.players[pIndex].id
      
      game.replaceWithBot(pIndex)
      
      const newP = game.players[pIndex]
      expect(newP.isBot).toBe(true)
      expect(newP.id).toBe(pId) // ID should be preserved for reconnection capability
      expect(newP.username).toContain('Bot')
  })

  it('should handle player disconnection and reconnection', () => {
      const p = game.players[0]
      const sockId = p.socketId!
      
      // Disconnect
      game.removePlayer(sockId)
      expect(p.socketId).toBeNull()
      expect(p.disconnectedAt).toBeDefined()
      expect(game.socketMap[sockId]).toBeUndefined()
      
      // Check hasConnectedHuman
      // We have 3 other connected players
      expect(game.hasConnectedHuman).toBe(true)
      
      // Reconnect
      game.addPlayer('new_socket_id', 'Player0', p.id)
      expect(p.socketId).toBe('new_socket_id')
      expect(p.disconnectedAt).toBeUndefined()
  })

  it('should wait for all humans to be ready before next round', () => {
      // Mock end of round state
      game.phase = 'round_summary'
      game.readyPlayers = []
      
      // We have 1 human (added in setup 'Player0') and 4 total players (all created as "fake" humans with sockets in beforeEach)
      // Actually beforeEach: game.addPlayer(socket_i, Player_i, user_i) -> All 4 are human in this test suite setup!
      
      // 1. Player 0 Ready
      game.playerSetReady('socket_0')
      expect(game.readyPlayers).toContain('user_0')
      expect(game.phase).toBe('round_summary') // Not all ready
      
      // 2. Player 1 Ready
      game.playerSetReady('socket_1')
      expect(game.phase).toBe('round_summary')
      
      // 3. Player 2 Ready
      game.playerSetReady('socket_2')
      expect(game.phase).toBe('round_summary')
      
      // 4. Player 3 Ready
      vi.useFakeTimers()
      game.playerSetReady('socket_3')
      vi.advanceTimersByTime(10000) // Deal cards (animations)
      
      expect(game.phase).toBe('bidding') // Should have started
      expect(game.readyPlayers).toEqual([]) // Should be reset
      vi.useRealTimers()
  })
})
