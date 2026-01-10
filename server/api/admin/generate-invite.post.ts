import { defineEventHandler, getCookie, createError } from 'h3'
import { v4 as uuidv4 } from 'uuid'
import { findUserById, createInvite } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    // 1. Check Auth (Cookie)
    const userId = getCookie(event, 'belote_session');
    if (!userId) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    // 2. Check Admin Role
    const user = findUserById(userId) as any;
    if (!user || user.role !== 'admin') {
         throw createError({ statusCode: 403, statusMessage: 'Forbidden: Admins only' });
    }

    // 3. Generate Token
    const token = uuidv4();
    createInvite(token, userId);

    return { success: true, token, link: `/signup?token=${token}` }
})
