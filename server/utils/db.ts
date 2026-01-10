import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dbDir = path.resolve('./data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

const dbPath = path.join(dbDir, 'belote.db');
const db = new Database(dbPath);

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT,
    elo INTEGER DEFAULT 100,
    security_question TEXT,
    security_answer TEXT,
    role TEXT DEFAULT 'player',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invitations (
    token TEXT PRIMARY KEY,
    created_by TEXT,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    finished_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    team1_score INTEGER,
    team2_score INTEGER,
    winner_team TEXT
  );

  CREATE TABLE IF NOT EXISTS game_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT,
    user_id TEXT,
    team TEXT,
    elo_before INTEGER,
    elo_change INTEGER,
    FOREIGN KEY(game_id) REFERENCES games(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Auto-Migration for new columns and tables
try {
    db.exec('ALTER TABLE users ADD COLUMN security_question TEXT');
    db.exec('ALTER TABLE users ADD COLUMN security_answer TEXT');
} catch (e) { /* Ignore */ }

try {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'player'");
    console.log('Migrated DB: Added role column');
} catch (e) { /* Ignore */ }

// Admin Migration: First user becomes Admin
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
if (userCount.count > 0) {
    // Check if any admin exists
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as any;
    if (adminCount.count === 0) {
         // Make the very first user (by created_at) an admin
         const firstUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get() as any;
         if (firstUser) {
             db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(firstUser.id);
             console.log(`Migrated DB: Promoted user ${firstUser.id} to ADMIN.`);
         }
    }
}


export const createUser = (user: any) => {
    const stmt = db.prepare('INSERT INTO users (id, email, username, password, avatar, security_question, security_answer, role) VALUES (@id, @email, @username, @password, @avatar, @security_question, @security_answer, @role)');
    return stmt.run(user);
};

export const updateUser = (userId: string, updates: any) => {
    const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    const stmt = db.prepare(`UPDATE users SET ${fields} WHERE id = @id`);
    return stmt.run({ ...updates, id: userId });
};

export const findUserByEmail = (email: string) => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
};

export const findUserById = (id: string) => {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
};

export const updateUserElo = (userId: string, newElo: number) => {
    const stmt = db.prepare('UPDATE users SET elo = ? WHERE id = ?');
    return stmt.run(newElo, userId);
};

export const createGame = (game: any) => {
    const stmt = db.prepare('INSERT INTO games (id, team1_score, team2_score, winner_team) VALUES (@id, @team1_score, @team2_score, @winner_team)');
    return stmt.run(game);
};

export const addGameParticipant = (participant: any) => {
    const stmt = db.prepare('INSERT INTO game_participants (game_id, user_id, team, elo_before, elo_change) VALUES (@game_id, @user_id, @team, @elo_before, @elo_change)');
    return stmt.run(participant);
};

export const createInvite = (token: string, createdBy: string) => {
    const stmt = db.prepare('INSERT INTO invitations (token, created_by) VALUES (?, ?)');
    return stmt.run(token, createdBy);
};

export const validateInvite = (token: string) => {
    const stmt = db.prepare('SELECT * FROM invitations WHERE token = ? AND used = 0');
    return stmt.get(token);
};

export const markInviteUsed = (token: string) => {
    const stmt = db.prepare('UPDATE invitations SET used = 1 WHERE token = ?');
    return stmt.run(token);
};

export const getUserCount = () => {
    return db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
};

export default db;
