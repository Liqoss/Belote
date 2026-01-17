<template>
  <div class="page-container home-page">
    <div class="content-wrapper">
      <h1 class="title">Belote</h1>
      <p class="subtitle">Détendez-vous, jouez aux cartes, profitez du moment.</p>

      <!-- Decorative Cards -->
      <div class="card-fan">
        <div class="card-back card-1"></div>
        <div class="card-back card-2"></div>
        <div class="card-back card-3"></div>
      </div>

      <div class="action-area">
        <ClientOnly>
          <div v-if="loading" class="loading-state">
            Chargement...
          </div>
          
          <div v-else-if="isAuthenticated" class="user-welcome">
              <div class="avatar-display" v-if="user.avatar">
                  <img :src="user.avatar" alt="Avatar" />
              </div>
              <h3>Bonjour {{ user.username }} 👋</h3>
              <p class="elo-badge">🏆 ELO: {{ user.elo || 100 }}</p>
              
              <button @click="navigateTo('/lobby')" class="chill-btn play-btn">
                Jouer
              </button>
              
              <button @click="navigateTo('/profile')" class="chill-btn secondary" style="font-size: 0.9rem; padding: 0.4rem 1rem;">
                Mon Profil / Paramètres
              </button>
              
              <!-- Fixed Logout Button -->
              <button @click="handleLogout" class="fixed-logout-btn" title="Se Déconnecter">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px;">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                  <line x1="12" y1="2" x2="12" y2="12"></line>
                </svg>
              </button>
            </div>

          <div v-else class="auth-buttons">
              <button @click="navigateTo('/login')" class="chill-btn">
                Se Connecter
              </button>
              <button @click="navigateTo('/signup')" class="chill-btn secondary">
                Créer un compte
              </button>
          </div>
        </ClientOnly>
      </div>

      <div class="links">
        <NuxtLink to="/rules" class="text-link">Comment jouer ?</NuxtLink>
      </div>
      
      <div class="version">
        <span>v.2.1.0</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'

const { user, isAuthenticated, logout } = useAuth()
const loading = ref(true)

const handleLogout = async () => {
    await logout()
}

onMounted(async () => {
  setTimeout(() => { loading.value = false }, 500)
})
</script>

<style scoped lang="scss">
.home-page {
  /* Background handled globally by body for texture continuity */
}

.content-wrapper {
  text-align: center;
  max-width: 600px;
  width: 100%;
  padding: 0 1rem;
  z-index: 10;
  position: relative;
}

.title {
  font-size: 3.5rem;
  font-weight: 300;
  margin-bottom: 0.5rem;
  margin-top: 0;
  background: linear-gradient(to right, #fbbf24, #fffbeb); /* Gold to White */
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 4px 20px rgba(251, 191, 36, 0.3);
}

.subtitle {
  color: var(--text-muted);
  font-size: 1.1rem;
  margin-bottom: 2rem;
}

/* Graphic Cards Fan */
.card-fan {
  display: flex;
  justify-content: center;
  margin-bottom: 3rem;
  position: relative;
  height: 160px;
}

.card-back {
  position: absolute;
  transition: transform 0.5s ease;
  border: 1px solid rgba(255, 215, 0, 0.3); /* Gold border hint */
}

.card-1 {
  transform: translateX(-40px) rotate(-15deg);
  z-index: 1;
}

.card-2 {
  transform: translateY(-10px);
  z-index: 2;
}

.card-3 {
  transform: translateX(40px) rotate(15deg);
  z-index: 1;
}

.card-fan:hover .card-1 {
  transform: translateX(-60px) rotate(-20deg);
}

.card-fan:hover .card-3 {
  transform: translateX(60px) rotate(20deg);
}

.action-area {
  margin-bottom: 2rem;
  min-height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.links {
  margin-top: 2rem;
}

.text-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  border-bottom: 1px dotted var(--text-muted);
  transition: color 0.2s;

  &:hover {
    color: var(--primary-color);
    border-color: var(--primary-color);
  }
}

.version {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  color: var(--text-muted);
  font-size: 0.8rem;
}

@media (min-width: 768px) {
  .title {
    font-size: 5rem;
  }
  
  .card-fan {
     transform: scale(1.2);
  }
}

/* Auth Styles */
.auth-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    
    @media (min-width: 480px) {
        flex-direction: row;
    }
}

.user-welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    
    h3 {
        margin: 0;
        color: white;
    }
}

.avatar-display {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid #fbbf24;
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    
    img { 
        width: 100%; 
        height: 100%; 
        object-fit: cover; 
    }
}

.elo-badge {
    color: #fbbf24;
    font-weight: bold;
    margin-top: 0;
    margin-bottom: 1rem;
    background: rgba(251, 191, 36, 0.1);
    padding: 0.2rem 0.8rem;
    border-radius: 20px;
}

.chill-btn.secondary {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.3);
    &:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: translateY(-2px);
    }
}

.play-btn {
    min-width: 160px;
    font-size: 1.1rem;
    margin-top: 0.5rem;
}

/* Fixed Logout Button */
.fixed-logout-btn {
    position: fixed;
    top: 1rem;
    right: 1rem;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #ef4444;
    font-size: 1.5rem;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 1000;
    transition: all 0.2s;
    
    &:hover {
        background: rgba(239, 68, 68, 0.2);
        transform: scale(1.1);
    }
}
</style>
