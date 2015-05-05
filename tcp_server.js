let fs = require('fs')
let path = require('path')
let net = require('net')
let JsonSocket = require('json-socket')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let port = 9838

require('songbird')

let argv = require('yargs')
    .default('dir', process.cwd())
    .help('help').alias('help', 'h')
    .argv

let server = net.createServer()

const ROOT_DIR = path.resolve(argv.dir)

server.listen(port);
server.on('connection', function(socket) { //This is a standard net.Socket
    socket = new JsonSocket(socket); //Now we've decorated the net.Socket to be a JsonSocket
    socket.on('message', function(message) {
      let msgFilePath = message.filePath
      let fileType = message.type
      let event = message.event
      let filePath = path.resolve(path.join(ROOT_DIR, message.filePath))
      let stat = fs.promise.stat(filePath)
      console.log(filePath)
      if (fileType === 'dir') {
        if (event === 'delete') {
          fs.promise.stat(filePath)
            .then(stat => {
                rimraf.promise(filePath)
            }).catch();
          socket.sendMessage({ action: 'delete', path: msgFilePath, type: 'dir', contents: null, updated: new Date().getTime()})
        } else if (event === 'create') {
            mkdirp.promise(filePath)
            socket.sendMessage({ action: 'create', path: msgFilePath, type: 'dir', contents: null, updated: new Date().getTime()})
        }
      } else {
        if (event === 'delete') {
          fs.promise.stat(filePath)
            .then(stat => {
                fs.promise.unlink(filePath);
          }).catch();
          socket.sendMessage({ action: 'delete', path: msgFilePath, type: 'file', contents: null, updated: new Date().getTime()})
        } else if (event === 'create') {
            console.log(filePath)
            fs.createWriteStream(filePath)
            socket.sendMessage({ action: 'create', path: msgFilePath, type: 'file', contents: null, updated: new Date().getTime()})
        }
      }
    })
})