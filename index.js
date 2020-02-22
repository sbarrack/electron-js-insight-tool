'use strict'

const fs = require('fs')
const path = require('path')

const chalk = require('chalk')
const meow = require('meow')(rFile('help.txt').toString(), JSON.parse(rFile('meow.json')))
const csvParse = require('csv-parse')

var config = JSON.parse(rFile('config.json'))

const outpath = 'index.html'

// _____________________________________________________

const parsed = []

if (!meow.flags.input) {
  console.log('I need a real file, please.')
  process.exit()
}
const input = fs.createReadStream(meow.flags.input)

const rowOp = row => {
  delete row.undefined
  row.percentNewUsers = row.newUsers / row.newUsers
  row.avgSessionsPerUser = row.sessions / row.users
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
  parsed.push(data)
}))

input.on('close', () => {
  console.log(parsed)
  // TODO create HTML
})

// _____________________________________________________

/**
 * 
 * @param {string} file Target file path relative to .
 */
function rFile(file) {
  return fs.readFileSync(path.join(__dirname, file))
}
