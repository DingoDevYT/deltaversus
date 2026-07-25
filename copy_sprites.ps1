$dest = 'c:\Users\lando\Desktop\DeltaVersus\docs\sprites'
if (-not (Test-Path -Path $dest)) {
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
}

$ch3_dir = 'c:\Users\lando\Desktop\DELTARUNE - EXPORT\DELTARUNE Chapter 3 - EXPORT\sprites'
$ch4_dir = 'c:\Users\lando\Desktop\DELTARUNE - EXPORT\DELTARUNE Chapter 4 - EXPORT\sprites'
$ch2_dir = 'c:\Users\lando\Desktop\DELTARUNE - EXPORT\DELTARUNE Chapter 2 - EXPORT\sprites'

$ch3_patterns = @(
    'spr_knight_bullet_star_*.png',
    'spr_knight_bullet_star_easy_*.png',
    'spr_knight_bullet_star_hard_a_*.png',
    'spr_knight_bullet_star_hard_b_*.png',
    'spr_knight_bullet_star_mask_*.png',
    'spr_knight_starchild_*.png',
    'spr_knight_starchild_parts_*.png',
    'spr_knight_starchild_trail_*.png',
    'spr_knight_crescentslash_*.png',
    'spr_knight_slash_mark_*.png',
    'spr_rk_quickslash_*.png',
    'spr_rk_quickslash_marker_*.png',
    'spr_rk_quickslash_upper_*.png',
    'spr_rk_quickslash_lower_*.png',
    'spr_rk_fountain_bullet_*.png',
    'spr_rk_fountain_bullet_big_*.png',
    'spr_rk_slash_heartslice_*.png',
    'spr_roaringknight_flurry_*.png',
    'spr_roaringknight_tooth_*.png',
    'spr_heart_*.png'
)

$ch4_patterns = @(
    'spr_gerson_hammer_bullet_*.png',
    'spr_gerson_hammer_bullet3557_*.png',
    'spr_gerson_swing_down_loop_new_*.png',
    'spr_gerson_spin_*.png',
    'spr_gerson_landing_dust_*.png',
    'spr_gerson_shadow_leap_*.png',
    'spr_gerson_teleport_*.png'
)

$ch2_patterns = @(
    'spr_sneo_head_*.png',
    'spr_sneo_bomb_*.png',
    'spr_sneo_phone_*.png',
    'spr_sneo_phonebullet_*.png',
    'spr_sneo_neobuster_*.png',
    'spr_sneo_neobuster_bouncy_*.png',
    'spr_sneo_bigshot_l_*.png',
    'spr_sneo_bigshot_s_*.png',
    'spr_sneo_wireheart_*.png'
)

$copiedCount = 0

foreach ($pattern in $ch3_patterns) {
    $files = Get-ChildItem -Path $ch3_dir -Filter $pattern -File
    foreach ($file in $files) {
        Copy-Item -Path $file.FullName -Destination $dest -Force
        $copiedCount++
    }
}

foreach ($pattern in $ch4_patterns) {
    $files = Get-ChildItem -Path $ch4_dir -Filter $pattern -File
    foreach ($file in $files) {
        Copy-Item -Path $file.FullName -Destination $dest -Force
        $copiedCount++
    }
}

foreach ($pattern in $ch2_patterns) {
    $files = Get-ChildItem -Path $ch2_dir -Filter $pattern -File
    foreach ($file in $files) {
        Copy-Item -Path $file.FullName -Destination $dest -Force
        $copiedCount++
    }
}

Write-Host "Total files copied: $copiedCount"
Write-Host "--- Files in Destination ---"
Get-ChildItem -Path $dest | Select-Object -ExpandProperty Name
