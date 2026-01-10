<template>
  <div class="page-container rules-page">
    <div class="glass-panel content-wrapper">
      <div class="header">
        <NuxtLink to="/" class="back-link">← Retour</NuxtLink>
        <h1>Règles de la Belote</h1>
      </div>

      <div class="rules-content">
        <section class="rule-section">
          <h2>Le But</h2>
          <p>La Belote se joue à 4 joueurs par équipe de 2. Le but est d'atteindre 501 points en premier en remportant des plis.</p>
        </section>

        <section class="rule-section">
          <h2>Valeurs des Cartes (Atout)</h2>
          <ul class="values-list">
            <li><strong>Valet :</strong> 20 points</li>
            <li><strong>9 :</strong> 14 points</li>
            <li><strong>As :</strong> 11 points</li>
            <li><strong>10 :</strong> 10 points</li>
            <li><strong>Roi :</strong> 4 points</li>
            <li><strong>Dame :</strong> 3 points</li>
          </ul>
        </section>

        <section class="rule-section">
          <h2>Valeurs des Cartes (Non-Atout)</h2>
          <ul class="values-list">
            <li><strong>As :</strong> 11 points</li>
            <li><strong>10 :</strong> 10 points</li>
            <li><strong>Roi :</strong> 4 points</li>
            <li><strong>Dame :</strong> 3 points</li>
            <li><strong>Valet :</strong> 2 points</li>
            <li><strong>9, 8, 7 :</strong> 0 points</li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rules-page {
  display: block;
  height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  align-items: flex-start; /* Allow scrolling on mobile */
  padding-top: 0.5rem; /* Space for top bar if needed */
}

.content-wrapper {
  max-width: 800px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 1rem;

  h1 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--primary-color);
  }
}

.back-link {
  color: var(--text-muted);
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s;

  &:hover {
    color: white;
  }
}

.code-green {
  color: #4ade80;
}

.rules-content {
  display: grid;
  gap: 2rem;
}

.rule-section {
  h2 {
    font-size: 1.2rem;
    color: var(--secondary-color);
    margin-bottom: 0.5rem;
  }
  
  p, li {
    line-height: 1.6;
    color: var(--text-main);
  }
}

.values-list {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  
  li {
    background: rgba(255, 255, 255, 0.05);
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
  }
}

@media (min-width: 768px) {
  .values-list {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .rules-page {
    justify-content: center; /* Center vertically on desktop if short enough */
    align-items: center; 
    padding-top: 2rem;
  }
}
</style>
