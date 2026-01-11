<template>
  <div class="auth-page">
    <Head>
        <Meta name="robots" content="noindex" />
        <Title>Inscription Secrète - Belote</Title>
    </Head>

    <div class="glass-panel auth-container">
        <h2>Rejoindre le Cercle ♣️</h2>
        
        <div v-if="checkingToken" class="loading-token">
            <p>Vérification de l'invitation...</p>
        </div>
        
        <div v-else-if="!validToken" class="invalid-token">
            <div class="forbidden-icon">🚫</div>
            <h3>Accès Réservé</h3>
            <p>L'inscription est uniquement accessible sur invitation via un lien admin.</p>
            <NuxtLink to="/" class="chill-btn secondary" style="margin-top: 1rem; display: inline-block;">Retour Accueil</NuxtLink>
        </div>

        <form v-else @submit.prevent="handleRegister" class="auth-form">
            <div class="form-group">
                <label>Email</label>
                <input v-model="form.email" type="email" required placeholder="contact@exemple.com" class="chill-input" />
            </div>

            <div class="form-group">
                <label>Pseudo</label>
                <input v-model="form.username" type="text" required placeholder="LeBeloteur" class="chill-input" />
            </div>

            <div class="form-group">
                <label>Mot de passe</label>
                <input v-model="form.password" type="password" required placeholder="••••••••" class="chill-input" />
            </div>

            <div class="form-group">
                <label>Question Secrète (Récupération)</label>
                <select v-model="form.security_question" class="chill-input" required>
                    <option>Quel est le nom de votre premier animal de compagnie ?</option>
                    <option>Quel est le nom de votre ville de naissance ?</option>
                    <option>Quel est votre plat préféré ?</option>
                </select>
                <input v-model="form.security_answer" type="text" required placeholder="Réponse..." class="chill-input" />
            </div>

            <div class="form-group">
                <label>Avatar (Optionnel)</label>
                <input type="file" accept="image/*" @change="handleFileChange" class="chill-input file-input" />
            </div>

            <div v-if="error" class="error-msg">{{ error }}</div>

            <button type="submit" class="chill-btn action-btn" :disabled="loading">
                {{ loading ? 'Création...' : "S'inscrire" }}
            </button>
        </form>

        <p class="switch-link">
            Déjà un compte ? <NuxtLink to="/login">Se connecter</NuxtLink>
        </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import imageCompression from 'browser-image-compression'

const route = useRoute()
const token = route.query.token as string
const validToken = ref(false)
const checkingToken = ref(true)

const form = reactive({
    email: '',
    username: '',
    password: '',
    security_question: 'Quel est le nom de votre premier animal de compagnie ?',
    security_answer: ''
})

onMounted(async () => {
    if (!token) {
        checkingToken.value = false
        return
    }
    
    try {
        const res: any = await $fetch(`/api/auth/validate-invite?token=${token}`)
        if (res.valid) {
            validToken.value = true
        }
    } catch {
        // invalid
    } finally {
        checkingToken.value = false
    }
})

const avatarFile = ref<File | null>(null)
const loading = ref(false)
const error = ref('')

const handleFileChange = async (e: any) => {
    const files = e.target.files
    if (files && files.length > 0) {
        const file = files[0]
        try {
            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 300,
                useWebWorker: true
            }
            const compressedFile = await imageCompression(file, options)
            avatarFile.value = compressedFile
        } catch (err) {
            console.error('Compression error:', err)
             avatarFile.value = file
        }
    }
}

const handleRegister = async () => {
    loading.value = true
    error.value = ''

    try {
        const fd = new FormData()
        fd.append('email', form.email)
        fd.append('username', form.username)
        fd.append('password', form.password)
        if (token) fd.append('token', token)
        fd.append('security_question', form.security_question)
        fd.append('security_answer', form.security_answer)
        if (avatarFile.value) {
            fd.append('avatar', avatarFile.value)
        }

        await $fetch('/api/auth/register', {
            method: 'POST',
            body: fd
        })

        // On success, go to login
        navigateTo('/login')
    } catch (e: any) {
        error.value = e.statusMessage || 'Une erreur est survenue'
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

.auth-container {
    padding: 2.5rem;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
}

h2 {
    margin: 0;
    font-size: 1.8rem;
    color: white;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.auth-form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    
    label {
        font-size: 0.9rem;
        color: #ddd;
    }
}

.chill-input {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 0.8rem;
    border-radius: 8px;
    
    &:focus {
        border-color: var(--primary-color);
        outline: none;
    }
    
    &.file-input {
        padding: 0.5rem;
        font-size: 0.8rem;
    }
}

.action-btn {
    margin-top: 1rem;
    width: 100%;
}

.error-msg {
    color: #ff6b6b;
    font-size: 0.9rem;
    text-align: center;
    background: rgba(255, 107, 107, 0.1);
    padding: 0.5rem;
    border-radius: 4px;
}

.switch-link {
    font-size: 0.9rem;
    color: #aaa;
    
    a {
        color: var(--primary-color);
        text-decoration: none;
        &:hover { text-decoration: underline; }
    }
}

.loading-token, .invalid-token {
    text-align: center;
    color: white;
    
    .forbidden-icon { font-size: 3rem; margin-bottom: 0.5rem; }
    h3 { margin-bottom: 0.5rem; color: #ef4444; text-shadow: none; font-size: 1.2rem; }
    p { color: #ccc; font-size: 0.9rem; margin-bottom: 1rem; }
    
    a { text-decoration: none; }
}

</style>
