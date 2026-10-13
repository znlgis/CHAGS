import { ref } from 'vue';
import type { Ref } from 'vue';

export interface Route {
  name: 'hall' | 'play' | 'album';
  gameId?: string;
}

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'play' && parts[1]) {
    return { name: 'play', gameId: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === 'album') return { name: 'album' };
  return { name: 'hall' };
}

const route: Ref<Route> = ref(parse(window.location.hash));

window.addEventListener('hashchange', () => {
  route.value = parse(window.location.hash);
});

export function useRoute(): Ref<Route> {
  return route;
}

export function navigate(path: string): void {
  window.location.hash = path.startsWith('#') ? path : '#' + path;
}
