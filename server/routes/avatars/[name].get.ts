import path from 'path'
import fs from 'fs'
import { defineEventHandler, createError, setHeader, sendStream } from 'h3'

export default defineEventHandler(async (event) => {
    // Get filename from route param
    const filename = getRouterParam(event, 'name')
    
    if (!filename || !/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|gif)$/.test(filename)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid Filename' })
    }

    const filePath = path.resolve('./data/avatars', filename)

    if (!fs.existsSync(filePath)) {
        throw createError({ statusCode: 404, statusMessage: 'Avatar Not Found' })
    }

    const ext = path.extname(filename).toLowerCase()
    let mimeType = 'image/png'
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'
    if (ext === '.gif') mimeType = 'image/gif'

    setHeader(event, 'Content-Type', mimeType)
    setHeader(event, 'Cache-Control', 'public, max-age=86400') // Cache for 1 day

    return sendStream(event, fs.createReadStream(filePath))
})
