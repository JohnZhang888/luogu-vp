import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import App from './App.vue';
import { createAppRouter } from './router';
import { useContestStore } from './stores/contest';
import './styles/main.css';
import 'katex/dist/katex.min.css';

const app = createApp(App);
const pinia = createPinia();
setActivePinia(pinia);
app.use(pinia);

const contest = useContestStore(pinia);
contest.load();

const router = createAppRouter(contest);
app.use(router);

app.mount('#app');
