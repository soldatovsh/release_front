import Vue from 'vue';
import VueRouter from 'vue-router';
import App from './App.vue';
import router from './router';
import store from './store';
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';
import { Metacom } from '../lib/metacom.js';

library.add(fas, far, fab);
Vue.component('font-awesome-icon', FontAwesomeIcon);
Vue.config.productionTip = false;
window.vuex = store;

const init = async () => {
  const protocol = location.protocol === 'http:' ? 'ws' : 'wss';
  const metacom = Metacom.create(`${protocol}://localhost:8000`);
  const { api } = metacom;
  window.api = api;

  await metacom.load('auth', 'example', 'db', 'chat', 'session', 'lobby', 'game', 'helper', 'subscribe');

  localStorage.removeItem('currentGame');
  const token = localStorage.getItem('metarhia.session.token');
  const session = await api.auth.initSession({ token, demo: true });
  const { token: sessionToken, userId } = session;
  if (token !== sessionToken) localStorage.setItem('metarhia.session.token', sessionToken);
  if (userId) {
    store.dispatch('setSimple', { currentUser: userId });
  }

  router.beforeEach((to, from, next) => {
    const currentGame = localStorage.getItem('currentGame');
    if (to.name === 'Game') {
      if (!currentGame) return next({ name: 'Home' });
    } else {
      if (currentGame) return next({ name: 'Game', params: { id: currentGame } });
    }
    return next();
  });

  new Vue({
    router,
    store,
    render: function(h) {
      return h(App);
    },
  }).$mount('#app');

  const { userAgent } = navigator;
  const isMobile = () =>
    userAgent.match(/Android/i) ||
    userAgent.match(/webOS/i) ||
    userAgent.match(/iPhone/i) ||
    userAgent.match(/iPad/i) ||
    userAgent.match(/iPod/i) ||
    userAgent.match(/BlackBerry/i) ||
    userAgent.match(/Windows Phone/i);
  const isLandscape = () => window.innerHeight < window.innerWidth;

  window.addEventListener('orientationchange', () => {
    store.dispatch('setSimple', { isLandscape: isLandscape() });
  });
  store.dispatch('setSimple', { isMobile: isMobile() ? true : false, isLandscape: isLandscape() });

  api.db.on('updated', data => {
    store.dispatch('setData', data);
  });
  api.db.on('smartUpdated', data => {
    store.dispatch('setStore', data);
  });

  api.session.on('joinGame', data => {
    localStorage.setItem('currentGame', data.gameId);
    store.dispatch('setSimple', { currentPlayer: data.playerId });
    router.push({ path: `/game/${data.gameId}` });
  });
  api.session.on('leaveGame', () => {
    localStorage.removeItem('currentGame');
    router.push({ path: `/` });
  });

  document.addEventListener('click', async event => {
    if (event.target.classList.contains('active-event')) {
      await api.game.action({
        name: 'eventTrigger',
        data: { eventData: { targetId: event.target.attributes.id?.value } },
      });
    }
  });
};

init();
