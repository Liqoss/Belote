export type Suit = 'H' | 'D' | 'C' | 'S';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
    suit: Suit;
    rank: Rank;
    id?: string;
}

export interface Player {
    id: string;
    socketId: string | null;
    username: string;
    isBot: boolean;
    disconnectedAt?: number;
}

export interface Play {
    playerId: string;
    card: Card;
    // For specific turn logic, knowing if it's the winner of the trick so far is computed
}

export interface Trick {
    winnerId: string;
    cards: Play[];
}

export interface GameState {
    phase: 'lobby' | 'dealing' | 'bidding' | 'playing' | 'round_summary';
    players: Player[];
    currentTrick: Play[];
    lastTrick: Trick | null;
    hands: Record<string, Card[]>; // Only sent partially to clients usually, but server has all
    scores: { team1: number, team2: number };
    currentScores: { team1: number, team2: number }; // Current round provisional
    roundSummary?: { team1: number, team2: number } | null;
    trumpSuit: Suit | null;
    turnedCard: Card | null;
    dealerIndex: number;
    turnIndex: number;
    bidTakerIndex: number | null;
    biddingRound: 1 | 2;
    biddingHistory: { playerId: string, username: string, action: 'pass' | 'take', suit?: Suit }[];
    readyPlayers: string[]; // List of player IDs who are ready for next round
}
