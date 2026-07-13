/* Fusion ERP 2.9.2 — Fusion Date
   Substitui calendários nativos por campo texto DD/MM/AAAA em celulares e desktop.
   Mantém helpers para converter DD/MM/AAAA <-> AAAA-MM-DD. */
(function(){
  'use strict';

  function onlyDigits(v){ return String(v || '').replace(/\D/g, '').slice(0, 8); }
  function pad2(v){ return String(v).padStart(2, '0'); }

  function isoToBR(value){
    const s = String(value || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(!m) return maskDate(s);
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  function brToISO(value){
    const s = String(value || '').trim();
    if(!s) return '';
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const n = onlyDigits(s);
    if(n.length !== 8) return '';
    const d = Number(n.slice(0,2));
    const m = Number(n.slice(2,4));
    const y = Number(n.slice(4,8));
    if(!validDate(d,m,y)) return '';
    return `${String(y).padStart(4,'0')}-${pad2(m)}-${pad2(d)}`;
  }

  function maskDate(value){
    const n = onlyDigits(value);
    if(n.length <= 2) return n;
    if(n.length <= 4) return `${n.slice(0,2)}/${n.slice(2)}`;
    return `${n.slice(0,2)}/${n.slice(2,4)}/${n.slice(4,8)}`;
  }

  function validDate(d,m,y){
    if(!d || !m || !y || y < 1900 || y > 2100 || m < 1 || m > 12) return false;
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  function ageFromISO(iso){
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m) return '';
    const birth = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const beforeBirthday = today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
    if(beforeBirthday) age--;
    return age >= 0 && age < 130 ? String(age) : '';
  }

  function shouldEnhance(input){
    if(!input || input.dataset.fusionDateReady === '1') return false;
    if(input.type === 'date') return true;
    if(input.classList.contains('fusion-date-input')) return true;
    if(input.dataset.fusionDate === '1') return true;
    const id = String(input.id || input.name || '').toLowerCase();
    return /(^|_)(data|nascimento|matricula|inicio|fim|validade|vencimento)($|_)/.test(id) && input.tagName === 'INPUT';
  }

  function ensureAgeHint(input){
    const id = String(input.id || input.name || '').toLowerCase();
    if(!/nascimento/.test(id)) return null;
    let hint = input.parentElement && input.parentElement.querySelector('.fusion-date-age');
    if(!hint && input.parentElement){
      hint = document.createElement('small');
      hint.className = 'fusion-date-age';
      input.parentElement.appendChild(hint);
    }
    return hint;
  }

  function updateValidation(input){
    const iso = brToISO(input.value);
    const raw = String(input.value || '').trim();
    input.dataset.isoValue = iso;
    input.classList.toggle('fusion-date-invalid', Boolean(raw && raw.length >= 8 && !iso));
    const hint = ensureAgeHint(input);
    if(hint){
      const age = ageFromISO(iso);
      hint.textContent = age ? `${age} anos` : 'Digite no formato DD/MM/AAAA';
    }
  }

  function enhance(input){
    if(!shouldEnhance(input)) return;
    const original = input.value || input.getAttribute('value') || '';
    try { input.type = 'text'; } catch {}
    input.classList.add('fusion-date-input');
    input.dataset.fusionDateReady = '1';
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('placeholder', input.getAttribute('placeholder') || 'DD/MM/AAAA');
    if(original) input.value = isoToBR(original);
    updateValidation(input);

    input.addEventListener('input', function(){
      const posEnd = input.selectionStart === input.value.length;
      input.value = maskDate(input.value);
      if(posEnd) input.setSelectionRange(input.value.length, input.value.length);
      updateValidation(input);
    });
    input.addEventListener('blur', function(){
      const iso = brToISO(input.value);
      input.value = iso ? isoToBR(iso) : maskDate(input.value);
      updateValidation(input);
    });
  }

  function enhanceAll(root){
    Array.from((root || document).querySelectorAll('input')).forEach(enhance);
  }

  function normalizeFormBeforeSubmit(form){
    Array.from(form.querySelectorAll('.fusion-date-input')).forEach(input => {
      const iso = brToISO(input.value);
      if(iso) input.value = iso;
    });
  }

  document.addEventListener('submit', function(ev){
    if(ev.target && ev.target.tagName === 'FORM') normalizeFormBeforeSubmit(ev.target);
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ enhanceAll(document); });
  const observer = new MutationObserver(mutations => {
    for(const m of mutations){
      m.addedNodes && m.addedNodes.forEach(node => {
        if(node.nodeType !== 1) return;
        if(node.matches && node.matches('input')) enhance(node);
        enhanceAll(node);
      });
    }
  });
  observer.observe(document.documentElement, {childList:true, subtree:true});

  window.FusionDate = { toISO: brToISO, toBR: isoToBR, mask: maskDate, enhance, enhanceAll, normalizeFormBeforeSubmit, ageFromISO };
})();
