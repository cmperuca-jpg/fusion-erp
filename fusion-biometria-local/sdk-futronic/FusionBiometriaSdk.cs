using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using System.Threading.Tasks;

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

    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern uint FTRInitialize();

    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern void FTRTerminate();

    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern uint FTRSetParam(uint param, IntPtr value);

    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern uint FTRGetParam(uint param, out uint value);

    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern uint FTREnrollX(IntPtr ctx, uint purpose, ref FTR_DATA templateData, ref FTR_ENROLL_DATA enrollData);

    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern uint FTREnroll(IntPtr ctx, uint purpose, ref FTR_DATA templateData);

    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern uint FTRSetBaseTemplate(ref FTR_DATA templateData);

    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern uint FTRVerify(ref FTR_DATA templateData, [MarshalAs(UnmanagedType.Bool)] out bool result, out uint farAttained);

    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern uint FTRIdentifyN(ref FTR_IDENTIFY_ARRAY source, ref uint matchCount, ref FTR_MATCHED_X_ARRAY matches);
}

internal sealed class Engine : IDisposable {

    private sealed class TemplateCandidato {
        public string AlunoId;
        public Native.FTR_DATA Data;
    }

    private static void Log(string text)
    {
        try
        {
            File.AppendAllText(
                "fusion-biometria.log",
                DateTime.Now.ToString("s") + " " + text + Environment.NewLine
            );
        }
        catch
        {
        }
    }

    private Native.StateControl callback;
    private bool initialized;
    public string LastSignal = "";

    public Engine() {
        callback = Callback;
        Check(Native.FTRInitialize(), "Inicializar Futronic");
        initialized = true;
        Check(Native.FTRSetParam(Native.PARAM_CB_FRAME_SOURCE, new IntPtr(Native.FRAME_SOURCE_USB)), "Configurar USB");
        Check(Native.FTRSetParam(Native.PARAM_CB_CONTROL, Marshal.GetFunctionPointerForDelegate(callback)), "Configurar callback");
    }

    private void Callback(IntPtr context, uint stateMask, ref uint response, uint signal, IntPtr bitmap) {
        LastSignal = signal == 1 ? "toque_o_sensor" : signal == 2 ? "retire_o_dedo" : "capturando";
        response = Native.CONTINUE;
    }

    private static void Check(uint rc, string operation) {
        if (rc != Native.OK) throw new InvalidOperationException(operation + " falhou. Código Futronic: " + rc);
    }

    private uint TemplateSize(uint models) {
        Check(Native.FTRSetParam(Native.PARAM_MAX_MODELS, new IntPtr(models)), "Definir amostras");
        uint size;
        Check(Native.FTRGetParam(Native.PARAM_MAX_TEMPLATE_SIZE, out size), "Obter tamanho do template");
        if (size == 0 || size > 1048576) throw new InvalidOperationException("Tamanho de template inválido.");
        return size;
    }

    public Dictionary<string, object> Enroll() {
        uint size = TemplateSize(3);
        IntPtr mem = Marshal.AllocHGlobal((int)size);
        try {
            Native.FTR_DATA data = new Native.FTR_DATA { dwSize = size, pData = mem };
            Native.FTR_ENROLL_DATA info = new Native.FTR_ENROLL_DATA {
                dwSize = (uint)Marshal.SizeOf(typeof(Native.FTR_ENROLL_DATA)),
                dwQuality = 0
            };
            Check(Native.FTREnrollX(IntPtr.Zero, Native.PURPOSE_ENROLL, ref data, ref info), "Cadastro biométrico");
            if (data.dwSize == 0 || data.dwSize > size) throw new InvalidOperationException("Template inválido.");
            byte[] bytes = new byte[data.dwSize];
            Marshal.Copy(mem, bytes, 0, bytes.Length);
            return new Dictionary<string, object> {
                {"ok", true},
                {"templateBase64", Convert.ToBase64String(bytes)},
                {"templateBytes", bytes.Length},
                {"qualidadeSdk", info.dwQuality},
                {"qualidadePercentual", Math.Min(100, (int)info.dwQuality * 10)},
                {"motor", "FTRAPI-1N"},
                {"templateVersion", 2}
            };
        } finally {
            Marshal.FreeHGlobal(mem);
        }
    }

  public Dictionary<string, object> Identify(List<Dictionary<string, object>> templates) {

    Log("IDENTIFY ENGINE INICIO");

    if (templates == null || templates.Count == 0)
        return Result(false, null, 0);

        uint liveSize = TemplateSize(1);
        IntPtr liveMem = Marshal.AllocHGlobal((int)liveSize);
        List<IntPtr> allocated = new List<IntPtr>();
        List<TemplateCandidato> candidatos = new List<TemplateCandidato>();

        try {
            Native.FTR_DATA live = new Native.FTR_DATA { dwSize = liveSize, pData = liveMem };
            Log("ANTES FTREnroll");

Check(
    Native.FTREnroll(
        IntPtr.Zero,
        Native.PURPOSE_IDENTIFY,
        ref live
    ),
    "Captura para identificação"
);

Log("DEPOIS FTREnroll");

            int dataSize = Marshal.SizeOf(typeof(Native.FTR_DATA));
            int recordSize = Marshal.SizeOf(typeof(Native.FTR_IDENTIFY_RECORD));
            IntPtr recordsMem = Marshal.AllocHGlobal(recordSize * templates.Count);
            allocated.Add(recordsMem);

            Dictionary<uint, string> ids = new Dictionary<uint, string>();

            for (int i = 0; i < templates.Count; i++) {
                string alunoId = Convert.ToString(templates[i]["alunoId"]);
                byte[] templateBytes = Convert.FromBase64String(Convert.ToString(templates[i]["templateBase64"]));

                IntPtr templateMem = Marshal.AllocHGlobal(templateBytes.Length);
                allocated.Add(templateMem);
                Marshal.Copy(templateBytes, 0, templateMem, templateBytes.Length);

                IntPtr dataMem = Marshal.AllocHGlobal(dataSize);
                allocated.Add(dataMem);
                Native.FTR_DATA templateData = new Native.FTR_DATA {
                    dwSize = (uint)templateBytes.Length,
                    pData = templateMem
                };
                candidatos.Add(new TemplateCandidato {
                    AlunoId = alunoId,
                    Data = templateData
                });
                Marshal.StructureToPtr(templateData, dataMem, false);

                uint key = (uint)(i + 1);
                ids[key] = alunoId;
                Native.FTR_IDENTIFY_RECORD record = new Native.FTR_IDENTIFY_RECORD {
                    KeyValue = key,
                    pData = dataMem
                };
                Marshal.StructureToPtr(record, IntPtr.Add(recordsMem, i * recordSize), false);
            }

            Native.FTR_IDENTIFY_ARRAY source = new Native.FTR_IDENTIFY_ARRAY {
                TotalNumber = (uint)templates.Count,
                pMembers = recordsMem
            };

            int maxMatches = Math.Min(5, templates.Count);
            int matchSize = Marshal.SizeOf(typeof(Native.FTR_MATCHED_X_RECORD));
            IntPtr matchesMem = Marshal.AllocHGlobal(matchSize * maxMatches);
            allocated.Add(matchesMem);

            Native.FTR_MATCHED_X_ARRAY matches = new Native.FTR_MATCHED_X_ARRAY {
                TotalNumber = (uint)maxMatches,
                pMembers = matchesMem
            };

            // Limite mais rigoroso para evitar que qualquer dedo seja aceito.
            Native.FTRSetParam(Native.PARAM_MAX_FARN_REQUESTED, new IntPtr(1000000));

            uint matchCount = 0;
            Log("ANTES FTRIdentifyN");

Check(
    Native.FTRIdentifyN(
        ref source,
        ref matchCount,
        ref matches
    ),
    "Identificação 1:N"
);

Log("DEPOIS FTRIdentifyN");
Log("MATCH COUNT: " + matchCount);

            if (matchCount == 0) {
                Log("FTRIdentifyN sem match. Tentando FTRVerify sequencial.");
                foreach (TemplateCandidato candidato in candidatos) {
                    bool verificado;
                    uint farSequencial;
                    uint rcVerify = Native.FTRVerify(ref candidato.Data, out verificado, out farSequencial);
                    Log("FTRVerify aluno=" + candidato.AlunoId + " rc=" + rcVerify + " verificado=" + verificado + " far=" + farSequencial);
                    if (rcVerify == Native.OK && verificado) {
                        return Result(true, candidato.AlunoId, farSequencial);
                    }
                }
                return Result(false, null, 0);
            }

            Native.FTR_MATCHED_X_RECORD best =
                (Native.FTR_MATCHED_X_RECORD)Marshal.PtrToStructure(matchesMem, typeof(Native.FTR_MATCHED_X_RECORD));

            string found = ids.ContainsKey(best.KeyValue) ? ids[best.KeyValue] : null;
            return Result(!String.IsNullOrEmpty(found), found, best.FarAttained);
        } finally {
            foreach (IntPtr pointer in allocated) {
                if (pointer != IntPtr.Zero) Marshal.FreeHGlobal(pointer);
            }
            Marshal.FreeHGlobal(liveMem);
        }
    }

    private static Dictionary<string, object> Result(bool identified, string alunoId, uint far) {
        return new Dictionary<string, object> {
            {"ok", true},
            {"identificada", identified},
            {"status", identified ? "identificada" : "digital_nao_encontrada"},
            {"alunoId", alunoId},
            {"farNumerico", far},
            {"motor", "FTRAPI-1N"}
        };
    }

    public void Dispose() {
        if (initialized) {
            Native.FTRTerminate();
            initialized = false;
        }
    }
}

internal static class Program {
    private const string Version = "2.8.0-fluxo-simples";
    private static readonly JavaScriptSerializer Json =
        new JavaScriptSerializer { MaxJsonLength = 64 * 1024 * 1024 };
    private static readonly object EngineSync = new object();
    private static Engine engineInstance;

    private static void Main() {
        HttpListener listener = new HttpListener();
        listener.Prefixes.Add("http://127.0.0.1:3041/");

        listener.Start();
        Console.WriteLine("Fusion Biometria " + Version + " ativo em http://127.0.0.1:3041/");
        Log("HTTP ATIVO");

        while (true) {
            HttpListenerContext context = listener.GetContext();

            Task.Run(() =>
            {
                Handle(context);
            });
        }
    }

 private static Engine ObterEngine()
{
    lock (EngineSync)
    {
        if (engineInstance == null) engineInstance = new Engine();
        return engineInstance;
    }
}

 private static void ReiniciarEngine()
{
    lock (EngineSync)
    {
        try { if (engineInstance != null) engineInstance.Dispose(); } catch { }
        engineInstance = null;
    }
}

 private static void Handle(HttpListenerContext context)
{
    int status = 200;
    object payload;

    try
    {
        string path = context.Request.Url.AbsolutePath.ToLowerInvariant();
        string method = context.Request.HttpMethod.ToUpperInvariant();

        if (method == "OPTIONS")
        {
            payload = new Dictionary<string, object>
            {
                {"ok", true}
            };
        }
        else if (path == "/status")
        {
            payload = new Dictionary<string, object>
            {
                {"ok", true},
                {"conectado", true},
                {"motor", "FTRAPI-1N"},
                {"versao", Version},
                {"arquitetura", "x86"},
                {"sinal", engineInstance != null ? engineInstance.LastSignal : "aguardando_operacao"}
            };
        }
        else if (path == "/sdk/enroll" && method == "POST")
        {
            Log("ENROLL INICIO");

            lock (EngineSync)
            {
                payload = ObterEngine().Enroll();
            }

            Log("ENROLL FINALIZADO");
        }
        else if (path == "/sdk/identify" && method == "POST")
        {
            Log("IDENTIFY INICIO");

            Dictionary<string, object> body = ReadBody(context);

            List<Dictionary<string, object>> templates = ParseTemplates(body);

            Log("Templates recebidos: " + templates.Count);

            Task<Dictionary<string, object>> identifyTask =
                Task.Run(() =>
                {
                    lock (EngineSync)
                    {
                        return ObterEngine().Identify(templates);
                    }
                });

            if (!identifyTask.Wait(120000))
            {
                Log("IDENTIFY TIMEOUT");

                status = 408;

                payload = new Dictionary<string, object>
                {
                    {"ok", false},
                    {"mensagem", "Tempo limite aguardando identificação biométrica."}
                };
            }
            else
            {
                payload = identifyTask.Result;
            }
        }
        else
        {
            status = 404;

            payload = new Dictionary<string, object>
            {
                {"ok", false},
                {"mensagem", "Rota não encontrada."}
            };
        }
    }
    catch (Exception ex)
    {
        ReiniciarEngine();
        status = 500;

        payload = new Dictionary<string, object>
        {
            {"ok", false},
            {"mensagem", ex.Message}
        };

        Log("ERRO HTTP:");
        Log(ex.ToString());
    }

    Send(context, status, payload);
}

    private static Dictionary<string, object> ReadBody(HttpListenerContext context) {
        using (StreamReader reader = new StreamReader(
            context.Request.InputStream,
            context.Request.ContentEncoding ?? Encoding.UTF8
        )) {
            string body = reader.ReadToEnd();
            if (String.IsNullOrWhiteSpace(body)) return new Dictionary<string, object>();
            return Json.Deserialize<Dictionary<string, object>>(body) ?? new Dictionary<string, object>();
        }
    }

    private static List<Dictionary<string, object>> ParseTemplates(Dictionary<string, object> body) {
        List<Dictionary<string, object>> result = new List<Dictionary<string, object>>();
        object raw;
        if (body != null && body.TryGetValue("templates", out raw)) {
            ArrayList list = raw as ArrayList;
            if (list != null) {
                foreach (object item in list) {
                    Dictionary<string, object> template = item as Dictionary<string, object>;
                    if (template != null && template.ContainsKey("alunoId") && template.ContainsKey("templateBase64")) {
                        result.Add(template);
                    }
                }
            }
        }
        return result;
    }

    private static void Send(HttpListenerContext context, int status, object payload) {
        try {
            byte[] bytes = Encoding.UTF8.GetBytes(Json.Serialize(payload));
            context.Response.StatusCode = status;
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.Headers["Access-Control-Allow-Origin"] = "*";
            context.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type";
            context.Response.Headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS";
            context.Response.ContentLength64 = bytes.Length;
            context.Response.OutputStream.Write(bytes, 0, bytes.Length);
        } catch (Exception ex) {
            Log("Resposta HTTP: " + ex);
        } finally {
            try { context.Response.OutputStream.Close(); } catch { }
            try { context.Response.Close(); } catch { }
        }
    }

    private static void Log(string text) {
        try {
            File.AppendAllText(
                "fusion-biometria.log",
                DateTime.Now.ToString("s") + " " + text + Environment.NewLine
            );
        } catch { }
    }
}
