<template>
  <div class="page-container home-page">
    <div class="content-wrapper">
      <h1 class="title">Famille Belote</h1>
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
          <button v-else @click="handlePlayAction" class="chill-btn">
            {{ actionLabel }}
          </button>
        </ClientOnly>
      </div>

      <div class="links">
        <NuxtLink to="/rules" class="text-link">Comment jouer ?</NuxtLink>
      </div>
      
      <div class="version">
        <span>Version 1.1</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const loading = ref(true)
const actionLabel = ref('Jouer')

onMounted(() => {
  setTimeout(() => {
    loading.value = false
  }, 500)
})

const handlePlayAction = () => {
  navigateTo('/game')
}
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
  background: linear-gradient(to right, #fbbf24, #fffbeb); /* Gold to White */
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 4px 20px rgba(251, 191, 36, 0.3);
  /* animation removed as requested */
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
</style>
