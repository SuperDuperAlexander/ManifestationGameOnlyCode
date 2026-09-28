import { describe, it, expect, beforeEach } from 'vitest';
import { GuideSystem } from '../../src/systems/guide';
import { EventBus } from '../../src/core/events';
import { GUIDE } from '../../src/content/chapter1';

/**
 * The guide's judgement.
 *
 * She is the one thing in this game that talks, which makes the rules about
 * when she does not talk the important ones. These are those rules.
 */
describe('GuideSystem', () => {
  let bus: EventBus;
  let guide: GuideSystem;

  /** Runs her forward, in the steps the game runs her in. */
  const run = (seconds: number, moving = false): void => {
    const step = 1 / 60;
    for (let t = 0; t < seconds; t += step) guide.update(step, moving);
  };

  beforeEach(() => {
    bus = new EventBus();
    guide = new GuideSystem(bus);
  });

  it('says nothing until it is given something to say', () => {
    run(5);
    expect(guide.current).toBeNull();
  });

  it('shows a message on the next step after it is offered', () => {
    guide.say('greet', { text: 'greet' });
    run(0.1);
    expect(guide.current?.id).toBe('greet');
  });

  it('says a thing once and never again', () => {
    guide.say('greet', { text: 'greet' });
    run(GUIDE.messageSeconds + GUIDE.quietAfterSeconds + 1);
    guide.say('greet', { text: 'greet' });
    run(1);
    expect(guide.current).toBeNull();
  });

  it('stays silent while the player is breathing', () => {
    guide.setBreathing(true);
    guide.say('greet', { text: 'greet' });
    run(3);
    expect(guide.current).toBeNull();
    // And says it the moment the breath is over, not instead of it.
    guide.setBreathing(false);
    run(0.1);
    expect(guide.current?.id).toBe('greet');
  });

  it('leaves a gap before speaking again', () => {
    guide.say('one', { text: 'greet' });
    guide.say('two', { text: 'greet' });
    run(GUIDE.messageSeconds + 0.1);
    // The first is done and the second is waiting, but she does not run them
    // together.
    expect(guide.current).toBeNull();
    run(GUIDE.quietAfterSeconds);
    expect(guide.current?.id).toBe('two');
  });

  it('goes away on its own, unless it is a teaching', () => {
    guide.say('passing', { text: 'greet' });
    run(GUIDE.messageSeconds + 0.1);
    expect(guide.current).toBeNull();

    guide.say('teaching', { text: 'greet' }, { holds: true });
    run(GUIDE.quietAfterSeconds + GUIDE.messageSeconds * 3);
    expect(guide.current?.id).toBe('teaching');
    // It waits for the player, and the player can always close it.
    guide.dismiss();
    expect(guide.current).toBeNull();
  });

  it('offers the way on only to somebody who has been lost a long time', () => {
    run(GUIDE.lostSeconds - 5, true);
    expect(guide.current).toBeNull();
    run(10, true);
    expect(guide.current?.id).toBe('lost');
  });

  it('does not offer the way on to somebody who is standing still', () => {
    run(GUIDE.lostSeconds + 20, false);
    expect(guide.current).toBeNull();
  });

  it('starts counting again whenever the player gets somewhere', () => {
    run(GUIDE.lostSeconds - 5, true);
    guide.progressed();
    run(GUIDE.lostSeconds - 5, true);
    expect(guide.current).toBeNull();
  });

  it('tells the world when she has started speaking', () => {
    const heard: string[] = [];
    bus.on('guideSpoke', ({ id }) => heard.push(id));
    guide.say('greet', { text: 'greet' });
    run(0.1);
    expect(heard).toEqual(['greet']);
  });

  it('carries a teaching that may have a film with it', () => {
    guide.say('teaching', { text: 'greet', video: 'teachings/receive.mp4' }, { holds: true });
    run(0.1);
    expect(guide.current?.teaching.video).toBe('teachings/receive.mp4');
    // The words are there whether the film is or not.
    expect(guide.current?.teaching.text).toBe('greet');
  });
});
