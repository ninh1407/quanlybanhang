$ErrorActionPreference = 'SilentlyContinue'

function Fix-Imports($dir, $depth) {
    $prefix = "../" * $depth
    $shared = $prefix + "shared/"
    
    Get-ChildItem -Path $dir -Filter *.tsx, *.ts -Recurse | ForEach-Object {
        $path = $_.FullName
        $content = Get-Content $path -Raw
        
        # Helper to escape dots and forward slashes for regex
        # We'll just use literal replace if possible, but -replace is regex.
        # So we escape . as \.
        
        # Domain types
        $content = $content -replace "from '\.\./domain/types'", "from '$($shared)types/domain'"
        $content = $content -replace 'from "\.\./domain/types"', "from `"$($shared)types/domain`""
        
        # State types/core/seed
        $content = $content -replace "from '\.\./state/types'", "from '$($shared)types/app'"
        $content = $content -replace 'from "\.\./state/types"', "from `"$($shared)types/app`""
        $content = $content -replace "from '\.\./state/core'", "from '$($shared)state/core'"
        $content = $content -replace 'from "\.\./state/core"', "from `"$($shared)state/core`""
        $content = $content -replace "from '\.\./state/seed'", "from '$($shared)state/seed'"
        $content = $content -replace 'from "\.\./state/seed"', "from `"$($shared)state/seed`""
        
        # Lib files
        $content = $content -replace "from '\.\./lib/date'", "from '$($shared)lib/date'"
        $content = $content -replace 'from "\.\./lib/date"', "from `"$($shared)lib/date`""
        $content = $content -replace "from '\.\./lib/id'", "from '$($shared)lib/id'"
        $content = $content -replace 'from "\.\./lib/id"', "from `"$($shared)lib/id`""
        $content = $content -replace "from '\.\./lib/money'", "from '$($shared)lib/money'"
        $content = $content -replace 'from "\.\./lib/money"', "from `"$($shared)lib/money`""

        # Domain rules
        $content = $content -replace "from '\.\./domain/orderWorkflow'", "from '$($shared)domain/orderWorkflow'"
        $content = $content -replace 'from "\.\./domain/orderWorkflow"', "from `"$($shared)domain/orderWorkflow`""
        
        $content | Set-Content $path
    }
}

# Depth 2 folders
Fix-Imports "src/pages" 2
Fix-Imports "src/auth" 2
Fix-Imports "src/state" 2
Fix-Imports "src/notifications" 2
Fix-Imports "src/licensing" 2
Fix-Imports "src/domain" 2
Fix-Imports "src/ui-kit" 2

# Depth 3 folders
Fix-Imports "src/components/products" 3

# Depth 1 files
Fix-Imports "src" 1
