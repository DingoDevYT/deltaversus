# Pink fight — authoritative source spec (extracted from GML, for 1:1 port)

Box accessors (scr_get_box, box = obj_growtangle): 0=right, 1=top, 2=left, 3=bottom, 4=cx, 5=cy.
Bullet objects: cats/lanes = obj_pinkcatbullet; small bomb = obj_fusebomb; giant/med bomb = obj_fusebomb_big; collectibles = obj_dokiheart.

## TYPE 200 — Cat / purple lanes  (obj_purplecontrols mode 1; obj_heart=spr_purpleheart, canmove=0)
Thrower obj_pink_battlemovement mode 1 = only Pink's landing arc (NOT the bullet source). Cats fired by the dispatcher.
Chart quad = [cell, side, interval, speed].
- Timing: turntimer=70; per quad turntimer += round(0.5 + 13*interval/1.25). Consume: while btimer>=btimer_start+15, btimer -= round(0.5 + 13*interval/1.25) (=round(0.5+10.4*interval)), read quad, fire, delete 4. stop when size<4.
- cell<3 (0/1/2, may be .1 fractional): fire obj_pinkcatbullet at x=cx+side*416, y=cy+floor(cell-1)*56, dir=90+side*90, speed=8*qspeed*(4/3). side 1 = spawn right(+416) move left; side -1 = spawn left move right. if qspeed>=1.5 -> spin_radius=1.5. Trailing dokihearts: repeat(frac(cell)*10) at x=cx+side*(416 - i*72*qspeed), scale 1.5 (visual 2/3).
- cell 6/7/8: fire obj_dokiheart at x=cx+side*416, y=cy+(cell-7)*56, dir=90+side*90, speed=8*qspeed*4/3, scale 2.5 (visual 0.4).
- cell 3/4/5: set thrower mode=2/3/4 (bomb interludes).
Diff-0 chart (mild block; d_mild=1.1,s_mild=0.75; d*0.75=0.825,s*0.9=0.675):
 [0,1,1.1,.75][2,1,1.1,.75][1,1,1.1,.75][0,1,1.1,.75][2,1,3.75,.75]
 [7,-1,.825,.675][6,-1,.825,.675][7,-1,.825,.675][8,-1,.825,.675][7,-1,.825,.675][8,-1,.825,.675][7,-1,4.5,.675]
 medium (d_med=1,s_med=0.9): [2.1,1,1,.9][1.1,1,1,.9][0.1,1,1,.9][1.1,1,1,.9][2.1,1,1,.9][0.1,1,1,.9][1.1,1,1,.9][2.1,1,1,.9][1.1,1,4,.9]
 spicy (d_spicy=0.95,s_spicy=1.3333): 36 quads cells 6/7/8/0/1/2 side -1, intervals mostly 0 then 0.95 every 3rd; last interval 0.01.
Diff-1: beat intro (d_beat=0.95, spd 0.9) + syncopated middle + fast finale 32× [0,1,.05,1.5]/[2,-1,.05,1.5] with one [3,1,0,1] after 15th pair, final [2,-1,5,1.5].
Diff-2 (conga): 3 loops; per loop d_conga*=0.875 (0.667/0.5836/0.5107), s_conga+=0.16 (1.1/1.26/1.42); 16-quad figure [1,1,A,S][7,1,A,S][7,1,A,S][1,1,B,S][4,1,0,1][0,-1,A,S][6,-1,A,S][6,-1,A,S][0,-1,B,S][1,1,A,S][7,1,A,S][7,1,A,S][1,1,B,S][2,-1,A,S][8,-1,A,S][8,-1,A,S][2,-1,L,S] where A=2/3·d,B=4/3·d,L=d_conga_last(=4/3·d for i<2 else .01).
Diff-3 (flip): hflip=±1,vflip∈{0,2},binterval=.75,bspeed=1; cells abs(vflip-k)(+.1), side ±1*hflip; 32 quads w/ cells 4&5 interludes at binterval*.5 spd1; final [abs(vflip-0)+.1,-1*hflip,11.5,1].

## TYPE 204 — Vertical lanes (roundbell)  (mode 4; box *1.125x *1.5y; turntimer 390; spawn obj_roundbellbullet at box4-63,box1-8)
3 columns: b_interval=[7,10,36], b_number=[3,2,1], b_break=[-30,-36,-24], b_speed=[3.2,2,1.25]. init btimer[k]=b_interval[k]-2.
pattern_speed_modifier by diff: 0->1,1->1.2,else->1.5. Each frame btimer_dec[k]+=mod; while>=1: -1, btimer[k]++; fire when btimer[k]>0 && (btimer[k]%b_interval[k])==b_interval[k]-1; count reached -> reset to b_break[k].
 lane0: fire at (box4-28, cy - (24+(box3-box1)/2)) dir270 up, spd b_speed[0]*mod
 lane1: fire at (box4,    cy + (24+(box3-box1)/2)) dir90  down, spd b_speed[1]*mod
 lane2: fire at (box4+28, cy - (24+(box3-box1)/2)) dir270 up, spd b_speed[2]*mod
 all obj_pinkcatbullet mode2 (float wobble lengthdir_x(0.25,float_dir+=10)), scale2, image_speed=choose(0,0,0,0,0.02,0.04,0,0.334,0.5,1,0,0,0). off-box (life>=30, y<box1||y>box3): alpha-=0.05*spd.

## TYPE 205 — Vertical lanes variant (mode 5; box *1.125x *1.5y, y_ongrid-=80; turntimer 300)
4 stationary corner cat markers (obj_pinkcatbullet spd0 destroyonhit0 scale2) at (box4±63,box1+6),(box4±63,box3-6).
b_interval=[4,5,18], b_number=[2,2,1], b_break=[-20,-24,-12], b_speed=[5.4,4.4,3.4]. pattern_speed_modifier=1 const. Same 3-column fire logic as 204.

## TYPE 203 — Bombs (mode 2; thrower mode 5; box y+=32; thrower at box.x+200,box.y-32, spr_pink_idle image_speed 0.334)
Chart = [cmd, interval] pairs. Timing: turntimer=50; per pair turntimer += round(0.5+45*interval). Consume: while btimer>=btimer_start, btimer -= round(0.5+45*interval), exec cmd, delete 2. stop size<2.
 case0(19): [0,1.05][0,0][0,1.05][0,0][0,0.98][0,0][0,0][0,1.1][0,0][0,0][0,0.98][0,0][0,0][0,0.97][0,0][0,0][0,0][0,1.25][1,0]
 case1(12): [0,0.85][0,0.7][0,0.6][0,0.6][0,0][0,0.8][0,0][0,0.65][0,0][0,0][0,1.25][1,0]
 case2(5):  [3,1.25][3,1.25][3,1.25][3,1.5][4,3]
 case3(19): [0,0][0,1.05][0,0][0,0][0,1.05][0,0][0,0][0,1.05][0,0][0,0][0,1][0,0][0,0][0,0.975][0,0][0,0][0,0.875][2,1.5][1,0]
 case4(13): [0,0.85][0,0.7][0,0.6][0,0.6][0,0][0,0.8][0,0][0,0.65][0,0][0,0][0,0.9][2,1.5][1,0]
cmd: 0=queue small doki fusebomb (ammo_doki++), 1=Pink laughs (spr_pink_laugh, no bomb), 2=queue giant bomb, 3=volley of 4 (one giant-heart '4' among three '2', layout via irandom(3)+list_bomb_xy), 4=queue finale giant (wave-spin).
Thrower mode5 throw: value0 small obj_fusebomb fuse=(55+ammo*2)-repeat*2 mode1 from (x-4,y-88); value1 giant obj_fusebomb_big fuse60 mode0; value2/4 med fuse=52+ammo*3 warn28 mode0 (4=has_heart); value3 finale big fuse120 mode1 at box center y-136 then phase3 wave (wave_speed=choose(3.85,4.725,5.15,5.95) orbit lengthdir 96/6 around box4+198,box5+34). grid->px: (cx-60)+gx*40,(cy-60)+gy*40. lane 40px.

## TYPE 206 — Bomb grid walk (mode 2; lane_x0 lane_y3; turntimer 240; NO chart)
grid_x=3,grid_y=0. When btimer>=6: obj_fusebomb at (cx-60)+gx*40,(cy-60)+gy*40 fuse60 mode2 active1. lane 40.
grid walk: 50/50 gx+=(-2+irandom4)&gy+=choose(-2,-1,1,2) else swapped; wrap 0-3. phase++. btimer decel: phase<2->-35,<4->-25,<6->-18,<8->-11,<9->-8,<12->-6,else->-99(end).

Common: type200 speed=8*qspeed*4/3; interval->frames round(0.5+13*interval/1.25). type203 round(0.5+45*interval). obj_pinkcatbullet: image_speed 0.334, scale 2, spin_dir=movement spiral NOT rotation.
