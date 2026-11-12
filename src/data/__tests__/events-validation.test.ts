import { describe, it, expect } from 'vitest';
import events from '../events.json';
import activities from '../activities.json';
import parties from '../parties.json';
import officeItems from '../office_items.json';
import type { GameEvent, Activity, Party } from '../../engine/types';

// --- 1. WALIDACJA EVENTÓW ---
describe('events.json - walidacja struktury', () => {
  const eventList = events as GameEvent[];

  it('każdy event ma wymagane pola i unikalne id', () => {
    const ids = eventList.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const ev of eventList) {
      expect(ev.id, 'Event bez id').toBeTruthy();
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
        expect(hasEffect, `${ev.id}/${c.id}: brak efektu`).toBeTruthy();
      }
    }
  });
});

// --- 2. WALIDACJA AKTYWNOŚCI (Daily Actions) ---
describe('activities.json - walidacja struktury', () => {
  const activityList = activities as Activity[];

  it('każda aktywność ma wymagane pola', () => {
    for (const a of activityList) {
      expect(a.id, 'Aktywność bez id').toBeTruthy();
      expect(a.label, `${a.id}: brak label`).toBeTruthy();
      expect(a.description, `${a.id}: brak description`).toBeTruthy();
      expect(typeof a.weight, `${a.id}: weight musi być liczbą`).toBe('number');
      expect(a.conditions, `${a.id}: brak conditions`).toBeDefined();
      expect(a.effects, `${a.id}: brak effects`).toBeDefined();
    }
  });

  it('id aktywności są unikalne', () => {
    const ids = activityList.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// --- 3. WALIDACJA PARTII ---
describe('parties.json - walidacja struktury', () => {
  const partyList = parties as Party[];

  it('każda partia ma wymagane pola i unikalne id', () => {
    const ids = partyList.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const p of partyList) {
      expect(p.id).toBeTruthy();
      expect(p.name, `${p.id}: brak name`).toBeTruthy();
      expect(p.ideology, `${p.id}: brak ideology`).toBeTruthy();
      expect(p.sizeSchedule, `${p.id}: brak sizeSchedule`).toBeDefined();
      expect(Array.isArray(p.sizeSchedule), `${p.id}: sizeSchedule nie jest tablicą`).toBe(true);
      expect(typeof p.activeFrom).toBe('number');
      expect(typeof p.activeTo).toBe('number');
    }
  });

  it('sizeSchedule ma poprawne przedziały czasowe', () => {
    for (const p of partyList) {
      for (const sched of p.sizeSchedule) {
        expect(sched.from, `${p.id}: sizeSchedule from > to`).toBeLessThanOrEqual(sched.to);
        expect(sched.size, `${p.id}: brak size w sizeSchedule`).toBeTruthy();
      }
    }
  });
});

// --- 4. WALIDACJA PRZEDMIOTÓW BIUROWYCH ---
describe('office_items.json - walidacja struktury', () => {
  it('każdy przedmiot ma unikalne id, nazwę, opis i dodatnią cenę', () => {
    const ids = officeItems.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const item of officeItems) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.price).toBeGreaterThan(0);
    }
  });
});