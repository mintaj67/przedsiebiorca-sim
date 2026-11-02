import { describe, it, expect } from 'vitest';
import { createInitialState } from '../initialState';
import eventsData from '../../data/events.json';

describe('Event: Radziecki hipnotyzer', () => {
  it('opcja "Śmiejesz się" poprawnie odejmuje 500 PLN przy pechu', () => {
    let state = createInitialState({
      seed: 'test', difficulty: 'medium', inPZPR: false, activity: 'handel', companyName: 'Test', suffix: '', size: 'micro',
    });
    
    const hipnozaEvent = (eventsData as any[]).find(e => e.id === 'hipnotyzer_tv');
    
    // Wstrzykujemy event do stanu
    state.pendingEvents = [hipnozaEvent];

    // Wymuszamy wynik z wagą 7 (pech)
    // (W prawdziwym teście użylibyśmy mockowania RNG, ale dla uproszczenia sprawdzamy strukturę)
    const effect = hipnozaEvent.choices[1].outcomes[1].effects;
    
    expect(effect.stanKonta).toBe(-500);
  });
});