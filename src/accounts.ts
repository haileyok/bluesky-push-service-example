import { IAccount, IToken } from './types';
import * as Knex from 'knex';
import { debug } from './util/log';

export class Accounts {
  accounts: Map<string, IAccount> = new Map<string, IAccount>();
  // @ts-expect-error - Okay
  knex: Knex;

  constructor() {
    this.knex = Knex({
      client: 'mysql2',
      connection: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
      },
      debug: false,
    });

    void this.updateAccounts();
    setInterval(this.updateAccounts.bind(this), 1000 * 30);
  }

  private async updateAccounts(): Promise<void> {
    const accounts = await this.knex('accounts')
      .select('accounts.did')
      .select(
        this.knex.raw(
          `CASE
            WHEN COUNT(ios_tokens.token) > 0
            THEN CONCAT("[", GROUP_CONCAT(DISTINCT JSON_OBJECT("token", ios_tokens.token, "likes", ios_tokens.likes, "follows", ios_tokens.follows, "replies", ios_tokens.replies, "reposts", ios_tokens.reposts, "quotes", ios_tokens.quotes, "mentions", ios_tokens.mentions)), "]")
            ELSE NULL
          END as iosTokens`,
        ),
        this.knex.raw(
          `
           CASE
            WHEN COUNT(android_tokens.token) > 0
            THEN CONCAT("[", GROUP_CONCAT(DISTINCT JSON_OBJECT("token", android_tokens.token, "likes", android_tokens.likes, "follows", android_tokens.follows, "replies", android_tokens.replies, "reposts", android_tokens.reposts, "quotes", android_tokens.quotes, "mentions", android_tokens.mentions)), "]")
            ELSE NULL
          end as androidTokens`,
        ),
      )
      .leftJoin(
        'accounts_ios_tokens',
        'accounts.id',
        'accounts_ios_tokens.account_id',
      )
      .leftJoin(
        'ios_tokens',
        'accounts_ios_tokens.ios_token_id',
        'ios_tokens.id',
      )
      .leftJoin(
        'accounts_android_tokens',
        'accounts.id',
        'accounts_android_tokens.account_id',
      )
      .leftJoin(
        'android_tokens',
        'accounts_android_tokens.android_token_id',
        'android_tokens.id',
      )
      .groupBy('accounts.did');

    for (const account of accounts) {
      this.accounts.set(account.did, {
        did: account.did,
        iosTokens:
          account.iosTokens != null
            ? (JSON.parse(account.iosTokens, (k, v) =>
                v === 1 ? true : v === 0 ? false : v,
              ) as IToken[])
            : [],
        androidTokens:
          account.androidTokens != null
            ? (JSON.parse(account.androidTokens, (k, v) =>
                v === 1 ? true : v === 0 ? false : v,
              ) as IToken[])
            : [],
      });
    }

    debug(`Updated ${accounts.length} accounts.`);
  }

  public isAccountSubscribed(did: string): boolean {
    return this.accounts.has(did);
  }

  public getAccount(did: string): IAccount | undefined {
    return this.accounts.get(did);
  }
}
