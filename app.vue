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
</script>
