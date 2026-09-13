# Erzeugt ein einfaches Test-PDF (Trainingsplan) ohne externe Tools.
# Datei bewusst ASCII-only; Umlaute werden ueber [char]-Codes eingesetzt.
param([string]$Out = (Join-Path $PSScriptRoot '..\test\trainingsplan-test.pdf'))

# Achtung: PowerShell-Variablen sind case-insensitive, daher eindeutige Namen
$ue = [char]0xFC; $ae = [char]0xE4; $agrave = [char]0xE0; $capU = [char]0xDC; $dash = [char]0x2013

# Zeilen: @(x, y, groesse, text)
$lines = @(
  @(50, 790, 18, "Trainingsplan Push / Pull / Legs"),
  @(50, 770, 10, "Pause zwischen den S${ae}tzen: 90 s, sofern nicht anders angegeben"),

  @(50, 735, 14, "Tag A $dash Push"),
  @(50, 712, 11, "${capU}bung"), @(250, 712, 11, "S${ae}tze"), @(320, 712, 11, "Wdh"), @(390, 712, 11, "Gewicht"), @(470, 712, 11, "Pause"),
  @(50, 694, 11, "Bankdr${ue}cken"), @(250, 694, 11, "3"), @(320, 694, 11, "8-10"), @(390, 694, 11, "60 kg"), @(470, 694, 11, "90 s"),
  @(50, 676, 11, "Schulterdr${ue}cken"), @(250, 676, 11, "3"), @(320, 676, 11, "12"), @(390, 676, 11, "30 kg"), @(470, 676, 11, "60 s"),
  @(50, 658, 11, "Dips"), @(250, 658, 11, "3"), @(320, 658, 11, "AMRAP"), @(390, 658, 11, "-"), @(470, 658, 11, "90 s"),
  @(50, 640, 11, "Trizepsdr${ue}cken am Kabel"), @(250, 640, 11, "3"), @(320, 640, 11, "15"), @(390, 640, 11, "25 kg"), @(470, 640, 11, "60 s"),

  @(50, 600, 14, "Tag B $dash Pull"),
  @(50, 578, 11, "1. Klimmz${ue}ge 4x6"),
  @(50, 560, 11, "2. Langhantelrudern 3 x 10 @ 50kg"),
  @(50, 542, 11, "3. Facepulls 3 x 15 Wdh, Pause 60s"),
  @(50, 524, 11, "4. Bizepscurls 3 S${ae}tze ${agrave} 12 Wiederholungen (12 kg)"),

  @(50, 484, 14, "Tag C $dash Beine"),
  @(50, 462, 11, "Kniebeugen: 5 S${ae}tze ${agrave} 5 Wdh (80 kg)"),
  @(50, 444, 11, "Beinpresse 3x12"),
  @(50, 426, 11, "Wadenheben"),
  @(50, 408, 11, "4 x 15"),
  @(50, 390, 11, "Plank 3 x 45 s"),

  @(50, 340, 10, "Viel Erfolg beim Training!")
)

$content = New-Object System.Text.StringBuilder
foreach ($l in $lines) {
  $t = $l[3] -replace '\\', '\\\\' -replace '\(', '\(' -replace '\)', '\)'
  [void]$content.Append("BT /F1 $($l[2]) Tf $($l[0]) $($l[1]) Td ($t) Tj ET`n")
}
$enc = [System.Text.Encoding]::GetEncoding(1252)
$contentBytes = $enc.GetBytes($content.ToString())

$objs = @(
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  $null, # Stream, separat
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
)

$ms = New-Object System.IO.MemoryStream
$w = { param($s) $b = $enc.GetBytes($s); $ms.Write($b, 0, $b.Length) }
& $w "%PDF-1.4`n"
$offsets = @()
for ($i = 0; $i -lt $objs.Count; $i++) {
  $offsets += $ms.Position
  $n = $i + 1
  if ($n -eq 4) {
    & $w "$n 0 obj`n<< /Length $($contentBytes.Length) >>`nstream`n"
    $ms.Write($contentBytes, 0, $contentBytes.Length)
    & $w "`nendstream`nendobj`n"
  } else {
    & $w "$n 0 obj`n$($objs[$i])`nendobj`n"
  }
}
$xref = $ms.Position
& $w "xref`n0 $($objs.Count + 1)`n0000000000 65535 f `n"
foreach ($o in $offsets) { & $w ("{0:D10} 00000 n `n" -f $o) }
& $w "trailer`n<< /Size $($objs.Count + 1) /Root 1 0 R >>`nstartxref`n$xref`n%%EOF`n"

$dir = Split-Path $Out
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
[IO.File]::WriteAllBytes((Resolve-Path -LiteralPath $dir).Path + '\' + (Split-Path $Out -Leaf), $ms.ToArray())
"PDF geschrieben: $Out ($($ms.Length) Bytes)"
