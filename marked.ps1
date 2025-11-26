(Get-Content .\docs\markedHeader.html) + (marked .\README-DEV.md) + (Get-Content .\docs\markedFooter.html) | Out-File .\docs\README-DEV.html -Encoding utf8
(Get-Content .\docs\markedHeader.html) + (marked .\README-DOCKER.md) + (Get-Content .\docs\markedFooter.html) | Out-File .\docs\README-DOCKER.html -Encoding utf8
(Get-Content .\docs\markedHeader.html) + (marked .\README-MACOS-PLIST.md) + (Get-Content .\docs\markedFooter.html) | Out-File .\docs\README-MACOS-PLIST.html -Encoding utf8
(Get-Content .\docs\markedHeader.html) + (marked .\README-NGINX.md) + (Get-Content .\docs\markedFooter.html) | Out-File .\docs\README-NGINX.html -Encoding utf8
(Get-Content .\docs\markedHeader.html) + (marked .\README-PODMAN.md) + (Get-Content .\docs\markedFooter.html) | Out-File .\docs\README-PODMAN.html -Encoding utf8
(Get-Content .\docs\markedHeader.html) + (marked .\README-SERVICE-LOCAL.md) + (Get-Content .\docs\markedFooter.html) | Out-File .\docs\README-SERVICE-LOCAL.html -Encoding utf8
(Get-Content .\docs\markedHeader.html) + (marked .\README-SERVICE-OPT.md) + (Get-Content .\docs\markedFooter.html) | Out-File .\docs\README-SERVICE-OPT.html -Encoding utf8
(Get-Content .\docs\markedHeader.html) + (marked .\README-SERVICE.md) + (Get-Content .\docs\markedFooter.html) | Out-File .\docs\README-SERVICE.html -Encoding utf8
(Get-Content .\docs\markedHeader.html) + (marked .\README.md) + (Get-Content .\docs\markedFooter.html) | Out-File .\docs\README.html -Encoding utf8
(Get-Content .\docs\markedHeader.html) + (marked .\CHANGELOG.md) + (Get-Content .\docs\markedFooter.html) | Out-File .\docs\CHANGELOG.html -Encoding utf8

# Replace links from .md to .html in generated files
Get-ChildItem -Path docs -Filter *.html -Recurse |
Where-Object { $_.Name -notin @('index.html', 'markedHeader.html', 'markedFooter.html', '404.html', 'CHANGELOG.html') } |
ForEach-Object { (Get-Content $_.FullName -Raw) -replace '\.md', '.html' | Set-Content -Encoding UTF8 $_.FullName }

# Replace links from → to -> in generated files
Get-ChildItem -Path docs -Filter *.html -Recurse |
Where-Object { $_.Name -notin @('index.html', 'markedHeader.html', 'markedFooter.html', '404.html', 'CHANGELOG.html') } |
ForEach-Object { (Get-Content $_.FullName -Raw) -replace 'ΓåÆ', '->' | Set-Content -Encoding UTF8 $_.FullName }

# Replace links from ✅ to '&#x2714;' in generated files
Get-ChildItem -Path docs -Filter *.html -Recurse |
Where-Object { $_.Name -notin @('index.html', 'markedHeader.html', 'markedFooter.html', '404.html', 'CHANGELOG.html') } |
ForEach-Object { (Get-Content $_.FullName -Raw) -replace 'Γ£à', '&#x2714;' | Set-Content -Encoding UTF8 $_.FullName }