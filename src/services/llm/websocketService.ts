import { WebSocketServer, WebSocket } from "ws";
import LLMService from "./llmService";
import { ConversationRelayMessage } from "../../types";
import {config} from "../../config";
import { DTMFHelper } from "./dtmfHelper";


export function initializeWebSocketHandlers(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    console.log("New WebSocket connection");

    const llmService = new LLMService(config.openai.apiKey);
    const dtmfHelper = new DTMFHelper();

    ws.on("message", (message: string) => {
      try {
        const parsedMessage: ConversationRelayMessage = JSON.parse(message);
        console.log("Parsed message:", parsedMessage);
        switch (parsedMessage.type) {
          case "prompt":
            // If we're waiting for a post-interruption prompt, allow it
            if (!llmService.streamActive || llmService.awaitingPostInterruptPrompt) {
              llmService.awaitingPostInterruptPrompt = false;

              llmService.streamChatCompletion([
                { role: "user", content: parsedMessage.voicePrompt },
              ]);
            } else {
              console.warn("Stream already active — ignoring new prompt.");
            }
            break;
          case "setup":
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔌 [WebSocket] Setup message received from Twilio');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📞 Call SID:', parsedMessage.callSid);
            console.log('📍 Session ID:', parsedMessage.sessionId);
            console.log('📱 From:', parsedMessage.from);
            console.log('📲 To:', parsedMessage.to);
            if (parsedMessage.customParameters) {
              console.log('📦 Custom Parameters received:');
              console.log(JSON.stringify(parsedMessage.customParameters, null, 2));
            } else {
              console.log('📦 Custom Parameters: None');
            }
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            llmService.setup(parsedMessage);
            break;
          case "error":
            // Handle error case if needed
            break;
          case "interrupt":
            const { utteranceUntilInterrupt } = parsedMessage;

            llmService.userInterrupted = true;
            llmService.awaitingPostInterruptPrompt = true;


            llmService.addInterruptionMessage({
              role: "system",
              content: `You were interrupted. This is what you said until interruption: "${utteranceUntilInterrupt}"`
            });

            break;
          case "dtmf":
              console.log("DTMF Message", parsedMessage);
              const processedDTMF = dtmfHelper.processDTMF(parsedMessage.digit);
              llmService.streamChatCompletion([
                { role: "system", content: processedDTMF },
              ]);
              break;
          default:
            console.warn(`Unknown message type: ${parsedMessage.type}`);
        }
      } catch (error) {
        console.error(`Error parsing message: ${message}`, error);
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid message format",
          })
        );
      }
    });

    ws.on("close", () => {
      console.log("WebSocket connection closed");
    });

    llmService.on("chatCompletion:complete", (message: any) => {
      const textMessage = {
        type: "text",
        token: message.content,
        last: true,
      };
      ws.send(JSON.stringify(textMessage));
    });

    llmService.on("streamChatCompletion:partial", (content: any) => {
      const textMessage = {
        type: "text",
        token: content,
        last: false,
      };
      ws.send(JSON.stringify(textMessage));
    });

    llmService.on("streamChatCompletion:complete", (message: any) => {
      const textMessage = {
        type: "text",
        token: message.content,
        last: false,
      };
      ws.send(JSON.stringify(textMessage));
    });

    llmService.on("humanAgentHandoff", (message: any) => {
      const endMessage = {
        type: "end",
        handoffData: JSON.stringify(message), // important to stringify the object
      };

      ws.send(JSON.stringify(endMessage));
    });

    llmService.on("endInteraction", () => {
      const endMessage = {
        type: "end",
      };

      ws.send(JSON.stringify(endMessage));
    });

    llmService.on("switchLanguage", (message: any) => {

      const languageCode = config.languages[message.targetLanguage]?.locale_code;
      if (!languageCode) {
        console.info("Language not supported");
        return;
      }

      const languageMessage = { 
        type: "language",
        ttsLanguage: languageCode,
        transcriptionLanguage: languageCode
      }

      console.log("Switch Language", languageMessage);
      ws.send(JSON.stringify(languageMessage))
    });
  });
}

