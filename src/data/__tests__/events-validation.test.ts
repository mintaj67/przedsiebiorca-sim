import { describe, it, expect } from 'vitest';
import events from '../events.json';
import activities from '../activities.json';
import parties from '../parties.json';
import type { GameEvent, Activity, Party } from '../../engine/types';

describe('events.json - walidacja struktury', () => {
  const eventList = events as GameEvent[];

  it('każdy event ma id, title, description, weight, conditions, choices', () => {
    for (const ev of eventList) {
      expect(ev.id, `Event bez id`).toBeTruthy();
      expect(ev.title, `${ev.id}: brak title`).toBeTruthy();
      expect(ev.description, `${ev.id}: brak description`).toBeTruthy();
      expect(typeof ev.weight, `${ev.id}: weight musi być liczbą`).toBe('number');
      expect(ev.conditions, `${ev.id}: brak conditions`).toBeDefined();
      expect(ev.choices, `${ev.id}: brak choices`).toBeDefined();
    }
  });

  it('każdy event ma co najmniej jedną opcję', () => {
    for (const ev of eventList) {
      expect(ev.choices.length, `${ev.id}: 0 opcji`).toBeGreaterThan(0);
    }
  });

  it('każda opcja ma label i (effects lub gamble lub outcomes)', () => {
    for (const ev of eventList) {
      for (const c of ev.choices) {
        expect(c.label, `${ev.id}/${c.id}: brak label`).toBeTruthy();
        const hasEffect = c.effects || c.gamble || c.outcomes;
        expect(hasEffect, `${ev.id}/${c.id}: brak efektu (effects/gamble/outcomes)`).toBeTruthy();
      }
    }
  });

  it('id eventów są unikalne', () => {
    const ids = eventList.map(e => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('id opcji są unikalne w obrębie eventu', () => {
    for (const ev of eventList) {
      const ids = ev.choices.map(c => c.id);
      const unique = new Set(ids);
      expect(unique.size, `${ev.id}: duplikat id opcji`).toBe(ids.length);
    }
  });

  it('weight jest liczbą dodatnią', () => {
    for (const ev of eventList) {
      expect(ev.weight, `${ev.id}: weight <= 0`).toBeGreaterThan(0);
    }
  });
});

describe('activities.json - walidacja struktury', () => {
  const activityList = activities as Activity[];

  it('każda aktywność ma id, label, description, weight, effects', () => {
    for (const a of activityList) {
      expect(a.id).toBeTruthy();
      expect(a.label, `${a.id}: brak label`).toBeTruthy();
      expect(a.description, `${a.id}: brak description`).toBeTruthy();
      expect(typeof a.weight, `${a.id}: weight musi być liczbą`).toBe('number');
      expect(a.effects, `${a.id}: brak effects`).toBeDefined();
    }
  });

  it('id aktywności są unikalne', () => {
    const ids = activityList.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('parties.json - walidacja struktury', () => {
  const partyList = parties as Party[];

  it('każda partia ma wymagane pola', () => {
    for (const p of partyList) {
      expect(p.id).toBeTruthy();
      expect(p.name, `${p.id}: brak name`).toBeTruthy();
      expect(p.ideology, `${p.id}: brak ideology`).toBeTruthy();
      expect(p.size, `${p.id}: brak size`).toBeTruthy();
      expect(typeof p.activeFrom).toBe('number');
      expect(typeof p.activeTo).toBe('number');
    }
  });

  it('activeFrom <= activeTo', () => {
    for (const p of partyList) {
      expect(p.activeFrom, `${p.id}: activeFrom > activeTo`).toBeLessThanOrEqual(p.activeTo);
    }
  });

  it('id partii są unikalne', () => {
    const ids = partyList.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('PSL ma isPSL: true', () => {
    const psl = partyList.find(p => p.id === 'psl');
    expect(psl?.isPSL).toBe(true);
  });
});