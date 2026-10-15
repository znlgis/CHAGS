import { ref } from 'vue';
import type { Ref } from 'vue';

export interface Route {
  name: 'hall' | 'play' | 'album' | 'review';
  /** 内容 id：play 是玩哪一部，review 是复习哪一部（两者共用同一个 id 空间） */
  entryId?: string;
}

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const id = parts[1];
  if (parts[0] === 'play' && id) return { name: 'play', entryId: decodeURIComponent(id) };
  if (parts[0] === 'review' && id) return { name: 'review', entryId: decodeURIComponent(id) };
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
