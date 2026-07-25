/**
 * GML Asset Database — Maps GML sprite names to exported PNG frame files.
 */
(function(global) {
  'use strict';

  class GMLAssetDatabase {
    constructor() {
      this.sprites = {};
      this.loadedCount = 0;
      this.totalRequested = 0;
      this.failedCount = 0;
      this._init();
    }

    _init() {
      this.spriteFiles = {
  "spr_sunbolt": [
    "spr_sunbolt_0.png"
  ],
  "spr_whitepixel": [
    "spr_whitepixel_0.png"
  ],
  "spr_bullet_knightcrescent": [
    "spr_bullet_knightcrescent_0.png",
    "spr_bullet_knightcrescent_hitbox_0.png",
    "spr_bullet_knightcrescent_hitbox_old_0.png"
  ],
  "spr_roaringknight_idle": [
    "spr_roaringknight_idle_0.png",
    "spr_roaringknight_idle_overworld_0.png",
    "spr_roaringknight_idle_overworld_sword_0.png"
  ],
  "spr_roaringknight_hurt": [
    "spr_roaringknight_hurt_0.png",
    "spr_roaringknight_hurt_1.png",
    "spr_roaringknight_hurt_2.png"
  ],
  "spr_susier_dark_unhappy": [
    "spr_susier_dark_unhappy_0.png",
    "spr_susier_dark_unhappy_1.png",
    "spr_susier_dark_unhappy_2.png",
    "spr_susier_dark_unhappy_3.png"
  ],
  "spr_susieb_idle_serious": [
    "spr_susieb_idle_serious_0.png",
    "spr_susieb_idle_serious_1.png",
    "spr_susieb_idle_serious_2.png",
    "spr_susieb_idle_serious_3.png"
  ],
  "spr_susieb_defend_unhappy": [
    "spr_susieb_defend_unhappy_0.png",
    "spr_susieb_defend_unhappy_1.png",
    "spr_susieb_defend_unhappy_2.png",
    "spr_susieb_defend_unhappy_3.png",
    "spr_susieb_defend_unhappy_4.png",
    "spr_susieb_defend_unhappy_5.png"
  ],
  "spr_susieb_actready": [
    "spr_susieb_actready_0.png"
  ],
  "spr_susieb_attack_serious": [
    "spr_susieb_attack_serious_0.png",
    "spr_susieb_attack_serious_1.png",
    "spr_susieb_attack_serious_2.png",
    "spr_susieb_attack_serious_3.png",
    "spr_susieb_attack_serious_4.png",
    "spr_susieb_attack_serious_5.png"
  ],
  "spr_susieb_idle_unarmed_unhappy": [
    "spr_susieb_idle_unarmed_unhappy_0.png",
    "spr_susieb_idle_unarmed_unhappy_1.png",
    "spr_susieb_idle_unarmed_unhappy_2.png",
    "spr_susieb_idle_unarmed_unhappy_3.png"
  ],
  "spr_susieb_item_unhappy": [
    "spr_susieb_item_unhappy_0.png",
    "spr_susieb_item_unhappy_1.png",
    "spr_susieb_item_unhappy_2.png",
    "spr_susieb_item_unhappy_3.png",
    "spr_susieb_item_unhappy_4.png"
  ],
  "spr_susieb_itemready_unhappy": [
    "spr_susieb_itemready_unhappy_0.png",
    "spr_susieb_itemready_unhappy_1.png"
  ],
  "spr_susieb_spellready_unhappy": [
    "spr_susieb_spellready_unhappy_0.png",
    "spr_susieb_spellready_unhappy_1.png",
    "spr_susieb_spellready_unhappy_2.png",
    "spr_susieb_spellready_unhappy_3.png"
  ],
  "spr_susieb_spell_unhappy": [
    "spr_susieb_spell_unhappy_0.png",
    "spr_susieb_spell_unhappy_1.png",
    "spr_susieb_spell_unhappy_2.png",
    "spr_susieb_spell_unhappy_3.png",
    "spr_susieb_spell_unhappy_4.png",
    "spr_susieb_spell_unhappy_5.png",
    "spr_susieb_spell_unhappy_6.png",
    "spr_susieb_spell_unhappy_7.png",
    "spr_susieb_spell_unhappy_8.png"
  ],
  "spr_susie_dw_fell": [
    "spr_susie_dw_fell_0.png",
    "spr_susie_dw_fell_grab_0.png",
    "spr_susie_dw_fell_grab_hand_0.png",
    "spr_susie_dw_fell_grab_no_hand_0.png"
  ],
  "spr_roaringknight_block_ol": [
    "spr_roaringknight_block_ol_0.png"
  ],
  "spr_roaringknight_block_vfx": [
    "spr_roaringknight_block_vfx_0.png",
    "spr_roaringknight_block_vfx_1.png",
    "spr_roaringknight_block_vfx_2.png",
    "spr_roaringknight_block_vfx_3.png",
    "spr_roaringknight_block_vfx_4.png",
    "spr_roaringknight_block_vfx_5.png",
    "spr_roaringknight_block_vfx_6.png"
  ],
  "spr_roaringknight_ball_transition": [
    "spr_roaringknight_ball_transition_0.png",
    "spr_roaringknight_ball_transition_1.png",
    "spr_roaringknight_ball_transition_2.png",
    "spr_roaringknight_ball_transition_3.png",
    "spr_roaringknight_ball_transition_4.png",
    "spr_roaringknight_ball_transition_5.png",
    "spr_roaringknight_ball_transition_6.png",
    "spr_roaringknight_ball_transition_7.png",
    "spr_roaringknight_ball_transition_8.png",
    "spr_roaringknight_ball_transition_9.png",
    "spr_roaringknight_ball_transition_sword_0.png",
    "spr_roaringknight_ball_transition_sword_1.png",
    "spr_roaringknight_ball_transition_sword_2.png",
    "spr_roaringknight_ball_transition_sword_3.png",
    "spr_roaringknight_ball_transition_sword_4.png",
    "spr_roaringknight_ball_transition_sword_5.png",
    "spr_roaringknight_ball_transition_sword_6.png",
    "spr_roaringknight_ball_transition_sword_7.png",
    "spr_roaringknight_ball_transition_sword_8.png"
  ],
  "spr_knight_bullet_flow": [
    "spr_knight_bullet_flow_0.png",
    "spr_knight_bullet_flow_1.png",
    "spr_knight_bullet_flow_2.png"
  ],
  "spr_knight_line_grate": [
    "spr_knight_line_grate_0.png"
  ],
  "spr_knight_starchild_parts": [
    "spr_knight_starchild_parts_0.png",
    "spr_knight_starchild_parts_1.png"
  ],
  "spr_thrash_missile_explosion": [
    "spr_thrash_missile_explosion_0.png",
    "spr_thrash_missile_explosion_1.png",
    "spr_thrash_missile_explosion_2.png",
    "spr_thrash_missile_explosion_3.png"
  ],
  "spr_knight_bullet_star_mask": [
    "spr_knight_bullet_star_mask_0.png"
  ],
  "spr_knight_bullet_star_easy": [
    "spr_knight_bullet_star_easy_0.png",
    "spr_knight_bullet_star_easy_1.png",
    "spr_knight_bullet_star_easy_2.png"
  ],
  "spr_knight_starchild_trail": [
    "spr_knight_starchild_trail_0.png",
    "spr_knight_starchild_trail_1.png"
  ],
  "spr_roaringknight_front_filled": [
    "spr_roaringknight_front_filled_0.png"
  ],
  "spr_pixel_white_front": [
    "spr_pixel_white_front_0.png"
  ],
  "spr_knight_bullet_star": [
    "spr_knight_bullet_star_0.png",
    "spr_knight_bullet_star_1.png",
    "spr_knight_bullet_star_2.png",
    "spr_knight_bullet_star_bottom_0.png",
    "spr_knight_bullet_star_bottom_1.png",
    "spr_knight_bullet_star_bottom_2.png",
    "spr_knight_bullet_star_easy_0.png",
    "spr_knight_bullet_star_easy_1.png",
    "spr_knight_bullet_star_easy_2.png",
    "spr_knight_bullet_star_hard_a_0.png",
    "spr_knight_bullet_star_hard_a_1.png",
    "spr_knight_bullet_star_hard_a_2.png",
    "spr_knight_bullet_star_hard_b_0.png",
    "spr_knight_bullet_star_hard_b_1.png",
    "spr_knight_bullet_star_hard_b_2.png",
    "spr_knight_bullet_star_mask_0.png",
    "spr_knight_bullet_star_top_0.png",
    "spr_knight_bullet_star_top_1.png",
    "spr_knight_bullet_star_top_2.png"
  ],
  "spr_roaringknight_front_roar": [
    "spr_roaringknight_front_roar_0.png",
    "spr_roaringknight_front_roar_1.png"
  ],
  "spr_roaringknight_front_flourish": [
    "spr_roaringknight_front_flourish_0.png",
    "spr_roaringknight_front_flourish_1.png",
    "spr_roaringknight_front_flourish_2.png",
    "spr_roaringknight_front_flourish_3.png",
    "spr_roaringknight_front_flourish_4.png",
    "spr_roaringknight_front_flourish_5.png",
    "spr_roaringknight_front_flourish_6.png"
  ],
  "spr_roaringknight_front_slash": [
    "spr_roaringknight_front_slash_0.png",
    "spr_roaringknight_front_slash_1.png",
    "spr_roaringknight_front_slash_2.png",
    "spr_roaringknight_front_slash_3.png",
    "spr_roaringknight_front_slash_4.png",
    "spr_roaringknight_front_slash_5.png"
  ],
  "spr_knight_warp": [
    "spr_knight_warp_0.png",
    "spr_knight_warp_1.png",
    "spr_knight_warp_2.png",
    "spr_knight_warp_3.png",
    "spr_knight_warp_4.png",
    "spr_knight_warp_5.png",
    "spr_knight_warp_6.png",
    "spr_knight_warp_7.png",
    "spr_knight_warp_8.png"
  ],
  "spr_rk_quickslash_marker_gradient": [
    "spr_rk_quickslash_marker_gradient_0.png",
    "spr_rk_quickslash_marker_gradient_1.png"
  ],
  "spr_rk_quickslash_marker": [
    "spr_rk_quickslash_marker_0.png",
    "spr_rk_quickslash_marker_1.png",
    "spr_rk_quickslash_marker_2.png",
    "spr_rk_quickslash_marker_3.png",
    "spr_rk_quickslash_marker_gradient_0.png",
    "spr_rk_quickslash_marker_gradient_1.png"
  ],
  "spr_roaringknight_shift_ol": [
    "spr_roaringknight_shift_ol_0.png",
    "spr_roaringknight_shift_ol_1.png",
    "spr_roaringknight_shift_ol_2.png"
  ],
  "spr_roaringknight_pose_ol": [
    "spr_roaringknight_pose_ol_0.png",
    "spr_roaringknight_pose_ol_1.png"
  ],
  "spr_roaring_fire2": [
    "spr_roaring_fire2_0.png",
    "spr_roaring_fire2_1.png",
    "spr_roaring_fire2_2.png",
    "spr_roaring_fire2_3.png"
  ],
  "spr_knight_bullet_star_top": [
    "spr_knight_bullet_star_top_0.png",
    "spr_knight_bullet_star_top_1.png",
    "spr_knight_bullet_star_top_2.png"
  ],
  "spr_roaringknight_flurry_prepare": [
    "spr_roaringknight_flurry_prepare_0.png"
  ],
  "spr_knight_slash_mark": [
    "spr_knight_slash_mark_0.png"
  ],
  "spr_roaringknight_flurry": [
    "spr_roaringknight_flurry_0.png",
    "spr_roaringknight_flurry_1.png",
    "spr_roaringknight_flurry_2.png",
    "spr_roaringknight_flurry_prepare_0.png"
  ],
  "spr_roaringknight_crescentbeam_halved": [
    "spr_roaringknight_crescentbeam_halved_0.png"
  ],
  "spr_rk_split_flame_big": [
    "spr_rk_split_flame_big_0.png",
    "spr_rk_split_flame_big_1.png",
    "spr_rk_split_flame_big_2.png",
    "spr_rk_split_flame_big_3.png",
    "spr_rk_split_flame_big_4.png",
    "spr_rk_split_flame_big_5.png"
  ],
  "spr_rk_split_flame_edge": [
    "spr_rk_split_flame_edge_0.png",
    "spr_rk_split_flame_edge_1.png",
    "spr_rk_split_flame_edge_2.png",
    "spr_rk_split_flame_edge_3.png",
    "spr_rk_split_flame_edge_4.png"
  ],
  "spr_nothing": [
    "spr_nothing_0.png"
  ],
  "spr_roaringknight_sword_ol": [
    "spr_roaringknight_sword_ol_0.png"
  ],
  "spr_roaringknight_attack_ol_center": [
    "spr_roaringknight_attack_ol_center_0.png",
    "spr_roaringknight_attack_ol_center_1.png",
    "spr_roaringknight_attack_ol_center_2.png",
    "spr_roaringknight_attack_ol_center_3.png",
    "spr_roaringknight_attack_ol_center_4.png",
    "spr_roaringknight_attack_ol_center_5.png"
  ],
  "spr_roaringknight_point_ol": [
    "spr_roaringknight_point_ol_0.png",
    "spr_roaringknight_point_ol_1.png",
    "spr_roaringknight_point_ol_2.png",
    "spr_roaringknight_point_ol_3.png",
    "spr_roaringknight_point_ol_4.png"
  ],
  "spr_roaringknight_ball_transition_sword": [
    "spr_roaringknight_ball_transition_sword_0.png",
    "spr_roaringknight_ball_transition_sword_1.png",
    "spr_roaringknight_ball_transition_sword_2.png",
    "spr_roaringknight_ball_transition_sword_3.png",
    "spr_roaringknight_ball_transition_sword_4.png",
    "spr_roaringknight_ball_transition_sword_5.png",
    "spr_roaringknight_ball_transition_sword_6.png",
    "spr_roaringknight_ball_transition_sword_7.png",
    "spr_roaringknight_ball_transition_sword_8.png"
  ],
  "spr_roaringknight_noarm": [
    "spr_roaringknight_noarm_0.png"
  ],
  "spr_knight_diamondbullet_m": [
    "spr_knight_diamondbullet_m_0.png",
    "spr_knight_diamondbullet_m_1.png",
    "spr_knight_diamondbullet_m_2.png"
  ],
  "spr_knight_diamondbullet_l": [
    "spr_knight_diamondbullet_l_0.png",
    "spr_knight_diamondbullet_l_1.png",
    "spr_knight_diamondbullet_l_2.png"
  ],
  "spr_roaringknight_armpoint": [
    "spr_roaringknight_armpoint_0.png",
    "spr_roaringknight_armpoint_1.png"
  ],
  "spr_roaringknight_slash_tunnel": [
    "spr_roaringknight_slash_tunnel_0.png"
  ],
  "spr_pxwhite10_center": [
    "spr_pxwhite10_center_0.png"
  ],
  "spr_rk_quickslash": [
    "spr_rk_quickslash_0.png",
    "spr_rk_quickslash_1.png",
    "spr_rk_quickslash_2.png",
    "spr_rk_quickslash_3.png",
    "spr_rk_quickslash_lower_0.png",
    "spr_rk_quickslash_lower_1.png",
    "spr_rk_quickslash_lower_2.png",
    "spr_rk_quickslash_lower_3.png",
    "spr_rk_quickslash_marker_0.png",
    "spr_rk_quickslash_marker_1.png",
    "spr_rk_quickslash_marker_2.png",
    "spr_rk_quickslash_marker_3.png",
    "spr_rk_quickslash_marker_gradient_0.png",
    "spr_rk_quickslash_marker_gradient_1.png",
    "spr_rk_quickslash_upper_0.png",
    "spr_rk_quickslash_upper_1.png",
    "spr_rk_quickslash_upper_2.png",
    "spr_rk_quickslash_upper_3.png"
  ],
  "spr_rk_slash_heartslice": [
    "spr_rk_slash_heartslice_0.png",
    "spr_rk_slash_heartslice_1.png",
    "spr_rk_slash_heartslice_10.png",
    "spr_rk_slash_heartslice_11.png",
    "spr_rk_slash_heartslice_12.png",
    "spr_rk_slash_heartslice_13.png",
    "spr_rk_slash_heartslice_14.png",
    "spr_rk_slash_heartslice_15.png",
    "spr_rk_slash_heartslice_16.png",
    "spr_rk_slash_heartslice_17.png",
    "spr_rk_slash_heartslice_2.png",
    "spr_rk_slash_heartslice_3.png",
    "spr_rk_slash_heartslice_4.png",
    "spr_rk_slash_heartslice_5.png",
    "spr_rk_slash_heartslice_6.png",
    "spr_rk_slash_heartslice_7.png",
    "spr_rk_slash_heartslice_8.png",
    "spr_rk_slash_heartslice_9.png"
  ],
  "spr_rk_quickslash_upper": [
    "spr_rk_quickslash_upper_0.png",
    "spr_rk_quickslash_upper_1.png",
    "spr_rk_quickslash_upper_2.png",
    "spr_rk_quickslash_upper_3.png"
  ],
  "spr_gerson_swing": [
    "spr_gerson_swing_0.png",
    "spr_gerson_swing_1.png",
    "spr_gerson_swing_2.png",
    "spr_gerson_swing_3.png",
    "spr_gerson_swing_4.png",
    "spr_gerson_swing_5.png",
    "spr_gerson_swing_6.png",
    "spr_gerson_swing_down_0.png",
    "spr_gerson_swing_down_1.png",
    "spr_gerson_swing_down_2.png",
    "spr_gerson_swing_down_3.png",
    "spr_gerson_swing_down_loop_0.png",
    "spr_gerson_swing_down_loop_1.png",
    "spr_gerson_swing_down_loop_new_0.png",
    "spr_gerson_swing_down_loop_new_1.png",
    "spr_gerson_swing_down_mask_0.png",
    "spr_gerson_swing_down_new_0.png",
    "spr_gerson_swing_down_new_1.png",
    "spr_gerson_swing_down_new_2.png",
    "spr_gerson_swing_down_new_3.png",
    "spr_gerson_swing_down_new_4.png",
    "spr_gerson_swing_down_telegraph25912_0.png",
    "spr_gerson_swing_down_telegraph2_0.png",
    "spr_gerson_swing_down_telegraph3_0.png",
    "spr_gerson_swing_down_telegraph4_0.png",
    "spr_gerson_swing_down_telegraph_0.png",
    "spr_gerson_swing_outline_0.png",
    "spr_gerson_swing_side_0.png",
    "spr_gerson_swing_side_1.png",
    "spr_gerson_swing_side_2.png",
    "spr_gerson_swing_side_old_0.png",
    "spr_gerson_swing_side_old_1.png",
    "spr_gerson_swing_side_old_2.png",
    "spr_gerson_swing_side_outline_0.png"
  ],
  "spr_heart": [
    "spr_heart_0.png",
    "spr_heart_1.png",
    "spr_heart_centered_0.png",
    "spr_heart_harrows_0.png",
    "spr_heart_harrows_1.png",
    "spr_heart_harrows_2.png",
    "spr_heart_harrows_3.png",
    "spr_heart_outline2_0.png",
    "spr_heart_outline2_1.png",
    "spr_heart_segmented_0.png",
    "spr_heart_segmented_1.png",
    "spr_heart_segmented_2.png",
    "spr_heart_segmented_3.png"
  ],
  "spr_gerson_swing_down_telegraph3": [
    "spr_gerson_swing_down_telegraph3_0.png"
  ],
  "spr_gerson_swing_down_telegraph2": [
    "spr_gerson_swing_down_telegraph2_0.png"
  ],
  "spr_gerson_box_hit_fx1": [
    "spr_gerson_box_hit_fx1_0.png",
    "spr_gerson_box_hit_fx1_1.png",
    "spr_gerson_box_hit_fx1_2.png",
    "spr_gerson_box_hit_fx1_3.png",
    "spr_gerson_box_hit_fx1_4.png",
    "spr_gerson_box_hit_fx1_5.png"
  ],
  "spr_gerson_item_steal2": [
    "spr_gerson_item_steal2_0.png",
    "spr_gerson_item_steal2_1.png",
    "spr_gerson_item_steal2_2.png"
  ],
  "spr_gerson_smear": [
    "spr_gerson_smear_0.png",
    "spr_gerson_smear_1.png",
    "spr_gerson_smear_2.png",
    "spr_gerson_smear_battle_ready_0.png",
    "spr_gerson_smear_battle_ready_1.png"
  ],
  "spr_gerson_laugh": [
    "spr_gerson_laugh_0.png",
    "spr_gerson_laugh_1.png",
    "spr_gerson_laugh_2.png",
    "spr_gerson_laugh_scene_0.png",
    "spr_gerson_laugh_scene_1.png",
    "spr_gerson_laugh_scene_2.png"
  ],
  "spr_sneo_bigcircle": [
    "spr_sneo_bigcircle_0.png"
  ],
  "spr_susie_hitback_miss": [
    "spr_susie_hitback_miss_0.png",
    "spr_susie_hitback_miss_1.png",
    "spr_susie_hitback_miss_2.png",
    "spr_susie_hitback_miss_3.png",
    "spr_susie_hitback_miss_4.png"
  ],
  "spr_susie_hitback": [
    "spr_susie_hitback_0.png",
    "spr_susie_hitback_1.png",
    "spr_susie_hitback_10.png",
    "spr_susie_hitback_11.png",
    "spr_susie_hitback_12.png",
    "spr_susie_hitback_13.png",
    "spr_susie_hitback_14.png",
    "spr_susie_hitback_2.png",
    "spr_susie_hitback_3.png",
    "spr_susie_hitback_4.png",
    "spr_susie_hitback_5.png",
    "spr_susie_hitback_6.png",
    "spr_susie_hitback_7.png",
    "spr_susie_hitback_8.png",
    "spr_susie_hitback_9.png",
    "spr_susie_hitback_in_place_0.png",
    "spr_susie_hitback_in_place_1.png",
    "spr_susie_hitback_in_place_10.png",
    "spr_susie_hitback_in_place_11.png",
    "spr_susie_hitback_in_place_12.png",
    "spr_susie_hitback_in_place_13.png",
    "spr_susie_hitback_in_place_14.png",
    "spr_susie_hitback_in_place_2.png",
    "spr_susie_hitback_in_place_3.png",
    "spr_susie_hitback_in_place_4.png",
    "spr_susie_hitback_in_place_5.png",
    "spr_susie_hitback_in_place_6.png",
    "spr_susie_hitback_in_place_7.png",
    "spr_susie_hitback_in_place_8.png",
    "spr_susie_hitback_in_place_9.png",
    "spr_susie_hitback_in_place_miss_0.png",
    "spr_susie_hitback_in_place_miss_1.png",
    "spr_susie_hitback_in_place_miss_2.png",
    "spr_susie_hitback_in_place_miss_3.png",
    "spr_susie_hitback_in_place_miss_4.png",
    "spr_susie_hitback_miss_0.png",
    "spr_susie_hitback_miss_1.png",
    "spr_susie_hitback_miss_2.png",
    "spr_susie_hitback_miss_3.png",
    "spr_susie_hitback_miss_4.png"
  ],
  "spr_gerson_hit_fx4": [
    "spr_gerson_hit_fx4_0.png",
    "spr_gerson_hit_fx4_1.png",
    "spr_gerson_hit_fx4_2.png",
    "spr_gerson_hit_fx4_3.png"
  ],
  "spr_susie_gerson_hitbback_fx_1": [
    "spr_susie_gerson_hitbback_fx_1_0.png",
    "spr_susie_gerson_hitbback_fx_1_1.png",
    "spr_susie_gerson_hitbback_fx_1_2.png",
    "spr_susie_gerson_hitbback_fx_1_3.png",
    "spr_susie_gerson_hitbback_fx_1_4.png"
  ],
  "spr_susie_gerson_hitbback_fx_2": [
    "spr_susie_gerson_hitbback_fx_2_0.png",
    "spr_susie_gerson_hitbback_fx_2_1.png",
    "spr_susie_gerson_hitbback_fx_2_2.png",
    "spr_susie_gerson_hitbback_fx_2_3.png",
    "spr_susie_gerson_hitbback_fx_2_4.png",
    "spr_susie_gerson_hitbback_fx_2_white_0.png",
    "spr_susie_gerson_hitbback_fx_2_white_1.png",
    "spr_susie_gerson_hitbback_fx_2_white_2.png",
    "spr_susie_gerson_hitbback_fx_2_white_3.png",
    "spr_susie_gerson_hitbback_fx_2_white_4.png"
  ],
  "spr_susieb_hurt": [
    "spr_susieb_hurt_0.png"
  ],
  "spr_gerson_rude_orb2": [
    "spr_gerson_rude_orb2_0.png"
  ],
  "spr_thrash_star": [
    "spr_thrash_star_0.png"
  ],
  "spr_finisher_explosion": [
    "spr_finisher_explosion_0.png",
    "spr_finisher_explosion_1.png",
    "spr_finisher_explosion_2.png",
    "spr_finisher_explosion_3.png",
    "spr_finisher_explosion_4.png",
    "spr_finisher_explosion_5.png",
    "spr_finisher_explosion_6.png",
    "spr_finisher_explosion_flashy_0.png",
    "spr_finisher_explosion_flashy_1.png",
    "spr_finisher_explosion_flashy_2.png",
    "spr_finisher_explosion_flashy_3.png",
    "spr_finisher_explosion_flashy_4.png",
    "spr_finisher_explosion_flashy_5.png",
    "spr_finisher_explosion_flashy_6.png",
    "spr_finisher_explosion_flashy_7.png",
    "spr_finisher_explosion_quick_0.png",
    "spr_finisher_explosion_quick_1.png",
    "spr_finisher_explosion_quick_2.png",
    "spr_finisher_explosion_quick_3.png",
    "spr_finisher_explosion_quick_4.png"
  ],
  "spr_launchsmoke": [
    "spr_launchsmoke_0.png"
  ],
  "spr_gerson_star7": [
    "spr_gerson_star7_0.png"
  ],
  "spr_gerson_swing_down_new": [
    "spr_gerson_swing_down_new_0.png",
    "spr_gerson_swing_down_new_1.png",
    "spr_gerson_swing_down_new_2.png",
    "spr_gerson_swing_down_new_3.png",
    "spr_gerson_swing_down_new_4.png"
  ],
  "spr_blank_tile_black": [
    "spr_blank_tile_black_0.png"
  ],
  "spr_gerson_dodge_origin_top_bottom": [
    "spr_gerson_dodge_origin_top_bottom_0.png"
  ],
  "spr_gerson_swing_down": [
    "spr_gerson_swing_down_0.png",
    "spr_gerson_swing_down_1.png",
    "spr_gerson_swing_down_2.png",
    "spr_gerson_swing_down_3.png",
    "spr_gerson_swing_down_loop_0.png",
    "spr_gerson_swing_down_loop_1.png",
    "spr_gerson_swing_down_loop_new_0.png",
    "spr_gerson_swing_down_loop_new_1.png",
    "spr_gerson_swing_down_mask_0.png",
    "spr_gerson_swing_down_new_0.png",
    "spr_gerson_swing_down_new_1.png",
    "spr_gerson_swing_down_new_2.png",
    "spr_gerson_swing_down_new_3.png",
    "spr_gerson_swing_down_new_4.png",
    "spr_gerson_swing_down_telegraph25912_0.png",
    "spr_gerson_swing_down_telegraph2_0.png",
    "spr_gerson_swing_down_telegraph3_0.png",
    "spr_gerson_swing_down_telegraph4_0.png",
    "spr_gerson_swing_down_telegraph_0.png"
  ],
  "spr_gerson_swing_down_loop": [
    "spr_gerson_swing_down_loop_0.png",
    "spr_gerson_swing_down_loop_1.png",
    "spr_gerson_swing_down_loop_new_0.png",
    "spr_gerson_swing_down_loop_new_1.png"
  ],
  "spr_gerson_swing_down_loop_new": [
    "spr_gerson_swing_down_loop_new_0.png",
    "spr_gerson_swing_down_loop_new_1.png"
  ],
  "spr_gerson_swing_down_telegraph4": [
    "spr_gerson_swing_down_telegraph4_0.png"
  ],
  "spr_gerson_teleport": [
    "spr_gerson_teleport_0.png",
    "spr_gerson_teleport_1.png",
    "spr_gerson_teleport_2.png",
    "spr_gerson_teleport_3.png",
    "spr_gerson_teleport_4.png",
    "spr_gerson_teleport_5.png",
    "spr_gerson_teleport_6.png"
  ],
  "spr_sneo_laser": [
    "spr_sneo_laser_0.png",
    "spr_sneo_laser_friendly_0.png"
  ],
  "spr_sneo_bigshot_l": [
    "spr_sneo_bigshot_l_0.png",
    "spr_sneo_bigshot_l_1.png",
    "spr_sneo_bigshot_l_2.png"
  ],
  "spr_pixel_white": [
    "spr_pixel_white_0.png",
    "spr_pixel_white_front_0.png"
  ],
  "spr_sneo_electric_orb_destroy": [
    "spr_sneo_electric_orb_destroy_0.png",
    "spr_sneo_electric_orb_destroy_1.png",
    "spr_sneo_electric_orb_destroy_2.png",
    "spr_sneo_electric_orb_destroy_3.png",
    "spr_sneo_electric_orb_destroy_4.png",
    "spr_sneo_electric_orb_destroy_5.png"
  ],
  "spr_diamondbullet": [
    "spr_diamondbullet_0.png",
    "spr_diamondbullet_form_0.png",
    "spr_diamondbullet_fullmask_0.png",
    "spr_diamondbullet_vert_0.png"
  ],
  "spr_spamton_dollar": [
    "spr_spamton_dollar_0.png"
  ],
  "spr_sneo_pillar_thick": [
    "spr_sneo_pillar_thick_0.png"
  ],
  "spr_sneo_pillar_piston": [
    "spr_sneo_pillar_piston_0.png"
  ],
  "spr_sneo_pillar_head_top": [
    "spr_sneo_pillar_head_top_0.png",
    "spr_sneo_pillar_head_top_1.png",
    "spr_sneo_pillar_head_top_2.png",
    "spr_sneo_pillar_head_top_3.png"
  ],
  "spr_sneo_pillar_head_bottom": [
    "spr_sneo_pillar_head_bottom_0.png",
    "spr_sneo_pillar_head_bottom_1.png",
    "spr_sneo_pillar_head_bottom_2.png",
    "spr_sneo_pillar_head_bottom_3.png"
  ],
  "spr_sneo_bomb": [
    "spr_sneo_bomb_0.png",
    "spr_sneo_bomb_1.png"
  ],
  "spr_yheart_shot_hit3": [
    "spr_yheart_shot_hit3_0.png",
    "spr_yheart_shot_hit3_1.png",
    "spr_yheart_shot_hit3_2.png",
    "spr_yheart_shot_hit3_3.png",
    "spr_yheart_shot_hit3_4.png"
  ],
  "spr_sneo_electric_orb_idle": [
    "spr_sneo_electric_orb_idle_0.png",
    "spr_sneo_electric_orb_idle_1.png",
    "spr_sneo_electric_orb_idle_2.png",
    "spr_sneo_electric_orb_idle_3.png",
    "spr_sneo_electric_orb_idle_4.png",
    "spr_sneo_electric_orb_idle_5.png"
  ],
  "spr_sneo_elevator_buttonb": [
    "spr_sneo_elevator_buttonb_0.png"
  ],
  "spr_spamtonneo_faceAttack_face": [
    "spr_spamtonneo_faceAttack_face_0.png"
  ],
  "spr_spamtonneo_faceAttack_eyes": [
    "spr_spamtonneo_faceAttack_eyes_0.png",
    "spr_spamtonneo_faceAttack_eyes_1.png",
    "spr_spamtonneo_faceAttack_eyes_2.png"
  ],
  "spr_spamtonneo_faceAttack_nose": [
    "spr_spamtonneo_faceAttack_nose_0.png",
    "spr_spamtonneo_faceAttack_nose_1.png",
    "spr_spamtonneo_faceAttack_nose_2.png",
    "spr_spamtonneo_faceAttack_nose_bullet_0.png",
    "spr_spamtonneo_faceAttack_nose_bullet_mask_0.png"
  ],
  "spr_spamtonneo_faceAttack_mouth": [
    "spr_spamtonneo_faceAttack_mouth_0.png",
    "spr_spamtonneo_faceAttack_mouth_1.png",
    "spr_spamtonneo_faceAttack_mouth_2.png",
    "spr_spamtonneo_faceAttack_mouth_3.png",
    "spr_spamtonneo_faceAttack_mouth_4.png"
  ],
  "spr_spamtonneo_faceAttack_nose_bullet": [
    "spr_spamtonneo_faceAttack_nose_bullet_0.png",
    "spr_spamtonneo_faceAttack_nose_bullet_mask_0.png"
  ],
  "spr_spamtonneo_faceAttack_nose_bullet_mask": [
    "spr_spamtonneo_faceAttack_nose_bullet_mask_0.png"
  ],
  "spr_spamtonneo_faceAttack_wisp": [
    "spr_spamtonneo_faceAttack_wisp_0.png"
  ],
  "spr_battlebg_0": [
    "spr_battlebg_0_0.png",
    "spr_battlebg_0_1.png"
  ],
  "spr_sneo_playback": [
    "spr_sneo_playback_0.png",
    "spr_sneo_playback_1.png",
    "spr_sneo_playback_2.png"
  ],
  "spr_sneo_final_forme_head_rotate_origin": [
    "spr_sneo_final_forme_head_rotate_origin_0.png"
  ],
  "spr_sneo_bullet0": [
    "spr_sneo_bullet0_0.png"
  ],
  "spr_sneo_head_heartattack": [
    "spr_sneo_head_heartattack_0.png"
  ],
  "spr_sneo_body_chest_breaks": [
    "spr_sneo_body_chest_breaks_0.png",
    "spr_sneo_body_chest_breaks_piece_0.png",
    "spr_sneo_body_chest_breaks_piece_1.png",
    "spr_sneo_body_chest_breaks_piece_2.png",
    "spr_sneo_body_chest_breaks_piece_3.png"
  ],
  "spr_sneo_body": [
    "spr_sneo_body_0.png",
    "spr_sneo_body_chest_breaks_0.png",
    "spr_sneo_body_chest_breaks_piece_0.png",
    "spr_sneo_body_chest_breaks_piece_1.png",
    "spr_sneo_body_chest_breaks_piece_2.png",
    "spr_sneo_body_chest_breaks_piece_3.png"
  ],
  "spr_sneo_head": [
    "spr_sneo_head_0.png",
    "spr_sneo_head_1.png",
    "spr_sneo_head_2.png",
    "spr_sneo_head_3.png",
    "spr_sneo_head_blue_0.png",
    "spr_sneo_head_heartattack_0.png",
    "spr_sneo_head_joke_0.png",
    "spr_sneo_head_open_0.png",
    "spr_sneo_head_open_blue_0.png",
    "spr_sneo_head_preview_0.png",
    "spr_sneo_head_preview_1.png",
    "spr_sneo_head_preview_2.png",
    "spr_sneo_head_preview_3.png",
    "spr_sneo_head_preview_4.png",
    "spr_sneo_head_preview_5.png",
    "spr_sneo_head_sad_0.png",
    "spr_sneo_head_sad_blue_0.png",
    "spr_sneo_head_sad_old_0.png",
    "spr_sneo_head_sad_old_1.png"
  ],
  "spr_lasergun_laser_telegraph": [
    "spr_lasergun_laser_telegraph_0.png",
    "spr_lasergun_laser_telegraph_mask_0.png"
  ],
  "spr_krisb_idle": [
    "spr_krisb_idle_0.png",
    "spr_krisb_idle_1.png",
    "spr_krisb_idle_2.png",
    "spr_krisb_idle_3.png",
    "spr_krisb_idle_4.png",
    "spr_krisb_idle_5.png"
  ],
  "spr_sneo_final_forme": [
    "spr_sneo_final_forme_0.png",
    "spr_sneo_final_forme_1.png",
    "spr_sneo_final_forme_2.png",
    "spr_sneo_final_forme_3.png",
    "spr_sneo_final_forme_4.png",
    "spr_sneo_final_forme_5.png",
    "spr_sneo_final_forme_6.png",
    "spr_sneo_final_forme_7.png",
    "spr_sneo_final_forme_head_rotate_origin_0.png",
    "spr_sneo_final_forme_hitbox_0.png"
  ],
  "spr_sneo_lastattack_head_top": [
    "spr_sneo_lastattack_head_top_0.png",
    "spr_sneo_lastattack_head_top_1.png"
  ],
  "spr_sneo_arml": [
    "spr_sneo_arml_0.png",
    "spr_sneo_arml_1.png",
    "spr_sneo_arml_2.png",
    "spr_sneo_arml_3.png",
    "spr_sneo_arml_4.png",
    "spr_sneo_arml_egg_0.png"
  ],
  "spr_sneo_wingl": [
    "spr_sneo_wingl_0.png"
  ],
  "spr_sneo_head_joke": [
    "spr_sneo_head_joke_0.png"
  ],
  "spr_sneo_head_open": [
    "spr_sneo_head_open_0.png",
    "spr_sneo_head_open_blue_0.png"
  ],
  "spr_sneo_soundbullet": [
    "spr_sneo_soundbullet_0.png"
  ],
  "spr_mettaton_bomb2": [
    "spr_mettaton_bomb2_0.png",
    "spr_mettaton_bomb2_1.png",
    "spr_mettaton_bomb2_2.png",
    "spr_mettaton_bomb2_3.png",
    "spr_mettaton_bomb2_4.png",
    "spr_mettaton_bomb2_5.png",
    "spr_mettaton_bomb2_6.png",
    "spr_mettaton_bomb2_7.png"
  ],
  "spr_mettaton_bomb3": [
    "spr_mettaton_bomb3_0.png",
    "spr_mettaton_bomb3_1.png",
    "spr_mettaton_bomb3_2.png",
    "spr_mettaton_bomb3_3.png",
    "spr_mettaton_bomb3_4.png",
    "spr_mettaton_bomb3_5.png",
    "spr_mettaton_bomb3_6.png",
    "spr_mettaton_bomb3_7.png"
  ],
  "spr_susieb_attack_unarmed": [
    "spr_susieb_attack_unarmed_0.png",
    "spr_susieb_attack_unarmed_1.png",
    "spr_susieb_attack_unarmed_2.png",
    "spr_susieb_attack_unarmed_3.png",
    "spr_susieb_attack_unarmed_4.png",
    "spr_susieb_attack_unarmed_5.png"
  ],
  "spr_werewire_throwarrow": [
    "spr_werewire_throwarrow_0.png"
  ],
  "spr_sneo_c_weakpoint_growth2": [
    "spr_sneo_c_weakpoint_growth2_0.png"
  ],
  "spr_sneo_crew": [
    "spr_sneo_crew_0.png",
    "spr_sneo_crew_1.png",
    "spr_sneo_crew_2.png",
    "spr_sneo_crew_3.png",
    "spr_sneo_crew_bullet_0.png",
    "spr_sneo_crew_dissolve_0.png",
    "spr_sneo_crew_dissolve_1.png",
    "spr_sneo_crew_dissolve_10.png",
    "spr_sneo_crew_dissolve_11.png",
    "spr_sneo_crew_dissolve_12.png",
    "spr_sneo_crew_dissolve_13.png",
    "spr_sneo_crew_dissolve_14.png",
    "spr_sneo_crew_dissolve_15.png",
    "spr_sneo_crew_dissolve_2.png",
    "spr_sneo_crew_dissolve_3.png",
    "spr_sneo_crew_dissolve_4.png",
    "spr_sneo_crew_dissolve_5.png",
    "spr_sneo_crew_dissolve_6.png",
    "spr_sneo_crew_dissolve_7.png",
    "spr_sneo_crew_dissolve_8.png",
    "spr_sneo_crew_dissolve_9.png",
    "spr_sneo_crew_ez_hitbox_0.png",
    "spr_sneo_crew_ez_hitbox_1.png",
    "spr_sneo_crew_ez_hitbox_2.png",
    "spr_sneo_crew_ez_hitbox_3.png"
  ],
  "spr_sneo_mail": [
    "spr_sneo_mail_0.png",
    "spr_sneo_mail_1.png",
    "spr_sneo_mail_old_0.png",
    "spr_sneo_mail_old_1.png"
  ],
  "spr_sneo_bullet_box": [
    "spr_sneo_bullet_box_0.png"
  ],
  "spr_sneo_wall_car": [
    "spr_sneo_wall_car_0.png"
  ],
  "spr_sneo_wall_track": [
    "spr_sneo_wall_track_0.png"
  ],
  "spr_sneo_crew_ez_hitbox": [
    "spr_sneo_crew_ez_hitbox_0.png",
    "spr_sneo_crew_ez_hitbox_1.png",
    "spr_sneo_crew_ez_hitbox_2.png",
    "spr_sneo_crew_ez_hitbox_3.png"
  ],
  "spr_sneo_wireheart_biter": [
    "spr_sneo_wireheart_biter_0.png",
    "spr_sneo_wireheart_biter_1.png",
    "spr_sneo_wireheart_biter_2.png",
    "spr_sneo_wireheart_biter_3.png",
    "spr_sneo_wireheart_biter_4.png"
  ],
  "spr_sneo_wireheart_bomb": [
    "spr_sneo_wireheart_bomb_0.png",
    "spr_sneo_wireheart_bomb_1.png",
    "spr_sneo_wireheart_bomb_2.png",
    "spr_sneo_wireheart_bomb_3.png",
    "spr_sneo_wireheart_bomb_4.png"
  ],
  "spr_sneo_wireheart": [
    "spr_sneo_wireheart_0.png",
    "spr_sneo_wireheart_1.png",
    "spr_sneo_wireheart_2.png",
    "spr_sneo_wireheart_3.png",
    "spr_sneo_wireheart_4.png",
    "spr_sneo_wireheart_5.png",
    "spr_sneo_wireheart_biter_0.png",
    "spr_sneo_wireheart_biter_1.png",
    "spr_sneo_wireheart_biter_2.png",
    "spr_sneo_wireheart_biter_3.png",
    "spr_sneo_wireheart_biter_4.png",
    "spr_sneo_wireheart_bomb_0.png",
    "spr_sneo_wireheart_bomb_1.png",
    "spr_sneo_wireheart_bomb_2.png",
    "spr_sneo_wireheart_bomb_3.png",
    "spr_sneo_wireheart_bomb_4.png",
    "spr_sneo_wireheart_old_0.png",
    "spr_sneo_wireheart_old_1.png",
    "spr_sneo_wireheart_old_2.png",
    "spr_sneo_wireheart_old_3.png",
    "spr_sneo_wireheart_old_4.png",
    "spr_sneo_wireheart_old_5.png",
    "spr_sneo_wireheart_smaller_0.png",
    "spr_sneo_wireheart_smaller_1.png",
    "spr_sneo_wireheart_smaller_2.png",
    "spr_sneo_wireheart_smaller_3.png",
    "spr_sneo_wireheart_smaller_4.png",
    "spr_sneo_wireheart_smaller_5.png"
  ],
  "spr_sneo_wireheart_smaller": [
    "spr_sneo_wireheart_smaller_0.png",
    "spr_sneo_wireheart_smaller_1.png",
    "spr_sneo_wireheart_smaller_2.png",
    "spr_sneo_wireheart_smaller_3.png",
    "spr_sneo_wireheart_smaller_4.png",
    "spr_sneo_wireheart_smaller_5.png"
  ],
  "spr_growtangle": [
    "spr_growtangle_elecbullet_0.png",
    "spr_growtangle_electric_plug_0.png"
  ],
  "spr_knight_starchild": [
    "spr_knight_starchild_0.png",
    "spr_knight_starchild_inv_0.png",
    "spr_knight_starchild_parts_0.png",
    "spr_knight_starchild_parts_1.png",
    "spr_knight_starchild_trail_0.png",
    "spr_knight_starchild_trail_1.png"
  ],
  "spr_knight_diamondswordbullet": [
    "spr_knight_diamondswordbullet_0.png",
    "spr_knight_diamondswordbullet_1.png"
  ],
  "spr_gerson_hammer_bullet": [
    "spr_gerson_hammer_bullet_0.png"
  ],
  "spr_gerson_spin": [
    "spr_gerson_spin_0.png",
    "spr_gerson_spin_1.png",
    "spr_gerson_spin_10.png",
    "spr_gerson_spin_11.png",
    "spr_gerson_spin_12.png",
    "spr_gerson_spin_13.png",
    "spr_gerson_spin_2.png",
    "spr_gerson_spin_3.png",
    "spr_gerson_spin_4.png",
    "spr_gerson_spin_5.png",
    "spr_gerson_spin_6.png",
    "spr_gerson_spin_7.png",
    "spr_gerson_spin_8.png",
    "spr_gerson_spin_9.png",
    "spr_gerson_spin_fix_0.png",
    "spr_gerson_spin_fix_1.png",
    "spr_gerson_spin_fix_10.png",
    "spr_gerson_spin_fix_11.png",
    "spr_gerson_spin_fix_2.png",
    "spr_gerson_spin_fix_3.png",
    "spr_gerson_spin_fix_4.png",
    "spr_gerson_spin_fix_5.png",
    "spr_gerson_spin_fix_6.png",
    "spr_gerson_spin_fix_7.png",
    "spr_gerson_spin_fix_8.png",
    "spr_gerson_spin_fix_9.png",
    "spr_gerson_spin_outline_0.png",
    "spr_gerson_spin_outline_1.png",
    "spr_gerson_spin_outline_10.png",
    "spr_gerson_spin_outline_11.png",
    "spr_gerson_spin_outline_2.png",
    "spr_gerson_spin_outline_3.png",
    "spr_gerson_spin_outline_4.png",
    "spr_gerson_spin_outline_5.png",
    "spr_gerson_spin_outline_6.png",
    "spr_gerson_spin_outline_7.png",
    "spr_gerson_spin_outline_8.png",
    "spr_gerson_spin_outline_9.png",
    "spr_gerson_spin_smear_0.png",
    "spr_gerson_spin_smear_1.png"
  ],
  "spr_sneo_phone": [
    "spr_sneo_phone_0.png",
    "spr_sneo_phone_1.png",
    "spr_sneo_phone_2.png",
    "spr_sneo_phone_3.png"
  ],
  "spr_sneo_phonebullet": [
    "spr_sneo_phonebullet_0.png",
    "spr_sneo_phonebullet_1.png",
  ]
};
    }

    getSprite(spriteName) {
      if (!spriteName) return null;
      if (typeof spriteName !== 'string') spriteName = String(spriteName);
      if (this.sprites[spriteName]) return this.sprites[spriteName];

      const manifest = (typeof window !== 'undefined' && window.GML_SPRITE_MANIFEST) ? window.GML_SPRITE_MANIFEST : (this.spriteFiles || {});
      const files = manifest[spriteName];
      if (files && files.length > 0) {
        const entry = { frames: [], frameCount: files.length, loaded: false };
        files.forEach((f, idx) => {
          this.totalRequested++;
          if (typeof Image !== 'undefined') {
            const img = new Image();
            img.onload = () => {
              this.loadedCount++;
              if (idx === 0) entry.loaded = true;
            };
            img.onerror = () => {
              this.failedCount++;
            };
            img.src = 'sprites/' + f;
            entry.frames.push(img);
          }
        });
        this.sprites[spriteName] = entry;
        return entry;
      }
      return null;
    }

    getImage(spriteName, frameIdx = 0) {
      const spr = this.getSprite(spriteName);
      if (!spr || !spr.frames || spr.frames.length === 0) return null;
      const idx = Math.floor(Math.abs(frameIdx || 0)) % spr.frames.length;
      return spr.frames[idx] || null;
    }

    getSpriteInfo(spriteName) {
      const spr = this.getSprite(spriteName);
      const orig = (typeof global !== 'undefined' && global.GML_SPRITE_ORIGINS) ? global.GML_SPRITE_ORIGINS[spriteName] : null;
      const ox = orig ? orig[0] : 0;
      const oy = orig ? orig[1] : 0;
      if (!spr || !spr.frames || spr.frames.length === 0) return { width: 32, height: 32, originX: ox, originY: oy };
      const img = spr.frames[0];
      return {
        width: img && img.naturalWidth ? img.naturalWidth : 32,
        height: img && img.naturalHeight ? img.naturalHeight : 32,
        originX: ox,
        originY: oy
      };
    }

    getObjectInfo(objType) {
      return null;
    }

    drawSprite(ctx, spriteName, frameIdx, x, y, xscale = 1, yscale = 1, rotDeg = 0, alpha = 1, blendColor = null) {
      const spr = this.getSprite(spriteName);
      const orig = (typeof global !== 'undefined' && global.GML_SPRITE_ORIGINS) ? global.GML_SPRITE_ORIGINS[spriteName] : null;
      const idx = Math.floor(Math.abs(frameIdx || 0)) % (spr && spr.frames.length ? spr.frames.length : 1);
      const img = spr && spr.frames ? spr.frames[idx] : null;

      const ox = orig ? orig[0] : (img && img.naturalWidth ? 0 : 0);
      const oy = orig ? orig[1] : (img && img.naturalHeight ? 0 : 0);

      if (!img || !img.complete || img.naturalWidth === 0) {
        ctx.save();
        ctx.translate(x, y);
        if (rotDeg) ctx.rotate((rotDeg * Math.PI) / 180);
        ctx.fillStyle = blendColor || '#ff00ff';
        ctx.globalAlpha = alpha;
        ctx.fillRect(-ox * xscale, -oy * yscale, 24 * xscale, 24 * yscale);
        ctx.restore();
        return;
      }

      ctx.save();
      ctx.translate(x, y);
      if (rotDeg) ctx.rotate((rotDeg * Math.PI) / 180);
      ctx.scale(xscale, yscale);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, -ox, -oy);
      ctx.restore();
    }

    getLoadStatus() {
      return {
        loaded: this.loadedCount,
        requested: this.totalRequested,
        failed: this.failedCount
      };
    }
  }

  global.GMLAssetDatabase = GMLAssetDatabase;
  global.gmlAssets = new GMLAssetDatabase();

})(typeof window !== 'undefined' ? window : global);
