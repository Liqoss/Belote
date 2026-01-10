import { updateUser, findUserById } from '~/server/utils/db'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { getCookie } from 'h3';

export default defineEventHandler(async (event) => {
    const userId = getCookie(event, 'belote_session');
    if (!userId) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    const body = await readMultipartFormData(event)
    
    // If no body (e.g. JSON), check if we can parse it? 
    // Usually for avatars we expect Multipart. If not, we might need readBody handler.
    // Let's assume Profile Edit ALWAYS sends Multipart due to potential avatar.
    
    if (!body) {
        throw createError({ statusCode: 400, statusMessage: 'Bad Request: No data' })
    }

    const getField = (name: string) => {
        const item = body.find(b => b.name === name)
        return item ? item.data.toString() : null
    }

    const updates: any = {}
    
    const username = getField('username')
    const password = getField('password')
    const answer = getField('security_answer')
    const avatarFile = body.find(b => b.name === 'avatar')
    
    // Username Update
    if (username && username.trim().length > 0) {
        // Optional: Check uniqueness here or rely on specific check? 
        // For now, simpler is better.
        updates.username = username
    }
    
    // Avatar Update
    if (avatarFile && avatarFile.filename) {
        const uploadDir = path.resolve('./public/avatars')
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true })
        }
        
        const ext = path.extname(avatarFile.filename) || '.png'
        const filename = `${userId}_${Date.now()}${ext}` // Anti-cache
        const filePath = path.join(uploadDir, filename)
        
        fs.writeFileSync(filePath, avatarFile.data)
        updates.avatar = `/avatars/${filename}`
    }
    
    // Password Update
    if (password && password.trim().length > 0) {
        const hashedPassword = await bcrypt.hash(password, 10)
        updates.password = hashedPassword
    }

    // Security Question Update
    const question = getField('security_question')
    if (question && answer) {
        updates.security_question = question
        updates.security_answer = await bcrypt.hash(answer.toLowerCase().trim(), 10)
    }

    if (Object.keys(updates).length > 0) {
        try {
            updateUser(userId, updates)
        } catch (e: any) {
             throw createError({ statusCode: 500, statusMessage: 'DB Update Failed: ' + e.message })
        }
    }
    
    return { success: true, avatar: updates.avatar }
})
