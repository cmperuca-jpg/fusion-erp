using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

internal static class Native
{
    public const uint OK = 0;
    public const uint PARAM_CB_FRAME_SOURCE = 4;
    public const uint PARAM_CB_CONTROL = 5;
    public const uint PARAM_MAX_TEMPLATE_SIZE = 6;
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
    public struct FTR_IDENTIFY_RECORD
    {
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)]
        public byte[] KeyValue;
        public IntPtr pData;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct FTR_IDENTIFY_ARRAY { public uint TotalNumber; public IntPtr pMembers; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct FTR_MATCHED_X_RECORD
    {
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)]
        public byte[] KeyValue;
        public int FarAttained;
    }

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
    public static extern uint FTREnrollX(IntPtr userContext, uint purpose, ref FTR_DATA templateData, ref FTR_ENROLL_DATA enrollData);

    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern uint FTREnroll(IntPtr userContext, uint purpose, ref FTR_DATA templateData);

    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern uint FTRSetBaseTemplate(ref FTR_DATA templateData);

    [DllImport("FTRAPI.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern uint FTRIdentifyN(ref FTR_IDENTIFY_ARRAY source, ref uint matchCount, ref FTR_MATCHED_X_ARRAY matches);
}

internal sealed class TemplateEntry
{
    public string TenantId;
    public string AlunoId;
    public byte[] Template;
    public byte[] Key;
}

internal sealed class Fs80 : IDisposable
{
    private readonly Native.StateControl callback;
    private bool initialized;

    public Fs80()
    {
        callback = Callback;
        Check(Native.FTRInitialize(), "FTRInitialize");
        initialized = true;
        Check(Native.FTRSetParam(Native.PARAM_CB_FRAME_SOURCE, new IntPtr(Native.FRAME_SOURCE_USB)), "Configurar USB");
        Check(Native.FTRSetParam(Native.PARAM_CB_CONTROL, Marshal.GetFunctionPointerForDelegate(callback)), "Configurar callback");
    }

    private void Callback(IntPtr context, uint stateMask, ref uint response, uint signal, IntPtr bitmap)
    {
        response = Native.CONTINUE;
    }

    private static void Check(uint rc, string operation)
    {
        if (rc != Native.OK) throw new InvalidOperationException(operation + " falhou. Codigo Futronic: " + rc);
    }

    private uint TemplateSize(uint models)
    {
        Check(Native.FTRSetParam(Native.PARAM_MAX_MODELS, new IntPtr((long)models)), "Definir amostras");
        uint size;
        Check(Native.FTRGetParam(Native.PARAM_MAX_TEMPLATE_SIZE, out size), "Obter tamanho do template");
        if (size == 0 || size > 1048576) throw new InvalidOperationException("Tamanho de template invalido.");
        return size;
    }

    public byte[] Enroll(out int quality)
    {
        uint size = TemplateSize(3);
        IntPtr mem = Marshal.AllocHGlobal((int)size);
        try
        {
            Native.FTR_DATA data = new Native.FTR_DATA { dwSize = size, pData = mem };
            Native.FTR_ENROLL_DATA info = new Native.FTR_ENROLL_DATA
            {
                dwSize = (uint)Marshal.SizeOf(typeof(Native.FTR_ENROLL_DATA)),
                dwQuality = 0
            };

            Check(Native.FTREnrollX(IntPtr.Zero, Native.PURPOSE_ENROLL, ref data, ref info), "Cadastro biometrico");
            if (data.dwSize == 0 || data.dwSize > size) throw new InvalidOperationException("Template retornado invalido.");

            byte[] template = new byte[data.dwSize];
            Marshal.Copy(mem, template, 0, template.Length);
            quality = Math.Min(100, (int)info.dwQuality * 10);
            return template;
        }
        finally { Marshal.FreeHGlobal(mem); }
    }

    public Tuple<string, int> Identify(IReadOnlyList<TemplateEntry> templates)
    {
        if (templates == null || templates.Count == 0) return Tuple.Create<string, int>(null, 0);

        uint liveSize = TemplateSize(1);
        IntPtr liveMem = Marshal.AllocHGlobal((int)liveSize);
        var allocated = new List<IntPtr>();

        try
        {
            Native.FTR_DATA live = new Native.FTR_DATA { dwSize = liveSize, pData = liveMem };
            Check(Native.FTREnroll(IntPtr.Zero, Native.PURPOSE_IDENTIFY, ref live), "Captura para identificacao");
            Check(Native.FTRSetBaseTemplate(ref live), "Definir template-base");

            int dataSize = Marshal.SizeOf(typeof(Native.FTR_DATA));
            int recordSize = Marshal.SizeOf(typeof(Native.FTR_IDENTIFY_RECORD));
            IntPtr recordsMem = Marshal.AllocHGlobal(recordSize * templates.Count);
            allocated.Add(recordsMem);

            var keyMap = new Dictionary<string, TemplateEntry>(StringComparer.Ordinal);

            for (int i = 0; i < templates.Count; i++)
            {
                var item = templates[i];

                IntPtr templateMem = Marshal.AllocHGlobal(item.Template.Length);
                allocated.Add(templateMem);
                Marshal.Copy(item.Template, 0, templateMem, item.Template.Length);

                IntPtr dataMem = Marshal.AllocHGlobal(dataSize);
                allocated.Add(dataMem);
                var data = new Native.FTR_DATA { dwSize = (uint)item.Template.Length, pData = templateMem };
                Marshal.StructureToPtr(data, dataMem, false);

                var key = item.Key;
                keyMap[Program.Hex(key)] = item;

                var record = new Native.FTR_IDENTIFY_RECORD { KeyValue = key, pData = dataMem };
                Marshal.StructureToPtr(record, IntPtr.Add(recordsMem, i * recordSize), false);
            }

            Native.FTR_IDENTIFY_ARRAY source = new Native.FTR_IDENTIFY_ARRAY
            {
                TotalNumber = (uint)templates.Count,
                pMembers = recordsMem
            };

            int maxMatches = Math.Min(5, templates.Count);
            int matchSize = Marshal.SizeOf(typeof(Native.FTR_MATCHED_X_RECORD));
            IntPtr matchesMem = Marshal.AllocHGlobal(matchSize * maxMatches);
            allocated.Add(matchesMem);

            byte[] zero = new byte[matchSize * maxMatches];
            Marshal.Copy(zero, 0, matchesMem, zero.Length);

            Native.FTR_MATCHED_X_ARRAY matches = new Native.FTR_MATCHED_X_ARRAY
            {
                TotalNumber = (uint)maxMatches,
                pMembers = matchesMem
            };

            uint matchCount = 0;
            Check(Native.FTRIdentifyN(ref source, ref matchCount, ref matches), "Identificacao 1:N");

            if (matchCount == 0) return Tuple.Create<string, int>(null, 0);

            var best = (Native.FTR_MATCHED_X_RECORD)Marshal.PtrToStructure(
                matchesMem,
                typeof(Native.FTR_MATCHED_X_RECORD)
            );

            string keyHex = Program.Hex(best.KeyValue);
            TemplateEntry found;
            if (!keyMap.TryGetValue(keyHex, out found)) return Tuple.Create<string, int>(null, best.FarAttained);

            return Tuple.Create(found.AlunoId, best.FarAttained);
        }
        finally
        {
            foreach (IntPtr p in allocated) if (p != IntPtr.Zero) Marshal.FreeHGlobal(p);
            Marshal.FreeHGlobal(liveMem);
        }
    }

    public void Dispose()
    {
        if (initialized)
        {
            Native.FTRTerminate();
            initialized = false;
        }
    }
}

internal static class Program
{
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    private static readonly string BaseStoreDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "templates-dpapi");

    private static void Print(object value) { Console.WriteLine(Json.Serialize(value)); }

    public static string Hex(byte[] bytes)
    {
        if (bytes == null) return "";
        var sb = new StringBuilder(bytes.Length * 2);
        foreach (byte b in bytes) sb.Append(b.ToString("x2"));
        return sb.ToString();
    }

    private static string NormalizeTenantId(string value)
    {
        string tenant = (value ?? "").Trim().ToLowerInvariant();
        if (tenant.Length < 1 || tenant.Length > 120)
            throw new InvalidOperationException("tenantId invalido ou ausente.");

        foreach (char c in tenant)
        {
            if (!(Char.IsLetterOrDigit(c) || c == '-' || c == '_' || c == '.'))
                throw new InvalidOperationException("tenantId contem caractere invalido.");
        }
        return tenant;
    }

    private static string ResolveTenant(string explicitTenant)
    {
        string value = explicitTenant;
        if (String.IsNullOrWhiteSpace(value)) value = Environment.GetEnvironmentVariable("FUSION_BIOMETRIA_TENANT_ID");
        if (String.IsNullOrWhiteSpace(value)) value = Environment.GetEnvironmentVariable("ACCESS_AGENT_TENANT_ID");
        if (String.IsNullOrWhiteSpace(value)) value = Environment.GetEnvironmentVariable("FUSION_TENANT_ID");
        return NormalizeTenantId(value);
    }

    private static string TenantHash(string tenantId)
    {
        using (var sha = SHA256.Create())
        {
            return Hex(sha.ComputeHash(Encoding.UTF8.GetBytes(tenantId)));
        }
    }

    private static string StoreDirForTenant(string tenantId)
    {
        return Path.Combine(BaseStoreDir, "tenants", TenantHash(tenantId));
    }

    private static byte[] KeyFor(string tenantId, string alunoId)
    {
        using (var sha = SHA256.Create())
        {
            byte[] full = sha.ComputeHash(Encoding.UTF8.GetBytes(tenantId + "\n" + alunoId));
            return full.Take(16).ToArray();
        }
    }

    private static string FileFor(string tenantId, string alunoId)
    {
        using (var sha = SHA256.Create())
        {
            string name = Hex(sha.ComputeHash(Encoding.UTF8.GetBytes(alunoId))) + ".dpapi";
            return Path.Combine(StoreDirForTenant(tenantId), name);
        }
    }

    private static byte[] PackV2(string tenantId, string alunoId, byte[] template)
    {
        byte[] tenant = Encoding.UTF8.GetBytes(tenantId);
        byte[] id = Encoding.UTF8.GetBytes(alunoId);
        using (var ms = new MemoryStream())
        using (var bw = new BinaryWriter(ms, Encoding.UTF8, true))
        {
            bw.Write(2);
            bw.Write(tenant.Length);
            bw.Write(tenant);
            bw.Write(id.Length);
            bw.Write(id);
            bw.Write(template.Length);
            bw.Write(template);
            bw.Flush();
            return ms.ToArray();
        }
    }

    private static TemplateEntry UnpackLegacyV1(byte[] plain)
    {
        using (var ms = new MemoryStream(plain))
        using (var br = new BinaryReader(ms, Encoding.UTF8, true))
        {
            int version = br.ReadInt32();
            if (version != 1) throw new InvalidDataException("Template legado com versao invalida.");

            int idLen = br.ReadInt32();
            if (idLen < 1 || idLen > 512) throw new InvalidDataException("AlunoId local invalido.");
            string alunoId = Encoding.UTF8.GetString(br.ReadBytes(idLen));

            int tplLen = br.ReadInt32();
            if (tplLen < 16 || tplLen > 1048576) throw new InvalidDataException("Template local invalido.");
            byte[] template = br.ReadBytes(tplLen);
            if (template.Length != tplLen) throw new EndOfStreamException();

            return new TemplateEntry { TenantId = "", AlunoId = alunoId, Template = template, Key = null };
        }
    }

    private static TemplateEntry UnpackV2(byte[] plain, string expectedTenantId)
    {
        using (var ms = new MemoryStream(plain))
        using (var br = new BinaryReader(ms, Encoding.UTF8, true))
        {
            int version = br.ReadInt32();
            if (version != 2) throw new InvalidDataException("Template local sem vinculo de tenant. Execute migrate-legacy.");

            int tenantLen = br.ReadInt32();
            if (tenantLen < 1 || tenantLen > 512) throw new InvalidDataException("Tenant local invalido.");
            string tenantId = NormalizeTenantId(Encoding.UTF8.GetString(br.ReadBytes(tenantLen)));
            if (!String.Equals(tenantId, expectedTenantId, StringComparison.Ordinal))
                throw new InvalidDataException("Template pertence a outro tenant.");

            int idLen = br.ReadInt32();
            if (idLen < 1 || idLen > 512) throw new InvalidDataException("AlunoId local invalido.");
            string alunoId = Encoding.UTF8.GetString(br.ReadBytes(idLen));

            int tplLen = br.ReadInt32();
            if (tplLen < 16 || tplLen > 1048576) throw new InvalidDataException("Template local invalido.");
            byte[] template = br.ReadBytes(tplLen);
            if (template.Length != tplLen) throw new EndOfStreamException();

            return new TemplateEntry
            {
                TenantId = tenantId,
                AlunoId = alunoId,
                Template = template,
                Key = KeyFor(tenantId, alunoId)
            };
        }
    }

    private static List<TemplateEntry> LoadAll(string tenantId)
    {
        string storeDir = StoreDirForTenant(tenantId);
        Directory.CreateDirectory(storeDir);
        var result = new List<TemplateEntry>();

        foreach (string file in Directory.GetFiles(storeDir, "*.dpapi"))
        {
            byte[] protectedBytes = null;
            byte[] plain = null;
            try
            {
                protectedBytes = File.ReadAllBytes(file);
                plain = ProtectedData.Unprotect(protectedBytes, null, DataProtectionScope.CurrentUser);
                result.Add(UnpackV2(plain, tenantId));
            }
            catch (Exception ex)
            {
                Print(new Dictionary<string, object> {
                    {"event", "error"},
                    {"erro", "Template local ignorado: " + ex.Message},
                    {"tenantId", tenantId}
                });
            }
            finally
            {
                if (plain != null) Array.Clear(plain, 0, plain.Length);
            }
        }

        return result;
    }

    private static void ClearTemplates(IEnumerable<TemplateEntry> items)
    {
        if (items == null) return;
        foreach (var item in items)
        {
            if (item.Template != null) Array.Clear(item.Template, 0, item.Template.Length);
        }
    }

    private static int Enroll(string alunoId, string tenantId)
    {
        alunoId = (alunoId ?? "").Trim();
        if (alunoId.Length < 1 || alunoId.Length > 160) throw new InvalidOperationException("alunoId invalido.");
        tenantId = ResolveTenant(tenantId);

        string storeDir = StoreDirForTenant(tenantId);
        Directory.CreateDirectory(storeDir);

        using (var fs80 = new Fs80())
        {
            int quality;
            byte[] template = fs80.Enroll(out quality);
            byte[] plain = null;
            byte[] protectedBytes = null;
            try
            {
                plain = PackV2(tenantId, alunoId, template);
                protectedBytes = ProtectedData.Protect(plain, null, DataProtectionScope.CurrentUser);
                File.WriteAllBytes(FileFor(tenantId, alunoId), protectedBytes);

                Print(new Dictionary<string, object> {
                    {"ok", true},
                    {"acao", "enroll"},
                    {"tenantId", tenantId},
                    {"alunoId", alunoId},
                    {"qualidade", quality},
                    {"tenantIsolado", true},
                    {"templateProtegidoWindows", true},
                    {"templateExposto", false},
                    {"versao", "2"}
                });
            }
            finally
            {
                Array.Clear(template, 0, template.Length);
                if (plain != null) Array.Clear(plain, 0, plain.Length);
                if (protectedBytes != null) Array.Clear(protectedBytes, 0, protectedBytes.Length);
            }
        }
        return 0;
    }

    private static int Delete(string alunoId, string tenantId)
    {
        alunoId = (alunoId ?? "").Trim();
        if (alunoId.Length < 1 || alunoId.Length > 160) throw new InvalidOperationException("alunoId invalido.");
        tenantId = ResolveTenant(tenantId);

        string file = FileFor(tenantId, alunoId);
        bool removido = File.Exists(file);
        if (removido) File.Delete(file);

        Print(new Dictionary<string, object> {
            {"ok", true},
            {"acao", "delete"},
            {"tenantId", tenantId},
            {"alunoId", alunoId},
            {"removido", removido},
            {"tenantIsolado", true},
            {"versao", "2"}
        });
        return 0;
    }

    private static int Exists(string alunoId, string tenantId)
    {
        alunoId = (alunoId ?? "").Trim();
        if (alunoId.Length < 1 || alunoId.Length > 160) throw new InvalidOperationException("alunoId invalido.");
        tenantId = ResolveTenant(tenantId);

        bool existe = File.Exists(FileFor(tenantId, alunoId));
        Print(new Dictionary<string, object> {
            {"ok", true},
            {"acao", "exists"},
            {"tenantId", tenantId},
            {"alunoId", alunoId},
            {"existe", existe},
            {"tenantIsolado", true},
            {"templateExposto", false},
            {"versao", "2"}
        });
        return 0;
    }

    private static int List(string tenantId)
    {
        tenantId = ResolveTenant(tenantId);
        var items = LoadAll(tenantId);
        try
        {
            Print(new Dictionary<string, object> {
                {"ok", true},
                {"acao", "list"},
                {"tenantId", tenantId},
                {"quantidade", items.Count},
                {"tenantIsolado", true},
                {"idsExpostos", false},
                {"versao", "2"}
            });
            return 0;
        }
        finally { ClearTemplates(items); }
    }

    private static int MigrateLegacy(string tenantId)
    {
        tenantId = ResolveTenant(tenantId);
        Directory.CreateDirectory(BaseStoreDir);
        Directory.CreateDirectory(StoreDirForTenant(tenantId));

        int migrados = 0;
        int ignorados = 0;
        int erros = 0;

        foreach (string source in Directory.GetFiles(BaseStoreDir, "*.dpapi"))
        {
            byte[] protectedBytes = null;
            byte[] plain = null;
            byte[] packed = null;
            byte[] protectedV2 = null;
            TemplateEntry legacy = null;
            try
            {
                protectedBytes = File.ReadAllBytes(source);
                plain = ProtectedData.Unprotect(protectedBytes, null, DataProtectionScope.CurrentUser);
                legacy = UnpackLegacyV1(plain);

                string destination = FileFor(tenantId, legacy.AlunoId);
                if (File.Exists(destination))
                {
                    ignorados += 1;
                    continue;
                }

                packed = PackV2(tenantId, legacy.AlunoId, legacy.Template);
                protectedV2 = ProtectedData.Protect(packed, null, DataProtectionScope.CurrentUser);
                File.WriteAllBytes(destination, protectedV2);
                File.Delete(source);
                migrados += 1;
            }
            catch (Exception ex)
            {
                erros += 1;
                Print(new Dictionary<string, object> {
                    {"event", "error"},
                    {"erro", "Falha ao migrar template legado: " + ex.Message},
                    {"tenantId", tenantId}
                });
            }
            finally
            {
                if (legacy != null && legacy.Template != null) Array.Clear(legacy.Template, 0, legacy.Template.Length);
                if (plain != null) Array.Clear(plain, 0, plain.Length);
                if (packed != null) Array.Clear(packed, 0, packed.Length);
                if (protectedBytes != null) Array.Clear(protectedBytes, 0, protectedBytes.Length);
                if (protectedV2 != null) Array.Clear(protectedV2, 0, protectedV2.Length);
            }
        }

        Print(new Dictionary<string, object> {
            {"ok", erros == 0},
            {"acao", "migrate-legacy"},
            {"tenantId", tenantId},
            {"migrados", migrados},
            {"ignorados", ignorados},
            {"erros", erros},
            {"tenantIsolado", true},
            {"templateExposto", false},
            {"versao", "2"}
        });
        return erros == 0 ? 0 : 2;
    }

    private static int Monitor(string tenantId)
    {
        tenantId = ResolveTenant(tenantId);
        Print(new Dictionary<string, object> {
            {"event", "status"},
            {"estado", "monitor-iniciando"},
            {"sensor", "Futronic FS80"},
            {"tenantId", tenantId},
            {"tenantIsolado", true},
            {"versao", "2"}
        });

        using (var fs80 = new Fs80())
        {
            while (true)
            {
                var items = LoadAll(tenantId);
                try
                {
                    if (items.Count == 0)
                    {
                        Print(new Dictionary<string, object> {
                            {"event", "status"},
                            {"estado", "sem-templates"},
                            {"tenantId", tenantId}
                        });
                        Thread.Sleep(10000);
                        continue;
                    }

                    Tuple<string, int> result = fs80.Identify(items);
                    if (!String.IsNullOrEmpty(result.Item1))
                    {
                        Print(new Dictionary<string, object> {
                            {"event", "identified"},
                            {"tenantId", tenantId},
                            {"alunoId", result.Item1},
                            {"farNumerico", result.Item2},
                            {"templateExposto", false}
                        });
                        Thread.Sleep(1500);
                    }
                    else
                    {
                        Print(new Dictionary<string, object> {
                            {"event", "no-match"},
                            {"tenantId", tenantId},
                            {"templateExposto", false}
                        });
                        Thread.Sleep(700);
                    }
                }
                catch (Exception ex)
                {
                    Print(new Dictionary<string, object> {
                        {"event", "error"},
                        {"tenantId", tenantId},
                        {"erro", ex.Message}
                    });
                    Thread.Sleep(2000);
                }
                finally { ClearTemplates(items); }
            }
        }
    }

    private static int Status(string tenantId)
    {
        string resolved = "";
        try { resolved = ResolveTenant(tenantId); } catch { }

        Print(new Dictionary<string, object> {
            {"ok", true},
            {"acao", "status"},
            {"sensor", "Futronic FS80"},
            {"store", "DPAPI-CurrentUser/Tenant"},
            {"tenantId", resolved},
            {"tenantIsolado", !String.IsNullOrEmpty(resolved)},
            {"templateExposto", false},
            {"versao", "2"}
        });
        return 0;
    }

    private static int Main(string[] args)
    {
        string action = args.Length > 0 ? args[0].Trim().ToLowerInvariant() : "status";
        try
        {
            if (action == "status") return Status(args.Length > 1 ? args[1] : "");
            if (action == "enroll") return Enroll(args.Length > 1 ? args[1] : "", args.Length > 2 ? args[2] : "");
            if (action == "delete") return Delete(args.Length > 1 ? args[1] : "", args.Length > 2 ? args[2] : "");
            if (action == "exists") return Exists(args.Length > 1 ? args[1] : "", args.Length > 2 ? args[2] : "");
            if (action == "list") return List(args.Length > 1 ? args[1] : "");
            if (action == "monitor") return Monitor(args.Length > 1 ? args[1] : "");
            if (action == "migrate-legacy") return MigrateLegacy(args.Length > 1 ? args[1] : "");

            throw new InvalidOperationException("Use status [TENANT_ID], enroll ALUNO_ID TENANT_ID, delete ALUNO_ID TENANT_ID, exists ALUNO_ID TENANT_ID, list TENANT_ID, monitor TENANT_ID ou migrate-legacy TENANT_ID.");
        }
        catch (Exception ex)
        {
            Print(new Dictionary<string, object> {
                {"ok", false},
                {"acao", action},
                {"erro", ex.Message},
                {"versao", "2"}
            });
            return 2;
        }
    }
}
