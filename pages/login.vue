<template>
  <div class="auth-page">
    <Head>
        <Title>Connexion - Belote</Title>
    </Head>

    <div class="glass-panel auth-container">
        <h2>Bon Retour 👋</h2>
        
        <form @submit.prevent="handleLogin" class="auth-form">
            <div class="form-group">
                <label>Email</label>
                <input v-model="form.email" type="email" required placeholder="contact@exemple.com" class="chill-input" />
            </div>

            <div class="form-group">
                <label>Mot de passe</label>
                <input v-model="form.password" type="password" required placeholder="••••••••" class="chill-input" />
                <div style="text-align: right; margin-top: 0.2rem;">
                    <NuxtLink to="/forgot-password" style="font-size: 0.8rem; color: #aaa; text-decoration: none;">Mot de passe oublié ?</NuxtLink>
                </div>
            </div>

            <div v-if="error" class="error-msg">{{ error }}</div>

            <button type="submit" class="chill-btn action-btn" :disabled="loading">
                {{ loading ? 'Connexion...' : "Se Connecter" }}
            </button>
        </form>

        <p class="switch-link">
            Pas encore de compte ? <NuxtLink to="/signup">S'inscrire</NuxtLink>
        </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useAuth } from '~/composables/useAuth'

const { fetchUser, user } = useAuth()
const form = reactive({
    email: '',
    password: ''
})
const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
    loading.value = true
    error.value = ''

    try {
        await $fetch('/api/auth/login', {
            method: 'POST',
            body: form
        })

        // Refresh user state
        await fetchUser()

        // Redirect to home or game
        navigateTo('/')
    } catch (e: any) {
        error.value = e.statusMessage || 'Identifiants incorrects'
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
</style>
