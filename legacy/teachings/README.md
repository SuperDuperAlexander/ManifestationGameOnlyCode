# Teaching films

A teaching is text first. A film is added on top of it, never instead of it.

Put a film here and name it in `src/content/strings.en.ts` alongside the
words it goes with, then pass it as `video` when the guide is told to say
that teaching:

```ts
this.guide.say('fogMet', { text: 'fogMet', video: 'teachings/fog.mp4' }, { holds: true });
```

Rules, from `CLAUDE.md`:

- 720p or smaller, under 6 MB, H.264 in MP4 or VP9 in WebM.
- It is fetched when its blockage is reached, never at the start, so it is
  not part of the first download.
- It is served from this game's own files. Nothing is ever streamed from
  anywhere else.
- The words say the same thing the film says. They are not a summary.
