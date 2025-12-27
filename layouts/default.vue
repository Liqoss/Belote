<template>
  <div class="app-layout">
    <slot />
  </div>
</template>

<style lang="scss">
.app-layout {
  min-height: 100vh;
  width: 100%;
  background-color: var(--bg-color);
  color: var(--text-main);
}
</style>
