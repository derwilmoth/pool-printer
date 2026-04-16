param(
  [string]$BaseUrl = "http://localhost:3000/public",
  [string]$LaunchSecret = "CHANGE_ME_PUBLIC_LAUNCH_SECRET"
)

$ErrorActionPreference = "Stop"

function Get-NormalizedWindowsUser {
  $identityName = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

  if ([string]::IsNullOrWhiteSpace($identityName)) {
    $identityName = $env:USERNAME
  }

  if ([string]::IsNullOrWhiteSpace($identityName)) {
    throw "Could not resolve the current Windows user."
  }

  $user = $identityName.Trim()

  if ($user.Contains("\\")) {
    $user = $user.Split("\\")[-1]
  }

  if ($user.Contains("@")) {
    $user = $user.Split("@")[0]
  }

  $user = $user.Trim().ToLowerInvariant()

  if ([string]::IsNullOrWhiteSpace($user)) {
    throw "Could not normalize the current Windows user."
  }

  return $user
}

function Get-PublicUrlWithToken {
  param(
    [string]$Url,
    [string]$LaunchToken
  )

  $builder = [System.UriBuilder]::new($Url)
  $builder.Query = "launchToken=$([uri]::EscapeDataString($LaunchToken))"
  return $builder.Uri.AbsoluteUri
}

function Get-LaunchToken {
  param(
    [string]$PublicUrl,
    [string]$UserName,
    [string]$Secret
  )

  if ([string]::IsNullOrWhiteSpace($Secret) -or $Secret -eq "CHANGE_ME_PUBLIC_LAUNCH_SECRET") {
    throw "LaunchSecret is not configured. Set -LaunchSecret or edit launch-pool-printer.ps1."
  }

  $uri = [System.Uri]::new($PublicUrl)
  $launchEndpoint = "$($uri.Scheme)://$($uri.Authority)/api/public/launch"

  $payload = @{
    username = $UserName
    key = $Secret
  } | ConvertTo-Json

  $response = Invoke-RestMethod -Method Post -Uri $launchEndpoint -ContentType "application/json" -Body $payload

  if (-not $response.launchToken) {
    throw "Launch endpoint did not return a launchToken."
  }

  return [string]$response.launchToken
}

$userName = Get-NormalizedWindowsUser
$launchToken = Get-LaunchToken -PublicUrl $BaseUrl -UserName $userName -Secret $LaunchSecret
$targetUrl = Get-PublicUrlWithToken -Url $BaseUrl -LaunchToken $launchToken

Start-Process $targetUrl
