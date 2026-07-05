export {};

declare global {
  namespace Express {
    interface Request {
      auth?: {
        uid: string;
        source: "firebase" | "dev";
        email?: string | null;
      };
    }
  }
}
