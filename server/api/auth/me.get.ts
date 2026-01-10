import { findUserById } from '~/server/utils/db'

export default defineEventHandler((event) => {
    const userId = getCookie(event, 'belote_session')

    if (!userId) {
        return { user: null }
    }

    const user: any = findUserById(userId)
    
    if (!user) {
        // Cookie might remain but user deleted?
        return { user: null }
    }

    const { password: _, ...userInfo } = user
    return { user: userInfo }
})
