
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  path: "/socket.io",
  transports: ["websocket"],
});

const USERNAME = "MimicUser";
const MY_ID = "user_mimic_1"; // Fixed ID for reconnection testing
let gameState: any = {};
let myHand: any[] = [];
let myLastTurn = -1;

console.log("--- STARTING ADVANCED SIMULATION (MimicUser) ---");

socket.on("connect", () => {
  console.log("Connected with Socket ID:", socket.id);
  // Simulate "Lancer" button if strictly necessary? No, just join.
  socket.emit("join-game", { username: USERNAME, userId: MY_ID });
});

socket.on("game-update", (state: any) => {
  gameState = state;
  if (state.hands && state.hands[MY_ID]) {
      myHand = state.hands[MY_ID];
  }
  
  const myIndex = gameState.players.findIndex((p: any) => p.id === MY_ID);
  const turnIndex = gameState.turnIndex;
  
  // Detect Turn Skip
  if (myLastTurn !== -1 && turnIndex !== myLastTurn && turnIndex !== myIndex) {
      // Turn changed, and it's not me.
      // Did I play?
      // Simple logic: if I was TurnIndex, and now I am not, play was successful.
  }
  myLastTurn = turnIndex;

  console.log(`[STATE] Phase: ${gameState.phase.toUpperCase()} | Turn: ${turnIndex} | Me: ${myIndex} (IsBot: ${gameState.players[myIndex]?.isBot}) | Hand: ${myHand.length}`);
  
  if (myIndex !== -1 && gameState.players[myIndex].isBot) {
      console.error("!!! CRITICAL FAILURE: I AM FLAGGED AS A BOT !!!");
      process.exit(1);
  }

  if (state.phase === 'lobby' && gameState.players.length === 1) {
      console.log("Lobby empty. Adding bots to start...");
      socket.emit("start-game-bots");
  }
  
  if (state.phase === 'bidding' && turnIndex === myIndex) {
      console.log(">> MY TURN TO BID. Passing.");
      socket.emit("player-bid", { action: "pass" });
  }

  if (state.phase === 'round_summary') {
      console.log(">> ROUND END. Clicking Ready.");
      socket.emit("player-ready");
  }

  if (state.phase === 'playing' && turnIndex === myIndex) {
      console.log(">> MY TURN TO PLAY!");
       if (myHand.length > 0) {
           const card = myHand[0];
           console.log(`>> Attempting to play ${card.id}`);
           socket.emit("play-card", card.id);
       } else {
           console.error("!! My Turn but NO CARDS in hand !!");
       }
  }
});

socket.on("disconnect", () => {
    console.log("Disconnected.");
});

// Run for 60 seconds
setTimeout(() => {
    console.log("--- SIMULATION TIMEOUT ---");
    process.exit(0);
}, 60000);
