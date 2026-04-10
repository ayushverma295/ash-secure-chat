const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const rooms = {}; // roomId => {admin, password, users:Set, userNames:Map<socketId, username>}

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Secure Chat PRO</title>

<!-- Google tag (gtag.js) --> 
<script async src="https://www.googletagmanager.com/gtag/js?id=G-T94R4T0D6W"></script>
<script>   
  window.dataLayer = window.dataLayer || [];  
    function gtag(){dataLayer.push(arguments);} 
    gtag('js', new Date());    gtag('config', 'G-T94R4T0D6W'); </script>

<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*{box-sizing:border-box;font-family:Segoe UI,Arial}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f2027,#203a43,#2c5364);color:#fff}
.card{width:100%;max-width:420px;background:rgba(255,255,255,.08);backdrop-filter:blur(12px);border-radius:16px;padding:20px;box-shadow:0 20px 40px rgba(0,0,0,.5)}
h2{text-align:center}
input,button{width:100%;padding:12px;margin:8px 0;border:none;border-radius:10px}
button{background:#4f8cff;color:#fff;font-weight:600;cursor:pointer}
button.secondary{background:#666}
#chat{display:none}
#messages{height:250px;background:rgba(0,0,0,.3);padding:10px;overflow-y:auto;border-radius:10px;margin-bottom:10px}
.msg{margin:6px 0;padding:8px 12px;border-radius:14px;background:#2e89ff}
.msg.other{background:#444}
img{max-width:100%;border-radius:10px;margin-top:5px}
#typing{font-size:12px;color:#ff0;margin-bottom:5px}
#onlineUsers{font-size:12px;margin-bottom:5px}

/* Responsive mobile */
@media screen and (max-width:500px){
  .card{max-width:95%;padding:15px}
  input,button{padding:10px;font-size:14px}
  #messages{height:200px}
}

.exit-btn{
  background:#ff4d4d;
  color:#fff;
  border:none;
  padding:6px 12px;
  border-radius:6px;   /* square look */
  font-size:12px;
  cursor:pointer;
  width:auto;
  height:auto;
}

.exit-btn:hover{
  background:#e60000;
}

</style>
</head>

<body>
<div class="card" id="login">
<h2>Secure Chat PRO</h2>
<input id="usernameInput" placeholder="Username">
<input id="roomInput" placeholder="Room Number">
<input id="passwordInput" placeholder="Room Password (optional)">
<button id="createBtn">Create Room</button>
<button id="joinBtn" class="secondary">Join Room</button>
</div>

<div class="card" id="chat">
<h2>Chat Room</h2>

<div style="display:flex;align-items:center;gap:10px;">
<button id="exitBtn" class="exit-btn">Exit</button>
  
</div>

<div id="onlineUsers"></div>
<div id="typing"></div>
<div id="messages"></div>

<div style="display:flex;gap:5px;align-items:center;">
  <input id="msgInput" placeholder="Message" style="flex:1;padding:10px;border-radius:20px;border:none;">
  
  <button id="sendBtn" style="width:45px;height:45px;border-radius:50%;">➤</button>
</div>

<input type="file" id="imgInput">
<div id="requests"></div>
</div>

<script src="/socket.io/socket.io.js"></script>

<script>
const socket = io();
const login=document.getElementById("login");
const chat=document.getElementById("chat");
const messages=document.getElementById("messages");
const typingDiv=document.getElementById("typing");
const onlineDiv=document.getElementById("onlineUsers");
let roomId="",userName="",isAdmin=false;

document.getElementById("createBtn").addEventListener("click",()=>{
  userName=document.getElementById("usernameInput").value;
  roomId=document.getElementById("roomInput").value;
  const password=document.getElementById("passwordInput").value;
  if(!userName||!roomId) return alert("Fill all fields");
  socket.emit("createRoom",{username:userName,room:roomId,password});
});

document.getElementById("joinBtn").addEventListener("click",()=>{
  userName=document.getElementById("usernameInput").value;
  roomId=document.getElementById("roomInput").value;
  const password=document.getElementById("passwordInput").value;
  if(!userName||!roomId) return alert("Fill all fields");
  socket.emit("requestJoin",{username:userName,room:roomId,password});
});

document.getElementById("sendBtn").addEventListener("click",sendMsg);

document.getElementById("msgInput").addEventListener("keypress", function(e){
  if(e.key === "Enter"){
    e.preventDefault();
    sendMsg();
  }
});

document.getElementById("msgInput").addEventListener("input",()=>socket.emit("typing",{room:roomId,user:userName}));

function sendMsg(){
  const text=document.getElementById("msgInput").value;
  if(text) socket.emit("message",{room:roomId,user:userName,text});
  document.getElementById("msgInput").value="";
  const file=document.getElementById("imgInput").files[0];
  if(file){
    const r=new FileReader();
    r.onload=()=>socket.emit("image",{room:roomId,user:userName,image:r.result});
    r.readAsDataURL(file);
    document.getElementById("imgInput").value="";
  }
}

socket.on("joined",data=>{
  isAdmin=data.admin;
  login.style.display="none";
  chat.style.display="block";
});

socket.on("joinRequest",({username,socketId})=>{
  if(!isAdmin) return;
  const b=document.createElement("button");
  b.textContent="Accept "+username;
  b.onclick=()=>{
    socket.emit("approveJoin",{socketId,room:roomId});
    b.remove();
  };
  document.getElementById("requests").appendChild(b);
});

socket.on("message",d=>addMsg(d.user===userName?"You":d.user,d.text,d.user===userName));
socket.on("image",d=>addMsg(d.user===userName?"You":d.user,"<img src='"+d.image+"'>",d.user===userName));
socket.on("typing",d=>{typingDiv.textContent=d.user+" is typing..."; setTimeout(()=>{typingDiv.textContent=""},1000)});
socket.on("updateUsers",users=>{onlineDiv.innerHTML ="<b>Online:</b><br>"+users.map(u => "🟢 " + u) .join("<br>"); });
socket.on("roomClosed",()=>{alert("Admin left. Room closed."); location.reload()});

function addMsg(user,content,self){
  const d=document.createElement("div");
  const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  
  d.className="msg"+(self?"":" other");
  d.innerHTML=`<b>${user}</b> <small>${time}</small><br>${content}`;
  
  messages.appendChild(d);
  messages.scrollTop=messages.scrollHeight;
}

window.onload = function(){

  document.getElementById("exitBtn").onclick = function () {

    // server ko batao leave
    socket.emit("leaveRoom");

    // chat hide
    document.getElementById("chat").style.display = "none";

    // login hide
    document.getElementById("login").style.display = "none";

    // exit screen show
    document.getElementById("exitScreen").style.display = "flex";

  };

};

</script>

<div id="exitScreen" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:#0f172a;color:white;justify-content:center;align-items:center;flex-direction:column;">
  <h1>👋 You left the room</h1>
  <p>Made in Bihar, With 🤍 Ayush Verma</p>
</div>

</body>
</html>
`);
});

io.on("connection",socket=>{
  socket.on("createRoom",({username,room,password})=>{
    if(rooms[room]) return;
    rooms[room]={admin:socket.id,password:password||"",users:new Set([socket.id]),userNames:new Map([[socket.id,username]])};
    socket.join(room);
    socket.roomId=room;
    socket.emit("joined",{admin:true});
    io.to(room).emit("updateUsers",Array.from(rooms[room].userNames.values()));
  });

  socket.on("requestJoin",({username,room,password})=>{
    if(!rooms[room]) return socket.emit("joinFailed","Room not found");
    if(rooms[room].password && rooms[room].password!==password) return socket.emit("joinFailed","Wrong password");
    io.to(rooms[room].admin).emit("joinRequest",{username,socketId:socket.id});
  });

  socket.on("approveJoin",({socketId,room})=>{
    const s=io.sockets.sockets.get(socketId);
    if(!s || !rooms[room]) return;
    rooms[room].users.add(socketId);
    rooms[room].userNames.set(socketId,"Guest");
    s.join(room);
    s.roomId=room;
    io.to(socketId).emit("joined",{admin:false});
    io.to(room).emit("updateUsers",Array.from(rooms[room].userNames.values()));
  });

  socket.on("message",d=>{ if(rooms[d.room]) io.to(d.room).emit("message",d); });
  socket.on("image",d=>{ if(rooms[d.room]) io.to(d.room).emit("image",d); });
  socket.on("typing",d=>{ if(rooms[d.room]) socket.to(d.room).emit("typing",d); });

  socket.on("disconnect",()=>{
    const room=socket.roomId;
    if(!room || !rooms[room]) return;
    rooms[room].users.delete(socket.id);
    rooms[room].userNames.delete(socket.id);
    io.to(room).emit("updateUsers",Array.from(rooms[room].userNames.values()));
    if(rooms[room].admin===socket.id){
      delete rooms[room];
      io.to(room).emit("roomClosed");
      return;
    }
    if(rooms[room].users.size===0) delete rooms[room];
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🔥 RUNNING http://localhost:${PORT}`));








//node server.js
