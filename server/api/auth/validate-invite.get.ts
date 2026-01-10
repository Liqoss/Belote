import { defineEventHandler, getQuery, createError } from 'h3'
import { validateInvite } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const token = query.token as string
    
    if (!token) {
        return { valid: false }
    }

    const invite = validateInvite(token)
    return { valid: !!invite }
})
