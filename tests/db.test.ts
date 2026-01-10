import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import db, { createUser, findUserByEmail, findUserById, createGame, addGameParticipant } from '../server/utils/db'; // Default export is db instance

describe('Database Utils', () => {
    
    // Mock Data
    const testUser = {
        id: 'test_user_1',
        email: 'test@test.com',
        username: 'TestUser',
        password: 'hashed_password',
        avatar: null,
        security_question: 'Q',
        security_answer: 'A'
    };

    const testGame = {
        id: 'game_1',
        team1_score: 501,
        team2_score: 400,
        winner_team: 'team1'
    };

    beforeEach(() => {
        // Clean up
        db.prepare('DELETE FROM game_participants').run();
        db.prepare('DELETE FROM games').run();
        db.prepare('DELETE FROM users').run();
    });

    it('should create and retrieve a user', () => {
        createUser(testUser);
        const user = findUserByEmail('test@test.com');
        expect(user).toBeDefined();
        // @ts-ignore
        expect(user.username).toBe('TestUser');
    });

    it('should create a game and participants', () => {
        createUser(testUser);
        createGame(testGame);
        
        addGameParticipant({
            game_id: testGame.id,
            user_id: testUser.id,
            team: 'team1',
            elo_before: 100,
            elo_change: 10
        });

        // Verify via raw query for now
        const part = db.prepare('SELECT * FROM game_participants WHERE game_id = ?').get(testGame.id);
        expect(part).toBeDefined();
        // @ts-ignore
        expect(part.user_id).toBe(testUser.id);
    });

});
