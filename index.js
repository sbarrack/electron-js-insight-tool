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
  if (typeof row.users === 'string') row.users = parseInt(row.users.replace(/,/g, ''), 10)
  if (typeof row.newUsers === 'string') row.newUsers = parseInt(row.newUsers.replace(/,/g, ''), 10)
  if (typeof row.sessions === 'string') row.sessions = parseInt(row.sessions.replace(/,/g, ''), 10)
  row.bouncePercent = parseFloat(row.bouncePercent.replace(/%/g, ''))
  row.pagesPerSession = parseFloat(row.pagesPerSession)
  let temp = row.avgSessionTime.split(':')
  row.avgSessionTime = parseInt(temp[0], 10) * 3600 + parseInt(temp[1], 10) * 60 + parseInt(temp[2], 10)
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
  // TODO combine duplicates in parsed
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      if (parsed[i].resolution === parsed[j].resolution) {
        parsed[i].users += parsed[j].users
        parsed[i].newUsers += parsed[j].newUsers
        parsed[i].sessions += parsed[j].sessions
        // TODO recalculate bounce percent
        let temp = parsed[i].sessions + parsed[j].sessions
        parsed[i].pagesPerSession = (parsed[i].pagesPerSession * parsed[i].sessions + parsed[j].pagesPerSession * parsed[j].sessions) / temp
        parsed[i].avgSessionTime = (parsed[i].avgSessionTime * parsed[i].sessions + parsed[j].avgSessionTime * parsed[j].sessions) / temp
        parsed.splice(j--, 1)
      }
    }
  }

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
