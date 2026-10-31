param([Parameter(Mandatory=$true)][string]$Url)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class ReversiWindow { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); }'
$scope=[System.Windows.Automation.TreeScope]::Descendants
$ae=[System.Windows.Automation.AutomationElement]
function ById($root,$id) {
    $root.FindFirst($scope,[System.Windows.Automation.PropertyCondition]::new($ae::AutomationIdProperty,$id))
}
function Value($element) {
    $element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value
}
function SelectedOption($root,$id) {
    $expand=(ById $root $id).GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
    if($expand.Current.ExpandCollapseState -eq [System.Windows.Automation.ExpandCollapseState]::Collapsed){$expand.Expand()}
    try {
        for($i=0;$i -lt 20;$i++) {
            Start-Sleep -Milliseconds 100
            $items=$root.FindAll($scope,[System.Windows.Automation.PropertyCondition]::new($ae::ControlTypeProperty,[System.Windows.Automation.ControlType]::ListItem))
            foreach($item in $items) {
                if($item.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Current.IsSelected){return $item.Current.Name}
            }
        }
        throw "Selected option absent: $id"
    } finally {$expand.Collapse()}
}
function SelectOption($root,$id,$prefix) {
    $combo=ById $root $id
    $expand=$combo.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
    if($expand.Current.ExpandCollapseState -eq [System.Windows.Automation.ExpandCollapseState]::Collapsed){$expand.Expand()}
    $item=@()
    for($i=0;$i -lt 20;$i++) {
        Start-Sleep -Milliseconds 100
        $items=$root.FindAll($scope,[System.Windows.Automation.PropertyCondition]::new($ae::ControlTypeProperty,[System.Windows.Automation.ControlType]::ListItem))
        $item=@($items | Where-Object {$_.Current.Name.StartsWith($prefix)})
        if($item.Count -eq 1){break}
    }
    if($item.Count -ne 1){throw "Option not unique: $id / $prefix"}
    $item[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    if($expand.Current.ExpandCollapseState -eq [System.Windows.Automation.ExpandCollapseState]::Expanded){$expand.Collapse()}
}
function WaitMetric($root,$id,$pattern) {
    for($i=0;$i -lt 100;$i++) {
        $node=ById $root $id
        if($node -and $node.Current.Name -match $pattern){return $node.Current.Name}
        # Chromium omits some paragraph IDs from Windows UI Automation. Read
        # their actual rendered text, using the complete metric's wording.
        $texts=$root.FindAll($scope,[System.Windows.Automation.PropertyCondition]::new($ae::ControlTypeProperty,[System.Windows.Automation.ControlType]::Text))
        $match=@($texts | Where-Object {$_.Current.Name -match $pattern})
        if($match.Count -eq 1){return $match[0].Current.Name}
        Start-Sleep -Milliseconds 100
    }
    throw "Metric not ready: $id / $pattern"
}
$port=([Uri]$Url).Port
$window=$null
foreach($process in (Get-Process msedge,chrome -ErrorAction SilentlyContinue | Where-Object MainWindowHandle -ne 0)) {
    $root=$ae::FromHandle($process.MainWindowHandle)
    $edits=$root.FindAll($scope,[System.Windows.Automation.PropertyCondition]::new($ae::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit))
    foreach($edit in $edits) {
        $p=$null
        if($edit.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$p) -and $p.Current.Value -match "^http[s]?://127\.0\.0\.1:$port/?$|^127\.0\.0\.1:$port/?$") {
            $window=$root;$pidOwned=$process.Id;break
        }
    }
    if($window){break}
}
if(-not $window){throw 'Actual default-browser URL not found'}
foreach($id in @('evaluator','computer-time')) {
    $expand=(ById $window $id).GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
    if($expand.Current.ExpandCollapseState -eq [System.Windows.Automation.ExpandCollapseState]::Expanded){$expand.Collapse()}
}
$title=$window.Current.Name
$board=ById $window 'board'
if(-not $board){throw 'Game board absent'}
$cells=$board.FindAll($scope,[System.Windows.Automation.PropertyCondition]::new($ae::ControlTypeProperty,[System.Windows.Automation.ControlType]::DataItem))
if($cells.Count -ne 64){throw 'Expected 64 board cells'}
$originalEvaluator=SelectedOption $window 'evaluator'
$originalTime=SelectedOption $window 'computer-time'
(ById $window 'new-game').GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
$checks=@()
try {
    foreach($model in @('B','L','P')) {
        SelectOption $window 'evaluator' "$model "
        $checks+=WaitMetric $window 'search-metrics' "^$model.*WebAssembly.*search nodes.*Equal depth for all moves"
    }
    SelectOption $window 'computer-time' '80 ms'
    $move=$window.FindFirst($scope,[System.Windows.Automation.PropertyCondition]::new($ae::NameProperty,'D3: legal move'))
    if(-not $move){throw 'Opening D3 absent'}
    # Chromium's gridcell Invoke can select without activating the underlying
    # button. Send Enter to that exact, focused cell in our URL-verified window.
    $null=[ReversiWindow]::SetForegroundWindow([IntPtr]$window.Current.NativeWindowHandle)
    $move.SetFocus()
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    $reply=WaitMetric $window 'play-metrics' '^Last computer search: P.*WebAssembly'
    $turn=WaitMetric $window 'turn-title' '^Black to move$'
    $names=@($window.FindAll($scope,[System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object {$_.Current.Name})
    $history=@($names | Where-Object {$_ -match '^\d+\. [BW] [A-H][1-8]$'})
    if($history.Count -ne 2){throw 'Expected human move and computer reply'}
    $result=[pscustomobject]@{passed=$true;url=$Url;pid=$pidOwned;title=$title;boardCells=64;coaching=$checks;computerReply=$reply;turn=$turn;history=$history;originalEvaluator=$originalEvaluator;originalTime=$originalTime}
} finally {
    # Restore preferences in the user's ordinary profile; never close another tab.
    SelectOption $window 'evaluator' $originalEvaluator
    SelectOption $window 'computer-time' $originalTime
}
$tabs=$window.FindAll($scope,[System.Windows.Automation.PropertyCondition]::new($ae::ControlTypeProperty,[System.Windows.Automation.ControlType]::TabItem))
if($tabs.Count -gt 1){throw 'Do not close a window with unrelated tabs'}
$window.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern).Close()
$result | Add-Member -NotePropertyName ownedWindowClosed -NotePropertyValue $true
$result | ConvertTo-Json -Depth 5 -Compress
