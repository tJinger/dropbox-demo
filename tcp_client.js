let fs = require('fs')
let path = require('path')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let net = require('net')
let JsonSocket = require('json-socket')

let argv = require('yargs')
    .default('dir', process.cwd())
    .default('event', 'create')
    .default('file', '')
    .default('port', '9838')
    .help('help').alias('help', 'h')
    .argv

const PORT = 9838
const ROOT_DIR = path.resolve(argv.dir)

let socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
socket.connect(PORT, '127.0.0.1');

socket.on('connect', function () {
  let filePath = argv.file
  let endsWithSlash = filePath.charAt(filePath.length-1) === path.sep
  let hasExt = path.extname(filePath) !== ''
  let isDir = endsWithSlash || !hasExt
  
  console.log({event: argv.event, type: 'dir', filePath: argv.file})
  if (isDir) 
  	socket.sendMessage({event: argv.event, type: 'dir', filePath: argv.file})
  else
  	socket.sendMessage({event: argv.event, type: 'file', filePath: argv.file})

  socket.on('message', function(message) {
	console.log(message)
	let msgPath = message.path
	let type = message.type
	let action = message.event
	filePath = path.resolve(path.join(ROOT_DIR, msgPath))
	if (type === 'dir') {
	  if (action === 'delete') {
        fs.promise.stat(filePath)
          .then(stat => {
            rimraf.promise(filePath)
        }).catch();
      } else if (action === 'create') {
        mkdirp.promise(filePath);
      }
	} else {
	  if (action === 'delete') {
	   fs.promise.stat(filePath)
	     .then(stat => {
            fs.promise.unlink(filePath);
	    }).catch();
      } else if (action === 'create') {
	    let dir = path.dirname(filePath);
	    mkdirp.promise(dir);
	    fs.createWriteStream(filePath)
      }
    }
  })
})