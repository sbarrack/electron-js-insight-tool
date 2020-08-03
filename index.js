const fs = require('fs')
const meow = require('meow')(
  'Usage\n\
  $ insight-linux -i path\n\
  $ insight-macos --help\n\
  $ insight-win.exe --version\n\
  \n\
  Options\n\
  --help          Show this page\n\
  --version       Show the version in use\n\
  --input, -i     File or directory of files with insight data\n\
  08/03/2020    v2020.08.03    © Motionstrand', {
  flags: {
    input: {
      alias: 'i',
      type: 'string'
    }
  },
  inferType: true,
  booleanDefault: true
})

const chalk = require('chalk')

if (!meow.flags.input) {
  console.log(chalk.redBright('MISSING TARGET') + ': Please use -i to provide a valid path')
  process.exit()
} else if (!fs.existsSync(meow.flags.input)) {
  console.log(chalk.redBright('INVALID TARGET') + ': The path is not valid or does not exist')
  process.exit()
}

const path = require('path')
const readline = require('readline')
const moment = require('moment')
const csvParse = require('csv-parse')

const parseDef = {
  cast: true,
  columns: [
    'undefined',
    'resolution',
    'users',
    'newUsers',
    'undefined',
    'undefined',
    'undefined',
    'undefined',
    'undefined',
    'undefined',
    'undefined'
  ],
  comment: '#',
  from: 2,
  on_record: rowOp,
  skip_empty_lines: true,
  skip_lines_with_error: true,
  skip_lines_with_empty_values: true
}

const outpath = 'index.html'
const formatIn = 'YYYYMMDD'
const formatOut = 'M/D/YY'
const devices = [
  { '414x896': 'Apple iPhone X Max' },
  { '414x736': 'Apple iPhone 6/7/8+' },
  { '412x846': 'Samsung Galaxy S8/9+' },
  { '412x823': 'Google Pixel 2 XL' },
  { '412x738': 'Google Nexus 6P' },
  { '412x640': 'Google Pixel 2' },
  { '411x731': 'Google Pixel XL' },
  { '393x786': 'Google Pixel 3' },
  { '393x786': 'Xiaomi Redmi Note 5' },
  { '375x812': 'Apple iPhone X' },
  { '375x667': 'Apple iPhone 6/7/8' },
  { '360x740': 'Samsung Galaxy' },
  { '360x640': 'Android' },
  { '360x748': 'Huawei P20' },
  { '360x747': 'Huawei P20 Pro' },
  { '360x760': 'Huawei P20 Lite' },
  { '320x570': 'LG K7' },
  { '320x570': 'ZTE' },
  { '240x320': 'Lyf F90M (KaiOS)' }
]

var parsed = []
var totals = []
var dates = []

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
            start: moment(temp[0], formatIn),
            end: moment(temp[1], formatIn)
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
      temp[0] = moment(temp[0], formatIn).format(formatOut)
      temp[1] = moment(temp[1], formatIn).format(formatOut)
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
            dates[i].start.format(formatIn) + '-' + dates[i].end.format(formatIn) + chalk.gray(' and ') +
            dates[j].start.format(formatIn) + '-' + dates[j].end.format(formatIn))
        }
      }
      dates[i] = dates[i].start.format(formatOut) + '-' + dates[i].end.format(formatOut)
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

    devices.forEach(d => {
      if (Object.keys(d)[0] === parsed[i].resolution) {
        if (++temp2 == 1)
          temp3 = d[parsed[i].resolution]
      }
    })

    parsed[i].device = temp3
  }

  parsed[temp].percentOfTotalUsers = parsed[temp].percentOfTotalNewUsers = '100.00'
  parsed[temp].device = ''

  if (fs.existsSync(outpath))
    fs.unlinkSync(outpath)

  fs.appendFileSync(outpath,
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" \
    content="width=device-width, initial-scale=1"><link rel="stylesheet" href="style.css">\
    </head><body><div class="table-container"><table class="table is-striped is-hoverable is-fullwidth"><tr>')

  Object.keys(parsed[0]).forEach(h => {
    let temp = h.replace(/([A-Z])/g, ' $1')
    fs.appendFileSync(outpath, '<th align="center">' + temp.charAt(0).toUpperCase() + temp.slice(1) + '</th>')
  })
  fs.appendFileSync(outpath, '</tr>')

  parsed.forEach(row => {
    fs.appendFileSync(outpath, '<tr>')

    for (let col in row) {
      fs.appendFileSync(outpath, '<td>' + row[col] + '</td>')
    }

    fs.appendFileSync(outpath, '</tr>')
  })

  fs.appendFileSync(outpath, '<div id="top"><span class="control">\
  <a class="button is-danger" href="app.html">Back</a></span>\
  <span>' + dates + '</span></div>')

  fs.appendFileSync(outpath,
    `</table></div><script>if (typeof module === 'object') {window.module = module; module = undefined;}</script>\
    <script src="./node_modules/jquery/dist/jquery.min.js"></script>\
    <script src="./page.js"></script><script>if (window.module) module = window.module;</script></body></html>`)

  console.log(chalk.green('COMPLETE') + ': ' + chalk.gray('Task completed successfully in ') +
    process.uptime().toPrecision(5) + chalk.gray(' sec'))
}
