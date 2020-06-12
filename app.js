const jQuery = require('jquery');

(($) => {
  $(document).ready(() => {
    const { ipcRenderer } = require('electron');

    var $runButton = $('button.is-primary');
    var $resetButton = $('button.is-danger');
    var $fileButton = $('input');
    var $fileLabel = $('.file-name');
    var files;
    const cwd = location.pathname.slice(0, location.pathname.lastIndexOf('/'));

    $fileButton.on('change', e => {
      let temp = Array.from($fileButton[0].files);
      
      temp = temp.filter(elem => {
        return elem.name.toLowerCase().endsWith('.csv');
      });

      if (temp.length) {
        files = temp;
        if (files.length == 1) {
          $fileLabel.text(files[0].name);
        } else if (files.length > 1) {
          $fileLabel.text(files[0].path.replace('/' + files[0].name, ''));
        }
      }
    });

    $runButton.on('click', e => {
      let temp = [];
      if (files.length > 1) {
        temp.push(files[0].path.slice(0, -files[0].name.length - 1));
      } else if (files.length == 1) {
        temp = [ files[0].path ];
      } else {
        temp = [ cwd ];
      }
      
      ipcRenderer.send('run', temp);
    });

    $resetButton.on('click', () => {
      files = [];
      $fileLabel.text(cwd);
    });

    $resetButton.trigger('click');
  });
})(jQuery);
