import { getCookie } from 'h3';
import db from '~/server/utils/db'; // Default export is db instance

export default defineEventHandler((event) => {
    const userId = getCookie(event, 'belote_session');
    if (!userId) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    try {
        // Prepare Statement
        // Join game_participants with games to get details
        const stmt = db.prepare(`
            SELECT 
                g.id, 
                g.finished_at, 
                g.winner_team, 
                g.team1_score, 
                g.team2_score,
                gp.team as my_team,
                gp.elo_change
            FROM game_participants gp
            JOIN games g ON gp.game_id = g.id
            WHERE gp.user_id = ?
            ORDER BY g.finished_at DESC
            LIMIT 5
        `);
        
        const history = stmt.all(userId);
        
        return { success: true, history };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});
