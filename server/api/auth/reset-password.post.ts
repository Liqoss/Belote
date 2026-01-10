import { findUserByEmail, updateUser } from '~/server/utils/db'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { email, answer, newPassword, getQuestion } = body

    if (!email) {
        throw createError({ statusCode: 400, statusMessage: 'Email required' })
    }

    const user: any = findUserByEmail(email)
    if (!user) {
        // Silent failure to prevent enumeration? Or helpful? 
        // For Local/Personal app, helpful is better.
        throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    // PHASE 1: Get Question
    if (getQuestion) {
        return { 
            success: true, 
            question: user.security_question || 'Quel est le nom de votre premier animal de compagnie ?' 
        }
    }

    // PHASE 2: Verify Answer and Reset
    if (!answer || !newPassword) {
        throw createError({ statusCode: 400, statusMessage: 'Answer and New Password required' })
    }

    const validAnswer = await bcrypt.compare(answer.toLowerCase().trim(), user.security_answer)
    
    if (!validAnswer) {
         throw createError({ statusCode: 403, statusMessage: 'Incorrect Answer' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    updateUser(user.id, { password: hashedPassword })

    return { success: true }
})
