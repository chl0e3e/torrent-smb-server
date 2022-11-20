# Torrent SPI for adobe/node-smb-server

**:warning: This code was quickly hacked together on top of an unmaintained implementation of the SMB protocol.**

## Overview

**torrent-smb-server** provides an additional SPI backend to the SMB server previously [maintained by Adobe under this repository](https://github.com/adobe/node-smb-server).

The repository is no longer maintained, however, the SMB protocol implementation does in fact work to *some* degree.

An additional SPI backend was made to create "fake" virtual folders from A-Z for searching, a virtual folder named "!SEARCH" which submits the query to a torrent search engine, and a "!SPACE" folder which can be used to add a space to the query. Once the "!SEARCH" folder is opened, the SMB server makes a query to [snowfl](https://snowfl.com/), which is a website that aggregates torrent engines into a digestible result. The searching is done in "lib/backends/torrent/snowfl.js" and uses Selenium, as a proof of concept.

The SMB server then adds the torrent to WebTorrent where it is streamed on demand in the order that Kodi demands it, making things like seeking and multiple episodes much more easily supported. The SPI backend forces WebTorrent to drop its selection of priority pieces when another file is selected, making the next file much more readily available.

The full SMB server repository was included as later on internal functions related to `lib/smbfile.js` will need to be changed so that the alphabetical searching menus do not take up all the memory of the computer running the SMB server. As a result, it will not work with the Windows Explorer very well and will probably crash that within minutes, if not at least make it unbearably slow to live with.

The code also needs excessive refactoring as a lot of it is a quick implementation using string replacements and split(), instead of separating the SMB paths and walking the resultant array.

![](kodi.gif)

# SMB Server for Node.js

**:warning: The official repository for the SMB server component is no longer actively maintained.**

## Overview

**node-smb-server** is an open-source JavaScript implementation of the [SMB/CIFS](https://en.wikipedia.org/wiki/Server_Message_Block#SMB_/_CIFS_/_SMB1) file sharing protocol.

Some highlights:

* pure JavaScript
* fully configurable/customizable
* extensible: allows to expose non-filesystem based data as a mountable file system via an abstract backend SPI (similar to Samba's VFS)

> **Note**:
>
> The current implementation works with **Finder** on **OS X** (Yosemite, El Capitan, Sierra). More recent OS X versions might work as well but they haven't been tested.
>
>**Windows** is not supported. **File Explorer** only supports the standard SMB port `445`. It's virtually impossible to run a custom SMB server listening on port `445` on Windows. See [here](https://github.com/adobe/node-smb-server/issues/3#issuecomment-349855169) and [here](https://github.com/adobe/node-smb-server/issues/6#issuecomment-304242562) for related discussions. 




## Installation

```bash
npm install node-smb-server
```

or

```bash
git clone https://github.com/adobe/node-smb-server.git
cd node-smb-server
npm install
```

## Getting started

Execute the following commands in a terminal:

```bash
cd <node-smb-server install dir>
npm start
```

In Finder, open the 'Connect to Server' dialog (⌘K) and enter the url `smb://localhost:8445/fs` (user: `test`, password: `test`).

## Getting your hands dirty

### User management

The following users are pre-configured: `test/test`, `admin/admin`, `guest/<empty password>`

Users can be edited in the `config.json` file:

```json
...
"users" : {
    "test" : {
      "lmHash" : "01fc5a6be7bc6929aad3b435b51404ee",
      "ntlmHash" : "0cb6948805f797bf2a82807973b89537"
    },
    "admin" : {
      "lmHash" : "f0d412bd764ffe81aad3b435b51404ee",
      "ntlmHash" : "209c6174da490caeb422f3fa5a7ae634"
    },
    "guest" : {
      "lmHash" : "aad3b435b51404eeaad3b435b51404ee",
      "ntlmHash" : "31d6cfe0d16ae931b73c59d7e0c089c0"
    }
  }
...
```

Password hashes can be computed by running:

```bash
node createhash.js
```

### Share configuration

Share configurations can be edited in the `config.json` file, e.g.:

```json
...
 "shares": {
    "FS": {
      "backend": "fs",
      "description": "fs-based test share",
      "path": "./smbroot"
    },
    "JCR": {
      "backend": "jcr",
      "description": "AEM-based test share",
      "host": "localhost",
      "port": 4502,
      "protocol": "http:",
      "auth": {
        "user": "<user>",
        "pass": "<pwd>"
      },
      "path": "/",
      "maxSockets": 64,
      "contentCacheTTL": 30000,
      "binCacheTTL": 600000
    },
...
```

### Developing a custom backend

Consider the following example use case:

*You would like to enable your desktop applications to access data and documents stored in a RDBMS or a Cloud-based service.*

You could write a custom backend by implementing the `Share`, `Tree` and `File` interfaces of the virtual backend SPI (`lib/spi`). Check out the existing implementations (`lib/backends`) to get an idea.  

## Current Status

* Implements **CIFS** and **MS-SMB 1.0**.
* Support for **SMB2** is currently work in progress.
* Supports **LM**, **LMv2**, **NTLM**, **NTLMSSP** authentication protocols
* Supported backends:
  * local file system (`lib/backends/fs`)
  * [JCR](http://jackrabbit.apache.org/jcr/jcr-api.html) (`lib/backends/jcr`)
  * [AEM Assets](https://helpx.adobe.com/experience-manager/6-3/assets/using/mac-api-assets.html) (`lib/backends/dam`)
* Tested with Finder on OS X (Yosemite, El Capitan, Sierra).

## ToDo's

* Test with other clients on other platforms (Windows, Linux).
* Test cases/suite

### **CIFS/SMB**

* missing `NT_TRANSACT` subcommands
* missing `TRANSACTION` subcommands
* missing `TRANSACTION2` subcommand information levels
* missing CIFS commands:
  * `TRANSACTION_SECONDARY`
  * `TRANSACTION2_SECONDARY`
  * `NT_TRANSACT_SECONDARY`
  * `OPEN_PRINT_FILE`
* support for named streams?
* SMB Signing?
* proper implementation of `LOCKING_ANDX`?

### **SMB Versions 2 and 3**

Check/Implement the following protocol extensions/versions:

* [SMB v2](https://en.wikipedia.org/wiki/Server_Message_Block#SMB_2.0)
* [SMB v3](https://en.wikipedia.org/wiki/Server_Message_Block#SMB_3.0)

## Specifications

* [MS-CIFS: Common Internet File System (CIFS) Protocol](https://msdn.microsoft.com/en-us/library/ee442092.aspx)
* [MS-SMB: Server Message Block (SMB) Protocol](https://msdn.microsoft.com/en-us/library/cc246231.aspx)
* [MS-SMB2: Server Message Block (SMB) Protocol Versions 2 and 3](https://msdn.microsoft.com/en-us/library/cc246482.aspx)

## Contributing

If you are interested in contributing to this project, check out our [contribution guidelines](CONTRIBUTING.md)!
