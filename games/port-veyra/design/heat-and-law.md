# Port Veyra systems design: Heat & Law Enforcement

**Game:** Port Veyra, a 3D open-world crime sandbox set in a US harbor city (two islands, bridges, an airfield).
**System:** Heat, the chain from a crime, through who saw it, how the police respond, and how the player gets clear.
It touches nearly every other system (driving, weapons, heists, businesses, mansions, day/night), so it is the best
place to prove the design lenses.

Numbers are starting points for tuning. "Now" notes what the current build already does.

---

## 1. Consequence & Memory

A crime does not raise a number by itself. It creates **evidence**, and evidence has an owner, a location and a shelf life.

| Evidence | Created by | Carries | Lasts | How to erase or avoid it |
|---|---|---|---|---|
| **Witness report** | Any pedestrian or driver with line of sight within 30 m (15 m at night, 8 m in rain) | Crime type, your outfit, your vehicle (type + color) | Until the witness reaches a phone (6–12 s) or dies; after reporting, 1 in-game day | Intimidate (aim, don't shoot) to scare them silent; stay out of sight lines; act at night |
| **Camera footage** | Fixed cameras at the bank, casino, police HQ, gas stations, bridge tolls | Same as a witness, but perfect accuracy and it never flees | 2 in-game days, or until the recorder is destroyed | Shoot the camera first (itself a small crime) or disable the recorder inside the building |
| **Physical evidence** | Shell casings, blood, a wrecked car at a scene | Links the scene to the weapon or car used | Until the scene is cleared (~1 in-game hour) | Use melee (no casings), torch the car, leave nothing behind |
| **Description on file** | Any report that reaches dispatch | Outfit tag + vehicle tag | While heat > 0, then it goes "cold" for 1 day | Change clothes (wardrobe), respray the car (Veyra Customs), swap cars at a garage |
| **Reputation** | Pattern of crimes per district | District "attention" level 0–3 | Decays one step per in-game day with no crime there | Commit crimes elsewhere; lie low |

**The key rule:** police only chase *descriptions*. If nobody reported you, a crime creates no heat. If they reported a
red sports car and you are now on foot in a suit, officers must *see* you do something to re-link you.

*Now:* respray clears the description when unseen; interiors and mansion gates break pursuit; gunfire near peds creates heat.

## 2. Layered AI behavior

Every NPC runs the same threat ladder with role-specific responses. Tiers are per individual, not global.

| Tier | Trigger | Civilians | Police |
|---|---|---|---|
| **0 Calm** | Default | Walk routes, idle | Patrol, obey traffic lights |
| **1 Wary** | Weapon drawn nearby, reckless driving, loud noise | Stare, step away, cross the street | Slow down, follow at a distance, run your plate |
| **2 Alarmed** | Assault, carjacking, gunshot within 40 m | Flee, hide, phone it in | Lights on, order you to stop, attempt a boxed-in arrest (non-lethal) |
| **3 Hostile** | Shots at people, officer assaulted, 2+ stars | Panic sprint, cars swerve and speed | Draw weapons, ram, set roadblocks on bridges |
| **4 Overwhelming** | Officer killed, heist alarm, 4+ stars | Streets clear | Helicopter with searchlight, SWAT vans, bridge closures, spike strips |

**De-escalation** is as explicit as escalation:
- Break line of sight → police switch from *pursuit* to *search* (the star icons blink), then search a cone around your last known position.
- Search cone expands with time; if you stay outside it for 20 s (per star), drop one tier.
- Surrendering at tier 2 (stop, hands up, 3 s) → fine and release, no weapons lost. At tier 3+ you get arrested.
- Tier never drops while an officer can see you *and* your description matches.

*Now:* stars → patrols, 2+ stars they shoot, blinking stars while searching, heat decays when unseen.

## 3. Resource friction

**Money**
- *Depletes:* fines when busted (scaled by stars), hospital bills, bribes, respray/repair, bail for seized cars.
- *Replenishes:* jobs, heists, businesses, casino, the art studio.
- *At zero:* nothing is taken from you, but you cannot bribe, pay fines (you do a short "processing" timer instead) or repair. You are
  forced into the risky, cheap options: stealing, riding around damaged. It never locks progress.

**Vehicle condition**
- *Depletes:* crashes, gunfire, spike strips (see §4).
- *Replenishes:* Veyra Customs (paid), swapping to another car (free but a crime if you steal it), mansion garage (your stored cars come out repaired).
- *At zero:* the engine dies and the car smokes. You bail, and the wreck becomes physical evidence tied to its description.

**Heat budget** (the "attention" resource)
- *Depletes:* every reported crime spends from a district's tolerance.
- *Replenishes:* time without crimes in that district; community actions (e.g. taking down bail-bond fugitives lowers attention there by one step).
- *At zero tolerance:* the district is "locked down": extra patrols, businesses there earn 50% less, and raids on your
  properties become possible. It is a pressure to rotate districts, not a wall.

No resource exists only to be refilled: no fuel gauge, no hunger, no weapon degradation.

## 4. Physical consequence

**Vehicles:** four damage states, each visible and each with a mechanical effect.
1. *Scuffed* (100–75%): cosmetic dents; no effect.
2. *Damaged* (75–40%): one headlight out, smoke puffs, top speed −10%, witnesses describe it as "the smashed-up car".
3. *Failing* (40–15%): steering pulls to one side, heavy smoke, top speed −30%, police spot it from farther away.
4. *Dying* (<15%): engine fire; 8 s later it explodes. Tires shot out → sparks on the rim, grip −60%.

**People:** injury is regional, not a single bar.
- *Legs hit* → no sprinting until healed or treated.
- *Arms hit* → wider weapon spread.
- *Heavy damage* → screen desaturates, heartbeat audio, and you leave a blood trail that police can follow.
- Full heal requires the hospital, sleeping, or a drink or first aid kit (partial).

**Environment:** crashes leave skid marks and debris that stay until despawned; bullet holes in glass; knocked-over
street props (bins, hydrants spraying water) that mark where a fight or chase happened.

*Now:* car smoke at low health, wrecks, skid marks, knockdowns, fall damage, bike ejection.

## 5. Systemic interconnection

- **Day/night & weather → witnesses → heat:** night and rain shorten witness range, so crimes at 2 a.m. in a storm
  generate far less evidence. Headlights at night make *your* car more visible to patrols.
- **Heat → businesses & mansions:** a locked-down district lowers business income and can trigger a raid (defend it or lose stock).
  Owning a mansion gives a "safe" gate; using it while seen reveals the address, and the mansion loses its safe status for a day.
- **Heat → heists:** heist finales pick up the *current* district attention. Doing prep missions loudly raises the finale's starting stars.
  Doing them clean gives a quieter finale.
- **Vehicle damage → heat:** a visibly damaged car is easier to describe and spot, so a crash during a getaway raises the chance of being recognized.
- **Police response → traffic:** roadblocks back up AI traffic on bridges, which also slows the police's own reinforcements.

## 6. Player agency within constraints

The same challenge, **"escape 3 stars after the Harbor Savings Job"**, has several valid answers:
1. **Preparation:** the getaway car was stashed and resprayed during prep; swap cars in a garage two blocks away. The police are chasing a car that no longer exists.
2. **Stealth:** cut the camera, rob at night, leave on foot through the park; witnesses never see a vehicle.
3. **Aggression:** block the bridge with a bus, out-drive the pursuit and fight through the roadblock. Faster, but expensive: repairs, fines if caught.
4. **Vertical escape:** a helicopter parked on the mansion pad; police cannot follow into the air, but the police helicopter at tier 4 can.
5. **Social:** hide in the casino (interiors break pursuit), change clothes in the apartment, walk out as a different person.

## 7. Diminishing returns on exploits

| Loop | Curve that keeps it fair |
|---|---|
| Robbing the same store or armored route | Each repeat within 2 in-game days pays 40% less and adds a guard; the third time, police stake it out |
| Respray to wipe heat | Cooldown of 1 in-game hour per shop; the second respray in a row makes the shop call it in |
| Hiding indoors to wipe stars | Works once per interior per day; afterwards police check known hideouts first |
| Casino games | House edge on every game; winning streaks attract security (you get "asked to leave" for the day) |
| Art studio canvases | Each sale floods the market by 20%; recovers 5% per minute (**implemented**) |
| Farming bail-bond fugitives | Bounties shrink as a district's attention drops toward zero; no targets in a clean district |
| Parcel runs | Payout scales with distance, and the same pickup/drop pair repeated pays less |

---

## Summary

Heat in Port Veyra is a memory system, not a meter. Crimes create evidence: witness reports, camera footage, physical traces
and a district's reputation. Each has a lifetime and a way to erase it. Police hunt descriptions rather than
coordinates, and they escalate through five readable tiers that also have clear ways back down. Money, vehicle
condition and each district's tolerance create pressure without chores. Damage to cars and bodies is visible and
changes how you play. Because heat feeds businesses, mansions, heists and traffic, the player learns to plan crimes
around the city: when to act, where to hide, what to change. Repeat-for-profit loops flatten out on a visible curve,
so the fun stays and the exploits don't.

## Core mechanics

- Evidence types (witness, camera, physical, description, reputation) with lifetimes and counterplay
- Police chase descriptions; changing clothes or car breaks the link unless you are seen
- Five-tier threat ladder per NPC, with explicit escalation and de-escalation triggers
- Search cone that grows from your last known position; stars blink while searching
- Night and rain shrink witness range; headlights make you more visible
- District attention (0–3) that lowers business income and enables property raids
- Four vehicle damage states with mechanical effects and descriptive changes
- Regional injuries (legs, arms, heavy) with specific penalties and treatments
- Multiple valid escape strategies: preparation, stealth, aggression, air, disguise
- Diminishing-return curves on every repeatable payout (market saturation, stakeouts, shop cooldowns)

## Edge cases to playtest

1. **The witness who never reports.** A witness flees into an interior or despawns mid-report. Does the report still land?
   It should be lost only if they die or leave the simulation radius *before* reaching a phone. Also test a witness killed by the police.
2. **Disguise while in view.** The player changes clothes in the apartment while an officer is standing at the door. The description must
   stay linked because the officer saw them go in, and the wardrobe should warn the player. Test the same with a respray while a police
   helicopter overhead has line of sight.
3. **Heat outside the game world.** The player flies over open water or into an interior with 4 stars and waits. Search cones must not spawn
   units in the sea or inside interiors, and decay must still work, so the player can never be stuck wanted with no reachable pursuers.
