import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import Redis from 'ioredis';

const POLLING_SIGNAL_KEY = '__isPollingSignal__';
type RedisClient = InstanceType<typeof Redis>;

type RedisCredential = {
  host: string;
  port: number;
  ssl?: boolean;
  database: number;
  user?: string;
  password?: string;
};

function setupRedisClient(credentials: RedisCredential): RedisClient {
  return new Redis({
    host: credentials.host,
    port: credentials.port,
    tls: credentials.ssl ? {} : undefined,
    db: credentials.database,
    username: credentials.user || undefined,
    password: credentials.password || undefined,
    showFriendlyErrorStack: true,
  });
}

export class MessageBuffer implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Message Buffer',
    name: 'messageBuffer',
    icon: 'file:icon.svg',
    group: ['transform'],
    version: 1,
    description:
      'Buffers messages for a set time to consolidate them into one. Uses a polling loop. ⚠️ Do not connect anything to the "Discarded" output — it is for internal use only⚠️ .',
    defaults: {
      name: 'Message Buffer',
    },
    inputs: ['main'] as unknown as any,
    outputs: ['main', 'main', 'main'] as unknown as any,
    outputNames: ['Message Ready', 'Wait', 'Discarded'],
    credentials: [
      {
        name: 'redis',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Conversation Key',
        name: 'conversationKey',
        type: 'string',
        required: true,
        default: '',
        description:
          'A unique key for the conversation (e.g., userId, chatId). This is crucial to keep conversations separate.',
      },
      {
        displayName: 'Message Field',
        name: 'messageField',
        type: 'string',
        required: true,
        default: '',
        description:
          'The field in the incoming JSON that contains the message text to buffer.',
      },
      {
        displayName: 'Output Field Name',
        name: 'outputFieldName',
        type: 'string',
        default: 'consolidatedMessage',
        description: 'The name of the new field for the consolidated message.',
      },
      {
        displayName: 'Wait Time (seconds)',
        name: 'waitTime',
        type: 'number',
        typeOptions: {
          minValue: 1,
        },
        default: 5,
        description:
          'Time to wait after the last message before consolidating. This value resets with each new message.',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const conversationKey = this.getNodeParameter(
      'conversationKey',
      0,
    ) as string;
    const messageField = this.getNodeParameter('messageField', 0) as string;
    const waitTime = this.getNodeParameter('waitTime', 0) as number;
    const outputFieldName = this.getNodeParameter(
      'outputFieldName',
      0,
      'consolidatedMessage',
    ) as string;

    const credentials = await this.getCredentials('redis');
    if (!credentials) {
      throw new Error('Redis credentials are not configured for this node.');
    }

    const redis = setupRedisClient(credentials as RedisCredential);

    const items = this.getInputData();
    const returnDataWait: INodeExecutionData[] = [];
    const returnDataMessageReady: INodeExecutionData[] = [];
    const returnDataDiscarded: INodeExecutionData[] = [];

    const dataKey = `msg:${conversationKey}`;
    const timerKey = `timer:${conversationKey}`;

    const item = items[0];

    try {
      if (item.json[POLLING_SIGNAL_KEY]) {
        const timerExists = await redis.exists(timerKey);

        if (timerExists) {
          returnDataWait.push(item);
        } else {
          const messages = await redis.lrange(dataKey, 0, -1);

          if (messages.length > 0) {
            const consolidatedMessage = messages.join(' ');

            const newJson = { ...item.json };
            delete newJson[POLLING_SIGNAL_KEY];
            newJson[outputFieldName] = consolidatedMessage;
            newJson.allMessages = messages;

            const newItem: INodeExecutionData = {
              json: newJson,
              binary: item.binary,
            };

            returnDataMessageReady.push(newItem);

            await redis.del(dataKey);
          } else {
            returnDataDiscarded.push(item);
          }
        }
      } else {
        if (messageField.trim() !== '') {
          await redis.rpush(dataKey, messageField);

          await redis.set(timerKey, '1', 'EX', waitTime);
          const pollingItem: INodeExecutionData = {
            json: {
              ...item.json,
              [POLLING_SIGNAL_KEY]: true,
            },
            binary: item.binary,
          };
          returnDataWait.push(pollingItem);
        } else {
          returnDataDiscarded.push(item);
        }
      }
    } catch (error) {
      if (this.continueOnFail()) {
        return this.prepareOutputData(items);
      } else {
        const nodeError =
          error instanceof Error ? error.message : 'Unknown error';
        throw nodeError;
      }
    } finally {
      await redis.quit();
    }

    return [
      this.helpers.returnJsonArray(returnDataMessageReady),
      this.helpers.returnJsonArray(returnDataWait),
      this.helpers.returnJsonArray(returnDataDiscarded),
    ];
  }
}
