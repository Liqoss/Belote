<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const { fetchUser } = useAuth()
// Initialize Auth State (Server & Client)
await useAsyncData('auth_init', () => fetchUser())

// Preload Card Images to avoid loading delay during game
const preloadImages = () => {
  if (import.meta.client) {
    const ranks = ['jack', 'queen', 'king']
    const suits = ['hearts', 'diamonds', 'clubs', 'spades']
    
    // Low priority preload
    const preload = window.requestIdleCallback || ((cb) => setTimeout(cb, 1))
    preload(() => {
      ranks.forEach(rank => {
        suits.forEach(suit => {
          const img = new Image()
          img.src = `/cards/${rank}_${suit}.svg`
        })
      })
    })
  }
}

onMounted(() => {
  preloadImages()
})
</script>
