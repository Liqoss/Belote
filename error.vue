<template>
  <div class="error-page">
    <div class="glass-panel error-content">
      <div class="error-code">{{ error.statusCode }}</div>
      <h1 class="error-title">Oups ! Mauvaise Donne.</h1>
      <p class="error-message">
        {{ error.message || "Il semblerait que cette carte n'existe pas dans le paquet." }}
      </p>
      
      <div class="actions">
        <button @click="handleClearError" class="chill-btn primary">
          Retour au Salon
        </button>
      </div>

      <!-- Decor cards -->
      <div class="decor-card card-1">
         <img src="/cards/king_spades.svg" alt="King Spades" />
      </div>
       <div class="decor-card card-2">
         <img src="/cards/king_hearts.svg" alt="King Hearts" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

interface Props {
  error: NuxtError
}

const props = defineProps<Props>()

const handleClearError = () => {
  clearError({ redirect: '/lobby' })
}
</script>

<style scoped>
.error-page {
  min-height: 100vh;
  width: 100%;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
  color: white;
  font-family: 'Inter', sans-serif;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 3rem;
  text-align: center;
  max-width: 500px;
  width: 90%;
  position: relative;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
  z-index: 10;
}

.error-code {
  font-size: 6rem;
  font-weight: 800;
  background: linear-gradient(135deg, #60a5fa, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1;
  margin-bottom: 1rem;
}

.error-title {
  font-size: 2rem;
  margin-bottom: 1rem;
  font-weight: 700;
}

.error-message {
  color: #94a3b8;
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.chill-btn {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1.1rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.chill-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}

.decor-card {
  position: absolute;
  width: 100px;
  opacity: 0.6;
  z-index: -1;
  transition: transform 1s ease-in-out;
}

.card-1 {
  top: -40px;
  left: -40px;
  transform: rotate(-15deg);
}

.card-2 {
  bottom: -40px;
  right: -40px;
  transform: rotate(15deg);
}

.glass-panel:hover .card-1 {
    transform: rotate(-25deg) translate(-10px, -10px);
}
.glass-panel:hover .card-2 {
    transform: rotate(25deg) translate(10px, 10px);
}
</style>
