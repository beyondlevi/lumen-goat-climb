import type {PhaseKey} from './phases';

/** Every text the game shows. English is the default; Portuguese for pt-* (the glasses run pt-PT). */
const en = {
  title1: 'GOAT',
  title2: 'CLIMB',
  tagline: 'HOW HIGH CAN YOU GO?',
  play: 'SWIPE UP TO PLAY',
  bestLine: 'Best: {meters} m · Phase {phase}',
  firstClimb: 'Your first climb',
  titleHints: 'Index tap: how to play · Middle tap: exit',
  howTitle: 'HOW TO PLAY',
  swipeLeft: 'SWIPE LEFT',
  swipeLeftText: 'Leap up and to the left',
  swipeUp: 'SWIPE UP',
  swipeUpText: 'Jump straight up',
  swipeRight: 'SWIPE RIGHT',
  swipeRightText: 'Leap up and to the right',
  howLand: 'Land on a ledge to jump again. Mid-air, swipe sideways to drift, up to stop drifting. Off one side, you come back on the other.',
  howRise: 'The mountain keeps rising: fall below the bottom and the climb ends.',
  howPause: 'Middle tap: pause',
  left: 'LEFT',
  up: 'UP',
  right: 'RIGHT',
  best: 'BEST {meters} m',
  phase: 'PHASE {number} · {name}',
  paused: 'PAUSED',
  resume: 'RESUME',
  resumeHint: 'Index tap',
  quit: 'QUIT',
  quitHint: 'Middle tap',
  fell: 'YOU FELL!',
  newRecord: 'NEW RECORD',
  overLine: 'Phase {phase} · {name} · best {best} m',
  overLineRecord: 'Phase {phase} · {name} · previous best {best} m',
  again: 'SWIPE UP: AGAIN',
  overHint: 'Middle tap: exit',
  phases: {
    meadow: {name: 'MEADOW', banner: 'Wide, steady ledges.'},
    forest: {name: 'FOREST', banner: 'Logs slide sideways.\nThe mountain rises faster.'},
    cliffs: {name: 'CLIFFS', banner: 'Cracked ledges fall\nafter one landing.'},
    snow: {name: 'SNOW', banner: 'Ice slides you along.\nWind pushes you mid-air.'},
    peak: {name: 'PEAK', banner: 'Clouds fade away.\nWatch out for eagles.'},
  } as Record<PhaseKey, {name: string; banner: string}>,
};

export type Strings = typeof en;

const pt: Strings = {
  title1: 'GOAT',
  title2: 'CLIMB',
  tagline: 'ATÉ ONDE VOCÊ SOBE?',
  play: 'DESLIZE PARA CIMA',
  bestLine: 'Recorde: {meters} m · Fase {phase}',
  firstClimb: 'A sua primeira subida',
  titleHints: 'Indicador: como jogar · Médio: sair',
  howTitle: 'COMO JOGAR',
  swipeLeft: 'DESLIZE À ESQUERDA',
  swipeLeftText: 'Salta para cima e para a esquerda',
  swipeUp: 'DESLIZE PARA CIMA',
  swipeUpText: 'Salta direto para cima',
  swipeRight: 'DESLIZE À DIREITA',
  swipeRightText: 'Salta para cima e para a direita',
  howLand: 'Pouse numa saliência para saltar de novo. No ar, deslize para o lado para desviar e para cima para parar. Saindo por um lado, volta pelo outro.',
  howRise: 'A montanha não para de subir: caia abaixo da borda e a subida acaba.',
  howPause: 'Médio: pausa',
  left: 'ESQ.',
  up: 'CIMA',
  right: 'DIR.',
  best: 'RECORDE {meters} m',
  phase: 'FASE {number} · {name}',
  paused: 'PAUSA',
  resume: 'CONTINUAR',
  resumeHint: 'Toque do indicador',
  quit: 'SAIR',
  quitHint: 'Toque do médio',
  fell: 'VOCÊ CAIU!',
  newRecord: 'NOVO RECORDE',
  overLine: 'Fase {phase} · {name} · recorde {best} m',
  overLineRecord: 'Fase {phase} · {name} · recorde anterior {best} m',
  again: 'DE NOVO: PARA CIMA',
  overHint: 'Médio: sair',
  phases: {
    meadow: {name: 'PRADO', banner: 'Saliências largas e firmes.'},
    forest: {name: 'FLORESTA', banner: 'Troncos deslizam para os lados.\nA montanha sobe mais rápido.'},
    cliffs: {name: 'PENHASCOS', banner: 'Pedras rachadas caem\ndepois de um pouso.'},
    snow: {name: 'NEVE', banner: 'O gelo faz escorregar.\nO vento empurra no ar.'},
    peak: {name: 'PICO', banner: 'As nuvens desaparecem.\nCuidado com as águias.'},
  },
};

const catalogs: Record<string, Strings> = {en, pt};

/** The strings for [language] (a BCP 47 tag): its base language if there is a catalog, else English. */
export function stringsFor(language: string | undefined): Strings {
  const base = (language ?? 'en').toLowerCase().split('-')[0];
  return catalogs[base] ?? en;
}

/** Fills `{name}` placeholders. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export const catalogsForTests = {en, pt};
