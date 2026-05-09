# Fix UTF-8 mojibake: em dash + left arrow in PaymentConfirm.tsx and api.ts
$ErrorActionPreference = 'Stop'

function Do-Replace([byte[]]$src, [byte[]]$find, [byte[]]$replace, [string]$label) {
    $result = New-Object System.Collections.Generic.List[byte]
    $i = 0
    $count = 0
    while ($i -lt $src.Length) {
        $match = $true
        if ($i + $find.Length -le $src.Length) {
            for ($j = 0; $j -lt $find.Length; $j++) {
                if ($src[$i + $j] -ne $find[$j]) { $match = $false; break }
            }
        } else { $match = $false }
        if ($match) {
            $result.AddRange($replace)
            $i += $find.Length
            $count++
        } else {
            $result.Add($src[$i])
            $i++
        }
    }
    Write-Host "  $label : $count replacements"
    return ,$result.ToArray()
}

# ---- PaymentConfirm.tsx ----
$file1 = 'c:\Users\ia-solution\CascadeProjects\HCS\payguard\src\pages\PaymentConfirm.tsx'
$data = [System.IO.File]::ReadAllBytes($file1)
Write-Host "PaymentConfirm.tsx: $($data.Length) bytes"

# em dash: C3 A2 E2 82 AC E2 80 9D -> E2 80 94
$data = Do-Replace $data @(0xC3,0xA2,0xE2,0x82,0xAC,0xE2,0x80,0x9D) @(0xE2,0x80,0x94) 'em-dash'

# left arrow: C3 A2 E2 80 A0 C2 90 -> E2 86 90
$data = Do-Replace $data @(0xC3,0xA2,0xE2,0x80,0xA0,0xC2,0x90) @(0xE2,0x86,0x90) 'left-arrow'

[System.IO.File]::WriteAllBytes($file1, $data)
Write-Host "Saved: $($data.Length) bytes`n"

# ---- api.ts ----
$file2 = 'c:\Users\ia-solution\CascadeProjects\HCS\payguard\src\services\api.ts'
$data2 = [System.IO.File]::ReadAllBytes($file2)
Write-Host "api.ts: $($data2.Length) bytes"

$data2 = Do-Replace $data2 @(0xC3,0xA2,0xE2,0x82,0xAC,0xE2,0x80,0x9D) @(0xE2,0x80,0x94) 'em-dash'

[System.IO.File]::WriteAllBytes($file2, $data2)
Write-Host "Saved: $($data2.Length) bytes`n"

Write-Host "All done."
