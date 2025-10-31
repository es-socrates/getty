<template>
  <section class="os-card overflow-hidden flex flex-col h-[450px] md:order-6 lg:order-6">
    <h2 class="os-panel-title">
      <span class="icon os-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <path d="M8 21h8"></path>
          <path d="M12 17v4"></path>
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"></path>
          <path d="M17 9a5 5 0 0 0 5-5h-5"></path>
          <path d="M7 9a5 5 0 0 1-5-5h5"></path>
        </svg>
      </span>
      <span data-i18n="achievementsTitle"></span>
    </h2>
    <div class="flex-1 flex flex-col max-h-[calc(100%-44px)] overflow-hidden">
      <div id="achievements-embed" class="h-full" aria-live="polite" aria-atomic="true">
        <div data-ach-embed data-ach-max="4" class="ach-root ach-embed"></div>
      </div>
    </div>
  </section>
</template>
