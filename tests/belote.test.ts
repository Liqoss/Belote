import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BeloteGame, Card } from '../server/utils/belote'
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
    
    vi.useFakeTimers()
    game.startRound() 
    vi.advanceTimersByTime(10000) 
    
    expect(game.turnedCard).toBeDefined()
    expect(game.phase).toBe('bidding')
    
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
      
      // Allow animation (finalizeDistribution has delays)
      // FIX: Increased from 2000 to 5000 to ensure state transition
      vi.advanceTimersByTime(5000)
      
      expect(game.trumpSuit).toBe(turnedSuit)
      expect(game.bidTakerIndex).toBe(game.turnIndex) 
      
      expect(game.phase).toBe('playing')
      expect(game.hands[firstPlayer.id].length).toBe(8)
      game.players.forEach(p => {
          if (p.id !== firstPlayer.id) expect(game.hands[p.id].length).toBe(8)
      })
      
      vi.useRealTimers()
  })

  it('should determine the correct trick winner (No Trump)', () => {
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
      const trump: Suit = 'S'
      game.trumpSuit = trump
      
      // Player 0: Ace of Hearts (11 Pts)
      // Player 1: 7 of Spades (Trump) -> WINNER
      // Player 2: King of Hearts
      // Player 3: 8 of Clubs (Discard)
      
      const trick = [
          { playerId: 'p0', card: new Card('H', 'A') },
          { playerId: 'p1', card: new Card('S', '7') },
          { playerId: 'p2', card: new Card('H', 'K') },
          { playerId: 'p3', card: new Card('C', '8') },
      ]
      
      const winner = game.getTrickWinner(trick, trump)
      expect(winner.playerId).toBe('p1') 
  })
  
  it('should determine the correct trick winner (OverTrump)', () => {
      const trump: Suit = 'S'
      game.trumpSuit = trump
      
      // Player 0: 10 of Spades
      // Player 1: Jack of Spades (20pts) -> WINNER
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
      
      // Fast forward
      game.phase = 'playing'
      game.trumpSuit = 'H'
      game.currentScores = { team1: 0, team2: 0 }
      
      game.hands = {} 
      game.players.forEach(p => game.hands[p.id] = [])
      
      // Mock Last Trick
      game.currentTrick = [
          { playerId: game.players[0].id, card: new Card('C', 'A') }, // Winner
          { playerId: game.players[1].id, card: new Card('C', '7') },
          { playerId: game.players[2].id, card: new Card('C', '8') },
          { playerId: game.players[3].id, card: new Card('C', '9') },
      ]
      
      game.resolveTrick() 
      
      // Player 0 (Team 1) wins 11 + 10 = 21
      expect(game.currentScores.team1).toBe(21)
      expect(game.roundSummary).toBeDefined()
      expect(game.phase).toBe('round_summary')
      
      vi.useRealTimers()
  })
  
  it('should replace disconnected player with bot', () => {
      const pIndex = 2
      const pId = game.players[pIndex].id
      
      game.replaceWithBot(pIndex)
      
      const newP = game.players[pIndex]
      expect(newP.isBot).toBe(true)
      expect(newP.id).toBe(pId) 
      expect(newP.username).toContain('Bot')
  })

  it('should handle player disconnection and reconnection', () => {
      const p = game.players[0]
      const sockId = p.socketId!
      
      // Disconnect
      game.removePlayer(sockId)
      expect(p.socketId).toBeNull()
      expect(game.hasConnectedHuman).toBe(true)
      
      // Reconnect
      game.addPlayer('new_socket_id', 'Player0', p.id)
      expect(p.socketId).toBe('new_socket_id')
      expect(p.disconnectedAt).toBeUndefined()
  })

  it('should wait for all humans to be ready before next round', () => {
      game.phase = 'round_summary'
      game.readyPlayers = []
      
      game.playerSetReady('socket_0')
      expect(game.readyPlayers).toContain('user_0')
      expect(game.phase).toBe('round_summary') 
      
      game.playerSetReady('socket_1')
      game.playerSetReady('socket_2')
      
      vi.useFakeTimers()
      game.playerSetReady('socket_3')
      vi.advanceTimersByTime(10000) 
      
      expect(game.phase).toBe('bidding') 
      expect(game.readyPlayers).toEqual([]) 
      vi.useRealTimers()
  })
})
