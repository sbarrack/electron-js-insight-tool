(($) => {
  let rows = $('tr').toArray().slice(1)
  let bottom = rows.pop()

  $('th').on('click', e => {
    rows = rows.sort(comparator(e.target.cellIndex))
    this.direction = !this.direction
    if (!this.direction)
      rows = rows.reverse()
    for (let i = 0; i < rows.length; i++)
      $('table').append(rows[i])
    $('table').append(bottom)
  })

  function comparator(i) {
    return function (a, b) {
      a = value(a, i), b = value(b, i)
      return $.isNumeric(a) && $.isNumeric(b) ? a - b : a.toString().localeCompare(b)
    }
  }

  function value(r, i) {
    return $(r).children('td').eq(i).text()
  }
})($)
