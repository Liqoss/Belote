<template>
  <div class="announcement-overlay">
      <div class="glass-panel content">
          <h3>📣 Annonces détectées !</h3>
          <p>Vous avez des combinaisons valides :</p>
          
          <div class="announcement-list">
              <div v-for="(ann, idx) in announcements" :key="idx" class="ann-item">
                  <span class="ann-type">{{ formatType(ann.type) }}</span>
                  <span class="ann-info">{{ ann.points }} pts (Hauteur {{ ann.height }})</span>
                  <div class="ann-cards">
                       <span v-for="c in ann.cards" :key="c.id">{{ c.rank }}{{ getSuitIcon(c.suit) }}</span>
                  </div>
              </div>
          </div>
          
          <div class="actions">
              <button @click="$emit('declare', true)" class="chill-btn primary">Annoncer</button>
              <button @click="$emit('declare', false)" class="chill-btn secondary">Cacher (Bluff)</button>
          </div>
          <p class="hint">Si vous annoncez, elles seront révélées au prochain pli si votre équipe a la plus forte.</p>
      </div>
  </div>
</template>

<script setup lang="ts">
import type { Announcement } from '~/types/belote'

const props = defineProps<{
    announcements: Announcement[]
}>()

const emit = defineEmits(['declare'])

const formatType = (type: string) => {
    const map: Record<string, string> = {
        'tierce': 'Tierce',
        'quarte': 'Quarte',
        'quinte': 'Quinte',
        'square': 'Carré'
    }
    return map[type] || type.toUpperCase()
}

const getSuitIcon = (suit: string) => {
    switch(suit) {
        case 'H': return '♥'
        case 'D': return '♦'
        case 'C': return '♣'
        case 'S': return '♠'
        default: return ''
    }
}
</script>

<style scoped lang="scss">
.announcement-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
}

.content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    min-width: 300px;
    background: rgba(30, 41, 59, 0.98);
}

.ann-item {
    background: rgba(255,255,255,0.1);
    padding: 0.5rem;
    border-radius: 8px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 0.5rem;
}

.ann-type {
    font-weight: bold;
    color: var(--primary-color);
    font-size: 1.2rem;
}

.ann-cards {
    font-size: 0.9rem;
    color: #cbd5e1;
}

.actions {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
}

.hint {
    font-size: 0.8rem;
    color: #94a3b8;
    text-align: center;
}
</style>
