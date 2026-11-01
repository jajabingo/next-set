# Tiny static file server for local development (no Node/Python needed).
# Usage: powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8080]
param([int]$Port = 8080)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"; ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"; ".svg" = "image/svg+xml"; ".ico" = "image/x-icon"
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path.EndsWith("/")) { $path += "index.html" }
    $file = [System.IO.Path]::GetFullPath((Join-Path $root $path.TrimStart("/")))

    if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
      $body = [System.IO.File]::ReadAllBytes($file)
      $type = $types[[System.IO.Path]::GetExtension($file).ToLower()]
      if (-not $type) { $type = "application/octet-stream" }
      $res.StatusCode = 200
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
      $type = "text/plain"
      $res.StatusCode = 404
    }
    $res.ContentType = $type
    $res.Headers.Add("Cache-Control", "no-store")
    $res.ContentLength64 = $body.Length
    if ($ctx.Request.HttpMethod -ne "HEAD") { $res.OutputStream.Write($body, 0, $body.Length) }
  } catch {
    Write-Host "Request error: $($_.Exception.Message)"
  } finally {
    $res.Close()
  }
}
