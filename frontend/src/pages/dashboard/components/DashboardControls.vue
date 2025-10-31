<template>
  <section class="os-card p-6 space-y-4" id="dashboard-controls">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="os-panel-title" data-i18n="dashboardControlsHeading"></h2>
        <p
          class="text-sm text-[var(--text-secondary)]"
          data-i18n="dashboardControlsDescription"></p>
      </div>
      <div class="flex flex-wrap gap-2 text-xs">
        <button
          class="dashboard-btn"
          data-dashboard-action="refresh"
          data-i18n="dashboardControlsRefresh"></button>
        <button
          class="dashboard-btn"
          data-dashboard-action="open-settings"
          data-i18n="dashboardControlsSettings"></button>
        <a
          href="/welcome.html"
          class="dashboard-btn"
          data-i18n="dashboardControlsOpenWelcome"
          target="_blank"
          rel="noopener"></a>
      </div>
    </header>
    <div class="grid gap-4 md:grid-cols-2">
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-white" data-i18n="dashboardControlsWidgets"></h3>
        <ul class="list-disc list-inside text-sm text-[var(--text-secondary)]">
          <li>
            <a href="/widgets/tip-notification" target="_blank" rel="noopener">Tip Notification</a>
          </li>
          <li><a href="/widgets/chat" target="_blank" rel="noopener">Chat Overlay</a></li>
          <li><a href="/widgets/raffle" target="_blank" rel="noopener">Raffle</a></li>
          <li><a href="/widgets/achievements" target="_blank" rel="noopener">Achievements</a></li>
        </ul>
      </div>
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-white" data-i18n="dashboardControlsDocs"></h3>
        <ul class="list-disc list-inside text-sm text-[var(--text-secondary)]">
          <li>
            <a href="https://getty.sh/en/guide/widgets/" target="_blank" rel="noopener"
              >Widgets Guide</a
            >
          </li>
          <li>
            <a href="https://getty.sh/en/guide/automation/" target="_blank" rel="noopener"
              >Automation</a
            >
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
