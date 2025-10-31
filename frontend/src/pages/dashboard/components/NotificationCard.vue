<template>
  <section class="os-card overflow-hidden flex flex-col md:order-3 lg:order-3">
    <h2 class="os-panel-title">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      </span>
      <span data-i18n="notificationsTitle"></span>
    </h2>
    <div class="flex-1 flex flex-col justify-center">
      <div class="skeleton skeleton-line mx-4 mb-2" data-skeleton="notification"></div>
      <div id="notification" class="mb-2" role="status" aria-live="polite" aria-busy="true"></div>
    </div>
  </section>
</template>
