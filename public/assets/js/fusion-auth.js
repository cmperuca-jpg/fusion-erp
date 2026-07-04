const FusionAuth = {
  getToken() { return localStorage.getItem("fusion_token"); },
  getUsuario() {
    try { return JSON.parse(localStorage.getItem("fusion_usuario") || "null"); }
    catch { return null; }
  },
  salvarSessao(token, usuario) {
    localStorage.setItem("fusion_token", token);
    localStorage.setItem("fusion_usuario", JSON.stringify(usuario));
  },
  getProfessor() {
    try { return JSON.parse(localStorage.getItem("fusion_professor_portal") || "null"); }
    catch { return null; }
  },
  salvarProfessorSessao(token, professor) {
    localStorage.setItem("fusion_professor_token", token || "fusion-professor-local");
    localStorage.setItem("fusion_professor_portal", JSON.stringify(professor || null));
  },
  sairProfessor() {
    localStorage.removeItem("fusion_professor_token");
    localStorage.removeItem("fusion_professor_portal");
    window.location.href = "/pages/professor-painel/index.html";
  },
  sair() {
    localStorage.removeItem("fusion_token");
    localStorage.removeItem("fusion_usuario");
    localStorage.removeItem("fusion_professor_token");
    localStorage.removeItem("fusion_professor_portal");
    window.location.href = "/pages/login/index.html";
  },
  proteger() {
    if (!this.getToken()) window.location.href = "/pages/login/index.html";
  }
};
window.FusionAuth = FusionAuth;
