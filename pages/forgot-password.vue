<template>
  <div class="auth-page">
    <Head>
        <Title>Récupération - Belote</Title>
    </Head>

    <div class="glass-panel auth-container">
        <h2>Mot de passe oublié ?</h2>
        
        <form @submit.prevent="handleSubmit" class="auth-form">
            <!-- PHASE 1: EMAIL -->
            <div v-if="step === 1" class="form-group fade-in">
                <label>Email du compte</label>
                <input v-model="form.email" type="email" required placeholder="contact@exemple.com" class="chill-input" />
            </div>

            <!-- PHASE 2: SECURITY QUESTION -->
            <div v-else class="form-group fade-in">
                 <p class="question-display">{{ question }}</p>
                 <label>Votre Réponse</label>
                 <input v-model="form.answer" type="text" required placeholder="Réponse secrète..." class="chill-input" />
                 
                 <label style="margin-top: 1rem">Nouveau Mot de PAsse</label>
                 <input v-model="form.newPassword" type="password" required placeholder="Nouveau mot de passe" class="chill-input" />
            </div>

            <div v-if="error" class="error-msg">{{ error }}</div>
            <div v-if="success" class="success-msg">{{ successMsg }}</div>

            <button type="submit" class="chill-btn action-btn" :disabled="loading">
                {{ loading ? 'Chargement...' : (step === 1 ? 'Suivant' : 'Réinitialiser') }}
            </button>
        </form>

        <p class="switch-link">
            <NuxtLink to="/login">Retour connexion</NuxtLink>
        </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

const step = ref(1)
const loading = ref(false)
const error = ref('')
const success = ref(false)
const successMsg = ref('')
const question = ref('')

const form = reactive({
    email: '',
    answer: '',
    newPassword: ''
})

const handleSubmit = async () => {
    error.value = ''
    loading.value = true

    try {
        if (step.value === 1) {
            // Get Question
            const res: any = await $fetch('/api/auth/reset-password', {
                method: 'POST',
                body: { email: form.email, getQuestion: true }
            })
            question.value = res.question
            step.value = 2
        } else {
            // Reset
            await $fetch('/api/auth/reset-password', {
                method: 'POST',
                body: { 
                    email: form.email, 
                    answer: form.answer,
                    newPassword: form.newPassword
                }
            })
            success.value = true
            successMsg.value = 'Mot de passe modifié ! Redirection...'
            setTimeout(() => navigateTo('/login'), 2000)
        }
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
    font-size: 1.5rem;
    color: white;
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
    
    label { font-size: 0.9rem; color: #ddd; }
}

.question-display {
    background: rgba(255,255,255,0.1);
    padding: 1rem;
    border-radius: 8px;
    font-style: italic;
    color: #fbbf24;
    margin-bottom: 1rem;
    text-align: center;
}

.chill-input {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 0.8rem;
    border-radius: 8px;
    &:focus { border-color: var(--primary-color); outline: none; }
}

.action-btn { margin-top: 1rem; width: 100%; }

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

.switch-link {
    font-size: 0.9rem;
    color: #aaa;
    a { color: var(--primary-color); text-decoration: none; }
}

.fade-in {
    animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
