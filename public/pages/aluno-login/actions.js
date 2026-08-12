(() => {
  "use strict";

  const DEVICE_KEY = "fusion_aluno_device_token_v2";
  const API = "/api/treinos/aluno-app";
  const MAX_RAW_FILE = 8 * 1024 * 1024;
  const MAX_SIDE = 720;

  const $ = (id) => document.getElementById(id);

  function deviceToken() {
    return localStorage.getItem(DEVICE_KEY) || "";
  }

  function setStatus(texto = "", tipo = "") {
    const el = $("alunoAppActionsStatus");
    if (!el) return;
    el.textContent = texto;
    el.dataset.tipo = tipo;
  }

  function busy(button, ativo, texto = "Aguarde...") {
    if (!button) return;
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = ativo;
    button.textContent = ativo ? texto : button.dataset.label;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Fusion-Device-Token": deviceToken(),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      const error = new Error(data.mensagem || data.message || "Não foi possível concluir a operação.");
      error.status = response.status;
      error.code = data.code || "";
      throw error;
    }
    return data.dados ?? data;
  }

  function estilos() {
    if ($("alunoAppActionsStyle")) return;
    const style = document.createElement("style");
    style.id = "alunoAppActionsStyle";
    style.textContent = `
      .student-app-actions{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
        margin:12px 0 18px;
      }
      .student-app-actions .btn{margin:0;min-height:48px}
      .student-app-actions-status{
        grid-column:1/-1;
        display:block;
        min-height:20px;
        margin:0;
        font-size:.9rem;
        color:#475569;
        text-align:center;
      }
      .student-app-actions-status[data-tipo="ok"]{color:#047857}
      .student-app-actions-status[data-tipo="erro"]{color:#b91c1c}
      .student-photo-change-hint{
        position:absolute;
        right:-7px;
        bottom:-7px;
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        border-radius:999px;
        background:#0f766e;
        color:#fff;
        border:2px solid #fff;
        font-size:15px;
        font-weight:800;
        box-shadow:0 4px 12px rgba(15,23,42,.18);
        pointer-events:none;
      }
      #fotoAluno{position:relative;cursor:pointer}
      @media (max-width:420px){
        .student-app-actions{grid-template-columns:1fr}
        .student-app-actions-status{grid-column:1}
      }
    `;
    document.head.appendChild(style);
  }

  function montarAcoes() {
    if ($("alunoAppActions")) return;

    const home = $("homeScreen");
    const hero = home?.querySelector(".home-hero");
    if (!home || !hero) return;

    const area = document.createElement("section");
    area.id = "alunoAppActions";
    area.className = "student-app-actions";
    area.setAttribute("aria-label", "Ações rápidas do aluno");
    area.innerHTML = `
      <button id="liberarCatracaApp" class="btn primary" type="button">Liberar catraca</button>
      <button id="trocarFotoApp" class="btn secondary" type="button">Trocar foto</button>
      <input id="fotoAlunoInputApp" type="file" accept="image/jpeg,image/png,image/webp" hidden>
      <small id="alunoAppActionsStatus" class="student-app-actions-status" aria-live="polite"></small>
    `;
    hero.insertAdjacentElement("afterend", area);

    const foto = $("fotoAluno");
    if (foto) {
      foto.setAttribute("role", "button");
      foto.setAttribute("tabindex", "0");
      foto.setAttribute("aria-label", "Trocar minha foto");
      const hint = document.createElement("span");
      hint.className = "student-photo-change-hint";
      hint.textContent = "✎";
      hint.setAttribute("aria-hidden", "true");
      foto.appendChild(hint);
    }

    $("liberarCatracaApp").addEventListener("click", liberarCatraca);
    $("trocarFotoApp").addEventListener("click", abrirFoto);
    $("fotoAlunoInputApp").addEventListener("change", escolherFoto);

    if (foto) {
      foto.addEventListener("click", abrirFoto);
      foto.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          abrirFoto();
        }
      });
    }
  }

  function abrirFoto() {
    setStatus("");
    $("fotoAlunoInputApp")?.click();
  }

  function carregarImagem(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Não foi possível ler esta imagem."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
        img.onload = () => resolve(img);
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  async function reduzirFoto(file) {
    if (!file?.type?.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
      throw new Error("Escolha uma foto JPG, PNG ou WEBP.");
    }
    if (file.size > MAX_RAW_FILE) {
      throw new Error("A foto original deve ter no máximo 8 MB.");
    }

    const img = await carregarImagem(file);
    const proporcao = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round(img.naturalWidth * proporcao));
    const height = Math.max(1, Math.round(img.naturalHeight * proporcao));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Este aparelho não conseguiu preparar a foto.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const foto = canvas.toDataURL("image/jpeg", 0.84);
    if (!foto || foto.length > 3_900_000) {
      throw new Error("A foto ficou grande demais. Tente outra imagem.");
    }
    return foto;
  }

  function aplicarFoto(foto) {
    const img = $("fotoAlunoImg");
    const fallback = $("fotoAlunoIniciais");
    if (!img || !fallback || !foto) return;
    img.onload = () => {
      img.classList.remove("hidden");
      fallback.classList.add("hidden");
    };
    img.src = foto;
  }

  async function escolherFoto(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const button = $("trocarFotoApp");
    busy(button, true, "Salvando foto...");
    setStatus("Preparando a foto...");
    try {
      const foto = await reduzirFoto(file);
      const data = await request("/foto", {
        method: "PUT",
        body: JSON.stringify({ foto_base64: foto })
      });
      aplicarFoto(data.foto || foto);
      setStatus("Foto atualizada.", "ok");
    } catch (error) {
      setStatus(error.message || "Não foi possível atualizar a foto.", "erro");
    } finally {
      busy(button, false);
    }
  }

  function dataHoraBR(valor = "") {
    if (!valor) return "";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "";
    return data.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  async function atualizarFrequencia() {
    if (!deviceToken()) return;
    const resumo = $("frequenciaResumo");
    const detalhe = $("frequenciaDetalhe");
    if (!resumo || !detalhe) return;

    try {
      const data = await request("/frequencia", { method: "GET" });
      const total30 = Number(data.ultimos_30_dias || 0);
      resumo.textContent = `${total30} acesso${total30 === 1 ? "" : "s"} em 30 dias`;
      detalhe.textContent = data.ultimo_acesso
        ? `Último acesso: ${dataHoraBR(data.ultimo_acesso)}`
        : "Nenhuma frequência registrada ainda.";
    } catch (error) {
      if (error.status === 401) return;
      detalhe.textContent = "Não foi possível atualizar a frequência agora.";
    }
  }

  function textoContador(data = {}) {
    const usados = Number(data.usados || data.acessosUsadosHoje || 0);
    const limite = Number(data.limite || data.limiteDiario || 0);
    const restantes = data.restantes ?? data.acessosRestantesHoje;

    if (limite > 0) {
      return `Acessos hoje: ${usados}/${limite}${Number.isFinite(Number(restantes)) ? ` · ${Number(restantes)} restante${Number(restantes) === 1 ? "" : "s"}` : ""}`;
    }
    return `Acessos hoje: ${usados}`;
  }

  async function atualizarContador() {
    if (!deviceToken() || !$("liberarCatracaApp")) return;
    try {
      const data = await request("/catraca-contador", { method: "GET" });
      const btn = $("liberarCatracaApp");
      const saida = data.proximaDirecao === "saida";
      btn.textContent = saida ? "Liberar saída" : "Liberar entrada";
      // O limite diário só bloqueia nova entrada. Quem está dentro sempre pode sair.
      btn.disabled = Boolean(data.limiteAtingido && !saida);
      btn.title = data.limiteAtingido && !saida ? "Limite diário de entradas atingido." : "";
      setStatus(
        saida ? "Você está dentro da academia. Próximo giro: saída." : textoContador(data),
        data.limiteAtingido && !saida ? "erro" : ""
      );
    } catch (error) {
      if (error.status === 401) return;
      setStatus(error.message || "Não foi possível consultar o limite de acessos.", "erro");
    }
  }

  async function liberarCatraca() {
    const btn = $("liberarCatracaApp");
    busy(btn, true, "Liberando...");
    setStatus("Verificando seu acesso...");
    try {
      const data = await request("/catraca", {
        method: "POST",
        body: JSON.stringify({ direcao: "auto" })
      });

      if (data.autorizado) {
        const movimento = data.direcao === "saida" ? "Saída liberada." : "Entrada liberada.";
        setStatus(data.motivo || movimento, "ok");
      } else {
        setStatus(data.motivo || "Acesso não autorizado.", "erro");
      }

      window.setTimeout(() => {
        atualizarContador();
        atualizarFrequencia();
      }, 600);
    } catch (error) {
      setStatus(error.message || "Não foi possível liberar a catraca.", "erro");
    } finally {
      window.setTimeout(() => busy(btn, false), 1200);
    }
  }

  function observarHome() {
    const home = $("homeScreen");
    if (!home) return;

    let estavaVisivel = !home.classList.contains("hidden");
    const verificar = () => {
      const visivel = !home.classList.contains("hidden");
      if (visivel && !estavaVisivel) {
        atualizarContador();
        atualizarFrequencia();
      }
      estavaVisivel = visivel;
    };

    const observer = new MutationObserver(verificar);
    observer.observe(home, { attributes: true, attributeFilter: ["class"] });

    if (estavaVisivel) {
      atualizarContador();
      atualizarFrequencia();
    }
  }

  function iniciar() {
    estilos();
    montarAcoes();
    observarHome();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
