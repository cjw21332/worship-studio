param([Parameter(Mandatory=$true)][string]$InputFile,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
$application=$null
$presentation=$null
try {
  $application=New-Object -ComObject PowerPoint.Application
  $application.AutomationSecurity=3
  $presentation=$application.Presentations.Open($InputFile,$true,$false,$false)
  $height=[int](1920 * $presentation.PageSetup.SlideHeight / $presentation.PageSetup.SlideWidth)
  $presentation.Export($OutputDirectory,'PNG',1920,$height)
} finally {
  if($presentation){$presentation.Close();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($presentation)}
  if($application){$application.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($application)}
}
