<template>
  <div class="page-container lobby-page">
    <div class="content-wrapper">
      <h1 class="title">Salons de Jeu</h1>
      <p class="subtitle">Choisissez une table ou créez-en une nouvelle</p>

      <div class="action-area">
        <ClientOnly>
          <div v-if="loading" class="loading-state">
            Chargement des salons...
          </div>
          
          <div v-else class="lobby-container">
               <!-- User Info Snippet -->
               <div v-if="isAuthenticated" class="user-strip">

                   <button @click="backToHome" class="chill-btn small secondary">Retour Accueil</button>
               </div>
               <div v-else class="auth-box">
                   <button @click="backToHome" class="chill-btn small secondary">Retour</button>
               </div>

               <!-- Room List -->
               <div class="room-grid">
                   <div 
                        v-for="room in rooms" 
                        :key="room.id" 
                        class="room-card glass-panel"
                        :class="room.status"
                   >
                        <div class="room-header">
                            <span class="room-id">Salle #{{ room.id }}</span>
                            <span class="status-badge" :class="room.status">
                                {{ room.status === 'playing' ? 'En Cours' : (room.status === 'empty' ? 'Libre' : 'Attente') }}
                            </span>
                        </div>
                        
                        <div class="room-info">
                            <div class="players-avatars">
                                <div v-for="(p, i) in room.players" :key="i" class="player-dot" :title="p.username">
                                    {{ p.username.substring(0,1).toUpperCase() }}
                                </div>
                                <div v-for="n in (4 - room.players.length)" :key="'empty'+n" class="player-dot empty"></div>
                            </div>
                            <span class="player-count">{{ room.playerCount }}/4</span>
                        </div>

                        <div class="room-actions">
                            <button 
                                @click="joinRoom(room.id)" 
                                class="chill-btn small"
                                :class="{ 'secondary': room.status === 'playing' && !isMyRoom(room) }"
                            >
                                {{ getButtonLabel(room) }}
                            </button>
                        </div>
                   </div>
               </div>
          </div>
        </ClientOnly>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { io, type Socket } from 'socket.io-client'
import { useAuth } from '~/composables/useAuth'

const { user, isAuthenticated } = useAuth()
const loading = ref(true)
const rooms = ref<any[]>([])
const socket = ref<Socket | null>(null)

const joinRoom = (roomId: number) => {
    navigateTo(`/game/${roomId}`)
}

const getMyId = () => {
    if (user.value) return user.value.id
    if (typeof window !== 'undefined') {
        return localStorage.getItem('belote_user_id')
    }
    return null
}

const isMyRoom = (room: any) => {
    const myId = getMyId()
    if (!myId || !room.players) return false
    return room.players.some((p: any) => p.id === myId)
}

const getButtonLabel = (room: any) => {
    if (isMyRoom(room)) return 'Rejoindre'
    if (room.status === 'playing') return 'Regarder'
    return 'Rejoindre'
}

const backToHome = () => {
    navigateTo('/')
}

onMounted(() => {
    socket.value = io()
    
    socket.value.on('connect', () => {
        // Initial request
        socket.value?.emit('get-rooms')
    })
    
    socket.value.on('room-list', (list: any[]) => {
        rooms.value = list
        loading.value = false
    })

    socket.value.on('lobby-update', (list: any[]) => {
        rooms.value = list
    })
})

onUnmounted(() => {
    if (socket.value) socket.value.disconnect()
})
</script>

<style scoped lang="scss">


.chill-btn {
  font-size: 1rem;
}

.content-wrapper {
  text-align: center;
  max-width: 900px;
  width: 100%;
  padding: 2rem 1rem;
  z-index: 10;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.title {
  font-size: 2.5rem;
  font-weight: 300;
  margin-bottom: 0.5rem;
  background: linear-gradient(to right, #fbbf24, #fffbeb);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: var(--text-muted);
  font-size: 1rem;
  margin-bottom: 2rem;
}

.lobby-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.user-strip, .auth-box {
    display: flex;
    justify-content: center;
    align-items: center;
    background: rgba(0,0,0,0.3);
    padding: 0.5rem 1rem;
    border-radius: 12px;
    margin-bottom: 1rem;
    width: 100%;
    box-sizing: border-box;
}

.action-area {
    width: 100%;
}



.room-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
    width: 100%;
    max-height: 60vh;
    overflow-y: auto;
    padding-right: 5px;
}

/* Custom Scrollbar */
.room-grid::-webkit-scrollbar {
  width: 6px;
}
.room-grid::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}
.room-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.room-card {
    background: rgba(255, 255, 255, 0.1); /* More visible background */
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    transition: all 0.2s;
    
    &:hover {
        transform: translateY(-2px);
        background: rgba(255, 255, 255, 0.15);
        border-color: #fbbf24; /* Gold highlight on hover */
    }
    
    &.playing { border-color: #ef4444; }
    &.waiting { border-color: #fbbf24; }

}

.room-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.room-id {
    color: white;
    font-weight: bold;
    font-size: 1.1rem;
}

.status-badge {
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: bold;
    
    &.playing { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    &.waiting { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }
    &.empty { background: rgba(255, 255, 255, 0.1); color: #ccc; }
}

.players-avatars {
    display: flex;
    gap: 5px;
}

.player-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #fbbf24;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: bold;
    
    &.empty {
        background: transparent;
        border: 1px dashed rgba(255, 255, 255, 0.3);
        color: transparent;
    }
}

.room-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.player-count {
    color: var(--text-muted);
    font-size: 0.8rem;
}

.loading-state {
    color: var(--text-muted);
    font-style: italic;
}
</style>
