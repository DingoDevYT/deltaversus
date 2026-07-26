/**
 * _BOSSES_PATCH.js — ready-to-paste BOSSES entries for the 16 contributed rosters.
 *
 * MEASURED AGAINST gen_attacks.js md5 8fe197911743cc86a5076f743c8f1225
 * (974 lines / 48,535 bytes, mtime 2026-07-26 21:58:21). That file was rewritten
 * DURING this analysis — it gained roster-row variant fan-out, parseControllerCell(),
 * applyRosterRow(), unreached-row emission and set -> controllerSet merging — so
 * re-check the md5 before trusting the "needs work" notes below. See _SYNTHESIS.md.
 *
 * Paste BOSSES_PATCH_READY into gen_attacks.js's `const BOSSES = [ … ]`, after the
 * `pink` entry. A hand-written entry WINS over the JSON of the same id
 * (`if (BOSSES.some(b => b.id === j.id)) continue;`), so these are safe to add
 * while scripts/rosters/<id>.json stays in place as the derivation of record.
 *
 * VERIFIED: running gen_attacks.js with these 8 entries spliced in ahead of the
 * roster loader produces output byte-identical to the JSON-driven path for all 8
 * — same entry count, same ids, selectors, choices, controllers, types, inFight
 * verdicts, setup lengths and controllerSets, same boxSetups and turnSetups.
 * They are documentation-with-teeth, not a behaviour change.
 *
 * Every anchor below was verified three ways:
 *   1. it appears VERBATIM in the raw, unstripped source;
 *   2. gen_attacks.js's own extractBoxBlock()/extractTurnBlock() were replayed
 *      against the real file and the slice inspected;
 *   3. the slice is brace- and paren-balanced and contains NO scr_bulletspawner,
 *      NO instance_create(…obj_*bulletcontroller) and NO event_user(N) — the two
 *      traps recorded for the Knight (doubled controllers) and for Jevil/Queen
 *      (re-running the attack CHOOSER out from under the roster's pick).
 * Measured char counts are quoted per entry; if one changes, the anchor moved.
 */

// ═══════════════════════════════════════════════════════════════════════════
// READY — the generator consumes these correctly today.
// 65 real attacks across 8 fights (measured inFight total), no generator changes
// required: watercooler 1, kround 4, chaosking 11, yellow_blue 4, titan 15,
// jackenstein 11, flowery 14, lanino_elnina 5.
// (lanino_elnina additionally needs a one-value DATA fix in its JSON — see below.)
// ═══════════════════════════════════════════════════════════════════════════

const BOSSES_PATCH_READY = [

  { id: 'watercooler', chapter: 'ch3', chNum: 3, label: 'Watercooler',
    enemy: 'obj_watercooler_enemy',
    // ONE attack (Rain, type 135). The dispatcher branches on the boolean
    // `amimoonwarmer`, and the Moon half is cut: amimoonwarmer is written in
    // exactly two places, both gated on `global.encounterno == 140`, and the
    // Watercooler battle is encounter 139 at all five launch sites. The three
    // Rain variants are dc.special off turn parity and ride along INSIDE the
    // captured setup slice, so one entry covers all three — the same call the
    // file already records for the Knight's difficulty variants. Measured:
    // 1 entry, 1 inFight, setup 350 chars carrying the whole special ladder.
    //
    // BOX (442 chars, Step_0:66). endAnchor stops at the phase flip; without it
    // ifStatementEnd returns the two-line create alone and drops the
    // obj_heartmarker lines, which obj_moveheart_Create_0:6-20 reads — the soul
    // would spawn at box.y-10, inside the rainball, instead of box.y+18.
    boxBlock: { file: 'gml_Object_obj_watercooler_enemy_Step_0.gml',
                anchor: 'if (!instance_exists(obj_growtangle))',
                endAnchor: 'global.mnfight = 2;' },
    // TURN (Step_0:79). scr_turntimer only RAISES, so this 200 makes the later
    // scr_turntimer(140) at Step_0:108 a no-op — and the rainball's own
    // Create_0:11 scr_turntimer(300) is what sets Rain's real 300-frame turn.
    // The rainball reads global.turntimer twice, so this is load-bearing.
    // endAnchor '}' has 41 raw occurrences but indexOf starts at the anchor, so
    // the slice is the single statement. Verified.
    turnBlock: { file: 'gml_Object_obj_watercooler_enemy_Step_0.gml',
                 anchor: 'scr_turntimer(200);',
                 endAnchor: '}' } },

  { id: 'kround', chapter: 'ch1', chNum: 1, label: 'K. Round',
    enemy: 'obj_checkers_enemy',
    // Ch1 dialect: no monsterattackname. The boss creates obj_checkers_leap and
    // writes `leap.leapmode = N`; the ATTACK lives in the leap's own Step, so
    // the scan is pointed at the CONTROLLER, not the boss. Scanning the boss
    // finds nothing usable — `rr` is only ever written, and the four
    // `attacktype == N` hits sit in one-line windows with no instance_create.
    //
    // Known and harmless: the scan's `controller` comes out as obj_shake
    // (leapmode 0/1) and obj_regularbullet (2/3), because the regex takes the
    // first instance_create in each window. The reconcile pass rewrites all
    // four to obj_checkers_leap from the roster's `real` list and attaches
    // set = {leapmode: N}. leapmode 4's window contains no instance_create at
    // all so it is skipped — correct by accident, since 4 is the cut one.
    // Measured: 4 entries, 4 inFight, setups 1923-3209 chars.
    selectorScan: { file: 'gml_Object_obj_checkers_leap_Step_0.gml',
                    varName: 'leapmode' },
    // BOX (154 chars, Step_0:31, anchor unique). No endAnchor: ifStatementEnd
    // walks the if's parens, finds no '{', and stops at the ';' of the
    // instance_create. Ch1's obj_growtangle has no maxxscale/maxyscale at all —
    // it grows to a hard-coded 2 over 15 frames, giving a fixed 150x150 box
    // whose floor at viewY+245 is what leapmodes 0 and 1 land on. DO NOT move
    // the anchor up to `if (global.monsterhp[myself] > milkmax)` (Step_0:26):
    // that is the MILK phase gate and needs milkmax defined.
    boxBlock: { file: 'gml_Object_obj_checkers_enemy_Step_0.gml',
                anchor: 'if (!instance_exists(obj_growtangle))' },
    // TURN (Step_0:94). `global.turntimer = 999;` is NOT unique (3 raw hits:
    // 94, 160, 299) but extractTurnBlock takes the first, and 160/299 are the
    // milk cutscene. `attacked = 1;` IS unique (:95). Slice = one statement.
    turnBlock: { file: 'gml_Object_obj_checkers_enemy_Step_0.gml',
                 anchor: 'global.turntimer = 999;',
                 endAnchor: 'attacked = 1;' } },

  { id: 'chaosking', chapter: 'ch1', chNum: 1, label: 'The Chaos King',
    enemy: 'obj_king_boss',
    // Ch1 dialect, Jevil-shaped: obj_king_boss Step assigns a numeric `attack`
    // and dispatches through event_user(5) = Other_15, where each
    // `if (attack == 1..11)` branch builds the whole turn in one braced block.
    // ALL ELEVEN branches are real — the chooser (Step_0:90-121) is a fixed
    // 15-turn script (kturn 1..11, then 12->7, 13->8, 14->10, 15->9), with no
    // choose(), no HP gate and no difficulty. The cut content sits one layer
    // down, inside the objects the branches spawn.
    //
    // Verified: the scan finds exactly 11 hits, attack == 1 .. 11, in file
    // order, every branch braced, setups 313-707 chars. `attacked == 0` on
    // Other_15:1 does not false-match (the regex needs `attack` then `==`).
    selectorScan: { file: 'gml_Object_obj_king_boss_Other_15.gml',
                    varName: 'attack' },
    // Six of the eleven branches create the BOX before the controller, so the
    // scan reports controller = obj_growtangle for them; reconcile repairs all
    // six (obj_dbulletcontroller / obj_growtangle_bouncer / obj_chainking).
    // Measured: 11 in, 11 out, 11 inFight — and the three obj_chainking type-1
    // attacks (choices 2, 5, 10) survive as SEPARATE entries because the dedupe
    // key includes a.name and selectorScan names them "attack 2 (type 1)" /
    // "attack 5 (type 1)" / "attack 10 (type 1)". (The roster .md's
    // "DEDUPE-KEY COLLISION" blocker predates the name being added to the key
    // and is stale — re-verified against the current generator.)
    //
    // NO boxBlock ON PURPOSE. `grep -n growtangle` over obj_king_boss_Step_0
    // returns nothing: every branch builds its own arena, and five of them
    // (attacks 2, 5, 6, 10, 11) hide the boss and use obj_nonsolid_growtangle,
    // which the chain objects physically drag around the screen. The studio's
    // default-box pre-create must be SUPPRESSED for this fight or attacks
    // 1/3/4/7/8/9 get two growtangles.
    boxBlock: null,
    // TURN (Step_0:148, anchor and endAnchor both unique). Same shape as Jevil:
    // a flat baseline immediately followed by event_user(5), so every per-attack
    // value inside Other_15 (190/200/210/220/999) is meant to WIN — which the
    // studio's raise-only guard already protects. This block exists only to
    // stop the 90-frame floor applying if a setup replay fails.
    turnBlock: { file: 'gml_Object_obj_king_boss_Step_0.gml',
                 anchor: 'global.turntimer = 180;',
                 endAnchor: 'event_user(5);' } },

  { id: 'yellow_blue', chapter: 'ch5', chNum: 5, label: 'Yellow & Blue',
    enemy: 'obj_blue_enemy',
    // Only BLUE ever attacks. Both monsters call scr_attackpriority during
    // enemytalk; it only succeeds on a strict increase, so Yellow's (0) always
    // fails and Blue's (1) always wins. Yellow never sets
    // global.monsterattackname anywhere in the chapter — but it must EXIST as a
    // positioned instance or ShootingGallery and BlueSinging hard-error on
    // unset instance variables (flower_aim Create_0:12-13, singing2 Step_0:5-9,
    // scr_blue_petal_explosion:22-26). Hence extraEnemies.
    extraEnemies: ['obj_yellow_enemy'],
    // The chooser is a ONE-LINE FILE — obj_blue_enemy_Other_11.gml:1,
    // `myattackchoice = turns % 4;` — so for once the real roster EQUALS the
    // dispatcher: 4 of 4. Measured: 4 entries, 4 inFight, types 301/302/303/304,
    // setups 181-189 chars.
    //
    // BOX (1249 chars, Step_0:106). The anchor is the HEALING-RAIN condition,
    // which looks wrong and is not: the growtangle create is that if's
    // `else if`, so the slice is the whole self-selecting chain (choice 0 ->
    // x -= 50; 1 -> maxxscale 3.5, y += 48; 2 -> x -= 50, maxxscale 3;
    // 3 -> maxxscale 3). It is also fail-safe — with obj_yellow_enemy absent,
    // or global.monsterhp unseeded, the guard is false/NaN and the box is still
    // created. endAnchor stops before the scr_moveheart line, which is gated on
    // Yellow's healingraincon.
    boxBlock: { file: 'gml_Object_obj_blue_enemy_Step_0.gml',
                anchor: 'if (i_ex(obj_yellow_enemy) && global.monsterhp[obj_yellow_enemy.myself] < (global.monstermaxhp[obj_yellow_enemy.myself] * 0.5) && obj_yellow_enemy.healingraincon == 0)',
                endAnchor: 'if (!instance_exists(obj_moveheart) && obj_yellow_enemy.healingraincon == 0)' },
    // TURN (Step_0:150). The real per-attack lengths (300/270/225/300) live
    // inside the dispatcher branches and ride along in each entry's setup
    // slice; this is only the raise-only 90-frame floor. Turn length is
    // load-bearing DOWNWARD here — boxspin (Step_0:105), flower_aim (:416) and
    // singing2 (:24) all schedule their exit off `global.turntimer <= 20/30`,
    // so at a bare 90 all three end on frame one.
    turnBlock: { file: 'gml_Object_obj_blue_enemy_Step_0.gml',
                 anchor: 'scr_turntimer(90);',
                 endAnchor: '}' } },

  { id: 'titan', chapter: 'ch4', chNum: 4, label: 'The Titan',
    enemy: 'obj_titan_enemy',
    // obj_titan_spawn_enemy is a SEPARATE, earlier encounter (case 177, two
    // instances) that shares obj_dbulletcontroller; it contributes 3 real rows
    // (types 450/456/460). Listed as an extra ENEMY as well as an extra file so
    // monsterTypeOf and the studio's partner-spawn both see it.
    extraEnemies: ['obj_titan_spawn_enemy'],
    extraAttackFiles: ['gml_Object_obj_titan_spawn_enemy_Step_0.gml'],
    // Measured: 20 entries, 15 inFight, 5 cut — INCLUDING the choice-20
    // `obj_titan_heal` turn replacement, which the current generator's
    // unreached-row pass now emits (it has no monsterattackname and no
    // controller type, so the scan cannot see it).
    // The real/cut overlaps (type 456, choices 5 and 6) are NOT roster errors:
    // obj_titan_enemy and obj_titan_spawn_enemy share a myattackchoice
    // namespace, so 456 is real via the SPAWN while the boss's own choice-6
    // branch is cut, and 455 is cut for the mirror reason. The type-keyed auto
    // REAL filter resolves both correctly — verified by running it.
    //
    // BOX (415 chars, Step_0:153, anchor unique). Choices 2/3/4 (the big-blast
    // attacks) get the box at view+(250,200) because the blasts are fired from
    // obj_growtangle.x + 240 and need room to cross; everything else gets
    // view+(320,170). The whole block already sits inside
    // `if (myattackchoice == 20) { } else { … }`, so the heal turn creates no
    // box at all. maxxscale/maxyscale for types 468/469 are set by the
    // CONTROLLER, so the studio gets those free by spawning it.
    boxBlock: { file: 'gml_Object_obj_titan_enemy_Step_0.gml',
                anchor: 'if (!instance_exists(obj_growtangle))' },
    // TURN (105 chars, Step_0:175-178). The endAnchor is MANDATORY: this ladder
    // has no trailing `else scr_turntimer(N);`, the only terminator
    // extractTurnBlock recognises unaided, and without it the slice runs
    // through the whole dispatcher and spawns a SECOND obj_dbulletcontroller
    // every turn — the exact Knight bug. Verified: the slice is
    // `scr_turntimer(360); if (myattackchoice == 2) scr_turntimer(270);` and
    // contains no spawner. The 270 is a fossil (scr_turntimer only raises).
    // NOT capturable: `if (myattackchoice == 4 && phase == 8)
    // global.turntimer = 240;` (Step_0:319-320) sits after `turns += 1`,
    // outside every branch — choice 4 will run at 360 in the studio.
    turnBlock: { file: 'gml_Object_obj_titan_enemy_Step_0.gml',
                 anchor: 'scr_turntimer(360);',
                 endAnchor: 'if (myattackchoice == 0)' } },

  { id: 'jackenstein', chapter: 'ch4', chNum: 4, label: 'Jackenstein',
    enemy: 'obj_jackenstein_enemy',
    // obj_jackendummy is an inert CHILD of the boss, created only in
    // room_bullettest by types 148/149/152 to carry the per-turn ACT modifiers
    // scaredycat / sact / ract. Listing it means a studio run that reports
    // room == room_bullettest inherits those for free.
    extraEnemies: ['obj_jackendummy'],
    // Measured: 11 entries, 11 inFight, ZERO cut — unlike the first five
    // bosses, every dispatcher value has a writer. The chooser (Other_10) is a
    // pure turn counter running phaseturn 1..10 -> choices 0,1,2,3,4,5,6,7,8,10
    // then parking on 10 forever; the one value it never emits, 9
    // ("jack lightup", type 155), comes from Kris's 150-TP UNLEASH ACT at
    // Step_0:81-84, which skips the chooser and so does not advance phaseturn —
    // an insertable turn playable any number of times.
    //
    // Note choice order != type order (2->151, 3->150, 4->148, 5->153, 6->149,
    // 7->152): sorting the dropdown by type scrambles the fight.
    // Confirmed no-op: difficultyLiteral null and usesDifficulty false on all
    // 11 — there are no difficulty variants in this fight at all.
    //
    // BOX (2686 chars, Step_0:415, anchor unique), endAnchor at the phase flip.
    // Nine of eleven attacks set global.turntimer = 999999 directly and end on
    // an obj_ghosthouse_exit collision, so the box block, not the clock, is
    // what shapes the turn.
    boxBlock: { file: 'gml_Object_obj_jackenstein_enemy_Step_0.gml',
                anchor: 'if (!instance_exists(obj_growtangle))',
                endAnchor: 'global.mnfight = 2;' },
    // TURN (Step_0:567). Anchor and endAnchor both unique; slice is the single
    // `scr_turntimer(200);`. Only types 155 (900) and 156 (420) are timed.
    turnBlock: { file: 'gml_Object_obj_jackenstein_enemy_Step_0.gml',
                 anchor: 'scr_turntimer(200);',
                 endAnchor: 'turns += 1;' } },

  { id: 'flowery', chapter: 'ch5', chNum: 5, label: 'Flowery',
    enemy: 'obj_flowery_enemy',
    monsterType: 119,
    // The only roster in the contributed set that reproduces its derivation
    // EXACTLY: measured 23 entries, 14 inFight, 9 cut, matching the .md's 14/9
    // with no reconciliation needed.
    //
    // NO selectorVar ON PURPOSE, and it is load-bearing. attackAnnouncements()
    // yields 24 rows and records the first — the intro dash tutorial
    // hard-spawned at Step_0:512-515 — as selector "introtimer", choice 21.
    // With a selectorVar set, the reconcile pass would rewrite the choice-21
    // AquaKnives entry (type 641) to type 637, and the dedupe would then make
    // launching AquaKnives replay the dash tutorial. Verified both ways.
    // The type-keyed auto REAL filter needs no selector to do its job.
    //
    // BOX (2831 chars, Step_0:1110-1194, anchor unique). The obvious anchor
    // `if (!instance_exists(obj_growtangle))` is UNUSABLE: it appears twice
    // (Step_0:500 in the intro block and :1112 in the real pre-attack block)
    // and indexOf takes the FIRST, which slices only the one-line intro create.
    // Anchoring on the enclosing mnfight==1.5 gate is unique AND load-bearing
    // beyond the box: choices 0/1/2/16/18/19/7/8/9 create
    // obj_orangeheart_floweryjarona HERE (Step_0:1127), so SEVEN of the
    // fourteen real attacks are EMPTY without this replay; choice 18 sets
    // can_kidding, choice 19 hides the Jarona and re-depths the boss, choice 17
    // hides the box entirely. Verified: no scr_bulletspawner in the slice.
    boxBlock: { file: 'gml_Object_obj_flowery_enemy_Step_0.gml',
                anchor: 'if (global.mnfight == 1.5 && endcon == 0 && phasetransition_con == 0 && healingscenecon == 0 && flowery_blowkiss_scene_con == 0)' },
    // TURN (18 chars, Step_0:1178). Flowery has NO turn ladder — every
    // per-attack length lives inside its own dispatcher branch and rides along
    // in the setup slice. This is only the shared 90-frame floor. The anchor
    // occurs twice (1178 and 1193, a verbatim duplicated paragraph in the
    // source); the first passes the /turntimer/ proximity test and is taken.
    // The endAnchor has 3 raw occurrences (506, 1165, 1180) and resolves to
    // 1180 because indexOf starts at the anchor.
    //
    // For the studio, not the generator: the big dispatcher numbers
    // (3200/3800/9999/9999999) are CEILINGS, not durations — the patterns end
    // themselves by writing global.turntimer directly. Honouring the dispatcher
    // number literally leaves an empty box for ~107 s at 30 fps.
    turnBlock: { file: 'gml_Object_obj_flowery_enemy_Step_0.gml',
                 anchor: 'scr_turntimer(90);',
                 endAnchor: 'if (!instance_exists(obj_moveheart))' } },

  { id: 'lanino_elnina', chapter: 'ch3', chNum: 3, label: 'Lanino & Elnina',
    enemy: 'obj_elnina_lanino_controller',
    extraEnemies: ['obj_lanino_enemy', 'obj_elnina_enemy'],
    // `enemy` names the CONTROLLER, not a monster, and that is deliberate: both
    // blocks below read `turns`, a controller variable, so they must be
    // replayed with self = an obj_elnina_lanino_controller instance.
    // monsterTypeOf falls through to extraEnemies and resolves 61.
    //
    // There is exactly ONE dispatcher site with ONE dc.type (130,
    // Step_0:1122-1155); all five attacks are `special` 0..4 on that one
    // controller, off a fixed turn ladder with no randomness anywhere. There is
    // no monsterattackname in the fight, so this goes down the DECLARED path.
    // Measured: 5 entries, 5 inFight, selector "special", choices 0-4,
    // controllerSet carrying {type:130, special:N, difficulty:0}.
    //
    // controllerSet is now honoured on the declared path (the roster row's
    // `set` is merged into controllerSet at dedupe), so difficulty is correctly
    // pinned to 0 — which matters: obj_elnina_mascotattack uses difficulty as a
    // bullet-SPRITE selector, so a studio DIFF of 1-4 silently changes bullet
    // species.
    //
    // ⚠ DATA FIX REQUIRED IN rosters/lanino_elnina.json, not here. All five
    // `real` rows carry
    //     "side": "0 = Lanino favored, 1 = Elnina favored"
    // — a sentence, which is now written verbatim onto the controller as
    // controllerSet.side. `side` selects which mascot is favoured and must be
    // 0 or 1. Split the five rows into two per side, or pin one and expose the
    // other in the studio.
    //
    // BOX (331 chars, Step_0:1049, anchor unique). Box at view+170 except turn
    // 7 at +190.
    boxBlock: { file: 'gml_Object_obj_elnina_lanino_controller_Step_0.gml',
                anchor: 'if (!instance_exists(obj_growtangle))',
                endAnchor: 'if (!instance_exists(obj_moveheart))' },
    // TURN (241 chars, Step_0:1159, anchor unique). Slice verified spawner-free:
    // turns <5 -> 260, ==5 -> 275, ==6 -> 275, ==7 -> 850. The 850 is
    // load-bearing — special 4 times its dialogue, shotrate ramp, sprite swap
    // and music fade off global.turntimer at 500/400/350/250/200/100.
    turnBlock: { file: 'gml_Object_obj_elnina_lanino_controller_Step_0.gml',
                 anchor: 'if (turns < 5)',
                 endAnchor: 'global.typer = 6;' },
    controllerSet: { difficulty: 0 } },
];


// ═══════════════════════════════════════════════════════════════════════════
// NEEDS GENERATOR WORK — do NOT paste these yet.
//
// Each config below is CORRECT (anchors verified verbatim, slices verified
// balanced and spawner-free) and the emitted COUNTS are now right. What is
// wrong is what gets ATTACHED to each entry. The `_needs` note on each names
// the capability from _SYNTHESIS.md §4 and the measured symptom.
//
// G-A applies to FOUR of the five below and is the single highest-priority fix
// in the whole set: applyRosterRow() overrides an entry's `type` and
// `controller` from the roster row but leaves the scan's verbatim `setup`
// slice in place, and the studio replays `setup` verbatim — so 15 measured
// entries currently spawn a DIFFERENT controller type than the one they claim.
// ═══════════════════════════════════════════════════════════════════════════

/*
const BOSSES_PATCH_BLOCKED = [

  // ── G1 ──────────────────────────────────────────────────────────────────
  { id: 'tasque_manager', chapter: 'ch2', chNum: 2, label: 'Tasque Manager',
    enemy: 'obj_tasque_manager_enemy',
    extraEnemies: ['obj_tasque_enemy'],
    extraAttackFiles: ['gml_Object_obj_tasque_enemy_Step_0.gml'],
    boxBlock: { file: 'gml_Object_obj_tasque_manager_enemy_Step_0.gml',
                anchor: 'if (!instance_exists(obj_growtangle))' },       // 154 chars, Step_0:122
    turnBlock: { file: 'gml_Object_obj_tasque_manager_enemy_Step_0.gml',
                 anchor: 'scr_turntimer(140);',                          // Step_0:182
                 endAnchor: 'overrideAttack = 0;' },
    // _needs: G1. readdirSync returns …_Other_24.gml BEFORE …_Step_0.gml, and
    // Other_24 is a DEAD 368-line duplicate Step (user event 14) that nothing
    // in ch2 ever calls. It wins the dedupe. MEASURED from the emitted
    // entries' `source`: tasque_manager_type32,
    // tasque_manager_type32_quizattack_doj and tasque_manager_type3 all come
    // from Other_24. The dead QuizAttack carries extraFields []; the LIVE one
    // carries ["element","special"], hasSpecial true and difficulty 4 — the
    // studio's only handle on the encounter-89 dojo variant ("Tasque Manager
    // Says", real shipped content behind global.flag[642], reached from
    // obj_fusionmenu_Step_0.gml:637-642 via a NON-LITERAL scr_battle call).
    // YarnBalls and MeowWow are fine — obj_tasque_enemy_Step_0.gml.
    excludeFiles: ['gml_Object_obj_tasque_manager_enemy_Other_24.gml'] },

  // ── G2 (+ G-A) ──────────────────────────────────────────────────────────
  { id: 'aqua_seth', chapter: 'ch5', chNum: 5, label: 'Aqua & Seth',
    enemy: 'obj_aqua_enemy',
    extraEnemies: ['obj_purple_enemy'],
    extraAttackFiles: ['gml_Object_obj_purple_enemy_Step_0.gml'],
    boxBlock: { file: 'gml_Object_obj_aqua_enemy_Step_0.gml',
                anchor: 'if (!instance_exists(obj_growtangle))',         // 336 chars, Step_0:368
                endAnchor: 'if (!instance_exists(obj_moveheart))' },
    turnBlock: { file: 'gml_Object_obj_aqua_enemy_Step_0.gml',
                 anchor: 'scr_turntimer(90);',                           // Step_0:384, floor only
                 endAnchor: '}' },
    // _needs: G2, G-A, G4.
    //  * G2 — obj_aqua_enemy_Step_0.gml contains BOTH encounters: the solo
    //    fight (encounter 220) at :391-473 under `if (fight_type == "solo")`,
    //    and the paired fight this roster is about (encounter 223) at :474-541
    //    under `else if (fight_type == "seth")`. Announcement names AND types
    //    are identical, so first-wins dedupe keeps the SOLO arm. MEASURED
    //    captured turn lengths against the paired source:
    //      type 308 KnifeChain   captured 240  paired 260-on-turn-4-else-240
    //      type 309 FanOfKnives  captured 240  paired 240   (ok by luck)
    //      type 310 KnifePetal   captured 240  paired 240   (ok by luck)
    //      type 300 OmegaKnife   captured 300  paired 245   <-- 55 frames wrong
    //    The paired arms also set knife_number 3/6, which the solo arms do not.
    //  * G-A — choice is not a unique key here: Aqua's choice 0 is KnifeChain
    //    and Seth's choice 0 is SupportFire (one shared myattackchoice
    //    namespace, two enemies). MEASURED: aqua_seth_type313 (SupportFire)
    //    carries KnifeChain type-308's setup, type306 (OmegaBook) carries
    //    FanOfKnives 309's, type306_omegabookex carries KnifePetal 310's.
    //    All three would spawn the wrong controller.
    //  * G4 — all nine rows spell it `turntimer`, which applyRosterRow does not
    //    read; the entries come out with turnTimer undefined.
    scanFrom: { 'gml_Object_obj_aqua_enemy_Step_0.gml': 'else if (fight_type == "seth")' } },

  // ── G9 ──────────────────────────────────────────────────────────────────
  { id: 'lancer', chapter: 'ch1', chNum: 1, label: 'Lancer',
    enemy: 'obj_lancerboss',
    extraEnemies: ['obj_lancerboss3', 'obj_susieenemy', 'obj_lancerboss2'],
    extraAttackFiles: ['gml_Object_obj_lancerboss3_Step_0.gml',
                       'gml_Object_obj_lancerboss2_Step_0.gml',
                       'gml_Object_obj_susieenemy_Step_0.gml'],
    boxBlock: { file: 'gml_Object_obj_lancerboss_Step_0.gml',
                anchor: 'if (!instance_exists(obj_growtangle))' },       // 154 chars, Step_0:57
    turnBlock: { file: 'gml_Object_obj_lancerboss_Step_0.gml',
                 anchor: 'global.turntimer = 999;',                      // Step_0:89
                 endAnchor: 'attacked = 1;' },
    // _needs: G9 (and G3 to do it properly). Ch1 has no monsterattackname and,
    // unlike Jevil, no numeric selector either — four dispatchers across three
    // encounters use three different idioms — so this roster is DECLARED like
    // Pink's dates. MEASURED: 7 declared entries, all correct, ALL with
    // selector = null, because DECLARED_FALLBACK emits
    //   selector: (cfg.selectorVar && typeof r.choice === 'number') ? … : null
    // and lancer.json has no selectorVar. The studio then fails its
    // `bossDispatched` gate (gml_studio.html:1736) and replays NEITHER the box
    // block NOR the turn block — so all 7 launch with no battle box, despite
    // both blocks being present, verified and spawner-free.
    // G3 would be better still: obj_lancerboss3 + obj_susieenemy is the Susie
    // REMATCH (encounter 31) and obj_lancerboss2 is the Card Castle fight
    // (encounter 20) — three real, separate encounters, and the object
    // numbering is not chronological. Two anchor traps recorded in the .md
    // apply to those: obj_lancerboss3's turn anchor needs endAnchor '}', and
    // obj_lancerboss2's turn block must NOT slice to `turns += 1;` because all
    // three instance_create(obj_dbulletcontroller) calls sit in between.
    replayBox: true, replayTurn: true },

  // ── G9 + G4 (+ a data fix) ──────────────────────────────────────────────
  { id: 'orange_green', chapter: 'ch5', chNum: 5, label: 'Orange & Green',
    enemy: 'obj_orange_green_controller',
    extraEnemies: ['obj_orange_enemy', 'obj_green_enemy'],
    boxBlock: { file: 'gml_Object_obj_orange_green_controller_Step_0.gml',
                anchor: 'if (global.mnfight == 1.5 && endcon == 0)' },   // 1005 chars, Step_0:514-538
    turnBlock: null,
    // turnBlock is null ON PURPOSE: every scr_turntimer except the 90-frame
    // floor is interleaved with the instance_create(obj_dbulletcontroller)
    // calls, so no slice can set turn length without double-spawning.
    //
    // _needs: G9, G4, plus a DATA fix.
    //  * G9 — MEASURED: 5 entries (the HEALING EGG turn replacement is now
    //    emitted by the unreached-row pass), ALL with selector = null, because
    //    orange_green.json's choices are prose ("uppercut_life >= 1"). The box
    //    block therefore NEVER replays — fatal here, because that block is the
    //    only caller of scr_moveheart(): no box AND no soul.
    //  * G4 — all five rows spell it `turntimer` (270/360/500/615/999), which
    //    applyRosterRow does not read. With no turnBlock either, these are the
    //    ONLY source of turn length and all five fall to the studio's floor.
    //  * DATA FIX in rosters/orange_green.json: the `set` blocks carry prose
    //    that is now written straight onto the controller —
    //      "creator": "obj_green_enemy.myself", "creatorid": "obj_green_enemy.id",
    //      "target": "obj_green_enemy.mytarget",
    //      "damage": "global.monsterat[green] * 5 = 80"
    //    14 such values across the four bullet entries.
    //  * ENGINE prerequisite: the growtangle create is the THIRD arm of a chain
    //    testing global.monsterhp[i] < global.monstermaxhp[i] * 0.7. With
    //    monsterhp unseeded the chain takes arm 1, sets healing_egg_con = 1,
    //    and never creates the box or the soul. Seed 2060/2060 on both enemies.
    replayBox: true },

  // ── G-A + G4 + G5 ───────────────────────────────────────────────────────
  { id: 'queen', chapter: 'ch2', chNum: 2, label: 'Queen',
    enemy: 'obj_queen_enemy',
    extraEnemies: ['obj_queenshield_enemy', 'obj_berdlyplug_enemy'],
    boxBlock: { file: 'gml_Object_obj_queen_enemy_Step_0.gml',
                anchor: 'if (!instance_exists(obj_growtangle))' },       // 1560 chars, Step_0:732-762
    turnBlock: null,
    // boxBlock verified: anchor unique, slice brace-balanced, self-selects on
    // rr AND difficulty. DO NOT move the anchor up to
    // `if (rtimer == 0 && attackdone == 0)` (Step_0:720) to capture more — that
    // block calls event_user(0), the CHOOSER, and would re-roll the attack out
    // from under the studio (the Knight trap). DO NOT extend it with an
    // endAnchor at the scr_moveheart line either: Step_0:769 closes the
    // enclosing if, so any slice reaching :770 carries a stray '}'.
    // turnBlock is null because every scr_turntimer sits inside its own `case`
    // next to the scr_bulletspawner call.
    //
    // _needs: G-A, G4, G5. MEASURED: 18 entries, 16 inFight — the counts are
    // now CORRECT (the variant fan-out recovered every sub-type: 2 at three
    // tilt speeds, 6/6.1, 100/115/116, 106/107, 110/111, 112/113).
    //  * G-A — queen_type3 "Stomp" carries the setup of BerdlyFeather TYPE 7.5.
    //    Launching Stomp replays a branch that spawns a 7.5 controller and then
    //    sets type 3. The entry got choice 3 from a `difficulty == 3)` backscan
    //    inside the BerdlyFeather case.
    //  * G5 — the emitted selector is `difficulty` on 8 of 18 entries and
    //    `rtimer` on one, because the backward `<var> == N)` scan finds a
    //    `difficulty == N)` inside the case body before the enclosing `case N:`
    //    is considered. The switch path at gen_attacks.js:361-375 exists but is
    //    gated on !cond and so never runs. The studio writes that variable onto
    //    the boss to pick the branch.
    //  * G4 — queen.json uses `turn`, which IS read, so turnTimer is populated
    //    (371/400/300/245/266/250/240). This one is already fine; noted so the
    //    G4 alias change does not regress it.
    // Two turns are set pieces that cannot be launched standalone: Wine hides
    // obj_growtangle and stalls at controller init==2 until the BOSS's
    // wineglasscon 1->2->3 animation sets init=3; the Ultimate is a scripted
    // joke turn with obj_hiddenheart and a fake download bar.
    dispatchBlock: { file: 'gml_Object_obj_queen_enemy_Step_0.gml',
                     anchor: 'switch (rr)', endAnchor: 'turns += 1;' } },

  // ── G3 + G-A ────────────────────────────────────────────────────────────
  // BERDLY IS TWO FIGHTS and must become two entries. MEASURED: 10 entries,
  // 10 inFight — the counts are right, but EVERY scanned entry carries
  // source = gml_Object_obj_berdlyb2_enemy_Step_0.gml (fight 2), because
  // 'obj_berdlyb2_enemy' sorts before 'obj_berdlyb_enemy' ('2' 0x32 < '_'
  // 0x5F), while the boxBlock is sliced from fight 1. The fan-out then labels
  // three of them "(fight 1, …)" on top of fight 2's setup slice.
  // G-A on top: berdly_type10 and berdly_type10_chirashi_fight are named
  // Chirashi (type 10) but carry SpearBlast type-9's setup — the rr -> chosenattack
  // map is deliberately NOT the identity (rr 1 -> Chirashi, rr 2 -> SpearBlast,
  // obj_berdlyb2_enemy_Step_0.gml:43-59), so matching rows by `choice` alone
  // pairs the wrong branch.
  { id: 'berdly_coaster', chapter: 'ch2', chNum: 2, label: 'Berdly — Bump of Chicken',
    enemy: 'obj_berdlyb_enemy',
    boxBlock: { file: 'gml_Object_obj_berdlyb_enemy_Step_0.gml',
                anchor: 'if (!instance_exists(obj_moveheart) && !instance_exists(obj_heart))',
                endAnchor: '}' },                                        // 416 chars, Step_0:166-173
    turnBlock: null,
    // No sliceable turn block: all three scr_turntimer calls sit inside their
    // dispatcher branch right after scr_bulletspawner (the Knight trap). The
    // inline `attackorder` ladder at Step_0:27-39 makes this a strict
    // deterministic 3-cycle with difficulty hardcoded per branch; the boss's
    // own `difficulty` field is debug-only (Step_0:537-541).
    turnByChoice: { 0: 210, 1: 200, 2: 180 } },
  { id: 'berdly_snowgrave', chapter: 'ch2', chNum: 2, label: 'Berdly & Noelle',
    enemy: 'obj_berdlyb2_enemy',
    extraEnemies: ['obj_werewire_enemy'],
    boxBlock: null,
    turnBlock: { file: 'gml_Object_obj_berdlyb2_enemy_Step_0.gml',
                 anchor: 'scr_turntimer(260);',
                 endAnchor: 'turns += 1;' },
    // Two-hop selector: `rr` picks, `chosenattack` dispatches, and the map is
    // NOT the identity. Difficulty is derived at runtime from
    // (scr_monsterpop() == 1) ? 1 : 0, so a one-monster studio scene can only
    // produce the solo d1 variants. Legal difficulties are 0/1/2 for types 9
    // and 10 but ONLY 0/1 for type 8 — anything else spawns nothing (strict
    // if/else-if, no else, obj_dbulletcontroller_Step_0.gml:273/:308).
    // Note the type-8 d1 arm writes `global.turntimer = 200` DIRECTLY
    // (obj_dbulletcontroller_Step_0.gml:265), lowering this fight's flat 260.
    _needs: 'G3, G-A' },

  // ── G-A + G10 ───────────────────────────────────────────────────────────
  { id: 'tenna', chapter: 'ch3', chNum: 3, label: 'Tenna',
    enemy: 'obj_tenna_enemy',
    monsterType: 103,
    extraAttackFiles: ['gml_Object_obj_tenna_zoom_Other_11.gml'],
    boxBlock: { file: 'gml_Object_obj_tenna_enemy_Step_0.gml',
                anchor: 'if (myattackchoice < 3)' },                     // 325 chars, Step_0:555
    turnBlock: null,
    // boxBlock verified: 1 occurrence, brace-balanced, spawner-free. turnBlock
    // is null on purpose — every turn length (200/260/260/999/999999) sits
    // inside its dispatcher branch and rides along in the setup slice, and the
    // only out-of-branch call is a raise-only scr_turntimer(90) identical to
    // the studio's fallback.
    //
    // _needs: G-A, G10, G4. MEASURED: 14 entries, 14 inFight against 13
    // declared. Big improvement from the rewrite — all nine PHYSICAL CHALLENGE
    // minigames are now emitted by the unreached-row pass with correct
    // controllers and controllerSets (parseControllerCell() turns
    // "obj_shootout_controller (shootout_type = 2)" into obj_shootout_controller
    // + {shootout_type: 2}). Remaining:
    //  * G-A — all nine inherit base.setup, which is "all star cast"'s branch:
    //    every PHYSICAL CHALLENGE would first spawn obj_dbulletcontroller
    //    type 125. base is literally roster.find(a => a.boss === j.id), the
    //    boss's arbitrary first entry; for declared rows setup must be null.
    //  * The 14th entry is the CUT choice-20 type-150 dispatch
    //    (obj_tenna_enemy_Step_0.gml:609-615), stamped inFight by the
    //    type-keyed auto filter because 150 is also the real LIGHT 'EM UP type.
    //    See the hand-written REAL entry in _SYNTHESIS.md §5.
    //  * G4 — three rows spell it `turntimer`; unread.
    // The three ordinary bullet attacks (125/126/128) work today and could be
    // shipped alone by pasting only those into the READY list above.
    _needs: 'G-A, G10, G4' },
];
*/


// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENTED ONLY — deliberately absent from BOSSES.
//
// cround (obj_smallcheckers_enemy, ch1). `real: []`, so the roster loader skips
// it with "[rosters] cround: 0 real attacks — documented only, not added" —
// verified as the only console line the roster directory produces at load.
// C. Round has no reachable attack: its Step is a copy of obj_heartenemy's with
// the bullet guard changed from `if (rr == 1)` to `if (rr == 999)` while rr is
// still assigned scr_monsterpop() (range 0..3), the growtangle create and
// scr_moveheart() deleted, and the turn dropped to a literal
// `global.turntimer = 1` (~13 frames with nothing on screen). Its anchors ARE
// valid — the turn slice is exactly "global.turntimer = 1;" and the rr scan
// yields exactly one entry, 999 -> obj_spinheart type 0, correctly skipping the
// rr == 0 battle-message hit — they simply describe cut content. Leave the JSON
// in place as documentation; do not add a BOSSES entry; and note that any
// REAL[] judge added for it must return false for everything.
// ═══════════════════════════════════════════════════════════════════════════

module.exports = { BOSSES_PATCH_READY };
