<template>
  <section class="os-card overflow-hidden flex flex-col h-[450px] md:order-5 lg:order-5">
    <h2 class="os-panel-title">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <rect x="2" y="5" width="20" height="14" rx="2"></rect>
          <path d="M2 10h20"></path>
          <path d="M8 15h.01"></path>
          <path d="M12 15h.01"></path>
          <path d="M16 15h.01"></path>
        </svg>
      </span>
      <span data-i18n="raffleTitle"></span>
    </h2>
    <div class="flex-1 flex flex-col justify-center p-4">
      <div class="raffle-embed bg-[#080c10] rounded-[6px] p-3 h-full" aria-busy="true">
        <div class="skeleton h-[120px]" data-skeleton="raffle"></div>
        <div id="raffleContentContainer" class="-mt-0"></div>
      </div>
    </div>
  </section>
</template>
