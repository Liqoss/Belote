export default defineEventHandler((event) => {
    deleteCookie(event, 'belote_session')
    return { success: true }
})
