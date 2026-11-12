import type { StateCreator } from 'zustand';
import { applyEffects } from '../../engine/actions';
import { recomputeReputation } from '../../engine/reputation';
import { MAX_NEWS } from '../../engine/constants';
import { autosave } from '../autosave';
import type { NewsItem, NewsChoice } from '../../engine/types';

export interface NewsSlice {
  markNewsRead: (id: string) => void;
  resolveNewsChoice: (newsId: string, choiceId: string) => void;
  devAddTestNews: () => void;
}

export const createNewsSlice: StateCreator<any, [], [], NewsSlice> = (set, get) => ({
  markNewsRead: (id) => {
    const s = get().state;
    if (!s) return;
    const next = {
      ...s,
      news: s.news.map((n: NewsItem) => (n.id === id ? { ...n, read: true } : n)),
    };
    set({ state: next, savesVersion: Date.now() });
    autosave(next, get().currentSlotId);
  },
  resolveNewsChoice: (newsId, choiceId) => {
    const s = get().state;
    if (!s) return;
    const next = structuredClone(s);
    const item = next.news.find((n: NewsItem) => n.id === newsId);
    if (!item || item.resolved || !item.choices) return;
    const choice = item.choices.find((c: NewsChoice) => c.id === choiceId);
    if (!choice) return;

    if (choice.effects) applyEffects(next, choice.effects);
    item.resolved = true;
    item.resolvedChoiceId = choiceId;
    item.read = true;
    next.company.reputation = recomputeReputation(next);

    set({ state: next, savesVersion: Date.now() });
    autosave(next, get().currentSlotId);
  },
  devAddTestNews: () => {
    const s = get().state;
    if (!s) return;
    const next = structuredClone(s);
    next.news.unshift({
      id: `test_action_${next.turn}_${next.news.length}`,
      turn: next.turn,
      year: next.year,
      quarter: next.quarter,
      headline: 'Testowa wiadomość z akcją',
      body: 'To jest test systemu ActionableNews.\nWybierz jedną z opcji poniżej.',
      category: 'custom',
      read: false,
      resolved: false,
      expiresAtTurn: next.turn + 3,
      choices: [
        { id: 'a', label: 'Opcja A — dostajesz 10 000 PLN', effects: { stanKonta: 10000 } },
        { id: 'b', label: 'Opcja B — tracisz 5 000 PLN', effects: { stanKonta: -5000 } },
      ],
      onExpireEffects: { reputation: { opiniaPubliczna: -3 } },
    });
    if (next.news.length > MAX_NEWS) next.news.pop();
    set({ state: next, savesVersion: Date.now() });
    autosave(next, get().currentSlotId);
  },
});