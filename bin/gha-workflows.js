#!/usr/bin/env node

'use strict';

const { description, version } = require('../package.json');
const { ArgumentParser } = require('argparse');
const fs = require('fs');
const yaml = require('js-yaml');
const { sync: mkdirp } = require('mkdirp');
const path = require('path');
const { sync: getPackageJSON } = require('pkg-up');

/**
 * @param {string} path
 * @return {boolean}
 */
function exists(path) {
    return fs.existsSync(path);
}

/**
 * @param {string} path
 * @return {boolean}
 */
function isDir(path) {
    return fs.lstatSync(path).isDirectory();
}

/**
 * @param {string} filepath
 * @param {{ header: string[]|string }} options
 */
function processWorkflow(filepath, options) {
    const rawContents = fs.readFileSync(filepath, 'utf-8');
    const contents = yaml.load(rawContents);

    const expanded = yaml.dump(contents, {
        lineWidth: -1,
        noRefs: true,
    });
    let headerString = '';

    if (options.header) {
        let header = options.header;

        if (typeof options.header === 'string') {
            header = options.header.split(/\n|\\n/g);
        }

        headerString = header.map(line => `# ${line}`).join('\n');
    }

    return `${headerString}\n\n${expanded}`.trim() + '\n';
}

/**
 * @param {string} srcFile
 * @param {string} dest
 * @param {{ header: string[]|string }} options
 */
function writeWorkflow(srcFile, dest, options) {
    const expanded = processWorkflow(srcFile, options);
    const target = isDir(dest) ? path.join(dest, path.basename(srcFile)) : destination;

    fs.writeFileSync(target, expanded);
}

const cli = new ArgumentParser({
    description,
});

cli.add_argument('-v', '--version', { action: 'version', version });
cli.add_argument('-c', '--comments', {
    type: 'str',
    help: 'Add a header comment ',
});
cli.add_argument('-s', '--source', {
    type: 'str',
    help: 'The source directory YAML files or single YAML file that will be "compiled"',
});
cli.add_argument('-d', '--destination', {
    type: 'str',
    help: 'The output directory where "compiled" YAML files will be written to',
});

const options = cli.parse_args();
const projectPackageJSON = getPackageJSON();

let source = null;
let destination = null;
let comments = null;

if (projectPackageJSON !== null) {
    const contents = fs.readFileSync(projectPackageJSON, 'utf-8');
    const pkgJsonConfig = JSON.parse(contents)['gha-workflows'] || {};

    source = pkgJsonConfig.source ?? null;
    destination = pkgJsonConfig.destination ?? null;
    comments = pkgJsonConfig.comments ?? null;
}

source ??= options.source ?? null;
destination ??= options.destination ?? null;
comments ??= options.header ?? null;

if (!exists(source)) {
    console.error(`Source file/folder not found: ${source}`);
    process.exit(1);
}

if (destination === null) {
    console.error('A destination must be specified, none given.');
    process.exit(2);
}

if (!exists(destination)) {
    mkdirp(destination);
}

if (isDir(source)) {
    fs.readdirSync(source).forEach(file => {
        writeWorkflow(
            path.join(source, file),
            destination,
            { header: comments },
        );
    });
} else {
    writeWorkflow(source, destination, { header: comments });
}
