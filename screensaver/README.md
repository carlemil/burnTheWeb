# burnTheWeb — Windows screen saver

A native Windows screen saver (`.scr`) that hosts the site's self-contained
[`index.html`](../index.html) in an embedded **Microsoft Edge (WebView2)**
surface, so the fire / Julia visual renders with full fidelity (canvas filters,
bloom glow and all) — identical to <https://carlemil.github.io/burnTheWeb/>.

It's a tiny .NET 9 WinForms host: the HTML is embedded as a resource, extracted
to `%TEMP%` at launch, and shown full screen. The whole implementation is one
file, [`Program.cs`](Program.cs).

## Screen-saver modes

Windows invokes a `.scr` with a mode flag, all handled here:

| Args          | Behaviour                                                     |
| ------------- | ------------------------------------------------------------ |
| `/s`          | Run full screen on every monitor; exit on any key / mouse.   |
| `/p <hwnd>`   | Render into the little preview thumbnail in Settings.        |
| `/c[:<hwnd>]` | Show the config dialog (an info box — there's nothing to set).|

The on-screen menu chrome (`#toggle` / `#panel`) is hidden via an injected style
so the saver stays clean, and any keypress or mouse movement exits it.

## Build

Needs the [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0). The
`NuGet.config` here points at nuget.org so the WebView2 package restores anywhere.

```sh
cd screensaver

# Framework-dependent single file (~1.4 MB). Needs the .NET 9 Desktop Runtime
# and the Edge WebView2 Runtime on the target machine (both ship with Win 11).
dotnet publish -c Release -r win-x64 --self-contained false \
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o publish

# Self-contained single file (~larger). Bundles the .NET runtime, so it only
# needs the Edge WebView2 Runtime (preinstalled on Windows 11).
dotnet publish -c Release -r win-x64 --self-contained true \
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true \
  -p:EnableCompressionInSingleFile=true -o publish-sc
```

Rename the produced `burnTheWeb.exe` to `burnTheWeb.scr`.

## Install

1. Put `burnTheWeb.scr` somewhere permanent (Windows runs it from wherever it lives).
2. Right-click it → **Test** (preview full screen) or **Install** (opens Screen
   Saver Settings with it pre-selected). Optionally copy it into
   `C:\Windows\System32` (admin) to have it listed by name.
