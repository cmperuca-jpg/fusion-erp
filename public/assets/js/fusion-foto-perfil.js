(() => {
  async function comprimir(arquivo, tamanho = 720, qualidade = 0.82) {
    if (!arquivo || !/^image\/(jpeg|png|webp)$/i.test(arquivo.type || "")) {
      throw new Error("Escolha uma imagem JPG, PNG ou WebP.");
    }
    if (arquivo.size > 12 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 12 MB.");

    const url = URL.createObjectURL(arquivo);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
        img.src = url;
      });

      const escala = Math.min(1, tamanho / Math.max(img.naturalWidth, img.naturalHeight));
      const largura = Math.max(1, Math.round(img.naturalWidth * escala));
      const altura = Math.max(1, Math.round(img.naturalHeight * escala));
      const canvas = document.createElement("canvas");
      canvas.width = largura;
      canvas.height = altura;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, largura, altura);
      return canvas.toDataURL("image/jpeg", qualidade);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function aplicarImagem(img, foto, fallback = "") {
    if (!img) return;
    img.src = foto || fallback || "/assets/pwa/icons/fusion-icon-192.png";
    img.onerror = () => {
      img.onerror = null;
      img.src = fallback || "/assets/pwa/icons/fusion-icon-192.png";
    };
  }

  window.FusionFotoPerfil = { comprimir, aplicarImagem };
})();
