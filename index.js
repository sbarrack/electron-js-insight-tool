'use strict'

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const chalk = require('chalk')
const meow = require('meow')(rFile('help.txt').toString(), JSON.parse(rFile('meow.json')))
const csvParse = require('csv-parse')
const moment = require('moment')

if (!meow.flags.input) {
  console.log(chalk.redBright('MISSING TARGET') + ': Please use -i to provide a valid path')
  process.exit()
} else if (!fs.existsSync(meow.flags.input)) {
  console.log(chalk.redBright('INVALID TARGET') + ': The path is not valid or does not exist')
  process.exit()
}

const config = JSON.parse(rFile('config.json'))
const parseDef = {
  cast: true,
  columns: config.headers,
  comment: '#',
  from: 2,
  on_record: rowOp,
  skip_empty_lines: true,
  skip_lines_with_error: true,
  skip_lines_with_empty_values: true
}
const outpath = 'index.html'
const inFormat = 'YYYYMMDD'
const outFormat = 'M/D/YY'

var parsed = [], totals = [], dates = []

if (fs.lstatSync(meow.flags.input).isDirectory()) {
  var ious = []
  fs.readdirSync(meow.flags.input, { withFileTypes: true }).forEach((f, i) => {
    if (f.isFile() && f.name.includes('.csv', f.name.length - 4)) {
      ious[i] = new Promise((resolve, reject) => {
        fs.readFile(path.join(meow.flags.input, f.name), (e, data) => {
          if (e) {
            console.log(chalk.magenta(e))
            reject(e)
            return
          }
          let temp = data.toString().split(/(?:\r\n|\r|\n)/g)[3].slice(2).split('-')
          temp = {
            start: moment(temp[0], inFormat),
            end: moment(temp[1], inFormat)
          }
          if (!(temp.start.isValid() && temp.end.isValid()) || temp.start.isSameOrAfter(temp.end)) {
            console.log(chalk.yellowBright('WARNING') + ': ' +
              chalk.gray('Invalid date range for ') + f.name)
          } else {
            dates.push(temp)
          }
          csvParse(data, parseDef, parserHandler)
          resolve(data)
        })
      })
    }
  })
  Promise.allSettled(ious).then(postProcess)
} else {
  var input = fs.createReadStream(meow.flags.input)
  input.on('ready', dateGetter)
  input.pipe(csvParse(parseDef, parserHandler))
  input.on('close', postProcess)
}

// _________________________________________________________________________________________________


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
    console.error(chalk.magenta(e))
    return
  }
  totals.push(data.pop())
  parsed = parsed.concat(data)
}

function dateGetter() {
  readline.createInterface({
    input: input,
    crlfDelay: Infinity
  }).on('line', line => {
    if (line.length == 19 && line.startsWith('# ')) {
      let temp = line.slice(2).split('-')
      temp[0] = moment(temp[0], inFormat).format(outFormat)
      temp[1] = moment(temp[1], inFormat).format(outFormat)
      dates.push(temp.join('-'))
    }
  })
}

function postProcess() {
  if (dates[0] instanceof Object) {
    dates.sort((a, b) => {
      return b.start.isSameOrBefore(a.start)
    })
    
    for (let i = 0; i < dates.length; i++) {
      for (let j = i + 1; j < dates.length; j++) {
        if (dates[i].end.isSame(dates[j].start)) {
          dates[i].end = dates[j].end
          dates.slice(j--, 1)
        } else if (dates[i].end.isBefore(dates[j].start)) {
          continue
        } else {
          console.log(chalk.yellowBright('WARNING') + ': ' + chalk.gray('Coinciding date range for ') +
            dates[i].start.format(inFormat) + '-' + dates[i].end.format(inFormat) + chalk.gray(' and ') +
            dates[j].start.format(inFormat) + '-' + dates[j].end.format(inFormat))
        }
      }
      dates[i] = dates[i].start.format(outFormat) + '-' + dates[i].end.format(outFormat)
    }
    
    dates = dates.join(', ')
  }

  parsed.push({
    resolution: '<b>Totals</b>',
    users: 0,
    newUsers: 0
  })
  let temp = parsed.length - 1
  totals.forEach(t => {
    parsed[temp].users += t.users
    parsed[temp].newUsers += t.newUsers
  })
  for (let i = 0; i < parsed.length - 1; i++) {
    for (let j = i + 1; j < parsed.length - 1; j++) {
      if (parsed[i].resolution === parsed[j].resolution) {
        parsed[i].users += parsed[j].users
        parsed[i].newUsers += parsed[j].newUsers
        parsed.splice(j--, 1)
      }
    }
    temp = parsed.length - 1
    parsed[i].percentOfTotalUsers = (parsed[i].users / parsed[temp].users * 100).toFixed(2)
    parsed[i].percentOfTotalNewUsers = (parsed[i].newUsers / parsed[temp].newUsers * 100).toFixed(2)
    let temp2 = 0, temp3 = ''
    config.devices.forEach(d => {
      if (Object.keys(d)[0] === parsed[i].resolution) {
        if (++temp2 == 1)
          temp3 = d[parsed[i].resolution]
      }
    })
    parsed[i].device = temp3
  }
  parsed[temp].percentOfTotalUsers = parsed[temp].percentOfTotalNewUsers = '100.00'

  if (fs.existsSync(outpath))
    fs.unlinkSync(outpath)
  fs.copyFileSync(path.join(__dirname, config.head), outpath)

  Object.keys(parsed[0]).forEach(h => {
    let temp = h.replace(/([A-Z])/g, ' $1')
    fs.appendFileSync(outpath, '      <th>' + temp.charAt(0).toUpperCase() + temp.slice(1) + '</th>\n')
  })
  fs.appendFileSync(outpath, '    </tr>\n')

  parsed.forEach(row => {
    fs.appendFileSync(outpath, '    <tr>\n')
    for (let col in row) {
      fs.appendFileSync(outpath, '      <td>' + row[col] + '</td>\n')
    }
    fs.appendFileSync(outpath, '    </tr>\n')
  })

  fs.appendFileSync(outpath, '    <p>' + dates + '</p>\n')
  fs.appendFileSync(outpath, rFile(config.foot))
  console.log(chalk.green('Done!'))
}
