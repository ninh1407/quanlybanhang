$ErrorActionPreference = 'SilentlyContinue'

function Stop-By-PathLike($pattern) {
  Get-Process | ForEach-Object {
    try {
      $p = $_
      $path = $p.Path
      if ($path -and $path -like $pattern) {
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
      }
    } catch {
    }
  }
}

function Stop-By-Name($names) {
  foreach ($n in $names) {
    try {
      Stop-Process -Name $n -Force -ErrorAction SilentlyContinue
    } catch {
    }
  }
}

Stop-By-PathLike '*\release_v3\win-unpacked\*'
Stop-By-Name @('electron', 'NamPhuong')

try {
  Remove-Item -Recurse -Force 'release_v3\win-unpacked' -ErrorAction SilentlyContinue
} catch {
}

Write-Host 'cleanup done'

