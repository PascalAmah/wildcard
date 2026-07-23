import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
} from "react";
import type { ClientView, RoomStatus, ArenaTheme } from "@wildcard/shared";
import { socket, getStoredPlayerId } from "../lib/socketClient";

// ---------- Types ----------

export interface WaitingRoomState {
  roomId?: string;
  players: Array<{
    id: string;
    name: string;
    isBot: boolean;
    isReady: boolean;
  }>;
  hostId: string;
  maxPlayers: number;
  theme: ArenaTheme;
}

export interface GameView extends ClientView {
  roomId: string;
}

export type AppState =
  | { screen: "landing" }
  | {
      screen: "lobby";
      roomId: string | null;
    }
  | {
      screen: "waiting";
      room: WaitingRoomState;
      myPlayerId: string;
    }
  | {
      screen: "playing";
      view: GameView;
      myPlayerId: string;
    }
  | {
      screen: "roundOver";
      winnerId: string;
      scores: Record<string, number>;
      handCounts: Record<string, number>;
    };

type Action =
  | { type: "GO_TO_LOBBY"; roomId: string }
  | { type: "ROOM_STATE"; room: WaitingRoomState; myPlayerId: string }
  | { type: "GAME_STATE"; view: ClientView; myPlayerId: string }
  | { type: "ROUND_OVER"; winnerId: string; scores: Record<string, number>; handCounts: Record<string, number> }
  | { type: "GO_TO_LANDING" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "GO_TO_LOBBY":
      return {
        ...state,
        screen: "lobby",
        roomId: action.roomId,
      };
    case "ROOM_STATE": {
      if (state.screen === "playing" || state.screen === "roundOver") {
        return state;
      }
      return {
        ...state,
        screen: "waiting",
        room: action.room,
        myPlayerId: action.myPlayerId,
      };
    }
    case "GAME_STATE":
      return {
        screen: "playing",
        view: action.view as GameView,
        myPlayerId: action.myPlayerId,
      };
    case "ROUND_OVER":
      return {
        screen: "roundOver",
        winnerId: action.winnerId,
        scores: action.scores,
        handCounts: action.handCounts,
      };
    case "GO_TO_LANDING":
      return { screen: "landing" };
    default:
      return state;
  }
}

const initialState: AppState = { screen: "landing" };

// ---------- Context ----------

interface GameStateContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const GameStateContext = createContext<GameStateContextValue | null>(null);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    function onRoomState(data: {
      players: Array<{
        id: string;
        name: string;
        isBot: boolean;
        isReady: boolean;
      }>;
      hostId: string;
      maxPlayers: number;
      theme: ArenaTheme;
    }) {
      dispatch({
        type: "ROOM_STATE",
        room: data,
        myPlayerId: getStoredPlayerId() || socket.id || "",
      });
    }

    function onGameState(data: ClientView) {
      dispatch({
        type: "GAME_STATE",
        view: data,
        myPlayerId: getStoredPlayerId() || socket.id || "",
      });
    }

    function onRoundOver(data: { winnerId: string; scores: Record<string, number>; handCounts: Record<string, number> }) {
      dispatch({
        type: "ROUND_OVER",
        winnerId: data.winnerId,
        scores: data.scores,
        handCounts: data.handCounts,
      });
    }

    socket.on("room:state", onRoomState);
    socket.on("game:state", onGameState);
    socket.on("game:roundOver", onRoundOver);

    return () => {
      socket.off("room:state", onRoomState);
      socket.off("game:state", onGameState);
      socket.off("game:roundOver", onRoundOver);
    };
  }, []);

  return (
    <GameStateContext.Provider value={{ state, dispatch }}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState(): GameStateContextValue {
  const ctx = useContext(GameStateContext);
  if (!ctx) {
    throw new Error("useGameState must be used within a GameStateProvider");
  }
  return ctx;
}
