// TODO dates, async and multi files

'use strict'

const fs = require('fs')
const path = require('path')

const chalk = require('chalk')
const meow = require('meow')(rFile('help.txt').toString(), JSON.parse(rFile('meow.json')))
const csvParse = require('csv-parse')

var config = JSON.parse(rFile('config.json'))

const outpath = 'index.html'

// _____________________________________________________

if (!meow.flags.input) {
  console.log('I need a real file, please.')
  process.exit()
}
const input = fs.createReadStream(meow.flags.input)

let parsed

const rowOp = row => {
  delete row.undefined
  if (typeof row.users === 'string') row.users = +row.users.replace(/,/g, '')
  if (typeof row.newUsers === 'string') row.newUsers = +row.newUsers.replace(/,/g, '')
  if (typeof row.sessions === 'string') row.sessions = +row.sessions.replace(/,/g, '')
  row.bouncePercent = +row.bouncePercent.replace(/%/g, '') / 100
  row.pagesPerSession = +row.pagesPerSession
  let temp = row.avgSessionTime.replace('<', '').split(':')
  row.avgSessionTime = +temp[0] * 3600 + +temp[1] * 60 + +temp[2]
  return row
}

input.pipe(csvParse({
  cast: true,
  columns: config.headers,
  comment: '#',
  from: 2,
  on_record: rowOp,
  skip_empty_lines: true,
  skip_lines_with_error: true,
  skip_lines_with_empty_values: true
}, (e, data) => {
  if (e) {
    console.error(e)
    return
  }
  parsed = data
}))

input.on('close', () => {
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      if (parsed[i].resolution === parsed[j].resolution) {
        parsed[i].bouncePercent = (parsed[i].bouncePercent * parsed[i].users + parsed[j].bouncePercent * parsed[j].users) / (parsed[j].users + parsed[i].users)
        parsed[i].users += parsed[j].users
        parsed[i].newUsers += parsed[j].newUsers
        let temp = parsed[i].sessions + parsed[j].sessions
        parsed[i].pagesPerSession = (parsed[i].pagesPerSession * parsed[i].sessions + parsed[j].pagesPerSession * parsed[j].sessions) / temp
        parsed[i].avgSessionTime = Math.round((parsed[i].avgSessionTime * parsed[i].sessions + parsed[j].avgSessionTime * parsed[j].sessions) / temp)
        parsed[i].sessions += parsed[j].sessions
        parsed.splice(j--, 1)
      }
    }

    parsed[i].bouncePercent = (parsed[i].bouncePercent * 100).toFixed(2) + '%'
    parsed[i].pagesPerSession = (+parsed[i].pagesPerSession).toFixed(2)
  }
  parsed[parsed.length - 1].resolution = '<b>Totals</b>'

  if (fs.existsSync(outpath))
    fs.unlinkSync(outpath)
  fs.copyFileSync('base.html', outpath)

  parsed.forEach(row => {
    fs.appendFileSync(outpath, '  <tr>\n')
    for (let col in row) {
      fs.appendFileSync(outpath, '    <td>' + row[col] + '</td>\n')
    }
    fs.appendFileSync(outpath, '  </tr>\n')
  })
  fs.appendFileSync(outpath, '</table>\n</body>\n</html>')
})

// _____________________________________________________

/**
 * 
 * @param {string} file Target file path relative to .
 */
function rFile(file) {
  return fs.readFileSync(path.join(__dirname, file))
}
