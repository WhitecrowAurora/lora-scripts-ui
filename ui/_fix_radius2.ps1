$lines = [System.IO.File]::ReadAllLines('ui/src/style.css')
$remove = @(3313,3347,3358,3380,3416,3437,3443,3447,3461,3476)
$result = [System.Collections.Generic.List[string]]::new()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if (-not ($remove -contains ($i + 1))) {
        $result.Add($lines[$i])
    }
}
[System.IO.File]::WriteAllLines('ui/src/style.css', $result.ToArray(), [System.Text.UTF8Encoding]::new($false))
Write-Host "Removed $($remove.Count) lines, new total: $($result.Count)"
