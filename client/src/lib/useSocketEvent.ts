import { useEffect } from "react";
import { socket } from "./socket";

export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  useEffect(() => {
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [event, handler]);
}

