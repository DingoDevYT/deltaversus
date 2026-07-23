# Spamton NEO — Finale "NEO" Ultimate (TARGET A) + NEO Marionette Body (TARGET B)

Source: DELTARUNE Ch2 GML. All coords GML angle convention (0°=right, CCW, y-DOWN in GM but sprite bob uses `y = ystart - sin(...)*40` so "up" = smaller y). 30 fps. `monsterat` = boss attack stat.

---

## DISPATCH — how rr=9 (NeoFinale) fires

`obj_spamton_neo_enemy` Other_10 (User Event 0, attack picker):
- Scheduled: phase==4, phaseturn==3 → `rr=9; difficulty=0; haveusedfinalattack=1`. Also phaseturn==6 → `rr=9` then loops `phaseturn=3`. (Other_10:112-136)
- **FORCED** (Other_10:139): `if ((monsterhp < monstermaxhp*0.1 && haveusedfinalattack==0) || (mercymod > 90 && haveusedfinalattack==0)) { rr=9; difficulty=0; haveusedfinalattack=1; phaseturn=3; }` — i.e. HP<10% OR mercy>90.
- Turn-setup on rr=9 (Step_0:776): `obj_growtangle.y += 10; maxyscale=1.9; maxxscale=2.5`.
- Fire (Step_0:874): name "NeoFinale"; `dc = obj_sneo_bulletcontroller; dc.type=9; dc.target=3` (=ALL party).
- Pre-attack dialogue balloon (Step_0:279, ballooncon=25): paraphrase = Spamton says he won't/can't force Kris. Sets `finalattackconversationcon=1`.

---

## TARGET A — NEO FINALE

The finale is a giant Spamton head (`obj_sneo_final_forme`) advancing from screen-right while the battle box warps into a green funnel-mouth (`obj_sneo_warped_box`) that inhales the SOUL; dollar-sign bullets (`obj_sneo_dollar`) drift from the left into the giant mouth. If the head reaches the SOUL it swallows it and drains the whole party's HP.

### MANAGER — obj_sneo_bulletcontroller type==9  (Step_0:807-904)
- **init(btimer 0):** `global.turntimer = 1200`; create `obj_finale_growtangle` at growtangle x,y; `special=1`; `obj_sneo_hitdetector.active=false`.
- **btimer==45 (special 1→2):** create `obj_sneo_warped_box` at growtangle x,y; create `obj_sneo_final_forme` at `(camerax()+680, sneo.y)` with `intro=-1, damage=damage, target=3, speed=16.75, direction=180, friction=0.5` (flies in leftward, decelerating). btimer=0.
- **btimer==70 (special 2→3):** `warped_box.state=1` (begin inhale); `final_forme.destroyable=1`; hitbox.destroyable=1; `final_forme.image_index++`.
- **special 3, every 3 frames (btimer>=10):** spawn one `obj_sneo_dollar` from left edge `xx=minx-random(30)-40`, `yy` = growtangle.y ± random(100–200). Cycle of 7 (`sneodollarcount` 0→6→0) with startscale `1,1,1.5,1,1,1.5,2`; each `d.speed=0.1`. btimer resets to 3.

### obj_finale_growtangle (Create/Step/Draw) — the box-wrap "vine grow" FX
- Create: `image_alpha=0.3; maxtimer=15; timeincrease=1; timer=14; growcon=1; image_blend=merge_color(c_green,c_lime,0.5)` (~RGB 64,224,64); sprite=`obj_growtangle.spr_custom_box`; depth = growtangle.depth+1 (growtangle depth -=2).
- Step: growth while `timer < maxtimer*5 (75)` at growcon1. `timeincrease += 0.025`/step (accelerating). `image_xscale = maxxscale*(timer/15)`, same yscale; `image_angle = 180 + 180*(timer/15) + target_angle`; `image_alpha = min(1, 0.5 + (timer/15)*0.5)`. Each step spawns `obj_afterimage` (blended trail, alpha `(1-timer/75)*0.5+0.1`). At timer==15 one crisp white afterimage of the real box. growcon 1→2 at timer>=75. growcon3 counts timer down; at timer<=15 → `global.turntimer=0; instance_destroy()`.
- Draw: `draw_sprite_ext(spr_battlebg_stretch, 1, ...)` + custom box sprite at half-scale (`xscale/(maxxscale/2)`).

### obj_sneo_warped_box (Create/Draw/Step2/Other5/Destroy) — the green funnel-mouth
- Create: reads growtangle bounds → `minx/maxx = gt.x ∓ sprite_width/2`, `miny/maxy = gt.y ∓ sprite_height/2`; `suckx = gt.x+100`; `upper_sucky = gt.y-40`, `lower_sucky = gt.y+40`; `suckpower=0; state=0; inhale=0`. Sets `obj_battlesolid.image_xscale/yscale = 3` (box border thickens). growtangle.image_alpha=0 (hidden, replaced by this draw).
- Draw_0: draws the funnel with `draw_triangle`. Outer fill color `#00C000` (RGB 0,192,0), inner black inset by 4px, at `image_alpha`. Geometry lerps left border `_minx` toward `lerp(maxx,suckx,suckpower)-8` by `inhale`, and top/bottom toward upper/lower_sucky. So as `suckpower`→1 the right side pinches to a point at (suckx, mid) = the mouth; `inhale`→1 collapses the whole box into the funnel.
  - state1: `timer` 60→ counts, `suckpower = scr_ease_in(timer/60, 3)` (ease-in ramp up).
  - state2: release, `snapback=-1`, `timer`→0, `suckpower = scr_ease_in(timer/30, -2)`.
- Step2 (Other/collision-frame): clamps `obj_heart` inside box. When state>0: SOUL pulled right by `+suckpower`/frame; if SOUL reaches `rborder-22` while `turntimer<=30` → snapback launches it left `-20*ease_in(snapback,2)`/frame and spawns `obj_shake` (shakex/y=`ceil(suckpower*4)`). Vertical squeeze toward center scaled by `xoffset*suckpower`.
- Other_5: growtangle.image_alpha=1. Destroy: growtangle.image_alpha=1, keep=1, `obj_battlesolid.scale=2` (restore).

### obj_sneo_final_forme — the GIANT SPAMTON HEAD (Create/Draw/Step/Other15) + mouth_back + hitbox
- Sprite `spr_sneo_final_forme` = **612×590, 8 frames, origin (28,91)**. Drawn at **scale 1** (NOT ×2). `mouthx=90, mouthy=142` (mouth point relative to x,y). `advancespeed=3`. Creates `obj_sneo_final_forme_hitbox` (spr 260×391 o(0,0)) and `back = obj_sneo_final_forme_mouth_back` (dark mouth interior, `spr_sneo_final_forme` frame 7, drawn behind SOUL depth).
- Bullet damage (`element=6`): `floor(monsterat*5/3)`.
- **Draw_0:**
  - Frame 3 drawn as a back/shadow layer at bobbing y `ystart - abs(sin(steptimer+0.15)*40)`, blend=image_blend, alpha 1.
  - Main head: if `image_angle!=0` use `spr_sneo_final_forme_head_rotate_origin` (**612×562, origin (166,222)**, pivots the head) at `x+138+headoffset_x, y+135+headoffset_y`, scale (image_xscale,image_yscale), angle image_angle. Else if state 2-9 (or 11 mid) draw with random-range shake `_shake` (2 in state3, else 1). Else plain at `headoffset`.
  - Hurt flash: if `(destroyable && state0) || (state1 && formtimer<30)` overlay frame at `c_yellow, hurtalpha` (hurtalpha decays 0.1/frame).
  - Intro (`intro!=0`): image_index=4, `introtimer++`, blend fades black→white over ~30, extra frame-2 overlay; ends at introtimer>=68 (intro cutscene ~68 frames).
- **Step_0 state machine (`formtimer++`):**
  - **state0 (advance/inhale):** stepdir=-1. `x += 1.6*stepdir` (+extra 4*stepdir past growtangle.x+140). Bob `y = ystart - sin(steptimer)*40`. Each `steptimer>=pi` → screenshake 2px + `snd_screenshake`. Drives warped_box `suckx=min(gt.x+150, x+106)`, `upper/lower_sucky = y+129 / y+159`. Inhale FX: loops `snd_sneo_overpower` (pitch 0.1→1 over 90f, vol .75); spawns `obj_wreckpausespew`; every 6 frames emits 3 `obj_rouxls_power_up_orb` from mouth (dir 120-240, lifetime 12).
    - If `x < gt.x - sprite_width/2.5` OR `obj_heart.x > x+70` → **state10** (SOUL caught): spawn `obj_sneo_fakeheart` at SOUL, `bulletcontroller.special++`.
    - Else if `formtimer>=320` (SOUL survived ~10.7 s) → **state1**.
  - **state1 (formtimer>=45→2):** dollars fade out; if head past gt.x+70 set warped_box.state=2 (release); image_angle=1; stop overpower sfx; box.stopthesucc=1.
  - **state2 (formtimer>=45→3):** image_index=5; hitbox.destroyable=false; `global.turntimer=360`.
  - **state3 (retreat):** lerps `x → camerax()+439` over 100f; tilts `image_angle → 25` (ease-in) then head-drop `→ -1` with `headoffset (0→-12, 0→2)`. When settled → destroy self, spawn `obj_sneo_lastattack`, `global.turntimer=300`.
  - **state10→11→12 (SWALLOW = the kill):** fakeheart flies into mouth (`fakeheart_speed → 10`), box `inhalespeed += 0.01`. formtimer>45 → state11: head steps forward; every 5f in formtimer 30-65 play `snd_hurt1` (pitch 1.4-2)+1px shake; on first (`dmgcon==0`) set `global.inv=-1` and `with(obj_spamton_neo_enemy) event_user(2)` → **drains whole party** (see damage script). formtimer 50/65 re-grows growtangle box. → state12 → spawns `obj_sneo_lastattack`.
- Other_15 (grazed/hit) & hitbox Step2: hitbox tracks parent x,y; on active hit calls `obj_spamton_neo_enemy event_user(2)`.

### obj_sneo_dollar (Create/Step/Draw/Other15) — the dollar-sign bullets
- Sprite `spr_spamton_dollar` = **24×24, origin (12,12)**, obj_regularbullet child. `element=6; image_alpha=0` (fades in +0.1/frame in Draw); `startscale` set by spawner (1/1.5/2); `destroyable=0; grazepoints=4`.
- Damage: `floor(monsterat*5/3)`.
- Step: drifts toward giant mouth `(final_forme.x+mouthx, y+mouthy)`. If `x < mouth-10` re-aims at mouth with `friction=-0.1` (accelerates into mouth). Scales `startscale→1` as it nears (inverselerp mouth-200→mouth-50). Past `mouth+50` → destroy + `snd_swallow`. `fade==1` → alpha-out then destroy (used when finale ends).

### obj_basicbullet_sneo_finale (parent of final_forme) (Create/Step/Other15)
- Damage `monsterat*5`; `image_angle += 36`/frame (spins); if `destroyable` flash-blend `#00A2E8`↔`c_aqua`. Off-screen (±100) → destroy.

### DAMAGE — scr_damage_sneo_final_attack + Other_12 (the party drain)
- `event_user(2)` = Other_12: loops all 3 party (`ti 0..2`), sets `global.inv=-1`, computes `damage` = fraction of that member's CURRENT hp:
  - hp > 50% max → `floor(hp/5)`
  - hp ≥ 15% max → `floor(hp/10)`
  - hp < 15% max → `floor(hp/20)`
  - then `scr_damage_sneo_final_attack()` per living non-Kris member.
- `scr_damage_sneo_final_attack`: element 6, applies element reduction; **cannot outright kill** (if hp would hit 0 uses doomtype=4, sets hp to `-maxhp/2`, or reduced chip). Spawns `obj_shake`, `obj_dmgwriter`, SOUL `dmgnoise`. Ends `global.inv = invc*40`. Runs gameover check.
- Net: this ultimate is a **guaranteed multi-tick party-wide HP drain** (percent-based, survivable unless already lethal), not a fixed-damage hit.

### TIMING (frames @30fps, turntimer)
```
t0   turntimer=1200; growtangle box begins wrapping; hitdetector off
t45  warped_box + giant head spawn (head flies in from cam+680, spd16.75)
t70  box.state=1 inhale begins; head destroyable
t80+ dollars spawn every 3f from left, drift into mouth
     head advances left ~1.6px/f, bobbing ±40, screenshake each half-cycle
     SOUL sucked toward mouth; graze the dollars/orbs
BRANCH A (SOUL evades to formtimer>=320 ≈ 10.7s): head→state1→2→3, retreats
     to cam+439, turntimer=360→ obj_sneo_lastattack; turntimer=300
BRANCH B (head reaches SOUL / SOUL.x>head+70): state10 swallow → state11
     every 5f (formtimer 30-65) party-drain tick + hurt sfx → state12 →
     obj_sneo_lastattack
```

---

## TARGET B — NEO MARIONETTE BODY (obj_spamton_neo_enemy Create_0 / Draw_0)

Layered puppet: **8 body parts**, each sprite **82×89**, drawn via `draw_monster_body_part_ext` at **scale ×2** (`image_xscale=image_yscale=2`; note: these are native 82×89 art shown at 2×, so a 1:1 port renders each part at 164×178). `image_speed = 1/6` (~5 fps). Placeholder idle/hurt/spared sprite = `spr_sneo_example` (82×89 blank). `custom_draw=1`, `blend = merge(c_white,c_black,0.15)` (~RGB 217,217,217 dim). `facing=1`.

### PART TABLE (partsprite[i]) — REFDATA dims / origin
| i | sprite | frames | W×H | origin (x,y) | role |
|---|--------|--------|-----|--------------|------|
| 0 | spr_sneo_wingl | 1 | 82×89 | 20,40 | left wing (back) |
| 1 | spr_sneo_arml  | 5 | 82×89 | 20,37 | left arm (gun arm; frames = poses) |
| 2 | spr_sneo_legl  | 1 | 82×89 | 23,52 | left leg |
| 3 | spr_sneo_legr  | 1 | 82×89 | 30,51 | right leg |
| 4 | spr_sneo_body  | 1 | 82×89 | 18,40 | torso |
| 5 | spr_sneo_head  | 4 | 82×89 | 30,29 | head (frames: mouth/eye poses) |
| 6 | spr_sneo_armr  | 1 | 82×89 | 35,35 | right arm |
| 7 | spr_sneo_wingr | 1 | 82×89 | 30,30 | right wing (front) |

Alt heads: `spr_sneo_head_sad` (1fr, o30,29), `spr_sneo_head_preview` (6fr, o30,29, "eyes" flash pose), `spr_sneo_head_sad_blue`, `spr_sneo_head_sad_old`(2fr).
Per-part draw offset uses `partxoff[i]=sprite_get_xoffset*2`, `partyoff[i]=yoffset*2`.

**Draw order** = loop `i=0→7`, so paint order (back→front): wingl → arml → legl → legr → body → head → armr → wingr.

### DRAW CALL (Draw_0:1625)
```
draw_monster_body_part_ext(
  partsprite[i], partframe[i],
  x + partx[i]*facing + partxoff[i]*facing + lastxoff + shakevar,
  (y + party[i] + partyoff[i]) - shakevar,
  (2+scalebonus)*facing + expand, 2+scalebonus+expand,   // scale; head adds headsize/headexpand
  partrot[i]*facing, partblend[i], image_alpha)
```
- `scalebonus = headsize` only for head (i==5); `expand = headexpand` (head only).
- Idle sway (partmode 1): `partrot[i] = sin(partsiner[i]/30)*15`; head `partframe` cycles 0-2 (+0.05*f) with slight rot; whole rig has NO global bob in idle (bob is finale-only).
- Hit flash: head `partblend[5]` → cyan `4235519` on hit, eases back to white over ~15f.
- `violentendflash` overlays a white fog copy of every part.

### THE STRINGS (marionette dangle) — Draw_0:20-150
- **18 back strings:** color `make_colour_rgb(0,51,0)` (dark green), `draw_line_width` from `(x+partx_back[ii]+partxoff_back[ii]+sin(partsiner_back/30)*2, y+party_back+partyoff_back)` straight UP to `y=-400`, width 1. `partxoff_back[ii]=xoffset(wingl)*(1.8+ii/9)` fanned; `partsiner_back += 0.5`/frame (gentle sway).
- **6 foreground strings** (parts 0-5): `c_green`, width 2, from part anchor up to -400; orange `c_orange` if `partweakened[i]`; white flash when weakened/violentend.
- **1 body string** (part 4): dark-green line from chest up to -400 (turns `c_green` fading in when `lastwirecon` set at end).
- When mercy>89 hidden vines convert (`obj_sneo_vine_transition`).

### KEY POSE MODES (partmode) relevant to idle/hurt
- `partmode 0`: neutral reset (all rot/x/y lerp→0; head slight tilt; dead→head frame 3).
- `partmode 1`: **default idle** — arms/wings sway sin*15, head frame-cycles.
- `partmode 2 / 40`: shocked/jitter (random rot ±60, x=sin, y=cos wobble, smoke).
- `partmode 3-13`: aiming/BIG SHOT arm poses (arm frame 1/2/3, armaim toward SOUL).
- `partmode 42/43`: death fall (fakegrav, head frame 7, limbs splay, impact shake+`snd_closet_impact`).
- Hurt: `hurttimer2` → `shakevar` jitter on all parts; after hurt, if hp≤10% & sideB → `partmode 99`.

### SFX (finale + body)
`snd_sneo_overpower` (inhale loop, pitch-ramp), `snd_swallow` (dollar/SOUL eaten), `snd_hurt1` (party drain ticks), `snd_screenshake` (head steps), `snd_chargeshot_charge/_fire`, `snd_closet_impact` (death), `snd_carhonk` (funnycheat), `snd_bump`, `snd_weaponpull_fast`.

### ASSETS — import status (manifest.json currently has ONLY `sneohead`)
Need to import (EXPORT PNGs exist at `...DELTARUNE Chapter 2 - EXPORT\sprites\`):
- Body parts (7 missing): `spr_sneo_wingl_0`, `spr_sneo_arml_0..4`, `spr_sneo_legl_0`, `spr_sneo_legr_0`, `spr_sneo_body_0`, `spr_sneo_armr_0`, `spr_sneo_wingr_0` (all 82×89). Head already = `sneohead` (`spr_sneo_head`, 4fr).
- Optional heads: `spr_sneo_head_sad_0`, `spr_sneo_head_preview_0..5`.
- Finale: `spr_sneo_final_forme_0..7` (612×590), `spr_sneo_final_forme_head_rotate_origin_0` (612×562), `spr_spamton_dollar_0` (24×24), `spr_sneo_lastattack_head_0` (135×125 o32,0), `spr_sneo_playback_0..2` (186×40), `spr_battlebg_stretch_0..1` (75×75) + `spr_battlebg_0` (box), `spr_cakesmoke_0` (14×14, smoke).
