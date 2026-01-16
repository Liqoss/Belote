import { BeloteGame } from './belote';

const MAX_ROOMS = 100;

class RoomManager {
  rooms: Map<number, BeloteGame> = new Map();

  constructor() {
    // Rooms are created lazily
  }

  getRoom(roomId: number): BeloteGame | null {
    if (roomId < 1 || roomId > MAX_ROOMS) return null;

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new BeloteGame());
    }
    return this.rooms.get(roomId)!;
  }

  /**
   * Returns a list of rooms to display in the lobby.
   * If userId is provided and that user is inside a room, return ONLY that room.
   */
  getLobbyList(userId?: string) {
    const list = [];
    let emptyCount = 0;
    let userRoomId: number | null = null;

    // 1. Find if user is already in a room
    if (userId) {
        for (const [id, game] of this.rooms) {
            if (game.players.some(p => p.id === userId)) {
                userRoomId = id;
                break;
            }
        }
    }

    // 2. If user is restricted to a room, return only that one
    if (userRoomId !== null) {
        const game = this.rooms.get(userRoomId);
        if (game) {
             return [{
                id: userRoomId,
                status: game.phase === 'lobby' ? 'waiting' : 'playing',
                playerCount: game.players.length,
                players: game.players.map(p => ({ id: p.id, username: p.username, avatar: p.avatar, isBot: p.isBot })),
                scores: game.scores
             }];
        }
    }

    // 3. Otherwise return full list
    for (let i = 1; i <= MAX_ROOMS; i++) {
        const game = this.rooms.get(i);
        const isEmpty = !game || game.players.length === 0;

        if (!isEmpty) {
            // Active Room
            list.push({
                id: i,
                status: game!.phase === 'lobby' ? 'waiting' : 'playing',
                playerCount: game!.players.length,
                players: game!.players.map(p => ({ id: p.id, username: p.username, avatar: p.avatar, isBot: p.isBot })),
                scores: game!.scores
            });
        } else {
            // Empty Room
            if (emptyCount < 3) {
                list.push({
                    id: i,
                    status: 'empty',
                    playerCount: 0,
                    players: [],
                    scores: { team1: 0, team2: 0 }
                });
                emptyCount++;
            }
        }
    }
    return list;
  }
}

// Singleton instance
export const roomManager = new RoomManager();
