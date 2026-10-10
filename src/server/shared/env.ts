export type SessionUser = {
  id: string;
  name: string;
  image: string | null;
  isAnonymous: boolean;
};

export type Env = {
  Variables: {
    session: unknown;
    user: SessionUser | null;
  };
};
