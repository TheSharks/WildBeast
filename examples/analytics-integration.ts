import { Client, GatewayIntentBits } from 'discord.js';
import { SapphireClient } from '@sapphire/framework';
import { initializeAnalytics, getAnalytics } from '@thesharks/analytics';
import { EnhancedLogger } from '@thesharks/logger';

// Analytics configuration
const analyticsConfig = {
  clickhouse: {
    host: process.env.CLICKHOUSE_HOST || 'localhost',
    port: parseInt(process.env.CLICKHOUSE_PORT || '8123'),
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DATABASE || 'wildbeast',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.ENVIRONMENT || 'production',
    release: process.env.VERSION || 'unknown',
  },
  prometheus: {
    port: parseInt(process.env.PROMETHEUS_PORT || '9090'),
    path: process.env.PROMETHEUS_PATH || '/metrics',
  },
};

// Initialize analytics
async function initializeAnalyticsSystem(): Promise<void> {
  console.log('Initializing analytics system...');
  
  try {
    const analytics = await initializeAnalytics(analyticsConfig);
    console.log('Analytics system initialized successfully');
    
    // Set up analytics event listeners
    analytics.on('initialized', () => {
      console.log('Analytics fully initialized');
    });
    
    analytics.on('error', (error) => {
      console.error('Analytics error:', error);
    });
    
  } catch (error) {
    console.error('Failed to initialize analytics:', error);
    process.exit(1);
  }
}

// Enhanced Discord client with analytics
class AnalyticsDiscordClient extends SapphireClient {
  private logger: EnhancedLogger;
  
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      logger: {
        level: 'info',
      },
    });
    
    // Initialize enhanced logger
    this.logger = new EnhancedLogger({ level: 'info' });
    
    // Set up event listeners for analytics
    this.setupAnalyticsListeners();
  }
  
  private setupAnalyticsListeners(): void {
    // Track when client is ready
    this.once('ready', () => {
      this.logger.logDiscordEvent('client_ready', {
        guilds: this.guilds.cache.size,
        users: this.users.cache.size,
      });
    });
    
    // Track guild joins/leaves
    this.on('guildCreate', (guild) => {
      this.logger.logGuildEvent('guild_joined', guild.id, {
        name: guild.name,
        member_count: guild.memberCount,
        features: guild.features,
      });
    });
    
    this.on('guildDelete', (guild) => {
      this.logger.logGuildEvent('guild_left', guild.id, {
        name: guild.name,
        unavailable: guild.unavailable,
      });
    });
    
    // Track member events
    this.on('guildMemberAdd', (member) => {
      this.logger.logUserEvent('member_joined', member.id, member.guild.id, {
        username: member.user.username,
        account_age: Date.now() - member.user.createdTimestamp,
      });
    });
    
    this.on('guildMemberRemove', (member) => {
      this.logger.logUserEvent('member_left', member.id, member.guild.id, {
        username: member.user.username,
        join_date: member.joinedTimestamp,
      });
    });
    
    // Track messages
    this.on('messageCreate', (message) => {
      if (message.author.bot) return;
      
      this.logger.logUserEvent('message_sent', message.author.id, message.guild?.id, {
        channel_id: message.channel.id,
        content_length: message.content.length,
        has_attachments: message.attachments.size > 0,
        mentions: message.mentions.users.size,
      });
    });
    
    // Track errors
    this.on('error', (error) => {
      this.logger.errorWithContext('Discord client error', {
        metadata: { error_type: 'client_error' },
      }, error);
    });
  }
  
  public async start(): Promise<void> {
    // Initialize analytics first
    await initializeAnalyticsSystem();
    
    // Flush any buffered logs
    this.logger.flushBufferedLogs();
    
    // Start the Discord client
    await this.login(process.env.DISCORD_TOKEN);
  }
}

// Example command with analytics
export class PingCommand {
  public async run(interaction: any) {
    const startTime = Date.now();
    const logger = new EnhancedLogger({ level: 'info' });
    
    try {
      // Log command start
      logger.logCommandStart(
        'ping',
        interaction.user.id,
        interaction.guild?.id,
        interaction.channel?.id,
        []
      );
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reply to the command
      await interaction.reply('Pong!');
      
      // Log command success
      const duration = Date.now() - startTime;
      logger.logCommandSuccess(
        'ping',
        interaction.user.id,
        interaction.guild?.id,
        interaction.channel?.id,
        duration
      );
      
      // Track analytics event
      if (getAnalytics) {
        const analytics = getAnalytics();
        await analytics.track({
          event_type: 'command_executed',
          user_id: interaction.user.id,
          guild_id: interaction.guild?.id,
          channel_id: interaction.channel?.id,
          timestamp: new Date(),
          properties: {
            command: 'ping',
            duration,
            success: true,
          },
        });
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log command error
      logger.logCommandError(
        'ping',
        interaction.user.id,
        error as Error,
        interaction.guild?.id,
        interaction.channel?.id,
        duration
      );
      
      // Track error in analytics
      if (getAnalytics) {
        const analytics = getAnalytics();
        await analytics.track({
          event_type: 'command_error',
          user_id: interaction.user.id,
          guild_id: interaction.guild?.id,
          channel_id: interaction.channel?.id,
          timestamp: new Date(),
          properties: {
            command: 'ping',
            duration,
            error_name: (error as Error).name,
            error_message: (error as Error).message,
          },
        });
      }
      
      throw error;
    }
  }
}

// Example analytics queries
export class AnalyticsQueries {
  private analytics = getAnalytics();
  
  async getGuildAnalytics(guildId: string) {
    return {
      // User activity over the last 30 days
      userActivity: await this.analytics.getUserActivity(guildId, 30),
      
      // Guild statistics
      guildStats: await this.analytics.getGuildStats(guildId, 30),
      
      // Error rate over the last 24 hours
      errorRate: await this.analytics.getErrorRate(24),
      
      // Performance metrics
      performance: await this.analytics.getPerformanceMetrics(undefined, 24),
    };
  }
  
  async getCommandAnalytics(command?: string) {
    return {
      // Command usage statistics
      performance: await this.analytics.getPerformanceMetrics(command, 168), // 7 days
      
      // Error rates by command
      errors: await this.analytics.getErrorRate(168),
    };
  }
}

// Example usage
async function main() {
  const client = new AnalyticsDiscordClient();
  await client.start();
  
  // Example of getting analytics data
  setTimeout(async () => {
    const queries = new AnalyticsQueries();
    const analytics = await queries.getGuildAnalytics('some-guild-id');
    console.log('Guild analytics:', analytics);
  }, 10000);
}

// Start the bot if this file is run directly
if (require.main === module) {
  main().catch(console.error);
}

export { AnalyticsDiscordClient, AnalyticsQueries };