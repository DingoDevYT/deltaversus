# Pink (Mad Mew Mew) — DATE Minigame — EXACT Port Spec

Source of truth (decompiled GML, Ch.5):
- `gml_Object_obj_date_controller_Create_0.gml`
- `gml_Object_obj_date_controller_Step_0.gml`
- `gml_Object_obj_date_controller_Draw_0.gml`
- `gml_Object_obj_date_controller_Other_10.gml`  (= **event_user0**, the "hit party" handler)
- `gml_Object_obj_date_controller_Other_11.gml`  (= **event_user1**, the "load next question" handler)
- `gml_Object_obj_date_controller_CleanUp_0.gml`
- `gml_Object_obj_date_heart_{Create_0,Step_0,Draw_0}.gml`
- `gml_Object_obj_date_ui_{Create_0,Draw_0,CleanUp_0}.gml`

All `file:line` refs below are into these files. Room coordinates are camera-relative: `camx = camerax()`, `camy = cameray()`, `camwidth ≈ 640`, `camheight ≈ 480`. Battle viewport is 640×480. Colors in this file are mostly `make_color_rgb(r,g,b)` (already RGB) or GML `#RRGGBB` literals (also RGB); the handful of raw ints in `d_line_width_color`/`d_circle_color`/`d_rectangle_color` are decoded below.

The date is driven by `obj_pink_enemy.datecount` (1,2,3,4). **datecount 1 = "Date 1"; datecount 2 = "Date 2"; datecount 3 = possessed final-attack; datecount 4 = confession/finale.** Prior playthrough shortcuts key on `global.flag[1706]` (date1) and `global.flag[1707]` (date2).

---

## 1. MASTER STATE MACHINE — `con` (controller Step_0)

`con` starts 0 (Create:2). Values:

| con | meaning | entered from | Step_0 ref |
|----|---------|--------------|-----------|
| 0 | INTRO — two white half-screens slam together | Create | Step_0:14-79 |
| 1 | DIALOGUE / scripted cutscene beats (per-date) | after intro / after each question | Step_0:81-1137 |
| 2 | QUESTION — choice carousel active, timer draining | from con1 or event_user1 | Step_0:1139-1390 |
| 3 | CORRECT answer resolve (coin, portrait swap, +progress) | con2 | Step_0:1392-1479 |
| 4 | WRONG/TIMEOUT — hurts BOTH heroes+ghost, idiot text | con2 / timeout | Step_0:1480-1601 |
| 5 | WRONG — hurts speaker only (choiceiscorrect==2) | con2 | Step_0:1602-1701 |
| 6 | WRONG — hurts ghost only (choiceiscorrect==3) | con2 | Step_0:1702-1801 |
| 7 | OUTRO — screen splits apart, resolve win/retreat | minigame_won / minigame_con | Step_0:1803-1890 |
| 8 | DATE4 VICTORY sequence (mus_confession climax, wincombat) | date4 q3 | Step_0:1891-1963 |

### con 0 — INTRO slam (Step_0:14-79)
- Two white rectangles rendered to `surface1` (Draw_0:38-45). `surface1_x` starts `camx-320`, `surface2_x` starts `camx+640` (Create:351-352). Each step `surface1_x -= grav; surface2_x += grav; grav -= 1;` where `grav` init `-8` (Create:358) → they accelerate toward center.
- When `surface1_x >= camx`: snap `surface1_x=camx`, `surface2_x=camx+320`, `grav=0`, `con=1`; `scr_shakescreen()`; `snd_play(snd_impact)`; `snd_stop(snd_rumble)`.
- If `datecount>1`: spawn 15 rows of `obj_shinobeetle_smokecloud` dust puffs (`spr_shinobeetle_ow_dustcloud` @ 0.75 scale, and every-other-row `spr_shinobeetle_ow_dustcloud_mew` @0.5 scale, `image_blend = rgb(255,138,144)`) at `camx+320, camy+20+28*i` (Step_0:41-77), then `show_intro_outro_surfaces=false`.
- Intro white surfaces are drawn in Draw_0:1062-1118 while `show_intro_outro_surfaces==true && con==0`: two `d_rectangle` halves at alpha `intro_outro_surfaces_whiteness_alpha` (init 1), with the portrait + first_text drawn white over them.

### con 7 — OUTRO split (Step_0:1803-1890, Draw_0:1120-1124)
- `surface1_x -= grav; surface2_x += grav; grav += 4` (when minigame_con==0) — halves fly apart.
- Draw: `draw_surface_part(surface1, ...)` two halves at `surface1_x`/`surface2_x`.
- When `surface1_x+grav <= camx-320`: `timer++`. At timer 1 if won: pink `explosioncon=1`, `idlesprite=spr_pink_shocked`, reset tensionbar. At timer≥20: if won → pink `phaseturns=0, looping=false`; else → `scr_tensionheal(...)` scaled by `questioncorrectcount` and `datecount--` (retreat/retry). timer≥40 → `instance_destroy()`.

---

## 2. VISUALS — Draw_0 layer order (top of event → bottom = painter's order)

Shake offset used everywhere: `xx = camx (+ obj_shake.shakex*sign)`, `yy = camy (+ shakey*sign)` (Draw_0:29-36).

**Layer 1 — Diamond scrolling background** (Draw_0:47-92)
- `bg_speed += 1` each step, wraps `-640`; `bg_speed_y += 1`, wraps `-480` (scroll).
- Normal: `scr_draw_sprite_tiled_area(spr_diamond_loop, 0, camx+bg_speed, camy+bg_speed_y, ... , 2, 2, c_white, 1)` — `spr_diamond_loop` (3 frames, 40×40) tiled at scale 2×2 over the whole view.
- datecount 3: uses `spr_diamond_loop_inverted` frames 0/1/2 layered by `invertbgalpha`, `diamondbg_alpha`, `diamondbg_red_alpha`. Other dates: `spr_diamond_loop` frame 1 at `diamondbg_alpha`, frame 2 at `diamondbg_red_alpha` (these ramp during correct/wrong flashes).

**Layer 2 — Sky/UI window bg** (Draw_0:94)
- `draw_sprite_ext(spr_datingsim_ui_bg, 0, xx+106, yy+24, 2, 2, 0, c_white, 1)` — `spr_datingsim_ui_bg` (240×140) at scale 2×2 → 480×280 window starting at (106,24).
- datecount 3 adds a wavy distortion strip of `spr_datingsim_ui_bg_inverted_2x` (428×280) sampled per-2px column with `sin((wave_siner+i*8)/30)*3` horizontal wobble, alpha `invertbgalpha` (Draw_0:96-111), plus a 40%-black rect (xx+100,yy+20)-(xx+530,yy+300).

**Layer 3 — Portraits** — see §3 (Draw_0:113-246). Ghost portrait 2 drawn first, then possessed/speaker portrait 1.

**Layer 4 — Dialogue box gradient** (Draw_0:251-262, only when `show_intro_outro_surfaces==false`)
- `dialoguebox_alpha` ramps `+0.2` to 1. A `pr_trianglestrip` quad from `(xx+106, yy+210)`→`(xx+526, yy+273)` colored `dialogueboxcolor`, alpha top `dialoguebox_alpha*0.2`, bottom `dialoguebox_alpha*0.8` (vertical fade). i.e. box top-y = `(yy+300)-90`, bottom-y = `(yy+300)-27`, width 420.

**Layer 5 — Body dialogue text** (Draw_0:264-456) — see §4.

**Layer 6 — UI frame plates & party** (Draw_0:458-583)
- `spr_datingsim_ui_nodiamonds` (6 frames, 320×220) frame 0 @ (xx,yy) 2×2 alpha 1 (base plate).
- frame `__a` (=2 normally, =4 for date3/4) @ (camx,yy) 2×2 alpha `ui_alpha`.
- date3: also `spr_datingsim_ui_nodiamonds_inverted` (4 frames) frames 0 & 2 @ alpha `invertbgalpha`.
- Party trio in the top-left inset, all scale 2×2 alpha `ui_alpha`:
  - `hero_state=="idle"` (Draw_0:474): `spr_ralsei_down`@(xx+40,yy+48), `spr_susied_dark`@(xx+8,yy+46), `spr_krisd_dark`@(xx+26,yy+76).
  - `"fail"` (481-506): 4-frame horizontal jitter, `spr_ralsei_hurt_pink_date`, `spr_susieb_hurt_dateui`, `spr_krisb_hurt_dateui`; reverts to idle at timer 20.
  - `"choose"`/`"success"` (508-532): `spr_ralsei_point_forward`, `spr_susie_point_forward`, `spr_kris_point_forward`(frame 1).
- `spr_datingsim_ui_nodiamonds` frame 1 @ 2×2 alpha 1, then frame `__b` (=3 normally, =5 date3/4) alpha `ui_alpha`.

**Layer 7 — date4 darkness** (Draw_0:585-587): `d_rectangle_color(camx,camy,camx+camwidth,camy+camheight, 0,0,0,0, false)` at `draw_set_alpha(date4darknessalpha)` (date4darknessalpha set 0.2 during date3 final attack).

**Layer 8 — TIMER BAR** (Draw_0:589-595, ONLY datecount 1 & 2):
- `draw_sprite_ext(spr_datingsim_time_bar, 0, camx+186, camy+416, lerp(0,300,datetimeleft/datetimeleftmax), 2, 0, c_white, ui_alpha)`.
- `spr_datingsim_time_bar` is 1×6 px; xscale = `lerp(0,300, ratio)` → bar 0..300px wide, 12px tall, anchored at (186,416). datecount 3/4 draw NO timer bar.

**Layer 9 — LIVES / progress hearts** (Draw_0:597-630):
- Three hearts, `spr_datingsim_ui_heart` (9 frames, 28×28, origin 4,4), scale **1×1**, alpha `ui_alpha`, at `(xx+14 + {0,22,44}, yy+170)`.
- Frame per slot chosen by `questioncount`: frame **0 = filled**, frame **8 = empty**. questioncount 0 → all 8 (empty); q1 → [0,8,8]; q2 → [0,0,8]; q3 → [0,0,0]; q4 → [0,0,0]. So the 3 hearts fill left→right as questions are answered correctly (a 3-question progress meter, NOT decrementing lives). `hearthealth=3`/`heartcount=14` exist in Create but are not decremented to a game-over; a wrong answer only damages the party (see con4/5/6) and the date continues.

**Layer 10 — Choice carousel** (Draw_0:671-1027) — see §5. Only when `con>=2 && con!=7,8 && !show_intro_outro_surfaces && !minigame_won`.

**Layer 11 — date3 difficulty darkener** (Draw_0:1031-1060): full-screen black rect, alpha lerped toward `_targetalpha` keyed to `obj_purplecontrols.difficulty` (0→0, 1→0.4, 2→0.6, 3→0.8, 4→0).

**Layer 12 — Possessed eye-shafts** (Draw_0:1173-1246) — see §3.4.

**Layer 13 — minigame_won white fade** (Draw_0:1126-1171): full-screen white `d_rectangle` at `minigame_won_alpha` (ramps +0.05 to >1.2 then −0.05).

### Palette (Create:290-300, all make_color_rgb = RGB)
```
lightestpurple (215,156,237)   lightpurple (181,139,214)   medpurple (181,105,214)
darkpurple (102,86,177)        darkestpurple (18,19,35)     lightpink (247,91,200)
medpink (230,36,123)           darkpink (200,34,141)        limegreen (181,230,29)
darkgreen (34,177,76)          darkred (136,0,21)
```
Assigned (Create:301-310): `bgrectangle1color=lightpurple`, `bgrectangle2color=medpurple`, `dialogueboxcolor=darkpurple`, `dialogueboxghostcolor=lightpurple`, `choiceselectioncolor=darkestpurple`.
Per step these merge toward pink by `questioncorrectcount/heartcount` (Step_0:7-11): rect1→lightpink, rect2→medpink, box→darkpink — the whole scene reddens/pinkens as you answer correctly.
Raw ints decoded: line/circle color `8388736` = `#800080` = **purple (128,0,128)**; population lines `4235519` = `#40A0BF` → RGB **(191,160,64)** gold; eye-shaft/radar lines `65280` = `#00FF00` **green (0,255,0)**. `#010000` literal ≈ near-black (1,0,0).

---

## 3. PORTRAITS (the part that was most wrong before)

### 3.1 Portrait variables & anchors
Speaker (Pink body) = **`pinkportrait`**; Ghost (Mew Mew ghost) = **`pinkportrait2`**. Both hold a sprite asset id, reassigned per beat.
- `pinkportrait_x` default **210**, `pinkportrait_y` **40** (Create:247-250). `portrait_xscale = 2` (Create:282). Drawn scale is `(portrait_xscale * _scale, 2)`.
- `pinkportrait2_x` **210**, `pinkportrait2_y` **40**, `portrait2_xscale = 2` (Create:251-283). date4 sets `portrait2_xscale=-2` (mirrored), `pinkportrait_x=200`, `pinkportrait2_x=414` (Create:366-368).
- date3: `pinkportrait_x=230` (Create:411). date4 idle also `pinkportrait_x=200`.
- Speaker drawn at `draw_sprite_ext(pinkportrait, pinkindex, xx+pinkportrait_x+portrait_offset_x, yy+pinkportrait_y+portrait_offset_y, portrait_xscale*_scale, 2, 0, c_white, pinkportraitalpha)` (Draw_0:234).
- Ghost drawn at `draw_sprite_ext(pinkportrait2, pinkindex2, xx+pinkportrait2_x+portrait_offset_x, yy+pinkportrait2_y+off_y, portrait2_xscale, 2, 0, c_white, pinkportraitalpha2*0.7)` (Draw_0:180) — ghost is drawn at **0.7× alpha** (translucent).
- `portrait_offset_x = 4` when speaker ∈ {6742,677,5428,2036} (Draw_0:217); ghost `+4` when ghost ∈ {7504,4851,2077} (Draw_0:166); ghost `+25` when 3985; ghost `-20 y` when 5407 (Draw_0:169).
- When ghost is present (`pinkportraitalpha2>0`) the speaker is flipped: `_scale=-1`, `portrait_offset_x += 224` (Draw_0:222-226) so the two face each other.

### 3.2 Tails, blink, sweat, talk animation
- Tail sprite behind speaker: `spr_pinkspeaker_tail` (11f, 112×116) at `(pinkportrait_x, yy+21)` when `pinkportrait ∈ {5218,7353,6552,200}` (Draw_0:231-232). Ghost tail `spr_pinkghost_tail` when `pinkportrait2 ∈ {2485,7274}` (Draw_0:172-178). `tailindex += 1/6` per step.
- Sweat drop: `spr_pinkspeaker_sweatdrop` (3f) over speaker when `sweatcon==1`; `sweatindex` 0→1@t3→2@t6, clears at t80 (Step_0:2127-2159).
- Mouth/talk: while `talktimer<30` and text present, `pinkindex += portrait1_talkspeed` (default **0.16667**, some beats 0.2–0.25); otherwise `pinkindex=0` (Draw_0:113-136). Ghost mirror via `pinkindex2`/`portrait2_talkspeed`.
- Portrait shake (`portraitshakecon`): x nudges +4,−7,+5,−3,+1 over 5 frames then resets to date-specific home (Step_0:1972-2021). Ghost equivalent `portraitshakecon2` (2023-2058).
- Portrait flash overlays: `spr_pinkspeaker_tail`+portrait redrawn at `portraitflash_timer/4` alpha (Draw_0:241-246).

### 3.3 Portrait ID → sprite table (COMPLETE, from sprites.tsv)
| id | sprite | frames | notes / emotion |
|----|--------|--------|-----------------|
| 200 | `spr_pinkspeaker_talk_happy` | 2 | happy/talking (default idle mouth) |
| 677 | `spr_pinkspeaker_nya2` | 2 | happy "nya" (correct-answer pick) |
| 982 | `spr_pinkspeaker_shocked_origin_adjusted` | 1 | shocked (origin set 26,10; later 33,10) |
| 1018 | `spr_pinkspeaker_angryblush` | 2 | angry + blush ("I'M NOT DOING THIS") |
| 1034 | `spr_pinkspeaker_clutch` | 1 | clutching head (date3 start, origin 12,-5) |
| 1086 | `spr_pinkspeaker_date4_questionright` | 2 | date4 correct-answer speaker (animated) |
| 1103 | `spr_possessed_mewmew` | 3 | **POSSESSED FORM** single portrait (date3) |
| 1692 | `spr_pinkghost_date4_3` | 1 | date4 ghost, final happy |
| 2036 | `spr_pinkspeaker_tongue` | 1 | tongue-out (correct pick) |
| 2077 | `spr_pinkghost_nya_2` | 2 | ghost happy (correct pick) |
| 2485 | `spr_pinkghost_blush` | 2 | ghost blush (has ghost tail) |
| 2588 | `spr_pinkspeaker_date4_idle` | 2 | date4 speaker idle (**animated**, `pinkindex+=1/6` Draw_0:228) |
| 2687 | `spr_pinkspeaker_sad_blush` | 2 | sad+blush (flag1706 date1 q1) |
| 3412 | `spr_pinkghost_sad` | 2 | ghost sad (date4 default ghost) |
| 3985 | `spr_pinkghost_yell` | 2 | ghost yelling (145×156, +25 x offset) |
| 4851 | `spr_pinkghost_nya_1` | 2 | ghost happy (correct pick) |
| 5218 | `spr_pinkspeaker_talk` | 2 | neutral talk (**default between questions**) |
| 5407 | `spr_pinkghost_shock_full` | 1 | ghost full-shock (150×130, y−20) |
| 5428 | `spr_pinkspeaker_angry` | 2 | angry |
| 5450 | `spr_nothing` | 1 | invisible (date3 ghost slot = none) |
| 5571 | `spr_pinkspeaker_blinkblush` | 7 | blink+blush (referenced in talk-anim guard) |
| 6060 | `spr_pinkghost_date4_2` | 1 | date4 ghost (angry/hate beat) |
| 6552 | `spr_pinkspeaker_concerned` | ? | concerned (date2 split moment) |
| 6742 | `spr_pinkspeaker_nya` | 2 | happy "nya" (correct pick / "Let's date") |
| 7004 | `spr_pinkspeaker_sad` | 2 | sad |
| 7274 | `spr_pinkghost_concerned` | 2 | **default ghost idle** |
| 7353 | `spr_pinkspeaker_wink` | 2 | wink (date2/3 question speaker) |
| 7435 | `spr_pinkspeaker_happycry` | 2 | happy-crying (date4 finale) |
| 7504 | `spr_pinkghost_angry` | 2 | **default ghost angry** (date2/3 question ghost) |
| 8327 | `spr_pinkspeaker_overjoyed` | 2 | overjoyed ("Now we can BOTH date") |
| 8463 | `spr_pinkghost_date4_1` | 1 | date4 ghost |

Create defaults by date (Create:211-227,360-415):
- date1: `pinkportrait=982` (shocked), `pinkportrait2=7504`.
- date2: `pinkportrait=200`, `pinkportrait2=5428`.
- date3: `pinkportrait=1034` (clutch), `pinkportrait2=5450` (nothing), `pinkportrait_x=230`.
- date4: `pinkportrait=2588`, `pinkportrait2=3412`, `portrait2_xscale=-2`, `pinkportrait_x=200`, `pinkportrait2_x=414`.

### 3.4 POSSESSED MEW MEW overlay (date3, Draw_0:196-211 & 1173-1246)
When `pinkportrait == 1103`, instead of a flat portrait, three stacked 138×119 sprites are drawn at `(xx + pinkportrait_x + 110 + portrait_offset_x, yy + pinkportrait_y + _float_y)`, scale **2×2**, where `_float_y = sin(tailindex)*2` (bobbing):
1. `spr_possessed_mewmew_greyscale_brighter` (3f) — alpha **0.95** (base body).
2. `spr_possessed_mewmew_purple` (3f) — alpha `0.7 + sin(tailindex)*0.3`.
3. `spr_possessed_mewmew_pink` (3f) — alpha `0.7 - sin(tailindex)*0.3` (purple/pink cross-fade pulse).
Animation frame = `tailindex` (shared, +1/6 per step).

Eye-shafts (Draw_0:1173-1246, when `pinkportrait==1103 && draw_box_timer>20`):
- `eyeshaft_alpha` ramps +0.1 (to 1) while playing.
- Ten green (`0,255,0`) `d_line_color` beams radiate from the eyes (`_handx=camx+210, _handy=camy+395`, endpoints listed at Draw_0:1191-1200) — the classic "laser eyes" shafts, `+_float_y` bobbing.
- `spr_possessed_mewmew_eyes2` (3f, 138×200, origin 15,81) drawn over at `eye_shaft_blend` color, alpha `eyeshaft_alpha*0.7 - sin(tailindex)*0.3`.
- `eye_shaft_blend` HSV-cycles: `changecolorcon` picks random hue (`make_color_hsv(irandom(255),250,255)`) and lerps over 3 frames, 6 steps, then resets to white (Draw_0:1211-1245).

---

## 4. BODY DIALOGUE TEXT (Draw_0:264-456)

Font: `scr_84_get_font("mainbig")`. Text types out: `date_text_char_number += 2` per step (Draw_0:139); clamped to string length. `_first_text = string_copy(first_text,1,date_text_char_number)`.

**Standard 2-speaker text** (`multi_color_text_con==0`, Draw_0:274-335):
- Speaker line (`first_text`): drawn `draw_text_ext_transformed` at `_body_x, _body_y=camy+208`, sep 28, width `__w` (320, or 180 when both speakers talk), `portraittextscale=1`. **8-directional black outline** (offsets ±`_w`=2) then fill color `merge_color(c_black,c_gray,0.1)` (near-black); if ghost present (`pinkportraitalpha2!=0`) fill = `rgb(255,138,144)` salmon. `_body_x = camx+120+shaketext_x` left-aligned; but for datecount 1/3 (and date2 pre-split) `_body_x=camx+320`, center-aligned.
- Ghost line (`second_text`): right-aligned at `_ghost_x=xx+510, _ghost_y=yy+208`, same outline, fill `rgb(199,185,215)` lavender (Draw_0:320-334).

**Multi-color shimmer text** (`multi_color_text_con==1`, Draw_0:337-455): per-character alternating colors `_colorpurple=rgb(255,138,144)` / `_colorpink=rgb(199,185,215)`; date3 merges them by `sin(tailindex)` and adds per-char shake `±1`. Used for "means both!?" (date2), and date3 `clutching_head_string`/`goawaystring`. Line-break handling at ltr 24 (date3con0) / ltr 12 (date3con1/2). **Do not transcribe verbatim — paraphrase.** Beat labels given in §6.

`can_skip_timer` increments once text fully shown; when `>10` and `button1_h()||button3_h()`, the beat's `draw_box_timer` jumps to the next threshold (skip).

---

## 5. CHOICE CAROUSEL (con==2, Draw_0:671-1027 draw; Step_0:1139-1390 input)

### 5.1 Input / movement (Step_0:1139-1296)
- `draw_box_selected` = current choice index; `boxcount` choices (4 default date1, else 3; date1 q2 = 6).
- LEFT (`left_h`): `draw_box_con=-1`, `snd_menumove`@0.8, animate `drawn_box_x_offset = lerp(0,-200, t/5)` over 5 frames, then `draw_box_selected++` (wrap). RIGHT: mirror `+1`, `draw_box_selected--`.
- UP (`up_h`): `draw_box_con=2` → `heart.y = lerp(390,319, t/3)` over 3 frames, then `choiceselected = draw_box_selected` (commit).
- `disable_left_right` when `(questioncount==0 && date1)` (press-UP-only tutorial) or `datecount==4` (auto-scroll).
- **date4** special auto-scroll: left disabled, carousel auto-advances every 30 frames (`draw_box_timer>=30`→`draw_box_con=-1`, offset `lerp(0,-200,t/30)`); UP uses `draw_box_con=3`→4/5 multi-step (Step_0:1257-1296).
- Purple arrow markers `spr_pink_purple_arrow` (16×16) spawned every 15 frames during con2 (Draw_0:534-568): an UP arrow at (319,375) angle90 speed1.3, plus LEFT (309,385) & RIGHT (329,385) arrows speed2 (suppressed on the press-UP-only / date4 beats), `image_blend=c_purple`, fading out in Draw_0:17-27.

### 5.2 Choice boxes render (Draw_0:671-1027)
- Boxes laid on a **curved arc** (a semicircle projection): each box's screen-x = `lengthdir_x(_radius=240, angle)+_centeroffset=312` where `angle=lerp(0,180,(boxX+_offscreen_offset(165))/_ogradius(970))`. Center box `_box_x = xx+233+drawn_box_x_offset`, neighbors spaced `_distance_between_boxes=200`. Up to 7 boxes computed (indices selected relative to `draw_box_selected`, Draw_0:746-818).
- Each box: white fill `d_rectangle_color(x0,y0,x1,y0+60, 16777215×4, false)` then inner black `d_rectangle_color(x0-2,y0+2,x1+2,y0+60-2, 0×4, false)` → white-outlined black box, height 60, at `drawn_box_y=_box_y=yy+291`. Alpha = `obj_date_heart.image_alpha`.
- Choice label centered in box: `draw_text_transformed_outline(cx, drawn_box_y[0]+_text_y_offset(28), text, xscale, yscale, darkestpurple)`; per-choice `choicetextxscale/yscale` (typically 3, auto-shrunk to fit via `50/string_width` or `lerp(3,0,width/200)`).
- **Connector graph** (con==2, Draw_0:994-1024): purple (`128,0,128`) lines `d_line_width_color(...,2,...)` link box centers to a horizontal rail at `___y = drawn_box_y[2]+100-6`, with `d_circle_color(...,4,...)` nodes — the "dating-sim web" look.
- The `heart` soul sits at the hub (heart.x=319, heart.y=385) and rises to 319 on UP-select.

### 5.3 Answer resolution (Step_0:1298-1361)
`choiceiscorrect[choiceselected]`:
- **1 → CORRECT**: `con=3`; speaker `pinkportrait=choose(6742,677,2036)`, ghost `pinkportrait2=choose(4851,2077)` (happy faces); `snd_coin`. date4 correct: speaker=1086, ghost=8463.
- **2 → wrong, hurts speaker**: `con=5`; `pinkportrait=choose(6742,677,2036)`; `portraitshakecon=1`; `snd_error`.
- **3 → wrong, hurts ghost**: `con=6`; `pinkportrait2=choose(4851,2077)`; `portraitshakecon2=1`; `snd_error`.
- **0 / else → wrong, hurts BOTH**: `con=4`; `snd_error`.
- **date4 value 4** = a "correct/accept" branch → con=3.

### 5.4 con3 CORRECT resolve (Step_0:1392-1479)
- timer 1: `show_circle1=1` (and `show_circle2=1` if datecount>1); `hero_state="choose"`; move dmgwriter.
- Colors flash toward pink/lime over 8 frames.
- At `timer == 10 + questiondowntime`: swap portraits to idle (`pinkportrait=5218`, `pinkportrait2=7274`), `con=1`, `questioncount++`, `questioncorrectcount++`, `questiondowntime--`, reset `datetimeleft=datetimeleftmax`, `heart.x=319, heart.y=385`, clear text, `event_user(1)` (load next question), `show_circle*=0`.

### 5.5 con4/5/6 WRONG resolve (Step_0:1480-1801)
- Color flash toward `c_orange`/`c_red`, `diamondbg_red_alpha` ramps.
- timer 10: `snd_pink_throw2` + `snd_awkward`; angry portraits (`pinkportrait=5428`, `pinkportrait2=7504`), `portraitshakecon`.
- `idiottext` (the floating "IDIOT!"-type `obj_idiot_text`, ids `idiot1`/`idiot2` from pink enemy) animates from `(camx+320/220/420, camy+160→190)` then flies into the heart `(heart.x+10, heart.y+10)` over frames 10-41 (Draw_0:637-661 positions the `idiot1/idiot2` instances).
- timer 41: `heartstatus[questioncount]` set (1=both, 6=speaker, 7=ghost), `con=1`, portraits back to idle (`5218`/`7274`; date4 restores `saveportrait1/2`), `event_user(0)` → **damage party** (Other_10), `datetimeleft` reset.

### con4 also = TIMEOUT: `datetimeleft<=0 && con==2` → `con=4` (Step_0:2207-2226), `snd_error`.

---

## 6. PORTRAIT-PER-BEAT SEQUENCES (paraphrased beats)

`draw_box_timer` (dbt) drives cutscene beats within con1. Skippable via button hold + can_skip.

### DATE 1 (datecount==1) — Step_0:87-276
Intro q0 (normal, flag1706==0):
| dbt | pinkportrait | emotion | sfx | beat (paraphrase) |
|-----|--------------|---------|-----|-------------------|
| 0-59 | 982 shocked (Create) | fade-in shock | — | portrait & UI fade in |
| 60 | **200** talk_happy + sweat | confused | snd_pink_gasp | "what's going on / school?" |
| 151 | **5428** angry (shake) | angry | snd_pink_throw | "don't go to school anymore" |
| 221 | **7004** sad | hurt | snd_pink_mew | "you wanna walk me home?!" |
| 232 | → con=2 | — | — | first choice (press-UP tutorial, no L/R) |
- flag1706==1 shortcut: dbt60 jumps to 222 with a different one-liner; q1 uses `2687` then `1018` → quick win.
- q1 (flag0): `con=2` immediately, `pinkportrait=200`+sweat, "this body's CUTE" line (Step_0:214-233). Choices No/Yes/Yes (Other_11:27-63), correct = the two "Yes" (index0 "No" wrong→con4), boxcount 3.
- q2: `pinkportrait=7004` sad, "wish you never met me" (Step_0:235-245). Choices Right/Exactly/Of course/**No**/Of course/Exactly, correct = "No" (index3), boxcount 6 (Other_11:65-125).
- q3: `pinkportrait=1018` angryblush "this is OVER" then **win** (`minigame_won`, `explode_after_date`) (Step_0:247-275).
- Nudge lines: if you never press UP at `datetimeleft==100` → `pinkportrait=5428` "press UP!" (Step_0:1363-1376); never L/R at `datetimeleft==90` → 5428 "press RIGHT" (1378-1389).

### DATE 2 (datecount==2) — Step_0:278-562 (long split cutscene)
| dbt | pinkportrait / pinkportrait2 | beat |
|-----|------------------------------|------|
| 101 | 200 | "Let's date, mew!" |
| 171 | 1018 angryblush | "I'M NOT DOING THIS!!" |
| 231 | 6742 nya | "Let's date, mew!!!" |
| 291 | 1018 | "I'M! NOT! DOING! THIS!!!" |
| 321-500 | toggles 1018 ↔ 5218 accelerating | rapid mood flip (portrait_change_timer_max shrinks 15→3) |
| 500 | **6552 concerned + 7274 ghost**, `portraitscon=1` | **THE SPLIT** — ghost separates (ghost-appear anim, both alpha fade in) |
| 530 | 982 shocked + 5407 ghost shock | "H-Hey, we split!!" (both speak) |
| 610 | 8327 overjoyed + 7274 | "Now we can BOTH date!" |
| 670 | 6742 nya | "say something nice to us?" |
| 730 | 7504 ghost angry | "NO, say something NASTY!!" |
| 821 | 200 + 7274, multi_color | "a choice that means both!?" |
| 911 | event_user(1); con=2 | first real question |
- `portraitscon=1` ghost-appear (Step_0:2060-2124): `snd_ghostappear`×3, `pinkportrait_x` lerps 210→100, `pinkportrait2_x` 210→300, portrait visibility alternates each frame (flicker), over 31 frames.
- Questions: pool of 11 (Other_11:128-633, `_questioncount` 0-10), each: speaker `7353` wink + ghost `7504` angry, 3 choices where **iscorrect 1 = good** / **3 = hurts speaker** / **2 = hurts ghost**. 3 questions → `questioncount==3` → win. `is_console` swaps border to `border_dw_pink_alt`.

### DATE 3 (datecount==3) — Step_0:564-748 (possession → final attack)
| dbt | portrait | beat |
|-----|----------|------|
| 0-11 | 1034 clutch (Create), alpha fade | inverted-diamond bg ramps (`invertbgalpha`) |
| 12 | date3con=1, multi_color | "I... hate... dating... mew..." (clutching head) |
| 102 | date3con=2 | "I... love... dating... mew" |
| 222 | afterimage + white explosion | `snd_explosion`, screen-shake afterimages, heartbeat sfx off |
| 342 | **1103 POSSESSED** + 5450 (none) | ghost-appear, "GO... AWAY...!"; `snd_pink_stretch_2_troubled` loop; `pinkportrait_x=100`; eye-shafts begin |
| 340+ | — | **FINAL ATTACK**: spawn `obj_heart` (spr_purpleheart), `obj_dbulletcontroller type 210` dmg×5, `date4darknessalpha=0.2` |
- Survival driven by `obj_purplecontrols.difficulty` (0-4, darkener layer). When it reaches **4** and not won → success (`date3endingcon=1`): fadeout white, destroy heart/purplecontrols/date_heart, `snd_boost`, `explode_after_date`, swap music to `snd_pink_stretch_2_fixed`, pink `idlesprite=spr_pink_very_hurt`, `minigame_won` (Step_0:699-748).
- No timer bar, no timer drain (Step_0:2163 excludes datecount 3/4).

### DATE 4 (datecount==4) — Step_0:750-1136 (confession finale)
Speaker `2588` date4_idle (animated) LEFT, ghost `3412` sad RIGHT (mirrored `xscale=-2`). Music: `mus_confession` (started at portraitscon timer22, Step_0:2110-2116).
- q0 beats (dbt 43/133/223/313, ghost `3412` speaking, `portraitshakecon2`): admit heart was beating / only because they flirted with you. dbt403 → question. Choices "I liked it/I loved it/I got scared" → iscorrect **4/4/1** (Other_11:635-659).
- q1 (ghost 3412, scared / losing myself): choices "Anyone else's/Mine/Jealous too" → **1/4/4**.
- q2 (ghost `6060` date4_2 then `3412`/`8463`, "wanted you to be ME / I HATE me / puppeting hurts you"): choices "Love us both/Ignore your needs/Destroy them" → **1/4/4**.
- q3: speaker `7435` happycry "want to be with you too, mew!", ghost `1692` date4_3, "let's never be apart" → `con=8` **VICTORY** (Step_0:1058-1126).
- date4 correct pick → speaker `1086`, ghost `8463` (Step_0:1313-1318).
- con8 (Step_0:1891-1963): `snd_cymbal_reverse`, portraits lerp together, white fadeout, five decaying `snd_boost` at frames 132/144/156/168/180, at timer 211 `scr_wincombat()` + destroy.

---

## 7. obj_date_heart (soul)

- Create (heart Create_0): `timer=0, con=0, image_speed=0, image_alpha=0`. Default sprite = **`spr_purpleheart`** (objects.tsv). Spawned by controller at `(heart_x=319, heart_y=385)` — date3 spawns 1px higher (Create:330-334). `heart.depth = depth-300`.
- Step (heart Step_0): **`exit;`** — no self-logic. All movement is driven by the controller (`heart.x`, `heart.y` set directly; rises to 319 on UP-select, snaps back to 319/385 after each question). `image_alpha += 0.1` per step during con1 fade-in (Step_0:148-149, 280-281, 566-567, 752-753).
- Draw (heart Draw_0): `draw_sprite_ext(sprite_index, image_index, (x-10)+_x, (y-10)+_y, image_xscale, image_yscale, 0, c_white, image_alpha)`. date3 offset `_x=2, _y=-23`. **Hidden** while `obj_purplecontrols.life_time>0` (the bullet-hell soul takes over).

---

## 8. obj_date_ui (SUND / REEL / POPULATION / CRIME + DOKI bar)

This is the secondary HUD panel (right side "dating sim TV" gauges) plus the DOKI meter. Create (ui Create_0): `dokimax=30` (or from pink), `healthbar_surf=surface_create(96,250)`, population line arrays seeded, etc.

Draw (ui Draw_0), only while `i_ex(obj_pink_enemy)`:
- Slide-in: con1 lerps `xx` 300→0 over 30f, →con2; con3 slides back out.
- **SUND** (sun gauge): text "SUND" + `spr_date_sun` (24×24, origin 12,12) at `(_x+480,_y+240)`, `weatherangle = sin(t*0.02)*100` swinging.
- **REEL IT IN!**: text at `(_x+493,_y+20)`; box `d_rectangle(_x+468,_y+40,_x+512,_y+50)`; `spr_date_reel` (142×30) drawn as a part with width `reelsize=65+sin(t*0.1)*40` at scale (0.4,0.36) — an oscillating reel bar.
- **POPULATION**: text + box `(_x+450,_y+80)-(+484,+114)`; 5 scrolling gold lines `4235519`=(191,160,64) (a moving population graph), reseeded as they scroll off left.
- **CRIME**: text + box `(_x+480,_y+270)-(+520,+310)`; `spr_date_population` (2f, 24×24) pulsing scale `1.8+sin*0.1`.
- **Radar**: `d_circle(_x+600,_y+280,16)` + sweeping green line `65280`=(0,255,0) at `radarangle+=6`; `spr_radar_dog` (18×18) blips at random angles fading out; afterimage line trails.
- **DOKI bar** (the real meter, right edge): label "DOKI" + `doki/dokimax` at (608,30/47). Rendered to `healthbar_surf`: `spr_dokibar` frame 1 base, medpink `(230,36,123)` fill rect from bottom up by `doki/dokimax`, white flash on gain (`flashsiner`), full-bar shimmer at max, `spr_tensionmarker` (19×2) at fill top, `spr_dokibar` frame 0 overlay, `spr_tensionbar_cutout` subtracted (`bm_subtract`). Blitted at `(x+125, y-68)`. `spr_pink_electricity` (5f, 60×60) arcs when `electricity_con==1` (+`snd_electroshock_loop`).
- CleanUp: `surface_free(healthbar_surf)`.

---

## 9. TIMING / COUNTERS (exact)

- `datetimeleft = datetimeleftmax = 240` per question (Create:206-207); drains **−1/step** only during `con==2 && draw_box_con==0 && datecount∈{1,2}` (Step_0:2161-2171). Reaching 0 → con4 timeout.
- `questiondowntime`: **20** (date1) / **10** (date>1) (Create:6-9); −1 each answered question; adds to the con3/4 resolve delay (`timer == 10+questiondowntime`).
- Text type speed: `date_text_char_number += 2`/step (Draw_0:139-140).
- Talk mouth: `pinkindex += portrait1_talkspeed` while `talktimer<30`; default talkspeed **0.16667**, beats use 0.2/0.25 (fast).
- `tailindex += 1/6`/step (idle bob, tail frame, possessed pulse).
- Choice slide: 5 frames (200px) normal; date4 = 30 frames. UP heart-rise: 3 frames (390→319).
- Sweat: frames 3/6 advance, clears at 80. Portrait shake: 5-frame nudge pattern. Ghost-appear: 31 frames.
- Arrow spawn cadence: every 15 frames (`arrow_siner%15==0`).
- Color-merge toward pink: continuous by `questioncorrectcount/heartcount` (heartcount=14).
- `image_speed=0` on heart (manual frames). Portrait sprites are stepped manually via `pinkindex`/`tailindex`.

---

## 10. ASSET LIST

### Sprites — Portraits (see §3.3 for id map)
Speaker: `spr_pinkspeaker_talk`(2), `_talk_happy`(2), `_angry`(2), `_angryblush`(2), `_sad`(2), `_sad_blush`(2), `_shocked_origin_adjusted`(1, origin 26/33,10), `_clutch`(1), `_concerned`, `_nya`(2), `_nya2`(2), `_tongue`(1), `_wink`(2), `_overjoyed`(2), `_happycry`(2), `_blinkblush`(7), `_date4_idle`(2, animated), `_date4_questionright`(2), `_tail`(11), `_sweatdrop`(3).
Ghost: `spr_pinkghost_concerned`(2), `_angry`(2), `_sad`(2), `_yell`(2, 145×156), `_blush`(2), `_shock_full`(1, 150×130), `_nya_1`(2), `_nya_2`(2), `_date4_1`(1), `_date4_2`(1), `_date4_3`(1, origin −4,0), `_tail`(11). Plus `spr_nothing` (empty ghost slot).
Possessed: `spr_possessed_mewmew`(3, 138×119), `_purple`(3), `_pink`(3), `_greyscale_brighter`(3), `_eyes2`(3, 138×200 origin 15,81).

### Sprites — Backgrounds / UI
`spr_datingsim_ui_bg`(1, 240×140), `spr_datingsim_ui_bg_inverted_2x`(1, 428×280), `spr_datingsim_ui_nodiamonds`(6, 320×220), `spr_datingsim_ui_nodiamonds_inverted`(4), `spr_datingsim_ui_heart`(9, 28×28 origin 4,4; frame0=full,8=empty), `spr_datingsim_time_bar`(1, 1×6), `spr_diamond_loop`(3, 40×40), `spr_diamond_loop_inverted`(3), `spr_date_sun`(1, 24×24), `spr_date_reel`(1, 142×30), `spr_date_population`(2, 24×24), `spr_radar_dog`(1, 18×18), `spr_dokibar`(2, 25×196), `spr_dokibar_blush` (obj_date_ui sprite), `spr_tensionmarker`(1, 19×2), `spr_tensionbar_cutout`, `spr_pink_electricity`(5, 60×60), `spr_pink_purple_arrow`(1, 16×16 origin 9,8), `spr_purpleheart` (soul).
Party inset: `spr_ralsei_down`, `spr_susied_dark`, `spr_krisd_dark`, `spr_ralsei_hurt_pink_date`, `spr_susieb_hurt_dateui`, `spr_krisb_hurt_dateui`, `spr_ralsei_point_forward`, `spr_susie_point_forward`, `spr_kris_point_forward`.
Intro dust: `spr_shinobeetle_ow_dustcloud`, `spr_shinobeetle_ow_dustcloud_mew`.
Pink body idle (outro): `spr_pink_shocked`, `spr_pink_very_hurt`.

### Sounds
`snd_rumble` (loop, intro), `snd_impact` (slam), `snd_pink_gasp`, `snd_pink_throw`, `snd_pink_throw2`, `snd_pink_mew`, `snd_pink_trip`, `snd_pink_stretch_2_fixed`, `snd_pink_stretch_2_troubled`, `snd_menumove`, `snd_coin` (correct), `snd_error` (wrong/timeout), `snd_awkward` (wrong), `snd_boost` (win), `snd_ghostappear` (split), `snd_explosion` (date3), `snd_cymbal_reverse` (date4 win), `snd_hurt1` (party hit, Other_10), `snd_electroshock_loop` (doki electricity), `snd_mercyadd`. Delayed one-shots by id: 71 (`snd_play_delayed(71,...)`, a "mew" blip) and 722 (throw layer). Music: `global.batmusic[0/1]` faded per date; `mus_confession.ogg` for date4.

---

## 11. PORTING NOTES / GOTCHAS
- Ghost portrait is **always 0.7× alpha** (translucent) — the prior port likely drew it opaque.
- Speaker/ghost **face each other**: when the ghost is present the speaker flips (`xscale = -2`) and shifts `+224px`. date4 additionally sets ghost `xscale=-2` from the start.
- The three date-modes look very different: date1 = single body, date2 = body **splits into body+ghost** at dbt500, date3 = single **possessed** three-layer glow + eye-lasers, date4 = body(left)+ghost(right) mirrored confession.
- Choice boxes sit on a **semicircle arc** (lengthdir projection, radius 240, center-offset 312), NOT a flat row — text x-scale shrinks near the arc edges.
- Timer bar & timer-drain exist ONLY for date1/date2. date3 is a bullet-hell survival keyed to `obj_purplecontrols.difficulty`; date4 is fully scripted.
- Hearts at (xx+14+{0,22,44}, yy+170) are a **3-question progress meter** (fill 0→3), not decrementing lives.
- Background reddens continuously via `merge_color(..., pink, questioncorrectcount/14)`.
