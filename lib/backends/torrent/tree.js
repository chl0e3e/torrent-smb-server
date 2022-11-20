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
var Path = require('path');
var fs = require('fs');

var logger = require('winston').loggers.get('spi');
var perflog = require('winston').loggers.get('perf');
var async = require('async');

var Tree = require('../../spi/tree');
var TorrentFile = require('./file');
var SMBError = require('../../smberror');
var ntstatus = require('../../ntstatus');
var utils = require('../../utils');
var mkdirp = require('mkdirp');

var snowfl = require("./snowfl");
const WebTorrent = require('webtorrent');

if(typeof global.cache == 'undefined') {
  global.cache = {};
  global.webtorrent = new WebTorrent();
  global.filesD = {};
  global.fileToTorrentD = {};
  global.torrentsD = {};
  
  let rawdata = fs.readFileSync('cache.json');
  global.cache = JSON.parse(rawdata);
}

/**
 * Creates an instance of Tree.
 *
 * @constructor
 * @this {TorrentTree}
 * @param {FSShare} share parent share
 */
var TorrentTree = function (share) {
  if (!(this instanceof TorrentTree)) {
    return new TorrentTree(share);
  }

  this.share = share;

  Tree.call(this, this.share.config);
};

// the TorrentTree prototype inherits from Tree
util.inherits(TorrentTree, Tree);

/**
 * Create a new FSFile instance for use by the tree.
 * @param name The name of the file to create.
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 * @param {FSFile} cb.file FSFile instance
 */
TorrentTree.prototype.createFileInstance = function (name, type, torrent, cb) {
  TorrentFile.createInstance(name, this, type, torrent, cb);
};

//---------------------------------------------------------------------< Tree >

/**
 * Test whether or not the specified file exists.
 *
 * @param {String} name file name
 * @param {Function} cb callback called with the result
 * @param {SMBError} cb.error error (non-null if an error occurred)
 * @param {Boolean} cb.exists true if the file exists; false otherwise
 */
TorrentTree.prototype.exists = function (name, cb) {
  logger.debug('[%s] tree.exists %s', this.share.config.backend, name);
  perflog.debug('%s Tree.exists.fs.stat', name);
  cb(null, true);
};

/**
 * Open an existing file.
 *
 * @param {String} name file name
 * @param {Function} cb callback called with the opened file
 * @param {SMBError} cb.error error (non-null if an error occurred)
 * @param {File} cb.file opened file
 */
TorrentTree.prototype.open = function (name, cb) {
  logger.debug('[%s] tree.open %s', this.share.config.backend, name);
  var nameSplit = name.split("/");
  var fileName = nameSplit[nameSplit.length - 1];
  console.log("open:File Name: " + fileName);
  console.log("open:Name: " + name);
  if(fileName in global.filesD) {
    for(var torrentURL in global.torrentsD) {
      console.log("Uncriticalizing " + torrentURL);
      global.torrentsD[torrentURL]._critical = [];
      global.torrentsD[torrentURL]._selections = [];
      global.torrentsD[torrentURL]._updateSelections();
    }
    
    this.createFileInstance(name, "torrentfile", global.filesD[fileName], function(err, file) {
      cb(null, file);
    });
  } else {
    if(name.includes("/Files/") && fileName.includes(".")) {
      cb(new SMBError(ntstatus.STATUS_NO_SUCH_FILE, "file does not exist"));
    } else {
      logger.debug('[%s] tree.open pseudofolder %s', this.share.config.backend, name);
      this.createFileInstance(name, "folder", null, function(err, file) {
        cb(null, file);
      });
    }
  }
};

/**
 * List entries, matching a specified pattern.
 *
 * @param {String} pattern pattern
 * @param {Function} cb callback called with an array of matching files
 * @param {SMBError} cb.error error (non-null if an error occurred)
 * @param {File[]} cb.files array of matching files
 */
TorrentTree.prototype.list = function (pattern, cb) {
  logger.debug('[%s] tree.list %s', this.share.config.backend, pattern);
  var parentPath = utils.getParentPath(pattern) || '';
  var filter = utils.getPathName(pattern);

  // list will receive two types of patterns:
  // 1. request all items from a directory. sample: /some/directory/*
  // 2. request for a single item. sample: /some/directory
  // the difference is the inclusion of the asterisk at the end of the pattern. for #1, do a readdir of the
  // parent directory. for #2, just return the single item if it exists. for #2, avoid using readdir so that the
  // entire directory doesn't need to be read for just a single file

  var self = this;

  console.log("PARENTPATH: " + parentPath);
  console.log("PATTERN: " + pattern);

  if (pattern == "/") {
    self.createFileInstance(pattern, "folder", null, function(err, file) {
      cb(null, [file]);
    });
    return;
  }

  if (pattern.endsWith("!SEARCH/*")) {
    var search = pattern.replaceAll("/*", "").replaceAll("/", "").replaceAll("!SEARCH", "").replaceAll("!SPACE", " ");
    console.log("Searching: " + search);

    async function menu(next) {
      var results;
      if(search in global.cache) {
        results = global.cache[search];
      } else {
        results = await snowfl(search);
      }

      if(results == null) {
        self.createFileInstance(Path.join(parentPath, "error fetching list"), "file", null, function (err, file) {
          cb(null, [file]);
        });
        //next(null, []);
        return;
      } else {
        global.cache[search] = results;

        fs.writeFile("cache.json", JSON.stringify(global.cache), function(err) {
          if (err) {
            console.log("Cache save error : " + err);
          }
        });
      }

      next(null, results.slice(0, 20));
    }

    function createFileInstances(torrents, next) {
      async.reduce(torrents, [],
        function (memo, torrent, callback) {
          self.createFileInstance(Path.join(parentPath, torrent.name), "folder", torrent, function (err, file) {
            if (err) {
              logger.error('[%s] tree.list %s: unexpected error while attempting to include %s in list', self.share.config.backend, pattern, name, err);
            } else {
              memo.push(file);
            }
            logger.debug('[%s] tree.list %s > %d', self.share.config.backend, pattern, memo.length);
            callback(null, memo);
          });
        },
        next
      );
    }

    async.waterfall([ menu, createFileInstances ], cb);
    return;
  }

  if(pattern.endsWith("/Files/*")) {
    var patternSplit = pattern.split("!SEARCH");
    var search = patternSplit[0].replaceAll("/*", "").replaceAll("/", "").replaceAll("!SEARCH", "").replaceAll("!SPACE", " ");
    var patternSplit2 = patternSplit[1].substring(1).split("/");
    var torrentName = patternSplit2[patternSplit2.length - 3];
    console.log("Search: " + search);
    console.log("Torrent Name: " + torrentName);
    var torrentCache = global.cache[search];
    var torrent;
    for(var torrentK in torrentCache) {
      var torrentV = torrentCache[torrentK];
      if(torrentV["name"] == torrentName) {
        torrent = torrentV;
        break;
      }
    }

    if(typeof torrent == 'undefined') {
      self.createFileInstance(Path.join(parentPath, "error fetching from cache"), "file", null, function (err, file) {
        cb(null, [file]);
      });
      return;
    }
    
    function filesMenu(torrentWT) { 
      console.log('Client is downloading:', torrentWT.infoHash);
      
      async function menu(next) {
        next(null, torrentWT.files);
      }

      function createFileInstances(files, next) {
        async.reduce(files, [],
          function (memo, file, callback) {
            var wtFile = file;
            self.createFileInstance(Path.join(parentPath, file.name), "torrentfile", file, function (err, file) {
              if (err) {
                logger.error('[%s] tree.list %s: unexpected error while attempting to include %s in list', self.share.config.backend, pattern, name, err);
              } else {
                memo.push(file);
              }
              logger.debug('[%s] tree.list %s > %d', self.share.config.backend, pattern, memo.length);
              global.filesD[wtFile.name] = wtFile;
              global.fileToTorrentD[wtFile] = torrentWT;
              callback(null, memo);
            });
          },
          next
        );
      }

      async.waterfall([ menu, createFileInstances ], cb);
    }

    if(torrent.torrentURL in global.torrentsD) {
      console.log("Going from backup!");
      filesMenu(global.torrentsD[torrent.torrentURL]);
    } else {
      console.log("Going from new!");
      try {
        global.webtorrent.add(torrent.torrentURL, {
          path: "./dls/"
        }, function (torrentWT) {
          global.torrentsD[torrent.torrentURL] = torrentWT;
          filesMenu(torrentWT);
        });
      } catch(e) {
        console.log("Error: " + e);
        for(var il in global.webtorrent.torrents) {
          console.log(il);
        }
        console.log("Error: " + e);
      }
    }
    return;
  }

  if(pattern.includes("!SEARCH/")) {
    for(var torrentURL in global.torrentsD) {
      console.log("Destroying " + torrentURL);
      global.torrentsD[torrentURL].destroy();
    }
    global.torrentsD = {};
    var patternSplit = pattern.split("!SEARCH");
    var search = patternSplit[0].replaceAll("/*", "").replaceAll("/", "").replaceAll("!SEARCH", "").replaceAll("!SPACE", " ");
    var patternSplit2 = patternSplit[1].substring(1).split("/");
    var torrentName = patternSplit2[patternSplit2.length - 2];
    console.log("Search: " + search);
    console.log("Torrent Name: " + torrentName);
    if(!(search in global.cache)) {
      self.createFileInstance(Path.join(parentPath, "Search failed, try again"), "file", torrent, function (err, file) {
        cb(null, [file]);
      });
      return;
    }
    var torrentCache = global.cache[search];
    var torrent;
    for(var torrentK in torrentCache) {
      var torrentV = torrentCache[torrentK];
      if(torrentV["name"] == torrentName) {
        torrent = torrentV;
        break;
      }
    }

    var memo = [];
    self.createFileInstance(Path.join(parentPath, "Files"), "folder", torrent, function (err, file) {
      memo.push(file);
      self.createFileInstance(Path.join(parentPath, "Seeders: " + torrent["seed"]), "file", torrent, function (err, file) {
        memo.push(file);
        self.createFileInstance(Path.join(parentPath, "Leechers: " + torrent["leech"]), "file", torrent, function (err, file) {
          memo.push(file);
          self.createFileInstance(Path.join(parentPath, "Source: " + torrent["sourceName"]), "file", torrent, function (err, file) {
            memo.push(file);
            self.createFileInstance(Path.join(parentPath, "Age: " + torrent["age"]), "file", torrent, function (err, file) {
              memo.push(file);
              self.createFileInstance(Path.join(parentPath, "Category: " + torrent["category"].replaceAll("/", "|")), "file", torrent, function (err, file) {
                memo.push(file);
                self.createFileInstance(Path.join(parentPath, "Size: " + torrent["size"]), "file", torrent, function (err, file) {
                  memo.push(file);
                  cb(null, memo);
                });
              });
            });
          });
        });
      });
    });

    return;
  }
  //if(pattern.includes("*")) {
  //  cb(null, []);
  //}

  for(var torrentURL in global.torrentsD) {
    console.log("Destroying " + torrentURL);
    global.torrentsD[torrentURL].destroy();
  }
  global.torrentsD = {};

  var layer = [];
  var subfolders = ["!SEARCH", "!SPACE", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
  
  function menu(next) {
    next(null, subfolders);
  }

  function createFileInstances(names, next) {
    async.reduce(names, [],
      function (memo, name, callback) {
        self.createFileInstance(Path.join(parentPath, name), "folder", null, function (err, file) {
          if (err) {
            logger.error('[%s] tree.list %s: unexpected error while attempting to include %s in list', self.share.config.backend, pattern, name, err);
          } else {
            memo.push(file);
          }
          logger.debug('[%s] tree.list %s > %d', self.share.config.backend, pattern, memo.length);
          callback(null, memo);
        });
      },
      next
    );
  }
  
  async.waterfall([ menu, createFileInstances ], cb);
};

/**
 * Create a new file.
 *
 * @param {String} name file name
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 * @param {File} cb.file created file
 */
TorrentTree.prototype.createFile = function (name, cb) {
  logger.debug('[%s] tree.createFile %s', this.share.config.backend, name);
  cb(SMBError.fromSystemError({message: 'not supported'}));
};

/**
 * Create a new directory.
 *
 * @param {String} name directory name
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 * @param {File} cb.file created directory
 */
TorrentTree.prototype.createDirectory = function (name, cb) {
  logger.debug('[%s] tree.createDirectory %s', this.share.config.backend, name);
  cb(SMBError.fromSystemError({message: 'not supported'}));
};

/**
 * Delete a file.
 *
 * @param {String} name file name
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 */
TorrentTree.prototype.delete = function (name, cb) {
  logger.debug('[%s] tree.delete %s', this.share.config.backend, name);
  cb(SMBError.fromSystemError({message: 'not supported'}));
};

/**
 * Delete a directory. It must be empty in order to be deleted.
 *
 * @param {String} name directory name
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 */
TorrentTree.prototype.deleteDirectory = function (name, cb) {
  logger.debug('[%s] tree.deleteDirectory %s', this.share.config.backend, name);
  perflog.debug('%s Tree.deleteDirectory.fs.rmdir', name);
  cb(SMBError.fromSystemError({message: 'not supported'}));
};

/**
 * Rename a file or directory.
 *
 * @param {String} oldName old name
 * @param {String} newName new name
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 */
TorrentTree.prototype.rename = function (oldName, newName, cb) {
  logger.debug('[%s] tree.rename %s to %s', this.share.config.backend, oldName, newName);
  perflog.debug('%s Tree.rename.fs.rename %s', oldName, newName);
  cb(SMBError.fromSystemError({message: 'not supported'}));
};

/**
 * Disconnect this tree.
 *
 * @param {Function} cb callback called on completion
 * @param {SMBError} cb.error error (non-null if an error occurred)
 */
TorrentTree.prototype.disconnect = function (cb) {
  logger.debug('[%s] tree.disconnect', this.share.config.backend);
  // there's nothing to do here
  process.nextTick(function () { cb(); });
};

module.exports = TorrentTree;
