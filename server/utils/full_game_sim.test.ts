import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BeloteGame, Card } from './belote'
import type { Suit } from '~/types/belote'

describe('Full Game Simulation', () => {
  let game: BeloteGame
  let logs: string[] = []

  const log = (msg: string) => {
      logs.push(msg)
      console.log(msg)
  }

  beforeEach(() => {
    logs = []
    game = new BeloteGame(() => {})
  })

  it('should play a full game from start to finish', async () => {
    vi.useFakeTimers()

    // 1. Setup
    log('--- SETUP ---')
    game.addPlayer('s1', 'Human', 'u1')
    game.addBots() // Adds 3 bots
    expect(game.players.length).toBe(4)
    log('Players joined: ' + game.players.map(p => p.username).join(', '))

    // 2. Start
    log('--- STARTING BOARD ---')
    game.startGame()
    vi.runAllTimers() // Deal cards
    expect(game.phase).toBe('bidding')
    log(`Turned Card: ${game.turnedCard?.id}`)

    // 3. Bidding - Force FIRST player to Take to ensure we play immediately
    const firstPlayerIndex = game.turnIndex
    const firstPlayer = game.players[firstPlayerIndex]
    
    log(`Forcing ${firstPlayer.username} to TAKE to start game simulation.`)
    
    if (firstPlayer.isBot) {
        // Manually trigger processBid to force it, instead of waiting for random bot logic
        game.processBid(firstPlayerIndex, 'take', game.turnedCard?.suit)
    } else {
        game.playerBid('s1', 'take')
    }
    
    expect(game.phase).toBe('playing')
    log(`--- PLAYING PHASE (Trump: ${game.trumpSuit}) ---`)

    // 4. Playing - 8 Tricks
    for (let trickNum = 1; trickNum <= 8; trickNum++) {
        log(`\n=== TRICK ${trickNum} ===`)
        
        for (let i = 0; i < 4; i++) {
             const currentPlayer = game.players[game.turnIndex]
             
             if (currentPlayer.isBot) {
                 log(`Bot ${currentPlayer.username} is thinking...`)
                 // Advance timer to trigger bot play
                 vi.runAllTimers()
                 const played = game.currentTrick[game.currentTrick.length - 1]
                 if (played) log(`Bot played ${played.card.id}`)
                 else log(`Bot failed to play!`)
             } else {
                 // Human Turn
                 log(`Human Turn (Hand: ${game.hands['u1'].map(c => c.id).join(' ')})`)
                 
                 // Smart Auto-Play logic for simulation
                 // Must pick a playable card
                 const hand = game.hands['u1']
                 let validCard: Card | undefined
                 
                 // Simple logic to find valid card
                 if (game.currentTrick.length === 0) {
                     validCard = hand[0]
                 } else {
                     const ledSuit = game.currentTrick[0].card.suit
                     const hasSuit = hand.filter(c => c.suit === ledSuit)
                     if (hasSuit.length > 0) validCard = hasSuit[0]
                     else validCard = hand[0]
                 }
                 
                 if (validCard) {
                     log(`Human plays ${validCard.id}`)
                     game.playCard('s1', validCard.id)
                 } else {
                     log('HUMAN HAS NO CARDS?!')
                 }
             }
        }
        
        // Trick complete, check winner
        expect(game.currentTrick.length).toBe(4)
        vi.runAllTimers() // Resolve trick (2s delay)
        
        if (game.lastTrick) {
            const winnerName = game.players.find(p => p.id === game.lastTrick!.winnerId)?.username
            log(`Winner of trick: ${winnerName}`)
        }
    }

    log('\n--- END OF ROUND ---')
    // Should be in round_summary or ready for next round
    // Trigger any final timers (8s delay)
    vi.runAllTimers()
    
    expect(game.phase).toBe('dealing') // Should have restarted or waiting
    log(`Final Scores - Team1: ${game.scores.team1}, Team2: ${game.scores.team2}`)
    
    vi.useRealTimers()
  })
})
