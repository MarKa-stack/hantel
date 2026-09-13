# Erzeugt iOS-Startbilder (apple-touch-startup-image): dunkler Hintergrund + App-Icon mittig.
# Datei bewusst ASCII-only (Windows PowerShell 5.1 liest ohne BOM als ANSI).
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\icons\splash'
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }

# Breite, Hoehe (Pixel, Portrait), CSS-Breite, CSS-Hoehe, DPR
$sizes = @(
  @(1320, 2868, 440, 956, 3),  # iPhone 16 Pro Max
  @(1206, 2622, 402, 874, 3),  # iPhone 16 Pro
  @(1290, 2796, 430, 932, 3),  # iPhone 14/15 Pro Max, 15 Plus, 16 Plus
  @(1179, 2556, 393, 852, 3),  # iPhone 14 Pro, 15, 15 Pro, 16
  @(1170, 2532, 390, 844, 3),  # iPhone 12/13/14
  @(1284, 2778, 428, 926, 3),  # iPhone 12/13 Pro Max, 14 Plus
  @(1125, 2436, 375, 812, 3),  # iPhone X/XS/11 Pro, 12/13 mini
  @(1242, 2688, 414, 896, 3),  # iPhone XS Max, 11 Pro Max
  @(828, 1792, 414, 896, 2),   # iPhone XR, 11
  @(1242, 2208, 414, 736, 3),  # iPhone 6+/7+/8+
  @(750, 1334, 375, 667, 2)    # iPhone 6/7/8/SE2/SE3
)

function RoundedRect([System.Drawing.Graphics]$g, [System.Drawing.Brush]$brush, [double]$x, [double]$y, [double]$w, [double]$h, [double]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, $r*2, $r*2, 180, 90)
  $p.AddArc($x + $w - $r*2, $y, $r*2, $r*2, 270, 90)
  $p.AddArc($x + $w - $r*2, $y + $h - $r*2, $r*2, $r*2, 0, 90)
  $p.AddArc($x, $y + $h - $r*2, $r*2, $r*2, 90, 90)
  $p.CloseFigure()
  $g.FillPath($brush, $p)
}

$links = @()
foreach ($s in $sizes) {
  $w = $s[0]; $h = $s[1]
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::FromArgb(255, 0x0F, 0x11, 0x15))

  # Icon: 22% der Breite, mittig, leicht oberhalb der Mitte
  $size = [int]($w * 0.22)
  $x = ($w - $size) / 2; $y = ($h - $size) / 2 - $size * 0.15
  $accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0xFF, 0x5C, 0x35))
  RoundedRect $g $accent $x $y $size $size ($size * 0.22)
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $scale = $size / 64.0
  $parts = @(@(6, 26, 5, 12, 2), @(12, 20, 8, 24, 2.5), @(20, 29, 24, 6, 2), @(44, 20, 8, 24, 2.5), @(53, 26, 5, 12, 2))
  foreach ($p in $parts) {
    RoundedRect $g $white ($x + $p[0] * $scale) ($y + $p[1] * $scale) ($p[2] * $scale) ($p[3] * $scale) ($p[4] * $scale)
  }

  # Wortmarke
  $font = New-Object System.Drawing.Font 'Segoe UI', ([int]($w * 0.045)), ([System.Drawing.FontStyle]::Bold)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = 'Center'
  $g.DrawString('Hantel', $font, $white, (New-Object System.Drawing.PointF ($w / 2), ($y + $size + $size * 0.25)), $fmt)

  $g.Dispose()
  $name = "splash-$($w)x$($h).png"
  $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $links += "  <link rel=`"apple-touch-startup-image`" media=`"(device-width: $($s[2])px) and (device-height: $($s[3])px) and (-webkit-device-pixel-ratio: $($s[4])) and (orientation: portrait)`" href=`"./icons/splash/$name`">"
  "erzeugt: $name"
}
$links -join "`n" | Set-Content -Path (Join-Path $out 'links.html') -Encoding UTF8
"Link-Tags: icons\splash\links.html"
