
export interface CallDetails {
  Called: string;          // Phone number being called
  CalledZip: string;       // ZIP code of called number
  CalledCity: string;      // City of called number
  CalledState: string;     // State of called number
  CalledCountry: string;   // Country of called number
  
  To: string;              // Destination phone number
  ToZip: string;           // ZIP code of destination
  ToCity: string;          // City of destination
  ToState: string;         // State of destination
  ToCountry: string;       // Country of destination
  
  From: string;            // Originating phone number
  FromZip: string;         // ZIP code of originator
  FromCity: string;        // City of originator
  FromState: string;       // State of originator
  FromCountry: string;     // Country of originator
  
  Caller: string;          // Caller's phone number
  CallerZip: string;       // ZIP code of caller
  CallerCity: string;      // City of caller
  CallerState: string;     // State of caller
  CallerCountry: string;   // Country of caller
  
  CallSid: string;         // Unique call identifier
  AccountSid: string;      // Twilio account identifier
  
  Direction: 'inbound' | 'outbound' | 'both';  // Call direction
  CallStatus: 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer';
  
  ApiVersion: string;      // Twilio API version
  
  AddOns?: {
    status: string;
    message: string | null;
    code: string | null;
    results: Record<string, unknown>;
  };
}



export type SetupMessage = {
  type: 'setup';
  sessionId: string;
  callSid: string;
  parentCallSid: string;
  from: string;
  to: string;
  forwardedFrom: string;
  callerName: string;
  direction: string;
  callType: string;
  callStatus: string;
  accountSid: string;
  applicationSid: string;
  customParameters?: Record<string, string>;
};

export type PromptMessage = {
  type: 'prompt';
  voicePrompt: string;
};

export type InterruptMessage = {
  type: 'interrupt';
  utteranceUntilInterrupt: string;
  durationUntilInterruptMs: string;
};

export type TextMessage = {
  type: 'text';
  token: string;
  last: string;
};

export type EndMessage = {
  type: 'end';
  handoffData: string;
};

export type ErrorMessage = {
  type: 'error';
};

export type DtmfMessage = {
  type: 'dtmf',
  digit: string;
}

export type LanguageMessage = {
type: 'language';
ttsLanguage: string;
transcriptionLanguage: string;
}

export type ConversationRelayMessage =
  | SetupMessage
  | PromptMessage
  | InterruptMessage
  | EndMessage
  | ErrorMessage
  | TextMessage
  | DtmfMessage;


export type ConversationMessage = {
  ConversationSid: string;
  MessageSid: string;
  Body: string;
  Author: string;
  ParticipantSid: string;
  EventType: string;
  Source: string;
  ClientIdentity?: string;
};

export type ConversationEvent = {
  ConversationSid: string;
  EventType: string;
  ParticipantSid?: string;
  ClientIdentity?: string;
};

export type HandoffData = {
  reason?: string;
  priority?: number;
  attributes?: Record<string, any>;
  customerInfo?: Record<string, any>;
  customerPhone?: string;
  proxyAddress?: string;
  conversationSid?: string;
};