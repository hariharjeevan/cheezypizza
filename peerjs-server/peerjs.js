const express = require('express')
const { ExpressPeerServer } = require('peer')

const app = express()
const port = process.env.PORT || 9000
const server = app.listen(port, () => {
  console.log(`PeerJS server running on port ${port}`)
})

const peerServer = ExpressPeerServer(server, {
  path: '/'
})

peerServer.on('connection', (client) => console.log(`[peer] connected: ${client.getId()}`))
peerServer.on('disconnect', (client) => console.log(`[peer] disconnected: ${client.getId()}`))

app.use('/peerjs', peerServer)