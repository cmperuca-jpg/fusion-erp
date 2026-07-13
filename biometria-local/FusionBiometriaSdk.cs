using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

internal static class Native {
    public const uint OK = 0;
    public const uint PARAM_CB_FRAME_SOURCE = 4;
    public const uint PARAM_CB_CONTROL = 5;
    public const uint PARAM_MAX_TEMPLATE_SIZE = 6;
    public const uint PARAM_MAX_FARN_REQUESTED = 8;
    public const uint PARAM_MAX_MODELS = 10;
    public const uint FRAME_SOURCE_USB = 1;
    public const uint PURPOSE_IDENTIFY = 2;
    public const uint PURPOSE_ENROLL = 3;
    public const uint CONTINUE = 2;

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct FTR_DATA { public uint dwSize; public IntPtr pData; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct FTR_ENROLL_DATA { public uint dwSize; public uint dwQuality; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct FTR_IDENTIFY_RECORD { public uint KeyValue; public IntPtr pData; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct FTR_IDENTIFY_ARRAY { public uint TotalNumber; public IntPtr pMembers; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct FTR_MATCHED_X_RECORD { public uint KeyValue; public uint FarAttained; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct FTR_MATCHED_X_ARRAY { public uint TotalNumber; public IntPtr pMembers; }

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    public delegate void StateControl(IntPtr context, uint stateMask, ref uint response, uint signal, IntPtr bitmap);

    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)] public static extern uint FTRInitialize();
    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)] public static extern void FTRTerminate();
    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)] public static extern uint FTRSetParam(uint param, IntPtr value);
    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)] public static extern uint FTRGetParam(uint param, out uint value);
    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)] public static extern uint FTREnrollX(IntPtr ctx, uint purpose, ref FTR_DATA templateData, ref FTR_ENROLL_DATA enrollData);
    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)] public static extern uint FTREnroll(IntPtr ctx, uint purpose, ref FTR_DATA templateData);
    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)] public static extern uint FTRSetBaseTemplate(ref FTR_DATA templateData);
    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)] public static extern uint FTRIdentifyN(ref FTR_IDENTIFY_ARRAY source, ref uint matchCount, ref FTR_MATCHED_X_ARRAY matches);
}

internal sealed class Engine : IDisposable {
    private readonly object sync = new object();
    private Native.StateControl callback;
    private bool initialized;
    public string LastSignal = "";

    public Engine() {
        callback = Callback;
        uint rc = Native.FTRInitialize();
        if (rc != Native.OK) throw new InvalidOperationException("FTRInitialize falhou. Código: " + rc);
        initialized = true;
        Check(Native.FTRSetParam(Native.PARAM_CB_FRAME_SOURCE, new IntPtr(Native.FRAME_SOURCE_USB)), "Configurar leitor USB");
        IntPtr fn = Marshal.GetFunctionPointerForDelegate(callback);
        Check(Native.FTRSetParam(Native.PARAM_CB_CONTROL, fn), "Configurar callback");
    }

    private void Callback(IntPtr context, uint stateMask, ref uint response, uint signal, IntPtr bitmap) {
        LastSignal = signal == 1 ? "toque_o_sensor" : signal == 2 ? "retire_o_dedo" : "capturando";
        response = Native.CONTINUE;
    }

    private static void Check(uint rc, string op) { if (rc != Native.OK) throw new InvalidOperationException(op + " falhou. Código Futronic: " + rc); }

    private uint TemplateSize(uint models) {
        Check(Native.FTRSetParam(Native.PARAM_MAX_MODELS, new IntPtr(models)), "Definir quantidade de amostras");
        uint size;
        Check(Native.FTRGetParam(Native.PARAM_MAX_TEMPLATE_SIZE, out size), "Obter tamanho do template");
        if (size == 0 || size > 1024 * 1024) throw new InvalidOperationException("Tamanho de template inválido: " + size);
        return size;
    }

    public Dictionary<string, object> Enroll() {
        lock (sync) {
            uint size = TemplateSize(3);
            IntPtr mem = Marshal.AllocHGlobal((int)size);
            try {
                Native.FTR_DATA data = new Native.FTR_DATA { dwSize = size, pData = mem };
                Native.FTR_ENROLL_DATA info = new Native.FTR_ENROLL_DATA { dwSize = (uint)Marshal.SizeOf(typeof(Native.FTR_ENROLL_DATA)), dwQuality = 0 };
                uint rc = Native.FTREnrollX(IntPtr.Zero, Native.PURPOSE_ENROLL, ref data, ref info);
                Check(rc, "Cadastro biométrico");
                if (data.dwSize == 0 || data.dwSize > size) throw new InvalidOperationException("SDK retornou template inválido.");
                byte[] bytes = new byte[data.dwSize];
                Marshal.Copy(mem, bytes, 0, bytes.Length);
                return new Dictionary<string, object> {
                    {"ok", true}, {"templateBase64", Convert.ToBase64String(bytes)}, {"templateBytes", bytes.Length},
                    {"qualidadeSdk", info.dwQuality}, {"qualidadePercentual", Math.Min(100, (int)info.dwQuality * 10)},
                    {"motor", "FTRAPI.dll"}, {"templateVersion", 2}
                };
            } finally { Marshal.FreeHGlobal(mem); }
        }
    }

    public Dictionary<string, object> Identify(List<Dictionary<string, object>> templates) {
        lock (sync) {
            if (templates == null || templates.Count == 0) return Result(false, "digital_nao_encontrada", null, 0);
            uint liveSize = TemplateSize(1);
            IntPtr liveMem = Marshal.AllocHGlobal((int)liveSize);
            var allocated = new List<IntPtr>();
            try {
                Native.FTR_DATA live = new Native.FTR_DATA { dwSize = liveSize, pData = liveMem };
                Check(Native.FTREnroll(IntPtr.Zero, Native.PURPOSE_IDENTIFY, ref live), "Captura para identificação");
                Check(Native.FTRSetBaseTemplate(ref live), "Definir template base");

                int dataSize = Marshal.SizeOf(typeof(Native.FTR_DATA));
                int recSize = Marshal.SizeOf(typeof(Native.FTR_IDENTIFY_RECORD));
                IntPtr recordsMem = Marshal.AllocHGlobal(recSize * templates.Count); allocated.Add(recordsMem);
                var ids = new Dictionary<uint, string>();

                for (int i = 0; i < templates.Count; i++) {
                    string b64 = Convert.ToString(templates[i]["templateBase64"]);
                    string alunoId = Convert.ToString(templates[i]["alunoId"]);
                    byte[] t = Convert.FromBase64String(b64);
                    IntPtr tMem = Marshal.AllocHGlobal(t.Length); allocated.Add(tMem); Marshal.Copy(t, 0, tMem, t.Length);
                    IntPtr dataMem = Marshal.AllocHGlobal(dataSize); allocated.Add(dataMem);
                    var td = new Native.FTR_DATA { dwSize = (uint)t.Length, pData = tMem };
                    Marshal.StructureToPtr(td, dataMem, false);
                    uint key = (uint)(i + 1); ids[key] = alunoId;
                    var rec = new Native.FTR_IDENTIFY_RECORD { KeyValue = key, pData = dataMem };
                    Marshal.StructureToPtr(rec, IntPtr.Add(recordsMem, i * recSize), false);
                }

                var source = new Native.FTR_IDENTIFY_ARRAY { TotalNumber = (uint)templates.Count, pMembers = recordsMem };
                int matchRecSize = Marshal.SizeOf(typeof(Native.FTR_MATCHED_X_RECORD));
                IntPtr matchMem = Marshal.AllocHGlobal(matchRecSize * Math.Min(10, templates.Count)); allocated.Add(matchMem);
                var matchArray = new Native.FTR_MATCHED_X_ARRAY { TotalNumber = (uint)Math.Min(10, templates.Count), pMembers = matchMem };
                uint matchCount = 0;
                // FAR numérico pequeno = política conservadora; falha fechada quando não há correspondência.
                Native.FTRSetParam(Native.PARAM_MAX_FARN_REQUESTED, new IntPtr(21474837));
                Check(Native.FTRIdentifyN(ref source, ref matchCount, ref matchArray), "Identificação 1:N");
                if (matchCount == 0) return Result(false, "digital_nao_encontrada", null, 0);
                var best = (Native.FTR_MATCHED_X_RECORD)Marshal.PtrToStructure(matchMem, typeof(Native.FTR_MATCHED_X_RECORD));
                string found = ids.ContainsKey(best.KeyValue) ? ids[best.KeyValue] : null;
                return Result(!String.IsNullOrEmpty(found), found == null ? "digital_nao_encontrada" : "identificada", found, best.FarAttained);
            } finally {
                foreach (IntPtr p in allocated) if (p != IntPtr.Zero) Marshal.FreeHGlobal(p);
                Marshal.FreeHGlobal(liveMem);
            }
        }
    }

    private static Dictionary<string, object> Result(bool ok, string status, string alunoId, uint far) {
        return new Dictionary<string, object> { {"ok", true}, {"identificada", ok}, {"status", status}, {"alunoId", alunoId}, {"farNumerico", far}, {"motor", "FTRAPI-1N"} };
    }

    public void Dispose() { if (initialized) { Native.FTRTerminate(); initialized = false; } }
}

internal static class Program {
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 64 * 1024 * 1024 };
    static Engine engine;
    static readonly object MonitorSync = new object();
    static volatile bool monitorAtivo;
    static Thread monitorThread;
    static List<Dictionary<string, object>> monitorTemplates = new List<Dictionary<string, object>>();
    static Dictionary<string, object> ultimoEvento = new Dictionary<string, object> {
        {"sequencia", 0}, {"tipo", "inicial"}, {"identificada", false}, {"alunoId", null},
        {"status", "desativada"}, {"criadoEm", DateTime.UtcNow.ToString("o")}
    };
    static int sequenciaEvento;

    static void PublicarEvento(Dictionary<string, object> resultado) {
        lock (MonitorSync) {
            sequenciaEvento++;
            ultimoEvento = new Dictionary<string, object> {
                {"sequencia", sequenciaEvento},
                {"tipo", "identificacao"},
                {"identificada", resultado.ContainsKey("identificada") && Convert.ToBoolean(resultado["identificada"])},
                {"alunoId", resultado.ContainsKey("alunoId") ? resultado["alunoId"] : null},
                {"status", resultado.ContainsKey("status") ? resultado["status"] : "desconhecido"},
                {"farNumerico", resultado.ContainsKey("farNumerico") ? resultado["farNumerico"] : 0},
                {"criadoEm", DateTime.UtcNow.ToString("o")}
            };
        }
    }

    static void MonitorLoop() {
        while (monitorAtivo) {
            try {
                List<Dictionary<string, object>> copia;
                lock (MonitorSync) {
                    copia = new List<Dictionary<string, object>>(monitorTemplates);
                }

                if (copia.Count == 0) {
                    Thread.Sleep(1000);
                    continue;
                }

                Dictionary<string, object> resultado = engine.Identify(copia);
                if (!monitorAtivo) break;
                PublicarEvento(resultado);
                Thread.Sleep(resultado.ContainsKey("identificada") && Convert.ToBoolean(resultado["identificada"]) ? 1800 : 350);
            } catch (Exception ex) {
                lock (MonitorSync) {
                    sequenciaEvento++;
                    ultimoEvento = new Dictionary<string, object> {
                        {"sequencia", sequenciaEvento}, {"tipo", "erro"}, {"identificada", false},
                        {"alunoId", null}, {"status", "erro"}, {"mensagem", ex.Message},
                        {"criadoEm", DateTime.UtcNow.ToString("o")}
                    };
                }
                Thread.Sleep(1200);
            }
        }
    }

    static Dictionary<string, object> IniciarMonitor(List<Dictionary<string, object>> templates) {
        lock (MonitorSync) {
            monitorTemplates = templates ?? new List<Dictionary<string, object>>();
            monitorAtivo = true;
            if (monitorThread == null || !monitorThread.IsAlive) {
                monitorThread = new Thread(MonitorLoop);
                monitorThread.IsBackground = true;
                monitorThread.Name = "FusionBiometriaMonitor";
                monitorThread.Start();
            }
        }
        return new Dictionary<string, object> {
            {"ok", true}, {"ativo", true}, {"templates", monitorTemplates.Count},
            {"mensagem", "Monitor biométrico contínuo ativado."}
        };
    }

    static Dictionary<string, object> PararMonitor() {
        monitorAtivo = false;
        return new Dictionary<string, object> {
            {"ok", true}, {"ativo", false},
            {"mensagem", "Monitor biométrico desativado. A captura atual pode terminar antes de apagar o leitor."}
        };
    }

    static Dictionary<string, object> StatusMonitor() {
        lock (MonitorSync) {
            return new Dictionary<string, object> {
                {"ok", true}, {"ativo", monitorAtivo},
                {"templates", monitorTemplates.Count},
                {"threadAtiva", monitorThread != null && monitorThread.IsAlive},
                {"sinal", engine == null ? "" : engine.LastSignal},
                {"ultimoEvento", ultimoEvento}
            };
        }
    }

    static void Main() {
        AppDomain.CurrentDomain.UnhandledException += delegate(object s, UnhandledExceptionEventArgs e) { File.AppendAllText("biometria-sdk-error.log", DateTime.Now + " " + e.ExceptionObject + Environment.NewLine); };
        try { engine = new Engine(); }
        catch (Exception ex) { Console.Error.WriteLine(ex); Environment.Exit(2); return; }
        var listener = new HttpListener(); listener.Prefixes.Add("http://127.0.0.1:3041/"); listener.Start();
        Console.WriteLine("Fusion Biometria SDK ativo em http://127.0.0.1:3041/ | motor FTRAPI 1:N");
        try { while (true) Handle(listener.GetContext()); }
        finally { monitorAtivo = false; listener.Close(); engine.Dispose(); }
    }

    static void Handle(HttpListenerContext ctx) {
        try {
            string path = ctx.Request.Url.AbsolutePath.ToLowerInvariant();
            if (ctx.Request.HttpMethod == "OPTIONS") { Send(ctx, 200, new { ok = true }); return; }
            if (path == "/status") { Send(ctx, 200, new { ok = true, conectado = true, motor = "FTRAPI", templatesReais = true, identificacao1N = true, arquitetura = "x86", sinal = engine.LastSignal }); return; }
            if (path == "/monitor/status") { Send(ctx, 200, StatusMonitor()); return; }
            if (path == "/monitor/start" && ctx.Request.HttpMethod == "POST") {
                var body = ReadBody(ctx);
                var obj = Json.Deserialize<Dictionary<string, object>>(body);
                var list = new List<Dictionary<string, object>>();
                object raw;
                if (obj != null && obj.TryGetValue("templates", out raw)) {
                    var arr = raw as ArrayList;
                    if (arr != null) foreach (object item in arr) {
                        var d = item as Dictionary<string, object>;
                        if (d != null && d.ContainsKey("alunoId") && d.ContainsKey("templateBase64")) list.Add(d);
                    }
                }
                Send(ctx, 200, IniciarMonitor(list));
                return;
            }
            if (path == "/monitor/stop" && ctx.Request.HttpMethod == "POST") {
                Send(ctx, 200, PararMonitor());
                return;
            }
            if (path == "/monitor/event") {
                int after = 0;
                Int32.TryParse(ctx.Request.QueryString["after"], out after);
                Dictionary<string, object> evento;
                lock (MonitorSync) { evento = new Dictionary<string, object>(ultimoEvento); }
                int atual = evento.ContainsKey("sequencia") ? Convert.ToInt32(evento["sequencia"]) : 0;
                Send(ctx, 200, new { ok = true, novo = atual > after, evento = evento });
                return;
            }
                        if (path == "/sdk/enroll" && ctx.Request.HttpMethod == "POST") { Send(ctx, 200, engine.Enroll()); return; }
            if (path == "/sdk/identify" && ctx.Request.HttpMethod == "POST") {
                var body = ReadBody(ctx);
                var obj = Json.Deserialize<Dictionary<string, object>>(body);
                var list = new List<Dictionary<string, object>>();
                object raw; if (obj != null && obj.TryGetValue("templates", out raw)) {
                    var arr = raw as ArrayList; if (arr != null) foreach (object item in arr) {
                        var d = item as Dictionary<string, object>; if (d != null) list.Add(d);
                    }
                }
                Send(ctx, 200, engine.Identify(list)); return;
            }
            Send(ctx, 404, new { ok = false, mensagem = "Rota não encontrada." });
        } catch (Exception ex) { Send(ctx, 500, new { ok = false, mensagem = ex.Message }); }
    }

    static string ReadBody(HttpListenerContext c) { using (var r = new StreamReader(c.Request.InputStream, c.Request.ContentEncoding ?? Encoding.UTF8)) return r.ReadToEnd(); }
    static void Send(HttpListenerContext c, int status, object payload) {
        byte[] b = Encoding.UTF8.GetBytes(Json.Serialize(payload)); c.Response.StatusCode = status; c.Response.ContentType = "application/json; charset=utf-8";
        c.Response.Headers["Access-Control-Allow-Origin"] = "*"; c.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type"; c.Response.Headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS";
        c.Response.ContentLength64 = b.Length; c.Response.OutputStream.Write(b, 0, b.Length); c.Response.OutputStream.Close();
    }
}
