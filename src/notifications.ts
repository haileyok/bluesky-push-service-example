import * as apn from 'apn';
import { debug, log } from './util/log';
import { Accounts } from './accounts';
import { Bsky } from './bsky';
import { INotification } from './types';

const INTERVAL = Number(process.env.PROCESS_INTERVAL);

const APN_OPTIONS: apn.ProviderOptions = {
  token: {
    key: process.env.APN_KEY_PATH as string,
    keyId: process.env.APN_KEY_ID as string,
    teamId: process.env.APN_TEAM_ID as string,
  },
  production: process.env.APN_PRODUCTION === 'true',
};

export class Notifications {
  private readonly apnProvider: apn.Provider;
  private readonly accounts: Accounts;
  private readonly bsky: Bsky;
  private readonly queue: INotification[] = [];

  private interval: NodeJS.Timeout | null = null;

  constructor(accounts: Accounts) {
    // Set accounts
    this.accounts = accounts;

    this.bsky = new Bsky();

    // Setup notifications
    try {
      this.apnProvider = new apn.Provider(APN_OPTIONS);
      log('Initialized apn provider.');
    } catch (e) {
      log('Failed to initialize apn provider.');
      console.log(e);
    }

    this.start();
  }

  start(): void {
    // We will process a notification every x milliseconds
    this.interval = setInterval(this.processNotification.bind(this), INTERVAL);
  }

  // Stop processing notifications
  stop(): void {
    if (this.interval == null) return;

    clearInterval(this.interval);
    this.interval = null;
  }

  // Add a notification to the queue
  addNotification(notification: INotification): void {
    this.queue.push(notification);
  }

  // Process the next queued notification
  // TODO - We want to add some decent logic here for minimizing the number of notifications sent to the same person for
  // the same post. i.e. a post gets 20 likes in one minute. We probably should only send notifications for that every...
  // five minutes maybe? Think about this one...
  async processNotification(): Promise<void> {
    if (!this.bsky.initialized) return;

    const notification = this.queue.shift();

    if (notification == null) return;

    // Get the creator name
    const creatorName = await this.bsky.getProfileName(notification.creator);

    // Send the notification with the correct message
    switch (notification.type) {
      case 'follows':
        await this.sendIosNotification(
          notification,
          `${creatorName}`,
          `${creatorName} started following you!`,
        );
        break;
      case 'likes':
        await this.sendIosNotification(
          notification,
          `${creatorName}`,
          `${creatorName} liked your post!`,
        );
        break;
      case 'replies':
        await this.sendIosNotification(
          notification,
          `${creatorName} replied to your post!`,
          notification.text ?? '',
        );
        break;
      case 'quotes':
        await this.sendIosNotification(
          notification,
          `${creatorName} quoted your post!`,
          notification.text ?? '',
        );
        break;
      case 'reposts':
        await this.sendIosNotification(
          notification,
          `${creatorName}`,
          `${creatorName} reposted your post!`,
        );
        break;
      case 'mentions':
        await this.sendIosNotification(
          notification,
          `${creatorName} mentioned you!`,
          notification.text ?? '',
        );
        break;
    }
  }

  async sendIosNotification(
    notification: INotification,
    title: string,
    body: string,
  ): Promise<void> {
    const account = this.accounts.getAccount(notification.subject);
    if (account == null) return;

    const apnNotification = new apn.Notification();

    apnNotification.expiry = Math.floor(Date.now() / 1000) + 3600;
    apnNotification.sound = 'ping.aiff';
    apnNotification.alert = {
      title,
      body,
    };
    apnNotification.payload = notification;
    apnNotification.topic = 'app.flurry.social';
    apnNotification.badge = 1;

    await this.apnProvider.send(
      apnNotification,
      account.iosTokens.filter((t) => t[notification.type]).map((t) => t.token),
    );

    debug(`Sent notification to ${notification.subject}`);
  }
}
