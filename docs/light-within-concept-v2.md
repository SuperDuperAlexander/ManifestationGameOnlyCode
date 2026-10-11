# Light Within: Concept v2

## 1. Core idea

The outer world is the player's own manifested karma. Everything the player meets outside came to teach them something. The player grows by connecting with it, not by rejecting, fighting, or chasing it.

- No companion. No guide. No quest markers.
- The only voices in the game are the player and the player's own disturbances.
- Nothing is destroyed. Nothing disappears. The player's relationship to it changes.

Source teachings (Dr. Rulin Xiu):
- #008 The Power and Science of Becoming One With Yourself: soul, heart, one. Resistance creates blockages. Chasing joy also creates blockages.
- #014 First Seed of Deception: cutting the branch does not remove the tree. The seed stays until it is seen.
- #011/#012 Law of Yin Yang: two opposite elements, inseparable, co-created. Their interaction creates something new.
- E = c·A² (Level 1 of Tao Journey): more people in one field, energy grows by squares.

## 2. The Connection Loop

```
OUTER WORLD → NOTICE → REACTION → GO WITHIN → SOUL → HEART → ONE → RETURN → OUTER WORLD CHANGES
```

1. **Outer world (third person).** The player walks a gray street.
2. **Notice.** Some objects glow in color. Color means "this resonates with me", not good or bad.
3. **Reaction.** Near a disturbance, outer sound fades and the player hears a heartbeat. Two words appear: *Stay outside* / *Go within*.
4. **Stay outside** is allowed. The disturbance returns later in a new form.
5. **Go within.** Hold to breathe in. The camera moves into the figure's chest. Third person becomes first person. No loading screen.
6. **Soul.** The player asks the disturbance: "What did you come to teach me?" It answers with a question.
7. **Heart.** Eyes closed for 10 seconds, sound only. The player taps where they felt it on a body outline.
8. **One.** The inner world shows the player's answer as a place. The player moves toward the hard part (dark canyon, wall), not away. Holding the breath there changes it. It does not vanish.
9. **Return.** Breathe out. Camera pulls back out. The disturbance is still there, but quieter, smaller, less dominant. Color leaks into the area around it.

This keeps the three mechanics: **Receive** (meet it), **Transform** (inside), **Manifest** (the changed outside).

## 3. Seven signature systems

### 3.1 The world is built from your life
At the start, the player taps 3 of ~8 cards: things that pull or bother them in real life (money, phone, a person, recognition, a closed door / fear of failing, crowds, a beautiful house, conflict). Exactly these appear as disturbances on the street.

### 3.2 Unfinished things return in a new form
Each disturbance has a hidden theme found inside (e.g. "freedom"). If the player walks past, it returns later as a different object with the same theme: slot machine → lottery poster → a neighbour's new car. The theme is saved between sessions.

### 3.3 The disturbance speaks only with your words
Short fragments of what the player wrote are stored (on the device only). Later, disturbances whisper those fragments back ("never... enough"). No outside voice exists in the game.

### 3.4 The world copies how you move
A calm value (0 to 1) is measured from input speed and jitter. Nervous input: louder sound, more fog, less color. Calm input: quieter, color leaks in. Simple figures on the street copy the player's pace.

### 3.5 Your real body as controller (later, optional)
- Microphone breath detection, processed on the device.
- Heartbeat via finger on the camera (PPG, photoplethysmography), processed on the device.
- Always optional, always ask first. "Hold to breathe" stays as the default.

### 3.6 Double exposure: find the inner twin (later)
Every outer object has an inverse inside (tower outside, well inside). To connect, the player slides the inner image over the outer silhouette until the shapes fit. Where they fit, both paper styles melt into one image.

### 3.7 Shared field (later)
Integrated seeds of other players appear as small anonymous lights. Two players breathing at the same rhythm make a light grow much stronger (E = c·A²). No names, no chat.

## 4. The AI

- The AI never gives advice, never interprets, never names the player's feeling for them.
- It asks one short question, offers choices, and chooses scene parts.
- It returns data, not images. The game builds the inner world from 30 to 50 ready-made parts (fog, wall, water, light, wind, plants, cracks, shadows, doors, mountains, open space, narrow space, particles).
- Maximum 2 follow-up questions per disturbance.
- Every AI step has a fallback: tap answers mapped to scenes by fixed rules. The game fully works without AI.
- Later: the AI first looks up Dr. Rulin's words (existing Supabase knowledge base) so questions follow her teaching.

## 5. Look

- **Outside:** rough gray cardboard, torn edges, thick black lines like a woodcut. Only disturbances have color.
- **Inside:** fine white paper-cut, like lace. Warm gold light shines through.
- **Progress:** no XP (experience points), no levels as numbers. The world shows progress. Color returns, inner plants grow outside, the two styles slowly merge. In the final level there is no border.
- **Inside on phones:** no walking. The player looks (drag or tilt). What they look at comes slowly closer.

## 6. Final level

The last disturbance is the player's own figure. The player connects with it. The camera stays inside. Inner and outer are one.

## 7. Safety and privacy

- No diagnosis, no healing claims. All content is personal reflection.
- Crisis words in player text → the game pauses and shows a help line screen.
- Player text is not stored on any server. Fragments live only in the browser. One clear line tells the player this.
- AI provider must not store or train on the data.

## 8. Build order

1. **Prototype 01:** one street, onboarding cards, the Connection Loop, systems 3.1, 3.3, 3.4.
2. Test with ~10 users: did it feel good, did you notice something about yourself.
3. Then 3.2, RAG, more regions (becoming one, the seeds, yin and yang, the heart dream).
4. Then 3.5, 3.6, 3.7.
