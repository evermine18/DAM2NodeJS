const express = require('express')
const fs = require('fs/promises')
const url = require('url')
const mysql = require('mysql')
const post = require('./post.js')
const { v4: uuidv4 } = require('uuid')

// Wait 'ms' milliseconds
function wait (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Start HTTP server
const app = express()

// Set port number
const host = process.env.HOST || "0.0.0.0"
const port = process.env.PORT || 3000

// Publish static files from 'public' folder
app.use(express.static('public'))

// Activate HTTP server
const httpServer = app.listen(port, host, appListen)
function appListen () {
  console.log(`Listening for HTTP queries on: http://${host}:${port}`)
}
app.post('/checkServer',checkServer)
async function checkServer (req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({"status":"OK"}));
}
app.post('/people',getPeople)
async function getPeople (req, res) {
  var people = {};
  res.writeHead(200, { 'Content-Type': 'application/json' });
  console.log("si va");
  var result = await queryDatabase("SELECT * FROM people");
  console.log(result[0].name);
  for(var i in result){
    console.log(result[i].id);
  }
  res.end(JSON.stringify({"result":result}));
}
app.post('/updatePerson',updatePerson)
async function updatePerson (req, res) {
  let data = await post.getPostObject(req);
  let status = "KO";
  let userCheck = checkUser(data);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  if(userCheck.status){
    var result = await queryDatabase("UPDATE people SET name='"+data.name+"', surname='"+data.surname+"', mail='"+data.mail+"', phone='"+data.phone+"', street='"+data.street+"', city='"+data.city+"' WHERE id="+data.id+";");
    status = "OK";
  }
  
  res.end(JSON.stringify({"status":status,"result": userCheck.result}));
}
app.post('/addPerson',addPerson)
async function addPerson (req, res) {
  let data = await post.getPostObject(req);
  let status = "KO";
  let userCheck = checkUser(data);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  if(userCheck.status){
    var result = await queryDatabase("INSERT INTO people(name, surname, mail, phone, street, city) VALUES ('"+data.name+"', '"+data.surname+"', '"+data.mail+"', '"+data.phone+"', '"+data.street+"', '"+data.city+"');");
    status = "OK";
  }
  res.end(JSON.stringify({"status":status,"result": userCheck.result}));
}
// Set URL rout for POST queries
app.post('/dades', getDades)
async function getDades (req, res) {
  let receivedPOST = await post.getPostObject(req)
  let result = {};

  var textFile = await fs.readFile("./public/consoles/consoles-list.json", { encoding: 'utf8'})
  var objConsolesList = JSON.parse(textFile)

  if (receivedPOST) {
    if (receivedPOST.type == "consola") {
      var objFilteredList = objConsolesList.filter((obj) => { return obj.name == receivedPOST.name })
      await wait(1500)
      if (objFilteredList.length > 0) {
        result = { status: "OK", result: objFilteredList[0] }
      }
    }
    if (receivedPOST.type == "marques") {
      var objBrandsList = objConsolesList.map((obj) => { return obj.brand })
      await wait(1500)
      let senseDuplicats = [...new Set(objBrandsList)]
      result = { status: "OK", result: senseDuplicats.sort() } 
    }
    if (receivedPOST.type == "marca") {
      var objBrandConsolesList = objConsolesList.filter ((obj) => { return obj.brand == receivedPOST.name })
      await wait(1500)
      // Ordena les consoles per nom de model
      objBrandConsolesList.sort((a,b) => { 
          var textA = a.name.toUpperCase();
          var textB = b.name.toUpperCase();
          return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
      })
      result = { status: "OK", result: objBrandConsolesList } 
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))
}

// Run WebSocket server
const WebSocket = require('ws')
const wss = new WebSocket.Server({ server: httpServer })
const socketsClients = new Map()
console.log(`Listening for WebSocket queries on ${port}`)

// What to do when a websocket client connects
wss.on('connection', (ws) => {

  console.log("Client connected")

  // Add client to the clients list
  const id = uuidv4()
  const color = Math.floor(Math.random() * 360)
  const metadata = { id, color }
  socketsClients.set(ws, metadata)

  // Send clients list to everyone
  sendClients()

  // What to do when a client is disconnected
  ws.on("close", () => {
    socketsClients.delete(ws)
  })

  // What to do when a client message is received
  ws.on('message', (bufferedMessage) => {
    var messageAsString = bufferedMessage.toString()
    var messageAsObject = {}
    
    try { messageAsObject = JSON.parse(messageAsString) } 
    catch (e) { console.log("Could not parse bufferedMessage from WS message") }

    if (messageAsObject.type == "bounce") {
      var rst = { type: "bounce", message: messageAsObject.message }
      ws.send(JSON.stringify(rst))
    } else if (messageAsObject.type == "broadcast") {
      var rst = { type: "broadcast", origin: id, message: messageAsObject.message }
      broadcast(rst)
    } else if (messageAsObject.type == "private") {
      var rst = { type: "private", origin: id, destination: messageAsObject.destination, message: messageAsObject.message }
      private(rst)
    }
  })
})

// Send clientsIds to everyone
function sendClients () {
  var clients = []
  socketsClients.forEach((value, key) => {
    clients.push(value.id)
  })
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      var id = socketsClients.get(client).id
      var messageAsString = JSON.stringify({ type: "clients", id: id, list: clients })
      client.send(messageAsString)
    }
  })
}

// Send a message to all websocket clients
async function broadcast (obj) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      var messageAsString = JSON.stringify(obj)
      client.send(messageAsString)
    }
  })
}

// Send a private message to a specific client
async function private (obj) {
  wss.clients.forEach((client) => {
    if (socketsClients.get(client).id == obj.destination && client.readyState === WebSocket.OPEN) {
      var messageAsString = JSON.stringify(obj)
      client.send(messageAsString)
      return
    }
  })
}
function checkUser(json){
  if(containsNumber(json.name)| json.name==""){
    return {status:false,result:"Invalid name."};
  }
  if(containsNumber(json.surname)| json.name==""){
    return {status:false,result:"Invalid surname."};
  }
  if(!checkEmail(json.mail)| json.mail==""){
    return {status:false,result:"Invalid mail."};
  }
  if(!checkPhone(json.phone)| json.phone==""){
    return {status:false,result:"Invalid phone number."};
  }
  if(!checkStreet(json.street)| json.street==""){
    return {status:false,result:"Invalid street."};
  }
  if(!checkCity(json.city)| json.city==""){
    return {status:false,result:"Invalid city."};
  }

  return {status:true,result:""};
}
function checkPhone(str){
  var filter = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im
  return filter.test(str)
}
function checkEmail(str){
  var filter = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return filter.test(str);
}
function checkStreet(str) {
  return /^[A-Za-z0-9 ]*$/.test(str);
}
function containsNumber(str) {
  return /\d/.test(str);
}
function checkCity(str) {
  return /^[A-Za-z]*$/.test(str);
}
// Perform a query to the database
function queryDatabase (query) {

  return new Promise((resolve, reject) => {
    var connection = mysql.createConnection({
      host: process.env.MYSQLHOST || "localhost",
      port: process.env.MYSQLPORT || 3306,
      user: process.env.MYSQLUSER || "root",
      password: process.env.MYSQLPASSWORD || "Persiana@1234",
      database: process.env.MYSQLDATABASE || "prova"
    });

    connection.query(query, (error, results) => { 
      if (error) reject(error);
      resolve(results)
    });
     
    connection.end();
  })
}