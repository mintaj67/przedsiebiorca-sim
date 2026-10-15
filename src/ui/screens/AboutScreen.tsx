import { useGameStore } from '../../store/gameStore';

export function AboutScreen() {
  const setScreen = useGameStore(s => s.setScreen);

  return (
    <div className="min-h-screen bg-stone-100 p-6 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">O grze</h1>
          <button
            onClick={() => setScreen('menu')}
            className="text-sm text-stone-500 hover:text-stone-900"
          >
            ← Powrót
          </button>
        </div>

        <div className="space-y-6 text-sm text-stone-700 leading-relaxed">
          <section>
            <h2 className="font-bold text-stone-900 mb-2">Polski Przedsiębiorca</h2>
            <p>
              Turowy symulator polskiego przedsiębiorcy osadzony w latach 1989–2030.
              Zakładasz firmę w chaosie transformacji ustrojowej i prowadzisz ją przez
              kolejne dekady — przez hiperinflację, wejście do NATO i Unii Europejskiej,
              kryzysy, aż po moment, w którym rzeczywistość przestaje być przewidywalna.
            </p>
            <p className="mt-2">
              Każda decyzja ma konsekwencje. Reputacja, finanse, polityka i lojalności
              splatają się w jedną sieć zależności. Wygrana nie jest celem — celem jest
              przetrwanie.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-stone-900 mb-2">Autor</h2>
            <p>
              Gra tworzona hobbystycznie przez <b>[TWOJE IMIĘ / NICK]</b>.
            </p>
            <p>
              Kontakt: <b>[twój e-mail lub nick na Discordzie]</b>
            </p>
          </section>

          <section>
            <h2 className="font-bold text-stone-900 mb-2">Wsparcie</h2>
            <p>
              Jeśli gra ci się podoba i chcesz, żeby dalej się rozwijała —
              możesz wesprzeć projekt na Patronite.
            </p>
            <a
              href="https://patronite.pl/"
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-2 bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-700"
            >
              ⚙ Wesprzyj na Patronite
            </a>
          </section>

          <section>
            <h2 className="font-bold text-stone-900 mb-2">Podziękowania</h2>
            <p>
              Dziękuję wszystkim, którzy testowali grę, zgłaszali błędy i dzielili się
              pomysłami. Bez was ten projekt nie miałby sensu.
            </p>
          </section>

          <section className="text-xs text-stone-500 pt-4 border-t border-stone-200">
            <p>Polski Przedsiębiorca · wersja 0.67 · prototyp</p>
            <p>© by HZ GAMES 2026</p>
            <p className="mt-1">
              Gra tworzona w TypeScript, React i Vite. Wszystkie postacie i wydarzenia
              są fikcyjne, a podobieństwo do osób rzeczywistych — przypadkowe.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}