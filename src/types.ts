export interface IAccount {
  did: string;
  iosTokens: IToken[];
  androidTokens: IToken[];
}

export interface IToken {
  token: string;
  likes: boolean;
  follows: boolean;
  replies: boolean;
  reposts: boolean;
  quotes: boolean;
  mentions: boolean;
}

export interface INotification {
  type: 'likes' | 'follows' | 'replies' | 'reposts' | 'quotes' | 'mentions';
  creator: string;
  subject: string;
  uri?: string;
  text?: string;
}
