<template>
  <section class="os-card overflow-hidden flex flex-col md:order-2 lg:order-2">
    <h2 class="os-panel-title">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
      </span>
      <span data-i18n="monthlyGoalTitle"></span>
    </h2>
    <div class="flex-1 flex flex-col justify-center">
      <div id="goal-widget" class="p-4" aria-busy="true">
        <div class="skeleton skeleton-lg mb-2" data-skeleton="goal"></div>
        <div class="goal-container goal-container-initial"></div>
      </div>
    </div>
  </section>
</template>
