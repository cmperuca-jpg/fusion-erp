(function () {
  function marcar() {
    const status = document.getElementById('migrationStatus');
    if (!status) return;
    status.textContent = 'Importadores fixos no sistema';
  }
  document.addEventListener('DOMContentLoaded', marcar);
})();
