/**
 * All player-facing text for "Light Within".
 *
 * A translation is a second file that satisfies `GameStrings` (for example
 * `strings.de.ts`) plus one extra entry in the `LOCALES` map below.
 *
 * Text rules: short sentences, sentence case, no all caps, no filler.
 * No medical or healing claims. Manifestation is framed as personal reflection.
 */

/** Working title. Kept as one constant so it is easy to change. */
export const GAME_TITLE = 'Light Within';

export interface GameStrings {
  readonly title: string;
  readonly start: {
    readonly begin: string;
    readonly settings: string;
    readonly back: string;
    readonly subtitle: string;
    readonly version: string;
  };
  readonly questions: {
    readonly heading: string;
    readonly headingEnd: string;
    readonly receive: string;
    readonly calm: string;
    readonly privacy: string;
    readonly receiveLow: string;
    readonly receiveHigh: string;
    readonly calmLow: string;
    readonly calmHigh: string;
    readonly continue: string;
  };
  readonly settings: {
    readonly heading: string;
    readonly rhythm: string;
    readonly rhythmNormal: string;
    readonly rhythmSlow: string;
    readonly rhythmEasy: string;
    readonly quality: string;
    readonly qualityAuto: string;
    readonly qualityLow: string;
    readonly qualityMedium: string;
    readonly qualityHigh: string;
    readonly volume: string;
    readonly mute: string;
    readonly reducedMotion: string;
    readonly on: string;
    readonly off: string;
  };
  readonly pause: {
    readonly heading: string;
    readonly resume: string;
    readonly settings: string;
    readonly toStart: string;
  };
  readonly hud: {
    readonly breatheIn: string;
    readonly breatheOut: string;
    readonly breatheInShort: string;
    readonly breatheOutShort: string;
    readonly breatheInKeys: string;
    readonly breatheOutKeys: string;
    readonly push: string;
    readonly pause: string;
    readonly plant: string;
    readonly breathCircle: string;
    readonly lightCarried: string;
    readonly joystick: string;
  };
  readonly fog: {
    /** Shown inside the fog in a handwritten style. Reflection, not a claim. */
    readonly thought: string;
  };
  readonly seed: {
    readonly heading: string;
    readonly bridge: string;
    readonly tree: string;
    readonly house: string;
    readonly well: string;
    readonly comingSoon: string;
    readonly cost: string;
    readonly notEnough: string;
    readonly cancel: string;
    readonly plant: string;
  };
  readonly reflect2: {
    readonly question: string;
    readonly sadness: string;
    readonly anger: string;
    readonly worry: string;
    readonly none: string;
  };
  readonly naming: {
    readonly question: string;
    readonly sadness: string;
    readonly anger: string;
    readonly worry: string;
    readonly lookAgain: string;
  };
  readonly understand2: {
    readonly card: string;
  };
  readonly apply2: {
    readonly card: string;
  };
  readonly storm: {
    readonly thought: string;
  };
  readonly pause2: {
    readonly heading: string;
  };
  readonly settings2: {
    readonly softStorm: string;
  };
  readonly seed2: {
    readonly tree: string;
  };
  readonly reflect: {
    readonly question: string;
    readonly answerCalm: string;
    readonly answerImpatient: string;
    readonly answerNothing: string;
    readonly reply: string;
  };
  readonly understand: {
    readonly card: string;
  };
  readonly apply: {
    readonly card: string;
  };
  readonly chapters: {
    readonly chapter1: string;
    readonly chapter2: string;
    readonly chapter3: string;
    readonly select: string;
    readonly locked: string;
  };
  readonly end: {
    readonly heading: string;
    readonly heading2: string;
    readonly playAgain: string;
    readonly toStart: string;
    readonly nextChapter: string;
    readonly comingSoon: string;
    readonly next: string;
    readonly continueTo: string;
  };
  readonly debug: {
    readonly heading: string;
    readonly exportResults: string;
  };
  /**
   * What the guide says.
   *
   * She speaks after the player has met a thing, never before it. Every line
   * here is short enough to read while walking, and none of them tells the
   * player what to do — they name what just happened, or they offer a
   * direction to somebody who has been wandering.
   */
  readonly guide: {
    readonly close: string;
    readonly greet: string;
    readonly lost: string;
    readonly firstBreath: string;
    readonly springFound: string;
    readonly springDry: string;
    readonly fogMet: string;
    readonly fogGone: string;
    readonly seedPlanted: string;
    readonly bridgeStands: string;
  };
}

export const en: GameStrings = {
  title: GAME_TITLE,
  start: {
    begin: 'Begin',
    settings: 'Settings',
    back: 'Back',
    subtitle: 'A quiet walk in a grey valley.',
    version: 'Build',
  },
  questions: {
    heading: 'Two questions before you start',
    headingEnd: 'Two questions before you go',
    receive: 'How easy is it for you to receive help or gifts?',
    calm: 'How calm do you feel right now?',
    privacy: 'Your answers stay on this device.',
    receiveLow: 'Not easy',
    receiveHigh: 'Very easy',
    calmLow: 'Not calm',
    calmHigh: 'Very calm',
    continue: 'Continue',
  },
  settings: {
    heading: 'Settings',
    rhythm: 'Breath rhythm',
    rhythmNormal: 'Normal',
    rhythmSlow: 'Slow',
    rhythmEasy: 'Easy',
    quality: 'Quality',
    qualityAuto: 'Automatic',
    qualityLow: 'Low',
    qualityMedium: 'Medium',
    qualityHigh: 'High',
    volume: 'Sound volume',
    mute: 'Mute',
    reducedMotion: 'Reduced motion',
    on: 'On',
    off: 'Off',
  },
  pause: {
    heading: 'Take all the time you need.',
    resume: 'Continue',
    settings: 'Settings',
    toStart: 'Back to start',
  },
  hud: {
    breatheIn: 'Hold to breathe in',
    breatheOut: 'Hold to breathe out',
    breatheInShort: 'Breathe in',
    breatheOutShort: 'Breathe out',
    breatheInKeys: 'Hold space to breathe in',
    breatheOutKeys: 'Hold shift to breathe out',
    push: 'Push',
    pause: 'Pause',
    plant: 'Plant',
    breathCircle: 'Breath circle',
    lightCarried: 'Light you carry',
    joystick: 'Move',
  },
  fog: {
    thought: 'I do not deserve this.',
  },
  seed: {
    heading: 'What do you want to grow here?',
    bridge: 'Bridge',
    tree: 'Tree',
    house: 'House',
    well: 'Well',
    comingSoon: 'Later chapter',
    cost: 'Costs 5 light',
    notEnough: 'You need more light.',
    cancel: 'Not now',
    plant: 'Plant',
  },
  reflect: {
    question: 'What happened when you stopped?',
    answerCalm: 'I felt calm.',
    answerImpatient: 'I felt impatient.',
    answerNothing: 'I felt nothing yet.',
    reply: 'Thank you for noticing.',
  },
  reflect2: {
    question: 'Which weather did you meet most today?',
    sadness: 'Sadness',
    anger: 'Anger',
    worry: 'Worry',
    none: 'None',
  },
  naming: {
    question: 'What is this weather?',
    sadness: 'Sadness',
    anger: 'Anger',
    worry: 'Worry',
    lookAgain: 'Look again.',
  },
  understand2: {
    card: 'Dr. Rulin Xiu teaches that we can go inside and simply feel what is there, without pushing it away.',
  },
  apply2: {
    card: 'Three times today, stop. Ask: what do I feel in my body now? Give it a name.',
  },
  storm: {
    thought: 'This is not fair.',
  },
  pause2: {
    heading: 'Take all the time you need. It is okay to stop here.',
  },
  settings2: {
    softStorm: 'Soft storm sounds',
  },
  seed2: {
    tree: 'Tree',
  },
  understand: {
    card: 'Dr. Rulin Xiu teaches that everything is already given to us. When we do not receive it, it is often we who hold it back.',
  },
  apply: {
    card: 'Your practice for today: three times today, stop. Breathe three times. Notice what is already given to you.',
  },
  chapters: {
    chapter1: 'Receive',
    chapter2: 'Be aware',
    chapter3: 'Chapter 3',
    select: 'Chapters',
    locked: 'Not yet',
  },
  end: {
    heading: 'Chapter 1 complete.',
    heading2: 'Chapter 2 complete.',
    continueTo: 'Walk on',
    playAgain: 'Play again',
    toStart: 'Back to start',
    nextChapter: 'Chapter 2',
    comingSoon: 'Coming soon',
    next: 'Next',
  },
  guide: {
    close: 'Go on',
    greet: 'I am here.',
    lost: 'The valley goes on that way.',
    firstBreath: 'There you are.',
    springFound: 'Something was waiting here.',
    springDry: 'It is empty now. You have what it held.',
    fogMet: 'This one does not move for anyone who hurries.',
    fogGone: 'It was never in your way. It was only in front of you.',
    seedPlanted: 'Now leave it. Things grow when you are not watching.',
    bridgeStands: 'You made the way across.',
  },
  debug: {
    heading: 'Debug',
    exportResults: 'Export results',
  },
};

export type LocaleCode = 'en';

/** Add further locales here, for example `de: await import('./strings.de')`. */
export const LOCALES: Record<LocaleCode, GameStrings> = { en };

let active: GameStrings = en;

export function setLocale(code: LocaleCode): void {
  active = LOCALES[code];
}

/** The strings for the active locale. */
export function t(): GameStrings {
  return active;
}
