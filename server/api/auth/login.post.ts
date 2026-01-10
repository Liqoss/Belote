import { findUserByEmail } from '~/server/utils/db'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { email, password } = body

    if (!email || !password) {
        throw createError({ statusCode: 400, statusMessage: 'Email and password required' })
    }

    const user: any = findUserByEmail(email)

    if (!user) {
        throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' }) // Generic message
    }

    const isValid = await bcrypt.compare(password, user.password)

    if (!isValid) {
        throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
    }

    // Set Session Cookie (Simple User ID for MVP)
    setCookie(event, 'belote_session', user.id, {
        httpOnly: true, // Prevents JS access
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/'
    })

    // Return user info (no password)
    const { password: _, ...userInfo } = user
    return {
        success: true,
        user: userInfo
    }
})
