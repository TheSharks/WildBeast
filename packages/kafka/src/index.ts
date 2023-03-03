import { Kafka, Producer, ProducerBatch, TopicMessages } from "kafkajs";

export interface CustomMessageFormat {
  type: string;
  payload: any;
  timestamp: string;
}

export interface Options {
  topic: string;
  highWaterMark?: number;
}

export class ProducerFactory {
  private producer: Producer;
  private topic: string;
  private pendingMessages: Array<CustomMessageFormat> = [];
  private highWaterMark: number = 100;

  constructor(options: Options) {
    this.producer = this.createProducer();
    this.topic = options.topic;
    this.highWaterMark = options.highWaterMark || 100;
  }

  public async start(): Promise<void> {
    try {
      await this.producer.connect();
    } catch (error) {
      console.log("Error connecting the producer: ", error);
    }
  }

  public async shutdown(): Promise<void> {
    await this.producer.disconnect();
  }

  public async addMessage(message: CustomMessageFormat): Promise<void> {
    this.pendingMessages.push(message);

    if (this.pendingMessages.length >= this.highWaterMark) {
      await this.flush();
    }
  }

  public async flush(): Promise<void> {
    if (this.pendingMessages.length > 0) {
      const topicMessages: TopicMessages = {
        topic: this.topic,
        messages: this.pendingMessages.map((message) => ({
          value: JSON.stringify(message),
        })),
      };

      const batch: ProducerBatch = {
        topicMessages: [topicMessages],
      };

      await this.producer.sendBatch(batch);
      this.pendingMessages = [];
    }
  }

  private createProducer(): Producer {
    const kafka = new Kafka({
      clientId: "wildbeast-producer",
      brokers: process.env.KAFKA_BROKERS!.split(","),
    });

    return kafka.producer();
  }
}
