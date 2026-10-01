/* Proxy — load any URL in a full-width iframe. Ported from the Monke Vault proxy. */
(function () {
  'use strict';

  var DEFAULT_URL = 'https://storage.googleapis.com/fernisbest/index.html';

  window.loadProxy = function () {
    var input = document.getElementById('proxy-url-input');
    var frame = document.getElementById('proxy-iframe');
    if (!input || !frame) return;
    var url = (input.value || '').trim() || DEFAULT_URL;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    input.value = url;
    frame.src = url;
  };

  document.addEventListener('DOMContentLoaded', function () {
    var input = document.getElementById('proxy-url-input');
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') window.loadProxy();
    });
  });
})();
