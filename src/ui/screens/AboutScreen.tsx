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
            <h2 className="font-bold text-stone-900 mb-2">Polski Przedsiębiorca Simulator wersja beta</h2>
            <p>
              Gra strategiczna, w której wcielasz się w rolę właściciela polskiej firmy
              założonej w 1989 roku. Zarządzasz pracownikami i biurem, unikasz 
              skarbówki, mafii i wielu innych problemów, o których się nawet fizjologom nie śniło.
            </p>
            <p className="mt-2">
              GRA ZOSTAŁA STWORZONA ZA POMOCĄ AI. 
              Koncept, mechaniki, zasady, wszystkie teksty oraz grafiki zostały wymyślone przeze mnie, AI zostało wykorzystane
              wyłącznie w celu wcielenia moich pomysłów w życie. 
            </p>
          </section>

          <section>
            <h2 className="font-bold text-stone-900 mb-2">Autor</h2>
            <p>
              Gra tworzona hobbystycznie przez <b>MENTOS GAMES</b>.
            </p>
            <p>
              Kontakt: <b>https://www.facebook.com/niefajnerzeczy</b>
            </p>
          </section>

          <section>
            <h2 className="font-bold text-stone-900 mb-2">Wsparcie</h2>
            <p>
              Gra jest w pełni darmowa, ale wkrótce założę Patronite
              za pośrednictwem którego będzie można rzucić grosza lub tychże 67 autorowi.
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
              Dziękuję wszystkim, poza urażonymi, moim znajomym, rodzinie i wszystkim 
              poza tymi którym nie dziękuję. No i dziękuję też Tetrykom, bo gdyby nie 
              ich Polski Piłkarz Simulator to bym nawet nie wpadł na to, że można sobie
              zrobić grę poprzez pisanie komputerowi, a ten robi.
            </p>
          </section>

          <section className="text-xs text-stone-500 pt-4 border-t border-stone-200">
            <p>Polski Przedsiębiorca · wersja 0.67 · prototyp</p>
            <p>© by MENTOS GAMES 2026</p>
            <p>Gra tworzona w TypeScript, React i Vite.</p>
            <p>Wszelkie podobieństwo osób i postaci w grze do osób i postaci w grze jest przypadkowe.</p>
          </section>
        </div>
      </div>
    </div>
  );
}