(($) => {
  'use strict';
  const ipc = require('electron').ipcRenderer;

  $(document).ready(() => {
    var inputFile = 'Current working directory';
    var $fileButton = $('input');
    var $fileLabel = $('.file-name');

    // $fileButton.on('change', e => {
    //   var outText = $fileButton.val() !== '' ? inputFile = $fileButton.val() : inputFile;
    //   var a = outText.split('\\');
    //   outText = a[a.length - 1];
    //   $fileLabel.text(outText);
    // });

    $('input').on('click', e => {
      e.preventDefault();
      ipc.send('open-file-dialog');
    });

    ipc.on('selected-file', (event, path) => {
      var outText = inputFile = path;
      var a = outText.split('\\');
      outText = a[a.length - 1];
      $fileLabel.text(outText);
    });
  });;
})(jQuery);