import { createRouter, createWebHistory } from 'vue-router';

export const routes = [
  { path: '/admin', redirect: '/admin/status' },
  { path: '/admin/status', name: 'status', component: () => import('../views/StatusView.vue') },
  { path: '/admin/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
  { path: '/admin/chat', name: 'chat', component: () => import('../views/ChatView.vue') },
  { path: '/admin/events', name: 'events', component: () => import('../views/EventsView.vue') },
  { path: '/admin/notifications', name: 'notifications', component: () => import('../views/NotificationsView.vue') },
  { path: '/admin/social-media', name: 'social-media', component: () => import('../views/SocialMediaView.vue') },
  { path: '/admin/integrations', name: 'integrations', component: () => import('../views/ExternalNotificationsView.vue') },
  { path: '/admin/announcement', name: 'announcement', component: () => import('../views/AnnouncementView.vue') },
  { path: '/admin/liveviews', name: 'liveviews', component: () => import('../views/LiveviewsView.vue') },
  { path: '/admin/user-profile', name: 'user-profile', component: () => import('../views/UserProfileView.vue') },
  { path: '/admin/raffle', name: 'raffle', component: () => import('../views/RaffleView.vue') },
  { path: '/admin/achievements', name: 'achievements', component: () => import('../views/AchievementsView.vue') },
  { path: '/admin/tip-goal', name: 'tip-goal', component: () => import('../views/TipGoalView.vue') },
  { path: '/admin/last-tip', name: 'last-tip', component: () => import('../views/LastTipView.vue') },
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
