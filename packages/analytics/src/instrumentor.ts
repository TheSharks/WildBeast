import { Client, Message, Interaction, GuildMember, User } from 'discord.js';
import { AnalyticsService } from './analytics.js';
import { MetricsCollector } from './metrics.js';
import { EventTracker } from './events.js';

export interface InstrumentorConfig {
  trackCommands: boolean;
  trackMessages: boolean;
  trackMemberEvents: boolean;
  trackErrors: boolean;
  trackPerformance: boolean;
  sampleRate: number; // 0-1, percentage of events to track
}

export class Instrumentor {
  private analytics: AnalyticsService;
  private metrics: MetricsCollector;
  private events: EventTracker;
  private config: InstrumentorConfig;

  constructor(
    analytics: AnalyticsService,
    metrics: MetricsCollector,
    events: EventTracker,
    config: Partial<InstrumentorConfig> = {}
  ) {
    this.analytics = analytics;
    this.metrics = metrics;
    this.events = events;
    this.config = {
      trackCommands: true,
      trackMessages: true,
      trackMemberEvents: true,
      trackErrors: true,
      trackPerformance: true,
      sampleRate: 1.0,
      ...config,
    };
  }

  /**
   * Instrument a Discord.js client
   */
  instrumentDiscordClient(client: Client): void {
    // Track client ready event
    client.once('ready', () => {
      this.metrics.updateGuildCount(client.guilds.cache.size);
      this.metrics.updateUserCount(client.users.cache.size);
      
      this.analytics.log({
        timestamp: new Date(),
        level: 'info',
        message: 'Discord client ready',
        source: 'discord-client',
        metadata: {
          guild_count: client.guilds.cache.size,
          user_count: client.users.cache.size,
        },
      });
    });

    // Track messages
    if (this.config.trackMessages) {
      client.on('messageCreate', (message: Message) => {
        if (this.shouldSample()) {
          this.trackMessage(message);
        }
      });
    }

    // Track interactions (commands)
    if (this.config.trackCommands) {
      client.on('interactionCreate', (interaction: Interaction) => {
        if (this.shouldSample()) {
          this.trackInteraction(interaction);
        }
      });
    }

    // Track member events
    if (this.config.trackMemberEvents) {
      client.on('guildMemberAdd', (member: GuildMember) => {
        if (this.shouldSample()) {
          this.trackMemberJoin(member);
        }
      });

      client.on('guildMemberRemove', (member: GuildMember) => {
        if (this.shouldSample()) {
          this.trackMemberLeave(member);
        }
      });
    }

    // Track errors
    if (this.config.trackErrors) {
      client.on('error', (error: Error) => {
        this.trackError(error, 'discord-client');
      });

      client.on('shardError', (error: Error) => {
        this.trackError(error, 'discord-shard');
      });
    }

    // Track guild events
    client.on('guildCreate', (guild) => {
      this.metrics.updateGuildCount(client.guilds.cache.size);
      this.analytics.log({
        timestamp: new Date(),
        level: 'info',
        message: 'Joined guild',
        source: 'discord-client',
        guild_id: guild.id,
        metadata: {
          guild_name: guild.name,
          member_count: guild.memberCount,
        },
      });
    });

    client.on('guildDelete', (guild) => {
      this.metrics.updateGuildCount(client.guilds.cache.size);
      this.analytics.log({
        timestamp: new Date(),
        level: 'info',
        message: 'Left guild',
        source: 'discord-client',
        guild_id: guild.id,
        metadata: {
          guild_name: guild.name,
        },
      });
    });
  }

  /**
   * Instrument a function with performance tracking
   */
  instrumentFunction<T extends (...args: any[]) => any>(
    fn: T,
    name: string,
    context?: Record<string, any>
  ): T {
    return ((...args: Parameters<T>) => {
      const start = Date.now();
      const startTime = process.hrtime();

      try {
        const result = fn(...args);
        
        if (result instanceof Promise) {
          return result
            .then((res) => {
              this.recordFunctionSuccess(name, start, startTime, context);
              return res;
            })
            .catch((error) => {
              this.recordFunctionError(name, start, startTime, error, context);
              throw error;
            });
        } else {
          this.recordFunctionSuccess(name, start, startTime, context);
          return result;
        }
      } catch (error) {
        this.recordFunctionError(name, start, startTime, error, context);
        throw error;
      }
    }) as T;
  }

  /**
   * Instrument an async function with performance tracking
   */
  instrumentAsyncFunction<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    name: string,
    context?: Record<string, any>
  ): T {
    return (async (...args: Parameters<T>) => {
      const start = Date.now();
      const startTime = process.hrtime();

      try {
        const result = await fn(...args);
        this.recordFunctionSuccess(name, start, startTime, context);
        return result;
      } catch (error) {
        this.recordFunctionError(name, start, startTime, error, context);
        throw error;
      }
    }) as T;
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private trackMessage(message: Message): void {
    if (message.author.bot) return;

    const messageType = message.attachments.size > 0 ? 'attachment' : 'text';
    
    // Track in metrics
    this.metrics.incrementCounter('discord_messages_total', {
      guild_id: message.guild?.id || 'dm',
      channel_id: message.channel.id,
      type: messageType,
    });

    // Track in events
    this.events.trackMessage(
      message.author.id,
      message.guild?.id || 'dm',
      message.channel.id,
      messageType,
      message.content.length
    );

    // Log if it's a significant message
    if (message.content.length > 500 || message.attachments.size > 0) {
      this.analytics.log({
        timestamp: new Date(),
        level: 'debug',
        message: 'Large message processed',
        source: 'discord-message',
        user_id: message.author.id,
        guild_id: message.guild?.id,
        channel_id: message.channel.id,
        metadata: {
          message_length: message.content.length,
          attachments: message.attachments.size,
          message_type: messageType,
        },
      });
    }
  }

  private trackInteraction(interaction: Interaction): void {
    if (!interaction.isChatInputCommand()) return;

    const start = Date.now();
    const command = interaction.commandName;
    const userId = interaction.user.id;
    const guildId = interaction.guild?.id;
    const channelId = interaction.channel?.id;

    // Track command start
    this.metrics.incrementCounter('discord_commands_total', {
      command,
      guild_id: guildId || 'dm',
      user_id: userId,
      status: 'started',
    });

    // Track in events
    this.events.trackCommand(
      userId,
      guildId || 'dm',
      channelId || 'dm',
      command,
      interaction.options.data.map(opt => ({ name: opt.name, value: opt.value })),
      0, // Duration will be updated later
      true // Will be updated on error
    );

    // Hook into the interaction response to track completion
    const originalReply = interaction.reply.bind(interaction);
    const originalEditReply = interaction.editReply.bind(interaction);
    const originalFollowUp = interaction.followUp.bind(interaction);

    interaction.reply = async (options: any) => {
      try {
        const result = await originalReply(options);
        this.recordCommandSuccess(command, userId, guildId, start);
        return result;
      } catch (error) {
        this.recordCommandError(command, userId, guildId, start, error);
        throw error;
      }
    };

    interaction.editReply = async (options: any) => {
      try {
        const result = await originalEditReply(options);
        this.recordCommandSuccess(command, userId, guildId, start);
        return result;
      } catch (error) {
        this.recordCommandError(command, userId, guildId, start, error);
        throw error;
      }
    };

    interaction.followUp = async (options: any) => {
      try {
        const result = await originalFollowUp(options);
        this.recordCommandSuccess(command, userId, guildId, start);
        return result;
      } catch (error) {
        this.recordCommandError(command, userId, guildId, start, error);
        throw error;
      }
    };
  }

  private trackMemberJoin(member: GuildMember): void {
    this.events.trackUserJoin(member.user.id, member.guild.id);
    
    this.analytics.log({
      timestamp: new Date(),
      level: 'info',
      message: 'Member joined guild',
      source: 'discord-member',
      user_id: member.user.id,
      guild_id: member.guild.id,
      metadata: {
        username: member.user.username,
        account_age: Date.now() - member.user.createdTimestamp,
      },
    });
  }

  private trackMemberLeave(member: GuildMember): void {
    this.events.trackUserLeave(member.user.id, member.guild.id);
    
    this.analytics.log({
      timestamp: new Date(),
      level: 'info',
      message: 'Member left guild',
      source: 'discord-member',
      user_id: member.user.id,
      guild_id: member.guild.id,
      metadata: {
        username: member.user.username,
        join_date: member.joinedTimestamp,
      },
    });
  }

  private trackError(error: Error, source: string): void {
    this.metrics.recordError(source, error.name, 'high');
    
    this.analytics.log({
      timestamp: new Date(),
      level: 'error',
      message: error.message,
      source,
      error,
      metadata: {
        error_name: error.name,
        stack: error.stack,
      },
    });
  }

  private recordCommandSuccess(command: string, userId: string, guildId: string | undefined, startTime: number): void {
    const duration = (Date.now() - startTime) / 1000;
    
    this.metrics.incrementCounter('discord_commands_total', {
      command,
      guild_id: guildId || 'dm',
      user_id: userId,
      status: 'success',
    });

    this.metrics.recordCommandDuration(command, duration, 'success');
  }

  private recordCommandError(command: string, userId: string, guildId: string | undefined, startTime: number, error: any): void {
    const duration = (Date.now() - startTime) / 1000;
    
    this.metrics.incrementCounter('discord_commands_total', {
      command,
      guild_id: guildId || 'dm',
      user_id: userId,
      status: 'error',
    });

    this.metrics.recordCommandDuration(command, duration, 'error');
    
    this.analytics.log({
      timestamp: new Date(),
      level: 'error',
      message: `Command ${command} failed`,
      source: 'discord-command',
      user_id: userId,
      guild_id: guildId,
      command,
      error,
      metadata: {
        duration,
        error_name: error?.name,
        error_message: error?.message,
      },
    });
  }

  private recordFunctionSuccess(name: string, startTime: number, hrStart: [number, number], context?: Record<string, any>): void {
    const duration = (Date.now() - startTime) / 1000;
    const hrEnd = process.hrtime(hrStart);
    const preciseMs = hrEnd[0] * 1000 + hrEnd[1] / 1000000;

    this.metrics.observeHistogram('analytics_processing_duration_seconds', duration, {
      operation: name,
    });

    if (this.config.trackPerformance && (duration > 1 || preciseMs > 100)) {
      this.analytics.log({
        timestamp: new Date(),
        level: 'debug',
        message: `Function ${name} completed`,
        source: 'instrumentor',
        metadata: {
          duration,
          precise_ms: preciseMs,
          ...context,
        },
      });
    }
  }

  private recordFunctionError(name: string, startTime: number, hrStart: [number, number], error: any, context?: Record<string, any>): void {
    const duration = (Date.now() - startTime) / 1000;
    const hrEnd = process.hrtime(hrStart);
    const preciseMs = hrEnd[0] * 1000 + hrEnd[1] / 1000000;

    this.metrics.recordError('instrumentor', error?.name || 'unknown', 'medium');

    this.analytics.log({
      timestamp: new Date(),
      level: 'error',
      message: `Function ${name} failed`,
      source: 'instrumentor',
      error,
      metadata: {
        duration,
        precise_ms: preciseMs,
        ...context,
      },
    });
  }
}