using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace BurnTheWebSaver
{
    // A Windows screen saver (.scr) that hosts the self-contained burnTheWeb
    // canvas demo in a WebView2 (Edge/Chromium) control, so the effect renders
    // with full fidelity. Implements the three standard screen-saver modes:
    //   /s            run full screen (also the Settings "Preview" button)
    //   /p <hwnd>     render into the small preview thumbnail
    //   /c[:<hwnd>]   show the configuration dialog (Settings button, no options)
    internal static class Program
    {
        [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int vKey);
        [DllImport("user32.dll")] private static extern bool GetCursorPos(out POINT p);
        [DllImport("user32.dll")] private static extern IntPtr SetParent(IntPtr child, IntPtr parent);
        [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr hWnd, out RECT r);
        [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr hWnd);
        [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr hWnd, int nIndex);
        [DllImport("user32.dll")] private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

        [StructLayout(LayoutKind.Sequential)] private struct POINT { public int X, Y; }
        [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left, Top, Right, Bottom; }

        private const int GWL_STYLE = -16;
        private const int WS_CHILD = 0x40000000;
        private const int WS_POPUP = unchecked((int)0x80000000);

        private static string s_htmlPath;
        private static string s_userDataFolder;
        private static readonly List<Form> s_forms = new List<Form>();
        private static POINT s_startCursor;
        private static int s_guardMs;
        private static bool s_baselineSet;

        private static readonly string s_logPath =
            Path.Combine(Path.GetTempPath(), "burnTheWebSaver", "log.txt");
        private static void Log(string msg)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(s_logPath));
                File.AppendAllText(s_logPath,
                    DateTime.Now.ToString("HH:mm:ss.fff") + " " + msg + Environment.NewLine);
            }
            catch { }
        }

        [STAThread]
        private static void Main()
        {
            try { Main2(); }
            catch (Exception ex) { Log("FATAL " + ex); throw; }
        }

        private static void Main2()
        {
            Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            PrepareAssets();

            string mode = "c";
            IntPtr targetHwnd = IntPtr.Zero;
            string[] args = Environment.GetCommandLineArgs();
            if (args.Length > 1)
            {
                string a = args[1].Trim().ToLowerInvariant();
                if (a.StartsWith("/s")) mode = "s";
                else if (a.StartsWith("/p")) { mode = "p"; targetHwnd = ParseHwnd(a, args); }
                else mode = "c"; // /c, /c:hwnd, or anything else
            }

            switch (mode)
            {
                case "s": RunFullScreen(); break;
                case "p": RunPreview(targetHwnd); break;
                default: RunConfig(); break;
            }
        }

        private static IntPtr ParseHwnd(string firstArg, string[] args)
        {
            string num = null;
            int colon = firstArg.IndexOf(':');
            if (colon >= 0 && colon + 1 < firstArg.Length) num = firstArg.Substring(colon + 1);
            else if (args.Length > 2) num = args[2];
            long h;
            if (!string.IsNullOrEmpty(num) && long.TryParse(num.Trim(), out h)) return new IntPtr(h);
            return IntPtr.Zero;
        }

        // Extract the embedded index.html to a temp folder and pick a WebView2
        // user-data folder there (needs to be writable).
        private static void PrepareAssets()
        {
            string dir = Path.Combine(Path.GetTempPath(), "burnTheWebSaver");
            Directory.CreateDirectory(dir);
            s_userDataFolder = Path.Combine(dir, "wv2");
            s_htmlPath = Path.Combine(dir, "index.html");

            Assembly asm = Assembly.GetExecutingAssembly();
            string resName = null;
            foreach (string n in asm.GetManifestResourceNames())
            {
                if (n.EndsWith("index.html", StringComparison.OrdinalIgnoreCase)) { resName = n; break; }
            }
            if (resName == null) return;
            using (Stream s = asm.GetManifestResourceStream(resName))
            using (FileStream f = File.Create(s_htmlPath))
            {
                s.CopyTo(f);
            }
        }

        private static WebView2 MakeView()
        {
            var wv = new WebView2
            {
                Dock = DockStyle.Fill,
                DefaultBackgroundColor = Color.Black,
                CreationProperties = new CoreWebView2CreationProperties { UserDataFolder = s_userDataFolder }
            };
            wv.CoreWebView2InitializationCompleted += async (sender, e) =>
            {
                if (!e.IsSuccess)
                {
                    Log("WebView2 init failed: " + e.InitializationException);
                    return;
                }
                CoreWebView2Settings st = wv.CoreWebView2.Settings;
                st.AreDefaultContextMenusEnabled = false;
                st.AreDevToolsEnabled = false;
                st.IsZoomControlEnabled = false;
                st.IsStatusBarEnabled = false;
                st.AreBrowserAcceleratorKeysEnabled = false;
                st.IsPasswordAutosaveEnabled = false;
                // Hide the on-screen menu chrome — a screen saver has no interactive
                // controls (any input exits it). Injected before page scripts run.
                await wv.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(
                    "document.addEventListener('DOMContentLoaded',function(){" +
                    "var s=document.createElement('style');" +
                    "s.textContent='#toggle{display:none!important}#panel{display:none!important}';" +
                    "document.head.appendChild(s);});");
                wv.CoreWebView2.Navigate(new Uri(s_htmlPath).AbsoluteUri);
            };
            wv.EnsureCoreWebView2Async();
            return wv;
        }

        // ---- /s : full screen on every monitor, exit on any input ----
        private static void RunFullScreen()
        {
            Cursor.Hide();
            foreach (Screen screen in Screen.AllScreens)
            {
                var f = new Form
                {
                    FormBorderStyle = FormBorderStyle.None,
                    StartPosition = FormStartPosition.Manual,
                    Bounds = screen.Bounds,
                    BackColor = Color.Black,
                    TopMost = true,
                    ShowInTaskbar = false
                };
                f.Controls.Add(MakeView());
                s_forms.Add(f);
            }

            s_guardMs = 0;
            s_baselineSet = false;
            var timer = new Timer { Interval = 100 };
            timer.Tick += (sender, e) =>
            {
                s_guardMs += 100;
                if (s_guardMs < 1200) return;         // let launch keystroke / cursor settle
                if (!s_baselineSet)                    // capture cursor baseline once, after settling
                {
                    GetCursorPos(out s_startCursor);
                    s_baselineSet = true;
                    return;
                }
                if (InputDetected()) { timer.Stop(); ExitAll(); }
            };
            timer.Start();

            foreach (Form f in s_forms) f.Show();
            if (s_forms.Count > 0) s_forms[0].Activate();
            Application.Run();
        }

        private static bool InputDetected()
        {
            POINT p;
            GetCursorPos(out p);
            if (Math.Abs(p.X - s_startCursor.X) > 8 || Math.Abs(p.Y - s_startCursor.Y) > 8) return true;
            for (int vk = 0x01; vk <= 0xFE; vk++)
            {
                if ((GetAsyncKeyState(vk) & 0x8000) != 0) return true;
            }
            return false;
        }

        private static void ExitAll()
        {
            try { Cursor.Show(); } catch { }
            foreach (Form f in new List<Form>(s_forms))
            {
                try { f.Close(); } catch { }
            }
            Application.Exit();
        }

        // ---- /p : render into the little Settings preview window ----
        private static void RunPreview(IntPtr parent)
        {
            if (parent == IntPtr.Zero || !IsWindow(parent)) return;
            RECT rc;
            GetClientRect(parent, out rc);

            var f = new Form
            {
                FormBorderStyle = FormBorderStyle.None,
                StartPosition = FormStartPosition.Manual,
                Bounds = new Rectangle(0, 0, rc.Right - rc.Left, rc.Bottom - rc.Top),
                BackColor = Color.Black
            };
            f.Controls.Add(MakeView());

            IntPtr handle = f.Handle; // force creation
            int style = GetWindowLong(handle, GWL_STYLE);
            style = (style & ~WS_POPUP) | WS_CHILD;
            SetWindowLong(handle, GWL_STYLE, style);
            SetParent(handle, parent);
            f.Location = new Point(0, 0);
            f.Show();

            var timer = new Timer { Interval = 500 };
            timer.Tick += (sender, e) => { if (!IsWindow(parent)) { timer.Stop(); Application.Exit(); } };
            timer.Start();
            Application.Run();
        }

        // ---- /c : configuration dialog ----
        private static void RunConfig()
        {
            MessageBox.Show(
                "burnTheWeb screen saver\n\n" +
                "A demoscene fire seeded by an animated Sierpinski triangle, with an\n" +
                "alternate animated Julia-set mode. Palettes auto-morph on their own.\n\n" +
                "There is nothing to configure here. To watch it full screen, right-click\n" +
                "the .scr file and choose \"Test\", or select it in Screen Saver Settings.",
                "burnTheWeb", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }
}
