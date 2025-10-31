<template>
  <section class="os-card overflow-hidden flex flex-col h-[450px] md:order-4 lg:order-4">
    <h2 class="os-panel-title">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path
            d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8.5 8.5Z"></path>
        </svg>
      </span>
      <span data-i18n="liveChatTitle"></span>
    </h2>
    <div class="flex-1 flex flex-col max-h-[calc(100%-44px)] overflow-hidden">
      <div class="skeleton h-[240px] m-3" data-skeleton="chat"></div>
      <div id="chat-container" aria-busy="true"></div>
    </div>
  </section>
</template>
