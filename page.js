(function ($) {
  'use strict';

  var rows = $('tr').toArray().slice(1);
  var bottom = rows.pop();

  $('th').on('click', function (e) {
    rows = rows.sort(comparator(e.target.cellIndex));
    this.direction = !this.direction;

    if (!this.direction) {
      rows = rows.reverse();
    }

    for (var i = 0; i < rows.length; i++) {
      $('table').append(rows[i]);
    }
    $('table').append(bottom);
  });

  $('tr').on('click', function (e) {
    $('tr').removeClass('is-selected');
    $(e.currentTarget).addClass('is-selected');
  });

  function comparator(i) {
    return function (a, b) {
      a = value(a, i);
      b = value(b, i);
      if ($.isNumeric(a) && $.isNumeric(b)) {
        return a - b;
      }
      return a.toString().localeCompare(b);
    };
  }

  function value(r, i) {
    return $(r).children('td').eq(i).text();
  }
})(jQuery);
