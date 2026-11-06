# What else is busy on the machine (lib.sh's qa_machine_state), or the priority of the emulator on a port
# (qa_priority): powershell -File machine.ps1 [-Port 5554 -Priority High|Normal]
param([int]$Port = 0, [string]$Priority = "")
$qemu = Get-CimInstance Win32_Process -Filter "name like 'qemu-system%'"
if ($Port -gt 0) {
  $qemu | Where-Object { $_.CommandLine -match "-port $Port( |$)" } | ForEach-Object { (Get-Process -Id $_.ProcessId).PriorityClass = $Priority }
  exit 0
}
$cpu = (Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 3).CounterSamples | Measure-Object -Property CookedValue -Average
$emus = ($qemu | ForEach-Object { if ($_.CommandLine -match '-avd (\S+) -port (\d+)') { "$($matches[1]) on $($matches[2])" } }) -join ', '
$builds = (Get-ChildItem C:\b -Filter *.lock -ErrorAction SilentlyContinue | ForEach-Object { $_.Name -replace '\.lock$', '' }) -join ', '
if (-not $builds) { $builds = 'none' }
"host CPU {0:N0}% busy; emulators running: {1}; builds running: {2}" -f $cpu.Average, $emus, $builds
