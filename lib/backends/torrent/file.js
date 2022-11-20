/*
 *  Copyright 2015 Adobe Systems Incorporated. All rights reserved.
 *  This file is licensed to you under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License. You may obtain a copy
 *  of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under
 *  the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 *  OF ANY KIND, either express or implied. See the License for the specific language
 *  governing permissions and limitations under the License.
 */

'use strict';

var util = require('util');
var fs = require('fs');
var Path = require('path');

var logger = require('winston').loggers.get('spi');
var perflog = require('winston').loggers.get('perf');
var async = require('async');

var File = require('../../spi/file');
var SMBError = require('../../smberror');
const { chain, isLength } = require('lodash');

/**
 * Creates an instance of File.
 *
 * @constructor
 * @private
 * @this {TorrentFile}
 * @param {String} filePath normalized file path
 * @param {fs.Stats} stats fs.Stats object
 * @param {FSTree} tree tree object
 */
var TorrentFile = function (filePath, tree, type, torrent) {
  logger.debug('[torrentpseudofile] file.open %s', filePath);
  //console.log("PT: " + filePath);
  //console.log("PTT: " + type);
  if (!(this instanceof TorrentFile)) {
    return new TorrentFile(filePath, tree);
  }
  //console.log("T: " + filePath);
  this.path = filePath;
  this.type = type;
  this.torrent = torrent;
  this.torrentSize = 0;
  this.allocationTorrentSize = 0;

  File.call(this, filePath, tree);
};

// the TorrentFile prototype inherits from File
util.inherits(TorrentFile, File);

/**
 * Async factory method
 *
 * @param {String} filePath normalized file path
 * @param {FSTree} tree tree object
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 * @param {TorrentFile} cb.file TorrentFile instance
 */
TorrentFile.createInstance = function (filePath, tree, type, torrent, cb) {
  cb(null, new TorrentFile(filePath, tree, type, torrent));
};

/**
 * Refreshes the stats information of the underlying file.
 *
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 */
TorrentFile.prototype.refreshStats = function (cb) {
  console.log("refreshStats");
  cb();
};

/**
 * Sets the read-only value of the file if needed.
 *
 * @param {Boolean} readOnly If TRUE, file will be read only; otherwise, file will be writable. *
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 */
TorrentFile.prototype.setReadOnly = function (readOnly, cb) {
  cb();
};

TorrentFile.prototype.getDescriptor = function (cb) {
  logger.debug('[torrentpseudofile] getDescriptor %s', this.filePath);
  cb();
};

//---------------------------------------------------------------------< File >

/**
 * Return a flag indicating whether this is a file.
 *
 * @return {Boolean} <code>true</code> if this is a file;
 *         <code>false</code> otherwise
 */
TorrentFile.prototype.isFile = function () {
  return this.type == "file" || this.type == "torrentfile";
};

/**
 * Return a flag indicating whether this is a directory.
 *
 * @return {Boolean} <code>true</code> if this is a directory;
 *         <code>false</code> otherwise
 */
TorrentFile.prototype.isDirectory = function () {
  return this.type == "folder";
};

/**
 * Return a flag indicating whether this file is read-only.
 *
 * @return {Boolean} <code>true</code> if this file is read-only;
 *         <code>false</code> otherwise
 */
TorrentFile.prototype.isReadOnly = function () {
  return true;
};

/**
 * Return the file size.
 *
 * @return {Number} file size, in bytes
 */
TorrentFile.prototype.size = function () {
  logger.debug('[torrentpseudofile] size %s (%d bytes)', this.filePath, this.torrentSize);
  if(this.type == "torrentfile") {
    return this.torrent.length;
  }
  return this.torrentSize;
};

/**
 * Return the number of bytes that are allocated to the file.
 *
 * @return {Number} allocation size, in bytes
 */
TorrentFile.prototype.allocationSize = function () {
  logger.debug('[torrentpseudofile] allocationSize %s', this.filePath);
  if(this.type == "torrentfile") {
    return this.torrent.length;
  }
  return this.allocationTorrentSize;
};

/**
 * Return the time of last modification, in milliseconds since
 * Jan 1, 1970, 00:00:00.0.
 *
 * @return {Number} time of last modification
 */
TorrentFile.prototype.lastModified = function () {
  return 0;
};

/**
 * Sets the time of last modification, in milliseconds since
 * Jan 1, 1970, 00:00:00.0.
 *
 * @param {Number} ms
 * @return {Number} time of last modification
 */
TorrentFile.prototype.setLastModified = function (ms) {
  // cheatin' ...
  //this.stats.mtime = new Date(ms);
};

/**
 * Return the time when file status was last changed, in milliseconds since
 * Jan 1, 1970, 00:00:00.0.
 *
 * @return {Number} when file status was last changed
 */
TorrentFile.prototype.lastChanged = function () {
  return 0;
};

/**
 * Return the create time, in milliseconds since Jan 1, 1970, 00:00:00.0.
 * Jan 1, 1970, 00:00:00.0.
 *
 * @return {Number} time created
 */
TorrentFile.prototype.created = function () {
  return 0;
};

/**
 * Return the time of last access, in milliseconds since Jan 1, 1970, 00:00:00.0.
 * Jan 1, 1970, 00:00:00.0.
 *
 * @return {Number} time of last access
 */
TorrentFile.prototype.lastAccessed = function () {
  return 0;
};

/**
 * Read bytes at a certain position inside the file.
 *
 * @param {Buffer} buffer the buffer that the data will be written to
 * @param {Number} offset the offset in the buffer to start writing at
 * @param {Number} length the number of bytes to read
 * @param {Number} position offset where to begin reading from in the file
 * @param {Function} cb callback called with the bytes actually read
 * @param {SMBError} cb.error error (non-null if an error occurred)
 * @param {Number} cb.bytesRead number of bytes actually read
 * @param {Buffer} cb.buffer buffer holding the bytes actually read
 */
TorrentFile.prototype.read = function (buffer, offset, length, position, cb) {
  //logger.debug('[torrentpseudofile] file.read %s offset=%d, length=%d, position=%d', this.filePath, offset, length, position);
  if(this.type == "torrentfile") {
    try {
      var stream = this.torrent.createReadStream({
        start: position,
        end: position + length
      });
      stream.on('data', (chunk) => {
        //console.log(chunk);
        //console.log(`Received ${chunk.length} bytes of data.`);
        chunk.copy(buffer, 0, 0, length);
      });
      stream.on('end', () => {
        //console.log('There will be no more data.');
      });
      stream.on('close', () => {
        //console.log('closed');
        cb(null, length, buffer);
      });
    } catch(e) {
      console.log("read CB error; ");
      //console.log(e);
      cb(null, 0, buffer);
    }
  } else {
    cb();
  }
};

/**
 * Write bytes at a certain position inside the file.
 *
 * @param {Buffer} data buffer to write
 * @param {Number} position position inside file
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 */
TorrentFile.prototype.write = function (data, position, cb) {
  logger.debug('[torrentpseudofile] file.write %s data.length=%d, position=%d', this.filePath, data.length, position);
  cb();
};

/**
 * Sets the file length.
 *
 * @param {Number} length file length
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 */
TorrentFile.prototype.setLength = function (length, cb) {
  logger.debug('[torrentpseudofile] file.setLength %s length=%d', this.filePath, length);
  cb();
};

/**
 * Delete this file or directory. If this file denotes a directory, it must
 * be empty in order to be deleted.
 *
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 */
TorrentFile.prototype.delete = function (cb) {
  logger.debug('[torrentpseudofile] file.delete %s', this.filePath);
  cb();
};

/**
 * Flush the contents of the file to disk.
 *
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 */
TorrentFile.prototype.flush = function (cb) {
  logger.debug('[torrentpseudofile] file.flush %s', this.filePath);
  cb();
};

/**
 * Close this file, releasing any resources.
 *
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 */
TorrentFile.prototype.close = function (cb) {
  logger.debug('[torrentpseudofile] file.close %s', this.filePath);
  cb();
};

module.exports = TorrentFile;


