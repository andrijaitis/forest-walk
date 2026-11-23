// All user-visible text in one place (Lithuanian).
export const t = {
  start: 'PRADĖTI',
  stop: 'BAIGTI',
  holdToStop: 'Laikykite nuspaudę 2 sekundes',
  recording: 'Įrašoma',
  notRecording: 'Neįrašoma',
  loadingMap: 'Kraunamas žemėlapis…',
  centerOnMe: 'Rodyti mano vietą',
  notificationTitle: 'Miško takas įrašo kelią',
  notificationBody: 'Jūsų kelias išsaugomas.',
  needLocation: 'Reikia leidimo naudoti vietą. Prašome leisti.',
  needBackground:
    'Vietos nustatymui pasirinkite „Leisti visą laiką“, kitaip įrašymas sustos išjungus ekraną.',
  gpsOff: 'Prašome įjungti vietos nustatymą (GPS).',
  duration: (h: number, m: number) => `${h} val. ${String(m).padStart(2, '0')} min.`,
};
