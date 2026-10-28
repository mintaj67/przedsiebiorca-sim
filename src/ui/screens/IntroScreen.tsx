import { useGameStore } from '../../store/gameStore';
import { getActivityFullInfo } from '../../engine/activityHelper';

export function IntroScreen() {
  const { state } = useGameStore();
  if (!state) return null;

  const isPZPR = state.ceo.party === 'PZPR';
  const size = state.company.size;
  const diff = state.difficulty;
  const { category, subcategory } = getActivityFullInfo(state.company.activity);

  // 1. Tekst o wielkości firmy
  let sizeText = '';
  if (isPZPR) {
    if (size === 'micro') sizeText = 'Z racji tego, że nie miałeś zbyt wielu znajomych w partii, zajmujesz się tym sam.';
    else if (size === 'small') sizeText = 'Jakimś sposobem zdołałeś znaleźć paru wariatów, którzy postanawiają z tobą wejść w to.';
    else sizeText = 'Nie mam pojęcia jak, ale znalazłeś grupę ludzi, niektórzy nawet kompetentni (!), która też uznała to za dobry pomysł i z tobą w to wejść.';
  } else {
    if (size === 'micro') sizeText = 'Z racji tego, że nie masz zbyt wielu kolegów, wchodzisz w to sam.';
    else if (size === 'small') sizeText = 'Masz paru ziomków, którzy nie mają nic lepszego do roboty i nic do stracenia, którzy z tobą w to wchodzą.';
    else sizeText = 'Tylko sobie znanym sposobem zorganizowałeś ekipę ludzi, którzy z chęcią się u ciebie zatrudnią.';
  }

  // 2. Tekst o trudności
  let diffText = '';
  if (diff === 'easy') {
    diffText = isPZPR 
      ? 'O fundusze na start nie musisz się martwić. Twój ojciec był za komuny badylarzem, a jego Fiata Mirafiori kojarzył każdy w twoim Małym Mieście. Co prawda jako prywaciarz nie jest szczególnie zadowolony z tego, że zapisałeś się do partii, ale chętnie pomoże ci w rozkręceniu biznesu - zwłaszcza jeśli wiązałoby się to z pozbyciem się Ciebie z domu.'
      : 'O fundusze na start nie musisz się martwić. Twój ojciec był za komuny badylarzem, a jego Fiata Mirafiori kojarzył każdy w twoim Małym Mieście. Twój ojciec jest dumny z tego, że popierasz działalność opozycyjną. Może mniej dumny z efektów, ale docenia to, że przynajmniej próbujesz. Chętnie ci pomoże w rozkręceniu twojego pierwszego biznesu w Wolnej Polsce.';
  } else if (diff === 'medium') {
    diffText = isPZPR
      ? 'Mimo relatywnie krótkiego stażu, udało ci się załapać na naprawdę wysoką odprawę dla pracowników PZPR. Być może to wynika z tego, że masz takie samo nazwisko co wysoko postawiony działacz partyjny z twojego miasta i postanowiłeś "niechcący" podać jego imię we wniosku, ale nie wnikajmy w to.'
      : 'Też sobie tylko znanym sposobem, udaje ci się skołować całkiem solidną sumkę na start. Może to zasługa twojego sprytu, może to zasługa twoich rozległych kontaktów, może jakimś cudem uzyskałeś dostęp do sejfu ze środkami Solidarności na bieżącą działalność i okazało się, że kod 1980 zadziałał. Nie wnikajmy w to.';
  } else {
    diffText = isPZPR
      ? 'Twoja matka ciężko pracowała przez całe życie jako włókniarka w Łodzi. W twoim domu nigdy się nie przelewało. Choćby dlatego, że byliście tak biedni, że było was stać tylko na jeden kubek. Całe życie była jednak komunistką i ucieszyła się na wieść o tym, że dołączyłeś do PZPR. Bo przecież nie mógłbyś być tak cyniczny i dołączyć do niej w 1988 z innych pobudek niż ideowe, prawda? Postanawia wyciągnąć ostatnie dolary wysłane przez ojca przebywającego w USA na tak zwaną czarną godzinę i pomóc ci w rozkręceniu biznesu.'
      : 'Twoja matka ciężko pracowała przez całe życie jako włókniarka w Łodzi. W twoim domu nigdy się nie przelewało. Choćby dlatego, że byliście tak biedni, że było was stać tylko na jeden kubek. Gdy dowiedziała się o twojej działalności opozycyjnej, była blisko rozbicia go na twojej głowie. Mimo to, gdy się dowiedziała, że chcesz założyć własną firmę, uznała, że to jedyna szansa na to, by ktokolwiek z tej rodziny odniósł chociaż jako-taki sukces w życiu i postanawia Ci pomóc. Zwłaszcza, że będzie się to wiązać z pozbyciem się Ciebie z domu. Postanawia wyciągnąć ostatnie dolary wysłane przez ojca przebywającego w USA na tak zwaną czarną godzinę i pomóc ci w rozkręceniu biznesu.';
  }

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6 overflow-y-auto">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl p-8 md:p-12 my-8 border-t-8 border-stone-900">
        <h1 className="text-3xl font-bold text-center mb-8 uppercase tracking-widest text-stone-800">
          Etap 1: Chaos
        </h1>
        
        <div className="space-y-4 text-stone-700 leading-relaxed text-sm md:text-base">
          <p>
            Jest rok 1989. Polska Rzeczpospolita Ludowa właśnie chyli się ku upadkowi. Bieda i syf walczą o ostatni kawałek chleba, robotnicy strajkują i generalnie psy nie szczekają dupami tylko dlatego, ponieważ zjedli je bezdomni. Nawet kadra Łazarka gra piach.
          </p>
          <p>
            Żeby jakoś uratować sytuację, PZPR wprowadza tzw. Ustawę Wilczka, która miała w założeniu uwolnić gospodarkę i ułatwić prowadzenie własnej działalności.
          </p>
          <p>
            {isPZPR ? (
              <>Jako członek PZPR (data dołączenia: 6 lipca 1988) postanawiasz skorzystać z tej furtki i dokonać uwłaszczenia nomenklatury. Co? Napisałem dokonać uwłaszczenia nomenklatury? Miałem na myśli założenie legalnej, uczciwej (wink wink) działalności gospodarczej. {sizeText}</>
            ) : (
              <>Co prawda jesteś przeciwnikiem systemu i działaczem opozycyjnym (twoim największym osiągnięciem jest przetrzymywanie ulotek Solidarności pod łóżkiem przez 2 godziny), ale postanawiasz skorzystać z tej furtki otwartej przez rząd. {sizeText}</>
            )}
          </p>
          <p>{diffText}</p>
          <p className="text-stone-900 border-l-4 border-stone-900 pl-4 py-2 my-6 bg-stone-50">
            Postanowiłeś że wchodzisz w <b>{category}</b>. Usłyszałeś, że <b>{subcategory}</b> to ponoć żyła złota. Czy uda ci się zostać POLSKIM PRZEDSIĘBIORCĄ?
          </p>
        </div>

        <button 
          onClick={() => useGameStore.setState(s => ({ state: { ...s.state!, showIntro: false } }))}
          className="w-full mt-8 bg-stone-900 text-white py-4 rounded text-lg font-bold hover:bg-stone-800 transition"
        >
          Rozpocznij karierę →
        </button>
      </div>
    </div>
  );
}