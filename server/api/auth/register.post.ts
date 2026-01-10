import { createUser, findUserByEmail, validateInvite, markInviteUsed, getUserCount } from '~/server/utils/db'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'

export default defineEventHandler(async (event) => {
    const body = await readMultipartFormData(event)
    
    if (!body) {
        throw createError({ statusCode: 400, statusMessage: 'Bad Request: No data' })
    }

    // Helper to get field value
    const getField = (name: string) => {
        const item = body.find(b => b.name === name)
        return item ? item.data.toString() : null
    }

    const email = getField('email')
    const username = getField('username')
    const password = getField('password')
    const token = getField('token')
    
    // Check if it's the first user (Fresh Install)
    const userCount = getUserCount().count
    const isFirstUser = userCount === 0
    
    // Default Role
    const role = isFirstUser ? 'admin' : 'player'
    
    if (!isFirstUser) {
        if (!token) {
            throw createError({ statusCode: 403, statusMessage: 'Invitation Required' })
        }
        const validInvite = validateInvite(token)
        if (!validInvite) {
            throw createError({ statusCode: 403, statusMessage: 'Invalid Invitation Token' })
        }
    }

    // Security Questions
    const securityQuestion = getField('security_question') || 'Quel est le nom de votre premier animal de compagnie ?'
    const securityAnswer = getField('security_answer')
    
    const avatarFile = body.find(b => b.name === 'avatar')

    if (!email || !username || !password || !securityAnswer) {
        throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
    }

    // Check if email exists
    if (findUserByEmail(email)) {
        throw createError({ statusCode: 409, statusMessage: 'Email already in use' })
    }

    const userId = randomUUID()
    let avatarPath = null

    // Handle Avatar Upload
    if (avatarFile && avatarFile.filename) {
        // Ensure directory exists in DATA (Persistent)
        const uploadDir = path.resolve('./data/avatars')
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true })
        }
        
        const ext = path.extname(avatarFile.filename) || '.png'
        const filename = `${userId}${ext}`
        const filePath = path.join(uploadDir, filename)
        
        fs.writeFileSync(filePath, avatarFile.data)
        avatarPath = `/avatars/${filename}` // This URL now hits our new server route
    }

    // Hash Password & Answer
    const hashedPassword = await bcrypt.hash(password, 10)
    const hashedAnswer = await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10) // Normalize Answer

    // Save to DB
    try {
        createUser({
            id: userId,
            email,
            username,
            password: hashedPassword,
            avatar: avatarPath,
            security_question: securityQuestion,
            security_answer: hashedAnswer,
            role: role
        })
        
        // Mark invite as used (only if token existed)
        if (token) {
            markInviteUsed(token)
        }
        
    } catch (e: any) {
        throw createError({ statusCode: 500, statusMessage: 'Database Error: ' + e.message })
    }

    return { 
        success: true, 
        message: 'Account created successfully',
        userId
    }
})
