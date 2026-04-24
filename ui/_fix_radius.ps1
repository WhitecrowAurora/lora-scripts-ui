$lines = [System.IO.File]::ReadAllLines('ui/src/style.css')
$remove = @(3490,3494,3510,3527,3535,3545,3556,3578,3598,3607,3616,3622,3635,3640,3646,3651,3658,3667,3674,3687,3695,3715)
$result = [System.Collections.Generic.List[string]]::new()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if (-not ($remove -contains ($i + 1))) {
        $result.Add($lines[$i])
    }
}
[System.IO.File]::WriteAllLines('ui/src/style.css', $result.ToArray(), [System.Text.UTF8Encoding]::new($false))
Write-Host "Removed $($remove.Count) lines, new total: $($result.Count)"
