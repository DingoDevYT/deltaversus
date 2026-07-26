/**
 * gml_codegen.js — AST -> JavaScript for the GML compiler.
 *
 * Scope model, which is the whole reason this exists:
 *
 *   Every event body carries a stack of (self, other) bindings. At the top of an
 *   event, self is `$s0` (= `this`) and other is `$o0` (the event's other, or
 *   self when there isn't one). `with (expr) { ... }` pushes a new pair:
 *
 *       { const $o1 = $s0; const $L1 = $R.withList(expr, $o1);
 *         for (let $k1 = 0; $k1 < $L1.length; $k1++) {
 *           const $s1 = $L1[$k1];
 *           if ($s1.destroyed) continue;
 *           ...body compiled against $s1 / $o1...
 *         } }
 *
 *   Because that's a real loop in the same function, `break` leaves the with,
 *   `continue` skips one instance, and `exit` returns from the whole event —
 *   exactly GameMaker's semantics.
 *
 * Identifier resolution order mirrors GML: local `var` -> builtin/constant ->
 * asset name -> script -> instance variable on the current self.
 */
(function (global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════
  // NAME TABLES
  // ═══════════════════════════════════════════════════════════════════════

  /** Read-only builtin globals and constants — emitted as bare identifiers so
   *  gml_runtime.js stays the single source of truth for their values. */
  const BUILTIN_CONSTS = new Set([
    'c_white', 'c_black', 'c_red', 'c_green', 'c_blue', 'c_yellow', 'c_gray',
    'c_grey', 'c_orange', 'c_purple', 'c_aqua', 'c_lime', 'c_pink', 'c_fuchsia',
    'c_maroon', 'c_navy', 'c_olive', 'c_silver', 'c_teal', 'c_dkgray', 'c_ltgray', 'c_dkgrey', 'c_ltgrey',
    'bm_add', 'bm_normal', 'bm_subtract', 'bm_max', 'bm_zero', 'bm_one',
    'bm_src_colour', 'bm_src_color', 'bm_inv_src_colour', 'bm_inv_src_color',
    'bm_src_alpha', 'bm_inv_src_alpha', 'bm_dest_alpha', 'bm_inv_dest_alpha',
    'bm_dest_colour', 'bm_dest_color', 'bm_inv_dest_colour', 'bm_inv_dest_color',
    'bm_src_alpha_sat', 'bm_complex', 'bm_normal_alpha',
    'pi', 'infinity', 'NaN', 'undefined', 'pointer_null',
    // Virtual key codes. Unlisted, each compiled to an INSTANCE variable read,
    // which threw ReferenceError out of whatever event touched it — Flowery's
    // parkour section checks vk_space in its Draw, so obj_flowery_towery died
    // on every single frame and the tower never rendered.
    'vk_nokey', 'vk_anykey', 'vk_left', 'vk_right', 'vk_up', 'vk_down',
    'vk_enter', 'vk_escape', 'vk_space', 'vk_shift', 'vk_control', 'vk_alt',
    'vk_backspace', 'vk_tab', 'vk_home', 'vk_end', 'vk_delete', 'vk_insert',
    'vk_pageup', 'vk_pagedown', 'vk_pause', 'vk_printscreen',
    'vk_lshift', 'vk_lcontrol', 'vk_lalt', 'vk_rshift', 'vk_rcontrol', 'vk_ralt',
    'vk_f1', 'vk_f2', 'vk_f3', 'vk_f4', 'vk_f5', 'vk_f6',
    'vk_f7', 'vk_f8', 'vk_f9', 'vk_f10', 'vk_f11', 'vk_f12',
    'vk_numpad0', 'vk_numpad1', 'vk_numpad2', 'vk_numpad3', 'vk_numpad4',
    'vk_numpad5', 'vk_numpad6', 'vk_numpad7', 'vk_numpad8', 'vk_numpad9',
    'vk_multiply', 'vk_divide', 'vk_add', 'vk_subtract', 'vk_decimal',
    'fa_left', 'fa_center', 'fa_right', 'fa_top', 'fa_middle', 'fa_bottom',
    'pr_trianglelist', 'pr_trianglestrip', 'pr_trianglefan', 'pr_linelist', 'pr_linestrip', 'pr_pointlist',
    'e__VW', 'e__BG',
    'room_speed', 'fps', 'fps_real', 'delta_time', 'current_time',
    'room_width', 'room_height', 'room', 'view_current',
    // View arrays. Unlisted, `view_wport[0]` compiled to an INSTANCE variable
    // and the auto-array proxy answered 0 — the date backgrounds tile to
    // `camx + view_wport[0]`, so their whole tiled layer collapsed into a
    // single strip bouncing at the left edge of the screen. The globals are
    // seeded (640/480) by gml_helpers.
    'view_wport', 'view_hport', 'view_xport', 'view_yport',
    'view_wview', 'view_hview', 'view_xview', 'view_yview',
    'view_camera', 'view_visible', 'view_enabled',
    'mouse_x', 'mouse_y', 'mouse_button', 'mouse_check_button',
    'button1', 'button1_p', 'button1_h', 'button2', 'button2_p', 'button2_h',
    'button3', 'button3_p', 'button3_h',
    'vk_left', 'vk_right', 'vk_up', 'vk_down', 'vk_enter', 'vk_escape', 'vk_space',
    'vk_shift', 'vk_control', 'vk_alt', 'vk_tab', 'vk_backspace', 'vk_delete',
    'os_windows', 'os_type', 'gamemaker_pro',
  ]);

  /** Builtin functions provided by gml_runtime.js or polyfilled by the shim.
   *  Anything not listed routes through `$R.miss`, which resolves it on `window`
   *  at call time and degrades to 0 with a single warning if truly absent. */
  const BUILTIN_FNS = new Set([
    // math
    'abs', 'sign', 'round', 'floor', 'ceil', 'frac', 'sqrt', 'sqr', 'power', 'exp',
    'ln', 'log2', 'log10', 'logn', 'sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan',
    'arctan2', 'dsin', 'dcos', 'dtan', 'darcsin', 'darccos', 'darctan', 'darctan2',
    'degtorad', 'radtodeg', 'min', 'max', 'mean', 'median', 'clamp', 'clamp01', 'lerp',
    'random', 'random_range', 'irandom', 'irandom_range', 'choose', 'randomize',
    'random_set_seed', 'random_get_seed', 'randomsign',
    'point_direction', 'point_distance', 'angle_difference', 'lengthdir_x', 'lengthdir_y',
    'dot_product', 'remap', 'inverselerp', 'real', 'int64', 'is_undefined', 'is_real',
    'is_string', 'is_array', 'is_struct', 'is_numeric', 'is_bool', 'is_method',
    // strings
    'string', 'string_length', 'string_copy', 'string_pos', 'string_char_at',
    'string_delete', 'string_insert', 'string_replace', 'string_replace_all',
    'string_upper', 'string_lower', 'string_repeat', 'string_digits', 'string_letters',
    'string_width', 'string_height', 'string_format', 'chr', 'ord', 'string_hash_to_newline',
    // arrays / data structures
    'array_length', 'array_length_1d', 'array_length_2d', 'array_create', 'array_copy',
    'array_push', 'array_pop', 'array_insert', 'array_delete', 'array_resize',
    'array_sort', 'array_equals', 'array_get', 'array_set',
    'ds_list_create', 'ds_list_destroy', 'ds_list_add', 'ds_list_size', 'ds_list_clear',
    'ds_list_delete', 'ds_list_find_value', 'ds_list_find_index', 'ds_list_replace',
    'ds_list_shuffle', 'ds_list_sort', 'ds_list_insert',
    'ds_map_create', 'ds_map_destroy', 'ds_map_add', 'ds_map_find_value', 'ds_map_exists',
    'ds_map_delete', 'ds_map_size', 'ds_map_clear', 'ds_map_keys_to_array',
    'ds_grid_create', 'ds_grid_destroy', 'ds_grid_set', 'ds_grid_get', 'ds_grid_clear',
    'ds_grid_width', 'ds_grid_height',
    'variable_instance_exists', 'variable_instance_get', 'variable_instance_set',
    'variable_global_exists', 'variable_global_get', 'variable_global_set',
    'variable_struct_exists', 'variable_struct_get', 'variable_struct_set',
    'method', 'method_call', 'script_execute',
    // drawing
    'draw_sprite', 'draw_sprite_ext', 'draw_sprite_part', 'draw_sprite_part_ext',
    'draw_sprite_part_ext_rot', 'draw_sprite_general', 'draw_sprite_pos',
    'draw_sprite_tiled', 'draw_sprite_tiled_ext', 'draw_sprite_stretched',
    'draw_sprite_stretched_ext',
    'draw_set_colour', 'draw_set_color', 'draw_set_alpha', 'draw_set_font',
    'draw_set_halign', 'draw_set_valign', 'draw_get_colour', 'draw_get_color', 'draw_get_alpha',
    'draw_rectangle', 'draw_rectangle_colour', 'draw_rectangle_color',
    'draw_line', 'draw_line_width', 'draw_line_colour', 'draw_line_color',
    'draw_line_width_colour', 'draw_line_width_color',
    'draw_circle', 'draw_circle_colour', 'draw_circle_color',
    'draw_ellipse', 'draw_triangle', 'draw_triangle_colour', 'draw_triangle_color',
    'draw_point', 'draw_healthbar', 'draw_clear', 'draw_clear_alpha',
    'draw_text', 'draw_text_ext', 'draw_text_colour', 'draw_text_color',
    'draw_text_transformed', 'draw_text_ext_transformed', 'draw_text_transformed_colour',
    'draw_text_transformed_color', 'draw_text_ext_transformed_colour',
    'sprite_get_width', 'sprite_get_height', 'sprite_get_xoffset', 'sprite_get_yoffset',
    'sprite_get_number', 'sprite_get_bbox_left', 'sprite_get_bbox_right',
    'sprite_get_bbox_top', 'sprite_get_bbox_bottom', 'sprite_exists',
    'sprite_create_from_surface', 'sprite_set_offset',
    'merge_colour', 'merge_color', 'make_colour_rgb', 'make_color_rgb',
    'make_colour_hsv', 'make_color_hsv', 'colour_get_red', 'color_get_red',
    'colour_get_green', 'color_get_green', 'colour_get_blue', 'color_get_blue',
    'colour_get_hue', 'color_get_hue', 'colour_get_saturation', 'color_get_saturation',
    'colour_get_value', 'color_get_value',
    'gpu_set_blendmode', 'gpu_set_blendmode_ext', 'gpu_set_blendmode_ext_sepalpha',
    'gpu_set_blendenable', 'gpu_set_colorwriteenable', 'gpu_set_colourwriteenable',
    'gpu_set_alphatestenable', 'gpu_set_alphatestref', 'gpu_set_fog',
    'draw_set_blend_mode', 'draw_set_blend_mode_ext', 'd3d_set_fog',
    'surface_exists', 'surface_create', 'surface_free', 'surface_set_target',
    'surface_reset_target', 'surface_get_width', 'surface_get_height', 'surface_resize',
    'draw_surface', 'draw_surface_ext', 'draw_surface_part_ext', 'draw_surface_stretched',
    'draw_primitive_begin', 'draw_primitive_begin_texture', 'draw_primitive_end',
    'draw_vertex', 'draw_vertex_colour', 'draw_vertex_color', 'draw_vertex_texture',
    'draw_vertex_texture_colour', 'draw_vertex_texture_color',
    'shader_set', 'shader_reset', 'shader_is_compiled', 'shader_get_uniform',
    'shader_set_uniform_f', 'shader_set_uniform_i',
    'texture_get_texel_width', 'texture_get_texel_height',
    // audio
    'snd_play', 'snd_play_x', 'snd_play_pitch', 'snd_stop', 'snd_loop', 'snd_pause',
    'snd_pitch', 'snd_volume', 'snd_is_playing', 'snd_free', 'snd_exists', 'snd_pitch_time',
    'audio_play_sound', 'audio_play_sound_at', 'audio_stop_sound', 'audio_stop_all',
    'audio_pause_sound', 'audio_resume_sound', 'audio_is_playing', 'audio_sound_pitch',
    'audio_sound_gain', 'audio_sound_get_pitch', 'audio_sound_get_gain', 'audio_exists',
    // instances / collision
    'instance_find', 'instance_nearest', 'instance_furthest', 'instance_place',
    'instance_position', 'instance_activate_all', 'instance_deactivate_all',
    'instance_change', 'instance_copy',
    'collision_rectangle', 'collision_circle', 'collision_line', 'collision_point',
    'collision_ellipse', 'place_meeting', 'position_meeting', 'point_in_rectangle',
    'point_in_circle', 'rectangle_in_rectangle',
    'distance_to_point', 'distance_to_object', 'move_towards_point', 'move_snap',
    'move_wrap', 'move_bounce_all', 'move_bounce_solid',
    'object_get_name', 'object_get_parent', 'object_is_ancestor', 'object_exists',
    'motion_add', 'motion_set',
    // camera / view / room
    'camera_get_view_x', 'camera_get_view_y', 'camera_get_view_width', 'camera_get_view_height',
    'camera_set_view_pos', 'camera_set_view_size', 'view_get_camera',
    '__view_get', '__view_set', 'camerax', 'cameray', 'camerawidth', 'cameraheight',
    'screenx', 'screeny', 'room_goto', 'room_restart', 'game_end', 'game_restart',
    'window_get_width', 'window_get_height', 'display_get_width', 'display_get_height',
    // input
    'keyboard_check', 'keyboard_check_pressed', 'keyboard_check_released',
    'keyboard_clear', 'mouse_check_button_pressed', 'mouse_check_button_released',
    'gamepad_button_check', 'gamepad_axis_value',
    // misc engine
    'show_debug_message', 'show_message', 'debug_print', 'date_current_datetime',
    'get_timer', 'os_get_language', 'clipboard_set_text',
    'file_exists', 'json_parse', 'json_stringify',
    'lerp_ease_in', 'lerp_ease_out', 'inverselerp',
    // deltarune scripts implemented natively in gml_runtime.js
    'i_ex', 'gt_minx', 'gt_miny', 'gt_maxx', 'gt_maxy', 'gt_inbounds', 'gt_inbounds_tol',
    'scr_get_box', 'scr_ease_in', 'scr_ease_out', 'scr_ease_inout', 'scr_movetowards',
    'scr_approach', 'scr_rotatetowards', 'scr_angle_lerp', 'scr_anglechange', 'scr_pingpong',
    'scr_orbitx', 'scr_orbity', 'scr_afterimage', 'scr_afterimagefast', 'scr_afterimage_grow',
    'scr_afterimage_cut', 'scr_custom_afterimage', 'scr_marker', 'scr_dark_marker',
    'scr_oflash', 'scr_shakeobj', 'scr_shakescreen', 'scr_pan_screen', 'scr_darksize',
    'scr_bullet_inherit', 'scr_onscreen_tolerance', 'scr_lerpvar', 'scr_lerpvar_instance',
    'scr_lerpvar_respect', 'scr_jump_to_point', 'scr_jump_to_point_sprite', 'scr_at_player',
    'scr_moveheart', 'scr_guardpeek', 'scr_enemy_object_init', 'scr_enemy_drawidle_generic',
    'scr_monsterattacknamecount', 'scr_sonic_boom', 'scr_var', 'scr_var_delayed',
    'scr_script_delayed', 'scr_custom_box_reset', 'scr_debug', 'scr_draw_beam',
    'scr_draw_beam_color', 'scr_draw_outline', 'scr_draw_outline_ext',
    'scr_draw_in_box_begin', 'scr_draw_in_box_end', 'scr_draw_in_box_ext_begin',
    'scr_draw_in_box_ext_end', 'scr_inverselerp', 'scr_fire_bullet', 'scr_bulletspawner',
    'scr_enemyblcon', 'scr_battle_sprite_reset', 'scr_attack_override', 'scr_isphase',
    'scr_randomtarget', 'scr_spellmenu_setup', 'scr_nextact', 'scr_fadeout', 'scr_gameover',
    'scr_turntimer', 'scr_getbuttonsprite', 'scr_doom', 'scr_84_get_sprite',
    'scr_84_get_lang_string', 'scr_84_set_draw_font', 'msgsetloc', 'stringsetloc',
    'box_bonk', 'ossafe_fill_rectangle', 'ossafe_fill_rectangle_ext',
    'ossafe_fill_rectangle_color', 'ossafe_fill_rectangle_colour',
    'scr_childbullet', 'scr_bullet_create', 'scr_sneo_wall_create',
  ]);

  /** Functions rewritten by the codegen because their GML semantics can't be
   *  expressed by a positional call. */
  const SPECIAL_FNS = new Set([
    'instance_create', 'instance_create_depth', 'instance_destroy', 'instance_exists',
    'instance_number', 'i_ex', 'event_user', 'event_inherited', 'event_perform',
    'draw_self', 'scr_bullet_init', 'string', 'power', 'sqr', 'show_debug_message',
    'array_length', 'array_length_1d', 'array_length_2d', 'array_create',
    'variable_instance_exists', 'variable_instance_get', 'variable_instance_set',
    'alarm_set', 'alarm_get',
  ]);

  /** JS reserved words that are legal GML identifiers — suffix to avoid clashes. */
  const JS_RESERVED = new Set([
    'await', 'class', 'const', 'debugger', 'export', 'extends', 'import', 'in',
    'instanceof', 'let', 'null', 'super', 'this', 'typeof', 'void', 'yield',
    'arguments', 'eval', 'implements', 'interface', 'package', 'private',
    'protected', 'public', 'true', 'false',
  ]);

  /**
   * Asset-name prefixes, kept deliberately narrow. A wider list ate real
   * instance variables: `bg_x` is a variable in obj_knight_pointing_cone, not a
   * background asset. Anything outside these prefixes must match a known asset
   * name exactly to be treated as one.
   */
  const ASSET_PREFIX = /^(obj|spr|snd|mus|fnt|shd)_/;

  /** GML literals that are plain identifiers to the lexer. */
  const LITERAL_IDENTS = {
    true: '1', false: '0', undefined: 'undefined',
    infinity: 'Infinity', NaN: 'NaN',
  };

  // ═══════════════════════════════════════════════════════════════════════
  // CODE GENERATOR
  // ═══════════════════════════════════════════════════════════════════════

  class Codegen {
    /**
     * @param {object} opts
     *   scripts   Set/object of user script names that will exist on `$R.scr`.
     *   enums     name -> { member: value }
     *   macros    name -> source text
     *   chapter   'ch2' | 'ch3' | ... — picks the asset index table.
     *   isScript  compiling a global script (enables argumentN).
     *   params    parameter names when isScript.
     */
    constructor(opts) {
      opts = opts || {};
      this.scripts = opts.scripts || new Set();
      // Functions objects define on themselves; these resolve against `self` at
      // call time, so they aren't "unknown" even though they aren't globals.
      this.methods = opts.methods || new Set();
      this.enums = opts.enums || Object.create(null);
      this.macros = opts.macros || Object.create(null);
      this.chapter = opts.chapter || 'ch3';
      this.warnings = [];
      this.instanceVars = new Set();   // collected for hoisting
      this.usedOther = false;
      this.scopes = [];               // local `var` scopes
      this.selfStack = [];            // { self: '$s0', other: '$o0' }
      this.withCount = 0;
      this.tmpCount = 0;
      this.macroDepth = 0;
      this.indent = 0;
    }

    warn(msg) { if (this.warnings.indexOf(msg) === -1) this.warnings.push(msg); }

    get self() { return this.selfStack[this.selfStack.length - 1].self; }
    get other() {
      const f = this.selfStack[this.selfStack.length - 1];
      if (f.other === '$o0') this.usedOther = true;
      return f.other;
    }

    pushScope() { this.scopes.push(new Set()); }
    popScope() { this.scopes.pop(); }
    declareLocal(name) {
      if (!this.scopes.length) this.pushScope();
      this.scopes[this.scopes.length - 1].add(name);
    }
    isLocal(name) {
      for (let i = this.scopes.length - 1; i >= 0; i--) if (this.scopes[i].has(name)) return true;
      return false;
    }
    tmp(prefix) { return '$' + (prefix || 't') + (++this.tmpCount); }

    pad() { return '  '.repeat(this.indent); }

    // ── local hoisting ────────────────────────────────────────────────

    /**
     * GML's `var` is function-scoped, not block-scoped, and it may be
     * redeclared. Both matter:
     *
     *   switch (p) { case A: var c = f(); break; case B: var c = g(); break; }
     *
     * is legal GML (__view_get does exactly this) but two `let c` in one switch
     * block is a JS SyntaxError. And a `var` declared inside an `if` stays
     * visible after the block in GML, which `let` would not.
     *
     * So collect every `var` in the function up front, declare them once at the
     * top, and emit declarations as plain assignments.
     */
    collectVarNames(statements) {
      const found = [];
      const seen = new Set();
      const addName = n => { if (!seen.has(n)) { seen.add(n); found.push(n); } };

      const walkStmt = node => {
        if (!node || typeof node !== 'object') return;
        switch (node.type) {
          // A nested function has its own scope — do not descend.
          case 'FunctionDecl':
          case 'FunctionExpr':
            return;
          case 'VarDecl':
          case 'StaticDecl':
            if (node.declarations) node.declarations.forEach(d => addName(d.name));
            else if (node.name) addName(node.name);
            return;
          case 'Try':
            walkStmt(node.block); walkStmt(node.handler); walkStmt(node.finalizer);
            return;
        }
        for (const key of Object.keys(node)) {
          if (key === 'type') continue;
          const v = node[key];
          if (Array.isArray(v)) v.forEach(walkStmt);
          else if (v && typeof v === 'object' && v.type) walkStmt(v);
        }
      };

      statements.forEach(walkStmt);
      return found;
    }

    /** `let a, b, c;` for a function's hoisted locals, or '' if there are none. */
    hoistDecl(statements, extraDeclared) {
      const names = this.collectVarNames(statements)
        .filter(n => !(extraDeclared && extraDeclared.has(n)));
      names.forEach(n => this.declareLocal(n));
      if (extraDeclared) extraDeclared.forEach(n => this.declareLocal(n));
      if (!names.length) return '';
      return `${this.pad()}let ${names.map(n => this.localName(n)).join(', ')};\n`;
    }

    // ── entry points ──────────────────────────────────────────────────

    /** Compile one event body into a JS statement list. */
    generateEvent(ast, eventName) {
      this.eventName = eventName || 'step';
      this.scopes = [new Set()];
      this.selfStack = [{ self: '$s0', other: '$o0' }];
      this.indent = 2;
      const hoist = this.hoistDecl(ast.body);
      const body = this.genStatements(ast.body);
      return hoist + body;
    }

    genStatements(list) {
      const out = [];
      for (const s of list) {
        const js = this.genStatement(s);
        if (js) out.push(js);
      }
      return out.join('\n');
    }

    /** A statement in its own nesting level, always brace-wrapped when needed. */
    genBody(node) {
      if (node.type === 'Block') {
        this.pushScope();
        this.indent++;
        const inner = this.genStatements(node.body);
        this.indent--;
        this.popScope();
        return `{\n${inner}\n${this.pad()}}`;
      }
      this.indent++;
      const one = this.genStatement(node);
      this.indent--;
      return `{\n${one}\n${this.pad()}}`;
    }

    // ── statements ────────────────────────────────────────────────────

    genStatement(node) {
      if (!node) return '';
      const p = this.pad();

      switch (node.type) {
        case 'Block': {
          this.pushScope();
          this.indent++;
          const inner = this.genStatements(node.body);
          this.indent--;
          this.popScope();
          return `${p}{\n${inner}\n${p}}`;
        }

        case 'VarDecl': {
          // Already declared at the top of the function by hoistDecl(), so this
          // is only the assignment. A bare `var x;` assigns nothing.
          const parts = [];
          for (const d of node.declarations) {
            this.declareLocal(d.name);
            if (d.init) parts.push(`${this.localName(d.name)} = ${this.genExpr(d.init)}`);
          }
          if (!parts.length) return '';
          return `${p}${parts.join('; ')};`;
        }

        case 'GlobalVarDecl': {
          const parts = node.declarations.map(d =>
            `$G.${d.name} = ${d.init ? this.genExpr(d.init) : `($G.${d.name} === undefined ? 0 : $G.${d.name})`}`);
          return `${p}${parts.join('; ')};`;
        }

        case 'StaticDecl': {
          // Statics persist per-object. Park them on the runtime keyed by object.
          const key = `${this.objectName || 'anon'}.${node.name}`;
          this.declareLocal(node.name);
          const nm = this.localName(node.name);
          return `${p}${nm} = $R.static(${JSON.stringify(key)}, ${node.init ? this.genExpr(node.init) : '0'});`;
        }

        case 'EnumDecl':
          Object.assign(this.enums, { [node.name]: node.members });
          return `${p}/* enum ${node.name} */`;

        case 'Assign': return p + this.genAssign(node) + ';';

        case 'ExpressionStatement': {
          const e = this.genExpr(node.expression);
          if (!e) return '';
          return `${p}${e};`;
        }

        case 'If': {
          let out = `${p}if (${this.genCondition(node.test)}) ${this.genBody(node.consequent)}`;
          if (node.alternate) {
            const isElseIf = node.alternate.type === 'If';
            if (isElseIf) {
              // Keep `else if` flat rather than nesting braces.
              const inner = this.genStatement(node.alternate).replace(/^\s+/, '');
              out += ` else ${inner}`;
            } else {
              out += ` else ${this.genBody(node.alternate)}`;
            }
          }
          return out;
        }

        // `while` and `do…until` carry an iteration guard. Deltarune has loops
        // whose exit depends on state a port can get subtly wrong (Pink's
        // singing attack spins on `until (_getheart < 0)` if collision results
        // aren't numeric, and her curtains hunt for a free audience seat with
        // `until (ds_list_find_index(...) < 0)`, which the original can itself
        // exhaust). Without a guard those lock the tab with no error; with one
        // the attack keeps playing and says what happened. The wrapping block
        // keeps this a single statement, so a braceless `if (c) while (…)`
        // stays valid.
        case 'While': {
          const g = this.tmp('lg');
          const site = `${this.objectName || 'gml'}.${this.eventName || 'event'}`;
          return `${p}{ let ${g} = 0; while ((${this.genCondition(node.test)}) && $R.spin(${g}++, ${JSON.stringify(site)})) ${this.genBody(node.body)} }`;
        }

        case 'DoUntil': {
          // GML's `do ... until (c)` repeats while c is false.
          const g = this.tmp('lg');
          const site = `${this.objectName || 'gml'}.${this.eventName || 'event'}`;
          return `${p}{ let ${g} = 0; do ${this.genBody(node.body)} while (!(${this.genCondition(node.test)}) && $R.spin(${g}++, ${JSON.stringify(site)})); }`;
        }

        case 'For': {
          this.pushScope();
          const init = node.init
            ? (node.init.type === 'VarDecl'
              ? this.genStatement(node.init).trim().replace(/;$/, '')
              : (node.init.type === 'Assign' ? this.genAssign(node.init) : this.genExpr(node.init.expression)))
            : '';
          const test = node.test ? this.genCondition(node.test) : '';
          const upd = node.update
            ? (node.update.type === 'Assign' ? this.genAssign(node.update) : this.genExpr(node.update.expression))
            : '';
          const body = this.genBody(node.body);
          this.popScope();
          // Guarded like `while`. A `for` whose update never reaches the test —
          // easy to produce when a call the engine is missing returns 0 instead
          // of advancing an index — wedges the whole tab with no way back.
          const g = this.tmp('lg');
          const site = `${this.objectName || 'gml'}.${this.eventName || 'event'}`;
          return `${p}{ let ${g} = 0; for (${init}; (${test || 'true'}) && $R.spin(${g}++, ${JSON.stringify(site)}); ${upd}) ${body} }`;
        }

        case 'Repeat': {
          const k = this.tmp('r');
          const n = this.tmp('n');
          // `repeat` evaluates its count once, so a garbage count (NaN reads as
          // 0, but a bad expression can yield millions) is the failure mode.
          const site = `${this.objectName || 'gml'}.${this.eventName || 'event'}`;
          return `${p}for (let ${k} = 0, ${n} = ${this.genExpr(node.count)}; ${k} < ${n} && $R.spin(${k}, ${JSON.stringify(site)}); ${k}++) ${this.genBody(node.body)}`;
        }

        case 'Switch': {
          const parts = [`${p}switch (${this.genExpr(node.discriminant)}) {`];
          this.indent++;
          for (const c of node.cases) {
            parts.push(`${this.pad()}${c.test === null ? 'default:' : `case ${this.genExpr(c.test)}:`}`);
            this.indent++;
            this.pushScope();
            parts.push(this.genStatements(c.body));
            this.popScope();
            this.indent--;
          }
          this.indent--;
          parts.push(`${p}}`);
          return parts.filter(s => s !== '').join('\n');
        }

        case 'With': return this.genWith(node);

        case 'Break': return `${p}break;`;
        case 'Continue': return `${p}continue;`;
        case 'Exit': return `${p}return;`;
        case 'Return': return `${p}return${node.argument ? ' ' + this.genExpr(node.argument) : ''};`;
        case 'Throw': return `${p}throw ${this.genExpr(node.argument)};`;
        case 'Delete': return `${p}$R.del(${this.genExpr(node.argument)});`;

        case 'Try': {
          let out = `${p}try ${this.genBody(node.block)}`;
          if (node.handler) {
            this.pushScope();
            if (node.param) this.declareLocal(node.param);
            out += ` catch (${node.param ? this.localName(node.param) : '$e'}) ${this.genBody(node.handler)}`;
            this.popScope();
          } else if (!node.finalizer) {
            out += ' catch ($e) {}';
          }
          if (node.finalizer) out += ` finally ${this.genBody(node.finalizer)}`;
          return out;
        }

        case 'FunctionDecl': {
          // A named function inside an event becomes a method on self, which is
          // how GML 2.3 scopes it.
          const fn = this.genFunction(node);
          if (!node.name) return `${p}${fn};`;
          this.instanceVars.add(node.name);
          return `${p}${this.self}.${node.name} = ${fn};`;
        }

        default:
          return `${p}${this.genExpr(node)};`;
      }
    }

    genWith(node) {
      const p = this.pad();
      const n = ++this.withCount;
      const listVar = `$L${n}`;
      const idxVar = `$k${n}`;
      const selfVar = `$s${n}`;
      const otherVar = `$o${n}`;
      const caller = this.self;

      // `with` evaluates its target in the CALLER's scope, before rebinding.
      const targetJs = this.genExpr(node.target);

      this.selfStack.push({ self: selfVar, other: otherVar });
      this.pushScope();
      this.indent += 2;
      const bodyInner = node.body.type === 'Block'
        ? this.genStatements(node.body.body)
        : this.genStatement(node.body);
      this.indent -= 2;
      this.popScope();
      this.selfStack.pop();

      const ip = '  '.repeat(this.indent + 1);
      const ip2 = '  '.repeat(this.indent + 2);
      return `${p}{
${ip}const ${otherVar} = ${caller};
${ip}const ${listVar} = $R.withList(${targetJs}, ${otherVar});
${ip}for (let ${idxVar} = 0; ${idxVar} < ${listVar}.length; ${idxVar}++) {
${ip2}const ${selfVar} = ${listVar}[${idxVar}];
${ip2}if (${selfVar}.destroyed) continue;
${bodyInner}
${ip}}
${p}}`;
    }

    /**
     * GML conditions are true when the value exceeds 0.5, so `if (0.4)` is
     * false. Comparisons and logical ops already yield booleans; anything else
     * goes through $R.b to preserve that rule.
     */
    genCondition(node) {
      const js = this.genExpr(node);
      const t = node.type === 'Paren' ? node.expression.type : node.type;
      const op = node.type === 'Paren' ? node.expression.operator : node.operator;
      if (t === 'Binary' && ['<', '<=', '>', '>=', '==', '!=', '&&', '||', '^^'].indexOf(op) !== -1) return js;
      if (t === 'Unary' && op === '!') return js;
      return `$R.b(${js})`;
    }

    // ── assignment ────────────────────────────────────────────────────

    genAssign(node) {
      const op = node.operator;
      const target = node.left;
      const valueJs = this.genExpr(node.right);

      // Indexed assignment has to auto-create and grow the array, GML-style.
      if (target.type === 'Index') return this.genIndexAssign(target, op, valueJs);

      const ref = this.genRef(target);
      if (op === '=') return `${ref} = ${valueJs}`;
      if (op === '??=') return `${ref} = (${ref} ?? ${valueJs})`;
      // GML has no `/=` on integers distinct from JS, so the rest map directly.
      return `${ref} ${op} ${valueJs}`;
    }

    /** An assignable JS expression for a non-indexed target. */
    genRef(node) {
      switch (node.type) {
        case 'Identifier': {
          // Decompiled code sometimes assigns to an asset-shaped name — e.g.
          // obj_growtangle does `spr_custom_box = sprite_create_from_surface(...)`
          // to swap the box sprite at runtime. A string literal isn't
          // assignable, so route it to a global override slot instead of
          // emitting invalid JavaScript.
          const kind = this.classifyIdent(node.name);
          if (kind === 'asset-string' || kind === 'asset-object' || kind === 'const' || kind === 'literal') {
            // Runtime sprite reassignment (obj_growtangle's spr_custom_box).
            // The write lands on $G[name]; every sprite lookup resolves through
            // sprAlias(), so reads of the original name follow the redirect.
            return `$G[${JSON.stringify(node.name)}]`;
          }
          return this.resolveIdent(node.name, true);
        }
        case 'Member': return this.genMember(node, true);
        case 'Paren': return this.genRef(node.expression);
        default: return this.genExpr(node);
      }
    }

    /**
     * Collapse a chained plain-array target into one base plus an index path.
     * `a[i][j] = v` is GML's 2D array write (the decompiler always emits the
     * chained form, never `a[i, j]`), and it has to create the intermediate row
     * if it doesn't exist yet — so the whole path must be written at once.
     */
    flattenIndexTarget(node) {
      const path = [];
      let cur = node;
      while (cur.type === 'Index' && (cur.kind === 'array' || cur.kind === 'direct')) {
        path.unshift(...cur.indices);
        cur = cur.object;
      }
      return { base: cur, indices: path };
    }

    genIndexAssign(target, op, valueJs) {
      const kind = target.kind;

      if (kind === 'array' || kind === 'direct') {
        const flat = this.flattenIndexTarget(target);
        if (flat.indices.length > target.indices.length) {
          target = { type: 'Index', object: flat.base, indices: flat.indices, kind: 'array' };
        }
      }

      const idx = target.indices.map(i => this.genExpr(i));

      if (kind === 'grid') return `$R.gridSet(${this.genExpr(target.object)}, ${idx.join(', ')}, ${valueJs})`;
      if (kind === 'list') return `$R.listSet(${this.genExpr(target.object)}, ${idx[0]}, ${valueJs})`;
      if (kind === 'map') return `$R.mapSet(${this.genExpr(target.object)}, ${idx[0]}, ${valueJs})`;
      if (kind === 'struct') return `$R.structSet(${this.genExpr(target.object)}, ${idx[0]}, ${valueJs})`;

      // Compound ops need the old value first.
      let rhs = valueJs;
      if (op !== '=') {
        const readJs = this.genExpr(target);
        rhs = op === '??=' ? `(${readJs} ?? ${valueJs})` : `(${readJs} ${op.slice(0, -1)} ${valueJs})`;
      }

      const obj = target.object;
      // `name[i] = v` on an instance variable, a local, or a member — each needs
      // the container written back if it had to be created.
      if (obj.type === 'Identifier') {
        const name = obj.name;
        if (this.isLocal(name)) {
          const nm = this.localName(name);
          return `${nm} = $R.aput(${nm}, [${idx.join(', ')}], ${rhs})`;
        }
        const holder = this.identHolder(name);
        if (holder) return `$R.aset(${holder.obj}, ${JSON.stringify(holder.prop)}, [${idx.join(', ')}], ${rhs})`;
      }
      if (obj.type === 'Member') {
        // `global.foo[i] = v` and `someId.foo[i] = v` both land here.
        if (obj.object.type === 'Identifier' && obj.object.name === 'global') {
          return `$R.aset($G, ${JSON.stringify(obj.property)}, [${idx.join(', ')}], ${rhs})`;
        }
        const base = this.deref(this.genExpr(obj.object));
        return `$R.aset(${base}, ${JSON.stringify(obj.property)}, [${idx.join(', ')}], ${rhs})`;
      }
      // Chained index (a[i][j] written as two accessors) — write in place.
      return `$R.aput(${this.genExpr(obj)}, [${idx.join(', ')}], ${rhs})`;
    }

    /**
     * For `name[...] = v`, where does `name` live? Returns the container object
     * expression and property so the array can be created on it.
     */
    identHolder(name) {
      if (name === 'alarm') return { obj: this.self, prop: 'alarm' };
      const kind = this.classifyIdent(name);
      if (kind === 'instance') return { obj: this.self, prop: name };
      if (kind === 'global') return { obj: '$G', prop: name };
      return null;
    }

    // ── expressions ───────────────────────────────────────────────────

    genExpr(node) {
      if (!node) return 'undefined';
      switch (node.type) {
        case 'Number': return numLit(node.value);
        case 'String': return JSON.stringify(node.value);
        case 'Undefined': return 'undefined';
        case 'Paren': return `(${this.genExpr(node.expression)})`;

        case 'Identifier': return this.resolveIdent(node.name, false);

        case 'Macro': return this.expandMacro(node);

        case 'Binary': return this.genBinary(node);

        case 'Unary': {
          const a = this.genExpr(node.argument);
          if (node.operator === '!') return `(!${this.genCondition(node.argument)})`;
          if (node.operator === '~') return `(~${a})`;
          if (node.operator === '+') return `(+${a})`;
          return `(-${a})`;
        }

        case 'Update': {
          const ref = node.argument.type === 'Index' ? null : this.genRef(node.argument);
          if (ref === null) {
            // ++ on an array element: rewrite as a compound assignment.
            return this.genIndexAssign(node.argument, node.operator === '++' ? '+=' : '-=', '1');
          }
          return node.prefix ? `(${node.operator}${ref})` : `(${ref}${node.operator})`;
        }

        case 'Conditional':
          return `(${this.genCondition(node.test)} ? ${this.genExpr(node.consequent)} : ${this.genExpr(node.alternate)})`;

        case 'Member': return this.genMember(node, false);

        case 'Index': return this.genIndexRead(node);

        case 'Call': return this.genCall(node);

        case 'New': {
          // A constructor script resolves through scrGet, which JIT-compiles on
          // first use — `new $R.scr["x"]()` would see undefined before that.
          const args = node.arguments.map(a => this.genExpr(a)).join(', ');
          if (node.callee.type === 'Identifier' && this.scripts.has && this.scripts.has(node.callee.name)) {
            return `new ($R.scrGet(${JSON.stringify(node.callee.name)}))(${args})`;
          }
          return `new (${this.genExpr(node.callee)})(${args})`;
        }

        case 'ArrayLiteral': return `[${node.elements.map(e => this.genExpr(e)).join(', ')}]`;

        case 'StructLiteral':
          return `{ ${node.properties.map(pr => `${JSON.stringify(pr.key)}: ${this.genExpr(pr.value)}`).join(', ')} }`;

        case 'FunctionExpr': return this.genFunction(node);

        default:
          this.warn(`unhandled node type ${node.type}`);
          return '0';
      }
    }

    genBinary(node) {
      const a = this.genExpr(node.left);
      const b = this.genExpr(node.right);
      switch (node.operator) {
        case 'div': return `$R.div(${a}, ${b})`;
        case '^^': return `(($R.b(${a})) !== ($R.b(${b})))`;
        case '&&': return `(${this.genCondition(node.left)} && ${this.genCondition(node.right)})`;
        case '||': return `(${this.genCondition(node.left)} || ${this.genCondition(node.right)})`;
        case '??': return `(${a} ?? ${b})`;
        case '+': return `$R.add(${a}, ${b})`;
        default: return `(${a} ${node.operator} ${b})`;
      }
    }

    genMember(node, forWrite) {
      // global.foo
      if (node.object.type === 'Identifier' && node.object.name === 'global') {
        return `$G.${node.property}`;
      }
      // Enum member folds to its numeric value.
      if (node.object.type === 'Identifier' && this.enums[node.object.name]) {
        const v = this.enums[node.object.name][node.property];
        if (v !== undefined) return numLit(v);
      }
      // e__VW.HView and friends stay as-is; gml_runtime.js defines the enum.
      const objJs = this.genExpr(node.object);
      return `${this.deref(objJs)}.${node.property}`;
    }

    /**
     * In GML a raw instance id is a valid instance reference: `target.__scipt = x`
     * works when `target` holds an id rather than the instance itself. JS can't
     * do that, so anything that isn't already known to be an object gets routed
     * through $R.d, which maps an id back to its instance.
     */
    deref(js) {
      if (/^\$[so]\d+$/.test(js)) return js;              // current self / other
      if (js === '$G' || js === 'this') return js;
      if (js.indexOf('$R.o(') === 0) return js;           // object reference
      if (js.indexOf('$R.d(') === 0) return js;           // already dereferenced
      return `$R.d(${js})`;
    }

    genIndexRead(node) {
      const objJs = this.genExpr(node.object);
      const idx = node.indices.map(i => this.genExpr(i));
      switch (node.kind) {
        case 'grid': return `$R.gridGet(${objJs}, ${idx.join(', ')})`;
        case 'list': return `$R.listGet(${objJs}, ${idx[0]})`;
        case 'map': return `$R.mapGet(${objJs}, ${idx[0]})`;
        case 'struct': return `$R.structGet(${objJs}, ${idx[0]})`;
        default: return `$R.ig(${objJs}, ${idx.join(', ')})`;
      }
    }

    genFunction(node) {
      this.pushScope();
      const params = [];
      const defaults = [];
      for (const prm of node.params) {
        this.declareLocal(prm.name);
        const nm = this.localName(prm.name);
        params.push(nm);
        if (prm.default) defaults.push(`if (${nm} === undefined) ${nm} = ${this.genExpr(prm.default)};`);
      }
      this.indent++;
      const hoist = this.hoistDecl(node.body.body);
      const body = this.genStatements(node.body.body);
      this.indent--;
      this.popScope();
      const dp = (defaults.length ? '  '.repeat(this.indent + 1) + defaults.join(' ') + '\n' : '') + hoist;
      // An arrow keeps the enclosing self binding, which is what GML 2.3 methods do.
      return `((${params.join(', ')}) => {\n${dp}${body}\n${this.pad()}})`;
    }

    expandMacro(node) {
      if (this.macroDepth > 8) { this.warn(`macro ${node.name} recursed too deeply`); return '0'; }
      this.macroDepth++;
      let js;
      try {
        const parsed = global.GML_PARSE(node.body);
        const stmts = parsed.ast.body;
        if (stmts.length === 1 && stmts[0].type === 'ExpressionStatement') {
          js = `(${this.genExpr(stmts[0].expression)})`;
        } else {
          js = `(${this.genExpr({ type: 'Number', value: 0 })})`;
          this.warn(`macro ${node.name} is not a simple expression`);
        }
      } catch (e) {
        this.warn(`macro ${node.name} failed to parse: ${e.message}`);
        js = '0';
      }
      this.macroDepth--;
      return js;
    }

    // ── identifier resolution ─────────────────────────────────────────

    localName(name) { return JS_RESERVED.has(name) ? name + '$' : name; }

    /** 'local' | 'literal' | 'const' | 'asset-object' | 'asset-string' | 'script' | 'instance' */
    classifyIdent(name) {
      if (this.isLocal(name)) return 'local';
      if (name === 'global') return 'globalscope';
      if (Object.prototype.hasOwnProperty.call(LITERAL_IDENTS, name)) return 'literal';
      if (name === 'self' || name === 'other' || name === 'all' || name === 'noone') return 'special';
      if (BUILTIN_CONSTS.has(name)) return 'const';
      if (this.enums[name]) return 'enum';
      if (this.scripts.has && this.scripts.has(name)) return 'script';
      if (isObjectAsset(name)) return 'asset-object';
      if (isSpriteAsset(name)) return 'asset-string';
      if (ASSET_PREFIX.test(name)) return name.startsWith('obj_') ? 'asset-object' : 'asset-string';
      // A bare builtin name used as a value is a function reference, not an
      // instance variable: `scr_script_delayed(instance_destroy, 4)` passes the
      // function to be run later.
      if (BUILTIN_FNS.has(name) || SPECIAL_FNS.has(name)) return 'builtin-fn';
      return 'instance';
    }

    resolveIdent(name, forWrite) {
      const kind = this.classifyIdent(name);
      switch (kind) {
        case 'local': return this.localName(name);
        case 'literal': return LITERAL_IDENTS[name];
        // `global` as a bare identifier — `global.tempflag[96] = 0` reaches here
        // through the index-assignment path, which doesn't go via genMember.
        case 'globalscope': return '$G';
        case 'special':
          if (name === 'self') return this.self;
          if (name === 'other') return this.other;
          if (name === 'all') return '$R.ALL';
          return '(-4)';                      // noone
        case 'const': return name;
        case 'enum': return `/* enum */ 0`;
        case 'script': return `$R.scr[${JSON.stringify(name)}]`;
        case 'asset-object': return `$R.o(${JSON.stringify(name)})`;
        case 'asset-string': return JSON.stringify(name);
        case 'builtin-fn': return name;
        default:
          // Script-local `argumentN` in a compiled global script.
          if (this.isScript && /^argument(\d+)$/.test(name)) return this.localName(name);
          // GameMaker keeps image_number in sync with the assigned sprite. The
          // runtime stores instance state behind a Proxy whose set trap writes
          // straight to the target, so a prototype setter can't observe
          // `sprite_index = ...` — resolve the frame count on read instead.
          if (!forWrite && name === 'image_number') return `$R.imgnum(${this.self})`;
          this.instanceVars.add(name);
          return `${this.self}.${name}`;
      }
    }

    // ── calls ─────────────────────────────────────────────────────────

    genCall(node) {
      const callee = node.callee;
      const args = node.arguments;

      // `arr[i](...)` — an array of method values, called by index. This must
      // read the ELEMENT and call that; routing it through mcall with an empty
      // property name hands mcall the array itself, which isn't a function, so
      // the call silently evaluates to 0. obj_dw_fcastle_trainroom drives the
      // whole Orange & Green fight through `orangeBehaviors[n]()`, so a silent
      // no-op here costs the entire fight with no error anywhere.
      if (callee.type === 'Index') {
        return `$R.vcall(${this.genExpr(callee)}, [${args.map(a => this.genExpr(a)).join(', ')}], ${this.self})`;
      }

      // Method / struct call: leave the receiver in place.
      if (callee.type === 'Member') {
        if (callee.object.type === 'Identifier' && callee.object.name === 'global') {
          return `$G.${callee.property}(${args.map(a => this.genExpr(a)).join(', ')})`;
        }
        return `$R.mcall(${this.genExpr(callee.object)}, ${JSON.stringify(callee.property)}, [${args.map(a => this.genExpr(a)).join(', ')}], ${this.self})`;
      }

      if (callee.type !== 'Identifier') {
        return `(${this.genExpr(callee)})(${args.map(a => this.genExpr(a)).join(', ')})`;
      }

      const name = callee.name;
      const A = i => (args[i] === undefined ? 'undefined' : this.genExpr(args[i]));
      const all = () => args.map(a => this.genExpr(a)).join(', ');

      // A local variable holding a method takes precedence over any builtin.
      if (this.isLocal(name)) return `$R.vcall(${this.localName(name)}, [${all()}], ${this.self})`;

      switch (name) {
        case 'instance_create':
          return `$R.create(${A(0)}, ${A(1)}, ${A(2)}, undefined, ${this.self})`;
        case 'instance_create_depth':
          return `$R.create(${A(0)}, ${A(1)}, ${A(3)}, ${A(2)}, ${this.self})`;
        case 'scr_bullet_create':
          return `$R.create(${A(0)}, ${A(1)}, ${A(2)}, undefined, ${this.self})`;
        case 'scr_childbullet':
          return `$R.childBullet(${this.self}, ${A(0)}, ${A(1)}, ${A(2)})`;
        case 'instance_destroy':
          return args.length ? `$R.destroy(${A(0)})` : `$R.destroy(${this.self})`;
        case 'instance_exists':
        case 'i_ex':
          return `$R.exists(${A(0)})`;
        case 'instance_number':
          return `$R.count(${A(0)})`;
        case 'instance_find':
          return `$R.find(${A(0)}, ${A(1)})`;
        case 'event_user':
          return `$R.eventUser(${this.self}, ${A(0)})`;
        case 'event_inherited':
          return `$R.inherited(${this.self}, ${JSON.stringify(this.eventName || 'step')}, ${JSON.stringify(this.objectName || '')})`;
        case 'event_perform':
          return `$R.eventPerform(${this.self}, ${A(0)}, ${A(1)})`;
        case 'draw_self':
          // Not `self.drawSelf(...)` directly: a `with` target can be something
          // the runtime aliases in (the SOUL, the battle box) that may not carry
          // the method.
          return `$R.drawSelf(${this.self})`;
        case 'scr_bullet_init':
          return `$R.bulletInit(${this.self})`;
        case 'string':
          return `$R.str(${all()})`;
        case 'power':
          return `Math.pow(${A(0)}, ${A(1)})`;
        case 'sqr':
          return `$R.sqr(${A(0)})`;
        case 'show_debug_message':
          return `$R.debug(${all()})`;
        case 'array_length':
        case 'array_length_1d':
          return `$R.alen(${A(0)})`;
        case 'array_length_2d':
          return `$R.alen2(${A(0)}, ${A(1)})`;
        case 'array_create':
          return `$R.acreate(${A(0)}, ${args.length > 1 ? A(1) : '0'})`;
        case 'variable_instance_exists':
          return `$R.hasVar(${A(0)}, ${A(1)})`;
        case 'variable_instance_get':
          return `$R.getVar(${A(0)}, ${A(1)})`;
        case 'variable_instance_set':
          return `$R.setVar(${A(0)}, ${A(1)}, ${A(2)})`;
        case 'script_execute':
          return `$R.scriptExecute(${this.self}${args.length ? ', ' + all() : ''})`;
      }

      // Object-reference arguments must be normalised: the decompiled GML
      // sometimes passes a raw asset index where an object is expected.
      if (OBJ_ARG_POS[name] !== undefined) {
        const pos = OBJ_ARG_POS[name];
        const parts = args.map((a, i) => (i === pos ? `$R.oref(${this.genExpr(a)})` : this.genExpr(a)));
        if (this.scripts.has && this.scripts.has(name)) {
          return `$R.scrCall(${JSON.stringify(name)}, ${this.self}, [${parts.join(', ')}])`;
        }
        if (BUILTIN_FNS.has(name) || typeof global[name] === 'function') {
          return needsSelf(name)
            ? `${name}.call(${this.self}${parts.length ? ', ' + parts.join(', ') : ''})`
            : `${name}(${parts.join(', ')})`;
        }
        this.warn(`unknown function ${name}()`);
        return `$R.miss(${JSON.stringify(name)}, ${this.self}, [${parts.join(', ')}])`;
      }

      // A compiled GlobalScript is preferred over any native stub of the same
      // name: it's the actual shipped GML. $R.scrCall falls back to $R.miss if
      // the script table didn't load, so a missing table can't crash the event.
      if (this.scripts.has && this.scripts.has(name)) {
        return `$R.scrCall(${JSON.stringify(name)}, ${this.self}, [${all()}])`;
      }

      // A name in BUILTIN_FNS is guaranteed to exist on window, because
      // GML_HELPERS.ensureBuiltins() installs a stub for any the runtime lacks.
      // That guarantee is what makes a direct `name(...)` safe; without it this
      // check depended on script load order, and core math like irandom() would
      // silently degrade to a stub returning 0 — which corrupts loop bounds.
      if (BUILTIN_FNS.has(name) || typeof global[name] === 'function') {
        // Only bind `this` for the functions that read instance state
        // (scr_sneo_wall_create, scr_enemy_object_init, scr_afterimage, ...).
        // Pure helpers stay plain calls, which keeps the emitted JS readable.
        return needsSelf(name)
          ? `${name}.call(${this.self}${args.length ? ', ' + all() : ''})`
          : `${name}(${all()})`;
      }

      // Resolved at call time against `self` then globals ($R.miss). A name some
      // object declares as its own method is expected to land there, so don't
      // report it as unknown — `with (photo) DoFlip(1)` is a method call, not a
      // missing function.
      if (!this.methods.has(name)) this.warn(`unknown function ${name}()`);
      return `$R.miss(${JSON.stringify(name)}, ${this.self}, [${all()}])`;
    }

  }

  /** Argument slot that names an object, for calls we pass straight through. */
  const OBJ_ARG_POS = {
    instance_nearest: 2, instance_furthest: 2, instance_place: 2, instance_position: 2,
    collision_rectangle: 4, collision_circle: 3, collision_line: 4, collision_point: 2,
    collision_ellipse: 4, place_meeting: 2, position_meeting: 2,
    distance_to_object: 0, object_get_name: 0, object_get_parent: 0,
    scr_fire_bullet: 2, scr_bulletspawner: 2, scr_custom_afterimage: 0,
    instance_change: 0, instance_copy: 0,
  };

  function isObjectAsset(name) {
    if (typeof global.GML_OBJECT_INDEX !== 'undefined' && global.GML_OBJECT_INDEX.isObject) {
      return global.GML_OBJECT_INDEX.isObject(name);
    }
    return /^obj_/.test(name);
  }

  /** Exact match against sprites we have art for — catches the handful that
   *  don't use the `spr_` prefix without the guesswork. */
  function isSpriteAsset(name) {
    return !!(global.GML_SPRITE_ORIGINS && global.GML_SPRITE_ORIGINS[name]);
  }

  /**
   * Functions that read or mutate the calling instance, so they need `this`
   * bound to the current self. Every `scr_*` counts: Deltarune's scripts are
   * legacy scripts that run in the caller's scope by definition.
   */
  const SELF_FNS = new Set([
    'draw_self', 'event_user', 'event_inherited', 'event_perform',
    'instance_destroy', 'place_meeting', 'position_meeting', 'move_towards_point',
    'move_snap', 'move_wrap', 'move_bounce_all', 'move_bounce_solid',
    'motion_add', 'motion_set', 'distance_to_point', 'distance_to_object',
    'instance_change', 'box_bonk',
    // Collision family: `notme` and the place_* origin are relative to the
    // calling instance, so these must run with `this` bound to it.
    'collision_rectangle', 'collision_circle', 'collision_line', 'collision_point',
    'collision_ellipse', 'instance_place', 'instance_position',
    'instance_nearest', 'instance_furthest',
  ]);

  function needsSelf(name) { return name.indexOf('scr_') === 0 || SELF_FNS.has(name); }

  function numLit(v) {
    if (typeof v !== 'number' || !isFinite(v)) return '0';
    if (Number.isInteger(v)) return String(v);
    return String(v);
  }

  global.GMLCodegen = Codegen;
  global.GML_BUILTIN_FNS = BUILTIN_FNS;
  global.GML_BUILTIN_CONSTS = BUILTIN_CONSTS;

})(typeof window !== 'undefined' ? window : globalThis);
