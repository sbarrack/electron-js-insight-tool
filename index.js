'use strict';

const fs = require('fs');
const path = require('path');

const chalk = require('chalk');
const meow = require('meow')(rFile('help.txt').toString(), JSON.parse(rFile('meow.json')));

var config = JSON.parse(rFile('config.json'));

// TODO code here

/**
 * 
 * @param {string} file Target file path relative to .
 */
function rFile(file) {
  return fs.readFileSync(path.join(__dirname, file));
}
