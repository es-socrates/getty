import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import i18n from './i18n';
import './styles/admin-tailwind.css';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import 'primeicons/primeicons.css';
import '@primevue/themes/lara';

const app = createApp(App);
app.use(router);
app.use(i18n);
app.use(PrimeVue);
app.use(ToastService);
app.mount('#app');
