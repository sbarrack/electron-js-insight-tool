'use strict';

const fs = require('fs');
const path = require('path');

const chalk = require('chalk');
const meow = require('meow')(rFile('help.txt').toString(), JSON.parse(rFile('meow.json')));
const csvParse = require('csv-parse');

var config = JSON.parse(rFile('config.json'));

// _____________________________________________________

const output = [];

if (!meow.flags.input) {
  console.log('I need a real file, please.');
  process.exit();
}
const stream = fs.createReadStream(meow.flags.input);

stream.pipe(csvParse({
  cast: true,
  comment: '#',
  skip_empty_lines: true,
  skip_lines_with_error: true,
  skip_lines_with_empty_values: true
}, (e, data) => {
  if (e) {
    console.error(e);
    return;
  }
  output.push(data);
}));

stream.on('close', () => {
  console.log('Done!');
});

// _____________________________________________________

/**
 * 
 * @param {string} file Target file path relative to .
 */
function rFile(file) {
  return fs.readFileSync(path.join(__dirname, file));
}
