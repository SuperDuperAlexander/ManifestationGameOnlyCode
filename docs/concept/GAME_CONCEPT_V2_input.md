> **Status: brainstorm input only. Not binding.**
> Alexander wrote this with another AI on 2026-10-11 as raw input.
> The binding design is `docs/GAME_DESIGN.md`. It narrows this concept to one theme: **Anger**.
> Ideas from here (package, Fear, Attachment, Exchange House, reflection questions) may come back in later chapters.

# GAME CONCEPT V2

- Owner: Alexander.
- Date: 2026-10-11.
- Status: Binding game-design source for the complete restart.
- Platform and visual basis: Babylon.js.
- Next step: Eight concept-art boards.
- Later step: `IMPLEMENTATION_MASTER_SPEC_V2.md`.

## 1. Purpose and authority

- This file defines the story, world, core play, and visual intent of V2 [Version 2].
- Design agents must use this file as the concept source of truth.
- Coding agents must preserve these rules when they later build the game.
- The current brief and the full chat `Spielkonzept besprechen` form the source.
- The chat reference is `6abd3d94-e6b0-83ed-8a80-f23a16b2ca0e`.
- This file replaces neither a code review nor a later technical plan.
- It does not fix code structure, asset formats, engine settings, or performance budgets.
- It does not claim that the old code or its speed has been checked.
- The old visual reference is `D:\MyDrive\ALEXANDER\PROJEKTE\ManifestationGameOnlyCode`.
- A new design choice must fit this concept.
- If a later choice conflicts with this file, mark the conflict for Alexander.

## 2. Vision and guiding rules

- The player explores a small town and an inner world.
- Each world reflects changes in the other world.
- The first task seems simple: deliver a package.
- The real journey explores fear, wanting more, giving, receiving, and letting go.
- Show these ideas through play and visible changes.
- Use short text where it helps the player see a choice.
- Do not use long lessons in place of play.
- Keep a calm sense of wonder.
- Let the player explore at their own pace.
- Joy and pleasure are welcome parts of life.
- Fear has a context.
- Giving and receiving belong in the same flow.
- Transformation means a change in how the player relates to the world.
- Transformation must build balance between different parts.
- It must not remove darkness, difference, or all tension.
- Do not promise money, wealth, healing, or a correct personal belief.

## 3. Core loop

- Outer event → inner reaction / Trait → Thought Wave / world effect → Look Within → inner form → outer action → transformation → visible change in both worlds.
- A Trait is an active inner state in the game.
- It is not a fixed label for the real player.
- An outer event starts a reaction such as Fear or Attachment.
- Attachment means the pull to keep getting more.
- A Thought Wave gives that reaction a visible form.
- The reaction changes movement or how the world feels.
- The player uses Look Within to explore the source of the reaction.
- The inner world shows a form linked to the event.
- The player returns outside and takes a real action.
- The player returns inside and meets the inner form again.
- The Trait then changes through that full experience.
- The tree, roots, water, and outer scene show the change.
- Inner insight alone must not complete either main event.
- Passing one wave must not remove its whole Trait.

## 4. Outer World: the compact town

- Keep the playable town small.
- Make each route easy to read.
- Make the town feel larger through views, depth, turns, and distant forms.
- Do not add long empty walks to create size.
- Use the Central Tree as the main visual guide.

```text
                    EXCHANGE HOUSE
                          |
     DARK DISTRICT -- CENTRAL SQUARE -- JOY MARKET
                          |
                       CITY GATE
                          |
                       START AREA
```

- This map fixes the main links.
- It does not fix exact distances or compass directions.

### Start Area

- Start outside the town in quiet nature.
- Show the town ahead.
- Use soft light and few distractions.
- Give the player the Finance Package here.
- Teach movement, camera use, and simple interaction through small actions.
- Introduce a quiet breath or pause for awareness.
- Awareness means taking time to notice what happens.
- Introduce Look Within early.
- A breath must not act as an instant cure for a Trait.

### City Gate

- Use the gate as the shift from nature to town life.
- Open a view toward the Central Square.
- Show enough paths to invite choice.
- Avoid a long task speech at the gate.

### Central Square

- Place the Central Tree here.
- Link the square to the gate and all three main town areas.
- Mix all three groups of people here.
- Let the player return here to see changes in the tree.

### Joy Market

- Use warm colors, food, music, gifts, and lively people.
- Make the first visit feel welcome.
- Keep room for quiet people and darker clothes in the crowd.
- Place the Attachment event and the service task here.

### Dark District

- Use narrow paths, shade, soft dark colors, and fewer people.
- Make the area quiet and more enclosed.
- Keep it part of normal town life.
- Place the Fear event here.
- Keep people from all three visual groups here.

### Exchange House

- Make the house easy to find from the square.
- Keep its route open from the first town visit.
- Let the player try to deliver the package at once.
- Block early delivery through the attached chain.
- Do not block access with a locked door or an unseen task wall.

## 5. Central Tree, roots, and Source Water

- The Central Tree is the visual and play heart of both worlds.
- Its outer form stands in the square.
- Its inner form is much larger.
- Give both forms clear shared shapes so the player knows they are linked.
- Show large roots in the inner world.
- Place Source Water beneath and around the roots.
- Source means the origin of the flow shown in this game.
- Treat the Source as a story symbol.
- Do not state that it proves a real spiritual law.
- The design link is: information → inner structure → outer form.
- Show inner states through the roots and branches.
- Fear can make one part dry, closed, or darker.
- Attachment can make another part grow too much and crowd the flow.
- Both states can appear at the same time.
- A change in one Trait must not erase the other Trait.
- After transformation, water flows more freely through the linked roots.
- The outer tree shows a matching change in shape, growth, or light.
- Keep these changes clear but gentle.
- The final tree is more balanced and alive.
- It must not become a perfect golden prize.

## 6. Finance Package and first delivery attempt

- The package links the story to money and abundance.
- Abundance means having enough and being open to receive.
- A visible chain links the package to the player.
- The chain shows holding on.
- The first task text is exactly: “Deliver the package.”
- Keep the package and chain clear at the small player scale.
- Do not define a full economy or money score here.
- On the first delivery attempt, the chain stays attached.
- A short chain sound can make the failed handover clear.
- The Exchange Guide says: “You are still holding it.”
- This failure invites the player to look inside.
- It must not shame the player or remove progress.
- Completing Fear or Attachment alone must not release the package.
- The final reflection and letting-go choice remain separate parts of the story.

## 7. Look Within and inner travel

- Keep the exact action name: “Look Within”.
- Make it available early in the Start Area.
- After that introduction, let the player use it throughout the journey.
- Treat it as a passage to a real space.
- Do not replace the inner world with a menu or a list of Traits.
- Let the player move through the inner world.
- Allow walking or flight to support its height and depth.
- Keep the return to the outer world clear.
- Let the player continue the outer event after the return.
- Do not use world changes to lose the player's place in the story.
- Exact controls and travel details belong in the later master spec.

## 8. Inner World layout and reveal rules

```text
                      PACKAGE ZONE
                           |
       FEAR ZONE -- INNER TREE / ROOTS -- ATTACHMENT ZONE
                           |
                     SOURCE WATER
                           |
                        ENTRANCE
```

- This map shows links between areas.
- It does not fix height, route length, or exact geometry.
- Use more height and depth than in the town.
- Use roots, water, rocks, floating paths, mist, and distant forms.
- Geometry means the shapes that form the world.
- Keep paths and points of interest easy to see.
- Use the Entrance as the first point of arrival.
- Use the Inner Tree, roots, and Source as the shared center.
- Link the Package Zone to the package experience.
- Reveal the Fear Zone only after the outer Fear event.
- Reveal the Attachment Zone only after the outer Attachment event.
- Before an event, hide its linked area or leave it without its event form.
- Do not show the Fear Child or Beetle as facts before their events occur.
- A first visit may show the Entrance, tree, Source, and package link.
- The world must reflect what the player has experienced so far.
- Keep both event paths valid without forcing which one comes first.
- The final package reflection follows both event transformations.

## 9. Open reflection and saved answers

- Ask open questions in the Package Zone.
- Use the player's own words as a mirror.
- Example question: “What does money mean to you?”
- Example question: “When you think about having more money, what do you feel?”
- Example question: “Do you truly want to receive it?”
- Example question: “What are you holding on to?”
- Save the answers for later reflection.
- Preserve the meaning and wording of the original answer.
- Identify an old answer as something written earlier.
- Do not present an old answer as the player's current belief.
- Do not score free text as right or wrong.
- Do not use free text to choose a diagnosis.
- Diagnosis means a claim that a person has a health condition.
- Do not show “negative belief detected”.
- Do not label the player as blocked, broken, or morally wrong.
- Do not infer karma or past lives from an answer.
- Do not make progress depend on approved words in an answer.
- Reflection supports the story through recall and new questions.
- The later master spec will define how answers are stored.

## 10. Joy Market: Attachment event

- Begin with real pleasure and welcome.
- Let the player enjoy offers and consume more over time.
- Do not make the first gift or first taste a mistake.
- Reveal the problem when the player tries to leave.
- A pull draws the player back toward the offers.
- Make the pull clear through motion and nearby waves.
- Start the Attachment Trait.
- Its wave text is exactly: “I want more...”
- The issue is the endless need for more.
- The issue is not food, beauty, joy, or the market itself.
- Keep the market warm after transformation.
- Do not remove its color or pleasure as a reward.

## 11. Attachment Beetle

- Reveal the Beetle inside after the market event.
- Make it large enough to act as a clear inner symbol.
- Show it eating, gathering, and taking in more.
- Show that more intake does not bring rest.
- Use soft shapes and a clear shell.
- Make it symbolic and strange, but not disgusting.
- Let “I want more...” waves come from it.
- Do not make it a combat enemy.
- Do not solve Attachment by killing it or taking away all its food.

## 12. Give, Receive, and Service

- Give the market trader a real need.
- The player can carry fallen crates or help repair the stall.
- Make the help a visible action with a clear result.
- Do not reduce this step to giving away one apple.
- Service means helping another person with their need.
- “Lower Position” means being willing to serve and help.
- It does not mean kneeling, self-shame, or making oneself less worthy.
- After the help, the trader offers a gift.
- Let the player learn to accept the gift with care.
- Giving alone must not complete this path.
- Receiving is also part of the change.
- Show the link: Give ↔ Receive.
- Later, show the trader helping someone else.
- This ripple means one helpful action leads to another helpful action.
- Do not turn service into a guaranteed trade for wealth.

### Return to the Beetle

- Require the outer help and receiving experience before the full inner change.
- Let the player meet the Beetle again.
- It still reaches for more at first.
- Offer a small light particle as a calm receiving moment.
- Let the player receive and wait.
- Let an “I want more...” wave pass without pushing it away.
- The Beetle becomes calm.
- Its shell can open and show wings.
- Keep it linked to its earlier form.
- Change Attachment into Contentment.
- Contentment means feeling that there is enough in this moment.
- Stop the Attachment-specific waves after this change.
- Restore flow in the linked roots.
- Show a matching change in the outer tree.

## 13. Dark District: Fear event

- Use a situation that the player can first see only in part.
- A small dog or another animal can draw the player closer.
- Keep the exact animal as a later art and story choice.
- One or more people in dark clothes come near.
- The player feels pushed, crowded, or driven back.
- Start the Fear Trait.
- Its wave text is exactly: “I'm afraid...”
- Use Push / Repulsion as a felt force during this event.
- Repulsion means a force that moves the player away.
- Later approaches can bring back that force.
- Shade, sound, mist, and light can make the scene feel more threatening.
- Show this as the player's changed perception.
- Perception means how the player sees and feels a scene.
- Do not change every dark person into an attacker.
- Do not claim that dark clothes cause bad acts.
- Make room for a fuller view of the same situation later.

## 14. Fear Child and the outer step

- Reveal the Fear Zone after the Fear event.
- Place a crying child in a curled-up pose there.
- The child is an inner form of Fear.
- “I'm afraid...” waves lead toward the child.
- Let the player notice the child and gain a clue or memory.
- The inner meeting alone must not remove Fear.
- The player must return to the outer situation.
- Make the careful approach part of play.
- Fear pushes back as the player comes closer.
- Let the player learn more through contact and a visible scene.
- The other person may also have fear.
- The other person may have tried to protect someone or something.
- The later story choice must make this added context clear.
- The key insight is: “I saw only part of the situation.”
- Do not tell the player that all fear is false.
- Do not teach that every unsafe situation requires an approach.

### Return to the child

- After the outer step, let the player return to the child.
- The child looks up and sits more upright.
- It can stand and become calm.
- Change Fear into Trust.
- Trust means being open to a fuller view and a new relation.
- It does not mean blind trust in all people.
- Stop the Fear-specific waves after this change.
- Return water and light to the linked root.
- Show a gentle matching change in the outer tree.

## 15. Thought Waves and Push

- Show thoughts as moving forms in the world.
- Use partly clear wind, mist, or water-like bands.
- Place short text within the waves.
- Keep the wave text readable.
- Keep the path visible through and around a wave.
- Waves come and go.
- Use the exact Trait text for each event.
- Let the player push a wave away.
- Call this Push / Suppression where an agent needs the design term.
- Suppression means trying to force a thought away.
- A push gives short relief.
- The pushed wave later returns larger or stronger.
- Repeated pushing increases the felt force.
- A large wave can move the player off the path.
- Keep a clear way to recover.
- Do not create a permanent penalty or an endless trap.
- When the player lets a wave pass, the figure may react briefly.
- That passing wave causes no lasting harm or lost progress.
- Letting one wave pass gives space to continue.
- The full event path still causes the Trait transformation.
- Stop waves tied to a transformed Trait.
- Keep any other active Trait and its waves.
- Exact force, timing, and controls belong in the later master spec.

## 16. People and visual groups

- NPC [Non-Player Character] means a person controlled by the game.
- Use three visual groups: Colorful, Neutral, and Dark.
- Colorful people use lively clothing and expressive colors.
- Neutral people use quiet, everyday clothing and muted colors.
- Dark people use darker clothing and more quiet forms.
- These are visual groups, not moral groups.
- Colorful ≠ Good.
- Neutral ≠ Sad.
- Dark ≠ Evil.
- Mix all three groups in each town area.
- Use more Colorful people at the Joy Market.
- Use more Dark people in the Dark District.
- Use a broad mix in the Central Square.
- Let behavior show a person's role in an event.
- Do not use clothing color as proof of their intent.
- Keep all three groups after the finale.

## 17. Final Finance Reflection

- Begin this phase after Fear becomes Trust and Attachment becomes Contentment.
- Keep the package and chain present at this point.
- Let the player return to the Package Zone.
- Show the saved first answer with the prompt: “At the beginning you wrote...”
- Display the actual saved answer.
- Do not invent an answer for the player.
- Ask: “What does money mean to you now?”
- Ask: “Do you truly want to receive abundance?”
- Ask: “What are you ready to give?”
- Let the player compare the old answer with their present view.
- Do not demand that the new answer differ from the old answer.
- Show this flow through water, light, and clear actions:

```text
Source → Receive → Player → Give / Serve + Act → World → Receive → Source
```

- Keep action and service in the flow.
- Do not show money arriving from the sky as the lesson.
- Use the flow as a game symbol for connection and exchange.
- Do not present it as financial advice or a promise of income.

## 18. Exchange House finale

- Let the player return to the Exchange House after the final reflection.
- Ask exactly: “Are you ready to let it go?”
- Offer exactly two choices: “YES” and “NOT YET”.
- At “NOT YET”, keep the chain and package as they are.
- Apply no penalty, shame, lost progress, or negative world change.
- Let the player continue to explore.
- Let the player return to this choice later.
- At “YES”, release the chain.
- Let the player hand over the package.
- Make the release and handover clear on screen.
- Show a more balanced tree.
- Show better water flow.
- Show a town with more ease and connection.
- Keep color, shade, quiet places, and lively places.
- Do not make the whole world bright or golden.
- Do not remove the Dark group or the Dark District.
- The ending shows a new relation to the world.
- It does not show a world without difference.

## 19. Visual direction for V2

- Use the earlier `ManifestationGameOnlyCode` as the visual basis.
- Keep the small orange player figure as a clear focal point.
- Use a stylized look.
- Stylized means simple forms chosen for their clear visual effect.
- Use soft forms with few small details.
- Use a painterly feel, like broad shapes in a painting.
- Use warm nature colors.
- Keep cool shade and dark areas where they fit the scene.
- Use simple trees, rocks, hills, ground, stalls, and buildings.
- Prefer shapes made in Babylon.js over many large imported models.
- Procedural means shapes made by the game from simple rules.
- Primitives means basic shapes such as boxes, spheres, and cylinders.
- Prefer procedural forms, primitives, and low-cost geometry for most of the world.
- The small player figure may be the only imported 3D [Three-Dimensional] asset.
- Do not require many heavy GLB [Graphics Library Binary] model files.
- Build mood through light, mist, water, color, and a few particles.
- Particles are small moving points or shapes.
- Keep those effects light and easy to read.
- Use distant roofs, hills, mountains, and sky to suggest a larger world.
- Earlier background-layer ideas may guide that sense of depth.
- They do not fix a final rendering method or require another asset set.
- Keep near paths, event objects, and people clear from the player's view.
- Art must support play before it adds detail.
- Keep the browser and mobile intent in mind.
- Leave exact performance targets and engine methods for the later spec.

## 20. Eight planned concept-art boards

- Each board must follow this file.
- Each board must show the player scale where it affects play.
- Label places, states, and key actions in English.
- Mark optional scene choices as optional.
- Keep all boards in the same light Babylon.js style.

| Board | Name | Required visual intent |
| --- | --- | --- |
| 01 | Outer World Map | Show the small town, six main places, route links, tree landmark, and distant depth. Show the open route to the Exchange House. |
| 02 | Inner World Map | Show Entrance, Inner Tree, roots, Source, and three zones. Show which zones appear after outer events. Show height and travel paths. |
| 03 | Central Tree / Source | Show outer and inner forms together. Compare Fear, Attachment, and balance states. Show the linked changes in roots and water. |
| 04 | Start / Package / City Gate | Show quiet nature, the small orange figure, package, chain, first town view, and early Look Within passage. |
| 05 | Joy Market / Attachment / Beetle | Show welcome and pleasure, repeated intake, the pull when leaving, the Beetle, real trader help, gift receipt, and Contentment. |
| 06 | Dark District / Fear / Fear Child | Show the quiet district, partial first view, push, inner child, fuller outer context, and the child's change toward Trust. Mark the dog as an option. |
| 07 | Thought Waves / Push | Show both exact wave texts, wave passage, short push relief, a stronger return, and safe recovery. Keep path and text clear. |
| 08 | Exchange Finale / Give-Receive / Let Go | Show the first failed handover, service and receiving flow, final choice, chain release, and balanced town. Keep dark areas and all visual groups. |

## 21. Scope boundary and handoff

- This document is the concept source of truth for the next steps.
- Create the eight boards next.
- Check each board against the story and design rules here.
- Resolve art choices before writing the final implementation plan.
- Then create `IMPLEMENTATION_MASTER_SPEC_V2.md`.
- That spec must link its sections to this file and the matching boards.
- It may define controls, event rules, code structure, asset handling, and measured performance goals.
- Do not fix those technical details in this concept phase.
- Do not start a heavy asset pipeline from this file.
- Do not add combat, a money economy, new districts, or belief scoring without a new scope choice.

### Required design checks for later work

- The player can reach the Exchange House early.
- The first handover fails through the chain and the exact Guide line.
- Look Within opens a real space early in the game.
- Event forms appear only after the matching outer experience.
- Both main transformations require outer action and an inner return.
- Trader help includes both giving service and accepting a gift.
- Fear gains context without being called false.
- Saved reflection text returns as an earlier answer.
- Free text never causes a diagnosis or a moral score.
- Pushed waves return stronger, but recovery stays possible.
- Unpushed waves cause no lasting penalty.
- Each transformed Trait stops its own waves.
- “NOT YET” keeps progress and allows a later return.
- “YES” releases the chain and allows the handover.
- The ending keeps darkness, difference, and all three visual groups.
- The art keeps simple forms and a clear player scale.
