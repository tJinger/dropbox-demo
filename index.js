let fs = require('fs')
let path = require('path')
let https = require('https')
let agentkeepalive = require('agentkeepalive');
let express = require('express')
let morgan = require('morgan')
let nodeify = require('bluebird-nodeify')
let mime = require('mime-types')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let archiver = require('archiver')
let unzip = require('unzip')
let argv = require('yargs')
    .default('dir', process.cwd())
    .help('help').alias('help', 'h')
    .argv

require('songbird')

const NODE_ENV = process.env.NODE_ENV
const PORT = process.env.PORT || 8000
const HTTPSPORT = 8030
const ROOT_DIR = path.resolve(argv.dir)

let app = express()

if (NODE_ENV === 'development') {
  app.use(morgan('dev'))
}

app.listen(PORT, ()=> console.log(`Listening @ http://127.0.0.1:${PORT}`))

// GET method route
app.get('*', setFileMeta, sendHeaders, (req, res, next) => {
  async ()=> {
    if (!req.headers['x-get-zip']) {
      res.json(res.body);
      return
    } else {
        await archiveDir(req, res, next)
    }

    fs.createReadStream(req.filePath)
      .pipe(res)
  }().catch(next)
})

app.head('*', setFileMeta, sendHeaders, (req, res) => res.end())

app.delete('*', setFileMeta, (req, res, next) => {
  async () => {
    if (!req.stat) return res.status('405').send( 'Invalid path')

    if (req.stat && req.stat.isDirectory()) {
      await rimraf.promise(req.filePath)
      console.log(req.filePath)
    } else await fs.promise.unlink(req.filePath)
    res.end()
  }().catch(next)
})

app.put('*', setFileMeta, setDirDetails, (req, res, next) => {
  async () => {
    if (req.stat) return res.status('405').send('File exists')
    await mkdirp.promise(req.dirPath)
    if (req.filePath.endsWith('.zip')) {
       unArchive(req, res)
    }
    if (!req.isDir) req.pipe(fs.createWriteStream(req.filePath))
    res.end()
  }().catch(next)
})

app.post('*', setFileMeta, setDirDetails, (req, res, next) => {
  async () => {
    if (!req.stat) return res.status('405').send('File does not exist')
    if (req.isDir || req.stat.isDirectory()) return res.send('405', 'Path is a directory')
    
    await fs.promise.truncate(req.filePath, 0)
    req.pipe(fs.createWriteStream(req.filePath))
    res.end()
  }().catch(next)
})

function setDirDetails(req, res, next) {
  let filePath = req.filePath
  let endsWithSlash = filePath.charAt(filePath.length-1) === path.sep
  let hasExt = path.extname(filePath) !== ''
  req.isDir = endsWithSlash || !hasExt
  req.dirPath = req.isDir ? filePath : path.dirname(filePath)
  next()
}

function setFileMeta(req, res, next) {
  req.filePath = path.resolve(path.join(ROOT_DIR, req.url))
  if (req.filePath.indexOf(ROOT_DIR) !== 0) {
    res.send(400, 'Invalid path')
    return
  }
  fs.promise.stat(req.filePath)
    .then(stat => req.stat = stat, () => req.stat = null)
    .nodeify(next)
}

function sendHeaders(req, res, next) {
  nodeify(async () => {
    if (req.stat.isDirectory()) {
      let files = await fs.promise.readdir(req.filePath)
      res.body = JSON.stringify(files)
      res.setHeader('Content-Length', res.body.length)
      res.setHeader('Content-Type', 'application/json')
      return
    }

    res.setHeader('Content-Length', req.stat.size)
    let contentType = mime.contentType(path.extname(req.filePath))
    res.setHeader('Content-Type', contentType)
  }(), next)
}

function unArchive(req, res, next) {
    async()=> {
        let extract = unzip.Extract({path: req.dirPath});
        req.pipe(extract);
        extract.on('close', function () {
            return res.end();
        });
    }
    ().catch(err=>console.log(err.stack));
}