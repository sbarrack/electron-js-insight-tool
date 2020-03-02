'use strict'

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const chalk = require('chalk')
const meow = require('meow')(rFile('help.txt').toString(), JSON.parse(rFile('meow.json')))
const csvParse = require('csv-parse')

var config = JSON.parse(rFile('config.json'))

if (!meow.flags.input) {
  console.log(chalk.redBright('MISSING TARGET: Please use -i to provide a valid path'))
  process.exit()
}

const input = fs.createReadStream(meow.flags.input)
const parser = csvParse({
  cast: true,
  columns: config.headers,
  comment: '#',
  from: 2,
  on_record: rowOp,
  skip_empty_lines: true,
  skip_lines_with_error: true,
  skip_lines_with_empty_values: true
}, parserHandler)
const outpath = 'index.html'

var parsed = []
var dateRange

// _____________________________________________________

// TODO async and multi files
input.on('ready', dateGetter)
input.pipe(parser)

input.on('close', postProcess)

// _____________________________________________________

function rFile(file) {
  return fs.readFileSync(path.join(__dirname, file))
}

function rowOp(row) {
  delete row.undefined
  if (typeof row.users === 'string') row.users = +row.users.replace(/,/g, '')
  if (typeof row.newUsers === 'string') row.newUsers = +row.newUsers.replace(/,/g, '')
  return row
}

function parserHandler(e, data) {
  if (e) {
    console.error(chalk.redBright(e))
    return
  }
  parsed = parsed.concat(data)
}

function dateGetter() {
  readline.createInterface({
    input: input,
    crlfDelay: Infinity
  }).on('line', line => {
    if (line.length == 19) dateRange = line.slice(2)
  })
}

function postProcess() {
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      if (parsed[i].resolution === parsed[j].resolution) {
        parsed[i].users += parsed[j].users
        parsed[i].newUsers += parsed[j].newUsers
        parsed.splice(j--, 1)
      }
    }
  }
  parsed[parsed.length - 1].resolution = '<b>Totals</b>'

  if (fs.existsSync(outpath))
    fs.unlinkSync(outpath)
  fs.copyFileSync(config.head, outpath)

  config.headers.forEach(h => {
    if (h != 'undefined') {
      let temp = h.replace(/([A-Z])/g, ' $1')
      fs.appendFileSync(outpath, '    <th>' + temp.charAt(0).toUpperCase() + temp.slice(1) + '</th>')
    }
  })
  fs.appendFileSync(outpath, '  </tr>')

  parsed.forEach(row => {
    fs.appendFileSync(outpath, '  <tr>\n')
    for (let col in row) {
      fs.appendFileSync(outpath, '    <td>' + row[col] + '</td>\n')
    }
    fs.appendFileSync(outpath, '  </tr>\n')
  })
  
  fs.appendFileSync(outpath, '<p>' + dateRange + '</p>')
  fs.appendFileSync(outpath, fs.readFileSync(config.foot))
  console.log(chalk.green('Done!'))
}
