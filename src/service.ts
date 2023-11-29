import { Accounts } from './accounts';
import { Notifications } from './notifications';
import {
  ComAtprotoSyncSubscribeRepos,
  subscribeRepos,
  SubscribeReposMessage,
  XrpcEventStreamClient,
} from 'atproto-firehose';
import {
  AppBskyEmbedRecord,
  AppBskyFeedLike,
  AppBskyFeedPost,
  AppBskyFeedRepost,
  AppBskyGraphFollow,
  AppBskyRichtextFacet,
} from '@atproto/api';
import { getDidFromUri } from './util/splitUri';
import { ReplyRef } from '@atproto/api/dist/client/types/app/bsky/feed/defs';

export class Service {
  accounts: Accounts;
  notifications: Notifications;
  firehose: XrpcEventStreamClient;

  constructor() {
    // Setup data and notifications
    this.accounts = new Accounts();
    this.notifications = new Notifications(this.accounts);

    this.firehose = subscribeRepos('wss://bsky.network', {
      decodeRepoOps: true,
    });
    this.firehose.on('message', this.handleMessage.bind(this));
  }

  handleMessage(message: SubscribeReposMessage): void {
    if (ComAtprotoSyncSubscribeRepos.isCommit(message)) {
      const op = message.ops[0];

      // Get the creator DID
      if (op?.payload == null || op?.action !== 'create') return;

      // Get the creator
      const creator = message.repo;

      if (AppBskyGraphFollow.isRecord(op.payload)) {
        // See if the target is subscribed
        const subject = op.payload.subject;

        // If the subject is the creator or we don't have the subject subscribed, return
        if (subject === creator || !this.accounts.isAccountSubscribed(subject))
          return;

        // Send the notification
        this.notifications.addNotification({
          type: 'follows',
          creator,
          subject,
        });
      } else if (AppBskyFeedPost.isRecord(op.payload)) {
        // Create the post URI
        const postUri = `at://${creator}/${op.path}`;

        // Check if the post is a reply or not
        if (op.payload.reply != null) {
          // Get both the root and the parent URIs
          const rootUri = (op.payload?.reply as ReplyRef)?.root.uri as
            | string
            | undefined;
          const parentUri = (op.payload?.reply as ReplyRef)?.parent.uri as
            | string
            | undefined;

          // I'm pretty sure here these can't be null, but just to make TS happy
          if (rootUri == null || parentUri == null) return;

          // Get the DIDs from those URIs
          const rootSubject = getDidFromUri(rootUri);
          const parentSubject = getDidFromUri(parentUri);

          //
          if (
            rootSubject !== creator &&
            this.accounts.isAccountSubscribed(rootSubject)
          ) {
            this.notifications.addNotification({
              type: 'replies',
              creator,
              subject: rootSubject,
              uri: parentUri,
              text: op.payload.text ?? '',
            });
          } else if (
            parentSubject !== creator &&
            this.accounts.isAccountSubscribed(parentSubject)
          ) {
            this.notifications.addNotification({
              type: 'replies',
              creator,
              subject: parentSubject,
              uri: postUri,
              text: op.payload.text ?? '',
            });
          }
        } else if (op.payload.embed != null) {
          if (AppBskyEmbedRecord.isMain(op.payload.embed)) {
            const subject = getDidFromUri(op.payload.embed.record.uri);

            if (
              subject === creator ||
              !this.accounts.isAccountSubscribed(subject)
            )
              return;

            this.notifications.addNotification({
              type: 'quotes',
              creator,
              subject,
              uri: postUri,
              text: op.payload.text ?? '',
            });
          }
        } else if (op.payload.facets != null) {
          // We need to store the subjects we have already notified
          const notified: string[] = [];

          // Loop through the available facets and the features of those facets
          for (const facet of op.payload.facets) {
            for (const feature of facet.features) {
              // If we find a mention...
              if (AppBskyRichtextFacet.isMention(feature)) {
                const subject = feature.did;

                // Check if the creator is subscribed. If not, we will move on to the next one.
                // Also, if we have already notified this subject, continue. In case two different users are mentioned in the same post.
                if (
                  subject === creator ||
                  !this.accounts.isAccountSubscribed(subject) ||
                  notified.includes(subject)
                )
                  continue;

                // Add the notification
                this.notifications.addNotification({
                  type: 'mentions',
                  creator,
                  subject,
                  text: op.payload.text ?? '',
                  uri: postUri,
                });

                notified.push(subject);
              }
            }
          }
        }
      } else if (AppBskyFeedLike.isRecord(op.payload)) {
        const subject = getDidFromUri(op.payload.subject.uri);

        if (subject === creator || !this.accounts.isAccountSubscribed(subject))
          return;

        this.notifications.addNotification({
          type: 'likes',
          creator,
          subject,
          uri: op.payload.subject.uri,
        });
      } else if (AppBskyFeedRepost.isRecord(op.payload)) {
        const subject = getDidFromUri(op.payload.subject.uri);

        if (subject === creator || !this.accounts.isAccountSubscribed(subject))
          return;

        this.notifications.addNotification({
          type: 'reposts',
          creator,
          subject,
          uri: op.payload.subject.uri,
        });
      }
    }
  }
}
