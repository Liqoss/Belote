<template>
  <div class="playing-card" :class="cardClasses" @click="handleClick">
    <div class="card-inner">
      <div v-if="['J', 'Q', 'K'].includes(rank)" class="face-card-image">
          <img v-if="faceImageName" :src="`/cards/${faceImageName}_${suitName}.svg`" :alt="displayedRank" />
      </div>

      <div class="corner top-left">
        <span class="rank">{{ displayedRank }}</span>
        <span class="suit-icon">{{ suitIcon }}</span>
      </div>
      
      <div class="center-suit" v-if="!['J', 'Q', 'K'].includes(rank)">
        {{ suitIcon }}
      </div>

      <div class="corner bottom-right">
        <span class="rank">{{ displayedRank }}</span>
        <span class="suit-icon">{{ suitIcon }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Rank, Suit } from '~/types/belote'

const props = defineProps<{
  rank: Rank
  suit: Suit
  clickable?: boolean
  disabled?: boolean
}>()

const emit = defineEmits(['click'])

const handleClick = () => {
  if (!props.disabled) {
    emit('click')
  }
}

const displayedRank = computed(() => {
  if (props.rank === 'J') return 'V'
  if (props.rank === 'Q') return 'D'
  if (props.rank === 'K') return 'R'
  return props.rank
})

const cardClasses = computed(() => {
  return [
    props.suit,
    {
      clickable: props.clickable,
      disabled: props.disabled
    }
  ]
})

const suitIcon = computed(() => {
  switch(props.suit) {
    case 'H': return '♥'
    case 'D': return '♦'
    case 'C': return '♣'
    case 'S': return '♠'
    default: return '?'
  }
})

const suitName = computed(() => {
    switch(props.suit) {
        case 'H': return 'hearts'
        case 'D': return 'diamonds'
        case 'C': return 'clubs'
        case 'S': return 'spades'
        default: return ''
    }
})

const faceImageName = computed(() => {
    if (props.rank === 'J') return 'jack'
    if (props.rank === 'Q') return 'queen'
    if (props.rank === 'K') return 'king'
    return ''
})

const isRedSuit = computed(() => ['H', 'D'].includes(props.suit))
</script>

<style scoped lang="scss">
.playing-card {
  width: 90px;
  height: 135px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  position: relative;
  user-select: none;
  font-family: 'Times New Roman', serif;
  transition: transform 0.2s;
  border: 1px solid #ccc;
  
  &.clickable:hover {
    transform: translateY(-15px);
    cursor: pointer;
    z-index: 10;
  }

  &.disabled {
      cursor: not-allowed;
      opacity: 0.8; /* Slight opacity hint instead of full gray? Or just nothing? User said "plus grisées". Let's keep it clean. */
      opacity: 1; 
  }

  &.H, &.D { color: #d32f2f; }
  &.C, &.S { color: #1f1f1f; }
}

.card-inner {
  width: 100%;
  height: 100%;
  position: relative;
  padding: 5px;
  box-sizing: border-box;
}

.corner {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: absolute;
  line-height: 1;
  font-weight: bold;
  
  &.top-left { top: 5px; left: 5px; }
  &.bottom-right { 
    bottom: 5px; right: 5px; 
    transform: rotate(180deg);
  }
}

.rank { font-size: 1.2rem; }
.suit-icon { font-size: 1.2rem; }

.center-suit {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 3rem;
}

.face-card-image {
    position: absolute;
    top: 15%;
    left: 0;
    width: 90%;
    height: 70%;
    
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    
    img {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
}


</style>
