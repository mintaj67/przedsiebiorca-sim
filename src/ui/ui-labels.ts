export const REPUTATION_LABELS: Record<string, string> = {
  branza: 'Branża',
  opiniaPubliczna: 'Opinia publiczna',
  opiniaPracownicy: 'Opinia pracowników',
  opiniaBranza: 'Opinia w branży',
  opiniaMafia: 'Opinia wśród mafii',
  opiniaMedia: 'Opinia w mediach',
  opiniaPolitycy: 'Opinia wśród polityków',
  opiniaSkarbowa: 'Urząd Skarbowy',
  ogolna: 'Reputacja ogólna',
};

export const REPUTATION_DESCRIPTIONS: Record<string, string> = {
  branza: 'Stała reputacja przypisana do działalności firmy. Zmienia się tylko przy zmianie branży.',
  opiniaPubliczna: 'Jak postrzegają cię zwykli ludzie. Wpływa na decyzje klientów i kontrahentów.',
  opiniaPracownicy: 'Nastawienie załogi. Zbyt niska może oznaczać strajki i rotację.',
  opiniaBranza: 'Jak widzą cię konkurenci i partnerzy biznesowi.',
  opiniaMafia: 'Twoja pozycja w półświatku. Powyżej progu zaczyna szkodzić opinii publicznej.',
  opiniaMedia: 'Jak piszą o tobie gazety i telewizja. Statystyka ukryta.',
  opiniaPolitycy: 'Twoje wpływy w świecie polityki. Statystyka ukryta. Waga zależy od wyników wyborów.',
};

export const WPLYWY_LABELS: Record<string, string> = {
  przychodyZDzialalnosci: 'Przychody z działalności',
  srodkiZKredytow: 'Środki z kredytów',
  dofinansowania: 'Dofinansowania',
  dofinansowaniaSzaraStrefa: 'Dofinansowania z szarej strefy',
  dochodPasywny: 'Dochód pasywny',
  splatyZobowiazan: 'Spłaty zobowiązań',
};

export const WYDATKI_LABELS: Record<string, string> = {
  splacaneKredyty: 'Spłacane kredyty',
  pracownicy: 'Pracownicy',
  czynsz: 'Czynsz',
  podatki: 'Podatki',
  kary: 'Kary',
  wydatkiNieplanowane: 'Wydatki nieplanowane',
  zakupy: 'Zakupy',
  inne: 'Inne',
};

export const PARTY_LABELS: Record<string, string> = {
  sld: 'SLD',
  uw: 'Unia Wolności',
  aws: 'AWS',
  psl: 'PSL',
  lpr: 'LPR',
  samo: 'Samoobrona',
  pis: 'PiS',
  po: 'PO',
  lew: 'Lewica',
  kon: 'Konfederacja',
};

export function partyLabel(id: string | null | undefined): string {
  if (!id) return 'bezpartyjny';
  return PARTY_LABELS[id] ?? id;
}