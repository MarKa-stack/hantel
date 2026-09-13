# Erzeugt die PNG-Icons (Hantel-Symbol auf orangem Grund) ohne externe Tools.
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\icons'

function Draw-Icon([int]$size, [string]$file, [double]$pad = 0, [bool]$rounded = $true) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)

  $bg = [System.Drawing.Color]::FromArgb(255, 0xFF, 0x5C, 0x35)
  $brush = New-Object System.Drawing.SolidBrush $bg
  if ($rounded) {
    $r = [int]($size * 0.22)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $r*2, $r*2, 180, 90)
    $path.AddArc($size - $r*2, 0, $r*2, $r*2, 270, 90)
    $path.AddArc($size - $r*2, $size - $r*2, $r*2, $r*2, 0, 90)
    $path.AddArc(0, $size - $r*2, $r*2, $r*2, 90, 90)
    $path.CloseFigure()
    $g.FillPath($brush, $path)
  } else {
    $g.FillRectangle($brush, 0, 0, $size, $size)
  }

  # Hantel: Koordinaten im 64er-Raster, skaliert und mit Padding
  $scale = ($size * (1 - 2 * $pad)) / 64.0
  $off = $size * $pad
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $parts = @(
    @(6, 26, 5, 12, 2), @(12, 20, 8, 24, 2.5), @(20, 29, 24, 6, 2), @(44, 20, 8, 24, 2.5), @(53, 26, 5, 12, 2)
  )
  foreach ($p in $parts) {
    $x = $off + $p[0] * $scale; $y = $off + $p[1] * $scale
    $w = $p[2] * $scale; $hh = $p[3] * $scale; $rr = $p[4] * $scale
    $rp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rp.AddArc($x, $y, $rr*2, $rr*2, 180, 90)
    $rp.AddArc($x + $w - $rr*2, $y, $rr*2, $rr*2, 270, 90)
    $rp.AddArc($x + $w - $rr*2, $y + $hh - $rr*2, $rr*2, $rr*2, 0, 90)
    $rp.AddArc($x, $y + $hh - $rr*2, $rr*2, $rr*2, 90, 90)
    $rp.CloseFigure()
    $g.FillPath($white, $rp)
  }

  $g.Dispose()
  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  "erzeugt: $file ($size px)"
}

Draw-Icon 192 'icon-192.png' 0 $true
Draw-Icon 512 'icon-512.png' 0 $true
Draw-Icon 512 'icon-maskable-512.png' 0.12 $false
Draw-Icon 180 'apple-touch-icon.png' 0 $false
