'use strict'

const fs = require('fs')
const path = require('path')

const config = JSON.parse(rFile('config.json'))

const meow = require('meow')(rFile('help.txt').toString(), config.meow)
const chalk = require('chalk')

if (!meow.flags.input) {
  console.log(chalk.redBright('MISSING TARGET') + ': Please use -i to provide a valid path')
  process.exit()
} else if (!fs.existsSync(meow.flags.input)) {
  console.log(chalk.redBright('INVALID TARGET') + ': The path is not valid or does not exist')
  process.exit()
}

const readline = require('readline')

const moment = require('moment')
const csvParse = require('csv-parse')

// _________________________________________________________________________________________________

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

var parsed = [], totals = [], dates = []

if (fs.lstatSync(meow.flags.input).isDirectory()) {
  var ious = []
  fs.readdirSync(meow.flags.input, { withFileTypes: true }).forEach((f, i) => {
    if (f.isFile() && f.name.includes('.csv', f.name.length - 4)) {
      ious[i] = new Promise((resolve, reject) => {
        fs.readFile(path.join(meow.flags.input, f.name), (e, data) => {
          if (e) {
            console.log(chalk.redBright(e))
            reject(e)
            return
          }
          let temp = data.toString().split(/(?:\r\n|\r|\n)/g)[3].slice(2).split('-')
          temp = {
            start: moment(temp[0], config.formatIn),
            end: moment(temp[1], config.formatIn)
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
    console.error(chalk.redBright(e))
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
      temp[0] = moment(temp[0], config.formatIn).format(config.formatOut)
      temp[1] = moment(temp[1], config.formatIn).format(config.formatOut)
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
            dates[i].start.format(config.formatIn) + '-' + dates[i].end.format(config.formatIn) + chalk.gray(' and ') +
            dates[j].start.format(config.formatIn) + '-' + dates[j].end.format(config.formatIn))
        }
      }
      dates[i] = dates[i].start.format(config.formatOut) + '-' + dates[i].end.format(config.formatOut)
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

  if (fs.existsSync(config.outpath))
    fs.unlinkSync(config.outpath)
  fs.copyFileSync(path.join(__dirname, config.head), config.outpath)

  Object.keys(parsed[0]).forEach(h => {
    let temp = h.replace(/([A-Z])/g, ' $1')
    fs.appendFileSync(config.outpath, '      <th>' + temp.charAt(0).toUpperCase() + temp.slice(1) + '</th>\n')
  })
  fs.appendFileSync(config.outpath, '    </tr>\n')

  parsed.forEach(row => {
    fs.appendFileSync(config.outpath, '    <tr>\n')
    for (let col in row) {
      fs.appendFileSync(config.outpath, '      <td>' + row[col] + '</td>\n')
    }
    fs.appendFileSync(config.outpath, '    </tr>\n')
  })

  fs.appendFileSync(config.outpath, '    <p>' + dates + '</p>\n')
  fs.appendFileSync(config.outpath, rFile(config.foot))

  if (meow.flags.update) {
    if (fs.existsSync(config.scripts))
      fs.unlinkSync(config.scripts)
    fs.copyFileSync(path.join(__dirname, config.scripts), config.scripts)
    if (fs.existsSync(config.styles))
      fs.unlinkSync(config.styles)
    fs.copyFileSync(path.join(__dirname, config.styles), config.styles)
  }

  console.log(chalk.green('COMPLETE') + ': ' + chalk.gray('Task completed successfully in ') +
    process.uptime().toPrecision(5) + chalk.gray(' sec'))
}
