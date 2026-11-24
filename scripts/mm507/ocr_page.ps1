# Windows 내장 문자 인식(영어)으로 그림 한 장을 읽어 낱말과 위치를 JSON으로 저장한다.
# Windows PowerShell 5.1 에서 실행: powershell.exe -NoProfile -File scripts/mm507/ocr_page.ps1 <그림.png> <출력.json>
param([string]$ImagePath, [string]$OutPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]

$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}

$full = (Resolve-Path $ImagePath).Path
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($full)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('en-US'))
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

$lines = foreach ($line in $result.Lines) {
  $ws = foreach ($w in $line.Words) {
    [ordered]@{ t = $w.Text; x = [math]::Round($w.BoundingRect.X); y = [math]::Round($w.BoundingRect.Y); w = [math]::Round($w.BoundingRect.Width); h = [math]::Round($w.BoundingRect.Height) }
  }
  [ordered]@{ text = $line.Text; words = @($ws) }
}
$out = [ordered]@{ width = $bitmap.PixelWidth; height = $bitmap.PixelHeight; lines = @($lines) }
$json = $out | ConvertTo-Json -Depth 6 -Compress
[System.IO.File]::WriteAllText($OutPath, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("ocr " + $result.Lines.Count + " lines -> " + $OutPath)
