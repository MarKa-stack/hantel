# Minimaler statischer Webserver fuer lokales Testen (kein Node/Python noetig).
# Hinweis: Datei bewusst ohne Umlaute, damit Windows PowerShell 5.1 sie ohne BOM korrekt liest.
# Aufruf: powershell -File tools\serve.ps1 [-Port 8080]
param([int]$Port = 8080)

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.png' = 'image/png'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.pdf' = 'application/pdf'
  '.txt' = 'text/plain; charset=utf-8'; '.md' = 'text/markdown; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Hantel laeuft auf http://localhost:$Port/  (Ordner: $root)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    try {
      # Test-Upload: POST /__save?name=x.png schreibt den Body nach test/out/ (nur fuer lokale Tests)
      if ($req.HttpMethod -eq 'POST' -and $req.Url.AbsolutePath -eq '/__save') {
        $name = [IO.Path]::GetFileName($req.QueryString['name'])
        $outDir = Join-Path $root 'test\out'
        if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
        $ms = New-Object IO.MemoryStream
        $req.InputStream.CopyTo($ms)
        [IO.File]::WriteAllBytes((Join-Path $outDir $name), $ms.ToArray())
        $bytes = [Text.Encoding]::UTF8.GetBytes("saved " + $ms.Length)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        Write-Host ("POST /__save " + $name + " " + $ms.Length + " bytes")
        continue
      }
      $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
      if ($rel -eq '' -or $rel.EndsWith('/')) { $rel += 'index.html' }
      $file = Join-Path $root ($rel -replace '/', '\')
      $full = [IO.Path]::GetFullPath($file)
      if (-not $full.StartsWith($root) -or -not (Test-Path $full -PathType Leaf)) {
        $res.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes("404 - $rel nicht gefunden")
      } else {
        $ext = [IO.Path]::GetExtension($full).ToLower()
        $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $bytes = [IO.File]::ReadAllBytes($full)
      }
      $res.Headers['Cache-Control'] = 'no-store'
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host ("{0} {1} {2}" -f $res.StatusCode, $req.HttpMethod, $req.Url.AbsolutePath)
    } catch {
      Write-Host "Fehler: $_"
      try { $res.StatusCode = 500 } catch {}
    } finally {
      try { $res.OutputStream.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
}
