(() => {
  const SESSION_KEY = "fusion_aluno_treino_login";
  const fotoInput = document.getElementById("fotoAlunoInput");
  const btnTrocarFoto = document.getElementById("btnTrocarFoto");
  const fotoAluno = document.getElementById("fotoAluno");
  const statusFotoAluno = document.getElementById("statusFotoAluno");

  if (!fotoInput || !btnTrocarFoto || !fotoAluno) return;

  function lerSessao() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function idAluno(sessao = null) {
    return String(
      new URLSearchParams(location.search).get("alunoId") ||
      sessao?.alunoId ||
      sessao?.id ||
      ""
    );
  }

  function authHeaders(sessao, headers = {}) {
    const token = sessao?.token || sessao?.accessToken || sessao?.jwt || "";
    return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
  }

  function mostrarStatus(texto = "", tipo = "") {
    if (!statusFotoAluno) return;
    statusFotoAluno.textContent = texto;
    statusFotoAluno.className = `status-foto ${tipo}`.trim();
  }

  function limparStatusDepois(ms = 2600) {
    window.setTimeout(() => mostrarStatus(""), ms);
  }

  // Mesmo tratamento usado pela Matrícula Online:
  // arquivo de até 8 MB, redimensionado para no máximo 1200 px e salvo em JPEG 0,82.
  function arquivoParaBase64Reduzido(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve("");
      if (file.size > 8 * 1024 * 1024) {
        return reject(new Error("Arquivo muito grande. Use uma imagem de até 8 MB."));
      }
      if (file.type && !file.type.startsWith("image/")) {
        return reject(new Error("Selecione uma imagem válida."));
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Imagem inválida."));
        img.onload = () => {
          const max = 1200;
          const escala = Math.min(1, max / Math.max(img.width, img.height));
          const canvasTmp = document.createElement("canvas");
          canvasTmp.width = Math.max(1, Math.round(img.width * escala));
          canvasTmp.height = Math.max(1, Math.round(img.height * escala));
          const tmpCtx = canvasTmp.getContext("2d");
          if (!tmpCtx) return reject(new Error("Não foi possível preparar a imagem."));
          tmpCtx.drawImage(img, 0, 0, canvasTmp.width, canvasTmp.height);
          resolve(canvasTmp.toDataURL("image/jpeg", 0.82));
        };
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  async function salvarFoto(file) {
    if (!file) return;

    const sessao = lerSessao();
    const alunoId = idAluno(sessao);
    if (!sessao || !alunoId) {
      mostrarStatus("Faça login novamente.", "erro");
      limparStatusDepois(4000);
      return;
    }

    const fotoAnterior = fotoAluno.src;
    btnTrocarFoto.disabled = true;
    mostrarStatus("Preparando foto...");

    try {
      const fotoBase64 = await arquivoParaBase64Reduzido(file);
      if (!fotoBase64) throw new Error("Selecione uma foto.");

      fotoAluno.src = fotoBase64;
      mostrarStatus("Salvando...");

      const resp = await fetch(`/api/alunos/${encodeURIComponent(alunoId)}/foto`, {
        method: "PUT",
        headers: authHeaders(sessao, { "Content-Type": "application/json" }),
        body: JSON.stringify({ foto_base64: fotoBase64 })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json.ok === false) {
        throw new Error(json.mensagem || json.erro || "Não foi possível atualizar a foto.");
      }

      const fotoSalva = json.foto_base64 || fotoBase64;
      fotoAluno.src = fotoSalva;
      fotoAluno.onerror = null;

      const sessaoAtualizada = { ...sessao, foto: fotoSalva, foto_base64: fotoSalva };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessaoAtualizada));

      mostrarStatus("Foto atualizada.", "ok");
      limparStatusDepois();
    } catch (error) {
      fotoAluno.src = fotoAnterior;
      mostrarStatus(error.message || "Não foi possível atualizar a foto.", "erro");
      limparStatusDepois(5000);
    } finally {
      btnTrocarFoto.disabled = false;
      fotoInput.value = "";
    }
  }

  btnTrocarFoto.addEventListener("click", () => fotoInput.click());
  fotoInput.addEventListener("change", () => salvarFoto(fotoInput.files?.[0]));
})();
