// Core game types — imported by both @wildcard/server and @wildcard/client.
// This is the single source of truth for what a Card, GameState, etc. look like.

export type CardColor = "green" | "red" | "yellow" | "blue";

export type CardType =
  | "NUMBER"
  | "SKIP"
  | "REVERSE"
  | "DRAW_TWO"
  | "WILD"
  | "WILD_DRAW_FOUR";

export interface Card {
  id: string;
  type: CardType;
  color: CardColor | null; // null for WILD / WILD_DRAW_FOUR until played
  value: number | null; // 0-9 for NUMBER cards, null otherwise
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
}

export type RoomStatus = "WAITING" | "IN_PROGRESS" | "ROUND_OVER";

export type ArenaTheme = "midnight" | "neon" | "sunset" | "forest";

export interface GameState {
  roomId: string;
  status: RoomStatus;
  players: Player[];
  hands: Record<string, Card[]>; // never sent in full to clients — see ClientView
  drawPile: Card[];
  discardPile: Card[];
  activeColor: CardColor;
  currentPlayerIndex: number;
  direction: 1 | -1;
  maxPlayers: number;
  theme: ArenaTheme;
  winnerId: string | null;
}

// What a single connected client actually receives — their own hand in full,
// everyone else redacted to just a count. Never leak other players' hands.
export interface ClientView {
  roomId: string;
  status: RoomStatus;
  players: Array<{ id: string; name: string; isBot: boolean; handCount: number }>;
  myHand: Card[];
  topCard: Card;
  activeColor: CardColor;
  currentPlayerIndex: number;
  direction: 1 | -1;
  drawPileCount: number;
  maxPlayers: number;
  theme: ArenaTheme;
  winnerId: string | null;
}

export interface RoundOverPayload {
  winnerId: string;
  scores: Record<string, number>; // playerId -> points scored this round
}

// ---------- Socket event payloads ----------
// Keeping these here means client and server can never quietly drift apart
// on what a given event's shape is.

export interface RoomCreatePayload {
  hostName: string;
  maxPlayers: number;
  theme: ArenaTheme;
}

export interface RoomJoinPayload {
  roomCode: string;
  playerName: string;
}

export interface PlayCardPayload {
  roomId: string;
  cardId: string;
  chosenColor?: CardColor; // required when playing a WILD / WILD_DRAW_FOUR
}

export interface DrawCardPayload {
  roomId: string;
}

export interface RematchPayload {
  roomId: string;
}

export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_IN_PROGRESS"
  | "ILLEGAL_MOVE"
  | "NOT_YOUR_TURN";

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}
