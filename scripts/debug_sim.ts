
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  path: "/socket.io",
  transports: ["websocket"],
});

const USERNAME = "SimAgent";
let myId = "sim_" + Date.now();
let gameState: any = {};
let myHand: any[] = [];

console.log("--- STARTING SIMULATION ---");

socket.on("connect", () => {
  console.log("Connected with ID:", socket.id);
  socket.emit("join-game", { username: USERNAME, userId: myId });
});

socket.on("game-update", (state: any) => {
  gameState = state;
  // Extract hand
  if (state.hands && state.hands[myId]) {
      myHand = state.hands[myId];
  }
  
  const myIndex = gameState.players.findIndex((p: any) => p.id === myId);
  const turnIndex = gameState.turnIndex;
  
  console.log(`[STATE] Phase: ${gameState.phase}, Turn: ${turnIndex}, MyIndex: ${myIndex}, HandSize: ${myHand.length}`);

  if (state.phase === 'lobby' && gameState.players.length === 1) {
      console.log("Lobby empty. Starting bots...");
      socket.emit("start-game-bots");
  }
  
  if (state.phase === 'bidding' && turnIndex === myIndex) {
      console.log("My Turn to Bid. Passing.");
      socket.emit("player-bid", { action: "pass" });
  }

  if (state.phase === 'playing' && turnIndex === myIndex) {
      console.log("My Turn to Play!");
      
      // Find playable card
      // Simplified rule: Just pick first card
       if (myHand.length > 0) {
           const card = myHand[0];
           console.log("Playing card:", card.id);
           socket.emit("play-card", card.id);
       } else {
           console.error("My Turn but NO CARDS!");
       }
  }
  
  if (state.phase === 'round_summary') {
      console.log("Round Summary. READYing up.");
      socket.emit("player-ready");
  }
});

socket.on("disconnect", () => {
    console.log("Disconnected.");
});

// Run for 30 seconds then exit
setTimeout(() => {
    console.log("--- SIMULATION END ---");
    process.exit(0);
}, 30000);
