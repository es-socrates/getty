#!/usr/bin/env node
const jest = require('jest');

const defaultArgs = ['--runInBand', '--forceExit'];
const extraArgs = process.argv.slice(2).filter((arg) => arg !== '--');

jest.run([...defaultArgs, ...extraArgs]);
