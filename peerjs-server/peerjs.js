const express = require('express')
const { ExpressPeerServer } = require('peer')

const app = express()
const port = process.env.PORT || 9000

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
  }
  next()
})

const server = app.listen(port, () => {
  console.log(`PeerJS server running on port ${port}`)
})

const peerServer = ExpressPeerServer(server, {
  path: '/',
  key: 'peerjs',
})

peerServer.on('connection', (client) => console.log(`[peer] connected: ${client.getId()}`))
peerServer.on('disconnect', (client) => console.log(`[peer] disconnected: ${client.getId()}`))

app.use('/', peerServer)