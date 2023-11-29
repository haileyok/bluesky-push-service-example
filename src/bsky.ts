import { BskyAgent } from '@atproto/api';
import * as dotenv from 'dotenv';

dotenv.config();

export class Bsky {
  private readonly agent: BskyAgent;
  public initialized: boolean = false;

  constructor() {
    this.agent = new BskyAgent({
      service: 'https://api.bsky.app',
    });
    this.initialized = true;
  }

  async getProfileName(did: string): Promise<string> {
    const profile = await this.agent.getProfile({
      actor: did,
    });

    return profile.data.displayName ?? profile.data.handle;
  }
}
