import { store } from './store.js';
import { render, attachEvents } from './view.js';

const start = async () => {
  await store.ready;
  attachEvents();
  store.subscribe(render);
  render();
};

start();
