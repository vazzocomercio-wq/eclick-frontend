/* eslint-disable */
/**
 * Coletor de endereços da Shopee — Faturador F2b-4.
 *
 * POR QUE EXISTE: a Open API da Shopee mascara o endereço do comprador
 * (`recipient_address` = "****") até o pedido ser DESPACHADO — mas despachar
 * exige a NF-e emitida. Impasse. A tela do vendedor mostra tudo aberto, então
 * este script roda LÁ (com a sessão do próprio vendedor), lê os pedidos e
 * manda nome/CPF/endereço pro e-Click, que guarda pra emissão usar.
 *
 * Roda como bookmarklet: o usuário abre "Meus Pedidos → A Enviar" e clica.
 * Só LÊ dados (nenhuma ação de envio/despacho é disparada).
 */
(function () {
  var API = window.__ECLICK_API__;
  var TOKEN = window.__ECLICK_TOKEN__;

  function ui(msg, cor) {
    var d = document.getElementById('__eclick_coletor');
    if (!d) {
      d = document.createElement('div');
      d.id = '__eclick_coletor';
      d.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:999999;max-width:340px;' +
        'background:#111114;color:#fafafa;border:1px solid #00E5FF;border-radius:12px;' +
        'padding:14px 16px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.5)';
      document.body.appendChild(d);
    }
    d.innerHTML =
      '<div style="font-weight:700;color:#00E5FF;margin-bottom:6px">e-Click · Coletor de endereços</div>' +
      '<div style="color:' + (cor || '#a1a1aa') + '">' + msg + '</div>';
    return d;
  }

  if (!API || !TOKEN) { ui('Coletor aberto de forma incorreta. Gere o link de novo no e-Click.', '#f87171'); return; }
  if (!/seller\.shopee\.com\.br/.test(location.host)) {
    ui('Abra a Central do Vendedor da Shopee (Meus Pedidos) e clique no coletor por lá.', '#fcd34d');
    return;
  }

  var cds = (document.cookie.match(/SPC_CDS=([^;]+)/) || [])[1];
  if (!cds) { ui('Não achei sua sessão da Shopee. Recarregue a página e tente de novo.', '#f87171'); return; }

  function aberto(v) {
    var s = typeof v === 'string' ? v.trim() : '';
    return s && !/^\*+$/.test(s) ? s : null;
  }

  /** IDs internos dos pedidos: saem dos links dos cards da lista. */
  function idsNaTela() {
    var ids = [];
    var as = document.querySelectorAll('a[href*="/portal/sale/order/"]');
    for (var i = 0; i < as.length; i++) {
      var m = /\/portal\/sale\/order\/(\d{6,})/.exec(as[i].getAttribute('href') || '');
      if (m && ids.indexOf(m[1]) < 0) ids.push(m[1]);
    }
    return ids;
  }

  function detalhe(id) {
    var u = '/api/v3/order/get_one_order?SPC_CDS=' + cds + '&SPC_CDS_VER=2&order_id=' + id;
    return fetch(u, { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var d = (j && j.data) || {};
        if (!d.order_sn) return null;
        return {
          orderSn: String(d.order_sn),
          name: aberto(d.buyer_address_name),
          doc: aberto(d.buyer_cpf_id),
          addressLine: aberto(d.shipping_address),
        };
      })
      .catch(function () { return null; });
  }

  var ids = [];
  var coletados = [];
  var i = 0;

  function proximo() {
    if (i >= ids.length) return enviar();
    ui('Lendo pedido ' + (i + 1) + ' de ' + ids.length + '…');
    detalhe(ids[i++]).then(function (r) {
      if (r && r.addressLine) coletados.push(r);
      setTimeout(proximo, 350);   // ritmo gentil com a Shopee
    });
  }

  function enviar() {
    if (!coletados.length) {
      ui('Li os pedidos, mas nenhum endereço veio aberto. Confirme que está na aba <b>A Enviar</b>.' + rodapeAuto(), '#fcd34d');
      agendar();
      return;
    }
    ui('Enviando ' + coletados.length + ' endereço(s) pro e-Click…');
    fetch(API + '/fulfillment/fiscal/shopee-addresses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify({ items: coletados }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.j && (res.j.message || res.j.error)) || 'falha no envio');
        var n = res.j.updated || 0;
        var erros = (res.j.errors || []);
        window.__eclickUltima = new Date();
        ui('✓ <b>' + n + ' pedido(s)</b> com endereço pronto no e-Click.' +
          (erros.length ? '<br><span style="color:#fcd34d">' + erros.length + ' aviso(s): ' + erros.slice(0, 3).join(' · ') + '</span>' : '') +
          rodapeAuto(), '#4ADE50');
        agendar();
      })
      .catch(function (e) {
        ui('Falhou ao enviar: ' + e.message + '<br><br>Se falar em sessão/expirado, gere o coletor de novo no e-Click.', '#f87171');
        agendar();   // erro de rede não deve matar a vigilância
      });
  }

  // ── modo vigia: enquanto esta aba ficar aberta, recoleta sozinho ──────────
  // A Shopee só abre o endereço na tela do vendedor, então a coleta TEM de
  // rodar aqui. Em vez de exigir um clique por pedido, o coletor se reagenda:
  // deixe a aba aberta e os pedidos novos entram no e-Click sozinhos.
  var INTERVALO_MIN = 10;

  function rodapeAuto() {
    return '<br><br><span style="color:#71717a">Vigiando esta aba — recoleto a cada ' +
      INTERVALO_MIN + ' min. Pode deixar aberta.</span>';
  }

  function agendar() {
    if (window.__eclickTimer) clearTimeout(window.__eclickTimer);
    window.__eclickTimer = setTimeout(function () {
      // aba escondida: espera voltar ao primeiro plano pra não gastar sessão à toa
      if (document.hidden) { agendar(); return; }
      coletar();
    }, INTERVALO_MIN * 60 * 1000);
  }

  function coletar() {
    ids = idsNaTela();
    coletados = [];
    i = 0;
    if (!ids.length) {
      ui('Nenhum pedido em "A Enviar" agora.' + rodapeAuto(), '#a1a1aa');
      agendar();
      return;
    }
    proximo();
  }

  // já havia um vigia rodando? troca pelo novo (evita 2 timers)
  if (window.__eclickTimer) clearTimeout(window.__eclickTimer);
  coletar();
})();
