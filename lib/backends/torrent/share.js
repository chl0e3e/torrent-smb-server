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

var logger = require('winston').loggers.get('spi');
var async = require('async');
var mkdirp = require('mkdirp');

var Share = require('../../spi/share');
var TorrentTree = require('./tree');
var SMBError = require('../../smberror');
var ntstatus = require('../../ntstatus');

/**
 * Creates an instance of TorrentShare.
 *
 * @constructor
 * @this {TorrentShare}
 * @param {String} name share name
 * @param {Object} config configuration hash
 */
var TorrentShare = function (name, config) {
  if (!(this instanceof TorrentShare)) {
    return new TorrentShare(name, config);
  }
  config = config || {};

  Share.call(this, name, config);

  this.path = config.path;
  this.description = config.description || '';
};

// the TorrentShare prototype inherits from Share
util.inherits(TorrentShare, Share);

//--------------------------------------------------------------------< Share >

/**
 * Return a flag indicating whether this is a named pipe share.
 *
 * @return {Boolean} <code>true</code> if this is a named pipe share;
 *         <code>false</code> otherwise, i.e. if it is a disk share.
 */
TorrentShare.prototype.isNamedPipe = function () {
  return false;
};

/**
 *
 * @param {Session} session
 * @param {Buffer|String} shareLevelPassword optional share-level password (may be null)
 * @param {Function} cb callback called with the connect tree
 * @param {SMBError} cb.error error (non-null if an error occurred)
 * @param {FSTree} cb.tree connected tree
 */
TorrentShare.prototype.connect = function (session, shareLevelPassword, cb) {
  // todo check access rights of session?

  cb(null, new TorrentTree(this));
};

module.exports = TorrentShare;

