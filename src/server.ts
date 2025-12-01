import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import http from "http";
import dotenv from "dotenv";

import callRoutes from "./routes/callRoutes";
import connectActionRoutes from "./routes/connectActionRoutes";
import conversationRoutes from "./routes/conversationRoutes";
import { initializeWebSocketHandlers } from "./services/llm/websocketService";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded. for some reason, this has has to be before the json parser
app.use(express.json()); // for parsing application/json


// Routes
app.use("/api", callRoutes);
app.use("/api", connectActionRoutes);
app.use("/api/conversations", conversationRoutes);


// Create HTTP server
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server });
initializeWebSocketHandlers(wss);

// Start server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export { app, server };