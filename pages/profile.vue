<template>
  <div class="auth-page">
    <Head>
        <Title>Profil - Belote</Title>
    </Head>

    <div class="glass-panel profile-container">
        <h2>Mon Profil</h2>
        
        <ClientOnly>
             <div v-if="user" class="profile-header">
                <div class="avatar-large" @click="triggerFileInput">
                    <img :src="previewAvatar || user.avatar || '/avatars/default.png'" alt="Avatar" />
                    <div class="edit-overlay">📷</div>
                </div>
                <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="handleFileChange" />
                
                <h3>{{ user.username }}</h3>
                <span class="elo-tag">🏆 {{ user.elo || 100 }}</span>
                
                <!-- Admin Invitation (Fixed Top Right) -->
                <div v-if="user.role === 'admin'" class="invite-section-fixed">
                    <button class="icon-btn" @click="generateInvite" title="Générer une invitation">
                        📩
                    </button>
                    <div v-if="inviteLink" class="invite-display right-aligned">
                        <input :value="inviteLink" readonly />
                        <span class="copy-feedback" v-if="copied">Copié !</span>
                    </div>
                </div>
             </div>
        </ClientOnly>

        <form @submit.prevent="handleUpdate" class="auth-form">
            <div class="form-group">
                <label>Pseudo</label>
                <input v-model="form.username" type="text" class="chill-input" required />
            </div>

            <div class="section-divider"></div>
            
            <div class="form-group">
                <label>Question Secrète (Mise à jour)</label>
                <select v-model="form.security_question" class="chill-input">
                    <option value="">Ne pas changer</option>
                    <option>Quel est le nom de votre premier animal de compagnie ?</option>
                    <option>Quel est le nom de votre ville de naissance ?</option>
                    <option>Quel est votre plat préféré ?</option>
                </select>
                <input v-if="form.security_question" v-model="form.security_answer" type="text" required placeholder="Nouvelle réponse..." class="chill-input" />
            </div>

            <div v-if="error" class="error-msg">{{ error }}</div>
            <div v-if="success" class="success-msg">Profil mis à jour !</div><br/>

            <div v-if="history.length > 0" class="history-list">
                  <h4>Dernières Parties</h4>
                  <div v-for="game in history" :key="game.id" class="history-item" :class="{ win: game.winner_team === game.my_team }">
                      <span class="outcome">{{ game.winner_team === game.my_team ? 'VICTOIRE' : 'DÉFAITE' }}</span>
                      <span class="score">{{ game.team1_score }} - {{ game.team2_score }}</span>
                      <span class="elo-change">{{ game.elo_change > 0 ? '+' : ''}}{{ game.elo_change }}</span>
                  </div>
            </div>


            <button type="submit" class="chill-btn action-btn" :disabled="loading">
                {{ loading ? 'Enregistrement...' : "Sauvegarder" }}
            </button>
            
            <button type="button" class="chill-btn secondary action-btn" @click="navigateTo('/')">
                Retour Accueil
            </button>
        </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watchEffect } from 'vue'
import { useAuth } from '~/composables/useAuth'
import imageCompression from 'browser-image-compression'

const { user, fetchUser } = useAuth()
const loading = ref(false)
const error = ref('')
const success = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const previewAvatar = ref<string | null>(null)
const avatarFile = ref<File | null>(null)

const form = reactive({
    username: '',
    security_question: '',
    security_answer: ''
})

const inviteLink = ref('')
const copied = ref(false)

const generateInvite = async () => {
    try {
        const res: any = await $fetch('/api/admin/generate-invite', { method: 'POST' })
        if (res.success) {
            inviteLink.value = `${window.location.origin}${res.link}`
            navigator.clipboard.writeText(inviteLink.value)
            copied.value = true
            setTimeout(() => copied.value = false, 2000)
        }
    } catch (e) {
        alert('Erreur: Seuls les admins peuvent inviter.')
    }
}

// Init form with current user data
const history = ref<any[]>([])

const fetchHistory = async () => {
    try {
        const res: any = await $fetch('/api/user/history')
        if (res.success) history.value = res.history
    } catch (e) { console.error(e) }
}

watchEffect(() => {
    if (user.value) {
        form.username = user.value.username
        fetchHistory()
    }
})


const triggerFileInput = () => {
    fileInput.value?.click()
}

const handleFileChange = async (e: any) => {
    const files = e.target.files
    if (files && files.length > 0) {
        const file = files[0]
        
        try {
            const options = {
                maxSizeMB: 0.2,
                maxWidthOrHeight: 256,
                useWebWorker: true
            }
            const compressedFile = await imageCompression(file, options)
            avatarFile.value = compressedFile
            previewAvatar.value = URL.createObjectURL(compressedFile)
        } catch (err) {
            console.error('Compression error:', err)
            // Fallback to original
            avatarFile.value = file
            previewAvatar.value = URL.createObjectURL(file)
        }
    }
}

const handleUpdate = async () => {
    loading.value = true
    error.value = ''
    success.value = false

    try {
        const fd = new FormData()
        fd.append('username', form.username)
        
        if (form.security_question && form.security_answer) {
             fd.append('security_question', form.security_question)
             fd.append('security_answer', form.security_answer)
        }
        
        if (avatarFile.value) {
            fd.append('avatar', avatarFile.value)
        }

        // Only send if something changed
        /*if (!form.password && !avatarFile.value && !form.security_question) {
             return
        }*/

        const res: any = await $fetch('/api/user/update', {
            method: 'POST',
            body: fd
        })
        
        if (res.success) {
            await fetchUser() // Refresh local state
            success.value = true
            form.security_answer = ''
            form.security_question = ''
        }

    } catch (e: any) {
        error.value = e.statusMessage || 'Mise à jour échouée'
    } finally {
        loading.value = false
    }
}
</script>

<style scoped lang="scss">
.auth-page {
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--bg-color);
}

.profile-container {
    width: calc(100% - 2rem);
    max-width: 450px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    height: 80%;
    padding: 3rem 1rem;
}

.profile-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    
    h3 { margin: 0; font-size: 1.5rem; color: white; }
    .elo-tag { color: #fbbf24; font-weight: bold; }
    
    .invite-section-fixed {
        position: fixed;
        top: 1rem;
        right: 1rem;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.5rem;
        z-index: 100;
    }
    
    .icon-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        font-size: 1.5rem;
        padding: 0.5rem;
        border-radius: 50%;
        cursor: pointer;
        transition: transform 0.2s;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        &:hover { transform: scale(1.1); background: rgba(255, 255, 255, 0.2); }
    }
    
    .invite-display {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: rgba(0,0,0,0.8);
        padding: 0.5rem;
        border-radius: 8px;
        
        input {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.1);
            color: #fbbf24;
            padding: 0.3rem;
            border-radius: 4px;
            font-size: 0.8rem;
            width: 200px;
        }
        .copy-feedback { color: #10b981; font-size: 0.8rem; }
    }
}

.avatar-large {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    overflow: hidden;
    position: relative;
    border: 3px solid #fbbf24;
    cursor: pointer;
    
    img { width: 100%; height: 100%; object-fit: cover; }
    
    .edit-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        background: rgba(0,0,0,0.6);
        color: white;
        font-size: 1.2rem;
        display: flex;
        justify-content: center;
        padding-bottom: 5px;
        opacity: 0;
        transition: opacity 0.2s;
    }
    
    &:hover .edit-overlay { opacity: 1; }
}

.auth-form { width: 100%; display: flex; flex-direction: column; gap: 1rem; }

.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    label { font-size: 0.9rem; color: #ddd; }
}

.chill-input {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 0.8rem;
    border-radius: 8px;
    &:focus { border-color: var(--primary-color); outline: none; }
}

.section-divider {
    height: 1px;
    background: rgba(255,255,255,0.1);
    margin: 0.5rem 0;
}

.action-btn { width: 100%; }
.secondary { background: transparent; border: 1px solid rgba(255,255,255,0.2); }

.error-msg {
    color: #ff6b6b;
    font-size: 0.9rem;
    text-align: center;
    background: rgba(255, 107, 107, 0.1);
    padding: 0.5rem;
    border-radius: 4px;
}

.success-msg {
    color: #10b981;
    font-size: 0.9rem;
    text-align: center;
    background: rgba(16, 185, 129, 0.1);
    padding: 0.5rem;
    border-radius: 4px;
}

.history-list {
    margin-top: 1rem;
    width: 100%;
    
    h4 {
        color: #aaa;
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 0.5rem;
    }
}

.history-item {
    display: flex;
    justify-content: space-between;
    background: rgba(0,0,0,0.2);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    border-left: 3px solid #666;
    
    &.win {
        border-left-color: #10b981;
        background: rgba(16, 185, 129, 0.1);
        .outcome { color: #10b981; }
        .elo-change { color: #10b981; }
    }
    
    &:not(.win) {
        border-left-color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
        .outcome { color: #ef4444; }
        .elo-change { color: #ef4444; }
    }
    
    .outcome { font-weight: bold; }
    .score { color: #ccc; }
}
</style>
